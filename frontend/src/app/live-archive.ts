/**
 * Whether the instance is currently telling this client what changed (`REV-12`).
 *
 * Apart from the provider that fills it, on the pattern `session-expiry.ts` sets: the state and
 * the hook here, the component in `events.tsx`, so that neither file exports both a component and
 * something that is not one.
 *
 * Read by the queries that would otherwise poll. It is `false` outside the provider -- which is
 * what a test mounting one view in isolation gets, and the honest answer there, because nothing
 * is listening.
 */

import { createContext, useContext } from 'react';

export const LiveContext = createContext(false);

export function useLiveArchive(): boolean {
  return useContext(LiveContext);
}
