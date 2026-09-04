import { Component, lazy } from 'react';

/**
 * Lazy route loading that survives a dropped chunk.
 *
 * Every page here is a separate chunk fetched when the staff member clicks a
 * nav item. React.lazy treats a failed fetch as a render error, and with no
 * boundary above it React unmounts the tree — the administrator gets a blank
 * white page with no message and no way back but knowing to reload.
 *
 * This is the same fix as the student app's routes/lazyWithRetry.jsx, kept
 * separate because the two apps share no code and the copy differs: this
 * audience is a school administrator, not a nine-year-old.
 *
 *   1. `lazyWithRetry` retries the import first — a transient blip is the
 *      common case and nobody needs to know it happened.
 *   2. `RouteErrorBoundary` catches the rest and offers a reload.
 */

const RETRIES = 2;
const BACKOFF_MS = 400;

/**
 * Run a dynamic import, retrying a bounded number of times.
 *
 * Split out so the bound itself is testable: retrying forever would leave an
 * administrator watching a spinner with no error and no way to recover.
 */
export async function retryImport(importer, { retries = RETRIES, backoffMs = BACKOFF_MS } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await importer();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/** `lazy`, but the dynamic import is retried before it is allowed to fail. */
export function lazyWithRetry(importer) {
  return lazy(() => retryImport(importer));
}

/**
 * Catches a page chunk that never arrived and offers a way out.
 *
 * Scoped to the routed area so the sidebar and header stay usable — the
 * administrator can navigate elsewhere without reloading at all.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Kept in the console: "the page just went blank" is the report this
    // produces, and the stack is what makes it diagnosable.
    console.error('[route] failed to load a page chunk', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        className="mx-auto mt-10 max-w-md rounded-2xl border border-k-border bg-surface p-6 text-center"
      >
        <p className="text-lg font-semibold text-text-primary">This page didn&apos;t load</p>
        <p className="mt-2 text-sm text-text-secondary">
          The connection dropped while it was loading. Nothing was lost — reload to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg bg-turmeric px-5 py-2.5 text-sm font-semibold text-malt"
        >
          Reload
        </button>
      </div>
    );
  }
}

export default lazyWithRetry;
