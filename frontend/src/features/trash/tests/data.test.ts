/**
 * One list out of two, in the order that matters (`INT-1a`, `INT-1b`, §V9).
 *
 * The merge is where the screen's two central claims live -- one list rather than two sections,
 * and a trashed library's children grouped under it -- so they are tested as rules, without a
 * network or a frame in the way.
 */

import { describe, expect, it } from 'vitest';

import type { components } from '@/api/contract/schema';

import { merge } from '../data';

type Schemas = components['schemas'];

function library(uuid: string, deletedAt: string): Schemas['LibrarySummary'] {
  return {
    uuid,
    name: uuid,
    description: null,
    is_personal: false,
    owner: { id: 1, display_name: 'Alex Morgan', email: 'alex@example.test' },
    level: 40,
    colour: 'amber',
    audio_count: 3,
    total_duration_ms: 60_000,
    deleted_at: deletedAt,
  };
}

function recording(uuid: string, libraryUuid: string, deletedAt: string): Schemas['AudioSummary'] {
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
    level: 40,
    recorded_at: null,
    recorded_at_offset: null,
    recorded_at_source: null,
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: deletedAt,
  };
}

describe('one list rather than two sections', () => {
  it('puts what is closest to being purged first, across both kinds', () => {
    const entries = merge(
      [library('lib-late', '2026-03-10T00:00:00Z')],
      [recording('rec-early', 'live-library', '2026-03-01T00:00:00Z')],
    );
    expect(entries.map((one) => one.kind)).toEqual(['recording', 'library']);
  });

  it('carries the deletion instant on every row, whatever kind it is', () => {
    const entries = merge(
      [library('lib', '2026-03-10T00:00:00Z')],
      [recording('rec', 'live-library', '2026-03-01T00:00:00Z')],
    );
    expect(entries.every((one) => one.deletedAt !== '')).toBe(true);
  });
});

describe('a trashed library and its children', () => {
  it('groups a trashed recording under its trashed library instead of listing it twice', () => {
    const entries = merge(
      [library('lib', '2026-03-10T00:00:00Z')],
      [recording('child', 'lib', '2026-03-11T00:00:00Z')],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('library');
    expect(entries[0]?.kind === 'library' && entries[0].children.map((one) => one.uuid)).toEqual([
      'child',
    ]);
  });

  it('leaves a recording trashed out of a living library at the top level', () => {
    // Its library is not going anywhere, so saying so would be noise -- and it is not the case
    // `INT-1b` exists to answer.
    const entries = merge([], [recording('rec', 'still-here', '2026-03-01T00:00:00Z')]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('recording');
  });

  it('shows a trashed library with nothing separately trashed inside it as one plain row', () => {
    const entries = merge([library('lib', '2026-03-10T00:00:00Z')], []);
    expect(entries[0]?.kind === 'library' && entries[0].children).toEqual([]);
  });
});
