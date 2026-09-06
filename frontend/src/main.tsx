/**
 * The entry point (`INF-3a`).
 *
 * It mounts, links the design system's stylesheet and provides the theme. The router is `UI-4a`
 * and the query client is `UI-3c` -- each a task with a criterion of its own, and neither worth
 * guessing at here.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// First, and from the entry point rather than from the barrel (`UI-1c`). The tokens have to be
// defined before anything that reads them renders, and a CSS import buried inside a component
// module fires in whatever order the bundler happened to choose.
import '@/design-system/styles.css';

import { ThemeProvider } from '@/design-system';

import { App } from '@/app/App';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html is missing #root, so there is nothing to mount into.');
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
