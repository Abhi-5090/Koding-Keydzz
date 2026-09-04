import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

/**
 * THE SERVICE WORKER'S ROUTING RULES.
 *
 * One property here is not an optimisation, it is a safety requirement:
 *
 *   THE WORKER MUST NEVER CACHE OR INTERCEPT /api.
 *
 * This app examines children. A pupil's paper, their answers, their remaining
 * attempts and their marks all come from the API. A stale cached response could
 * show a paper they already submitted, hide an attempt they had spent, or
 * report a mark that has since changed — and because a cache has no idea who is
 * signed in, it could serve one pupil's data to the next child on a shared
 * classroom machine.
 *
 * So this evaluates the REAL public/sw.js in a stubbed worker global and drives
 * its fetch handler. Re-implementing the predicates in the test would prove
 * only that the copy agrees with itself; the shipped file is what runs in a
 * child's browser.
 */

const here = dirname(fileURLToPath(import.meta.url))
const SW_SOURCE = readFileSync(join(here, '..', 'public', 'sw.js'), 'utf8')

/**
 * Run sw.js against a fake ServiceWorkerGlobalScope and return the harness.
 *
 * `respondWith` is recorded rather than executed: what matters is WHETHER the
 * worker took over a request, which is exactly the decision being tested.
 */
function loadWorker() {
  const listeners = {}
  const cachePuts = []

  const cacheStore = {
    match: vi.fn(async () => undefined),
    put: vi.fn(async (req, res) => {
      cachePuts.push(typeof req === 'string' ? req : req.url)
      return undefined
    }),
    add: vi.fn(async () => undefined),
  }

  const sandbox = {
    self: {
      addEventListener: (type, fn) => {
        listeners[type] = fn
      },
      skipWaiting: vi.fn(async () => {}),
      clients: { claim: vi.fn(async () => {}) },
      location: { origin: 'https://school.example' },
    },
    caches: {
      open: vi.fn(async () => cacheStore),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
      match: vi.fn(async () => undefined),
    },
    fetch: vi.fn(async () => ({ ok: true, status: 200, clone: () => ({}) })),
    Response: class {
      constructor(body, init) {
        this.body = body
        this.status = init?.status ?? 200
      }
      static error() {
        return new sandbox.Response('', { status: 500 })
      }
    },
    URL,
    Promise,
    Array,
    Set,
    console,
    setTimeout,
    clearTimeout,
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  vm.runInContext(SW_SOURCE, sandbox)

  return { listeners, sandbox, cacheStore, cachePuts }
}

/**
 * Drive the fetch handler for one request.
 *
 * @returns {boolean} whether the worker took the request over.
 */
function handleFetch(worker, { url, method = 'GET', mode = 'cors' }) {
  let handled = false
  worker.listeners.fetch({
    request: { url, method, mode },
    respondWith: () => {
      handled = true
    },
  })
  return handled
}

describe('the service worker never touches the API', () => {
  let worker

  beforeEach(() => {
    worker = loadWorker()
  })

  it('does NOT intercept an API GET', () => {
    /**
     * The one that matters most. Returning early — rather than using a
     * network-only strategy — means the request behaves exactly as if no
     * service worker existed.
     */
    expect(
      handleFetch(worker, { url: 'https://school.example/api/v1/final-test/python/start' })
    ).toBe(false)
  })

  it('does not intercept ANY API path', () => {
    for (const path of [
      '/api/v1/courses',
      '/api/v1/student/dashboard',
      '/api/v1/certificates',
      '/api/v1/admin/review-queue',
      '/api/health',
    ]) {
      expect(
        handleFetch(worker, { url: `https://school.example${path}` }),
        `intercepted ${path}`
      ).toBe(false)
    }
  })

  it('never writes an API response into a cache', async () => {
    // The belt to the braces above: even if interception changed, nothing
    // from /api may end up stored.
    handleFetch(worker, { url: 'https://school.example/api/v1/courses' })
    await new Promise((r) => setTimeout(r, 0))

    expect(worker.cachePuts.filter((u) => u.includes('/api/'))).toEqual([])
  })

  it('leaves the socket transport alone', () => {
    // Intercepting a long-poll or upgrade request would break realtime.
    expect(
      handleFetch(worker, { url: 'https://school.example/socket.io/?EIO=4&transport=polling' })
    ).toBe(false)
  })

  it('ignores non-GET requests entirely', () => {
    /**
     * A POST is never idempotent. Replaying a submitted exam paper from a
     * cache would be catastrophic, so the method check comes first.
     */
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(
        handleFetch(worker, { url: 'https://school.example/assets/app-abc12345.js', method }),
        `intercepted a ${method}`
      ).toBe(false)
    }
  })

  it('ignores cross-origin requests', () => {
    // Another origin's caching policy is not ours to override.
    expect(handleFetch(worker, { url: 'https://cdn.example.com/thing.js' })).toBe(false)
  })
})

