/**
 * The signal that a session ended (`UI-4a`, `UI-3c`).
 *
 * A session can end while somebody is reading: it expires, or `V10` revokes it from another
 * device. The next request answers 401, the query client turns that into one event rather than
 * thirty branches, and this is where the event is held until a component inside the router can
 * act on it.
 *
 * It is a hook rather than a callback inside the query client because the client is built before
 * the router's hooks exist. `report` is stable for the life of the application, which matters:
 * the client captures it once, and a callback that changed identity would be captured stale.
 */

import { useCallback, useState } from 'react';

export interface Expiry {
  /** Called by the query client when a request is refused for want of a session. */
  report: () => void;
  ended: boolean;
  acknowledge: () => void;
}

export function useSessionExpiry(): Expiry {
  const [ended, setEnded] = useState(false);
  const report = useCallback(() => {
    setEnded(true);
  }, []);
  const acknowledge = useCallback(() => {
    setEnded(false);
  }, []);
  return { report, ended, acknowledge };
}
