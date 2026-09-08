/**
 * The application root: the providers, and §2.1's eight routes (`UI-4a`).
 *
 * Three providers, in an order that is a decision rather than an accident. The router is
 * outermost, because leaving for the sign-in screen when a session ends is a routing act.
 * The query client is inside it, so the component that answers the end of a session can
 * navigate. Everything else is inside both.
 *
 * The specimen page keeps its hash route (`UI-1k`). It is development only -- `import.meta.env.DEV`
 * is a literal `false` in a build, so the branch, the page and its sample data are all dropped --
 * and it is deliberately outside the router: it is a page about components, not a view of an
 * archive, and it must render without a session or an instance to talk to.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';

import { createQueryClient } from '@/api/query-client';
import { LibrariesView } from '@/features/libraries/LibrariesView';
import { LibraryView } from '@/features/library/LibraryView';

import { AppShell } from './AppShell';
import { NotBuiltYet } from './NotBuiltYet';
import { NotFound } from './NotFound';
import { RequireSession } from './RequireSession';
import { SessionExpiry } from './SessionExpiry';
import { routes } from './routes';
import { useSessionExpiry } from './session-expiry';

const Specimens = import.meta.env.DEV ? lazy(() => import('@/dev/Specimens')) : null;

export function App() {
  if (Specimens !== null && window.location.hash.startsWith('#/specimens')) {
    return (
      <Suspense fallback={null}>
        <Specimens />
      </Suspense>
    );
  }
  return (
    <BrowserRouter>
      <Archive />
    </BrowserRouter>
  );
}

/** Everything that needs a router around it, which is everything that talks to the API. */
function Archive() {
  const expiry = useSessionExpiry();
  const [client] = useState(() => createQueryClient(expiry.report));

  return (
    <QueryClientProvider client={client}>
      <SessionExpiry expiry={expiry} />
      <Routes>
        <Route path={routes.signIn} element={<NotBuiltYet view="V1 - Sign in" />} />
        <Route element={<RequireSession />}>
          {/* Everything with a session is drawn inside the frame, and the frame is outside the
              routes on purpose: the nav, the sidebar and the player must not remount when the
              view changes, which is what makes the player persistent (`UI-5a`). */}
          <Route element={<Framed />}>
            <Route path={routes.libraries} element={<LibrariesView />} />
            <Route path={routes.library} element={<LibraryView />} />
            <Route
              path={routes.librarySettings}
              element={<NotBuiltYet view="V7 - Library settings" />}
            />
            <Route path={routes.recording} element={<NotBuiltYet view="V5 - Audio detail" />} />
            <Route path={routes.search} element={<NotBuiltYet view="V6 - Search" />} />
            <Route path={routes.trash} element={<NotBuiltYet view="V9 - Trash" />} />
            <Route path={routes.settings} element={<NotBuiltYet view="V10 - Settings" />} />
          </Route>
        </Route>
        {/* A trailing slash is the same place, not a different one. */}
        <Route path="/index.html" element={<Navigate to={routes.libraries} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </QueryClientProvider>
  );
}

/** The shell, with whichever view the route resolved to inside it. */
function Framed() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
