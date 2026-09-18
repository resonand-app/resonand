/**
 * What the detail view knows about the recording it is showing (`UI-11a`, §V5).
 *
 * Three questions, answered from two requests and a cache hit:
 *
 * **The recording itself**, from `GET /audio/{uuid}`, which carries the technical metadata the
 * panel keeps collapsed as well as everything the header shows.
 *
 * **Where it came from.** `AudioDetail` carries `library_uuid` and not the library's name, so the
 * breadcrumb resolves it against `GET /libraries` -- the list the sidebar has already fetched
 * under the same key, so a recording opened from a library costs no request to name it. A library
 * that is not in the list is a recording in a library this account cannot read, which cannot
 * happen: the recording would have answered 404 first.
 *
 * **What may be changed here.** `level` on the recording rather than on the library, because they
 * can differ: a recording shared individually carries its own grant, and the library's level is
 * the wrong answer for it (`is_shared_individually`).
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { useLiveArchive } from '@/app/live-archive';
import { keys } from '@/api/keys';
import { intervalForOne } from '@/api/settling';
import type { components } from '@/api/contract/schema';
import { LEVEL } from '@/features/library/data';
import { useCategories } from '@/features/library/recordings';

import { useTranscriptionSettled } from './transcription';

export type RecordingDetail = components['schemas']['AudioDetail'];
export type LibrarySummary = components['schemas']['LibrarySummary'];

export interface RecordingContext {
  recording: RecordingDetail | undefined;
  /** The library it lives in, for the breadcrumb and for the name the player shows. */
  library: LibrarySummary | undefined;
  /** The category it is filed under, resolved from that library's flat list. */
  categoryName: string | undefined;
  /** The categories of the library it is in, for the picker in the panel. */
  categories: ReturnType<typeof useCategories>;
  /** Level 20 or above: the title, the notes, the category, the tags, and every action but one. */
  canEdit: boolean;
  /**
   * Level 30 or above **on the library**, which is what sharing needs.
   *
   * Access to a recording is granted on the library it is in (`UI-17`); sharing one recording on
   * its own is not in v0. So the control that leads there is offered at the level that screen
   * requires rather than at the level this one does -- offering it at 20 would be offering a
   * screen the API refuses.
   */
  canShare: boolean;
  /** Level 10 exactly. The screen says so once and drops what it cannot offer (§3.5). */
  isReadOnly: boolean;
  /** In the trash: playable and restorable, never editable (`UI-11d`). */
  isTrashed: boolean;
  /**
   * Level 20 or above, whether or not it is in the trash.
   *
   * `canEdit` is false for a trashed recording because nothing about it may be changed while it
   * is in there -- but putting it back is exactly what somebody at level 20 is allowed to do, and
   * being in the trash is not a permission (`REV-7`). So restoring asks the level rather than
   * `canEdit`.
   */
  canRestore: boolean;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

export function useRecording(uuid: string): RecordingContext {
  const live = useLiveArchive();
  const recording = useQuery({
    queryKey: keys.recording(uuid),
    queryFn: () => get('/api/audio/{audio_uuid}', { path: { audio_uuid: uuid } }),
    enabled: uuid !== '',
    // A recording opened the moment it was uploaded fills in its duration, its technical details
    // and its waveform without a reload (`FBK-3`).
    // Off while the instance is telling us what changed (`REV-12`); the interval is the
    // fallback for a stream that could not be held, not the ordinary path.
    refetchInterval: (one) => (live ? false : intervalForOne(one.state.data)),
  });
  const libraries = useQuery({
    queryKey: keys.libraries(),
    queryFn: () => get('/api/libraries'),
  });
  const libraryUuid = recording.data?.library_uuid ?? '';
  const categories = useCategories(libraryUuid);
  // Whichever poll answers first learns that a transcription finished, and this one updates no
  // key but its own -- the transcript, the versions and the card behind this screen are others
  // (`FBK-2`).
  useTranscriptionSettled(uuid, recording.data?.transcription_state);

  const level = recording.data?.level ?? LEVEL.read;
  const trashed = recording.data?.deleted_at !== null && recording.data !== undefined;
  const library = (libraries.data ?? []).find((one) => one.uuid === libraryUuid);

  return {
    recording: recording.data,
    library,
    categoryName: categories.nameOf(recording.data?.category_id ?? null),
    categories,
    // A recording in the trash is not editable at any level: it can be played and put back, and
    // that is the whole of what the trashed band offers (§V5).
    canEdit: level >= LEVEL.edit && !trashed,
    canShare: (library?.level ?? LEVEL.read) >= LEVEL.manage && !trashed,
    canRestore: level >= LEVEL.edit,
    isReadOnly: recording.data !== undefined && level < LEVEL.edit,
    isTrashed: trashed,
    isPending: recording.isPending,
    error: recording.error,
    refetch: () => {
      void recording.refetch();
    },
  };
}
