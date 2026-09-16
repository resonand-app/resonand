/**
 * One playback state (`UI-5a`, §3.1).
 *
 * **One state, two presentations.** The bar at the bottom of the shell and the 130px player in
 * the detail view are the same sound, and the design has to make that unmistakable -- so there is
 * one position, one duration, one rate, and both surfaces read them. Two waveforms at two scales
 * drifting a frame apart is what makes people believe there are two players.
 *
 * It is a store rather than context because it outlives every route: the shell is outside the
 * routes (`UI-4c`) and the audio element is outside React entirely (`UI-5b`), so what is left to
 * share is a value neither of them owns.
 *
 * The store holds **what is true**, not what to do about it. `positionMs` is what the audio
 * element last reported, not what somebody asked for; `status` is what it is doing, not what it
 * was told to do. That distinction is what stops the position bouncing backwards for one frame
 * after a seek, which is the single most noticeable bug a player can have.
 */

import { create } from 'zustand';

/** §3.1's six states, as one value. */
export type PlaybackStatus =
  /** Nothing playing. The player is absent, not empty, and the shell reflows. */
  | 'idle'
  /** Asked for, not yet playing. The transport is present and disabled; the position holds. */
  | 'buffering'
  | 'playing'
  | 'paused'
  /** The file will not play. The bar states the fact and does not vanish. */
  | 'failed';

/** What is playing, as much of it as the player needs to say so. */
export interface Playing {
  uuid: string;
  title: string;
  /** The library it came from, shown under the title and given to the lock screen as the artist. */
  library: string;
  /** From the API, so the duration is known before any audio has loaded. */
  durationMs: number | null;
  /** Whether peaks exist. No peaks means no waveform -- never an invented shape. */
  hasWaveform: boolean;
  /**
   * Playing the original because the Opus derivative does not exist yet.
   *
   * Said quietly (§3.1), not as a warning: it is a recording that arrived a minute ago, which is
   * an ordinary thing for an archive to be doing.
   */
  fromOriginal?: boolean;
}

/** What the speed control offers. §1.4's range, and the values people actually use. */
export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export interface PlaybackState {
  recording: Playing | null;
  status: PlaybackStatus;
  positionMs: number;
  /** What the audio element reports, which can differ from the API's by a few milliseconds. */
  durationMs: number;
  /**
   * When `positionMs` was true, on the same clock as `requestAnimationFrame`.
   *
   * A position without a moment is a position that is already out of date by however long the
   * report took to arrive -- and a drawing that carries it forward from the wrong moment steps
   * backwards each time it is told where it is.
   */
  positionAt: number;
  rate: number;
  /** What a seek asked for, until the element reports arriving. Cleared by the next report. */
  seekingToMs: number | null;

  /** Start something, or restart what is already there. */
  play: (recording: Playing) => void;
  /** Play or pause whatever is loaded. Nothing loaded is nothing to do. */
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  /** Ask for a position. The element answers, and `report` is where the answer arrives. */
  seek: (ms: number) => void;
  /** Move by seconds, clamped to the recording. `±5` and `±15` (§1.8). */
  nudge: (seconds: number) => void;
  setRate: (rate: number) => void;
  /** Stop and forget. The player goes absent and the shell reflows. */
  stop: () => void;
  /**
   * Correct the title of what is playing, when that recording has been renamed.
   *
   * `recording` is a copy taken when playback began, and it has to be one: the player outlives
   * every route, so it cannot read a query belonging to a view somebody has navigated away from.
   * The cost of the copy is that it does not hear about a rename, and this is where a rename
   * tells it. Ignored unless the renamed recording is the one playing -- renaming something else
   * is not about the player.
   */
  retitle: (uuid: string, title: string) => void;

  /** What the audio element says is true. Nothing else writes these. */
  report: (update: Partial<Pick<PlaybackState, 'status' | 'positionMs' | 'durationMs'>>) => void;
}

const EMPTY = {
  recording: null,
  status: 'idle',
  positionMs: 0,
  durationMs: 0,
  positionAt: 0,
  seekingToMs: null,
} as const;

/**
 * Playing again, from now.
 *
 * The moment matters as much as the status. `positionMs` is an anchor and the surfaces carry it
 * forward from `positionAt`, so resuming without re-stamping the moment tells every drawing to
 * add the length of the pause to the position -- a five-second pause in a thirteen-second
 * recording put the playhead forty percent past the sound, and it stayed there.
 */
