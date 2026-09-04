/**
 * Client-side code runners for the Playground.
 *
 * Everything here executes IN THE BROWSER — no backend, so there is zero
 * server-side code execution / RCE surface. The old `POST /playground/run`
 * endpoint is no longer used.
 *
 *   • Python → Pyodide (CPython compiled to WebAssembly), lazy-loaded on first
 *     run and memoized for the tab's lifetime.
 *
 * JAVASCRIPT WAS REMOVED, along with the sandboxed Web Worker that ran it. The
 * platform is a course ladder now (Python → C → HTML → AI) and JavaScript
 * belonged to no course, so it sat in the language picker with no lessons,
 * quizzes or games behind it.
 *
 * C and HTML arrive with their own courses and will not reuse this path: C
 * needs a compile step, and HTML is rendered in a preview pane rather than
 * executed.
 *
 * Public API:
 *   runCode({ language, code, stdin }) -> Promise<{ stdout, stderr, output }>
 *   runPython(code, { stdin })         -> Promise<{ stdout, stderr, output }>
 *   loadPythonEngine()                 -> Promise<pyodide>   (warm-up / preload)
 *   isPythonReady()                    -> boolean            (sync, for UX)
 *
 * On engine-load failure (offline / CDN blocked) the Python path throws an
 * Error whose `.name === 'PyodideLoadError'`, so the UI can show a friendly
 * "couldn't load the Python engine" message instead of crashing.
 */

/* ------------------------------------------------------------------ *
 *  Python — Pyodide (WebAssembly), loaded from CDN and memoized.
 * ------------------------------------------------------------------ */

// Pinned version.
const PYODIDE_VERSION = '0.26.4'

/**
 * Where the Pyodide runtime is loaded from.
 *
 * SELF-HOSTING IS STRONGLY RECOMMENDED FOR SCHOOLS. Two independent reasons:
 *
 *  1. School networks routinely block public CDNs. When jsdelivr is filtered,
 *     every Python lesson fails with "couldn't load the Python engine" — in
 *     exactly the environment this product is sold into.
 *  2. Pyodide is a ~10 MB download per device. Served from your own origin it
 *     is cached by the proxy instead of crossing the school's uplink thirty
 *     times when a class starts.
 *
 * To self-host:
 *   1. Download the Pyodide release and copy its `full/` directory to
 *        public/pyodide/v0.26.4/full/
 *   2. Set VITE_PYODIDE_URL=/pyodide/v0.26.4/full/
 *
 * The bundled nginx config already serves /pyodide/ with the correct
 * `application/wasm` type and a long cache. Its CSP also allows the CDN
 * fallback plus the `blob:` worker the JavaScript runner needs — a
 * `default-src 'self'` policy silently breaks both runners.
 *
 * Must end with a trailing slash.
 */
