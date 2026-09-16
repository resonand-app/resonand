/**
 * V3's card grid (`UI-6b`, §V3, §1.3).
 *
 * The four states have to be told apart without colour, a title has to survive being long, and
 * the date on a card is the recording's own wall-clock reading rather than the reader's evening.
 * All three are things a screenshot would not show.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { RECORDINGS, FIELD_TAKE, PERSONAL, archive } from '@/test/api/archive';
import { usePlayback } from '@/player/store';
import { mockApi, server } from '@/test/api/server';

import { LibraryView } from '../LibraryView';

mockApi();

// The player is a store and outlives a component, so a test that leaves something playing is the
// next test's stale mark.
afterEach(() => {
  usePlayback.getState().stop();
});

/** The address, so a test can assert what a control put in it (`UI-4b`). */
function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderLibrary(uuid: string = RECORDINGS) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toLibrary(uuid)]}>
          <Where />
          <Routes>
            <Route path="/library/:uuid" element={<LibraryView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** One card, found by the recording it is about. */
async function cardFor(title: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name: title });
  const card = link.closest('article');
  if (card === null) throw new Error(`The card for ${title} is not an article.`);
  return card;
}

describe('a card', () => {
  it('opens the recording from its title, by keyboard', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    expect(within(card).getByRole('link', { name: 'Field recording, long take' })).toHaveAttribute(
      'href',
      `/recording/${FIELD_TAKE}`,
    );
  });

  it('plays without leaving the grid, from a control named after the recording', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    expect(
      within(card).getByRole('button', { name: 'Play Field recording, long take' }),
    ).toBeVisible();
  });

  it('says the transcription state in words, not only in colour', async () => {
    renderLibrary();
    // Amber and red are not enough: somebody who cannot tell them apart still has to be able to
    // tell "in progress" from "failed".
    expect(within(await cardFor('Rehearsal, second take')).getByText('Transcribing')).toBeVisible();
    expect(
      within(await cardFor('Field recording, long take')).getByText('Transcribed'),
    ).toBeVisible();
  });

  it('shows the duration and the recording own date, as written', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    // 48:12, and half six on the evening of 12 March -- the clock reading where the recording
    // was made. `recorded_at` is 18:22 with a +01:00 offset, and it renders as 6:22 PM whatever
    // timezone the reader or the test runner is in (§1.3).
    expect(within(card).getByText(/48:12/)).toBeVisible();
    expect(within(card).getByText(/Mar 12, 2026, 6:22/)).toBeVisible();
  });

  it('falls back to the upload date when a recording has none of its own', async () => {
    renderLibrary();
    // A cassette digitised decades later: `recorded_at` is null, so the card shows the upload
    // instant -- which is a real date in the reader's own timezone, unlike the one above.
    const card = await cardFor('Digitised cassette');
    expect(within(card).getByText(/12:07/)).toBeVisible();
    expect(within(card).getByText(/2026/)).toBeVisible();
  });

  it('carries the tags, and turns the rest into a count', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === FIELD_TAKE
        ? {
            ...one,
            tags: [
              { id: 1, name: 'field', slug: 'field' },
              { id: 2, name: 'outdoor', slug: 'outdoor' },
              { id: 3, name: 'music', slug: 'music' },
              { id: 4, name: 'interview', slug: 'interview' },
              { id: 5, name: 'cases', slug: 'cases' },
            ],
          }
        : one,
    );
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    // Three, then a count: a card is 320px and every card in a grid has to be the same height.
    expect(within(card).getByText('field')).toBeVisible();
    expect(within(card).getByText('+2')).toBeVisible();
    expect(within(card).queryByText('cases')).toBeNull();
  });

  it('names the category the library gave the recording', async () => {
    archive.categories[RECORDINGS] = [{ id: 7, parent_id: null, name: 'Interviews', position: 0 }];
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === FIELD_TAKE ? { ...one, category_id: 7 } : one,
    );
    renderLibrary();
    expect(
      within(await cardFor('Field recording, long take')).getByText('Interviews'),
    ).toBeVisible();
  });

  it('draws no waveform for a recording whose peaks job has not run', async () => {
    renderLibrary(PERSONAL);
    // `Nota de veu` is still being processed: `has_waveform` is false, so the request that would
    // 404 is never made and the card draws a dashed rule rather than an invented shape (§3.5).
    const card = await cardFor('Short voice note');
    await waitFor(() => {
      expect(screen.getByText('Interview 02, raw')).toBeInTheDocument();
    });
    expect(card.querySelector('[data-ds="waveform"]')).toBeNull();
  });

  it('draws a waveform once the peaks have arrived', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await waitFor(() => {
      expect(card.querySelector('[data-ds="waveform"]')).not.toBeNull();
    });
  });
});

