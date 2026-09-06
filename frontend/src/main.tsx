/**
 * The entry point (`INF-3a`).
 *
 * It mounts and does nothing else. The router is `UI-4a`, the query client is `UI-3c`, the theme
 * provider is `UI-1j` and the design system's stylesheet arrives with `UI-1c` -- each of them a
 * task with a criterion of its own, and none of them worth guessing at here.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html is missing #root, so there is nothing to mount into.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
