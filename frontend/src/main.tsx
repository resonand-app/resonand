/**
 * The entry point (`INF-3a`).
 *
 * It mounts, links the design system's stylesheet, provides the theme and puts the interface in
 * a language (`UI-22a`). The router is `UI-4a` and the query client's provider goes in with it,
 * because what the interface does when a session ends is a routing decision.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

// First, and from the entry point rather than from the barrel (`UI-1c`). The tokens have to be
// defined before anything that reads them renders, and a CSS import buried inside a component
// module fires in whatever order the bundler happened to choose.
import '@/design-system/styles.css';

import { ThemeProvider } from '@/design-system';

import { App } from '@/app/App';
import { createI18n } from '@/i18n';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html is missing #root, so there is nothing to mount into.');
}

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={createI18n()}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
);