describe('playing from a card', () => {
  it('plays without leaving the grid', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('button', { name: /^Play/ }));
    // The route is unchanged and the player has the recording: the grid is still on screen, which
    // is the whole point of a play button on a card.
    expect(usePlayback.getState().recording?.uuid).toBe(FIELD_TAKE);
    expect(usePlayback.getState().recording?.library).toBe('Field recordings');
    expect(screen.getByRole('heading', { name: 'Field recordings', level: 1 })).toBeVisible();
  });

  it('marks the card that is playing, and only that one', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    const other = await cardFor('Digitised cassette');
    usePlayback.getState().play({
      uuid: FIELD_TAKE,
      title: 'Field recording, long take',
      library: 'Field recordings',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing' });
    await waitFor(() => {
      expect(card).toHaveAttribute('data-playing', 'true');
    });
    expect(other).not.toHaveAttribute('data-playing');
  });

  it('lights the card waveform without letting it follow the playback', async () => {
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await waitFor(() => {
      expect(card.querySelector('[data-ds="waveform"]')).not.toBeNull();
    });
    usePlayback.getState().play({
      uuid: FIELD_TAKE,
      title: 'Field recording, long take',
      library: 'Field recordings',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_084_000 });
    await waitFor(() => {
      expect(card).toHaveAttribute('data-playing', 'true');
    });
    // Lit: every bar in the accent, rather than the accent creeping across them.
    const bars = [...card.querySelectorAll('[data-ds="waveform"] rect')];
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every((bar) => bar.getAttribute('fill') === 'var(--wave)')).toBe(true);
    // The bar at the foot of the shell is the one that draws where a recording has got to. A
    // grid of waveforms filling in behind it says the same thing a dozen times.
    expect(card.querySelector('clipPath')).toBeNull();
  });

  it('leaves every other card dim, so the lit one is the one that is playing', async () => {
    renderLibrary();
    const other = await cardFor('Digitised cassette');
    await waitFor(() => {
      expect(other.querySelector('[data-ds="waveform"]')).not.toBeNull();
    });
    usePlayback.getState().play({
      uuid: FIELD_TAKE,
      title: 'Field recording, long take',
      library: 'Field recordings',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 1_084_000 });
    const bars = [...other.querySelectorAll('[data-ds="waveform"] rect')];
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every((bar) => bar.getAttribute('fill') === 'var(--wave-dim)')).toBe(true);
  });

  it('turns the control that started the sound into the one that stops it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('button', { name: /^Play/ }));
    usePlayback.getState().report({ status: 'playing' });
    const pause = await within(card).findByRole('button', { name: /^Pause/ });
    await user.click(pause);
    expect(usePlayback.getState().status).not.toBe('playing');
  });
});

describe('the category filter', () => {
  it('holds the tree, indented, with one selectable at a time', async () => {
    archive.categories[RECORDINGS] = [
      { id: 1, parent_id: null, name: 'Interviews', position: 0 },
      { id: 2, parent_id: 1, name: 'Álbum', position: 0 },
    ];
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: /Any category/ }));
    const group = await screen.findByRole('radiogroup', { name: 'Category' });
    // Radios and not checkboxes: a recording has at most one category.
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: /Any category/ })).toBeChecked();
  });

  it('puts the chosen category in the URL, so a filtered library can be linked to', async () => {
    archive.categories[RECORDINGS] = [{ id: 7, parent_id: null, name: 'Interviews', position: 0 }];
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: /Any category/ }));
    await user.click(await screen.findByRole('radio', { name: 'Interviews' }));
    // The control now names the filter, and the address carries it.
    expect(await screen.findByRole('button', { name: /Interviews/ })).toBeVisible();
    expect(screen.getByTestId('where').textContent).toContain('category_id=7');
  });

  it('says so when a library has no categories rather than showing an empty popover', async () => {
    archive.categories[RECORDINGS] = [];
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: /Any category/ }));
    expect(await screen.findByText(/no categories yet/)).toBeVisible();
  });
});

