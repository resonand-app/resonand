/**
 * Vite (`INF-3a`).
 *
 * The interface is a single-page application because the player has to survive every navigation
 * (`DEC-20`), and the build is one hashed bundle the API serves as a static shell. Nothing here
 * knows about the backend's origin at build time: the same bundle is served from a subdomain or,
 * later, from a subpath (`OPS-4`), so every request the client makes is same-origin and relative.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Where the API is, in development and everywhere else (`API-16`, `DEC-24`).
 *
 * One prefix rather than the list of top-level names this used to hold. The API is mounted
 * under `/api` and the interface owns everything else, so the dev server needs to know one
 * thing about the backend instead of keeping a copy of its route table in step with it.
 *
 * Proxying rather than pointing the client at `http://127.0.0.1:8000` is what keeps the session
 * cookie same-origin in development, exactly as it is in the image -- where there is no proxy
 * at all, because both halves come out of the same container (`INF-3e`).
 */
const API_PREFIX = '/api';

const BACKEND = 'http://127.0.0.1:8000';

/**
 * Where this build's Corresponding Source is (`UI-38`).
 *
 * `AGPL-3.0` section 13 is the clause this licence was chosen over `GPL` for: somebody who only
 * ever interacts with an instance over the network is owed its source. So the interface has to
 * offer a link, and the link has to be to *this* build -- a fork that ships its own instance owes
 * its own source and not ours.
 *
 * Read from `package.json` rather than written here, because `repository` is where a fork already
 * changes it and where npm, GitHub and every tool that reads a manifest look for it. Baked at
 * build time rather than served from the API: it is a fact about the bundle, and an instance whose
 * API is unreachable still owes the offer.
 */
const { repository } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { repository: { url: string } };

export default defineConfig({
  plugins: [react()],

  // Relative, so nothing in the bundle names the prefix it will be served under. The served
  // shell carries a `<base href>` the API writes from `RESONAND_BASE_PATH` (`OPS-4`), which is
  // what stops a relative URL resolving against `/library/<uuid>` instead of the deployment
  // root. One image serves both arrangements; neither is a build input.
  base: './',

  define: { __SOURCE_URL__: JSON.stringify(repository.url) },

  resolve: {
    // Matching `paths` in tsconfig.app.json. Two descriptions of the same mapping is one too
    // many, but Vite and tsc each need their own and neither reads the other's -- so they are
    // written next to each other and changed together.
    //
    // The array form rather than the object form, because these two overlap and order decides
    // it: `@/design-system` is a prefix of `@/`, and the object form's iteration order is not
    // something to rest a build on. `tsc` needs no such care -- it takes the longest matching
    // `paths` key whatever order they are written in.
    alias: [
      {
        // `design-system/` sits beside `src/` rather than inside it (`DEC-21`): it is the
        // application's component source and it is also a folder a designer opens on its own,
        // with seventeen specimen cards that link its stylesheet with no bundler in the way.
        find: /^@\/design-system(?=$|\/)/,
        replacement: fileURLToPath(new URL('./design-system', import.meta.url)),
      },
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
    ],
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
    proxy: { [API_PREFIX]: { target: BACKEND, changeOrigin: true } },
  },
});
