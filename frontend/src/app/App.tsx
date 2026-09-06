/**
 * The application root (`INF-3a`).
 *
 * Still one line of text -- `INF-1`'s criterion for the frontend was that it "starts up empty,
 * with its own hello", and this is that hello, kept until `UI-4a` puts the router here and
 * `UI-4c` puts the shell inside it. It is styled with nothing, because a colour written here
 * would be the first value in the repository that is not a token.
 *
 * The one branch is the specimen route (`UI-1k`), which exists because `UI-1`'s criterion --
 * every component renders in the app in both themes -- is otherwise an assertion nobody can
 * check. It is reached at `#/specimens` and is **development only**: `import.meta.env.DEV` is a
 * literal `false` in a build, so the branch and the dynamic import inside it are dropped and the
 * production bundle contains neither the page nor its sample data. A real route replaces the hash
 * check at `UI-4a`, which is also when this file stops being a hello.
 */

import { lazy, Suspense } from 'react';

const Specimens = import.meta.env.DEV ? lazy(() => import('@/dev/Specimens')) : null;

export function App() {
  if (Specimens !== null && window.location.hash.startsWith('#/specimens')) {
    return (
      <Suspense fallback={null}>
        <Specimens />
      </Suspense>
    );
  }
  return <main>Sonarium</main>;
}
