/**
 * One playback state, and a seek into the last minute of a three-hour file (`UI-5a`, `UI-5b`).
 *
 * The store is tested directly because it is the thing two surfaces share: if the bar and the
 * detail view can disagree, they will, and the place that becomes visible is a waveform drifting
 * a frame behind another one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { audio, connect, reset, streamUrl } from '../audio';
import { RATES, playedFraction, usePlayback } from '../store';

const CARRER_NOU = {
  uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
  title: 'The house on Carrer Nou',
  library: 'Àvia Teresa',
  durationMs: 2_892_000,
  hasWaveform: true,
};

const THREE_HOURS = { ...CARRER_NOU, uuid: 'long', durationMs: 3 * 3_600_000 };

beforeEach(() => {
  usePlayback.getState().stop();
  reset();
});

describe('one state, two presentations', () => {
  it('starts buffering rather than playing, because a file has not loaded yet', () => {
    usePlayback.getState().play(CARRER_NOU);
    expect(usePlayback.getState().status).toBe('buffering');
    expect(usePlayback.getState().positionMs).toBe(0);
  });

  it('is the same position wherever it is read from', () => {
    // The bar and the detail view both read this. There is no second copy to drift.
    usePlayback.getState().play(CARRER_NOU);
    usePlayback.getState().report({ status: 'playing', durationMs: 2_892_000 });
    usePlayback.getState().seek(1_084_000);
    expect(usePlayback.getState().positionMs).toBe(1_084_000);
    expect(playedFraction(usePlayback.getState())).toBeCloseTo(0.375, 2);
  });

  it('resumes rather than restarting when the same recording is played again', () => {
    const { play, report, pause } = usePlayback.getState();
    play(CARRER_NOU);
    report({ status: 'playing', durationMs: 2_892_000, positionMs: 600_000 });
    pause();
    play(CARRER_NOU);
    expect(usePlayback.getState().status).toBe('playing');
    expect(usePlayback.getState().positionMs).toBe(600_000);
  });

  it('re-anchors the clock on every way back into playing', () => {
    /* The surfaces carry the position forward from `positionAt`, so a resume that left the old
       moment in place told every drawing to add the length of the pause to the position. A
       five-second pause in a thirteen-second recording put the playhead forty percent past the
       sound -- and because a drawing ahead of its report holds rather than flinching, it stayed
       there. The anchor is the fix; both halves are tested because both were wrong. */
    for (const resume of [
      () => {
        usePlayback.getState().resume();
      },
      () => {
        usePlayback.getState().toggle();
      },
      () => {
        usePlayback.getState().play(CARRER_NOU);
      },
      () => {
        usePlayback.getState().report({ status: 'playing' });
      },
    ]) {
      usePlayback.getState().play(CARRER_NOU);
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      usePlayback.getState().report({ status: 'playing', durationMs: 13_333, positionMs: 5000 });
      usePlayback.getState().pause();
      vi.spyOn(performance, 'now').mockReturnValue(6000);
      resume();
      expect(usePlayback.getState().status).toBe('playing');
      // The position it resumed at, paired with the moment it resumed -- not the moment five
      // seconds earlier when the sound was last heard.
      expect(usePlayback.getState().positionMs).toBe(5000);
      expect(usePlayback.getState().positionAt).toBe(6000);
      vi.restoreAllMocks();
      usePlayback.getState().stop();
    }
  });

  it('starts from the beginning when a different recording is played', () => {
    const { play, report } = usePlayback.getState();
    play(CARRER_NOU);
    report({ positionMs: 600_000 });
    play(THREE_HOURS);
    expect(usePlayback.getState().positionMs).toBe(0);
    expect(usePlayback.getState().recording?.uuid).toBe('long');
  });

  it('goes absent rather than empty when it is stopped', () => {
    // §3.1: nothing playing is no player at all, and the shell reflows.
    usePlayback.getState().play(CARRER_NOU);
    usePlayback.getState().stop();
    expect(usePlayback.getState().recording).toBeNull();
    expect(usePlayback.getState().status).toBe('idle');
  });
});

