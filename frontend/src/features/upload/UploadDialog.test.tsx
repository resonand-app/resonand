/**
 * Getting files in, and saying what is accepted before anybody chooses (`UI-18a`, §V-E).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ATENEU, AVIA, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { UploadDialog } from './UploadDialog';
import { useUploads } from './uploads';

mockApi();

function show(onClose = vi.fn(), library: string | undefined = PERSONAL) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <UploadDialog open onClose={onClose} library={library} />
    </QueryClientProvider>,
  );
  return onClose;
}

/** A file with a name and a size, which is all the dialog reads. */
function file(name: string, size = 1024): File {
  return new File([new Uint8Array(size)], name);
}

describe('the destination', () => {
  beforeEach(() => {
    useUploads.setState({ files: [] });
  });

  it('defaults to the library somebody came from', async () => {
    show(vi.fn(), AVIA);
    const select = await screen.findByRole('combobox', { name: /into which library/i });
    await waitFor(() => {
      expect(select).toHaveTextContent('Àvia Teresa');
    });
  });

  it('offers only libraries you can add to, since upload needs level 20', async () => {
    // Absent rather than present and disabled: an option nobody can pick only raises a question.
    server.use(
      http.get('/api/libraries', () =>
        HttpResponse.json(
          archive.libraries.map((one) => (one.uuid === ATENEU ? { ...one, level: 10 } : one)),
        ),
      ),
    );
    show(vi.fn(), ATENEU);
    await userEvent.click(await screen.findByRole('combobox', { name: /into which library/i }));
    await screen.findByRole('option', { name: 'Personal' });
    expect(screen.queryByRole('option', { name: 'Reunions Ateneu' })).not.toBeInTheDocument();
  });

  it('carries the chosen category to every file in the batch', async () => {
    show(vi.fn(), AVIA);
    await userEvent.click(await screen.findByRole('combobox', { name: /^category$/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Converses' }));
    await userEvent.upload(screen.getByLabelText(/drop files here/i), [file('avia.m4a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }));
    expect(useUploads.getState().files[0]?.categoryId).toBe(1);
  });

  it('drops the category when the library changes, since the id means nothing there', async () => {
    show(vi.fn(), AVIA);
    await userEvent.click(await screen.findByRole('combobox', { name: /^category$/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Converses' }));
    await userEvent.click(screen.getByRole('combobox', { name: /into which library/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Personal' }));
    expect(screen.getByRole('combobox', { name: /^category$/i })).toHaveTextContent('No category');
  });
});

describe('asking for a transcription', () => {
  beforeEach(() => {
    useUploads.setState({ files: [] });
  });

  it('names the provider beside the switch, before the decision is taken', async () => {
    // The disclosure is at the moment of the decision, because there is no confirm step after it.
    show();
    expect(await screen.findByText(/whisper/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /transcribe/i })).toBeInTheDocument();
  });

  it('says the audio leaves the instance when the provider is not on its own network', async () => {
    server.use(
      http.get('/api/transcription/destination', () =>
        HttpResponse.json({
          provider: 'openai',
          host: 'api.openai.com',
          is_local: false,
          configured: true,
        }),
      ),
    );
    show();
    expect(await screen.findByText(/leaves this instance/i)).toBeInTheDocument();
  });

  it('offers no switch at all when no provider is configured, and says why', async () => {
    server.use(
      http.get('/api/transcription/destination', () =>
        HttpResponse.json({ provider: 'none', host: null, is_local: false, configured: false }),
      ),
    );
    show();
    expect(await screen.findByText(/no transcription provider/i)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('carries the answer to the queue, and only when it was asked for', async () => {
    show();
    await userEvent.upload(screen.getByLabelText(/drop files here/i), [file('avia.m4a')]);
    await userEvent.click(await screen.findByRole('switch', { name: /transcribe/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }));
    expect(useUploads.getState().files[0]?.transcribe).toBe(true);
  });
});

describe('the dialog', () => {
  beforeEach(() => {
    useUploads.setState({ files: [] });
  });

  it('states the size limit and the formats before a file is chosen', async () => {
    show();
    // Read from the instance, so an operator raising the limit does not need a rebuild.
    expect(await screen.findByText(/up to 2\.0 GB each/i)).toBeInTheDocument();
    expect(screen.getByText(/\.m4a/)).toBeInTheDocument();
  });

  it('says video is kept whole and played as audio, because the mp4 is the one that matters', () => {
    show();
    expect(screen.getByText(/kept whole and played as audio/i)).toBeInTheDocument();
  });

  it('takes several files, and keeps the ones chosen first', async () => {
    show();
    const picker = screen.getByLabelText<HTMLInputElement>(/drop files here/i);
    await userEvent.upload(picker, [file('avia.m4a'), file('nadal.mp3')]);
    await userEvent.upload(picker, [file('assaig.wav')]);
    expect(screen.getByRole('button', { name: 'Upload 3 files' })).toBeEnabled();
  });

  it('names a file it cannot ingest rather than sending it to be refused', async () => {
    show();
    await userEvent.upload(screen.getByLabelText(/drop files here/i), [file('notes.txt')]);
    expect(screen.getByText(/notes.txt is not a format this archive ingests/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled();
  });

  it('hands the files over and closes, so closing it cannot stop them', async () => {
    const onClose = vi.fn();
    show(onClose);
    await userEvent.upload(screen.getByLabelText(/drop files here/i), [file('avia.m4a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }));
    expect(onClose).toHaveBeenCalled();
    expect(useUploads.getState().files.map((one) => one.name)).toContain('avia.m4a');
  });
});
