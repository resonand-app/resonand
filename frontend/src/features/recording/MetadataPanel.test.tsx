/**
 * The metadata panel, and the column it sits in (`UI-11c`, `UI-13a`, `UI-13b`, §V5).
 *
 * Two properties are worth holding. A correction is **saved on blur and sent as one field**,
 * because the panel is a caption you are fixing rather than a form you are submitting -- and a
 * request carrying fields nobody touched is a request that can overwrite somebody else's edit.
 * And a recording somebody can only read has **no editable field and no disabled one**: §3.5's
 * third state, which reads as a decision rather than as a bug.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { ASSAIG, CARRER_NOU, NADAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

afterEach(() => {
  // The panel remembers whether it is folded away, per device. Left behind, that is the next
  // test starting on a screen somebody else configured.
  window.localStorage.clear();
});

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

/** Every body a request was sent with, so a test can assert what was not sent as well. */
function recorded(): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'PATCH') return;
    void request
      .clone()
      .json()
      .then((body: unknown) => {
        bodies.push(body as Record<string, unknown>);
      });
  });
  return bodies;
}

describe('correcting a field', () => {
  it('saves the title when the field is left, with no Save button anywhere', async () => {
    const user = userEvent.setup();
    renderRecording();
    const title = await screen.findByRole('button', { name: /The house on Carrer Nou/ });
    await user.click(title);
    const field = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(field);
    await user.type(field, 'The house on Carrer Nou, 1998');
    await user.tab();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'The house on Carrer Nou, 1998' }),
      ).toBeInTheDocument();
    });
    // The panel is a caption being corrected, not a form being submitted (`UI-34l`).
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('sends the one field it changed and nothing else', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /Recorded at the kitchen table/ }));
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    await user.clear(notes);
    await user.type(notes, 'The radio is on at first.');
    await user.tab();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    // A body carrying every field would send the title back too, and overwrite whatever somebody
    // else corrected while this panel was open.
    expect(bodies[0]).toEqual({ notes: 'The radio is on at first.' });
  });

  it('clears notes to null rather than to an empty string', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /Recorded at the kitchen table/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Notes' }));
    await user.tab();
    // The field is absent on the recording; `""` would be a note somebody wrote that says
    // nothing, and the two read differently everywhere they are shown.
    await waitFor(() => {
      expect(bodies[0]).toEqual({ notes: null });
    });
  });

  it('refuses to send an empty title, because a recording has to be called something', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /The house on Carrer Nou/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.tab();
    expect(bodies).toEqual([]);
    expect(await screen.findByRole('heading', { name: 'The house on Carrer Nou' })).toBeVisible();
  });
});

describe('when it was recorded', () => {
  it('shows the time as written, with its offset and where it came from', async () => {
    renderRecording();
    expect(await screen.findByText('Recorded')).toBeInTheDocument();
    // `+01:00` as written, and the provenance quietly beside it: the date is inside the file.
    expect(screen.getByText('+01:00')).toBeInTheDocument();
    expect(screen.getByText('From the file')).toBeInTheDocument();
  });

  it('says the date came from the file own date, which is not the recording own', async () => {
    renderRecording(ASSAIG);
    // A file's modification time is when the file was written. For a cassette digitised decades
    // later that is the digitisation, and the archive says so rather than making the claim.
    expect(await screen.findByText('From the file date')).toBeInTheDocument();
  });

  it('says plainly when the date shown is the upload own', async () => {
    renderRecording(NADAL);
    expect(await screen.findByText('From the upload, not the recording')).toBeInTheDocument();
  });
});

