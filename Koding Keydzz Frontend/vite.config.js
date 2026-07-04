/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
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