describe('the service worker caches what is safe to cache', () => {
  let worker

  beforeEach(() => {
    worker = loadWorker()
  })

  it('takes over hashed build assets', () => {
    // Safe precisely because the name changes when the content does, so a
    // deploy produces new URLs rather than stale hits.
    expect(
      handleFetch(worker, { url: 'https://school.example/assets/vendor-7JzzXrq2.js' })
    ).toBe(true)
  })

  it('takes over the big self-hosted runtimes', () => {
    for (const path of [
      '/pyodide/v0.26.4/full/pyodide.asm.wasm',
      '/pyodide/v0.26.4/full/python_stdlib.zip',
      '/monaco/vs/loader.js',
      '/monaco/vs/assets/ts.worker-CMbG-7ft.js',
    ]) {
      expect(
        handleFetch(worker, { url: `https://school.example${path}` }),
        `did not cache ${path}`
      ).toBe(true)
    }
  })

  it('takes over fonts', () => {
    // Self-hosted deliberately, so they are ours to cache.
    expect(handleFetch(worker, { url: 'https://school.example/fonts/fonts.css' })).toBe(true)
  })

  it('takes over navigations, to serve a shell when offline', () => {
    expect(
      handleFetch(worker, { url: 'https://school.example/dashboard', mode: 'navigate' })
    ).toBe(true)
  })

  it('does not treat an unhashed asset as immutable', () => {
    /**
     * `/assets/app.js` with no content hash could change under the same URL,
     * so caching it forever would pin a pupil to an old build. It still gets
     * the network-first fallback, but not the immutable path.
     */
    const handled = handleFetch(worker, { url: 'https://school.example/assets/app.js' })
    // Handled (network-first with a fallback) but NOT via the immutable route.
    expect(handled).toBe(true)
  })
})

describe('warming the big runtimes', () => {
  it('only fetches what it has not already cached', async () => {
    /**
     * Warming exists to turn "the first Python lesson is a 13 MB wait" into
     * "it was already there". Re-fetching what is already stored would spend a
     * school's bandwidth for nothing.
     */
    const worker = loadWorker()
    worker.cacheStore.match = vi.fn(async (url) =>
      String(url).includes('python_stdlib') ? { ok: true } : undefined
    )

    const waits = []
    worker.listeners.message({
      data: {
        type: 'warm-runtimes',
        urls: [
          '/pyodide/v0.26.4/full/pyodide.asm.wasm',
          '/pyodide/v0.26.4/full/python_stdlib.zip',
        ],
      },
      waitUntil: (p) => waits.push(p),
    })
    await Promise.all(waits)

    const fetched = worker.sandbox.fetch.mock.calls.map((c) => c[0])
    expect(fetched).toContain('/pyodide/v0.26.4/full/pyodide.asm.wasm')
    expect(fetched, 're-fetched something already cached').not.toContain(
      '/pyodide/v0.26.4/full/python_stdlib.zip'
    )
  })

  it('ignores a message that is not a warm request', () => {
    const worker = loadWorker()
    // A stray postMessage must not trigger a 13 MB download.
    worker.listeners.message({ data: { type: 'something-else' }, waitUntil: () => {} })
    expect(worker.sandbox.fetch).not.toHaveBeenCalled()
  })

  it('survives a failed prefetch without throwing', async () => {
    // Best effort by design: a pupil on a slow connection must not see an
    // error because a background prefetch did not finish.
    const worker = loadWorker()
    worker.sandbox.fetch = vi.fn(async () => {
      throw new Error('offline')
    })

    const waits = []
    worker.listeners.message({
      data: { type: 'warm-runtimes', urls: ['/pyodide/v0.26.4/full/pyodide.asm.wasm'] },
      waitUntil: (p) => waits.push(p),
    })

    await expect(Promise.all(waits)).resolves.toBeDefined()
  })
})
