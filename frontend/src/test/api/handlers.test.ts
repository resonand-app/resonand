/**
 * The mock instance answers everything the real one does (`UI-3d`).
 *
 * The first test is the one that matters over time: an endpoint added to the API without a
 * handler here is a view test that passes because nothing asked for what it forgot to render.
 * It reads the committed document rather than a list, so there is nothing to keep in step.
 */

import { describe, expect, it } from 'vitest';

import { get, patch, post, put, remove } from '@/api/client';
import { ApiProblem } from '@/api/problem';

import openapi from '@/api/contract/openapi.json';

import {
  CASSETTE,
  FIELD_TAKE,
  INTERVIEW,
  PERSONAL,
  RECORDINGS,
  REHEARSAL,
  VOICE_NOTE,
  archive,
} from './archive';
import { handlers } from './handlers';
import { mockApi } from './server';

mockApi();

/** Every method and path the API publishes, in the form MSW spells them. */
function published(): string[] {
  const paths = openapi.paths as Record<string, Record<string, unknown>>;
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
  return Object.entries(paths).flatMap(([path, operations]) =>
    Object.keys(operations)
      .filter((method) => methods.has(method))
      .map((method) => `${method.toUpperCase()} ${path.replace(/{(\w+)}/g, ':$1')}`),
  );
}

describe('coverage', () => {
  it('has a handler for every documented endpoint', () => {
    const mocked = new Set(
      handlers.map((handler) => `${handler.info.method as string} ${handler.info.path as string}`),
    );
    expect(published().filter((endpoint) => !mocked.has(endpoint))).toEqual([]);
  });

  it('mocks nothing the API does not publish', () => {
    // The other direction, which catches a handler left behind by a renamed endpoint.
    const real = new Set(published());
    const extra = handlers
      .map((handler) => `${handler.info.method as string} ${handler.info.path as string}`)
      .filter((endpoint) => !real.has(endpoint));
    expect(extra).toEqual([]);
  });
});

describe('what a view sees', () => {
  it('answers a real call through the real client', async () => {
    const libraries = await get('/api/libraries');
    expect(libraries.map((one) => one.name)).toContain('Field recordings');
  });

  it('carries the fixtures the views were designed against', async () => {
    // Accents, a library somebody else owns, and all four transcription states at once.
    const page = await get('/api/libraries/{library_uuid}/audio', {
      path: { library_uuid: RECORDINGS },
    });
    expect(page.total).toBe(3);
    const states = new Set(archive.recordings.map((one) => one.transcription_state));
    expect(states).toEqual(new Set(['none', 'running', 'done', 'failed']));
  });

  it('remembers a change, so a mutation test can re-read the list', async () => {
    await patch('/api/audio/{audio_uuid}', {
      path: { audio_uuid: FIELD_TAKE },
      body: { clear_category: false, title: 'A renamed recording' },
    });
    const again = await get('/api/audio/{audio_uuid}', { path: { audio_uuid: FIELD_TAKE } });
    expect(again.title).toBe('A renamed recording');
  });

  it('lists favourites across libraries, newest mark first, as API-27 does', async () => {
    await put('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: VOICE_NOTE } });
    await put('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: FIELD_TAKE } });
    const page = await get('/api/audio', {
      query: { favourite: true, sort: 'favourited_at' },
    });
    expect(page.items.map((one) => one.uuid)).toEqual([FIELD_TAKE, VOICE_NOTE]);
    const refused = (await get('/api/audio', { query: { sort: 'favourited_at' } }).catch(
      (error: unknown) => error,
    )) as ApiProblem;
    expect(refused.status).toBe(400);
  });

  it('orders every recording by any sort the API takes, in either direction', async () => {
    const live = archive.recordings.filter((one) => one.deleted_at === null);
    const titles = live.map((one) => one.title).sort((a, b) => a.localeCompare(b));
    const byTitle = await get('/api/audio', { query: { sort: 'title', direction: 'asc' } });
    expect(byTitle.items.map((one) => one.title)).toEqual(titles);
    const longest = await get('/api/audio', { query: { sort: 'duration_ms', direction: 'desc' } });
    const durations = longest.items.map((one) => one.duration_ms);
    const known = durations.filter((one) => one !== null);
    expect(known).toEqual([...known].sort((a, b) => b - a));
    expect(durations.slice(known.length).every((one) => one === null)).toBe(true);
  });

  it('refuses the way the API refuses', async () => {
    const problem = (await get('/api/audio/{audio_uuid}', {
      path: { audio_uuid: 'nope' },
    }).catch((error: unknown) => error)) as ApiProblem;
    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.isMissing).toBe(true);
    expect(problem.detail).not.toContain('permission');
  });

  it('answers 409 when a transcription is already running, which is a state and not an error', async () => {
    const problem = (await post('/api/audio/{audio_uuid}/transcribe', {
      path: { audio_uuid: REHEARSAL },
      body: { language: null },
    }).catch((error: unknown) => error)) as ApiProblem;
    expect(problem.isConflict).toBe(true);
  });

  it('treats a repeated filter as a union rather than as the last one', async () => {
    // JOB-11b. Taking the last value instead of all of them shows a plausible, wrong list.
    const page = await get('/api/libraries/{library_uuid}/audio', {
      path: { library_uuid: PERSONAL },
      query: { transcription_state: ['none', 'failed'] },
    });
    expect(page.items.map((one) => one.transcription_state).sort()).toEqual(['failed', 'none']);
  });

  it('starts each test from the same archive', () => {
    expect(archive.recordings.find((one) => one.uuid === FIELD_TAKE)?.title).toBe(
      'Field recording, long take',
    );
  });
});

describe('the trash as a whole', () => {
  /** The library of three in the trash, one of its recordings trashed before it, and a note after. */
  function trashSome() {
    const at: Record<string, string> = {
      [CASSETTE]: '2026-10-01T10:00:00.000Z',
      [RECORDINGS]: '2026-10-02T10:00:00.000Z',
      [VOICE_NOTE]: '2026-10-03T10:00:00.000Z',
    };
    archive.libraries = archive.libraries.map((one) => ({
      ...one,
      deleted_at: at[one.uuid] ?? one.deleted_at,
    }));
    archive.recordings = archive.recordings.map((one) => ({
      ...one,
      deleted_at: at[one.uuid] ?? one.deleted_at,
    }));
  }

  it('counts a recording reached through its library and on its own once', async () => {
    trashSome();
    const summary = await get('/api/trash/summary');
    expect(summary).toMatchObject({ recordings: 4, libraries: 1 });
  });

  it('skips what it could not destroy, and destroys a library with what it holds', async () => {
    trashSome();
    const result = await post('/api/trash/purge', {
      body: { library_uuids: [RECORDINGS], audio_uuids: [CASSETTE, INTERVIEW, 'nope'] },
    });
    expect(result.destroyed).toMatchObject({ recordings: 3, libraries: 1 });
    expect(result.skipped).toEqual([INTERVIEW, 'nope']);
    expect(archive.recordings.map((one) => one.uuid)).toEqual([VOICE_NOTE, INTERVIEW]);
    expect(archive.libraries.map((one) => one.uuid)).not.toContain(RECORDINGS);
  });

  it('leaves what was trashed after the instant it was given', async () => {
    trashSome();
    const emptied = await remove('/api/trash', {
      query: { trashed_before: '2026-10-02T12:00:00.000Z' },
    });
    expect(emptied).toMatchObject({ recordings: 3, libraries: 1 });
    expect(archive.recordings.map((one) => one.uuid)).toEqual([VOICE_NOTE, INTERVIEW]);
  });
});
