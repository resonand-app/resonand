/**
 * V5's frame: where you are, what it is, and what it says when it is not there (`UI-11a`,
 * `UI-11e`, §V5).
 *
 * The assertions worth making here are the two the specification is emphatic about. The
 * essentials line carries **four facts and no fifth** -- a field a design promises that the API
 * cannot fill is a promise somebody has to break. And the not-found wording says the recording
 * may have been deleted or may never have been yours **without ever saying "permission"**, which
 * is the sentence that would undo the 404-not-403 rule the whole ACL is built on (`DEC-14`).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { RECORDINGS, FIELD_TAKE, CASSETTE, VOICE_NOTE, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { RecordingView } from '../RecordingView';

mockApi();

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

/** The one scrollport the left column has, and what is inside it. */
function scroller(): Element {
  const column = document.querySelector('[data-app="recording-scroller"]');
  if (column === null) throw new Error('The recording has no scroller.');
  return column;
}

describe('the waveform and what is under it', () => {
  it('are one scrolling section, so reading puts the picture away', async () => {
    renderRecording();
    await screen.findByRole('heading', { name: 'Field recording, long take', level: 1 });
    const column = scroller();
    const player = document.querySelector('[data-app="detail-player"]');
    const transcript = await screen.findByLabelText('Transcript');
    // Both inside it, because the waveform scrolling away under the transcript is the whole of
    // `UI-11g`: on a short screen the picture was taking the height the reading needed.
    expect(player).not.toBeNull();
    expect(column.contains(player)).toBe(true);
    expect(column.contains(transcript)).toBe(true);
  });

  it('is one scrollport and not two, whatever is under the waveform', async () => {
    renderRecording();
    await screen.findByLabelText('Transcript');
    // A scroller inside a scroller is a wheel that moves whichever of the two the pointer is
    // over, which is the thing nobody can explain afterwards.
    expect(document.querySelector('[data-app="transcript-scroller"]')).toBeNull();
  });

  it('is the same section for a recording that has no transcript at all', async () => {
    // `UI-15`'s three transcript-less states stand where the transcript would, so they scroll
    // the waveform away exactly as a transcript does rather than pinning it to the screen.
    renderRecording(VOICE_NOTE);
    const state = await screen.findByText('This recording has not been transcribed');
    expect(scroller().contains(state)).toBe(true);
  });
});

describe('where you are', () => {
  it('names the library the recording is in and links back to it', async () => {
    renderRecording();
    // The library's name is the only way back, and it is a real `href`: one control naming one
    // destination, rather than that plus a "Back to <library>" button saying the same thing.
    const where = await screen.findByRole('navigation', { name: 'Where this recording is' });
    const back = await within(where).findByRole('link', { name: 'Field recordings' });
    expect(back).toHaveAttribute('href', `/library/${RECORDINGS}`);
    expect(within(where).queryByRole('link', { name: /Back to/ })).toBeNull();
  });

  it('names the category as well, when the recording has one', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === FIELD_TAKE ? { ...one, category_id: 1 } : one,
    );
    renderRecording();
    // Resolved from the library's flat list, which is the only place the name exists: the
    // recording carries the id. Scoped to the breadcrumb, because the panel names it too.
    const where = await screen.findByRole('navigation', { name: 'Where this recording is' });
    await waitFor(() => {
      expect(within(where).getByText('Interviews')).toBeInTheDocument();
    });
  });
});

