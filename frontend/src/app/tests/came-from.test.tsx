/**
 * The list a recording was opened from, and the way back to it (`FBK-7`).
 *
 * The library and the recording are mounted into **one** router rather than tested apart, because
 * the property under test is precisely what passes between them: the list writes its query string
 * into the history entry and the breadcrumb reads it back out. Either view on its own would prove
 * the wiring and miss the wire.
 *
 * The shell is deliberately absent. It draws a library link per library in the sidebar, and the
 * assertion here is about the one link the recording's own frame offers.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrary, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { LibraryView } from '@/features/library/LibraryView';
import { RecordingView } from '@/features/recording/RecordingView';
import { RECORDINGS, FIELD_TAKE } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

mockApi();

afterEach(() => {
  vi.restoreAllMocks();
});

const noop = () => undefined;

/**
 * Give the dense list a viewport, because jsdom performs no layout.
 *
 * `offsetHeight` is zero for every element ever, and that is what the virtualiser measures its
 * scroll container with. Told it has no height, it draws no rows -- and a test that opens "the
 * first row" would then pass by finding nothing to open.
 */
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

function renderAt(entry: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path={routes.library} element={<LibraryView />} />
            <Route path={routes.recording} element={<RecordingView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** The breadcrumb's link: the recording view's one way back, and the only one on the page. */
async function wayBack(): Promise<HTMLElement> {
  return screen.findByRole('link', { name: /Field recordings/ });
}

describe('opening a recording from a library', () => {
  it('comes back to the list that was left, and not to the default one', async () => {
    measured();
    const user = userEvent.setup();
    renderAt(`${toLibrary(RECORDINGS)}?view=list&sort=title&direction=asc`);

    const row = await screen.findByText('Field recording, long take');
    await user.click(row);

    await screen.findByRole('heading', { name: 'Field recording, long take', level: 1 });
    // The whole query string and not just the view mode: a category, a tag and a sort are as much
    // the list somebody left as the density is.
    expect((await wayBack()).getAttribute('href')).toBe(
      `${toLibrary(RECORDINGS)}?view=list&sort=title&direction=asc`,
    );
  });

  it('carries nothing when there was nothing to carry, and says so with a bare library', async () => {
    renderAt(toRecording(FIELD_TAKE));

    await screen.findByRole('heading', { name: 'Field recording, long take', level: 1 });
    // A pasted link, a new tab, the player bar and a search result all arrive here. The breadcrumb
    // is the library itself, which is what it has always been.
    await waitFor(async () => {
      expect((await wayBack()).getAttribute('href')).toBe(toLibrary(RECORDINGS));
    });
  });
});
