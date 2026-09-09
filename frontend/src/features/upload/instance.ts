/**
 * Which files this instance ingests (`UI-18a`, §V-E).
 *
 * The formats and the size limit are **stated before a file is chosen**, and they are facts about
 * the deployment rather than about the product: an operator can raise `max_upload_bytes` and the
 * dialog has to say the new number without anybody rebuilding the bundle. They come from
 * `GET /instance` through `useInstance` in the session module, which is where every view reads the
 * instance's facts -- there is no second query here, and no constant to go stale.
 */

import type { components } from '@/api/schema';

export type InstanceState = components['schemas']['InstanceState'];

/**
 * Whether this instance ingests a file with this name.
 *
 * Extension only, and lowercase, which is what `is_accepted` compares on the other side. The
 * interface checks it so somebody is told which file and what is accepted before thirty of them
 * are sent -- the backend refuses it either way, and this is not a second rule but the same one
 * read from the same list.
 */
export function isAccepted(name: string, instance: InstanceState | undefined): boolean {
  if (instance === undefined) return true;
  const dot = name.lastIndexOf('.');
  if (dot < 1) return false;
  return instance.accepted_extensions.includes(name.slice(dot).toLowerCase());
}

/** Whether this file is one of the video containers, which are kept whole and played as audio. */
export function isVideo(name: string, instance: InstanceState | undefined): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 1 || instance === undefined) return false;
  return instance.video_extensions.includes(name.slice(dot).toLowerCase());
}
