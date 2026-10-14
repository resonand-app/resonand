/**
 * Favourites (`UI-44`): every recording marked and still readable, from every library, with a
 * selection that offers only what every recording selected allows.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { CASSETTE, FIELD_TAKE, REHEARSAL, VOICE_NOTE, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { FavouritesView } from '../FavouritesView';
import { rulesFor } from '../rules';

mockApi();

/** Mark these, oldest first, at these levels. */
function marked(...entries: { uuid: string; level?: 10 | 20 | 30 | 40 }[]) {
  archive.recordings = archive.recordings.map((one) => {
    const entry = entries.find((each) => each.uuid === one.uuid);
    return entry === undefined
      ? one
      : { ...one, is_favourite: true, level: entry.level ?? one.level };
  });
  archive.favouriteOrder = entries.map((entry) => entry.uuid);
}

function renderFavourites(search = '') {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`${routes.favourites}${search}`]}>
          <Routes>
            <Route path={routes.favourites} element={<FavouritesView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function cardFor(title: string): Promise<HTMLElement> {
  const name = await screen.findByText(title);
  const card = name.closest<HTMLElement>('[data-ds="recording-card"]');
  if (card === null) throw new Error(`no card for ${title}`);
  return card;
}

function titlesOnScreen(): string[] {
  return [...document.querySelectorAll('[data-ds="recording-card-title"]')].map(
    (one) => one.textContent,
  );
}

async function select(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
  for (const title of titles) {
    const card = await cardFor(title);
    await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
  }
}

/** The bulk bar's actions on screen, by the names a person would read. */
function offered(): string[] {
  const names = [
    'Remove from favourites',
    'Add to favourites',
    'Assign a category',
    'Add a tag',
    'Move to another library',
    'Send to trash',
  ];
  return names.filter((name) => screen.queryByRole('button', { name }) !== null);
}

describe('what it lists', () => {
  it('gathers favourites from more than one library, naming each, and nothing else', async () => {
    marked({ uuid: FIELD_TAKE }, { uuid: VOICE_NOTE });
    renderFavourites();
    const field = await cardFor('Field recording, long take');
    const voice = await cardFor('Short voice note');
    expect(field.textContent).toContain('Field recordings');
    expect(voice.textContent).toContain('Personal');
    expect(screen.queryByText('Digitised cassette')).toBeNull();
    expect(await screen.findByText('2 recordings')).toBeVisible();
  });

  it('starts from the newest mark, and says so in the sort control', async () => {
    marked({ uuid: FIELD_TAKE }, { uuid: CASSETTE }, { uuid: VOICE_NOTE });
    renderFavourites();
    await cardFor('Short voice note');
    expect(titlesOnScreen()).toEqual([
      'Short voice note',
      'Digitised cassette',
      'Field recording, long take',
    ]);
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Favourited');
  });

  it('offers no category filter, which would mean nothing across libraries', async () => {
    marked({ uuid: FIELD_TAKE });
    renderFavourites();
    await cardFor('Field recording, long take');
    expect(screen.queryByRole('button', { name: /Any category/ })).toBeNull();
  });

  it('keeps a card that was just unmarked where it is, so the same press can undo it', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE }, { uuid: VOICE_NOTE });
    renderFavourites();
    const card = await cardFor('Field recording, long take');
    const heart = within(card).getByRole('button', {
      name: 'Favourite Field recording, long take',
    });
    await user.click(heart);
    await waitFor(() => {
      expect(archive.recordings.find((one) => one.uuid === FIELD_TAKE)?.is_favourite).toBe(false);
    });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Field recording, long take')).toBeVisible();
  });
});

describe('its states', () => {
  it('says how a recording gets here when nothing is marked', async () => {
    renderFavourites();
    expect(await screen.findByText('Nothing marked yet')).toBeVisible();
  });

  it('tells a filter that matched nothing apart from having nothing', async () => {
    marked({ uuid: FIELD_TAKE });
    renderFavourites('?tag=nothing-has-this');
    expect(await screen.findByText('None of your favourites match')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear the filters' })).toBeVisible();
  });
});

describe('what a selection offers', () => {
  it('offers only the heart for recordings somebody only reads', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 10 }, { uuid: CASSETTE, level: 10 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Digitised cassette');
    expect(offered()).toEqual(['Remove from favourites']);
  });

  it('lets one read-only recording take the edits away from the rest', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 40 }, { uuid: CASSETTE, level: 10 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Digitised cassette');
    expect(offered()).toEqual(['Remove from favourites']);
  });

  it('offers a category and a tag for recordings edited in one library', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 20 }, { uuid: REHEARSAL, level: 20 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Rehearsal, second take');
    expect(offered()).toEqual(['Remove from favourites', 'Assign a category', 'Add a tag']);
  });

  it('drops the category when the edited recordings sit in two libraries', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 20 }, { uuid: VOICE_NOTE, level: 20 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Short voice note');
    expect(offered()).toEqual(['Remove from favourites', 'Add a tag']);
  });

  it('offers a move and the trash only for recordings managed in one library', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 40 }, { uuid: REHEARSAL, level: 30 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Rehearsal, second take');
    expect(offered()).toEqual([
      'Remove from favourites',
      'Assign a category',
      'Add a tag',
      'Move to another library',
      'Send to trash',
    ]);
  });

  it('keeps the trash but not the move when managed recordings sit in two libraries', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 40 }, { uuid: VOICE_NOTE, level: 40 });
    renderFavourites();
    await select(user, 'Field recording, long take', 'Short voice note');
    expect(offered()).toEqual(['Remove from favourites', 'Add a tag', 'Send to trash']);
  });

  it('takes a selection out of the favourites, and the list follows', async () => {
    const user = userEvent.setup();
    marked({ uuid: FIELD_TAKE, level: 10 }, { uuid: VOICE_NOTE, level: 10 });
    renderFavourites();
    await select(user, 'Field recording, long take');
    await user.click(screen.getByRole('button', { name: 'Remove from favourites' }));
    expect(await screen.findByText('One recording taken out of your favourites')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText('Field recording, long take')).toBeNull();
    });
    expect(screen.getByText('Short voice note')).toBeVisible();
  });
});

describe('the rules, on their own', () => {
  const readable = new Set(['library-a', 'library-b']);
  const one = (library: string, level: number) =>
    ({ library_uuid: library, level }) as Parameters<typeof rulesFor>[0][number];

  it('asks every recording selected, not the first', () => {
    expect(rulesFor([one('library-a', 40), one('library-a', 20)], readable)).toEqual({
      canEdit: true,
      canMove: false,
      canTrash: false,
      library: 'library-a',
    });
  });

  it('names no library it cannot read, which a grant on one recording leaves', () => {
    expect(rulesFor([one('library-x', 40)], readable)).toEqual({
      canEdit: true,
      canMove: false,
      canTrash: true,
      library: undefined,
    });
  });

  it('offers nothing for nothing selected', () => {
    expect(rulesFor([], readable)).toEqual({
      canEdit: false,
      canMove: false,
      canTrash: false,
      library: undefined,
    });
  });
});
