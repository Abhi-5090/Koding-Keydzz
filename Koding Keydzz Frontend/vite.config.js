/// <reference types="vitest" />
import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Fail the build if it is configured to serve Pyodide from this app's own
 * origin but the runtime has not been downloaded.
 *
 * Without this the build succeeds and Python lessons break at runtime with
 * "couldn't load the Python engine" — the exact silent production failure that
 * self-hosting was meant to remove. A loud build failure is much cheaper than
 * a classroom discovering it.
 *
 * Run `npm run fetch:pyodide` to populate public/pyodide.
 */
function assertPyodidePresent() {
  const url = process.env.VITE_PYODIDE_URL
  // Only relevant for a LOCAL path; an absolute URL points at a CDN.
  if (!url || /^https?:\/\//i.test(url)) return

  const rel = url.replace(/^\/+/, '').replace(/\/+$/, '')
  const probe = `public/${rel}/pyodide.asm.wasm`
  if (!existsSync(probe)) {
    throw new Error(
      `VITE_PYODIDE_URL is set to "${url}" but ${probe} is missing.\n` +
        '  The Python runtime has not been downloaded, so every Python lesson\n' +
        '  would fail at runtime.\n\n' +
        '  Fix:  npm run fetch:pyodide\n' +
        '  Or:   unset VITE_PYODIDE_URL to load Pyodide from the public CDN\n' +
        '        (not recommended for schools — CDNs are often blocked).\n'
    )
  }
}

/**
 * Fail the build if Monaco is expected from this origin but has not been copied.
 *
 * This one is NOT optional the way Pyodide's is, because the app now defaults
 * to `/monaco/vs` rather than a CDN. `@monaco-editor/react` ships only a
 * loader — the ~3 MB editor is fetched at runtime — so a build without these
 * files leaves the Playground and both programming games (66 levels) with a
 * blank panel and one console line for a diagnosis.
 *
 * Run `npm run fetch:monaco` (it copies from node_modules; nothing is
 * downloaded).
 */
function assertMonacoPresent() {
  const url = process.env.VITE_MONACO_URL
  // An absolute URL means someone deliberately chose a CDN or an asset host.
  if (url && /^https?:\/\//i.test(url)) return

  const rel = (url || '/monaco/vs').replace(/^\/+/, '').replace(/\/+$/, '')
  const probe = `public/${rel}/loader.js`
  if (!existsSync(probe)) {
    throw new Error(
      `Monaco is served from this origin ("${url || '/monaco/vs'}") but ${probe} is missing.\n` +
        '  The code editor would fail to load, so the Playground, Maze Coding\n' +
        '  and Robot Navigation would all be unusable.\n\n' +
        '  Fix:  npm run fetch:monaco\n' +
        '  Or:   set VITE_MONACO_URL to a reachable CDN base\n' +
        '        (not recommended for schools — CDNs are often blocked).\n'
    )
  }
}

// https://vitejs.dev/config/
assertPyodidePresent()
assertMonacoPresent()

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
  server: {
    port: 5175,
    open: true,
  },
  preview: {
    port: 5175,
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into separate cacheable chunks so no single
        // bundle trips the 500 kB warning and the browser can parallel-load.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Isolate only the heavy, self-contained libs. React/Redux/Router
          // stay together in the default vendor chunk to avoid cross-chunk
          // circular references.
          if (id.includes('framer-motion')) return 'framer'
          if (id.includes('gsap')) return 'gsap'
          if (id.includes('monaco')) return 'monaco'
          if (id.includes('socket.io') || id.includes('engine.io')) return 'socket'
          return 'vendor'
        },
      },
    },
  },
})
