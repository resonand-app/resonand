/**
 * One recording, its matches, and the count of the ones not shown (`UI-16d`, `DEC-4`).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { usePlayback } from '@/player/store';
import { AVIA } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { Results } from '../Results';
import type { SearchResult } from '../data';

mockApi();

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

const RECORDING = {
  uuid: 'audio-1',
  title: 'Sopar de Nadal 1998',
  library_uuid: AVIA,
  category_id: null,
  created_at: '2026-03-12T09:14:00Z',
  deleted_at: null,
  duration_ms: 180_000,
  has_waveform: true,
  is_shared_individually: false,
  level: 40,
  notes: null,
  recorded_at: '1998-12-24T21:30:00',
  recorded_at_offset: 60,
  recorded_at_source: 'container',
  tags: [],
  transcription_state: 'done',
};

function result(over: Partial<SearchResult> = {}): SearchResult {
  return {
    audio: RECORDING,
    total_matches: 3,
    matches: [
      { kind: 'transcript', fragment: 'la <mark>casa</mark> del carrer', start_ms: 61_000 },
    ],
    ...over,
  } as SearchResult;
}

function show(results: SearchResult[]) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/search']}>
        <Where />
        <Routes>
          <Route path="*" element={<Results results={results} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('playing from a match', () => {
  it('🧪 starts the recording at that moment and does not change the route (`UI-16e`)', async () => {
    // The whole reason this screen exists: you found the moment, you heard it, you keep looking.
    // Opening the detail view would defeat it, so the route is the assertion.
    usePlayback.getState().stop();
    show([result()]);
    await userEvent.click(screen.getByText(/del carrer/));
    expect(usePlayback.getState().recording?.uuid).toBe('audio-1');
    expect(usePlayback.getState().positionMs).toBe(61_000);
    expect(screen.getByTestId('where')).toHaveTextContent('/search');
  });

  it('seeks what is already playing rather than loading it again', async () => {
    show([result()]);
    usePlayback.getState().play({
      uuid: 'audio-1',
      title: 'Sopar de Nadal 1998',
      library: 'Àvia Teresa',
      durationMs: 180_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing', positionMs: 5_000 });
    await userEvent.click(screen.getByText(/del carrer/));
    expect(usePlayback.getState().status).toBe('playing');
    expect(usePlayback.getState().positionMs).toBe(61_000);
  });
});

describe("a match in the recording's details", () => {
  it('says what it is instead of offering a play it cannot perform (`UI-16f`)', () => {
    // A title has no moment in a recording. A disabled play button would read as the interface
    // failing to load something; saying where the match is reads as an answer.
    show([
      result({
        matches: [
          { kind: 'metadata', fragment: 'Sopar de <mark>Nadal</mark> 1998', start_ms: null },
        ],
      }),
    ]);
    const row = screen.getByText('In the details').parentElement;
    expect(row).toBeInTheDocument();
    // Nothing to press: not a button, not a transcript line, and no tab stop to land on.
    expect(row?.closest('[role="button"]')).toBeNull();
    expect(row?.closest('[data-ds="transcript-line"]')).toBeNull();
  });

  it('is in the same ranked list as the transcript matches, not a section of its own', () => {
    show([
      result({
        total_matches: 2,
        matches: [
          { kind: 'transcript', fragment: 'la <mark>casa</mark> del carrer', start_ms: 61_000 },
          { kind: 'metadata', fragment: 'Sopar de <mark>Nadal</mark>', start_ms: null },
        ],
      }),
    ]);
    expect(screen.getByText('01:01')).toBeInTheDocument();
    expect(screen.getByText('In the details')).toBeInTheDocument();
  });
});

describe('a result', () => {
  it('says where the recording lives, because results span libraries', async () => {
    show([result()]);
    expect(await screen.findByText(/Àvia Teresa/)).toBeInTheDocument();
  });

  it('renders the marking the database put in the fragment', () => {
    show([result()]);
    expect(screen.getByText('casa').tagName).toBe('MARK');
  });

  it('gives each match the moment it is at, as a place rather than a length', () => {
    show([result()]);
    expect(screen.getByText('01:01')).toBeInTheDocument();
  });

  it('counts the matches that were not sent, and opens the recording to reach them', async () => {
    // The API groups the matches and sends the best three with `total_matches` beside them, so
    // there is no fourth line on this screen to reveal -- "+2 more" goes to the transcript.
    show([result({ total_matches: 3 })]);
    await userEvent.click(screen.getByRole('button', { name: /\+2 more/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/recording/audio-1');
  });

  it('offers no count when every match it has is on the screen', () => {
    show([result({ total_matches: 1 })]);
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });
});
