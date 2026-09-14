/**
 * The archive a view test runs against (`UI-3d`).
 *
 * The fixtures are deliberately generic, and deliberately not uniform: a library shared by
 * somebody else, a recording whose own time is unknown, a recording with no waveform yet, one
 * title long enough to wrap, and all four transcription states present at once. A view that only
 * ever renders `Recording 1` looks finished and breaks on the first row that is not like it.
 *
 * It is mutable on purpose. A test that renames a recording and re-reads the list is testing what
 * a person does; handlers that always answered with the same constant would make every mutation
 * test assert on the request body and nothing else.
 *
 * Shapes come from `schema.ts`, so a fixture that stops matching the API is a build failure here
 * -- which is the only thing that keeps a mock honest over a year.
 */

import type { components } from '@/api/contract/schema';

type Schemas = components['schemas'];

export type Library = Schemas['LibrarySummary'];
export type Recording = Schemas['AudioSummary'];
export type RecordingDetail = Schemas['AudioDetail'];
export type Transcript = Schemas['TranscriptDetail'];
export type Account = Schemas['Me'];
export type Instance = Schemas['InstanceState'];
export type AdminUser = Schemas['AdminUser'];

const ALEX: Schemas['UserSummary'] = {
  id: 1,
  display_name: 'Alex Morgan',
  email: 'alex@example.test',
};

const SAM: Schemas['UserSummary'] = {
  id: 2,
  display_name: 'Sam Rivera',
  email: 'sam@example.test',
};

/** Minutes, as the API counts durations. */
const minutes = (count: number): number => Math.round(count * 60_000);