describe('moving through a recording', () => {
  it('seeks into the last minute of a three-hour file', () => {
    // The case Range exists for: the browser fetches that minute, not the three hours before it.
    const { play, report, seek } = usePlayback.getState();
    play(THREE_HOURS);
    report({ status: 'playing', durationMs: THREE_HOURS.durationMs });
    seek(THREE_HOURS.durationMs - 30_000);
    expect(usePlayback.getState().positionMs).toBe(THREE_HOURS.durationMs - 30_000);
    expect(usePlayback.getState().seekingToMs).toBe(THREE_HOURS.durationMs - 30_000);
  });

  it('answers the pending seek when the element reports arriving', () => {
    // Otherwise every later report is second-guessed against a position nobody asked for any more.
    const { play, report, seek } = usePlayback.getState();
    play(CARRER_NOU);
    report({ durationMs: 2_892_000 });
    seek(60_000);
    report({ positionMs: 60_000 });
    expect(usePlayback.getState().seekingToMs).toBeNull();
  });

  it('does not run off either end', () => {
    const { play, report, nudge, seek } = usePlayback.getState();
    play(CARRER_NOU);
    report({ status: 'playing', durationMs: 2_892_000, positionMs: 2_000 });
    nudge(-15);
    expect(usePlayback.getState().positionMs).toBe(0);
    seek(9_999_999);
    expect(usePlayback.getState().positionMs).toBe(2_892_000);
  });

  it('moves by the amounts §1.8 names', () => {
    const { play, report, nudge } = usePlayback.getState();
    play(CARRER_NOU);
    report({ status: 'playing', durationMs: 2_892_000, positionMs: 100_000 });
    nudge(-5);
    expect(usePlayback.getState().positionMs).toBe(95_000);
    nudge(15);
    expect(usePlayback.getState().positionMs).toBe(110_000);
  });

  it('keeps the speed between 0.75x and 2x, whatever it is asked for', () => {
    const { setRate } = usePlayback.getState();
    setRate(3);
    expect(usePlayback.getState().rate).toBe(2);
    setRate(0.1);
    expect(usePlayback.getState().rate).toBe(0.75);
    expect(RATES[0]).toBe(0.75);
    expect(RATES.at(-1)).toBe(2);
  });
});

describe('where the sound comes from', () => {
  it('is a relative, same-origin URL, so the session cookie carries it', () => {
    // <audio> cannot send a header. The cookie is the authorisation, and a token is the fallback.
    expect(streamUrl(CARRER_NOU.uuid)).toBe(`/api/audio/${CARRER_NOU.uuid}/stream`);
    expect(streamUrl(CARRER_NOU.uuid)).not.toContain('token');
  });

  it('carries a token only when it is given one', () => {
    // A token in a URL lands in browser history, so it is minted after a failure and not before.
    expect(streamUrl('u', 'abc')).toBe('/api/audio/u/stream?token=abc');
  });
});

describe('the element', () => {
  let stop: () => void;

  beforeEach(() => {
    stop = connect();
  });

  afterEach(() => {
    stop();
  });

  it('loads what the store says is playing, and nothing before that', () => {
    expect(audio().getAttribute('src')).toBeNull();
    usePlayback.getState().play(CARRER_NOU);
    expect(audio().src).toContain(`/api/audio/${CARRER_NOU.uuid}/stream`);
  });

  it('follows the speed', () => {
    usePlayback.getState().play(CARRER_NOU);
    usePlayback.getState().setRate(1.5);
    expect(audio().playbackRate).toBe(1.5);
  });

  it('lets go of the file when playback stops', () => {
    usePlayback.getState().play(CARRER_NOU);
    usePlayback.getState().stop();
    expect(audio().getAttribute('src')).toBeNull();
  });

  it('silences it on the way out rather than only dropping the source', () => {
    // Closing the player is asked for while something is audible, and detaching a source the
    // element is still playing leaves the sound running until the buffer empties.
    const paused = vi.spyOn(audio(), 'pause');
    usePlayback.getState().play(CARRER_NOU);
    usePlayback.getState().report({ status: 'playing' });
    usePlayback.getState().stop();
    expect(paused).toHaveBeenCalled();
  });

  it('does not start a recording over because something landed while it sat at its end', () => {
    /* Ending is `paused` at the end (§3.1), and the `ended` report that says so arrives a task
       after the element has already paused itself. Anything landing in that gap -- the position
       read at the end, a rate, a seek answering -- finds `playing` and a paused element, and
       playing a finished element starts it from zero. Seeking to the very end did exactly that:
       it wrapped round to the beginning and played on. */
    const played = vi.spyOn(audio(), 'play');
    vi.spyOn(audio(), 'ended', 'get').mockReturnValue(true);
    usePlayback.getState().play(CARRER_NOU);
    played.mockClear();
    // The element reporting where it is, while the store still believes it is playing.
    usePlayback.getState().report({ status: 'playing' });
    usePlayback.getState().report({ positionMs: CARRER_NOU.durationMs });
    expect(played).not.toHaveBeenCalled();
  });

  it('says it failed rather than looking like it is playing silence', () => {
    // jsdom cannot decode audio, so `play()` rejects -- which is exactly the case being tested.
    vi.spyOn(audio(), 'play').mockRejectedValue(new Error('no decoder here'));
    usePlayback.getState().play(CARRER_NOU);
    return vi.waitFor(() => {
      expect(usePlayback.getState().status).toBe('failed');
    });
  });
});
