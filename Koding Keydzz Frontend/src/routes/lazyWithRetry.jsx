import { Component, lazy } from 'react'

/**
 * Lazy route loading that survives a dropped chunk.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every page below the login screen is a separate chunk fetched on demand.
 * That is the right trade for a school — the first paint no longer ships all
 * thirteen games — but it moves a network request to the moment a child taps a
 * link, and `React.lazy` treats a failed fetch as a render error. With no
 * boundary above it, React unmounts the tree: the child gets a WHITE SCREEN
 * with no message and no way back except knowing to reload the browser.
 *
 * That is not a hypothetical. It reproduced in the browser test suite on
 * WebKit — "TypeError: Importing a module script failed" — on whichever game
 * happened to lose a request under load, which is exactly what thirty tablets
 * on one school Wi-Fi look like.
 *
 * Two layers, because they solve different halves:
 *   1. `lazyWithRetry` retries the import before giving up. A transient blip
 *      is the common case and the child never learns anything went wrong.
 *   2. `RouteErrorBoundary` catches what is left and offers a Reload button,
 *      so the worst case is one tap rather than a dead app.
 */

const RETRIES = 2
const BACKOFF_MS = 400

/**
 * Run a dynamic import, retrying a bounded number of times.
 *
 * Split out from `lazyWithRetry` so the retry behaviour can be tested on its
 * own — the bound matters (retrying forever would leave a child staring at a
 * spinner) and that is not observable through a React component.
 *
 * @param {() => Promise<T>} importer
 * @param {{ retries?: number, backoffMs?: number }} [options]
 * @returns {Promise<T>}
 * @template T
 */
export async function retryImport(importer, { retries = RETRIES, backoffMs = BACKOFF_MS } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await importer()
    } catch (err) {
      lastError = err
      if (attempt === retries) break
      // Linear backoff. A chunk fetch that failed because the Wi-Fi stuttered
      // usually succeeds on the next try; waiting longer than a moment would
      // just feel broken.
      await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)))
    }
  }
  throw lastError
}

/**
 * `lazy`, but the dynamic import is retried before it is allowed to fail.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} importer
 */
export function lazyWithRetry(importer) {
  return lazy(() => retryImport(importer))
}

/**
 * Catches a chunk that never arrived and offers a way out.
 *
 * Deliberately NOT a general-purpose error boundary: it sits around the routed
 * area only, so the surrounding shell (nav, back link) stays usable, and the
 * copy is written for a nine-year-old rather than a developer.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // Left visible in the console on purpose: this is the one failure a
    // teacher might report as "it just went blank", and the stack is what
    // makes it diagnosable.
    console.error('[route] failed to load a page chunk', error, info?.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div
        role="alert"
        className="mx-auto mt-10 max-w-md rounded-2xl border-2 border-k-border bg-surface/60 p-6 text-center"
      >
        <p className="game-text text-lg font-bold text-text-primary">
          This page didn&apos;t load
        </p>
        <p className="game-text mt-2 text-sm text-text-secondary">
          The connection dropped while it was loading. Tap the button to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="game-text pressable mt-5 rounded-xl bg-turmeric px-5 py-2.5 text-sm font-bold text-malt"
        >
          Try again
        </button>
      </div>
    )
  }
}

export default lazyWithRetry
