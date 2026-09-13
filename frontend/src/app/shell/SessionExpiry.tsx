/**
 * Leaving, when the instance says there is no session (`UI-4a`).
 *
 * Rendered inside both the router and the query client, because the two things that have to
 * happen are React work: forget everything cached, then leave for the sign-in screen.
 *
 * **Everything cached is forgotten**, not only the account. On a shared machine the next person
 * to sign in must not see the last one's library names in a stale sidebar.
 *
 * Where somebody was is remembered, so signing in returns them to the recording they followed a
 * link to rather than to the landing page.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { isPublic, routes } from '@/app/routes';
import type { Expiry } from '@/app/session-expiry';

export function SessionExpiry({ expiry }: { expiry: Expiry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();

  useEffect(() => {
    if (!expiry.ended) return;
    expiry.acknowledge();
    client.clear();
    if (isPublic(location.pathname)) return;
    void navigate(routes.signIn, {
      replace: true,
      state: { from: location.pathname + location.search },
    });
  }, [client, expiry, location.pathname, location.search, navigate]);

  return null;
}
