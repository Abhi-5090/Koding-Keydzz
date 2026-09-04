import { loader } from '@monaco-editor/react'

/**
 * Where the Monaco editor's own code is loaded from.
 *
 * THE PROBLEM THIS FIXES
 * ----------------------
 * `@monaco-editor/react` does NOT bundle the editor. Left unconfigured its
 * loader fetches ~3 MB from `cdn.jsdelivr.net/npm/monaco-editor@…/min/vs` at
 * runtime — a third-party request on first use, every deployment.
 *
 * On a school network that filters public CDNs that means:
 *   - the Playground has no editor,
 *   - Maze Coding (50 levels) and Robot Navigation (16 levels) cannot be
 *     played at all,
 * and the only symptom is a console line reading "Monaco initialization:
 * error: Event". It surfaced here as an intermittent browser-test failure,
 * which is the same fault with a better error report.
 *
 * There was a second, quieter problem: the loader's pinned default was
 * `monaco-editor@0.55.1` while this app depends on `0.53.0`, so the editor
 * running in the browser was never the version the app was built against.
 *
 * SELF-HOSTING (recommended for schools)
 * --------------------------------------
 *   npm run fetch:monaco     # copies node_modules/monaco-editor/min/vs
 *                            # into public/monaco/vs
 *
 * That is all — `/monaco/vs` is the default below, so a build with the
 * directory present is self-hosted with no configuration. Set
 * `VITE_MONACO_URL` to override (e.g. back to a CDN, or to a shared asset
 * host). The bundled nginx config serves /monaco/ with a long cache.
 *
 * This mirrors how Pyodide is handled — see features/playground/runners.js.
 */

/** The version this app is built against. Kept in step with package.json. */
export const MONACO_VERSION = '0.55.1';

/** Resolve the `vs` base path. Never ends with a slash (Monaco appends one). */
export function monacoBase() {
  const configured = import.meta.env?.VITE_MONACO_URL;
  if (configured && String(configured).trim()) {
    const url = String(configured).trim();
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
  // Self-hosted by default: a school deployment should not depend on a CDN
  // being reachable for its two programming games to work.
  return '/monaco/vs';
}

let configured = false;

/**
 * Point the loader at `monacoBase()`. Idempotent, and MUST run before the
 * first <Editor> mounts — `loader.config` is ignored once loading has begun.
 */
export function configureMonaco() {
  if (configured) return;
  configured = true;
  loader.config({ paths: { vs: monacoBase() } });
}

export default configureMonaco;
