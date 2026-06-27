import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://connor-corwin.github.io/As-Built-Editor/ on GitHub
  // Pages, so production assets need that subpath. Dev stays at root.
  base: command === 'build' ? '/As-Built-Editor/' : '/',
  plugins: [react()],
  // pdfjs-dist ships an ESM worker; let Vite optimize/bundle it correctly.
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The tests share one global (fake) IndexedDB; run files sequentially so
    // their per-test table clears don't interleave.
    fileParallelism: false,
  },
}));
