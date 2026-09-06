/**
 * Vite (`INF-3a`).
 *
 * The interface is a single-page application because the player has to survive every navigation
 * (`DEC-20`), and the build is one hashed bundle the API serves as a static shell. Nothing here
 * knows about the backend's origin at build time: the same bundle is served from a subdomain or,
 * later, from a subpath (`OPS-4`), so every request the client makes is same-origin and relative.
 */

import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The API's own top-level paths.
 *
 * The API is mounted at the root rather than under `/api`, so in development the SPA and the
 * backend share one namespace and the dev server has to be told which half of it is not the
 * SPA. Proxying rather than pointing the client at `http://127.0.0.1:8000` is what keeps the
 * session cookie same-origin in development, exactly as it is in the image.
 *
 * In the image there is no proxy and no list: the SPA is a fallback route registered after every
 * router, so a path that is an endpoint is an endpoint (`INF-3e`).
 */
const API_PATHS = [
  '/admin',
  '/audio',
  '/auth',
  '/docs',
  '/healthz',
  '/instance',
  '/libraries',
  '/openapi.json',
  '/readyz',
  '/search',
  '/tags',
  '/transcription',
  '/trash',
  '/users',
];

const BACKEND = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // The one alias, matching `paths` in tsconfig.app.json. Two descriptions of the same
      // mapping is one too many, but Vite and tsc each need their own and neither reads the
      // other's -- so they are written next to each other and changed together.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    // `frontend/dist/` is what .gitignore already expects and what the image copies to
    // /app/static (`INF-3e`).
    outDir: 'dist',
    // A stale bundle served next to a fresh index.html is the failure this prevents.
    emptyOutDir: true,
    sourcemap: true,
  },

  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PATHS.map((path) => [path, { target: BACKEND, changeOrigin: true }]),
    ),
  },
});
