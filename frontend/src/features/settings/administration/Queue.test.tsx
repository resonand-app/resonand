/**
 * The job queue (`INT-3d`, §V10).
 *
 * Three of the four states in §V10's table are the work here: an empty queue that looks healthy,
 * four hundred pending jobs that also look healthy, and a job that has failed four times showing
 * its attempts and the real error text.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { CANCONS, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { Queue } from './Queue';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Queue />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('a job that failed', () => {
  it('shows the real error text and how many attempts it has had', async () => {
    show();
    expect(await screen.findByText('The transcription provider did not answer.')).toBeVisible();
    expect(screen.getByText('3 attempts')).toBeVisible();
  });

  it('can be retried and cancelled', async () => {
    show();
    await screen.findByText('The transcription provider did not answer.');
    expect(screen.getAllByRole('button', { name: /^Retry the / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Cancel the / }).length).toBeGreaterThan(0);
  });
});

describe('a job waiting on a backoff', () => {
  it('says when the next attempt happens, rather than looking stuck', async () => {
    archive.jobs = [
      {
        id: 21,
        kind: 'transcribe',
        state: 'pending',
        audio_uuid: CANCONS,
        attempts: 2,
        error: null,
        created_at: '2026-03-12T09:00:00Z',
        ready_at: new Date(Date.now() + 4 * 60_000).toISOString(),
        started_at: null,
        finished_at: null,
      },
    ];
    show();
    expect(await screen.findByText(/Next attempt in 4 minutes/)).toBeVisible();
  });
});

describe('a finished job', () => {
  it('offers no retry and no cancel, because neither can ever apply', async () => {
    archive.jobs = [
      {
        id: 30,
        kind: 'probe',
        state: 'done',
        audio_uuid: CANCONS,
        attempts: 1,
        error: null,
        created_at: '2026-03-12T09:00:00Z',
        ready_at: '2026-03-12T09:00:00Z',
        started_at: '2026-03-12T09:00:01Z',
        finished_at: '2026-03-12T09:00:04Z',
      },
    ];
    show();
    await screen.findByText('probe');
    expect(screen.queryByRole('button', { name: /^Retry the / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Cancel the / })).toBeNull();
  });
});

describe('an empty queue', () => {
  it('is the healthy case, and looks healthy rather than empty', async () => {
    archive.jobs = [];
    show();
    expect(await screen.findByText('Everything asked for has been done')).toBeVisible();
    expect(screen.getByText('Nothing is waiting, running or failed.')).toBeVisible();
  });
});

describe('four hundred jobs after a bulk import', () => {
  it('shows the count and the newest few, not a wall of rows', async () => {
    archive.jobs = Array.from({ length: 400 }, (_, index) => ({
      id: 1000 + index,
      kind: 'waveform',
      state: 'pending',
      audio_uuid: CANCONS,
      attempts: 1,
      error: null,
      created_at: '2026-03-12T09:00:00Z',
      ready_at: '2026-03-12T09:00:00Z',
      started_at: null,
      finished_at: null,
    }));
    show();
    expect(await screen.findByText(/Showing the newest 25 of 400/)).toBeVisible();
    expect(screen.getAllByText('waveform')).toHaveLength(25);
  });
});

describe('narrowing by state', () => {
  it('asks the instance rather than filtering what is already on screen', async () => {
    show();
    await screen.findByText('The transcription provider did not answer.');
    await userEvent.click(screen.getByRole('button', { name: 'Running' }));
    await waitFor(() => {
      expect(screen.queryByText('The transcription provider did not answer.')).toBeNull();
    });
  });
});