describe('the essentials line', () => {
  it('carries the recording own date, its length, who uploaded it and which transcript', async () => {
    renderRecording();
    const title = await screen.findByRole('heading', { name: 'Field recording, long take' });
    const meta = title.parentElement?.parentElement?.textContent ?? '';
    expect(meta).toMatch(/48:12/);
    expect(meta).toMatch(/Uploaded by Alex Morgan/);
    expect(meta).toMatch(/Transcript v1/);
  });

  it('renders the recording own time as written, never in the reader timezone', async () => {
    renderRecording();
    const title = await screen.findByRole('heading', { name: 'Field recording, long take' });
    // `2026-03-12T18:22:00` with a +01:00 offset. Half six in the evening wherever the test
    // runs -- the numbers in the string, in the reader's language but not their timezone (§1.3).
    // Read off the essentials line rather than the document: the panel says it too (`UI-13b`).
    expect(title.parentElement?.parentElement?.textContent).toMatch(/Mar 12, 2026, 6:22.PM/u);
  });

  it('says the date is the upload when the recording has none of its own', async () => {
    renderRecording(CASSETTE);
    // A cassette digitised decades later. Passing the digitisation date off as the recording's
    // would be the archive making a claim about when something happened.
    expect(await screen.findByText(/The recording's own date is not known/)).toBeInTheDocument();
  });

  it('says nothing about a transcript version for a recording with no transcript', async () => {
    renderRecording(CASSETTE);
    await screen.findByRole('heading', { name: 'Digitised cassette' });
    expect(screen.queryByText(/Transcript v/)).toBeNull();
  });
});

/**
 * Correcting the title where it is largest (`UI-11i`).
 *
 * The header and the panel are two controls over one field, so the pair that matters is: the
 * header saves through the same endpoint, and the panel hears about it -- a title corrected above
 * the waveform that still reads the old way in the column beside it is the bug this arrangement
 * could produce and must not.
 */
describe('the title in the header', () => {
  /** The page header's own control, rather than the panel's field for the same title. */
  function headerTitle(): HTMLElement {
    return within(screen.getByRole('heading', { level: 1 })).getByRole('button');
  }

  it('is corrected in place, and the panel says the same thing afterwards', async () => {
    const user = userEvent.setup();
    renderRecording();
    await screen.findByRole('heading', { name: /Field recording, long take/, level: 1 });
    await user.click(headerTitle());
    const field = screen.getByRole('textbox', { name: 'Edit the title' });
    await user.clear(field);
    await user.type(field, 'Field recording, long take, 1998{Enter}');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Field recording, long take, 1998/, level: 1 }),
      ).toBeInTheDocument();
    });
    // One field and one cache: the panel is looking at the same recording, so it cannot be
    // left showing the title somebody just replaced.
    const panel = within(screen.getByRole('complementary', { name: 'Details' }));
    expect(
      panel.getByRole('button', { name: /Field recording, long take, 1998/ }),
    ).toBeInTheDocument();
  });

  it('refuses to send an empty title, because a recording has to be called something', async () => {
    const user = userEvent.setup();
    renderRecording();
    await screen.findByRole('heading', { name: /Field recording, long take/, level: 1 });
    await user.click(headerTitle());
    await user.clear(screen.getByRole('textbox', { name: 'Edit the title' }));
    await user.tab();
    expect(
      await screen.findByRole('heading', { name: /Field recording, long take/, level: 1 }),
    ).toBeVisible();
  });

  it('offers nothing at all on a recording somebody can only read', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === FIELD_TAKE ? { ...one, level: 10 } : one,
    );
    renderRecording();
    const heading = await screen.findByRole('heading', {
      name: 'Field recording, long take',
      level: 1,
    });
    // The title is a heading and nothing else: no pencil to reach for, which is §3.5's
    // read-only state rather than a control that turns out to do nothing.
    expect(within(heading).queryByRole('button')).toBeNull();
    expect(heading).toBeVisible();
  });
});

describe('a recording that is not there', () => {
  it('says it may be gone or may never have been yours, and not which', async () => {
    renderRecording('nobody-elses-recording');
    expect(await screen.findByText(/This recording is not here/)).toBeInTheDocument();
    expect(
      screen.getByText(/may have been deleted, or it may never have been yours/),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not say which/)).toBeInTheDocument();
  });

  it('never says the word permission, because that would confirm it exists', async () => {
    renderRecording('nobody-elses-recording');
    await screen.findByText(/This recording is not here/);
    // The whole reason the ACL answers 404: a 403 tells a stranger the uuid they guessed is
    // real. A screen that translates the 404 back into "you do not have permission" gives away
    // exactly what the status code withholds.
    expect(document.body.textContent).not.toMatch(/permission/i);
  });

  it('says the instance is not answering rather than that the recording is missing', async () => {
    server.use(http.get('/api/audio/:audio_uuid', () => HttpResponse.error()));
    renderRecording();
    expect(await screen.findByText(/The instance is not answering/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