const PYODIDE_CDN = (() => {
  const configured = import.meta.env?.VITE_PYODIDE_URL
  if (configured && String(configured).trim()) {
    const url = String(configured).trim()
    return url.endsWith('/') ? url : `${url}/`
  }
  return `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
})()

// Soft budget: Pyodide runs on the main thread and CPython cannot be preempted
// from JS without SharedArrayBuffer + cross-origin isolation (not available
// here), so a truly infinite Python loop can still freeze the tab. We surface
// this as a gentle UX note rather than a hard kill. JS gets a real timeout via
// the worker below.
const PYTHON_SOFT_BUDGET_MS = 10000

let pyodideInstance = null // resolved instance once ready (sync check)
let pyodidePromise = null // in-flight load promise (memoized)

/** True once the Python engine is downloaded and initialised. */
export function isPythonReady() {
  return pyodideInstance !== null
}

/** Inject the Pyodide loader script from the CDN exactly once. */
function injectPyodideScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.loadPyodide) {
      resolve(window.loadPyodide)
      return
    }
    const existing = document.querySelector('script[data-pyodide-loader]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.loadPyodide))
      existing.addEventListener('error', () => reject(new Error('script error')))
      return
    }
    const script = document.createElement('script')
    script.src = `${PYODIDE_CDN}pyodide.js`
    script.async = true
    script.dataset.pyodideLoader = 'true'
    script.onload = () => resolve(window.loadPyodide)
    script.onerror = () => reject(new Error('script error'))
    document.head.appendChild(script)
  })
}

/**
 * Lazy-load + memoize the Pyodide instance. Rejects with a PyodideLoadError if
 * the CDN is unreachable so callers can show a friendly offline message.
 */
export function loadPythonEngine() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const loadPyodide = await injectPyodideScript()
      if (typeof loadPyodide !== 'function') {
        throw new Error('loadPyodide unavailable')
      }
      const instance = await loadPyodide({ indexURL: PYODIDE_CDN })
      pyodideInstance = instance
      return instance
    })().catch((err) => {
      // Allow a later retry and normalise the error for the UI.
      pyodidePromise = null
      const wrapped = new Error(
        "Couldn't load the Python engine — check your connection and try again."
      )
      wrapped.name = 'PyodideLoadError'
      wrapped.cause = err
      throw wrapped
    })
  }
  return pyodidePromise
}

// Python preamble that (1) batches nothing itself but (2) rewires input() to
// read from the pre-fed stdin string, raising EOFError when it runs out —
// matching CPython's behaviour so student code that calls input() works.
const STDIN_PREAMBLE = `
import builtins as _kk_builtins
_kk_stdin_lines = iter(__KK_STDIN.split("\\n"))
def _kk_input(prompt=""):
    if prompt:
        print(prompt, end="")
    try:
        return next(_kk_stdin_lines)
    except StopIteration:
        raise EOFError("EOF when reading a line")
_kk_builtins.input = _kk_input
`

/**
 * Run Python source in Pyodide.
 * @param {string} code
 * @param {{ stdin?: string }} [opts]
 * @returns {Promise<{ stdout: string, stderr: string, output: string }>}
 */
export async function runPython(code, { stdin = '' } = {}) {
  const pyodide = await loadPythonEngine()

  const out = []
  const err = []
  // Batched stdout/stderr handlers capture print() and tracebacks.
  pyodide.setStdout({ batched: (s) => out.push(s) })
  pyodide.setStderr({ batched: (s) => err.push(s) })

  // Feed stdin to a rewired input(). Set the raw string as a global, split in
  // Python so we don't fight JsProxy iteration semantics.
  pyodide.globals.set('__KK_STDIN', stdin ?? '')

  const startedAt = Date.now()
  try {
    await pyodide.runPythonAsync(STDIN_PREAMBLE)
    await pyodide.runPythonAsync(code)
  } catch (e) {
    // PythonError.message already contains the formatted CPython traceback.
    err.push(e && e.message ? String(e.message) : String(e))
  } finally {
    // Restore defaults so the shared instance is clean for the next run.
    pyodide.setStdout({})
    pyodide.setStderr({})
    try {
      pyodide.globals.delete('__KK_STDIN')
    } catch {
      /* ignore */
    }
  }

  let stderr = err.join('')
  if (!stderr && Date.now() - startedAt > PYTHON_SOFT_BUDGET_MS) {
    stderr =
      'Heads up: that took a while to run. Watch out for loops that never end.'
  }

  const stdout = out.join('')
  return { stdout, stderr, output: stdout }
}

/* ------------------------------------------------------------------ *
 *  Dispatcher
 * ------------------------------------------------------------------ */

/**
 * Run student code entirely client-side.
 *
 * Python only. JavaScript was removed with the move to a course ladder — it
 * belonged to no course, so it appeared in the runner while having no lessons,
 * quizzes or games behind it. Its sandboxed Web Worker went with it.
 *
 * C and HTML arrive with their courses: C needs a compile step, and HTML is
 * rendered in a preview pane rather than executed. Neither fits this
 * interpreter-shaped path, so each will get its own rather than a stub here.
 *
 * @param {{ language: 'python', code: string, stdin?: string }} args
 * @returns {Promise<{ stdout: string, stderr: string, output: string }>}
 */
export function runCode({ language, code, stdin = '' }) {
  if (language === 'python') return runPython(code, { stdin })
  return Promise.resolve({
    stdout: '',
    stderr:
      `${language} cannot be run yet — this playground currently runs Python. ` +
      'Your course will tell you which language to use.',
    output: '',
  })
}
