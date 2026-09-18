/**
 * What a change makes stale (`UI-3c`).
 *
 * One map, in one direction: a mutation says what happened, and this says what has to be
 * refetched. The alternative is every call site listing the keys it thinks it affects, which
 * fails the same way twice -- a list nobody updates when a new view starts reading the same
 * data, and a list that invalidates the whole cache because that is easier than thinking.
 *
 * Changes are named after the event and not after the endpoint. `POST /api/audio/{uuid}/move`
 * and a drag between libraries are one change with one set of consequences; if the map were
 * keyed by endpoint they would be two, and the second would be the one that forgot the source
 * library's count.
 *
 * Keys are matched by prefix, so `['libraries', uuid]` reaches that library, its recordings, its
 * shares and its categories without any of them being named here.
 */

import type { QueryClient } from '@tanstack/react-query';

import { keys } from './keys';

export type Change =
  /** A library was created, renamed, recoloured, trashed or restored. */
  | { kind: 'library'; library?: string }
  /** A recording's own fields changed: title, note, tags, category, its time. */
  | { kind: 'recording'; recording: string; library?: string }
  /** A recording moved between libraries, which changes two counts and not one. */
  | { kind: 'recording-moved'; recording: string; from: string; to: string }
  /** A recording was trashed or restored, which changes a library and the trash. */
  | { kind: 'recording-lifecycle'; recording: string; library?: string }
  /** An upload finished, so a library has something it did not have. */
  | { kind: 'upload'; library: string }
  /** Transcription was asked for, finished, or failed. */
  | { kind: 'transcription'; recording: string }
  /** The instance said a recording changed: a job finished and something derived now exists. */
  | { kind: 'recording-settled'; recording: string }
  /** Who a library is shared with. */
  | { kind: 'share'; library: string }
  /** The signed-in account: display name, address, language. */
  | { kind: 'account' }
  /** A session was revoked, here or elsewhere. */
  | { kind: 'session' }
  /** Anything an administrator did to the queue, the provider or an account. */
  | { kind: 'administration' };

/**
 * The key prefixes a change makes stale.
 *
 * Search is in almost every list because it reads titles, notes, tags and transcripts (`DEC-13`)
 * -- a renamed recording is a different search result, and a stale one is a result that opens
 * something with another name on it.
 */
export function staleAfter(change: Change): readonly (readonly unknown[])[] {
  switch (change.kind) {
    case 'library':
      return [
        keys.libraries(),
        keys.trash(),
        keys.search(),
        ...(change.library ? [keys.library(change.library)] : []),
      ];
    case 'recording':
      return [
        keys.recording(change.recording),
        keys.search(),
        keys.allTags(),
        ...(change.library ? [keys.library(change.library)] : []),
      ];
    case 'recording-moved':
      // Both libraries: the one that lost a recording shows a count too, and the view somebody
      // is looking at is as likely to be the source as the destination.
      return [
        keys.recording(change.recording),
        keys.library(change.from),
        keys.library(change.to),
        keys.libraries(),
        keys.search(),
      ];
    case 'recording-lifecycle':
      return [
        keys.recording(change.recording),
        keys.trash(),
        keys.libraries(),
        keys.search(),
        ...(change.library ? [keys.library(change.library)] : []),
      ];
    case 'upload':
      return [keys.library(change.library), keys.libraries(), keys.search()];
    case 'transcription':
      // The four states are derived from the job, and the badge, the filter and the detail view
      // all read them -- so the recording and everything that lists it.
      return [keys.recording(change.recording), keys.search(), keys.libraries()];
    case 'recording-settled':
      // Which job finished is deliberately not in the event, so this has to cover all of them: a
      // probe changes a duration and so a library's total, a waveform changes a card, a
      // transcription changes what search can find. That union is what `transcription` already
      // asks for, and saying so here is what keeps the two from drifting apart.
      return staleAfter({ kind: 'transcription', recording: change.recording });
    case 'share':
      return [keys.libraryShares(change.library), keys.libraries()];
    case 'account':
      return [keys.me()];
    case 'session':
      return [keys.sessions()];
    case 'administration':
      return [['admin']];
  }
}

/** Tell the cache what a change made stale. Await it to let a view settle before it re-renders. */
export async function invalidate(client: QueryClient, change: Change): Promise<void> {
  await Promise.all(
    staleAfter(change).map((queryKey) => client.invalidateQueries({ queryKey: [...queryKey] })),
  );
}

/** Everything, for the two moments that genuinely mean it: signing in, and signing out. */
export async function forgetEverything(client: QueryClient): Promise<void> {
  client.clear();
  return Promise.resolve();
}
