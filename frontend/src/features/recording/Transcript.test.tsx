/**
 * The synchronised transcript (`UI-12a`, `UI-12d`, §V5).
 *
 * Three properties are worth holding here, and all three are about the relationship between the
 * transcript and the one playback position: exactly one line is active, the active line is the
 * one the position is inside, and clicking a line moves the position rather than the page.
 *
 * Anything about the lines needs `measured()` first, for the reason `RecordingList`'s tests do:
 * jsdom performs no layout, so a virtualiser asked how tall its scroller is hears zero and draws
 * nothing at all -- which would make every assertion below pass against an empty transcript.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { usePlayback } from '@/player/store';
import { CARRER_NOU, NADAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

afterEach(() => {
  usePlayback.getState().stop();
  vi.restoreAllMocks();
});

const noop = () => undefined;

/** Give the scroller a viewport, because jsdom has no layout to give it one. */
function measured(height = 720) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = noop;
      unobserve = noop;
      disconnect = noop;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
}

/** The address, so a test can assert that seeking did not navigate. */
function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderRecording(uuid: string = CARRER_NOU) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toRecording(uuid)]}>
          <Where />
          <Routes>
            <Route path={routes.recording} element={<RecordingView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** Every line currently drawn, in the order they are drawn in. */
function lines(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-ds="transcript-line"]')];
}

/** The lines marked as being spoken. Scoped to lines: other controls carry `data-active` too. */
function activeLines(): HTMLElement[] {
  return lines().filter((line) => line.dataset.active === 'true');
}

describe('the lines', () => {
  it('draws the segments with the moment each one starts at', async () => {
    measured();
    renderRecording();
    expect(await screen.findByText(/My mother was born in the village/)).toBeInTheDocument();
    // 17:31, the first segment's `start_ms`, as a position a person reads rather than a length.
    expect(screen.getByText('17:31')).toBeInTheDocument();
  });

  it('is not there at all for a recording with no transcript', async () => {
    measured();
    renderRecording(NADAL);
    await screen.findByRole('heading', { name: 'Sopar de Nadal 1998' });
    expect(lines()).toHaveLength(0);
  });

  it('says how many segments there are, and what clicking one does', async () => {
    measured();
    renderRecording();
    expect(await screen.findByText('6 segments')).toBeInTheDocument();
    expect(screen.getByText('Click a line to jump there.')).toBeInTheDocument();
  });

  it('offers nothing that suggests the transcript can be edited', async () => {
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    // A pencil, a text cursor or a "suggest a correction" would promise the manual editor that
    // is a later milestone (`UI-12d`).
    expect(document.querySelector('input')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector('[contenteditable]')).toBeNull();
    for (const line of lines()) expect(line.style.cursor).toBe('pointer');
  });

  it('prefixes a line with its speaker when there is one, and shifts nothing when there is not', async () => {
    const transcript = archive.transcripts[CARRER_NOU];
    if (transcript === undefined) throw new Error('The fixture has no transcript.');
    archive.transcripts = {
      ...archive.transcripts,
      [CARRER_NOU]: {
        ...transcript,
        segments: transcript.segments.map((segment, index) =>
          index === 0 ? { ...segment, speaker: 'Teresa' } : segment,
        ),
      },
    };
    measured();
    renderRecording();
    // `speaker` is usually null in v0, so it is accommodated and not depended on: the labelled
    // line gets a name and every other line keeps its own left edge.
    expect(await screen.findByText('Teresa')).toBeInTheDocument();
    expect(screen.getByText(/I remember the stairs were always cold/)).toBeInTheDocument();
  });
});

