/**
 * §3.1's six states, and the reason there is only one player (`UI-5c`, `UI-5d`, `UI-5e`, `UI-5f`).
 *
 * The state table is the work here, not the happy path: five of the six are what somebody meets
 * when something is slow, missing or broken, and each of them has a shape the specification names.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { mockApi } from '@/test/api/server';

import { MediaSession } from './MediaSession';
import { PhonePlayer } from './PhonePlayer';
import { Player } from './Player';
import { usePlayback } from './store';

mockApi();

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

/**
 * The player as the shell mounts it: a query client for the shape of what is playing, and a
 * router, because the bar is a way into the recording as well as a way to control it.
 */
function show(element: React.ReactElement) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={element} />
          <Route path={routes.recording} element={<p>the recording view</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The waveform the bar draws, or null where the slot is collapsed. */
function shape(container: HTMLElement): Element | null {
  return container.querySelector('[data-ds="waveform"]');
}

/** Put the player into the ordinary state: playing, 18:04 into a 48:12 recording. */
function playing(): void {
  usePlayback.getState().play(CARRER_NOU);
  usePlayback
    .getState()
    .report({ status: 'playing', durationMs: 2_892_000, positionMs: 1_084_000 });
}

describe('nothing playing', () => {
  it('is no player at all, so the shell reflows', () => {
    const { container } = show(<Player />);
    // Absent, not empty: a 64px bar with nothing in it is a control somebody keeps looking at to
    // work out what it is for.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('playing', () => {
  it('says what is playing, where it came from, and how far through', () => {
    playing();
    show(<Player />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    expect(screen.getByText(/Àvia Teresa/)).toBeInTheDocument();
    expect(screen.getByText('18:04')).toBeInTheDocument();
    expect(screen.getByText('48:12')).toBeInTheDocument();
  });

  it('shows the speed with its decimal, so the control does not change width', () => {
    playing();
    usePlayback.getState().setRate(1.5);
    show(<Player />);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  it('changes the speed when the speed is pressed, and stays where it is', async () => {
    playing();
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: 'Playback speed' }));
    expect(usePlayback.getState().rate).toBe(1.25);
    // It was drawn as a bare `<span>`, so the one thing pressing it did was fall through to the
    // bar's own "open what is playing" -- asking for 1.25x took you off the page instead.
    expect(screen.queryByText('the recording view')).toBeNull();
  });

  it('comes back round to 1.0x rather than stopping at the fastest', async () => {
    playing();
    usePlayback.getState().setRate(2);
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: 'Playback speed' }));
    expect(usePlayback.getState().rate).toBe(0.75);
  });
});

