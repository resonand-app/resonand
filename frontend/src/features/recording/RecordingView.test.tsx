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
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { AVIA, CARRER_NOU, NADAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

function renderRecording(uuid: string = CARRER_NOU) {
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

describe('where you are', () => {
  it('names the library the recording is in and links back to it', async () => {
    renderRecording();
    const back = await screen.findByRole('link', { name: /Back to Àvia Teresa/ });
    expect(back).toHaveAttribute('href', `/library/${AVIA}`);
  });

  it('names the category as well, when the recording has one', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, category_id: 1 } : one,
    );
    renderRecording();
    // Resolved from the library's flat list, which is the only place the name exists: the
    // recording carries the id. Scoped to the breadcrumb, because the panel names it too.
    const where = await screen.findByRole('navigation', { name: 'Where this recording is' });
    await waitFor(() => {
      expect(within(where).getByText('Converses')).toBeInTheDocument();
    });
  });
});

describe('the essentials line', () => {
  it('carries the recording own date, its length, who uploaded it and which transcript', async () => {
    renderRecording();
    const title = await screen.findByRole('heading', { name: 'The house on Carrer Nou' });
    const meta = title.parentElement?.parentElement?.textContent ?? '';
    expect(meta).toMatch(/48:12/);
    expect(meta).toMatch(/Uploaded by Gabriel/);
    expect(meta).toMatch(/Transcript v1/);
  });

  it('renders the recording own time as written, never in the reader timezone', async () => {
    renderRecording();
    const title = await screen.findByRole('heading', { name: 'The house on Carrer Nou' });
    // `2026-03-12T18:22:00` with a +01:00 offset. Half six in the evening wherever the test
    // runs -- the numbers in the string, in the reader's language but not their timezone (§1.3).
    // Read off the essentials line rather than the document: the panel says it too (`UI-13b`).
    expect(title.parentElement?.parentElement?.textContent).toMatch(/Mar 12, 2026, 6:22.PM/u);
  });

  it('says the date is the upload when the recording has none of its own', async () => {
    renderRecording(NADAL);
    // A cassette digitised decades later. Passing the digitisation date off as the recording's
    // would be the archive making a claim about when something happened.
    expect(await screen.findByText(/The recording's own date is not known/)).toBeInTheDocument();
  });

  it('says nothing about a transcript version for a recording with no transcript', async () => {
    renderRecording(NADAL);
    await screen.findByRole('heading', { name: 'Sopar de Nadal 1998' });
    expect(screen.queryByText(/Transcript v/)).toBeNull();
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
