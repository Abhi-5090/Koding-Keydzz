/**
 * Collect the JavaScript errors a page reports, minus the noise the HARNESS
 * itself creates.
 *
 * The assertion these feed — "this page produced no errors" — is one of the
 * more valuable ones in the suite, so the filter has to be narrow enough to
 * keep it meaningful.
 *
 * WHAT IS FILTERED AND WHY
 * ------------------------
 * Every student page fires four requests on mount (dashboard, notifications,
 * avatar/me, avatar/items). When a test finishes, Playwright navigates away —
 * and any of those four still in flight is ABORTED. Roughly 7% of requests in
 * a full run end that way; the API logs them with no status because no
 * response was ever sent.
 *
 * Chromium reports an aborted request quietly. WebKit raises it as a page
 * error, and — because the request was cross-origin (app on one port, API on
 * another) — words it as "due to access control checks", which reads exactly
 * like a CORS misconfiguration. It is not one: it is the harness closing the
 * page. Left unfiltered it failed one arbitrary test per run, a different game
 * each time, only ever on WebKit.
 *
 * This does NOT hide a real CORS break. A genuinely wrong origin, a missing
 * `Access-Control-Allow-Origin`, or a rate limiter answering without CORS
 * headers fails EVERY request in EVERY test on BOTH browsers — the pages would
 * render empty and dozens of assertions about actual content would fail long
 * before this filter mattered.
 *
 * Also filtered: favicon 404s, and third-party/offline network noise, which
 * describes the machine's connectivity rather than the application.
 */

/** Errors that describe the harness or the network, not the app. */
const HARNESS_NOISE = [
  // A request the harness aborted by navigating away. WebKit's wording.
  /due to access control checks/i,
  /Load failed/i,
  // Chromium/WebKit generic resource failures.
  /Failed to load resource/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /ERR_ABORTED/i,
  // The machine lost connectivity mid-run.
  /Internet connection appears to be offline/i,
  /Failed to preconnect/i,
  // Not an application error.
  /favicon/i,
];

function isNoise(text) {
  return HARNESS_NOISE.some((re) => re.test(text));
}

/**
 * Start collecting errors from `page`.
 *
 * @returns {string[]} a live array — read it AFTER the interaction under test.
 */
export function watchForErrors(page) {
  const errors = [];

  page.on('pageerror', (e) => {
    const text = e?.message || String(e);
    if (isNoise(text)) return;
    errors.push(`pageerror: ${text}`);
  });

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (isNoise(text)) return;
    errors.push(`console: ${text}`);
  });

  return errors;
}

export default watchForErrors;
