/**
 * The file that is already here (`UI-18d`, `DEC-16`, §V-E).
 *
 * The behaviour worth holding is the order: the archive is asked **before** the bytes go. Asking
 * afterwards would make the offer to restore a trashed copy produce the real duplicate the whole
 * rule exists to prevent.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { CARRER_NOU, PERSONAL } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { DuplicateNotice } from '../DuplicateNotice';
import { useUploads } from '../uploads';

mockApi();

/** The instance says this file is already here, in the trash or not. */
function alreadyHere(over: { in_trash: boolean }) {
  server.use(
    http.get('/api/audio/duplicates/:sha256', () =>
      HttpResponse.json([
        {
          uuid: CARRER_NOU,
          title: 'The house on Carrer Nou',
          library_uuid: PERSONAL,
          in_trash: over.in_trash,
        },
      ]),
    ),
  );
}

function file(name = 'avia.m4a'): File {
  return new File([new Uint8Array(64)], name);
}

/** Wait for the queue to settle on a status. */
async function statusOf(): Promise<string | undefined> {
  await waitFor(() => {
    expect(useUploads.getState().files[0]?.status).not.toBe('checking');
  });
  return useUploads.getState().files[0]?.status;
}

function showNotice() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const upload = useUploads.getState().files[0];
  if (upload === undefined) throw new Error('nothing queued');
  return render(
    <QueryClientProvider client={client}>
      <DuplicateNotice upload={upload} />
    </QueryClientProvider>,
  );
}

describe('a byte-identical file', () => {
  beforeEach(() => {
    useUploads.setState({ files: [] });
  });

  it('is asked about before it is sent, and stops on the answer', async () => {
    alreadyHere({ in_trash: false });
    const sent = vi.fn();
    server.use(
      http.post('/api/libraries/:library_uuid/audio', () => {
        sent();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    useUploads.getState().add([file()], { library: PERSONAL });
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('duplicate');
    });
    expect(sent).not.toHaveBeenCalled();
  });

  it('names the recording that is already there', async () => {
    alreadyHere({ in_trash: false });
    useUploads.getState().add([file()], { library: PERSONAL });
    await statusOf();
    showNotice();
    expect(screen.getByText(/already here, as "The house on Carrer Nou"/i)).toBeVisible();
  });

  it('offers to restore the copy in the trash instead of storing a second one', async () => {
    alreadyHere({ in_trash: true });
    useUploads.getState().add([file()], { library: PERSONAL });
    await statusOf();
    showNotice();
    await userEvent.click(screen.getByRole('button', { name: /restore that one instead/i }));
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('skipped');
    });
  });

  it('is never a silent block: it can be sent anyway', async () => {
    alreadyHere({ in_trash: false });
    useUploads.getState().add([file()], { library: PERSONAL });
    await statusOf();
    showNotice();
    await userEvent.click(screen.getByRole('button', { name: /upload it anyway/i }));
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('done');
    });
  });

  it('does not offer a restore for a copy that is not in the trash', async () => {
    alreadyHere({ in_trash: false });
    useUploads.getState().add([file()], { library: PERSONAL });
    await statusOf();
    showNotice();
    expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
  });

  it('sends the file when the check itself fails, rather than refusing on its own behalf', async () => {
    server.use(
      http.get('/api/audio/duplicates/:sha256', () => new HttpResponse(null, { status: 500 })),
    );
    useUploads.getState().add([file()], { library: PERSONAL });
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('done');
    });
  });
});