function resumed(): Pick<PlaybackState, 'status' | 'positionAt'> {
  return { status: 'playing', positionAt: performance.now() };
}

/** Whether a report is the element starting to play, which is the other way back into motion. */
function starting(state: PlaybackState, update: Partial<PlaybackState>): boolean {
  return update.status === 'playing' && state.status !== 'playing';
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  ...EMPTY,
  rate: 1,

  play: (recording) => {
    const current = get();
    if (current.recording?.uuid === recording.uuid && current.status === 'paused') {
      set(resumed());
      return;
    }
    // Buffering rather than playing: the transport appears disabled and the position holds at
    // zero until the element says it is going, which is the truth for a three-hour file.
    set({ ...EMPTY, recording, status: 'buffering', positionAt: performance.now() });
  },

  toggle: () => {
    const { status } = get();
    if (status === 'playing') set({ status: 'paused' });
    else if (status === 'paused' || status === 'failed') set(resumed());
  },

  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },

  resume: () => {
    if (get().status === 'paused') set(resumed());
  },

  seek: (ms) => {
    const { durationMs, recording } = get();
    const end = durationMs || (recording?.durationMs ?? 0);
    const target = Math.min(Math.max(0, ms), end || ms);
    // The asked-for position is shown immediately and the reported one takes over when it
    // arrives. A player that waited would move the handle back under the pointer.
    set({ seekingToMs: target, positionMs: target, positionAt: performance.now() });
  },

  nudge: (seconds) => {
    get().seek(get().positionMs + seconds * 1000);
  },

  setRate: (rate) => {
    set({ rate: Math.min(2, Math.max(0.75, rate)) });
  },

  stop: () => {
    set({ ...EMPTY });
  },

  retitle: (uuid, title) => {
    const { recording } = get();
    if (recording === null) return;
    if (recording.uuid !== uuid || recording.title === title) return;
    set({ recording: { ...recording, title } });
  },

  report: (update) => {
    set((state) => ({
      ...update,
      // Stamped here, where the element was just read, rather than wherever this lands: a
      // position is only as good as the moment it belongs to. A report that says it is playing
      // without saying where re-stamps it too, for the reason `resumed` exists.
      positionAt:
        update.positionMs === undefined && !starting(state, update)
          ? state.positionAt
          : performance.now(),
      // A report of the position is the element arriving where it was sent, so the pending seek
      // is answered rather than kept -- otherwise every later report would be second-guessed.
      seekingToMs: update.positionMs === undefined ? state.seekingToMs : null,
    }));
  },
}));

/**
 * Whether there is a bar on screen at all.
 *
 * The player is absent rather than empty (`UI-5`), so this is not "is the frame given a player" --
 * the frame is always given one and the bar decides for itself whether it has anything to draw.
 * Everything that measures from the bottom of the screen -- the toasts, the upload tray -- asks
 * this rather than keeping its own copy of the rule. The bars themselves keep their own guard,
 * because theirs also narrows `recording` for the compiler and a call does not.
 */
export function playerShowing(state: PlaybackState): boolean {
  return state.recording !== null && state.status !== 'idle';
}

/** Whether this recording is the one playing, which is what the detail view asks. */
export function isPlaying(state: PlaybackState, uuid: string): boolean {
  return state.recording?.uuid === uuid && state.status === 'playing';
}

/**
 * How much of a recording a second of playback covers, or 0 when it is not playing.
 *
 * What lets a drawing carry the position forward between reports instead of waiting to be told.
 * The speed is in it, so a waveform never has to know that playback rates exist.
 */
export function advanceRate(state: PlaybackState): number {
  if (state.status !== 'playing') return 0;
  const end = state.durationMs || (state.recording?.durationMs ?? 0);
  return end > 0 ? (state.rate * 1000) / end : 0;
}

/** How far through, 0-1, for a waveform or a progress line. Zero when nothing is loaded. */
export function playedFraction(state: PlaybackState): number {
  const end = state.durationMs || (state.recording?.durationMs ?? 0);
  if (!end) return 0;
  return Math.min(1, Math.max(0, state.positionMs / end));
}
