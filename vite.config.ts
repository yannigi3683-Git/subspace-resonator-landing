/// <reference types="vitest" />
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel rewrites /radio -> /radio.html in production (vercel.json);
// this mirrors that routing for dev and preview servers.
const radioRewrite = (): Plugin => {
  const rewrite = (req: { url?: string }) => {
    if (req.url === '/radio' || req.url === '/radio/') req.url = '/radio.html';
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
  },
});
