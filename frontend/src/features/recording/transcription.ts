/**
 * Asking for a transcription, and hearing how it is going (`UI-15`, `UI-25`, `API-11`, `API-17`).
 *
 * Three things, in one module because they are one feature from a person's side: where the audio
 * would be sent, what is happening to it now, and the request that starts it.
 *
 * **The destination is fetched by everybody, not only administrators** (`API-12`). That endpoint
 * exists because of the disclosure: `GET /admin/transcription` is administrator-only, so on a
 * shared instance the people whose recordings are being sent somewhere were precisely the ones
 * who could not find out. It is cached for the session -- an instance's provider does not change
 * while somebody is looking at a recording, and re-asking per view would be a request per screen
 * for an answer that has not moved.
 *
 * **A 409 is a state and not an error** (`API-11`). The call to action and the retry are the same
 * endpoint, so a double click reaches a recording that is already being transcribed; the API says
 * so with a conflict, and the honest thing to render is "it is running", which is what the
 * invalidation produces on its own.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { get, post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { useLiveArchive } from '@/app/live-archive';
import { keys } from '@/api/keys';
import { HANDLED_CONFLICT } from '@/api/query-client';
import type { components } from '@/api/contract/schema';
import type { TranscriptionState } from '@/design-system';

const RUNNING_STATUS_POLL_MS = 10_000;
/** Short enough to notice a transcription finishing, long enough not to poll a provider's queue.

    Only reached when there is no stream: the instance announces the same fact the moment it is
    true, and this is what the interface falls back to when it cannot be told. */

export type TranscriptionDestination = components['schemas']['TranscriptionDestination'];
export type TranscriptionStatus = components['schemas']['TranscriptionStatus'];
export type Job = components['schemas']['JobSummary'];

/**
 * Where audio goes to be transcribed.
 *
 * Read by any authenticated caller, deliberately: a disclosure only administrators can read is
 * not a disclosure.
 */
export function useDestination(): UseQueryResult<TranscriptionDestination> {
  return useQuery({
    queryKey: keys.transcriptionDestination(),
    queryFn: () => get('/api/transcription/destination'),
    // The provider is an instance fact. It changes when an administrator changes it, which is
    // not while somebody is reading a transcript.
    staleTime: 5 * 60_000,
  });
}

/**
 * What is happening to this recording's transcription.
 *
 * Only asked for when there is something to say: a recording with a transcript is `done`, and the
 * three facts this carries -- how long it has been running, which attempt, what went wrong -- are
 * about the states that do not have one.
 *
 * **It takes the state the screen is drawing, and its job is to disagree with it** (`FBK-2`). The
 * four states are rendered from `transcription_state` on the recording, which is a different query
 * and one nothing was refetching -- so the poll below used to run to completion and tell nobody,
 * and a transcription that finished left the card saying "transcribing" until a reload. When the
 * two disagree this one is the newer of them, and saying so through `invalidate` reaches the
 * recording, its transcript, its versions and every list that draws a badge for it.
 *
 * Comparing the two rather than watching for a transition is deliberate: arriving at a recording
 * whose card was stale means the first answer is already `done`, with no transition to catch.
 */
export function useTranscriptionStatus(
  uuid: string,
  showing: TranscriptionState,
): UseQueryResult<TranscriptionStatus> {
  const client = useQueryClient();
  const live = useLiveArchive();
  // A recording with a transcript has nothing left to report, and the endpoint is not asked.
  const enabled = showing !== 'done' && uuid !== '';
  const query = useQuery({
    queryKey: keys.transcription(uuid),
    queryFn: () => get('/api/audio/{audio_uuid}/transcription', { path: { audio_uuid: uuid } }),
    enabled,
    // A transcription that is running finishes while somebody watches. The stream says so the
    // moment it happens (`REV-12`); this is what notices when there is no stream to say it.
    refetchInterval: (one) =>
      !live && one.state.data?.state === 'running' ? RUNNING_STATUS_POLL_MS : false,
  });

  const reported = query.data?.state;
  useEffect(() => {
    if (!enabled || reported === undefined || reported === showing) return;
    void invalidate(client, { kind: 'transcription', recording: uuid });
    // Once, and not in a loop: the refetch this starts makes `showing` agree with `reported`,
    // and if it cannot -- an instance that has gone away -- nothing here has changed to re-run on.
  }, [client, enabled, reported, showing, uuid]);

  return query;
}

/**
 * The same reconciliation from the other side: the recording is what noticed (`FBK-2`).
 *
 * The status endpoint is asked every ten seconds and the recording every thirty, so either of
 * them can be the one that learns a job finished. When it is the recording,
 * `transcription_state` flips to `done` and that flip disables the query above -- so the effect
 * there cannot be the only place the two are reconciled.
 *
 * The transition is the trigger rather than a comparison against a constant, and that is what
 * makes it fire once: the invalidation refetches the recording, which answers the same thing,
 * and there is no second change left to react to.
 */
export function useTranscriptionSettled(uuid: string, state: string | undefined): void {
  const client = useQueryClient();
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    // The first render has nothing to compare against, and a recording still loading has no
    // state to have changed.
    if (before === undefined || state === undefined || before === state) return;
    void invalidate(client, { kind: 'transcription', recording: uuid });
  }, [client, state, uuid]);
}

export type Transcribe = UseMutationResult<Job, unknown, void>;

/** Ask for one. `UI-25` says nothing calls this without having said where the audio goes. */
export function useTranscribe(uuid: string): Transcribe {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      post('/api/audio/{audio_uuid}/transcribe', { path: { audio_uuid: uuid }, body: {} }),
    onSuccess: async () => {
      await invalidate(client, { kind: 'transcription', recording: uuid });
    },
    onError: async () => {
      // A 409 means somebody -- possibly this person, twice -- already asked. Re-reading is what
      // turns that into the running state rather than into an error nobody can act on.
      await invalidate(client, { kind: 'transcription', recording: uuid });
    },
  });
}

/**
 * Change your mind about one (`API-21`, `UI-15d`).
 *
 * The same shape as the request it undoes, and for the same reason: cancelling is a decision
 * somebody makes on a screen, not an error, so a 409 -- the transcription finished between the
 * card being drawn and the button being pressed -- is re-read rather than reported. What comes
 * back is either `done` with a transcript or `none` with the call to action, and both of those
 * are answers to what the person was asking. That one status, and not the rest: an instance that
 * cannot be reached is still a failure this button owes somebody a sentence about.
 *
 * Nothing is resumed afterwards. `cancelled` reads as `none`, so the card returns to offering a
 * transcription rather than to a half-finished one, which is what the archive actually holds.
 */
export function useCancelTranscription(uuid: string): Transcribe {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      post('/api/audio/{audio_uuid}/transcribe/cancel', { path: { audio_uuid: uuid } }),
    meta: HANDLED_CONFLICT,
    onSettled: async () => {
      await invalidate(client, { kind: 'transcription', recording: uuid });
    },
  });
}
