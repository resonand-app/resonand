/**
 * V9 · Trash, as a screen (`INT-1a`, `INT-1c`, `INT-1d`, §V9).
 *
 * The states are the work here, not the happy path: the empty case is the **good** case, the last
 * day has to be unmistakable, and permanent deletion has to cost the name typed out.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { AVIA, CARRER_NOU, NADAL, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { TrashView } from './TrashView';

mockApi();

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
    trashLibrary(AVIA, daysAgo(2));
    trashRecording(NADAL, daysAgo(3));
    show();
    expect(await screen.findByText('Àvia Teresa')).toBeVisible();
    // Sentence case in the DOM and uppercased in CSS, the way every mono meta line in the
    // system is -- so the assertion is on the string, not on the treatment.
    expect(screen.getByText('Library')).toBeVisible();
    expect(screen.getByText('Recording')).toBeVisible();
  });

  it('puts what is closest to being purged at the top', async () => {
    trashRecording(CARRER_NOU, daysAgo(20));
    trashRecording(NADAL, daysAgo(1));
    show();
    await screen.findByText('The house on Carrer Nou');
    const names = screen
      .getAllByText(/The house on Carrer Nou|Sopar de Nadal 1998/)
      .map((one) => one.textContent);
    expect(names[0]).toBe('The house on Carrer Nou');
  });

  it('says how long the instance keeps things, rather than a number written into the bundle', async () => {
    show();
    expect(await screen.findByText(/kept for 30 days/)).toBeVisible();
  });
});

describe('the last day', () => {
  it('is marked unmistakably, because doing nothing is a decision on that row', async () => {
    trashRecording(NADAL, daysAgo(30));
    show();
    expect(await screen.findByText('Destroyed today')).toBeVisible();
  });

  it('is quiet on a row with weeks to go', async () => {
    trashRecording(NADAL, daysAgo(1));
    show();
    expect(await screen.findByText('29 days left')).toBeVisible();
  });
});

describe('restoring', () => {
  it('takes a recording back out, one call per item', async () => {
    trashRecording(NADAL, daysAgo(3));
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restore Sopar de Nadal 1998' }),
    );
    await waitFor(() => {
      expect(archive.recordings.find((one) => one.uuid === NADAL)?.deleted_at).toBeNull();
    });
  });

  it('takes a library back out', async () => {
    trashLibrary(AVIA, daysAgo(3));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Restore Àvia Teresa' }));
    await waitFor(() => {
      expect(archive.libraries.find((one) => one.uuid === AVIA)?.deleted_at).toBeNull();
    });
  });
});

describe('deleting now', () => {
  it('states what is destroyed in numbers, and will not fire before the name is typed', async () => {
    trashLibrary(AVIA, daysAgo(3));
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Àvia Teresa permanently' }),
    );
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText(/3 recordings, 2 h 04 min of audio/)).toBeVisible();
    const action = within(confirm).getByRole('button', { name: /Delete/ });
    expect(action).toBeDisabled();
    await userEvent.type(within(confirm).getByRole('textbox'), 'Àvia Teresa');
    expect(action).toBeEnabled();
    await userEvent.click(action);
    await waitFor(() => {
      expect(archive.libraries.some((one) => one.uuid === AVIA)).toBe(false);
    });
  });

  it('destroys a recording once its own title has been typed', async () => {
    trashRecording(NADAL, daysAgo(3));
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Sopar de Nadal 1998 permanently' }),
    );
    const confirm = await screen.findByRole('dialog');
    await userEvent.type(within(confirm).getByRole('textbox'), 'Sopar de Nadal 1998');
    await userEvent.click(within(confirm).getByRole('button', { name: /Delete/ }));
    await waitFor(() => {
      expect(archive.recordings.some((one) => one.uuid === NADAL)).toBe(false);
    });
  });
});

describe('a recording whose library is in the trash too', () => {
  it('is grouped under it and says what restoring it alone would do', async () => {
    trashLibrary(AVIA, daysAgo(2));
    trashRecording(NADAL, daysAgo(1));
    show();
    expect(await screen.findByText(/puts it back somewhere you would not see it/)).toBeVisible();
  });

  it('offers to restore the library too, which is the answer that helps', async () => {
    trashLibrary(AVIA, daysAgo(2));
    trashRecording(NADAL, daysAgo(1));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Restore the library too' }));
    await waitFor(() => {
      expect(archive.libraries.find((one) => one.uuid === AVIA)?.deleted_at).toBeNull();
      expect(archive.recordings.find((one) => one.uuid === NADAL)?.deleted_at).toBeNull();
    });
  });

  it('says nothing of the sort when the library is still there', async () => {
    trashRecording(NADAL, daysAgo(1));
    show();
    await screen.findByText('Sopar de Nadal 1998');
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
