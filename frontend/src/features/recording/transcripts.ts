/**
 * A recording's transcripts, and which of them is shown (`UI-11a`, `UI-14a`, §V5).
 *
 * Two requests that answer different questions and must not be collapsed into one. `GET
 * /audio/{uuid}/transcript` is the active transcript **with its segments**, which is the thing
 * the screen is for and the only response on this view that can run to a few hundred rows. `GET
 * /audio/{uuid}/transcripts` is the list of versions without segments, which the essentials line
 * needs to say which version is active and `UI-14a` needs to offer the others.
 *
 * **A recording with no transcript answers 404, and that is a state rather than an error.** It is
 * how the interface knows to draw `UI-15`'s call to action, so the query does not retry it and
 * the view reads `hasNone` instead of an error.
 *
 * **Versions are numbered from the oldest.** The API sends them newest first, because that is the
 * order a selector lists them in; `v1` is still the first one that was made, and a number that
 * changed meaning every time somebody re-transcribed would be a number nobody could quote.
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { isApiProblem } from '@/api/problem';
import type { components } from '@/api/schema';

export type TranscriptDetail = components['schemas']['TranscriptDetail'];
export type TranscriptSummary = components['schemas']['TranscriptSummary'];
export type Segment = components['schemas']['SegmentOut'];

export interface Transcripts {
  /** The active transcript with its segments, or undefined while it loads or when there is none. */
  active: TranscriptDetail | undefined;
  /** Every version, newest first, as the API sends them. */
  versions: TranscriptSummary[];
  /** Which version the active one is, counting from the oldest. `undefined` when there is none. */
  activeVersion: number | undefined;
  /** No transcript at all: the state `UI-15a` draws, not a failure to load one. */
  hasNone: boolean;
  isPending: boolean;
  /** A real failure to fetch a transcript that exists. A 404 is not one of these. */
  error: unknown;
  refetch: () => void;
}

export function useTranscripts(uuid: string, enabled = true): Transcripts {
  const active = useQuery({
    queryKey: keys.transcript(uuid),
    queryFn: () => get('/api/audio/{audio_uuid}/transcript', { path: { audio_uuid: uuid } }),
    enabled: enabled && uuid !== '',
    retry: false,
  });
  const versions = useQuery({
    queryKey: keys.transcripts(uuid),
    queryFn: () => get('/api/audio/{audio_uuid}/transcripts', { path: { audio_uuid: uuid } }),
    enabled: enabled && uuid !== '',
  });

  const list = versions.data ?? [];
  const missing = isApiProblem(active.error) && active.error.isMissing;
  const position = list.findIndex((one) => one.is_active);

  return {
    active: active.data,
    versions: list,
    activeVersion: position === -1 ? undefined : list.length - position,
    hasNone: missing,
    isPending: active.isPending && !missing,
    error: missing ? null : active.error,
    refetch: () => {
      void active.refetch();
      void versions.refetch();
    },
  };
}

/** Which segment covers a position, or the last one before it. `-1` when there are none. */
export function segmentAt(segments: readonly Segment[], positionMs: number): number {
  if (segments.length === 0) return -1;
  // A linear scan over a few hundred segments, four times a second, is cheaper than keeping a
  // sorted index in sync with a list that only changes when the whole transcript does.
  let found = -1;
  for (const [index, segment] of segments.entries()) {
    if (segment.start_ms > positionMs) break;
    found = index;
  }
  // Before the first segment starts there is no active line rather than the first one: a
  // recording with two minutes of room noise has not reached its transcript yet.
  return found;
}
