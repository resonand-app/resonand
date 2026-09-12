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

/** The file's extension with its dot, lowercased, or "" when the name carries none. */
function suffix(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 1 ? '' : name.slice(dot).toLowerCase();
}

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
  const ext = suffix(name);
  return ext !== '' && instance.accepted_extensions.includes(ext);
}

/** Whether this file is one of the video containers, which are kept whole and played as audio. */
export function isVideo(name: string, instance: InstanceState | undefined): boolean {
  if (instance === undefined) return false;
  return instance.video_extensions.includes(suffix(name));
}

/**
 * The extension as a label: "M4A", "MP4", or "" for a name without one.
 *
 * The dialog draws a file as a glyph and this line, because a name clipped to fit a tile loses
 * its end -- which is exactly the part that says what the file is.
 */
export function extension(name: string): string {
  return suffix(name).slice(1).toUpperCase();
}