describe('the tag filter', () => {
  it('suggests tags from the instance and puts the chosen one in the URL', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    // The suggestions are already ACL-filtered by the backend, so anything offered is a tag this
    // account may see -- the interface does not filter them again.
    await user.click(await screen.findByRole('button', { name: /field/ }));
    expect(screen.getByTestId('where').textContent).toContain('tag=field');
  });

  it('shows what is on as a chip that can be taken off again', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    await user.click(await screen.findByRole('button', { name: /field/ }));
    const remove = await screen.findByRole('button', { name: /Stop filtering by field/ });
    await user.click(remove);
    expect(screen.getByTestId('where').textContent).not.toContain('tag=');
  });

  it('does not offer a tag that is already narrowing the list', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    await user.click(await screen.findByRole('button', { name: /field/ }));
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    const list = await screen.findByRole('list', { name: 'Tags' });
    // A suggestion for a filter already applied is a row that does nothing.
    expect(within(list).queryByRole('button', { name: /field/ })).toBeNull();
  });
});

describe('the transcription state toggles', () => {
  it('says the same four words the badges do', async () => {
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    const group = screen.getByRole('group', { name: 'Transcript state' });
    // The badge on a card and the toggle in the bar read the same vocabulary, so the filter and
    // the thing it filters cannot describe the same state differently.
    for (const word of ['Not transcribed', 'Transcribing', 'Transcribed', 'Transcription failed']) {
      expect(within(group).getByRole('button', { name: word })).toBeInTheDocument();
    }
  });

  it('are one choice, so picking a state drops the one before it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Transcribed' }));
    await user.click(screen.getByRole('button', { name: 'Transcribing' }));
    // The four are the states one recording can be in, so filtering by two of them at once is a
    // question nobody asks: the second press replaces the first rather than adding to it.
    const where = screen.getByTestId('where').textContent;
    expect(where).toContain('transcription_state=running');
    expect(where).not.toContain('transcription_state=done');
    expect(screen.getByRole('button', { name: 'Transcribing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Transcribed' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('leaves the parameter out entirely when none is on', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Transcribed' }));
    await user.click(screen.getByRole('button', { name: 'Transcribed' }));
    // None on means every state, which is why there is no "all" toggle -- and why the parameter
    // is absent rather than empty: `?transcription_state=` asks for the empty string.
    expect(screen.getByTestId('where').textContent).not.toContain('transcription_state');
  });
});

describe('the sort and the density', () => {
  it('puts a changed sort in the URL and leaves the default out of it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    // Recorded, newest first, is the API's own default: an unfiltered library has a clean address.
    expect(screen.getByTestId('where').textContent).not.toContain('sort=');
    await user.click(screen.getByRole('button', { name: 'Sort oldest and shortest first' }));
    expect(screen.getByTestId('where').textContent).toContain('direction=asc');
  });

  it('switches to the dense list, and says so in the address', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByTestId('where').textContent).toContain('view=list');
    expect(await screen.findByRole('table', { name: 'Recordings' })).toBeInTheDocument();
  });
});

describe('the filter bar on a phone', () => {
  /** Below `--breakpoint-phone`, where the desktop row is replaced rather than narrowed. */
  function width(pixels: number) {
    Object.defineProperty(window, 'innerWidth', {
      value: pixels,
      writable: true,
      configurable: true,
    });
  }

  const narrow = () => {
    width(375);
  };

  // jsdom's own width, restored so a test added after these does not inherit a phone.
  afterEach(() => {
    width(1024);
  });

  it('collapses the whole bar into one button', async () => {
    narrow();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    // Four controls wrapping onto three lines would be most of a 375px screen before a recording
    // is drawn, so none of them is on the row.
    expect(screen.getByRole('button', { name: 'Filter' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Any category/ })).toBeNull();
  });

  it('opens the same controls in a sheet, in the same order', async () => {
    narrow();
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const sheet = await screen.findByRole('dialog', { name: 'Narrow this library' });
    expect(within(sheet).getByRole('button', { name: /Any category/ })).toBeVisible();
    expect(within(sheet).getByRole('group', { name: 'Transcript state' })).toBeVisible();
  });

  it('says how many filters are on, because an unseen filter is a forgotten one', async () => {
    narrow();
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: 'Transcribed' }));
    expect(await screen.findByRole('button', { name: 'Filter · 1' })).toBeVisible();
  });

  it('keeps the density switch on the row, because it is not a filter', async () => {
    narrow();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    expect(screen.getByRole('group', { name: 'How to show them' })).toBeVisible();
  });
});