describe('a recording somebody can only read', () => {
  it('draws the fields as facts rather than as disabled controls', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    await screen.findByRole('heading', { name: 'The house on Carrer Nou' });
    // No box, no pencil, no greyed-out input: §3.5's read-only state, which has to look
    // intentional. A disabled row of fields reads as a bug.
    expect(screen.queryByRole('button', { name: /The house on Carrer Nou/ })).toBeNull();
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
    expect(document.querySelector('[data-ds="inline-field-static"]')).not.toBeNull();
  });

  it('says so once, quietly, rather than on every field', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    expect(await screen.findByText(/You can read this recording/)).toBeInTheDocument();
    expect(screen.getAllByText(/You can read this recording/)).toHaveLength(1);
  });

  it('is editable again at level 20, which is the whole difference', async () => {
    renderRecording();
    expect(
      await screen.findByRole('button', { name: /The house on Carrer Nou/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You can read this recording/)).toBeNull();
  });
});

describe('the panel itself', () => {
  it('folds away, and gives the transcript the width', async () => {
    const user = userEvent.setup();
    renderRecording();
    const panel = await screen.findByRole('complementary', { name: 'Details' });
    expect(panel).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide the details' }));
    expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show the details' }));
    expect(await screen.findByRole('complementary', { name: 'Details' })).toBeInTheDocument();
  });
});

describe('the category', () => {
  it('files the recording, and sends the id', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /No category/ }));
    await user.click(await screen.findByRole('radio', { name: 'Converses' }));
    await waitFor(() => {
      expect(bodies[0]).toEqual({ category_id: 1 });
    });
  });

  it('clears it with the flag rather than with a null', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, category_id: 1 } : one,
    );
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /Converses/ }));
    await user.click(await screen.findByRole('radio', { name: 'No category' }));
    // In JSON a null and "leave it alone" are the same value, so `clear_category` is the only
    // way "no category" can be said at all (`UI-13c`).
    await waitFor(() => {
      expect(bodies[0]).toEqual({ clear_category: true });
    });
  });

  it('is a fact rather than a control when it is not yours to change', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10, category_id: 1 } : one,
    );
    renderRecording();
    // Twice on the screen: the breadcrumb names it as well, and neither of them is a control.
    await waitFor(() => {
      expect(screen.getAllByText('Converses').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('button', { name: /Converses/ })).toBeNull();
  });
});

describe('the tags', () => {
  it('sends the whole list, because the endpoint replaces it', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Add a tag' }));
    await user.click(await screen.findByRole('button', { name: /família/ }));
    // The two it already had plus the new one. Sending only the new one would strip the rest.
    await waitFor(() => {
      expect(bodies[0]).toEqual({ tags: ['memòria', 'català', 'família'] });
    });
  });

  it('offers the canonical spelling rather than the one that was typed', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Add a tag' }));
    await user.type(screen.getByRole('textbox', { name: 'Tag name' }), 'Musica{Enter}');
    // `música` already exists. The backend normalises to match it and the first writer owns the
    // display name, so accepting "Musica" would rename somebody else's tag.
    await waitFor(() => {
      expect(bodies[0]).toEqual({ tags: ['memòria', 'català', 'música'] });
    });
  });

  it('lets somebody name a tag nobody has used yet', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Add a tag' }));
    await user.type(screen.getByRole('textbox', { name: 'Tag name' }), 'Carrer Nou{Enter}');
    // The suggestions are what exists, not what is allowed: whoever names a new tag owns its
    // spelling, which is the same rule from the other side.
    await waitFor(() => {
      expect(bodies[0]).toEqual({ tags: ['memòria', 'català', 'Carrer Nou'] });
    });
  });

  it('removes one, and sends what is left', async () => {
    const user = userEvent.setup();
    const bodies = recorded();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Remove the tag memòria' }));
    await waitFor(() => {
      expect(bodies[0]).toEqual({ tags: ['català'] });
    });
  });

  it('offers no way to change them on a recording somebody can only read', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    await screen.findByRole('heading', { name: 'The house on Carrer Nou' });
    // Absent rather than disabled (§3.5). The tags themselves stay: they are what the recording
    // is filed under, and reading them is the point.
    expect(screen.getByText('memòria')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a tag' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove the tag/ })).toBeNull();
  });
});
