/// <reference types="vitest" />
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel rewrites these paths in production (vercel.json); this mirrors that
// routing for dev and preview servers. /radio has its own HTML entry;
// /privacy and /accessibility are rendered from the main index.html entry
// (pathname branch in src/main.tsx).
const radioRewrite = (): Plugin => {
  const rewrite = (req: { url?: string }) => {
    if (req.url === '/radio' || req.url === '/radio/') req.url = '/radio.html';
    else if (req.url === '/privacy' || req.url === '/privacy/') req.url = '/index.html';
    else if (req.url === '/accessibility' || req.url === '/accessibility/') req.url = '/index.html';
  };
  return {
    name: 'radio-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), radioRewrite()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        radio: path.resolve(__dirname, 'radio.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // restreamer/ is a standalone Node service tested with `node --test`, not vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'restreamer/**'],
  },
});