function library(over: Partial<Library> & Pick<Library, 'uuid' | 'name'>): Library {
  return {
    colour: 'amber',
    description: null,
    deleted_at: null,
    is_personal: false,
    level: 40,
    owner: ALEX,
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
  field: { id: 1, name: 'field', slug: 'field' },
  outdoor: { id: 2, name: 'outdoor', slug: 'outdoor' },
  music: { id: 3, name: 'music', slug: 'music' },
  interview: { id: 4, name: 'interview', slug: 'interview' },
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
  /** Grants made on one recording, by its uuid. Inherited ones are resolved from the library. */
  recordingShares: Record<string, Schemas['ShareSummary'][]>;
  sessions: Schemas['SessionSummary'][];
  /**
   * Every account, as administration sees it (`API-20`, `INT-3b`).
   *
   * Separate from `accounts`, which is who the mock will let sign in. This is the list
   * administration draws, and it carries the two facts a sign-in does not need and `INT-3b`
   * cannot work without: who runs the instance, and who is already disabled.
   */
  users: AdminUser[];
  jobs: Schemas['JobSummary'][];
  tags: Schemas['TagSuggestion'][];
  destination: Schemas['TranscriptionDestination'];
  /** `GET /search/about`'s one sentence, in the words `recall_note()` writes it. */
  recall: string;
  /**
   * Who can sign in (`UI-21`, §V1).
   *
   * Three accounts rather than one, because V1's central claim is that an unknown address, a
   * wrong password and a disabled account are indistinguishable -- and a mock that knew only one
   * account could not tell those three situations apart to begin with, so a test asserting they
   * read the same would be asserting nothing.
   */
  accounts: SignInAccount[];
  /**
   * Sign-in attempts per address since the last reset (`INT-5`).
   *
   * Per address and not per connection, which is the fact V1 has to state: the instance counts
   * against the email somebody typed, so trying a second password from a second tab is the same
   * counter. Reset between tests, or the eleventh test to sign in would be rate limited.
   */
  attempts: Record<string, number>;
}

/** An account the mock instance will let in, or deliberately will not. */
export interface SignInAccount {
  email: string;
  password: string;
  disabled: boolean;
}

/** The password every fixture account has. Long enough to pass the ten-character minimum. */
export const PASSWORD = 'remembering-well';

/** How many sign-in attempts an address gets, as `login_attempts_per_minute` defaults. */
export const LOGIN_ATTEMPTS_PER_MINUTE = 10;

/** An address with no account behind it, for the failure that must look like the other two. */
export const NOBODY = 'nobody@example.test';

export const PERSONAL = '11111111-1111-4111-8111-111111111111';
export const RECORDINGS = '22222222-2222-4222-8222-222222222222';
export const MEETINGS = '33333333-3333-4333-8333-333333333333';

export const FIELD_TAKE = 'aaaaaaaa-0000-4000-8000-000000000001';
export const CASSETTE = 'aaaaaaaa-0000-4000-8000-000000000002';
export const REHEARSAL = 'aaaaaaaa-0000-4000-8000-000000000003';
export const VOICE_NOTE = 'aaaaaaaa-0000-4000-8000-000000000004';
export const INTERVIEW = 'aaaaaaaa-0000-4000-8000-000000000005';

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
      id: ALEX.id,
      display_name: ALEX.display_name,
      email: ALEX.email,
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
        uuid: RECORDINGS,
        name: 'Field recordings',
        colour: 'clay',
        description: 'Everything recorded outside, kept in one place.',
        audio_count: 3,
        total_duration_ms: minutes(2 * 60 + 4),
      }),
      library({
        uuid: MEETINGS,
        name: 'Meetings',
        colour: 'plum',
        // Shared with this account by somebody else, which is its own group in the sidebar and
        // the reason a view may not assume every library is editable (`UI-4d`).
        owner: SAM,
        level: 20,
        audio_count: 41,
        total_duration_ms: minutes(9 * 60 + 18),
      }),
    ],
    recordings: [
      recording({
        uuid: FIELD_TAKE,
        library_uuid: RECORDINGS,
        title: 'Field recording, long take',
        duration_ms: minutes(48) + 12_000,
        tags: [TAGS.field, TAGS.outdoor],
        notes: 'Recorded at the kitchen table. The radio is on for the first two minutes.',
      }),
      recording({
        uuid: CASSETTE,
        library_uuid: RECORDINGS,
        title: 'Digitised cassette',
        duration_ms: minutes(12) + 7_000,
        tags: [TAGS.music],
        // A cassette digitised decades later: the file's own date is the day it was digitised,
        // so the interface falls back to `created_at` and says so (§1.3).
        recorded_at: null,
        recorded_at_offset: null,
        recorded_at_source: null,
      }),
      recording({
        uuid: REHEARSAL,
        library_uuid: RECORDINGS,
        title: 'Rehearsal, second take',
        duration_ms: minutes(31) + 55_000,
        tags: [TAGS.interview],
        transcription_state: 'running',
      }),
      recording({
        uuid: VOICE_NOTE,
        library_uuid: PERSONAL,
        title: 'Short voice note',
        duration_ms: 108_000,
        transcription_state: 'none',
        // Still being processed: no peaks yet, so the waveform is a dashed rule and a duration
        // rather than an invented shape.
        has_waveform: false,
        recorded_at_source: 'filename',
      }),
      recording({
        uuid: INTERVIEW,
        library_uuid: PERSONAL,
        title: 'Interview 02, raw',
        duration_ms: minutes(64),
        transcription_state: 'failed',
        recorded_at: '2026-02-04T20:05:00',
        recorded_at_source: 'filesystem',
      }),
    ],
    details: {
      [FIELD_TAKE]: {
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
      [FIELD_TAKE]: {
        id: 1,
        is_active: true,
        language: 'en',
        model: 'large-v3',
        provider: 'faster-whisper',
        source: 'machine',
        created_at: '2026-03-12T10:02:00Z',
        segment_count: 6,
        segments: [
          'The first segment of the transcript, which is where playback starts.',
          'The second segment, long enough to wrap onto a second line in the panel.',
          'The third segment mentions rehearsal, which is the word search is asked for.',
          'The fourth segment is a short one.',
          'The fifth segment is the one a click seeks to.',
          'The sixth segment, and the last one in this transcript.',
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
      [RECORDINGS]: [
        { id: 1, name: 'Interviews', parent_id: null, position: 0 },
        { id: 2, name: 'Fieldwork', parent_id: null, position: 1 },
      ],
    },
    recordingShares: {},
    shares: {
      [RECORDINGS]: [
        {
          grantee: SAM,
          level: 20,
          // The wording `sonarium.core.levels.DESCRIPTIONS` sends, colon and all: `LevelSelector`
          // splits on it to draw the name and the sentence, and a fixture worded differently
          // would test a split that never happens.
          level_description: 'Can edit: change titles, categories and tags, but not share.',
          granted_by: ALEX.id,
          created_at: '2026-02-01T12:00:00Z',
          source: 'library',
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
      // A second device, so `UI-20c`'s "sign out everywhere else" has something to do -- and a
      // third with no user agent at all, which is the state the panel must show rather than
      // guess at. A fixture with one session could not tell either apart from the other.
      {
        id: 2,
        created_at: '2026-03-01T19:12:00Z',
        last_seen_at: '2026-03-11T22:40:00Z',
        expires_at: '2026-03-31T19:12:00Z',
        revoked_at: null,
        ip: '10.0.0.4',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15',
        is_current: false,
      },
      {
        id: 3,
        created_at: '2026-02-20T07:05:00Z',
        last_seen_at: '2026-02-20T07:06:00Z',
        expires_at: '2026-03-22T07:05:00Z',
        revoked_at: null,
        ip: null,
        user_agent: null,
        is_current: false,
      },
    ],
    jobs: [
      {
        id: 9,
        kind: 'transcribe',
        state: 'running',
        audio_uuid: REHEARSAL,
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
        audio_uuid: INTERVIEW,
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
    users: [
      { ...ALEX, is_admin: true, disabled_at: null, created_at: '2025-11-02T09:00:00Z' },
      {
        ...SAM,
        is_admin: false,
        disabled_at: '2026-01-18T08:30:00Z',
        created_at: '2025-12-14T18:20:00Z',
      },
    ],
    accounts: [
      { email: ALEX.email, password: PASSWORD, disabled: false },
      { email: SAM.email, password: PASSWORD, disabled: true },
    ],
    attempts: {},
    recall:
      'Search ignores accents and matches the start of the last word you type. It does not ' +
      'know that words are related: searching for one form of a word will not find its other ' +
      'forms.',
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
    uploaded_by: ALEX,
    ...archive.details[uuid],
  };
}

export { ALEX, SAM, TAGS };