describe('selecting recordings', () => {
  it('turns the filter bar into a bulk bar rather than showing both', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    // A selection is a mode: the question on screen becomes what to do with these, not which
    // others to find. Both bars are the same height, so nothing moved.
    expect(screen.getByText('1 selected')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Any category/ })).toBeNull();
  });

  it('counts a selection rather than naming it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const first = await cardFor('Field recording, long take');
    const second = await cardFor('Digitised cassette');
    await user.click(within(first).getByRole('checkbox', { name: /^Select/ }));
    await user.click(within(second).getByRole('checkbox', { name: /^Select/ }));
    // It has to survive a selection of two hundred, and two hundred titles is a paragraph where
    // a number belongs.
    expect(screen.getByText('2 selected')).toBeVisible();
  });

  it('offers a way out, and the way out clears it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByRole('button', { name: /Any category/ })).toBeVisible();
  });

  it('has no checkboxes at all on a library you can only read', async () => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === RECORDINGS ? { ...one, level: 10 } : one,
    );
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    // Absent rather than disabled: a grid of ticked-off checkboxes leading to a dead bar reads as
    // a bug, and their absence reads as a decision (§3.5).
    expect(within(card).queryByRole('checkbox')).toBeNull();
  });

  it('says whether every card in view is selected, or only some', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    const all = screen.getByRole('checkbox', { name: 'Select everything here' });
    expect(all).toHaveAttribute('aria-checked', 'mixed');
    await user.click(all);
    expect(screen.getByText('3 selected')).toBeVisible();
  });
});

