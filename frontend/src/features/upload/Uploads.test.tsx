/**
 * The tray (`UI-18e`, §3.3).
 *
 * The requirement is that an upload is not lost when somebody navigates, so the test that matters
 * is the one that navigates.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { PERSONAL } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { UploadPanel, Uploads } from './Uploads';
import { useUploads } from './uploads';
import type { Upload } from './uploads';

mockApi();

function file(name = 'avia.m4a'): File {
  return new File([new Uint8Array(64)], name);
}

/** A page with a link to another one, and the tray outside the routes, as the shell has it. */
function Elsewhere() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate('/library/x');
      }}
    >
      go elsewhere
    </button>
  );
}

function show(tray = <Uploads />) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Elsewhere />} />
          <Route path="/library/x" element={<p>another screen</p>} />
        </Routes>
        {tray}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the tray', () => {
  beforeEach(() => {
    useUploads.setState({ files: [], collapsed: false });
  });

  it('is absent when nothing is uploading, so the shell reflows', () => {
    show();
    expect(screen.queryByRole('region', { name: /uploads/i })).not.toBeInTheDocument();
  });

  it('keeps uploading across a navigation, which is the whole reason it is not a modal', async () => {
    server.use(
      http.post('/api/libraries/:library_uuid/audio', async () => {
        await delay(80);
        return HttpResponse.json({ uuid: 'new-1' }, { status: 201 });
      }),
    );
    show();
    useUploads.getState().add([file()], { library: PERSONAL });
    await screen.findByText('avia.m4a');
    await userEvent.click(screen.getByRole('button', { name: /go elsewhere/i }));
    expect(await screen.findByText('another screen')).toBeInTheDocument();
    // Same file, still going, on a screen it was not started from.
    expect(screen.getByText('avia.m4a')).toBeInTheDocument();
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('done');
    });
  });

  it('collapses to one line without losing the answer', async () => {
    show();
    useUploads.getState().add([file(), file('nadal.mp3')], { library: PERSONAL });
    await screen.findByText('avia.m4a');
    await userEvent.click(screen.getByRole('button', { name: /hide the uploads/i }));
    expect(screen.queryByText('avia.m4a')).not.toBeInTheDocument();
    // The summary is the same sentence in both states.
    expect(screen.getByText(/of 2 uploaded/)).toBeInTheDocument();
  });

  it('cannot be closed while anything is still going', async () => {
    server.use(
      http.post('/api/libraries/:library_uuid/audio', async () => {
        await delay(200);
        return HttpResponse.json({ uuid: 'new-1' }, { status: 201 });
      }),
    );
    show();
    useUploads.getState().add([file()], { library: PERSONAL });
    await screen.findByText('avia.m4a');
    expect(screen.queryByRole('button', { name: /close the tray/i })).not.toBeInTheDocument();
    await waitFor(
      () => {
        expect(useUploads.getState().files[0]?.status).toBe('done');
      },
      { timeout: 3000 },
    );
    expect(await screen.findByRole('button', { name: /close the tray/i })).toBeInTheDocument();
  });
});

describe('the states of a file', () => {
  beforeEach(() => {
    useUploads.setState({ files: [], collapsed: false });
  });

  it('states the actual limit this instance has, rather than only "too large"', async () => {
    show();
    useUploads
      .getState()
      .add([new File([new Uint8Array(64)], 'huge.wav')], { library: PERSONAL, maxBytes: 32 });
    expect(
      await screen.findByText(/over what this instance accepts, which is 32 B/i),
    ).toBeVisible();
    // Never sent: the interface already knew.
    expect(useUploads.getState().files[0]?.status).toBe('too-large');
  });

  it('treats some of thirty failing as the ordinary outcome, and counts it', async () => {
    server.use(
      http.post('/api/libraries/:library_uuid/audio', () =>
        HttpResponse.json(
          {
            type: '/errors/error',
            title: 'Error',
            detail: 'There is no room left on this instance.',
            status: 507,
            request_id: 'test',
          },
          { status: 507, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    useUploads.getState().add([file(), file('nadal.mp3')], { library: PERSONAL });
    // Sequential, so the second one is still going when the first has already failed.
    await waitFor(() => {
      expect(screen.getAllByText('There is no room left on this instance.')).toHaveLength(2);
    });
    expect(screen.getByText(/0 of 2 uploaded, 2 failed/)).toBeInTheDocument();
  });

  it('offers to send a failed file again, which is a fresh request and says so', async () => {
    let attempts = 0;
    server.use(
      http.post('/api/libraries/:library_uuid/audio', () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ uuid: 'new-1' }, { status: 201 });
      }),
    );
    show();
    useUploads.getState().add([file()], { library: PERSONAL });
    const retry = await screen.findByRole('button', { name: /upload it again/i });
    await userEvent.click(retry);
    await waitFor(() => {
      expect(useUploads.getState().files[0]?.status).toBe('done');
    });
  });
});

describe('the phases a row used to spend in silence', () => {
  /** One row, put straight into the store: the phases are what is being drawn, not how. */
  function row(fields: Partial<Upload>): Upload {
    return {
      id: '1-avia.m4a',
      name: 'avia.m4a',
      size: 1000,
      library: PERSONAL,
      transcribe: false,
      status: 'waiting',
      sent: 0,
      hashed: 0,
      ...fields,
    };
  }

  beforeEach(() => {
    useUploads.setState({ files: [], collapsed: false });
  });

  it('draws how much has been hashed, rather than nought per cent for minutes', () => {
    // `FBK-5`: the duplicate check reads the whole file before a byte goes, and at 8 GiB that is
    // minutes. A bar pinned at nought with the word "checking" on it is a frozen interface.
    useUploads.setState({ files: [row({ status: 'checking', hashed: 400 })] });
    show();
    expect(screen.getByRole('progressbar', { name: 'avia.m4a' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByText(/40%.*Checking/)).toBeInTheDocument();
  });

  it('says the instance is storing it once there is nothing left to send', () => {
    // The bar is full and the wait is not over: the request resolves when the instance has hashed
    // the file, written it and created the recording. "Uploading, 100%" for two minutes reads as
    // stuck, and the bar has nothing left to say.
    useUploads.setState({ files: [row({ status: 'storing', sent: 1000 })] });
    show();
    expect(screen.getByRole('progressbar', { name: 'avia.m4a' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByText('Storing')).toBeInTheDocument();
  });

  it('refuses to be cleared while a file is still being read or still being stored', () => {
    for (const status of ['checking', 'storing'] as const) {
      useUploads.setState({ files: [row({ status })] });
      useUploads.getState().clear();
      expect(useUploads.getState().files).toHaveLength(1);
    }
  });
});

describe('the phone tab', () => {
  beforeEach(() => {
    useUploads.setState({ files: [], collapsed: false });
  });

  it('says what it is for when nothing is going, rather than being blank', () => {
    show(<UploadPanel onAdd={() => undefined} />);
    expect(screen.getByText(/keeps going while you use the rest of the app/i)).toBeVisible();
  });
});
