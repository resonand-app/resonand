/**
 * The mock instance answers everything the real one does (`UI-3d`).
 *
 * The first test is the one that matters over time: an endpoint added to the API without a
 * handler here is a view test that passes because nothing asked for what it forgot to render.
 * It reads the committed document rather than a list, so there is nothing to keep in step.
 */

import { describe, expect, it } from 'vitest';

import { get, patch, post } from '@/api/client';
import { ApiProblem } from '@/api/problem';

import openapi from '@/api/openapi.json';

import { AVIA, CANCONS, CARRER_NOU, PERSONAL, archive } from './archive';
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
    expect(libraries.map((one) => one.name)).toContain('Àvia Teresa');
  });

  it('carries the fixtures the views were designed against', async () => {
    // Accents, a library somebody else owns, and all four transcription states at once.
    const page = await get('/api/libraries/{library_uuid}/audio', {
      path: { library_uuid: AVIA },
    });
    expect(page.total).toBe(3);
    const states = new Set(archive.recordings.map((one) => one.transcription_state));
    expect(states).toEqual(new Set(['none', 'running', 'done', 'failed']));
  });

  it('remembers a change, so a mutation test can re-read the list', async () => {
    await patch('/api/audio/{audio_uuid}', {
      path: { audio_uuid: CARRER_NOU },
      body: { clear_category: false, title: 'La casa del carrer Nou' },
    });
    const again = await get('/api/audio/{audio_uuid}', { path: { audio_uuid: CARRER_NOU } });
    expect(again.title).toBe('La casa del carrer Nou');
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
      path: { audio_uuid: CANCONS },
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
    expect(archive.recordings.find((one) => one.uuid === CARRER_NOU)?.title).toBe(
      'The house on Carrer Nou',
    );
  });
});
