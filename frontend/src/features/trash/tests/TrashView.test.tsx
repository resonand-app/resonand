/**
 * V9 · Trash, as a screen (`INT-1a`, `INT-1c`, `INT-1d`, §V9).
 *
 * The states are the work here, not the happy path: the empty case is the **good** case, the last
 * day has to be unmistakable, and permanent deletion has to name what goes and open on Cancel
 * (`DEC-28`).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { useToasts } from '@/app/toasts';
import { ThemeProvider } from '@/design-system';
import {
  RECORDINGS,
  FIELD_TAKE,
  CASSETTE,
  PERSONAL,
  VOICE_NOTE,
  archive,
} from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { TrashView } from '../TrashView';

mockApi();

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

/** How long ago, as the API writes an instant. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function trashLibrary(uuid: string, when: string) {
  archive.libraries = archive.libraries.map((one) =>
    one.uuid === uuid ? { ...one, deleted_at: when } : one,
  );
}

function trashRecording(uuid: string, when: string) {
  archive.recordings = archive.recordings.map((one) =>
    one.uuid === uuid ? { ...one, deleted_at: when } : one,
  );
}

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <TrashView />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('an empty trash', () => {
  it('reads as reassurance rather than as absence, and offers nothing to do', async () => {
    show();
    expect(await screen.findByText('Nothing is waiting to be deleted')).toBeVisible();
    expect(screen.getByText(/stays for 30 days before anything is destroyed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });
});

describe('one list with a type marker', () => {
  it('shows recordings and libraries together, marked by what they are', async () => {
    trashLibrary(RECORDINGS, daysAgo(2));
    trashRecording(CASSETTE, daysAgo(3));
    show();
    expect(await screen.findByText('Field recordings')).toBeVisible();
    // Sentence case in the DOM and uppercased in CSS, the way every mono meta line in the
    // system is -- so the assertion is on the string, not on the treatment.
    expect(screen.getByText('Library')).toBeVisible();
    expect(screen.getByText('Recording')).toBeVisible();
  });

  it('puts what is closest to being purged at the top', async () => {
    trashRecording(FIELD_TAKE, daysAgo(20));
    trashRecording(CASSETTE, daysAgo(1));
    show();
    await screen.findByText('Field recording, long take');
    const names = screen
      .getAllByText(/Field recording, long take|Digitised cassette/)
      .map((one) => one.textContent);
    expect(names[0]).toBe('Field recording, long take');
  });

  it('says how long the instance keeps things, rather than a number written into the bundle', async () => {
    show();
    expect(await screen.findByText(/kept for 30 days/)).toBeVisible();
  });
});

describe('the last day', () => {
  it('is marked unmistakably, because doing nothing is a decision on that row', async () => {
    trashRecording(CASSETTE, daysAgo(30));
    show();
    expect(await screen.findByText('Destroyed today')).toBeVisible();
  });

  it('is quiet on a row with weeks to go', async () => {
    trashRecording(CASSETTE, daysAgo(1));
    show();
    expect(await screen.findByText('29 days left')).toBeVisible();
  });
});

describe('restoring', () => {
  it('takes a recording back out, one call per item', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restore Digitised cassette' }),
    );
    await waitFor(() => {
      expect(archive.recordings.find((one) => one.uuid === CASSETTE)?.deleted_at).toBeNull();
    });
  });

  it('takes a library back out', async () => {
    trashLibrary(RECORDINGS, daysAgo(3));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Restore Field recordings' }));
    await waitFor(() => {
      expect(archive.libraries.find((one) => one.uuid === RECORDINGS)?.deleted_at).toBeNull();
    });
  });
});

describe('deleting now', () => {
  async function open(name: string) {
    await userEvent.click(
      await screen.findByRole('button', { name: `Delete ${name} permanently` }),
    );
    return screen.findByRole('dialog', { name: `Delete ${name} permanently?` });
  }

  it('names a library apart from the sentence around it, and asks for nothing to be typed', async () => {
    trashLibrary(RECORDINGS, daysAgo(3));
    show();
    const confirm = await open('Field recordings');
    const title = within(confirm).getByRole('heading', {
      name: 'Delete Field recordings permanently?',
    });
    expect(within(title).getByText('Field recordings')).not.toBe(title);
    expect(within(confirm).queryByRole('textbox')).toBeNull();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(archive.libraries.some((one) => one.uuid === RECORDINGS)).toBe(false);
    });
  });

  it('says nothing under the title but the buttons', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    const confirm = await open('Digitised cassette');
    expect(confirm.querySelector('p')).toBeNull();
    expect(within(confirm).queryByText(/destroys|cannot be undone/)).toBeNull();
  });

  it('destroys nothing until the danger button is pressed', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    const confirm = await open('Digitised cassette');
    expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(true);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(false);
    });
  });

  it('opens on Cancel, so Enter pressed by habit cancels', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    const confirm = await open('Digitised cassette');
    await waitFor(() => {
      expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(true);
  });

  it('cancels on Escape', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    await open('Digitised cassette');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(true);
  });
});

describe('a recording whose library is in the trash too', () => {
  it('is grouped under it and says what restoring it alone would do', async () => {
    trashLibrary(RECORDINGS, daysAgo(2));
    trashRecording(CASSETTE, daysAgo(1));
    show();
    expect(await screen.findByText(/puts it back somewhere you would not see it/)).toBeVisible();
  });

  it('offers to restore the library too, which is the answer that helps', async () => {
    trashLibrary(RECORDINGS, daysAgo(2));
    trashRecording(CASSETTE, daysAgo(1));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Restore the library too' }));
    await waitFor(() => {
      expect(archive.libraries.find((one) => one.uuid === RECORDINGS)?.deleted_at).toBeNull();
      expect(archive.recordings.find((one) => one.uuid === CASSETTE)?.deleted_at).toBeNull();
    });
  });

  it('says nothing of the sort when the library is still there', async () => {
    trashRecording(CASSETTE, daysAgo(1));
    show();
    await screen.findByText('Digitised cassette');
    expect(screen.queryByText(/puts it back somewhere you would not see it/)).toBeNull();
  });
});

describe('when the trash cannot be read', () => {
  it('says what happened and offers the way back', async () => {
    server.use(
      http.get('/api/trash/audio', () =>
        HttpResponse.json(
          {
            type: '/errors/error',
            title: 'Error',
            detail: 'The instance answered 500 and said nothing more.',
            status: 500,
            request_id: 'test-request',
          },
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    expect(await screen.findByText('The trash could not be read')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

describe('the personal library', () => {
  it('is never in the trash, because it cannot be deleted', async () => {
    show();
    await screen.findByText('Nothing is waiting to be deleted');
    expect(archive.libraries.find((one) => one.uuid === PERSONAL)?.deleted_at).toBeNull();
  });
});

describe('destroying part of the trash, or all of it', () => {
  const MINUTE = 60_000;

  /**
   * A recording trashed out of a library that is then trashed too, with the library's totals
   * lowered as the API lowers them: `audio_count` leaves out what was trashed on its own.
   */
  function trashBoth() {
    trashRecording(CASSETTE, daysAgo(3));
    trashLibrary(RECORDINGS, daysAgo(2));
    const cassette = archive.recordings.find((one) => one.uuid === CASSETTE)?.duration_ms ?? 0;
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === RECORDINGS
        ? { ...one, audio_count: 2, total_duration_ms: one.total_duration_ms - cassette }
        : one,
    );
  }

  function toasts() {
    return useToasts.getState().toasts.map((one) => one.message);
  }

  async function tick(name: string) {
    await userEvent.click(await screen.findByRole('checkbox', { name: `Select ${name}` }));
  }

  async function confirmSelection() {
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    return screen.findByRole('dialog', { name: /permanently\?$/ });
  }

  it('replaces the bar above the list with the bulk bar, at the same height', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    trashRecording(VOICE_NOTE, daysAgo(2));
    show();
    const held = (await screen.findByText('2 items')).closest('div[style*="min-height"]');
    expect(held?.getAttribute('style')).toContain('min-height: var(--hit-target)');
    await tick('Digitised cassette');
    expect(screen.queryByText('2 items')).toBeNull();
    const bulk = screen.getByText('1 selected').closest('div[style*="min-height"]');
    expect(bulk?.getAttribute('style')).toContain('min-height: var(--hit-target)');
  });

  it('counts the selection in the title, apart, and says nothing under it', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    trashRecording(VOICE_NOTE, daysAgo(2));
    trashRecording(FIELD_TAKE, daysAgo(1));
    show();
    await tick('Digitised cassette');
    await tick('Short voice note');
    const confirm = await confirmSelection();
    const title = within(confirm).getByRole('heading', {
      name: 'Delete 2 recordings permanently?',
    });
    expect(within(title).getByText('2 recordings')).not.toBe(title);
    expect(confirm.querySelector('p')).toBeNull();
    expect(archive.recordings.filter((one) => one.deleted_at !== null)).toHaveLength(3);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(archive.recordings.map((one) => one.uuid)).not.toContain(CASSETTE);
    });
    expect(archive.recordings.map((one) => one.uuid)).not.toContain(VOICE_NOTE);
    expect(archive.recordings.map((one) => one.uuid)).toContain(FIELD_TAKE);
    await waitFor(() => {
      expect(toasts()).toContain('2 recordings deleted permanently.');
    });
    expect(await screen.findByText('1 item')).toBeVisible();
  });

  it('opens on Cancel, so Enter pressed by habit cancels and keeps the selection', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    await tick('Digitised cassette');
    const confirm = await confirmSelection();
    await waitFor(() => {
      expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(true);
    expect(screen.getByText('1 selected')).toBeVisible();
  });

  it('counts a library and a recording inside it once, both ticked', async () => {
    trashBoth();
    show();
    await tick('Digitised cassette');
    await tick('Field recordings');
    const child = screen.getByRole('checkbox', { name: 'Select Digitised cassette' });
    expect(child).toBeChecked();
    expect(child).toBeDisabled();
    expect(screen.getByText('1 selected')).toBeVisible();
    const confirm = await confirmSelection();
    expect(within(confirm).getByRole('heading')).toHaveTextContent(
      'Delete 3 recordings and 1 library permanently?',
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(toasts()).toContain('3 recordings and 1 library deleted permanently.');
    });
    expect(archive.recordings.map((one) => one.uuid)).not.toContain(CASSETTE);
  });

  it("empties the whole trash with the summary's count, and ends on the good empty state", async () => {
    trashLibrary(RECORDINGS, daysAgo(2));
    trashRecording(VOICE_NOTE, daysAgo(1));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Empty trash' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Delete 4 recordings and 1 library permanently?',
    });
    expect(confirm.querySelector('p')).toBeNull();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText('Nothing is waiting to be deleted')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Empty trash' })).toBeNull();
    expect(toasts()).toContain('4 recordings and 1 library deleted permanently.');
  });

  it('leaves what was trashed after the numbers were counted', async () => {
    trashRecording(VOICE_NOTE, daysAgo(1));
    let sent: string | null = null;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'DELETE' && new URL(request.url).pathname === '/api/trash') {
        sent = new URL(request.url).searchParams.get('trashed_before');
      }
    });
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Empty trash' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Delete 1 recording permanently?',
    });
    trashRecording(CASSETTE, new Date(Date.now() + MINUTE).toISOString());
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(archive.recordings.map((one) => one.uuid)).not.toContain(VOICE_NOTE);
    });
    expect(sent).not.toBeNull();
    expect(archive.recordings.map((one) => one.uuid)).toContain(CASSETTE);
    server.events.removeAllListeners();
  });

  it('cancels on Escape, and Escape with nothing open clears the selection', async () => {
    trashRecording(CASSETTE, daysAgo(3));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Empty trash' }));
    await screen.findByRole('dialog', { name: 'Delete 1 recording permanently?' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(archive.recordings.some((one) => one.uuid === CASSETTE)).toBe(true);
    await tick('Digitised cassette');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('1 item')).toBeVisible();
  });
});