describe('a bulk action where some fail', () => {
  /** Refuse the trash for one recording and accept it for the rest. */
  function refuse(uuid: string) {
    server.use(
      http.delete('/api/audio/:audio_uuid', ({ params }) =>
        params.audio_uuid === uuid
          ? HttpResponse.json(
              {
                type: 'about:blank',
                title: 'Conflict',
                detail: 'That recording is already in the trash.',
                status: 409,
              },
              { status: 409, headers: { 'content-type': 'application/problem+json' } },
            )
          : new HttpResponse(null, { status: 204 }),
      ),
    );
  }

  async function selectAllThenTrash(user: ReturnType<typeof userEvent.setup>) {
    const card = await cardFor('Field recording, long take');
    await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Select everything here' }));
    await user.click(screen.getByRole('button', { name: 'More for the selection' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Send to trash' }));
  }

  it('reports what worked and what did not, in the API own words', async () => {
    refuse(FIELD_TAKE);
    const user = userEvent.setup();
    renderLibrary();
    await selectAllThenTrash(user);
    expect(await screen.findByText('2 done, 1 not')).toBeVisible();
    expect(screen.getByText(/already in the trash/)).toBeVisible();
  });

  it('leaves the failures selected, so the retry is one click', async () => {
    refuse(FIELD_TAKE);
    const user = userEvent.setup();
    renderLibrary();
    await selectAllThenTrash(user);
    await screen.findByText('2 done, 1 not');
    // One left selected, and it is the one that failed -- not a selection somebody has to rebuild.
    expect(screen.getByText('1 selected')).toBeVisible();
    expect(screen.getByText(/still selected/)).toBeVisible();
  });

  it('clears the selection entirely when everything worked', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await selectAllThenTrash(user);
    expect(await screen.findByText(/3 recordings sent to the trash/)).toBeVisible();
    // Nothing failed, so nothing is retained, and the filter bar comes back.
    expect(await screen.findByRole('button', { name: /Any category/ })).toBeVisible();
  });
});

describe('the two empty states', () => {
  it('meets an empty library with an invitation', async () => {
    archive.recordings = [];
    renderLibrary();
    // A new library, and the way out is to add something.
    expect(await screen.findByText(/Nothing in this library yet/)).toBeVisible();
    expect(screen.getByText(/Upload a recording and it will be here/)).toBeVisible();
  });

  it('says something different when a filter matched nothing', async () => {
    // A tag nothing in this library carries: the suggestions come from the whole archive, so a
    // tag that matches nothing here is an ordinary thing to pick.
    archive.recordings = archive.recordings.map((one) =>
      one.library_uuid === RECORDINGS ? { ...one, tags: [] } : one,
    );
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    // `interview` is on a recording in another library, so this filter matches nothing here.
    await user.click(await screen.findByRole('button', { name: /interview/ }));
    // Confusing these two is the classic mistake: one is a new library, the other a mistyped tag.
    expect(await screen.findByText(/Nothing matches that/)).toBeVisible();
    expect(screen.queryByText(/Nothing in this library yet/)).toBeNull();
  });

  it('names the filter, offers to clear it, and says how many are really there', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.library_uuid === RECORDINGS ? { ...one, tags: [] } : one,
    );
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('heading', { name: 'Field recordings', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    await user.click(await screen.findByRole('button', { name: /interview/ }));
    await screen.findByText(/Nothing matches that/);
    // The useful fact is that the library is not empty, only hidden -- and which filter hid it.
    expect(screen.getByText(/#interview/)).toBeVisible();
    expect(screen.getByText(/There are 3 recordings in this library/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(await cardFor('Field recording, long take')).toBeInTheDocument();
  });

  it('tells somebody who cannot upload why it is empty, without offering them an action', async () => {
    archive.recordings = [];
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === RECORDINGS ? { ...one, level: 10 } : one,
    );
    renderLibrary();
    expect(await screen.findByText(/has not put anything in it yet/)).toBeVisible();
  });
});

describe('a library you can only read', () => {
  function readOnly() {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === RECORDINGS ? { ...one, level: 10 } : one,
    );
  }

  it('says so once, quietly, and keeps everything the screen is for', async () => {
    readOnly();
    renderLibrary();
    expect(await screen.findByText('You can read this library.')).toBeVisible();
    // The filters, the sort, the densities and play all stay: what changes is what you can alter.
    expect(screen.getByRole('button', { name: /Any category/ })).toBeVisible();
    expect(screen.getByRole('group', { name: 'How to show them' })).toBeVisible();
    const card = await cardFor('Field recording, long take');
    expect(within(card).getByRole('button', { name: /^Play/ })).toBeVisible();
  });

  it('drops what cannot be done rather than disabling it', async () => {
    readOnly();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    // Absent, not disabled -- a disabled row of controls reads as a bug (§3.5).
    expect(within(card).queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Settings/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Send to trash/ })).toBeNull();
    // And nothing on screen is disabled at all, which is the stronger version of the same claim.
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
  });
});

/**
 * A library longer than one request (`UI-6b`, §V3).
 *
 * The API answers fifty rows at a time, and a grid that drew the first fifty and stopped would
 * report a library of a hundred and forty-two as holding fifty -- with nothing on screen saying
 * otherwise. So the count is asserted as well as the cards: a grid that quietly truncates and a
 * grid that honestly shows part of a library draw the same first screenful.
 */
// A grid of fifty cards is fifty waveform fetches and fifty subscriptions to the player, which is
// seconds of work in jsdom rather than the milliseconds a handful of cards costs. The size is the
// point of these two, so the timeout moves rather than the fixture.
describe('a library longer than one page', { timeout: 30_000 }, () => {
  /** Enough copies that the library does not fit in one request. */
  function stock(extra: number): void {
    const first = archive.recordings.find((one) => one.library_uuid === RECORDINGS);
    if (first === undefined) throw new Error('The archive has no recording in this library.');
    archive.recordings = [
      ...archive.recordings,
      ...Array.from({ length: extra }, (_, index) => ({
        ...first,
        uuid: `bulk-${String(index)}`,
        title: `Take ${String(index + 1)}`,
      })),
    ];
  }

  it('draws the first page, says how much of the library that is, and fetches the rest', async () => {
    stock(52);
    renderLibrary();
    await cardFor('Take 1');
    expect(screen.getAllByRole('article')).toHaveLength(50);
    expect(screen.getByText('50 of 55')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(55);
    });
    // Nothing left to ask for, so nothing offers to ask -- but the count stays, because a live
    // region that unmounts as its last value arrives announces nothing, and it is where the
    // focus of the button that has just gone lands.
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    const count = screen.getByRole('status');
    expect(count).toHaveTextContent('55 of 55');
    expect(count).toHaveFocus();
  });

  it('offers nothing more when the library fits in one request', async () => {
    renderLibrary();
    await cardFor('Field recording, long take');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});
