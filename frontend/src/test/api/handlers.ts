/**
 * The instance a view test talks to (`UI-3d`).
 *
 * Every documented endpoint has a handler, and `handlers.test.ts` fails when one appears that
 * does not -- an endpoint added later without a mock is a view test that passes because nothing
 * asked for the thing it forgot to render.
 *
 * The handlers read and write `archive`, so a test can rename a recording and re-read the list.
 * They are deliberately shallow about everything else: filters that a view actually sets are
 * applied, and the rest of the query string is accepted and ignored. A mock that reimplemented
 * the ACL would be a second implementation of the thing the backend's own tests already hold,
 * and it would be the one that drifted.
 *
 * Failures are the API's own shape, because §1.9 is what the views are written against and a
 * mock that answered a bare 404 would let a view render an error the product never sends.
 */

import { HttpResponse, http } from 'msw';
import type { HttpHandler } from 'msw';

import type { components } from '@/api/schema';

import { GABRIEL, MARTA, archive, detailOf } from './archive';

type Schemas = components['schemas'];

/** A page of a collection, in the envelope every list endpoint answers with. */
function page<Item>(
  items: Item[],
  url: URL,
): { items: Item[]; total: number; limit: number; offset: number } {
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

/** A failure, exactly as the API writes one (§1.9). */
function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  const titles: Record<number, string> = {
    400: 'Invalid request',
    401: 'Not signed in',
    404: 'Not found',
    409: 'Conflict',
    422: 'Invalid request',
  };
  return HttpResponse.json(
    {
      type: `/errors/${status === 404 ? 'not_found' : 'error'}`,
      title: titles[status] ?? 'Error',
      detail,
      status,
      request_id: 'test-request',
      ...extra,
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** What the API says about anything the caller may not read, or that is not there (`DEC-14`). */
const NOT_FOUND = () => problem(404, 'There is no such thing here, or it is not yours.');

/** Answer with a thing, or with the 404 that covers both "gone" and "not yours" (`DEC-14`). */
function found(value: unknown): Response {
  return value === undefined ? NOT_FOUND() : HttpResponse.json(value);
}

export const handlers: HttpHandler[] = [
  // --- What this instance is, and who is asking -----------------------------

  http.get('/api/instance', () => HttpResponse.json(archive.instance)),
  http.get('/api/auth/me', () => HttpResponse.json(archive.me)),
  http.patch('/api/auth/me', async ({ request }) => {
    const body = (await request.json()) as Schemas['UpdateMe'];
    if (body.email === 'taken@example.test') {
      return problem(409, 'Another account already uses that address.');
    }
    archive.me = {
      ...archive.me,
      ...(body.display_name ? { display_name: body.display_name } : {}),
      ...(body.email ? { email: body.email } : {}),
      ...(body.clear_language ? { language: null } : {}),
      ...(body.language ? { language: body.language } : {}),
    };
    return HttpResponse.json(archive.me);
  }),
  http.post('/api/auth/password', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/auth/bootstrap', () => HttpResponse.json(archive.me, { status: 201 })),
  http.post('/api/auth/session', async ({ request }) => {
    const body = (await request.json()) as Schemas['SignIn'];
    if (body.password === 'wrong') return problem(401, 'That address and password do not match.');
    return HttpResponse.json(archive.me);
  }),
  http.delete('/api/auth/session', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/auth/sessions', () => HttpResponse.json(archive.sessions)),
  http.delete('/api/auth/sessions/:session_id', ({ params }) => {
    archive.sessions = archive.sessions.filter((one) => String(one.id) !== params.session_id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete('/api/auth/sessions', () => {
    archive.sessions = archive.sessions.filter((one) => one.is_current);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Libraries ------------------------------------------------------------

  http.get('/api/libraries', () =>
    HttpResponse.json(archive.libraries.filter((one) => one.deleted_at === null)),
  ),
  http.post('/api/libraries', async ({ request }) => {
    const body = (await request.json()) as Required<Schemas['CreateLibrary']>;
    if (archive.libraries.some((one) => one.name === body.name)) {
      return problem(409, `You already have a library called ${body.name}.`);
    }
    const made: Schemas['LibrarySummary'] = {
      uuid: `made-${String(archive.libraries.length)}`,
      name: body.name,
      description: body.description ?? null,
      colour: body.colour,
      deleted_at: null,
      is_personal: false,
      level: 40,
      owner: GABRIEL,
      audio_count: 0,
      total_duration_ms: 0,
    };
    archive.libraries = [...archive.libraries, made];
    return HttpResponse.json(made, { status: 201 });
  }),
  http.get('/api/libraries/:library_uuid', ({ params }) =>
    found(archive.libraries.find((one) => one.uuid === params.library_uuid)),
  ),
  http.patch('/api/libraries/:library_uuid', async ({ params, request }) => {
    const body = (await request.json()) as Schemas['UpdateLibrary'];
    const existing = archive.libraries.find((one) => one.uuid === params.library_uuid);
    if (!existing) return NOT_FOUND();
    const updated = {
      ...existing,
      ...(body.name ? { name: body.name } : {}),
      ...(body.colour ? { colour: body.colour } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    };
    archive.libraries = archive.libraries.map((one) => (one === existing ? updated : one));
    return HttpResponse.json(updated);
  }),
  http.delete('/api/libraries/:library_uuid', ({ params }) => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === params.library_uuid ? { ...one, deleted_at: '2026-03-12T10:00:00Z' } : one,
    );
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/libraries/:library_uuid/restore', ({ params }) => {
    const restored = archive.libraries.find((one) => one.uuid === params.library_uuid);
    if (!restored) return NOT_FOUND();
    archive.libraries = archive.libraries.map((one) =>
      one === restored ? { ...one, deleted_at: null } : one,
    );
    return HttpResponse.json({ ...restored, deleted_at: null });
  }),
  http.get('/api/libraries/:library_uuid/audio', ({ params, request }) => {
    const url = new URL(request.url);
    const inside = archive.recordings.filter(
      (one) => one.library_uuid === params.library_uuid && one.deleted_at === null,
    );
    return HttpResponse.json(page(applyFilters(inside, url), url));
  }),
  http.post('/api/libraries/:library_uuid/audio', ({ params }) => {
    const first = archive.recordings[0];
    if (!first) return NOT_FOUND();
    const made = {
      ...first,
      uuid: `uploaded-${String(archive.recordings.length)}`,
      title: 'Uploaded recording',
      library_uuid: String(params.library_uuid),
      transcription_state: 'none',
      has_waveform: false,
    };
    archive.recordings = [made, ...archive.recordings];
    return HttpResponse.json(made, { status: 201 });
  }),
  http.get('/api/libraries/:library_uuid/categories', ({ params }) =>
    HttpResponse.json(archive.categories[String(params.library_uuid)] ?? []),
  ),
  http.post('/api/libraries/:library_uuid/categories', async ({ params, request }) => {
    const body = (await request.json()) as Schemas['CreateCategory'];
    const key = String(params.library_uuid);
    const existing = archive.categories[key] ?? [];
    const made = {
      id: existing.length + 1,
      name: body.name,
      parent_id: body.parent_id ?? null,
      position: existing.length,
    };
    archive.categories = { ...archive.categories, [key]: [...existing, made] };
    return HttpResponse.json(made, { status: 201 });
  }),
  http.patch(
    '/api/libraries/:library_uuid/categories/:category_id',
    async ({ params, request }) => {
      const body = (await request.json()) as Schemas['UpdateCategory'];
      const key = String(params.library_uuid);
      const existing = archive.categories[key] ?? [];
      const found_ = existing.find((one) => String(one.id) === params.category_id);
      if (!found_) return NOT_FOUND();
      const updated = { ...found_, ...(body.name ? { name: body.name } : {}) };
      archive.categories = {
        ...archive.categories,
        [key]: existing.map((one) => (one === found_ ? updated : one)),
      };
      return HttpResponse.json(updated);
    },
  ),
  http.post('/api/libraries/:library_uuid/categories/order', ({ params }) =>
    HttpResponse.json(archive.categories[String(params.library_uuid)] ?? []),
  ),
  http.delete('/api/libraries/:library_uuid/categories/:category_id', ({ params }) => {
    const key = String(params.library_uuid);
    archive.categories = {
      ...archive.categories,
      [key]: (archive.categories[key] ?? []).filter((one) => String(one.id) !== params.category_id),
    };
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/libraries/:library_uuid/shares', ({ params }) =>
    HttpResponse.json(archive.shares[String(params.library_uuid)] ?? []),
  ),
  http.put('/api/libraries/:library_uuid/shares', async ({ params, request }) => {
    const body = (await request.json()) as Schemas['CreateShare'];
    const key = String(params.library_uuid);
    const existing = archive.shares[key] ?? [];
    const made: Schemas['ShareSummary'] = {
      grantee: { id: body.grantee_id, display_name: 'Marta', email: 'marta@example.test' },
      level: body.level,
      level_description: 'Can add recordings and edit their details.',
      granted_by: archive.me.id,
      created_at: '2026-03-12T10:00:00Z',
    };
    archive.shares = {
      ...archive.shares,
      [key]: [...existing.filter((one) => one.grantee.id !== body.grantee_id), made],
    };
    return HttpResponse.json(made);
  }),
  http.delete('/api/libraries/:library_uuid/shares/:grantee_id', ({ params }) => {
    const key = String(params.library_uuid);
    archive.shares = {
      ...archive.shares,
      [key]: (archive.shares[key] ?? []).filter(
        (one) => String(one.grantee.id) !== params.grantee_id,
      ),
    };
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Recordings -----------------------------------------------------------

  http.get('/api/audio', ({ request }) => {
    const url = new URL(request.url);
    const live = archive.recordings.filter((one) => one.deleted_at === null);
    return HttpResponse.json(page(applyFilters(live, url), url));
  }),
  http.get('/api/audio/duplicates/:sha256', () => HttpResponse.json([])),
  http.get('/api/audio/:audio_uuid', ({ params }) => found(detailOf(String(params.audio_uuid)))),
  http.patch('/api/audio/:audio_uuid', async ({ params, request }) => {
    const body = (await request.json()) as Schemas['UpdateAudio'];
    const existing = archive.recordings.find((one) => one.uuid === params.audio_uuid);
    if (!existing) return NOT_FOUND();
    const updated = {
      ...existing,
      ...(body.title ? { title: body.title } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.recorded_at !== undefined ? { recorded_at: body.recorded_at } : {}),
      ...(body.clear_category ? { category_id: null } : {}),
      ...(body.category_id !== undefined && body.category_id !== null
        ? { category_id: body.category_id }
        : {}),
    };
    archive.recordings = archive.recordings.map((one) => (one === existing ? updated : one));
    return HttpResponse.json(detailOf(updated.uuid));
  }),
  http.post('/api/audio/:audio_uuid/move', async ({ params, request }) => {
    const body = (await request.json()) as Schemas['MoveAudio'];
    const existing = archive.recordings.find((one) => one.uuid === params.audio_uuid);
    if (!existing) return NOT_FOUND();
    const moved = { ...existing, library_uuid: body.library_uuid };
    archive.recordings = archive.recordings.map((one) => (one === existing ? moved : one));
    return HttpResponse.json(detailOf(moved.uuid));
  }),
  http.delete('/api/audio/:audio_uuid', ({ params }) => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === params.audio_uuid ? { ...one, deleted_at: '2026-03-12T10:00:00Z' } : one,
    );
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/audio/:audio_uuid/restore', ({ params }) => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === params.audio_uuid ? { ...one, deleted_at: null } : one,
    );
    return found(detailOf(String(params.audio_uuid)));
  }),
  http.get('/api/audio/:audio_uuid/duplicates', () => HttpResponse.json([])),
  http.post('/api/audio/:audio_uuid/transcribe', ({ params }) => {
    const existing = archive.recordings.find((one) => one.uuid === params.audio_uuid);
    if (!existing) return NOT_FOUND();
    if (existing.transcription_state === 'running') {
      // The one the interface renders as a state rather than as an error (`API-11`).
      return problem(409, 'That recording is already being transcribed.');
    }
    archive.recordings = archive.recordings.map((one) =>
      one === existing ? { ...one, transcription_state: 'running' } : one,
    );
    return HttpResponse.json(archive.jobs[0], { status: 202 });
  }),
  http.get('/api/audio/:audio_uuid/transcript', ({ params }) =>
    found(archive.transcripts[String(params.audio_uuid)]),
  ),
  http.get('/api/audio/:audio_uuid/transcripts', ({ params }) => {
    const one = archive.transcripts[String(params.audio_uuid)];
    if (!one) return HttpResponse.json([]);
    const { segments: _segments, ...summary } = one;
    return HttpResponse.json([summary]);
  }),
  http.post('/api/audio/:audio_uuid/transcripts/:transcript_id/activate', ({ params }) =>
    found(archive.transcripts[String(params.audio_uuid)]),
  ),
  http.post('/api/audio/:audio_uuid/playback-token', ({ params }) =>
    HttpResponse.json({ token: `token-for-${String(params.audio_uuid)}`, expires_in: 300 }),
  ),
  // Audio and peaks are bytes rather than JSON. A view test never plays anything -- jsdom has no
  // audio -- so these answer the shape and not the sound.
  http.get('/api/audio/:audio_uuid/stream', () => new HttpResponse(new ArrayBuffer(8))),
  http.get('/api/audio/:audio_uuid/original', () => new HttpResponse(new ArrayBuffer(8))),
  http.get('/api/audio/:audio_uuid/waveform', ({ request }) => {
    const peaks = Number(new URL(request.url).searchParams.get('peaks') ?? 200);
    // A plausible shape rather than a flat line: a waveform test that passes on silence would
    // pass on a bug that drew silence.
    const body = new Uint8Array(peaks * 2);
    for (let index = 0; index < peaks; index += 1) {
      const height = Math.round(40 + 50 * Math.abs(Math.sin(index / 7)));
      body[index * 2] = 256 - height;
      body[index * 2 + 1] = height;
    }
    return new HttpResponse(body, { headers: { 'content-type': 'application/octet-stream' } });
  }),

  // --- Search, tags and the trash ------------------------------------------

  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') ?? '').toLowerCase();
    const matching = applyFilters(
      archive.recordings.filter((one) => one.deleted_at === null),
      url,
    ).filter((one) => !query || one.title.toLowerCase().includes(query));
    const results: Schemas['SearchResult'][] = matching.map((audio) => ({
      audio,
      total_matches: 2,
      matches: [
        { kind: 'transcript', fragment: '…la casa del carrer Nou…', start_ms: 1_084_000 },
        { kind: 'title', fragment: audio.title, start_ms: null },
      ],
    }));
    return HttpResponse.json(page(results, url));
  }),
  http.get('/api/search/about', () =>
    HttpResponse.json({
      transcribed: archive.recordings.filter((one) => one.transcription_state === 'done').length,
      total: archive.recordings.length,
    }),
  ),
  http.get('/api/tags', ({ request }) => {
    const prefix = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return HttpResponse.json(
      archive.tags.filter((one) => one.tag.name.toLowerCase().startsWith(prefix)),
    );
  }),
  http.get('/api/trash/audio', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      page(
        archive.recordings.filter((one) => one.deleted_at),
        url,
      ),
    );
  }),
  http.get('/api/trash/libraries', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      page(
        archive.libraries.filter((one) => one.deleted_at),
        url,
      ),
    );
  }),

  // --- Where audio goes, and who may know -----------------------------------

  http.get('/api/transcription/destination', () => HttpResponse.json(archive.destination)),
  http.get('/api/users/lookup', ({ request }) => {
    // Full address only, at most one result: a prefix search would let any library manager
    // enumerate the instance (`API-15`).
    const email = new URL(request.url).searchParams.get('email')?.toLowerCase();
    const people = [GABRIEL, MARTA];
    return HttpResponse.json(people.filter((one) => one.email.toLowerCase() === email));
  }),

  // --- Administration -------------------------------------------------------

  http.get('/api/admin/jobs', ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const jobs = state ? archive.jobs.filter((one) => one.state === state) : archive.jobs;
    return HttpResponse.json(page(jobs, url));
  }),
  http.post('/api/admin/jobs/:job_id/retry', ({ params }) =>
    found(archive.jobs.find((one) => String(one.id) === params.job_id)),
  ),
  http.post('/api/admin/jobs/:job_id/cancel', ({ params }) =>
    found(archive.jobs.find((one) => String(one.id) === params.job_id)),
  ),
  http.get('/api/admin/status', () =>
    HttpResponse.json({
      version: archive.instance.version,
      database_revision: '0001_initial',
      expected_revision: '0001_initial',
      trash_retention_days: archive.instance.trash_retention_days,
      jobs: { pending: 1, running: 1, failed: 1 },
      storage: {
        libraries: archive.libraries.length,
        recordings: archive.recordings.length,
        trashed_recordings: 0,
        total_duration_ms: 149 * 3_600_000,
        originals_bytes: 284 * 1024 * 1024 * 40,
        derived_bytes: 1024 * 1024 * 512,
        database_bytes: 24 * 1024 * 1024,
        free_bytes: 400 * 1024 * 1024 * 1024,
      },
      transcription: providerStatus(),
    }),
  ),
  http.get('/api/admin/transcription', () => HttpResponse.json(providerStatus())),
  http.post('/api/admin/transcription/test', () => HttpResponse.json(providerStatus())),
  http.get('/api/admin/users', () => HttpResponse.json([GABRIEL, MARTA])),
  http.post('/api/admin/users', () => HttpResponse.json(MARTA, { status: 201 })),
  http.post('/api/admin/users/:user_id/disable', () => HttpResponse.json(MARTA)),
  http.post('/api/admin/users/:user_id/enable', () => HttpResponse.json(MARTA)),
  http.delete('/api/admin/users/:user_id', () => new HttpResponse(null, { status: 204 })),
];

function providerStatus(): Schemas['ProviderStatus'] {
  return {
    provider: archive.destination.provider,
    base_url: 'http://whisper:8000/v1',
    model: 'large-v3',
    default_language: null,
    configured: archive.destination.configured,
    has_credential: false,
    reachable: true,
    detail: 'Answering on whisper:8000.',
  };
}

/**
 * The filters a list or a search carries in the URL (§2.1).
 *
 * The four transcription states are repeatable and mean a union (`JOB-11b`), which is the one
 * piece of filter behaviour a view can get wrong in a way that looks right: taking the last
 * value instead of all of them filters for one state and shows a plausible list.
 */
function applyFilters<Item extends { transcription_state: string; category_id: number | null }>(
  items: Item[],
  url: URL,
): Item[] {
  const states = url.searchParams.getAll('transcription_state');
  const category = url.searchParams.get('category_id');
  return items
    .filter((one) => states.length === 0 || states.includes(one.transcription_state))
    .filter((one) => category === null || String(one.category_id) === category);
}
