/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    host: true,
  },
  preview: {
    port: 5176,
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors (charts are the big one) into separate chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Charts (recharts/d3) are the heavy bundle; isolate them.
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory'))
            return 'charts';
          if (id.includes('framer-motion')) return 'framer';
          // xlsx (bulk-upload parsing) is the largest dependency and only used
          // inside the bulk-upload modal — isolate it so it isn't in the main
          // vendor bundle. This is what pushed vendor past the 500 kB warning.
          if (id.includes('xlsx')) return 'xlsx';
          // Everything else (react / react-dom / router / redux / lucide) stays
          // in one vendor chunk — they share React internals, so keeping them
          // together avoids cross-chunk cycles.
          return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