describe('the active line', () => {
  it('is the one the position is inside, and there is exactly one', async () => {
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    // 18:04 in the fixtures is the second segment: 17:31 + 13 s + 20 s.
    usePlayback.getState().play({
      uuid: CARRER_NOU,
      title: 'The house on Carrer Nou',
      library: 'Àvia Teresa',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_066_000 });
    const active = await screen.findByText(/I remember the stairs were always cold/);
    expect(active.closest('[data-ds="transcript-line"]')).toHaveAttribute('data-active', 'true');
    expect(activeLines()).toHaveLength(1);
  });

  it('is nowhere before the first segment starts', async () => {
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    usePlayback.getState().play({
      uuid: CARRER_NOU,
      title: 'The house on Carrer Nou',
      library: 'Àvia Teresa',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 4_000 });
    // Two minutes of room noise before anybody speaks is not the first line being spoken.
    expect(activeLines()).toHaveLength(0);
  });

  it('is nowhere at all while another recording is the one playing', async () => {
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    usePlayback.getState().play({
      uuid: 'some-other-recording',
      title: 'Something else',
      library: 'Personal',
      durationMs: 60_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_066_000 });
    expect(activeLines()).toHaveLength(0);
  });
});

describe('clicking a line', () => {
  it('seeks to that moment', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await user.click(await screen.findByText(/We stayed until the year my grandfather died/));
    // The fourth segment: 17:31 + 3 × 13 s.
    expect(usePlayback.getState().positionMs).toBe(1_090_000);
    expect(usePlayback.getState().recording?.uuid).toBe(CARRER_NOU);
  });

  it('does not leave the screen', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await user.click(await screen.findByText(/After that nobody wanted to go back/));
    expect(screen.getByTestId('where').textContent).toBe(toRecording(CARRER_NOU));
  });

  it('works from the keyboard, because a seek is not a mouse gesture', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    const line = await screen.findByText(/The building is still there/);
    const control = line.closest('[data-ds="transcript-line"]');
    if (control === null) throw new Error('A line that seeks is not a control.');
    (control as HTMLElement).focus();
    await user.keyboard('{Enter}');
    // The last of the six: 17:31 + 5 × 13 s.
    expect(usePlayback.getState().positionMs).toBe(1_116_000);
  });
});

describe('following the audio', () => {
  it('offers to follow again after somebody scrolls, in a band rather than a toast', async () => {
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    const scroller = document.querySelector('[data-app="transcript-scroller"]');
    if (scroller === null) throw new Error('The transcript has no scroller.');
    expect(screen.queryByText(/stopped following the audio/)).toBeNull();
    fireEvent.scroll(scroller);
    // A band, and it stays: the person it is for is reading, and a message that has already
    // faded is a feature they never find (`UI-12b`).
    expect(await screen.findByText(/stopped following the audio/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow again' })).toBeInTheDocument();
  });

  it('puts the band away when following is taken up again', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    const scroller = document.querySelector('[data-app="transcript-scroller"]');
    if (scroller === null) throw new Error('The transcript has no scroller.');
    fireEvent.scroll(scroller);
    await user.click(await screen.findByRole('button', { name: 'Follow again' }));
    expect(screen.queryByText(/stopped following the audio/)).toBeNull();
  });

  it('takes following up again when a line is chosen, because that is where they want to be', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    const scroller = document.querySelector('[data-app="transcript-scroller"]');
    if (scroller === null) throw new Error('The transcript has no scroller.');
    fireEvent.scroll(scroller);
    await screen.findByText(/stopped following the audio/);
    await user.click(screen.getByText(/After that nobody wanted to go back/));
    expect(screen.queryByText(/stopped following the audio/)).toBeNull();
  });
});

