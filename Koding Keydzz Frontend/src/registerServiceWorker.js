/**
 * SERVICE WORKER REGISTRATION, and warming the big runtimes.
 *
 * Registered AFTER the window `load` event so it never competes with the first
 * paint — a service worker that slows down the initial render has made things
 * worse for the sake of a later benefit.
 *
 * `?warm=1` is not used here; warming is triggered explicitly below once the
 * browser reports it is idle, because Monaco and Pyodide are ~28 MB between
 * them and a pupil on a slow connection should not have that competing with
 * the lesson they are actually trying to open.
 */

/**
 * The runtimes worth pre-fetching, and only their heavy entry files.
 *
 * Derived from the SAME environment variable the loader uses
 * (`VITE_PYODIDE_URL`), not hardcoded. The first version of this list was
 * hardcoded to `/pyodide/pyodide.js` and every URL in it was wrong — Pyodide is
 * served from a versioned directory — so all three fetches 404'd and the
 * warming silently did nothing. A prefetch that fails quietly is worse than no
 * prefetch, because it looks like it is working.
 *
 * Monaco's real bulk is in hashed chunks whose names change per build, so they
 * cannot be listed here; they are cached on first use by the worker instead.
 * `loader.js` is the file whose absence causes the visible stall.
 */
function warmUrls() {
  const configured = import.meta.env?.VITE_PYODIDE_URL;
  const urls = ['/monaco/vs/loader.js'];

  // Only warm Pyodide when it is served from THIS origin. If it is coming from
  // a CDN there is nothing local to cache, and the worker ignores cross-origin
  // requests anyway.
  if (configured && String(configured).trim().startsWith('/')) {
    const base = String(configured).trim().replace(/\/?$/, '/');
    urls.push(
      `${base}pyodide.js`,
      `${base}pyodide.asm.js`,
      // The two large ones: 9.6 MB of wasm and 2.2 MB of stdlib. These are the
      // whole reason warming exists.
      `${base}pyodide.asm.wasm`,
      `${base}python_stdlib.zip`
    );
  }

  return urls;
}

/** Ask the worker to warm the runtimes, when the browser is genuinely idle. */
function warmRuntimes(registration) {
  const send = () => {
    const worker = registration.active;
    if (!worker) return;

    /**
     * Skip on a connection that should not be spending 28 MB.
     *
     * `saveData` is a user asking not to; a `2g` effective type means this
     * would take minutes and starve the actual page. Both are respected
     * rather than treated as edge cases — a school in a low-bandwidth area is
     * exactly who this app is for.
     */
    const conn = navigator.connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    worker.postMessage({ type: 'warm-runtimes', urls: warmUrls() });
  };

  if ('requestIdleCallback' in window) {
    // A generous timeout: if the pupil is busy, warming can wait.
    window.requestIdleCallback(send, { timeout: 10_000 });
  } else {
    setTimeout(send, 5_000);
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Never register from a dev server: a cached shell during development is a
  // debugging trap that costs more time than it saves.
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        warmRuntimes(registration);

        /**
         * A new version is waiting. It is NOT activated silently.
         *
         * Swapping the app underneath someone mid-exam would be indefensible —
         * they could lose an answer they had typed. The worker takes over on
         * the next navigation instead, which is when it is safe.
         */
        registration.addEventListener('updatefound', () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              // Deliberately quiet. The next full page load picks it up.
            }
          });
        });
      })
      .catch(() => {
        // Registration failing is not worth troubling a child with; the app
        // works perfectly well without it.
      });
  });
}

export default registerServiceWorker;
