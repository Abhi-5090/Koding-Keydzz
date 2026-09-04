/**
 * SERVICE WORKER — offline resilience for a school network.
 *
 * WHY: pupils use this on school wifi, which drops. Losing the connection
 * mid-lesson currently means a blank page and a reload that also fails. With
 * the shell cached, the app still opens and can say what is wrong.
 *
 * WHAT IT DOES *NOT* DO, and this is the important part
 * ----------------------------------------------------
 * IT NEVER CACHES `/api`. Not one response, not even a GET.
 *
 * That is not caution for its own sake. This app runs an EXAM: a pupil's paper,
 * their answers, their remaining attempts and their marks all come from the
 * API. A stale cached response could show a pupil a paper they have already
 * submitted, hide an attempt they have spent, or report a mark that has since
 * changed. It could also serve one pupil's data to the next child on a shared
 * classroom machine, because a cache has no idea who is logged in.
 *
 * So: static assets are cached, API traffic goes to the network every time and
 * fails honestly when there is none.
 *
 * THE BIG RUNTIMES
 * ----------------
 * Monaco (~15 MB) and Pyodide (~13 MB) are self-hosted and lazily fetched. On a
 * school connection the first Python lesson is a 13 MB download, and every
 * pupil on that network pays it separately. They are cached on first use and
 * kept across versions of the app, because their filenames carry their own
 * version — re-downloading them on every deploy would be the worst of both
 * worlds.
 */

/**
 * Bump this to invalidate the shell.
 *
 * Kept separate from the runtime caches on purpose: shipping a new app version
 * should not evict 28 MB of interpreter that has not changed.
 */
const SHELL_CACHE = 'kk-shell-v1';
const ASSET_CACHE = 'kk-assets-v1';
const RUNTIME_CACHE = 'kk-runtimes-v1';

/**
 * The minimum needed to render *something* offline.
 *
 * Deliberately short. A long precache list makes installation slow and fragile
 * — one 404 fails the whole `addAll` — and the hashed build assets are cached
 * on first use anyway.
 */
const SHELL = ['/', '/index.html', '/favicon.svg', '/fonts/fonts.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, not addAll: one missing file must not fail the install
      // and leave the app with no service worker at all.
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => {}))
      );
      // Take over immediately rather than waiting for every tab to close.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/** Is this one of the big, self-versioned runtimes? */
function isRuntimeAsset(url) {
  return url.pathname.startsWith('/monaco/') || url.pathname.startsWith('/pyodide/');
}

/**
 * A build asset with a content hash in its name.
 *
 * Safe to cache forever precisely because the name changes when the content
 * does — so a deploy produces new URLs rather than stale hits.
 */
function isHashedAsset(url) {
  return /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|jpg)$/.test(url.pathname);
}

function isFont(url) {
  return url.pathname.startsWith('/fonts/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET. A POST is never idempotent and must never be replayed.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin requests are left entirely alone.
  if (url.origin !== self.location.origin) return;

  /**
   * THE API IS NEVER CACHED, NEVER INTERCEPTED.
   *
   * Returning early — rather than a network-only strategy — means the request
   * behaves exactly as if no service worker existed. See the header note: this
   * app examines children, and a stale answer sheet or another pupil's data
   * served from a cache would be far worse than an offline error.
   */
  if (url.pathname.startsWith('/api')) return;

  // The Socket.IO transport must not be touched either.
  if (url.pathname.startsWith('/socket.io')) return;

  /* ---- the big runtimes: cache first, kept across deploys ---- */
  if (isRuntimeAsset(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  /* ---- hashed build assets and fonts: cache first, immutable by name ---- */
  if (isHashedAsset(url) || isFont(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  /* ---- navigations: network first, shell as the fallback ---- */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Anything else: try the network, fall back to a cached copy if there is one.
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || Response.error()))
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const res = await fetch(request);
    // Only cache a real success. Caching a 404 or an opaque error would make
    // a transient failure permanent.
    if (res && res.ok && res.status === 200) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const stale = await cache.match(request);
    if (stale) return stale;
    throw err;
  }
}

/**
 * Documents come from the network when there is one.
 *
 * Network-first rather than cache-first so a deploy is picked up on the next
 * navigation instead of after a cache expiry — an app that serves a stale
 * index.html can load asset URLs that no longer exist, which looks like a
 * broken deploy to everyone.
 */
async function networkFirstDocument(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put('/index.html', res.clone());
    return res;
  } catch {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;padding:2rem;background:#001621;color:#f5efe6">' +
        '<h1>You are offline</h1>' +
        '<p>Koding Keydzz needs a connection to load. Your progress is safe — ' +
        'try again when the network is back.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * WARM THE BIG RUNTIMES WHEN THE APP IS IDLE.
 *
 * Triggered by the page (see registerServiceWorker) rather than on install, so
 * it never competes with the first paint. This is what turns "the first Python
 * lesson is a 13 MB wait" into "it was already there".
 *
 * Failures are ignored: this is an optimisation, and a pupil on a metered or
 * slow connection must not see an error because a prefetch did not finish.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'warm-runtimes') return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];

  event.waitUntil(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      for (const url of urls) {
        try {
          if (await cache.match(url)) continue;
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await cache.put(url, res.clone());
        } catch {
          // Best effort, by design.
        }
      }
    })()
  );
});
