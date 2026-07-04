/**
 * Client-side code runners for the Playground.
 *
 * Everything here executes IN THE BROWSER — no backend, so there is zero
 * server-side code execution / RCE surface. The old `POST /playground/run`
 * endpoint is no longer used.
 *
 *   • Python  → Pyodide (CPython compiled to WebAssembly), lazy-loaded from a
 *               CDN on first run and memoized for the tab's lifetime.
 *   • JavaScript → a sandboxed Web Worker (no DOM, no window) with a hard
 *               wall-clock timeout the parent enforces via `worker.terminate()`.
 *
 * Public API:
 *   runCode({ language, code, stdin }) -> Promise<{ stdout, stderr, output }>
 *   runPython(code, { stdin })         -> Promise<{ stdout, stderr, output }>
 *   runJavaScript(code)                -> Promise<{ stdout, stderr, output }>
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

// Pinned version. NOTE: for offline / production hardening, self-host the
// Pyodide assets under /public (copy the `full/` dir) and point PYODIDE_CDN at
// e.g. `/pyodide/v0.26.4/full/` — no code changes needed beyond this constant.
const PYODIDE_VERSION = '0.26.4'
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

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
 *  JavaScript — sandboxed Web Worker with a hard timeout.
 * ------------------------------------------------------------------ */

const JS_TIMEOUT_MS = 4000

// Worker body. Runs inside a Worker global scope: no `window`, no `document`,
// no DOM — so it cannot touch the page. console.* is overridden to stream
// captured output back to the parent; a top-level try/catch reports errors.
const JS_WORKER_SOURCE = `
self.onmessage = function (e) {
  var code = e.data && e.data.code
  var out = []
  var errOut = []

  function fmt(v) {
    if (typeof v === 'string') return v
    if (v instanceof Error) return v.stack || (v.name + ': ' + v.message)
    try {
      return JSON.stringify(v, function (k, val) {
        return typeof val === 'bigint' ? val.toString() + 'n'
          : typeof val === 'function' ? '[Function]'
          : typeof val === 'undefined' ? '[undefined]'
          : val
      }, 2)
    } catch (_) {
      return String(v)
    }
  }
  function line(bucket, args) {
    bucket.push(Array.prototype.map.call(args, fmt).join(' '))
  }

  console.log = function () { line(out, arguments) }
  console.info = function () { line(out, arguments) }
  console.debug = function () { line(out, arguments) }
  console.warn = function () { line(out, arguments) }
  console.error = function () { line(errOut, arguments) }

  try {
    // Indirect eval → runs in global (worker) scope, not this function's scope.
    (0, eval)(code)
    self.postMessage({ stdout: out.join('\\n'), stderr: errOut.join('\\n') })
  } catch (err) {
    var msg = err instanceof Error ? (err.stack || (err.name + ': ' + err.message)) : String(err)
    errOut.push(msg)
    self.postMessage({ stdout: out.join('\\n'), stderr: errOut.join('\\n') })
  }
}
`

/**
 * Run JavaScript source in a sandboxed Worker, terminating it if it exceeds
 * JS_TIMEOUT_MS (guards against infinite loops).
 * @param {string} code
 * @returns {Promise<{ stdout: string, stderr: string, output: string }>}
 */
export function runJavaScript(code) {
  return new Promise((resolve) => {
    let worker
    let blobUrl
    try {
      blobUrl = URL.createObjectURL(
        new Blob([JS_WORKER_SOURCE], { type: 'application/javascript' })
      )
      worker = new Worker(blobUrl)
    } catch (e) {
      resolve({
        stdout: '',
        stderr: 'Could not start the JavaScript sandbox: ' + (e?.message || e),
        output: '',
      })
      return
    }

    let settled = false
    const cleanup = () => {
      if (worker) worker.terminate()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      resolve({ output: result.stdout, ...result })
    }

    const timer = setTimeout(() => {
      finish({
        stdout: '',
        stderr:
          'Your code took too long to finish (over 4s). Check for a loop that never ends.',
      })
    }, JS_TIMEOUT_MS)

    worker.onmessage = (e) => {
      const { stdout = '', stderr = '' } = e.data || {}
      finish({ stdout, stderr })
    }
    worker.onerror = (e) => {
      finish({ stdout: '', stderr: e?.message || 'JavaScript error.' })
    }

    worker.postMessage({ code })
  })
}

/* ------------------------------------------------------------------ *
 *  Dispatcher
 * ------------------------------------------------------------------ */

/**
 * Run student code entirely client-side.
 * @param {{ language: 'python'|'javascript', code: string, stdin?: string }} args
 * @returns {Promise<{ stdout: string, stderr: string, output: string }>}
 */
export function runCode({ language, code, stdin = '' }) {
  if (language === 'python') return runPython(code, { stdin })
  if (language === 'javascript') return runJavaScript(code)
  return Promise.resolve({
    stdout: '',
    stderr: `Unsupported language: ${language}`,
    output: '',
  })
}