describe('moving between segments', () => {
  /** Put the position inside a segment, which is what the arrows step from. */
  function playingAt(positionMs: number) {
    usePlayback.getState().play({
      uuid: CARRER_NOU,
      title: 'The house on Carrer Nou',
      library: 'Àvia Teresa',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs });
  }

  it('seeks to the next segment on the way down', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    playingAt(1_066_000);
    await user.keyboard('{ArrowDown}');
    // The third segment. `↓` is a seek and not a focus move: the position is the only cursor on
    // this screen (§1.8).
    expect(usePlayback.getState().positionMs).toBe(1_077_000);
  });

  it('seeks to the previous one on the way up', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    playingAt(1_066_000);
    await user.keyboard('{ArrowUp}');
    expect(usePlayback.getState().positionMs).toBe(1_051_000);
  });

  it('goes to the first segment when nothing is active yet', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    playingAt(4_000);
    await user.keyboard('{ArrowDown}');
    expect(usePlayback.getState().positionMs).toBe(1_051_000);
  });

  it('does nothing at either end rather than wrapping round', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    playingAt(1_051_000);
    await user.keyboard('{ArrowUp}');
    // A transcript that jumped from its first line to its last would be a seek nobody asked for.
    expect(usePlayback.getState().positionMs).toBe(1_051_000);
    playingAt(1_116_000);
    await user.keyboard('{ArrowDown}');
    expect(usePlayback.getState().positionMs).toBe(1_116_000);
  });

  it('leaves the arrows to the browser where there is no transcript', async () => {
    const user = userEvent.setup();
    measured();
    renderRecording(NADAL);
    await screen.findByRole('heading', { name: 'Sopar de Nadal 1998' });
    usePlayback.getState().play({
      uuid: NADAL,
      title: 'Sopar de Nadal 1998',
      library: 'Àvia Teresa',
      durationMs: 727_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 30_000 });
    await user.keyboard('{ArrowDown}');
    // Nothing claimed it, so nothing happened to the position: with no transcript on screen the
    // arrows scroll the page, which is what pressing them on a long list means.
    expect(usePlayback.getState().positionMs).toBe(30_000);
  });
});

describe('when the device asks for less movement', () => {
  /**
   * A scroller with a viewport and a length, and a record of what it was asked to do.
   *
   * jsdom performs no layout and implements no scrolling, so a follow that measures its scroller
   * finds a zero-height element with nothing to scroll and correctly declines to move it.
   */
  function scrollable(): ScrollToOptions[] {
    const asked: ScrollToOptions[] = [];
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      value: 3000,
      configurable: true,
    });
    // The lines have to have a height as well, or every one of them measures zero, the whole
    // transcript is nought pixels tall, and the follow correctly declines to scroll to the top
    // of it from the top of it.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 600, 46),
    );
    vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation((options?: unknown) => {
      if (typeof options === 'object' && options !== null) asked.push(options);
    });
    return asked;
  }

  afterEach(() => {
    // The two measurements are defined rather than mocked, so restoring the mocks does not
    // reach them and the next test would inherit a viewport it never asked for.
    for (const property of ['clientHeight', 'scrollHeight']) {
      Reflect.deleteProperty(HTMLElement.prototype, property);
    }
  });

  /** What the device says about movement. jsdom has no `matchMedia` until a test gives it one. */
  function prefers(reduced: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: noop,
      removeEventListener: noop,
    }));
  }

  it('follows the audio without animating the scroll', async () => {
    measured();
    prefers(true);
    const asked = scrollable();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    usePlayback.getState().play({
      uuid: CARRER_NOU,
      title: 'The house on Carrer Nou',
      library: 'Àvia Teresa',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_116_000 });
    // The scroll is the only thing on the screen that moves by itself, and no stylesheet can
    // reach inside a `scrollTo` -- so the view has to ask for `auto` by name (`UI-32c`).
    await waitFor(() => {
      expect(asked.at(-1)?.behavior).toBe('auto');
    });
  });

  it('animates it for everybody else', async () => {
    measured();
    prefers(false);
    const asked = scrollable();
    renderRecording();
    await screen.findByText(/My mother was born in the village/);
    usePlayback.getState().play({
      uuid: CARRER_NOU,
      title: 'The house on Carrer Nou',
      library: 'Àvia Teresa',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_116_000 });
    await waitFor(() => {
      expect(asked.at(-1)?.behavior).toBe('smooth');
    });
  });
});