describe('buffering', () => {
  it('keeps the transport and holds the position rather than showing a spinner', () => {
    usePlayback.getState().play(CARRER_NOU);
    show(<Player />);
    // The transport is present -- three controls, not a spinner -- and the position holds at the
    // start rather than jumping about while the file loads.
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('says it is busy, for anybody not looking at it', () => {
    usePlayback.getState().play(CARRER_NOU);
    const { container } = show(<Player />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('the recording on screen', () => {
  it('drops the bar waveform, and says which one moves', () => {
    // Two waveforms at two scales drifting a frame apart is what makes people think there are
    // two players (§3.1).
    playing();
    const { container } = show(<Player onScreen={CARRER_NOU.uuid} />);
    expect(screen.getByText(/the waveform above is the one that moves/i)).toBeInTheDocument();
    // The slot collapses to the position and the total: a drawing with no peaks in it stretches
    // one bar the width of the bar and reads as a flat line.
    expect(shape(container)).toBeNull();
  });

  it('keeps its waveform when something else is playing', async () => {
    playing();
    const { container } = show(<Player onScreen="another-recording" />);
    await waitFor(() => {
      expect(shape(container)).not.toBeNull();
    });
    // Bars, and more than the one a collapsed reduction would leave.
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(5);
  });
});

describe('a recording with no peaks yet', () => {
  it('shows a position and a duration and invents no shape', () => {
    usePlayback.getState().play({ ...CARRER_NOU, hasWaveform: false });
    usePlayback.getState().report({ status: 'playing', durationMs: 2_892_000 });
    const { container } = show(<Player />);
    expect(screen.getByText(/no waveform yet/i)).toBeInTheDocument();
    expect(shape(container)).toBeNull();
    expect(screen.getByText('48:12')).toBeInTheDocument();
  });
});

describe('a recording still being processed', () => {
  it('plays the original and says so quietly', () => {
    usePlayback.getState().play({ ...CARRER_NOU, fromOriginal: true });
    usePlayback.getState().report({ status: 'playing' });
    show(<Player />);
    expect(screen.getByText(/playing the original/i)).toBeInTheDocument();
  });
});

describe('a file that will not play', () => {
  it('states the fact and does not vanish', () => {
    playing();
    usePlayback.getState().report({ status: 'failed' });
    show(<Player />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    expect(screen.getByText(/will not play/i)).toBeInTheDocument();
  });

  it('offers to try again from where it stopped', async () => {
    playing();
    usePlayback.getState().report({ status: 'failed' });
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: /^play$/i }));
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
    const { container } = show(<PhonePlayer />);
    expect(screen.getByText('The house on Carrer Nou')).toBeInTheDocument();
    // A 3px-bar waveform is not usable at that size with a thumb (§2.3).
    expect(container.querySelector('svg[data-ds="waveform"]')).toBeNull();
  });

  it('expands on a tap and collapses again', async () => {
    playing();
    show(<PhonePlayer />);
    await userEvent.click(screen.getByText('The house on Carrer Nou'));
    expect(screen.getByRole('button', { name: /back 15 seconds/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /stop playing/i }));
    expect(usePlayback.getState().recording).toBeNull();
  });
});

describe('opening what is playing', () => {
  it('is a link on the title, so it can be reached and opened like one', () => {
    playing();
    show(<Player />);
    expect(screen.getByRole('link', { name: CARRER_NOU.title })).toHaveAttribute(
      'href',
      toRecording(CARRER_NOU.uuid),
    );
  });

  it('opens the recording from anywhere on the bar', async () => {
    playing();
    show(<Player />);
    await userEvent.click(screen.getByText(/Àvia Teresa/));
    expect(screen.getByText('the recording view')).toBeInTheDocument();
  });

  it('leaves the transport alone, which is what the bar is mostly made of', async () => {
    playing();
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: /pause/i }));
    // Pressing pause is not asking to go somewhere, and a bar that navigated under every control
    // would take somebody off the page they were reading.
    expect(screen.queryByText('the recording view')).toBeNull();
    expect(usePlayback.getState().status).toBe('paused');
  });
});

describe('closing it', () => {
  it('stops the sound and takes the bar with it', async () => {
    playing();
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: /stop playing/i }));
    // Nothing loaded is what makes the element let go of the file: `audio.ts` reads this and
    // detaches the source, so a bar that is gone cannot still be playing.
    expect(usePlayback.getState().recording).toBeNull();
    expect(usePlayback.getState().status).toBe('idle');
  });

  it('can be closed while it is still loading', async () => {
    usePlayback.getState().play(CARRER_NOU);
    show(<Player />);
    await userEvent.click(screen.getByRole('button', { name: /stop playing/i }));
    expect(usePlayback.getState().recording).toBeNull();
  });
});

describe('the transport', () => {
  it('skips by fifteen, the same as ⇧← and ⇧→', () => {
    // The buttons were drawn and not wired: two controls that did nothing, which is worse than
    // not having them.
    playing();
    show(<Player />);
    return userEvent.click(screen.getByRole('button', { name: /back 15 seconds/i })).then(() => {
      expect(usePlayback.getState().positionMs).toBe(1_069_000);
    });
  });
});
