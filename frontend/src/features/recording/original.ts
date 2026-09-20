/**
 * Where a recording's original file is (`UI-13e`).
 *
 * Its own module because it is a URL rather than a component, and the file it was in exports
 * components -- which is what fast refresh needs to be able to replace a view without remounting
 * the tree it sits in.
 *
 * Same origin, relative, and the session cookie is the authorisation, like every other request
 * (`UI-3b`). Not through `client.ts`: that wrapper's contract is a checked call resolving to a
 * typed body, and this is a link the browser follows to save a file. It still takes that
 * module's deployment prefix, which is a fact about where the API is and not about how it is
 * called (`OPS-4`).
 */
import { DEPLOYMENT_BASE } from '@/api/client';

export function originalUrl(uuid: string): string {
  return `${DEPLOYMENT_BASE}/api/audio/${encodeURIComponent(uuid)}/original`;
}
