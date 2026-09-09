/**
 * What the instance reports about itself (`INT-3e`, §V10).
 *
 * One claim carries this file: when the database revision and the one the build expects
 * disagree, that has to be the loudest thing on the page -- and when they agree it has to be one
 * quiet row, because a banner that is always there is a banner nobody reads.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { mockApi, server } from '@/test/api/server';

import { SystemStatus } from './SystemStatus';

mockApi();

/** The status endpoint answering with whichever revisions a test needs. */
function revisions(at: string | null, expected: string | null) {
  server.use(
    http.get('/api/admin/status', () =>
      HttpResponse.json({
        version: '0.1.0',
        database_revision: at,
        expected_revision: expected,
        trash_retention_days: 30,
        jobs: { pending: 0, running: 0, failed: 0 },
        storage: {
          libraries: 3,
          recordings: 84,
          trashed_recordings: 2,
          total_duration_ms: 149 * 3_600_000,
          originals_bytes: 1024 * 1024 * 1024,
          derived_bytes: 1024 * 1024 * 512,
          database_bytes: 24 * 1024 * 1024,
          free_bytes: null,
        },
        transcription: {
          provider: 'faster-whisper',
          base_url: 'http://whisper:8000/v1',
          model: 'large-v3',
          default_language: null,
          configured: true,
          has_credential: false,
          reachable: null,
          detail: '',
        },
      }),
    ),
  );
}

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <SystemStatus />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the revision comparison', () => {
  it('is the loudest thing on the page when the two disagree', async () => {
    revisions('0001_initial', '0007_transcripts');
    show();
    const alarm = await screen.findByRole('alert');
    expect(alarm).toHaveTextContent('The database is not where this build expects it');
    // Both numbers, because which direction they differ in is what decides whether to migrate
    // or to roll the image back.
    expect(alarm).toHaveTextContent('0001_initial');
    expect(alarm).toHaveTextContent('0007_transcripts');
    expect(alarm).toHaveTextContent(/may fail or lose data/);
  });

  it('is one quiet row when they agree, not a banner nobody reads', async () => {
    revisions('0007_transcripts', '0007_transcripts');
    show();
    expect(await screen.findByText('0007_transcripts')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats an unknown revision as a mismatch rather than as agreement', async () => {
    // A database that reports nothing is not a database that matches; saying so is the whole
    // point of comparing them.
    revisions(null, '0007_transcripts');
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not where this build expects it/);
  });
});

describe('what the archive is holding', () => {
  it('reports the counts and the bytes as facts in one column', async () => {
    revisions('0007_transcripts', '0007_transcripts');
    show();
    expect(await screen.findByText('Recordings')).toBeVisible();
    expect(screen.getByText('84')).toBeVisible();
    expect(screen.getByText('Free space')).toBeVisible();
  });

  it('says free space is not reported rather than showing it as zero', async () => {
    revisions('0007_transcripts', '0007_transcripts');
    show();
    expect(await screen.findByText('Not reported')).toBeVisible();
  });
});
