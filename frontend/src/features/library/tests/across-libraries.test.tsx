/**
 * The grid and the list drawing recordings from more than one library (`UI-43`).
 *
 * Mounted on every recording the caller can see rather than through a view, because the view that
 * lists across libraries is `UI-44`'s: this is the half that has to hold before it can exist. A
 * recording whose library the caller cannot read -- shared on its own, which does not grant its
 * library -- is the case that has to name nothing rather than something wrong.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { FIELD_TAKE, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingGrid } from '../RecordingGrid';
import { RecordingList } from '../RecordingList';
import { EVERYWHERE, useRecordings } from '../recordings';

mockApi();

const UNREADABLE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ON_ITS_OWN = 'aaaaaaaa-0000-4000-8000-0000000000ff';

/** A category on one card, and a recording shared on its own from a library nobody listed. */
function arrange() {
  const template = archive.recordings.find((one) => one.uuid === FIELD_TAKE);
  if (template === undefined) throw new Error('fixture moved');
  archive.recordings = [
    ...archive.recordings.map((one) =>
      one.uuid === FIELD_TAKE ? { ...one, category_id: 2 } : one,
    ),
    {
      ...template,
      uuid: ON_ITS_OWN,
      title: 'Shared on its own',
      library_uuid: UNREADABLE,
      category_id: 1,
      is_shared_individually: true,
    },
  ];
}

function Across({ dense }: { dense: boolean }) {
  const recordings = useRecordings(EVERYWHERE, {});
  return dense ? (
    <RecordingList source={EVERYWHERE} query={{}} />
  ) : (
    <RecordingGrid recordings={recordings.items} waveforms={false} />
  );
}

function mount(dense: boolean) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <Across dense={dense} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function measured(height = 720) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
}

/** The card or row about one recording, by its title. */
async function drawn(selector: string, title: string): Promise<HTMLElement> {
  const name = await screen.findByText(title);
  const host = name.closest<HTMLElement>(selector);
  if (host === null) throw new Error(`no ${selector} around ${title}`);
  return host;
}

describe('a grid across libraries', () => {
  it('names each card after its own library, and its category from that library', async () => {
    arrange();
    mount(false);
    const field = await drawn('[data-ds="recording-card"]', 'Field recording, long take');
    expect(field.textContent).toContain('Field recordings');
    await waitFor(() => {
      expect(within(field).getByText('Fieldwork')).toBeInTheDocument();
    });
    const voice = await drawn('[data-ds="recording-card"]', 'Short voice note');
    expect(voice.textContent).toContain('Personal');
  });

  it('names neither for a library the caller cannot read', async () => {
    arrange();
    mount(false);
    const alone = await drawn('[data-ds="recording-card"]', 'Shared on its own');
    await screen.findByText('Fieldwork');
    // Category 1 is "Interviews" in the readable library; borrowing it would be a wrong name.
    expect(within(alone).queryByText('Interviews')).toBeNull();
    for (const name of ['Field recordings', 'Personal', 'Meetings']) {
      expect(alone.textContent).not.toContain(name);
    }
  });
});

describe('a list across libraries', () => {
  it('heads the column with the library, and names it before the category', async () => {
    arrange();
    measured();
    mount(true);
    expect(await screen.findByRole('columnheader', { name: 'Library' })).toBeInTheDocument();
    const field = await drawn('[data-ds="recording-row"]', 'Field recording, long take');
    await waitFor(() => {
      expect(field.textContent).toContain('Field recordings · Fieldwork');
    });
    const voice = await drawn('[data-ds="recording-row"]', 'Short voice note');
    expect(voice.textContent).toContain('Personal');
    const alone = await drawn('[data-ds="recording-row"]', 'Shared on its own');
    expect(alone.querySelector('[data-column="category"]')?.textContent).toBe('');
  });
});
