/**
 * The technical section (`UI-13d`, §V5).
 *
 * Two things are worth asserting. It shows **the seven fields §V5 lists and no eighth**, because
 * a field a design promises that the API cannot fill is a promise somebody has to break. And the
 * hash is copyable, because principle 1 -- the original is kept byte for byte -- is only checkable
 * by somebody who can compare a hash, and one that has to be selected by eye across 64 characters
 * is one nobody checks.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { FIELD_TAKE, VOICE_NOTE } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingView } from '../RecordingView';

mockApi();

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A clipboard, which jsdom does not have.
 *
 * Defined on the real `navigator` rather than stubbed as a global: `navigator` is a getter on the
 * window in jsdom, and replacing the whole object loses everything else on it. **It has to be
 * installed after `userEvent.setup()`**, which puts a clipboard of its own there -- so a mock
 * defined before it is silently replaced, and the test then asserts against user-event's stub.
 */
function clipboard(refuse = false) {
  const writeText = vi
    .fn<(value: string) => Promise<void>>()
    .mockImplementation(() =>
      refuse ? Promise.reject(new Error('The user declined.')) : Promise.resolve(),
    );
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

/** Open the section, the way somebody looking for a sample rate does. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('Technical'));
}

function renderRecording(uuid: string = FIELD_TAKE) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toRecording(uuid)]}>
          <Routes>
            <Route path={routes.recording} element={<RecordingView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the section', () => {
  it('starts closed, because it is not what anybody came for', async () => {
    renderRecording();
    const summary = await screen.findByText('Technical');
    expect(summary.closest('details')).not.toHaveAttribute('open');
  });

  it('carries the seven fields the specification lists, and no eighth', async () => {
    renderRecording();
    await screen.findByText('Technical');
    const rows = document.querySelectorAll('[data-ds="key-value-list"] dt');
    expect([...rows].map((row) => row.textContent)).toEqual([
      'Original filename',
      'Type',
      'Size',
      'Sample rate',
      'Channels',
      'Codec',
      'SHA-256',
    ]);
  });

  it('formats the numbers rather than printing them raw', async () => {
    renderRecording();
    await screen.findByText('Technical');
    // 284 MB from 297,795,584 bytes, and 48 000 Hz grouped with the thin space §1.4 asks for.
    expect(screen.getByText(/284.MB/u)).toBeInTheDocument();
    expect(screen.getByText(/48.000.Hz/u)).toBeInTheDocument();
    expect(screen.getByText('1 (mono)')).toBeInTheDocument();
  });

  it('says a field is not known yet rather than leaving the row blank', async () => {
    renderRecording(VOICE_NOTE);
    await screen.findByText('Technical');
    // The probe has not run on this one. An empty row reads as a value that failed to load.
    expect(screen.getAllByText('Not known yet').length).toBeGreaterThan(0);
  });
});

describe('the hash', () => {
  it('copies, so the original can actually be checked', async () => {
    const user = userEvent.setup();
    const writeText = clipboard();
    renderRecording();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('a'.repeat(64));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('goes on offering to copy when the clipboard refuses', async () => {
    const user = userEvent.setup();
    clipboard(true);
    renderRecording();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    // An insecure origin, a browser that asks first, a permission somebody declined. There is
    // nothing useful to say: the hash is on the screen and can be selected.
    expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
