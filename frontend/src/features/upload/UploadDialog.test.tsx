/**
 * Getting files in, and saying what is accepted before anybody chooses (`UI-18a`, §V-E).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { PERSONAL } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { UploadDialog } from './UploadDialog';
import { useUploads } from './uploads';

mockApi();

function show(onClose = vi.fn()) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <UploadDialog open onClose={onClose} library={PERSONAL} />
    </QueryClientProvider>,
  );
  return onClose;
}

/** A file with a name and a size, which is all the dialog reads. */
function file(name: string, size = 1024): File {
  return new File([new Uint8Array(size)], name);
}

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
