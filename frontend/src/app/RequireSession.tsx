/**
 * The session guard (`UI-4a`).
 *
 * Every route except `/sign-in` needs a session, so the guard is one component wrapped around all
 * of them rather than a check inside each. Three states and they are genuinely different:
 *
 * - **Not back yet.** Nothing is rendered. Not a spinner: the answer usually arrives in a few
 *   milliseconds from cache, and a spinner that flashes is worse than a moment of nothing.
 * - **No session.** Leave for the sign-in screen, remembering where this was, so signing in
 *   returns somebody to the recording they followed a link to rather than to the landing page.
 * - **Signed in.** Render the view.
 *
 * It does not ask what the account may do. Permission is per library and per recording, the API
 * answers 404 for anything unreadable (`DEC-14`), and a guard that tried to know better would be
 * a second copy of the ACL that is always slightly behind the real one.
 */

import { Navigate, Outlet, useLocation } from 'react-router';

import { routes } from './routes';
import { useSession } from './session';

export function RequireSession() {
  const location = useLocation();
  const { isPending, isSignedOut } = useSession();

  if (isPending) return null;
  if (isSignedOut) {
    return (
      <Navigate to={routes.signIn} state={{ from: location.pathname + location.search }} replace />
    );
  }
  return <Outlet />;
}
