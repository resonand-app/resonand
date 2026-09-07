/**
 * The archive a view test runs against (`UI-3d`).
 *
 * The fixtures are the prototype's sample data, which was written to be plausible for a Catalan
 * family archive rather than to be easy to type: names with accents, a library shared by somebody
 * else, a recording whose own time is unknown, and all four transcription states present at once.
 * A view that only ever renders `Recording 1` looks finished and breaks on the first real name.
 *
 * It is mutable on purpose. A test that renames a recording and re-reads the list is testing what
 * a person does; handlers that always answered with the same constant would make every mutation
 * test assert on the request body and nothing else.
 *
 * Shapes come from `schema.ts`, so a fixture that stops matching the API is a build failure here
 * -- which is the only thing that keeps a mock honest over a year.
 */

import type { components } from '@/api/schema';

type Schemas = components['schemas'];

export type Library = Schemas['LibrarySummary'];
export type Recording = Schemas['AudioSummary'];
export type RecordingDetail = Schemas['AudioDetail'];
export type Transcript = Schemas['TranscriptDetail'];
export type Account = Schemas['Me'];
export type Instance = Schemas['InstanceState'];

const GABRIEL: Schemas['UserSummary'] = {
  id: 1,
  display_name: 'Gabriel',
  email: 'gabriel@example.test',
};

const MARTA: Schemas['UserSummary'] = { id: 2, display_name: 'Marta', email: 'marta@example.test' };

/** Minutes, as the API counts durations. */
const minutes = (count: number): number => Math.round(count * 60_000);

function library(over: Partial<Library> & Pick<Library, 'uuid' | 'name'>): Library {
  return {
    colour: 'amber',
    description: null,
    deleted_at: null,
    is_personal: false,
    level: 40,
    owner: GABRIEL,
    audio_count: 0,
    total_duration_ms: 0,
    ...over,
  };
}

function recording(
  over: Partial<Recording> & Pick<Recording, 'uuid' | 'title' | 'library_uuid'>,
): Recording {
  return {
    category_id: null,
    created_at: '2026-03-12T09:14:00Z',
    deleted_at: null,
    duration_ms: minutes(3),
    has_waveform: true,
    is_shared_individually: false,
    level: 40,
    notes: null,
    recorded_at: '2026-03-12T18:22:00',
    recorded_at_offset: 60,
    recorded_at_source: 'container',
    tags: [],
    transcription_state: 'done',
    ...over,
  };
}

const TAGS = {
  memoria: { id: 1, name: 'memòria', slug: 'memoria' },
  catala: { id: 2, name: 'català', slug: 'catala' },
  familia: { id: 3, name: 'família', slug: 'familia' },
  musica: { id: 4, name: 'música', slug: 'musica' },
} as const satisfies Record<string, Schemas['TagSummary']>;

/** The state every handler reads. `reset()` puts it back between tests. */
export interface Archive {
  instance: Instance;
  me: Account;
  libraries: Library[];
  recordings: Recording[];
  details: Record<string, Partial<RecordingDetail>>;
  transcripts: Record<string, Transcript>;
  categories: Record<string, Schemas['CategorySummary'][]>;
  shares: Record<string, Schemas['ShareSummary'][]>;
  sessions: Schemas['SessionSummary'][];
  jobs: Schemas['JobSummary'][];
  tags: Schemas['TagSuggestion'][];
  destination: Schemas['TranscriptionDestination'];
}

export const PERSONAL = '11111111-1111-4111-8111-111111111111';
export const AVIA = '22222222-2222-4222-8222-222222222222';
export const ATENEU = '33333333-3333-4333-8333-333333333333';

export const CARRER_NOU = 'aaaaaaaa-0000-4000-8000-000000000001';
export const NADAL = 'aaaaaaaa-0000-4000-8000-000000000002';
export const CANCONS = 'aaaaaaaa-0000-4000-8000-000000000003';
export const NOTA = 'aaaaaaaa-0000-4000-8000-000000000004';
export const ASSAIG = 'aaaaaaaa-0000-4000-8000-000000000005';

