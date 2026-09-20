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

import type { components } from '@/api/contract/schema';

import { ALEX, LOGIN_ATTEMPTS_PER_MINUTE, SAM, archive, detailOf } from './archive';

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
  // The API derives the type from the status it answered with (`api/errors.py`), so the mock
  // does too rather than calling everything that is not a 404 an error. A caller that branches
  // on the type -- V1 does, because a refused sign-in and a rate-limited one are both 400 --
  // would otherwise be testing against a vocabulary the instance does not use.
  const codes: Record<number, string> = {
    400: 'invalid_request',
    401: 'unauthenticated',
    404: 'not_found',
    409: 'conflict',
    422: 'invalid_request',
  };
  return HttpResponse.json(
    {
      type: `/errors/${codes[status] ?? 'error'}`,
      title: titles[status] ?? 'Error',
      detail,
      status,
      request_id: 'test-request',
      ...extra,
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** Disable or re-enable one account, answering with it the way the endpoints do (`API-20`). */
function setDisabled(id: number, disabledAt: string | null) {
  const existing = archive.users.find((one) => one.id === id);
  if (!existing) return NOT_FOUND();
  const changed = { ...existing, disabled_at: disabledAt };
  archive.users = archive.users.map((one) => (one === existing ? changed : one));
  return HttpResponse.json(changed);
}

/** What the API says about anything the caller may not read, or that is not there (`DEC-14`). */
const NOT_FOUND = () => problem(404, 'There is no such thing here, or it is not yours.');

/**
 * The one answer an unknown address, a wrong password and a disabled account all get (§V1).
 *
 * **400 and not 401**, and the type rather than the status is what names it. The real endpoint
 * raises `InvalidRequestError` with `code="unauthenticated"`, so a refused sign-in is a bad
 * request that says which kind it is -- and a mock answering 401 would let a view branch on a
 * status the instance never sends here.
 */
const SAME_ANSWER = () =>
  problem(400, 'That email and password do not match an account.', {
    type: '/errors/unauthenticated',
  });

/** The shortest password the instance stores, as `sonarium.api.routes.auth` counts it. */
const MINIMUM_PASSWORD_LENGTH = 10;

/** The stored waveform's header: version, duration in milliseconds, bucket count (`ING-5`). */
const WAVEFORM_FORMAT_VERSION = 2;
const WAVEFORM_HEADER_BYTES = 9;

/** A tag name as the slug it resolves to, the way `sonarium.core.text.normalise_slug` does. */
function fold(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase();
}

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
  http.post('/api/auth/bootstrap', async ({ request }) => {
    const body = (await request.json()) as Schemas['Bootstrap'];
    // Refused the moment any account exists, which is what makes this not a second way in.
    if (!archive.instance.needs_bootstrap) {
      return problem(409, 'This instance already has an account. Sign in instead.');
    }
    if (body.password.length < MINIMUM_PASSWORD_LENGTH) {
      return problem(
        400,
        `A password needs at least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`,
      );
    }
    archive.instance = { ...archive.instance, needs_bootstrap: false };
    archive.me = {
      ...archive.me,
      display_name: body.display_name,
      email: body.email,
      is_admin: true,
    };
    archive.accounts = [{ email: body.email, password: body.password, disabled: false }];
    return HttpResponse.json(archive.me, { status: 201 });
  }),
  http.post('/api/auth/session', async ({ request }) => {
    const body = (await request.json()) as Schemas['SignIn'];
    // Normalised, because the instance counts and looks up against the address rather than
    // against what was typed: `Admin@Example.test` and `admin@example.test` are one account and
    // therefore one counter.
    const key = body.email.trim().toLocaleLowerCase();
    const spent = archive.attempts[key] ?? 0;
    if (spent >= LOGIN_ATTEMPTS_PER_MINUTE) {
      return problem(400, 'Too many sign-in attempts. Wait a minute and try again.', {
        type: '/errors/too_many_requests',
      });
    }
    const account = archive.accounts.find((one) => one.email.toLocaleLowerCase() === key);
    const admitted =
      account !== undefined && !account.disabled && account.password === body.password;
    if (!admitted) {
      archive.attempts[key] = spent + 1;
      return SAME_ANSWER();
    }
    // Forgotten on the way in, so somebody who mistyped twice and then got it right is not
    // still being counted.
    archive.attempts = Object.fromEntries(
      Object.entries(archive.attempts).filter(([address]) => address !== key),
    );
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
      owner: ALEX,
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
    const going = archive.libraries.find((one) => one.uuid === params.library_uuid);
    if (!going) return NOT_FOUND();
    // `DAT-9`: the owner keeps at least one. A mock that trashed it anyway would let a view pass
    // a test for an affordance the real API refuses.
    const others = archive.libraries.filter(
      (one) => one.owner.id === going.owner.id && one !== going && one.deleted_at === null,
    );
    if (others.length === 0) {
      return problem(
        400,
        'An account keeps at least one library -- it is where a recording goes when nobody ' +
          'chose another -- and this is the last one. Create another library first.',
      );
    }
    archive.libraries = archive.libraries.map((one) =>
      one === going ? { ...one, deleted_at: '2026-03-12T10:00:00Z' } : one,
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
      // Re-parenting, and the flag that means the root. A null `parent_id` means "leave it
      // alone" here as it does in the API, which is the whole reason `clear_parent` exists --
      // a mock that treated the two the same would make `UI-17b`'s move-to-the-top untestable.
      const updated = {
        ...found_,
        ...(body.name ? { name: body.name } : {}),
        ...(body.clear_parent === true ? { parent_id: null } : {}),
        ...(body.parent_id === undefined || body.parent_id === null
          ? {}
          : { parent_id: body.parent_id }),
      };
      archive.categories = {
        ...archive.categories,
        [key]: existing.map((one) => (one === found_ ? updated : one)),
      };
      return HttpResponse.json(updated);
    },
  ),
  http.post('/api/libraries/:library_uuid/categories/order', async ({ params, request }) => {
    // `ordered_ids` is applied, because a reorder that answered with the old order would make a
    // view's move-up button look broken in a test and work in the product, or the reverse.
    const body = (await request.json()) as Schemas['ReorderCategories'];
    const key = String(params.library_uuid);
    const existing = archive.categories[key] ?? [];
    const positions = new Map(body.ordered_ids.map((id, index) => [id, index]));
    archive.categories = {
      ...archive.categories,
      [key]: existing.map((one) =>
        positions.has(one.id) ? { ...one, position: positions.get(one.id) ?? one.position } : one,
      ),
    };
    return HttpResponse.json(archive.categories[key]);
  }),
  http.delete('/api/libraries/:library_uuid/categories/:category_id', ({ params }) => {
    const key = String(params.library_uuid);
    const existing = archive.categories[key] ?? [];
    // The sub-categories go with it and the recordings do not, which is what the API does: the
    // foreign key is `ON DELETE SET NULL`, so a recording loses its category and stays.
    const going = new Set<number>();
    const collect = (id: number) => {
      going.add(id);
      for (const child of existing.filter((one) => one.parent_id === id)) collect(child.id);
    };
    collect(Number(params.category_id));
    archive.categories = {
      ...archive.categories,
      [key]: existing.filter((one) => !going.has(one.id)),
    };
    archive.recordings = archive.recordings.map((one) =>
      one.category_id !== null && going.has(one.category_id) ? { ...one, category_id: null } : one,
    );
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
      grantee: { id: body.grantee_id, display_name: 'Sam Rivera', email: 'sam@example.test' },
      level: body.level,
      level_description: 'Can edit: change titles, categories and tags, but not share.',
      granted_by: archive.me.id,
      source: 'library',
      created_at: '2026-03-12T10:00:00Z',
    };
    archive.shares = {
      ...archive.shares,
      [key]: [...existing.filter((one) => one.grantee.id !== body.grantee_id), made],
    };
    return HttpResponse.json(made);
  }),
  http.get('/api/audio/:audio_uuid/shares', ({ params }) => {
    const uuid = String(params.audio_uuid);
    const recording = archive.recordings.find((one) => one.uuid === uuid);
    if (recording === undefined) return NOT_FOUND();
    // Both halves in one list, inherited first, as the real endpoint orders them.
    return HttpResponse.json([
      ...(archive.shares[recording.library_uuid] ?? []),
      ...(archive.recordingShares[uuid] ?? []),
    ]);
  }),
  http.put('/api/audio/:audio_uuid/shares', async ({ params, request }) => {
    const uuid = String(params.audio_uuid);
    if (!archive.recordings.some((one) => one.uuid === uuid)) return NOT_FOUND();
    const body = (await request.json()) as Schemas['CreateShare'];
    const made: Schemas['ShareSummary'] = {
      grantee: { id: body.grantee_id, display_name: 'Sam Rivera', email: 'sam@example.test' },
      level: body.level,
      level_description: 'Can edit: change titles, categories and tags, but not share.',
      granted_by: archive.me.id,
      source: 'audio',
      created_at: '2026-03-12T10:00:00Z',
    };
    const existing = archive.recordingShares[uuid] ?? [];
    archive.recordingShares = {
      ...archive.recordingShares,
      [uuid]: [...existing.filter((one) => one.grantee.id !== body.grantee_id), made],
    };
    return HttpResponse.json(made);
  }),
  http.delete('/api/audio/:audio_uuid/shares/:grantee_id', ({ params }) => {
    const uuid = String(params.audio_uuid);
    const existing = archive.recordingShares[uuid] ?? [];
    // An inherited grant is not this recording's to revoke, and answers as though it were absent.
    if (!existing.some((one) => String(one.grantee.id) === params.grantee_id)) return NOT_FOUND();
    archive.recordingShares = {
      ...archive.recordingShares,
      [uuid]: existing.filter((one) => String(one.grantee.id) !== params.grantee_id),
    };
    return new HttpResponse(null, { status: 204 });
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

  // --- Field recordings -----------------------------------------------------------

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
  http.post('/api/audio/:audio_uuid/transcribe/cancel', ({ params }) => {
    const existing = archive.recordings.find((one) => one.uuid === params.audio_uuid);
    if (!existing) return NOT_FOUND();
    if (existing.transcription_state !== 'running') {
      // The mirror of the 409 on asking: pressing cancel on one that has just finished is a
      // race, not an error (`API-21`).
      return problem(409, 'That recording is not being transcribed.');
    }
    // Back to `none` and not to a fifth state: cancelling leaves exactly as much transcript as
    // there was before, which is none.
    archive.recordings = archive.recordings.map((one) =>
      one === existing ? { ...one, transcription_state: 'none' } : one,
    );
    archive.jobs = archive.jobs.map((one) =>
      one.audio_uuid === existing.uuid && one.kind === 'transcribe'
        ? { ...one, state: 'cancelled', error: null, started_at: null }
        : one,
    );
    const cancelled = archive.jobs.find(
      (one) => one.audio_uuid === existing.uuid && one.kind === 'transcribe',
    );
    if (cancelled === undefined) return NOT_FOUND();
    return HttpResponse.json(cancelled);
  }),
  http.get('/api/audio/:audio_uuid/transcription', ({ params }) => {
    const uuid = String(params.audio_uuid);
    const existing = archive.recordings.find((one) => one.uuid === uuid);
    if (!existing) return NOT_FOUND();
    // Derived from the jobs the way the API derives it, rather than stored beside the recording:
    // a fixture that carried both would let a test pass with a state and an error that could not
    // have happened together (`API-17`).
    const job = archive.jobs.find((one) => one.audio_uuid === uuid);
    return HttpResponse.json({
      state: existing.transcription_state,
      attempts: job?.attempts ?? 0,
      started_at: job?.state === 'running' ? (job.started_at ?? null) : null,
      error: job?.error ?? null,
    });
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
    // The stored form, header and all (`ING-5`): version 2, the duration in milliseconds, the
    // bucket count, then int8 pairs. A fixture that sent bare pairs would pass against a decoder
    // that ignored the version byte, which is the one thing the version byte exists to catch.
    const body = new Uint8Array(WAVEFORM_HEADER_BYTES + peaks * 2);
    const header = new DataView(body.buffer);
    header.setUint8(0, WAVEFORM_FORMAT_VERSION);
    header.setUint32(1, peaks * 100, true);
    header.setUint32(5, peaks, true);
    // A plausible shape rather than a flat line: a waveform test that passes on silence would
    // pass on a bug that drew silence.
    for (let index = 0; index < peaks; index += 1) {
      const height = Math.round(40 + 50 * Math.abs(Math.sin(index / 7)));
      header.setInt8(WAVEFORM_HEADER_BYTES + index * 2, -height);
      header.setInt8(WAVEFORM_HEADER_BYTES + index * 2 + 1, height);
    }
    return new HttpResponse(body, { headers: { 'content-type': 'application/octet-stream' } });
  }),

  // --- Search, tags and the trash ------------------------------------------

  // An open stream that never says anything, which is what a quiet archive's does. A test that
  // wants a change to arrive builds its own stream rather than driving this one: the whole point
  // of the endpoint is that it stays open, and a handler that closes would make every component
  // mounting it reconnect in a loop (`REV-12`).
  http.get('/api/events', () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': ready\n\n'));
      },
    });
    return new HttpResponse(body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
    });
  }),
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
        {
          kind: 'transcript',
          fragment: '…the third segment mentions rehearsal…',
          start_ms: 1_084_000,
        },
        { kind: 'title', fragment: audio.title, start_ms: null },
      ],
    }));
    return HttpResponse.json(page(results, url));
  }),
  // `{"recall": "..."}`, which is what `about_search` answers: one sentence about what the index
  // cannot do, for the interface to show rather than copy (`UI-16g`). It answered a pair of
  // counts, which is a shape the endpoint has never had -- and a view that rendered the real
  // sentence would have found nothing to render in every test.
  http.get('/api/search/about', () => HttpResponse.json({ recall: archive.recall })),
  http.get('/api/tags', ({ request }) => {
    // `prefix`, which is what the endpoint documents and what the pickers send. It read `q`, so
    // every prefix was answered with every tag -- and a mock that ignores a filter makes the
    // feature that uses it untestable.
    //
    // Matched against the slug, as `suggest_tags` does: it normalises the prefix and compares it
    // to `tag.slug`, so typing `Musica` finds `interview`. A mock that compared names would answer
    // nothing there, and `UI-13c`'s canonical-name rule -- the whole reason the suggestion is
    // preferred over what was typed -- could not be tested at all.
    const prefix = fold(new URL(request.url).searchParams.get('prefix') ?? '');
    return HttpResponse.json(archive.tags.filter((one) => one.tag.slug.startsWith(prefix)));
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
  // Permanent deletion, and only from the trash: something that is not in it answers 404 rather
  // than 400, exactly as the endpoint does, so `INT-1c` cannot be tested against a refusal the
  // instance never sends (`API-19`).
  http.delete('/api/trash/audio/:audio_uuid', ({ params }) => {
    const existing = archive.recordings.find((one) => one.uuid === params.audio_uuid);
    if (!existing?.deleted_at) return NOT_FOUND();
    archive.recordings = archive.recordings.filter((one) => one !== existing);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete('/api/trash/libraries/:library_uuid', ({ params }) => {
    const existing = archive.libraries.find((one) => one.uuid === params.library_uuid);
    if (!existing?.deleted_at) return NOT_FOUND();
    archive.libraries = archive.libraries.filter((one) => one !== existing);
    // It takes the recordings with it, trashed separately or not, because that is what the
    // endpoint does -- and a mock that left them would make the confirmation's count a lie.
    archive.recordings = archive.recordings.filter((one) => one.library_uuid !== existing.uuid);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Where audio goes, and who may know -----------------------------------

  http.get('/api/transcription/destination', () => HttpResponse.json(archive.destination)),
  http.get('/api/users/lookup', ({ request }) => {
    // Full address only, at most one result: a prefix search would let any library manager
    // enumerate the instance (`API-15`).
    const email = new URL(request.url).searchParams.get('email')?.toLowerCase();
    const people = [ALEX, SAM];
    return HttpResponse.json(people.filter((one) => one.email.toLowerCase() === email));
  }),

  // --- Administration -------------------------------------------------------

  http.get('/api/admin/jobs', ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const jobs = state ? archive.jobs.filter((one) => one.state === state) : archive.jobs;
    return HttpResponse.json(page(jobs, url));
  }),
  // Tallied off the same rows the list serves, so the counts and the queue under them cannot
  // disagree in a test the way they used to on screen (`FBK-4`).
  http.get('/api/admin/jobs/counts', () => {
    const tally: Record<string, number> = {
      pending: 0,
      running: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const job of archive.jobs) tally[job.state] = (tally[job.state] ?? 0) + 1;
    return HttpResponse.json(tally);
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
  // The one call in administration that contacts anything, and only because it was asked to.
  http.post('/api/admin/transcription/test', () => HttpResponse.json(providerStatus(true))),
  http.get('/api/admin/users', () => HttpResponse.json(archive.users)),
  http.post('/api/admin/users', async ({ request }) => {
    const body = (await request.json()) as Schemas['CreateAccount'];
    const made: Schemas['AdminUser'] = {
      id: Math.max(0, ...archive.users.map((one) => one.id)) + 1,
      display_name: body.display_name,
      email: body.email,
      is_admin: body.is_admin ?? false,
      disabled_at: null,
      created_at: '2026-03-12T10:00:00Z',
    };
    archive.users = [...archive.users, made];
    return HttpResponse.json(made, { status: 201 });
  }),
  // Disable and enable answer with the account they changed, as the endpoints do, so a row can
  // redraw from the answer rather than from a second request that might race it (`API-20`).
  http.post('/api/admin/users/:user_id/disable', ({ params }) =>
    setDisabled(Number(params.user_id), '2026-03-12T10:00:00Z'),
  ),
  http.post('/api/admin/users/:user_id/enable', ({ params }) =>
    setDisabled(Number(params.user_id), null),
  ),
  http.delete('/api/admin/users/:user_id', ({ params }) => {
    const existing = archive.users.find((one) => one.id === Number(params.user_id));
    if (!existing) return NOT_FOUND();
    archive.users = archive.users.filter((one) => one !== existing);
    return new HttpResponse(null, { status: 204 });
  }),
  // The password an administrator sets is recorded rather than discarded, so a test can assert
  // the dialog sent the value it showed -- which is the whole of `UI-37` (`API-25`).
  http.post('/api/admin/users/:user_id/password', async ({ params, request }) => {
    const existing = archive.users.find((one) => one.id === Number(params.user_id));
    if (!existing) return NOT_FOUND();
    const body = (await request.json()) as { password: string };
    if (body.password.length < 10) return new HttpResponse(null, { status: 422 });
    archive.passwordsSet.push({ id: existing.id, password: body.password });
    return new HttpResponse(null, { status: 204 });
  }),
];

/**
 * The provider as the instance holds it (`INT-3c`).
 *
 * **`reachable` is `null` unless somebody ran the check**, which is the endpoint's own contract and
 * not a detail: nothing contacts a third party because a page was opened, so a plain read cannot
 * know whether the provider answers. A mock that returned `true` here would make the one state
 * `INT-3c` exists to draw -- unchecked -- unreachable in a test, and the page would look right
 * while proving nothing.
 *
 * **`usable` is a second answer and not a synonym** (`TRX-10`). An engine can answer everything
 * asked of it and still run a model that returns no timed segments, so a handler that tied the
 * two together would make the state the check exists to catch untestable.
 */
function providerStatus(
  reachable: boolean | null = null,
  usable: boolean | null = reachable,
): Schemas['ProviderStatus'] {
  return {
    provider: archive.destination.provider,
    base_url: 'http://whisper:8000/v1',
    model: 'large-v3',
    default_language: null,
    configured: archive.destination.configured,
    has_credential: false,
    reachable,
    usable,
    detail: reachable === null ? '' : 'Answering on whisper:8000.',
  };
}

/**
 * The filters a list or a search carries in the URL (§2.1).
 *
 * The four transcription states are repeatable and mean a union (`JOB-11b`), which is the one
 * piece of filter behaviour a view can get wrong in a way that looks right: taking the last
 * value instead of all of them filters for one state and shows a plausible list.
 */
function applyFilters<
  Item extends {
    transcription_state: string;
    category_id: number | null;
    tags?: { slug: string }[];
  },
>(items: Item[], url: URL): Item[] {
  const states = url.searchParams.getAll('transcription_state');
  const category = url.searchParams.get('category_id');
  // All of them must match, which is what the API's own parameter says: `tag` is repeatable and
  // narrows rather than widens. Without this the mock answered a tag filter with the whole
  // library, so `UI-8b`'s filter and `UI-10a`'s "nothing matched" state were untestable.
  const tags = url.searchParams.getAll('tag');
  return items
    .filter((one) => states.length === 0 || states.includes(one.transcription_state))
    .filter((one) => category === null || String(one.category_id) === category)
    .filter((one) => tags.every((slug) => (one.tags ?? []).some((tag) => tag.slug === slug)));
}
