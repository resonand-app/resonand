/**
 * What a selection in the trash destroys, counted the way `API-28` counts it (`INT-8`).
 */

import { describe, expect, it } from 'vitest';

import type { components } from '@/api/contract/schema';

import { merge } from '../data';
import { coverage, doomed, everything, present } from '../selection';

type Schemas = components['schemas'];

const WHEN = '2026-03-01T00:00:00Z';

function library(uuid: string, audioCount: number): Schemas['LibrarySummary'] {
  return {
    uuid,
    name: uuid,
    description: null,
    is_personal: false,
    owner: { id: 1, display_name: 'Alex Morgan', email: 'alex@example.test' },
    level: 40,
    colour: 'amber',
    audio_count: audioCount,
    total_duration_ms: audioCount * 60_000,
    deleted_at: WHEN,
  };
}

function recording(uuid: string, libraryUuid: string): Schemas['AudioSummary'] {
  return {
    uuid,
    library_uuid: libraryUuid,
    title: uuid,
    notes: null,
    category_id: null,
    tags: [],
    duration_ms: 60_000,
    has_waveform: true,
    transcription_state: 'none',
    is_shared_individually: false,
    is_favourite: false,
    level: 40,
    recorded_at: null,
    recorded_at_offset: null,
    recorded_at_source: null,
    recorded_at_precision: null,
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: WHEN,
  };
}

/** A trashed library of two live recordings and one trashed on its own, and a loose recording. */
const entries = merge(
  [library('archive', 2)],
  [recording('inside', 'archive'), recording('loose', 'live')],
);

describe('what a selection destroys', () => {
  it('counts a library and a recording inside it once, and sends the recording with it', () => {
    const going = doomed(new Set(['inside', 'archive']), entries);
    expect(going.tally).toEqual({ recordings: 3, libraries: 1 });
    expect(going.body).toEqual({ library_uuids: ['archive'], audio_uuids: [] });
  });

  it('sends a recording on its own when its library is not selected', () => {
    expect(doomed(new Set(['inside']), entries).body).toEqual({
      library_uuids: [],
      audio_uuids: ['inside'],
    });
  });
});

describe('the selection itself', () => {
  it('selects everything at the top level, which the bulk bar reads as all', () => {
    const all = everything(entries);
    expect([...all].sort()).toEqual(['archive', 'loose']);
    expect(coverage(all, entries)).toBe(true);
    expect(coverage(new Set(['loose']), entries)).toBe('mixed');
  });

  it('forgets what has left the trash', () => {
    expect([...present(new Set(['loose', 'gone']), entries)]).toEqual(['loose']);
  });
});