function fresh(): Archive {
  return {
    instance: {
      name: 'sonarium',
      version: '0.1.0',
      needs_bootstrap: false,
      trash_retention_days: 30,
      max_upload_bytes: 2 * 1024 * 1024 * 1024,
      accepted_extensions: ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.opus', '.mp4', '.mov'],
      video_extensions: ['.mp4', '.mov'],
    },
    me: {
      id: GABRIEL.id,
      display_name: GABRIEL.display_name,
      email: GABRIEL.email,
      is_admin: true,
      language: null,
    },
    libraries: [
      library({
        uuid: PERSONAL,
        name: 'Personal',
        is_personal: true,
        colour: 'amber',
        audio_count: 84,
        total_duration_ms: minutes(31 * 60 + 12),
      }),
      library({
        uuid: AVIA,
        name: 'Àvia Teresa',
        colour: 'clay',
        description: 'Everything she recorded before she stopped being able to.',
        audio_count: 3,
        total_duration_ms: minutes(2 * 60 + 4),
      }),
      library({
        uuid: ATENEU,
        name: 'Reunions Ateneu',
        colour: 'plum',
        // Shared with this account by somebody else, which is its own group in the sidebar and
        // the reason a view may not assume every library is editable (`UI-4d`).
        owner: MARTA,
        level: 20,
        audio_count: 41,
        total_duration_ms: minutes(9 * 60 + 18),
      }),
    ],
    recordings: [
      recording({
        uuid: CARRER_NOU,
        library_uuid: AVIA,
        title: 'The house on Carrer Nou',
        duration_ms: minutes(48) + 12_000,
        tags: [TAGS.memoria, TAGS.catala],
        notes: 'Recorded at the kitchen table. The radio is on for the first two minutes.',
      }),
      recording({
        uuid: NADAL,
        library_uuid: AVIA,
        title: 'Sopar de Nadal 1998',
        duration_ms: minutes(12) + 7_000,
        tags: [TAGS.familia],
        // A cassette digitised decades later: the file's own date is the day it was digitised,
        // so the interface falls back to `created_at` and says so (§1.3).
        recorded_at: null,
        recorded_at_offset: null,
        recorded_at_source: null,
      }),
      recording({
        uuid: CANCONS,
        library_uuid: AVIA,
        title: 'Cançons que cantava la mare',
        duration_ms: minutes(31) + 55_000,
        tags: [TAGS.musica],
        transcription_state: 'running',
      }),
      recording({
        uuid: NOTA,
        library_uuid: PERSONAL,
        title: 'Nota de veu 12 mar',
        duration_ms: 108_000,
        transcription_state: 'none',
        // Still being processed: no peaks yet, so the waveform is a dashed rule and a duration
        // rather than an invented shape.
        has_waveform: false,
        recorded_at_source: 'filename',
      }),
      recording({
        uuid: ASSAIG,
        library_uuid: PERSONAL,
        title: 'Assaig 4 de febrer',
        duration_ms: minutes(64),
        transcription_state: 'failed',
        recorded_at: '2026-02-04T20:05:00',
        recorded_at_source: 'filesystem',
      }),
    ],
    details: {
      [CARRER_NOU]: {
        original_filename: 'Recording 2026-03-12 18.22.m4a',
        codec: 'aac',
        mime: 'audio/mp4',
        sample_rate: 48_000,
        channels: 1,
        size_bytes: 284 * 1024 * 1024,
        sha256: 'a'.repeat(64),
      },
    },
    transcripts: {
      [CARRER_NOU]: {
        id: 1,
        is_active: true,
        language: 'ca',
        model: 'large-v3',
        provider: 'faster-whisper',
        source: 'machine',
        created_at: '2026-03-12T10:02:00Z',
        segment_count: 6,
        segments: [
          'My mother was born in the village, but she never talked about it much.',
          'I remember the stairs were always cold, even in August.',
          'The house on Carrer Nou had a balcony that looked over the square, and every Sunday my mother would hang the sheets there.',
          'We stayed until the year my grandfather died.',
          'After that nobody wanted to go back.',
          'The building is still there. Somebody painted the shutters green.',
        ].map((text, index) => ({
          idx: index,
          start_ms: minutes(17) + 31_000 + index * 13_000,
          end_ms: minutes(17) + 42_000 + index * 13_000,
          speaker: null,
          text,
        })),
      },
    },
    categories: {
      [AVIA]: [
        { id: 1, name: 'Converses', parent_id: null, position: 0 },
        { id: 2, name: 'Cançons', parent_id: null, position: 1 },
      ],
    },
    shares: {
      [AVIA]: [
        {
          grantee: MARTA,
          level: 20,
          level_description: 'Can add recordings and edit their details.',
          granted_by: GABRIEL.id,
          created_at: '2026-02-01T12:00:00Z',
        },
      ],
    },
    sessions: [
      {
        id: 1,
        created_at: '2026-03-12T08:00:00Z',
        last_seen_at: '2026-03-12T09:30:00Z',
        expires_at: '2026-04-11T08:00:00Z',
        revoked_at: null,
        ip: '192.168.1.20',
        user_agent: 'Firefox on Linux',
        is_current: true,
      },
    ],
    jobs: [
      {
        id: 9,
        kind: 'transcribe',
        state: 'running',
        audio_uuid: CANCONS,
        attempts: 1,
        error: null,
        created_at: '2026-03-12T09:00:00Z',
        ready_at: '2026-03-12T09:00:00Z',
        started_at: '2026-03-12T09:01:00Z',
        finished_at: null,
      },
      {
        id: 8,
        kind: 'transcribe',
        state: 'failed',
        audio_uuid: ASSAIG,
        attempts: 3,
        error: 'The transcription provider did not answer.',
        created_at: '2026-02-04T21:00:00Z',
        ready_at: '2026-02-04T21:00:00Z',
        started_at: '2026-02-04T21:00:10Z',
        finished_at: '2026-02-04T21:04:00Z',
      },
    ],
    tags: Object.values(TAGS).map((tag, index) => ({ tag, uses: 12 - index })),
    destination: {
      provider: 'faster-whisper',
      host: 'whisper',
      is_local: true,
      configured: true,
    },
  };
}

export let archive: Archive = fresh();

/** Put the archive back the way it was. Called between tests. */
export function reset(): void {
  archive = fresh();
}

/** One recording, as the detail view reads it. */
export function detailOf(uuid: string): RecordingDetail | undefined {
  const summary = archive.recordings.find((one) => one.uuid === uuid);
  if (!summary) return undefined;
  return {
    ...summary,
    original_filename: null,
    codec: null,
    mime: null,
    sample_rate: null,
    channels: null,
    size_bytes: null,
    sha256: null,
    uploaded_by: GABRIEL,
    ...archive.details[uuid],
  };
}

export { GABRIEL, MARTA, TAGS };
