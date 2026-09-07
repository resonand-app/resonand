/**
 * §3.1's six states, and the reason there is only one player (`UI-5c`, `UI-5d`, `UI-5e`, `UI-5f`).
 *
 * The state table is the work here, not the happy path: five of the six are what somebody meets
 * when something is slow, missing or broken, and each of them has a shape the specification names.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaSession } from './MediaSession';
import { PhonePlayer } from './PhonePlayer';
import { Player } from './Player';
import { usePlayback } from './store';

const CARRER_NOU = {
  uuid: 'carrer-nou',
  title: 'The house on Carrer Nou',
  library: 'Àvia Teresa',
  durationMs: 2_892_000,
  hasWaveform: true,
};

beforeEach(() => {
  usePlayback.getState().stop();
  usePlayback.getState().setRate(1);
});

/** Put the player into the ordinary state: playing, 18:04 into a 48:12 recording. */
function playing(): void {
  usePlayback.getState().play(CARRER_NOU);
  usePlayback
    .getState()
    .report({ status: 'playing', durationMs: 2_892_000, positionMs: 1_084_000 });
}

describe('nothing playing', () => {
  it('is no player at all, so the shell reflows', () => {
    const { container } = render(<Player />);
    // Absent, not empty: a 64px bar with nothing in it is a control somebody keeps looking at to
    // work out what it is for.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('playing', () => {
  it('says what is playing, where it came from, and how far through', () => {
    playing();
    render(<Player />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    expect(screen.getByText(/Àvia Teresa/)).toBeInTheDocument();
    expect(screen.getByText('18:04')).toBeInTheDocument();
    expect(screen.getByText('48:12')).toBeInTheDocument();
  });

  it('shows the speed with its decimal, so the control does not change width', () => {
    playing();
    usePlayback.getState().setRate(1.5);
    render(<Player />);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });
});

describe('buffering', () => {
  it('keeps the transport and holds the position rather than showing a spinner', () => {
    usePlayback.getState().play(CARRER_NOU);
    render(<Player />);
    // The transport is present -- three controls, not a spinner -- and the position holds at the
    // start rather than jumping about while the file loads.
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('says it is busy, for anybody not looking at it', () => {
    usePlayback.getState().play(CARRER_NOU);
    const { container } = render(<Player />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('the recording on screen', () => {
  it('drops the bar waveform, and says which one moves', () => {
    // Two waveforms at two scales drifting a frame apart is what makes people think there are
    // two players (§3.1).
    playing();
    render(<Player onScreen={CARRER_NOU.uuid} peaks={[-40, 40, -60, 60]} />);
    expect(screen.getByText(/the waveform above is the one that moves/i)).toBeInTheDocument();
  });

  it('keeps its waveform when something else is playing', () => {
    playing();
    const { container } = render(
      <Player onScreen="another-recording" peaks={[-40, 40, -60, 60]} />,
    );
    expect(container.querySelector('svg, canvas')).not.toBeNull();
  });
});

describe('a recording with no peaks yet', () => {
  it('shows a position and a duration and invents no shape', () => {
    usePlayback.getState().play({ ...CARRER_NOU, hasWaveform: false });
    usePlayback.getState().report({ status: 'playing', durationMs: 2_892_000 });
    render(<Player peaks={[-40, 40]} />);
    expect(screen.getByText(/no waveform yet/i)).toBeInTheDocument();
  });
});

describe('a recording still being processed', () => {
  it('plays the original and says so quietly', () => {
    usePlayback.getState().play({ ...CARRER_NOU, fromOriginal: true });
    usePlayback.getState().report({ status: 'playing' });
    render(<Player />);
    expect(screen.getByText(/playing the original/i)).toBeInTheDocument();
  });
});

describe('a file that will not play', () => {
  it('states the fact and does not vanish', () => {
    playing();
    usePlayback.getState().report({ status: 'failed' });
    render(<Player />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    expect(screen.getByText(/will not play/i)).toBeInTheDocument();
  });

  it('offers to try again from where it stopped', async () => {
    playing();
    usePlayback.getState().report({ status: 'failed' });
    render(<Player />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(usePlayback.getState().status).not.toBe('failed');
  });
});

describe('the system controls', () => {
  it('gives the lock screen the title, the library and the mark', () => {
    const session = { metadata: null, playbackState: 'none', setActionHandler: vi.fn() };
    // Assigned rather than spread: `navigator` is a class instance, and a copy of it loses its
    // prototype along with every property the interface reads off it.
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaSession: session }));
    vi.stubGlobal(
      'MediaMetadata',
      function MediaMetadataStub(this: { data: unknown }, data: unknown) {
        this.data = data;
      },
    );
    playing();
    render(<MediaSession />);
    const metadata = session.metadata as unknown as { data: Record<string, unknown> } | null;
    expect(metadata?.data.title).toBe('The house on Carrer Nou');
    expect(metadata?.data.artist).toBe('Àvia Teresa');
    // There is no other image in the product, and fetching one would break principle 2.
    expect(JSON.stringify(metadata?.data.artwork)).toContain('data:image/svg+xml');
    vi.unstubAllGlobals();
  });
});

describe('on a phone', () => {
  it('is a strip with a progress line rather than a waveform', () => {
    playing();
    const { container } = render(<PhonePlayer peaks={[-40, 40]} />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    // A 3px-bar waveform is not usable at that size with a thumb (§2.3).
    expect(container.querySelector('svg[data-ds="waveform"]')).toBeNull();
  });

  it('expands on a tap and collapses again', async () => {
    playing();
    render(<PhonePlayer peaks={[-40, 40, -60, 60]} />);
    await userEvent.click(screen.getByText('The house on Carrer Nou'));
    expect(screen.getByRole('button', { name: /back 15 seconds/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /stop playing/i }));
    expect(usePlayback.getState().recording).toBeNull();
  });
});

describe('the transport', () => {
  it('skips by fifteen, the same as ⇧← and ⇧→', () => {
    // The buttons were drawn and not wired: two controls that did nothing, which is worse than
    // not having them.
    playing();
    render(<Player />);
    return userEvent.click(screen.getByRole('button', { name: /back 15 seconds/i })).then(() => {
      expect(usePlayback.getState().positionMs).toBe(1_069_000);
    });
  });
});
