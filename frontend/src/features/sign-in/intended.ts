import { routes } from '@/app/routes';

/**
 * Where signing in leads.
 *
 * The guard stores the defended location in the router's state. It is read defensively because
 * router state is whatever the last navigation put there -- including a hand-typed `/sign-in`,
 * where there is none -- and because an absolute path is the only kind worth honouring: a
 * `from` carrying a full URL would be an open redirect written by whoever last linked here.
 */
export function intended(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== 'string') return routes.libraries;
  if (!from.startsWith('/') || from.startsWith('//')) return routes.libraries;
  return from === routes.signIn ? routes.libraries : from;
}
