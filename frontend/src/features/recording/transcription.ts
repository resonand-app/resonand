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

import { get, post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import type { components } from '@/api/schema';

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
 */
export function useTranscriptionStatus(
  uuid: string,
  enabled: boolean,
): UseQueryResult<TranscriptionStatus> {
  return useQuery({
    queryKey: keys.transcription(uuid),
    queryFn: () => get('/api/audio/{audio_uuid}/transcription', { path: { audio_uuid: uuid } }),
    enabled: enabled && uuid !== '',
    // A transcription that is running finishes while somebody watches, and there is no push. The
    // window is short enough to notice and long enough not to poll a provider's queue.
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 10_000 : false),
  });
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
