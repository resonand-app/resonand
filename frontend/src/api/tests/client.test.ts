/**
 * The wrapper, and §1.9 encoded in it (`UI-3b`).
 *
 * The four rules are tested here rather than in the views, because a rule that has to be
 * remembered in thirty places is a rule that will be broken in one of them. The fifth thing
 * tested is the one nobody writes down: a request that never arrives is still an `ApiProblem`.
 */

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { get, patch, post, remove, request } from '../client';
import { ApiProblem, UNREACHABLE, UNREACHABLE_DETAIL, isApiProblem } from '../problem';

const PROBLEM = 'application/problem+json';

function answer(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': body === undefined ? 'text/plain' : PROBLEM, ...headers },
  });
}

function problemBody(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return { type: '/errors/x', title: 'A title', detail, status, ...extra };
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The request the wrapper made, as the arguments it passed to `fetch`. */
function madeRequest(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe('where it sends', () => {
  it('calls the exact path the document publishes, relative to this origin', async () => {
    // Not assembled out of a base and a suffix: the paths in `schema.ts` carry `/api` because
    // that is where the API is (`API-16`), so what a call site writes is what goes on the wire.
    fetchMock.mockResolvedValue(answer(200, { name: 'resonand' }));
    await get('/api/instance');
    expect(madeRequest().url).toBe('/api/instance');
  });

  it('sends the session cookie and nothing else', async () => {
    fetchMock.mockResolvedValue(answer(200, {}));
    await get('/api/auth/me');
    expect(madeRequest().init.credentials).toBe('same-origin');
    expect(madeRequest().init.headers).not.toHaveProperty('authorization');
  });

  it('puts path parameters into the path, encoded', async () => {
    fetchMock.mockResolvedValue(answer(200, {}));
    await get('/api/libraries/{library_uuid}', { path: { library_uuid: 'a b/c' } });
    expect(madeRequest().url).toContain('/api/libraries/a%20b%2Fc');
  });

  it('repeats an array parameter rather than joining it', async () => {
    // JOB-11b made the four transcription-state toggles a repeatable parameter whose values are
    // a union. Joined into one string it would filter for a state called "none,done".
    fetchMock.mockResolvedValue(answer(200, { items: [], total: 0, limit: 50, offset: 0 }));
    await get('/api/search', {
      query: { q: 'rehearsal', transcription_state: ['none', 'done'] },
    });
    const query = madeRequest().url.split('?')[1];
    expect(query).toContain('transcription_state=none');
    expect(query).toContain('transcription_state=done');
  });

  it('sends no parameter for a filter nobody set', async () => {
    // "any state" and "state: none" are different questions, and an empty parameter asks the
    // second one.
    fetchMock.mockResolvedValue(answer(200, { items: [], total: 0, limit: 50, offset: 0 }));
    await get('/api/search', { query: { q: 'rehearsal', category_id: null, limit: undefined } });
    expect(madeRequest().url).toBe('/api/search?q=rehearsal');
  });

  it('sends a body as JSON, and says so', async () => {
    fetchMock.mockResolvedValue(answer(200, {}));
    await patch('/api/auth/me', { body: { display_name: 'Alex Morgan' } });
    const { init } = madeRequest();
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"display_name":"Alex Morgan"}');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('sends no content-type when there is no body', async () => {
    fetchMock.mockResolvedValue(answer(200, {}));
    await post('/api/libraries/{library_uuid}/restore', {
      path: { library_uuid: 'u' },
    });
    expect(madeRequest().init.headers).not.toHaveProperty('content-type');
  });
});

describe('what it gives back', () => {
  it('resolves to the body a call answered with', async () => {
    fetchMock.mockResolvedValue(answer(200, { name: 'resonand', version: '0.1.0' }));
    await expect(get('/api/instance')).resolves.toMatchObject({ name: 'resonand' });
  });

  it('resolves to nothing for a 204, rather than failing to parse one', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(remove('/api/auth/session')).resolves.toBeUndefined();
  });
});

describe('§1.9, encoded once', () => {
  it('shows what the API wrote, rather than substituting its own wording', async () => {
    fetchMock.mockResolvedValue(
      answer(409, problemBody(409, 'You already have a library called Family.')),
    );
    const problem = await get('/api/libraries').catch((error: unknown) => error);
    expect(isApiProblem(problem)).toBe(true);
    expect((problem as ApiProblem).message).toBe('You already have a library called Family.');
  });

  it('reports a 404 as "no such thing" and never as a permission', async () => {
    // The ACL answers 404 rather than 403 so that a 403 cannot confirm a recording exists
    // (DEC-14). "Not found" is therefore the whole of what the interface knows.
    fetchMock.mockResolvedValue(answer(404, problemBody(404, 'There is no such recording.')));
    const problem = (await get('/api/audio/{audio_uuid}', {
      path: { audio_uuid: 'u' },
    }).catch((error: unknown) => error)) as ApiProblem;
    expect(problem.isMissing).toBe(true);
    expect(problem.detail.toLowerCase()).not.toContain('permission');
    expect(problem.detail.toLowerCase()).not.toContain('not allowed');
  });

  it('reports a 409 as a conflict the person can resolve', async () => {
    fetchMock.mockResolvedValue(
      answer(409, problemBody(409, 'That recording is already being transcribed.')),
    );
    const problem = (await post('/api/audio/{audio_uuid}/transcribe', {
      path: { audio_uuid: 'u' },
      body: { language: null },
    }).catch((error: unknown) => error)) as ApiProblem;
    expect(problem.isConflict).toBe(true);
    expect(problem.isFieldProblem).toBe(false);
  });

  it('reports a 422 next to the field, not as a banner', async () => {
    fetchMock.mockResolvedValue(
      answer(
        422,
        problemBody(422, 'That is not an address.', {
          errors: [{ field: 'email', detail: 'That is not an address.' }],
        }),
      ),
    );
    const problem = (await patch('/api/auth/me', {
      body: { email: 'nope' },
    }).catch((error: unknown) => error)) as ApiProblem;
    expect(problem.isFieldProblem).toBe(true);
    expect(problem.fieldDetail('email')).toBe('That is not an address.');
    expect(problem.fieldDetail('display_name')).toBeUndefined();
  });

  it('reports a 401 as the one status that means leave the view', async () => {
    fetchMock.mockResolvedValue(answer(401, problemBody(401, 'Sign in to continue.')));
    const problem = (await get('/api/auth/me').catch((error: unknown) => error)) as ApiProblem;
    expect(problem.isUnauthenticated).toBe(true);
  });

  it('carries the request id, which is what makes a report actionable', async () => {
    fetchMock.mockResolvedValue(
      answer(500, problemBody(500, 'Something went wrong on the server.'), {
        'x-request-id': 'abc-123',
      }),
    );
    const problem = (await get('/api/instance').catch((error: unknown) => error)) as ApiProblem;
    expect(problem.requestId).toBe('abc-123');
  });
});

describe('a failure the API did not write', () => {
  it('turns an unreachable instance into a problem like any other', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const problem = (await get('/api/instance').catch((error: unknown) => error)) as ApiProblem;
    expect(isApiProblem(problem)).toBe(true);
    expect(problem.isUnreachable).toBe(true);
    expect(problem.status).toBe(UNREACHABLE);
    expect(problem.detail).toBe(UNREACHABLE_DETAIL);
  });

  it('lets an abort through as an abort', async () => {
    // A query the person navigated away from is not a failure, and a banner about the instance
    // being unreachable would land on the screen they went to.
    fetchMock.mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));
    const thrown = await get('/api/instance').catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(DOMException);
  });

  it('makes a problem out of a body that is not one', async () => {
    // A proxy's HTML error page, or an empty 502. The status is the only thing known.
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    const problem = (await get('/api/instance').catch((error: unknown) => error)) as ApiProblem;
    expect(problem.status).toBe(502);
    expect(problem.detail).toContain('502');
  });

  it('refuses to build a URL when a path parameter is missing', async () => {
    await expect(
      request('get', '/api/libraries/{library_uuid}', {
        path: {} as { library_uuid: string },
      }),
    ).rejects.toThrow('library_uuid');
  });
});

describe('what the compiler checks', () => {
  // These assert at build time and do nothing at run time. They are here rather than in a
  // separate file because what they hold is the point of the wrapper: `UI-3a` is done when a
  // backend rename breaks the frontend build, and that is only true if call sites are checked
  // against the document rather than passing strings to `fetch`.
  it('types a result as the schema says, and refuses what the schema does not have', () => {
    // The type form and not `expectTypeOf(get(...))`: the argument form would really call it.
    expectTypeOf<Awaited<ReturnType<typeof get<'/api/instance'>>>>().toHaveProperty(
      'trash_retention_days',
    );
    expectTypeOf<Awaited<ReturnType<typeof get<'/api/auth/me'>>>>().toHaveProperty('display_name');
    expectTypeOf<Awaited<ReturnType<typeof remove<'/api/auth/session'>>>>().toBeUndefined();

    const refused = [
      // @ts-expect-error -- no such endpoint.
      () => get('/api/libaries'),
      // @ts-expect-error -- the library uuid is not optional.
      () => get('/api/libraries/{library_uuid}', { path: {} }),
      // @ts-expect-error -- `PATCH /api/auth/me` has no `is_admin` to set.
      () => patch('/api/auth/me', { body: { is_admin: true } }),
      // @ts-expect-error -- `GET /api/instance` takes no query parameters.
      () => get('/api/instance', { query: { limit: 10 } }),
    ];
    expect(refused).toHaveLength(4);
  });
});

describe('the deployment prefix', () => {
  /**
   * Re-import the module against a document that carries the given base element.
   *
   * The prefix is read once, at module load, because it cannot change while a page is open --
   * so exercising it means loading the module again rather than calling a function.
   */
  async function baseUnder(href: string | null): Promise<string> {
    document.head.querySelector('base')?.remove();
    if (href !== null) {
      const element = document.createElement('base');
      element.setAttribute('href', href);
      document.head.append(element);
    }
    vi.resetModules();
    const { DEPLOYMENT_BASE } = await import('../client');
    document.head.querySelector('base')?.remove();
    return DEPLOYMENT_BASE;
  }

  it('is empty at the root, so the ordinary case concatenates nothing', async () => {
    expect(await baseUnder('/')).toBe('');
    expect(await baseUnder(null)).toBe('');
  });

  it('is the prefix the shell was served under, without its trailing slash', async () => {
    // The href always ends in a slash -- a base URL without one names a file -- and every path
    // in `schema.ts` begins with one, so the prefix is kept in the form that concatenates.
    expect(await baseUnder('/resonand/')).toBe('/resonand');
    expect(await baseUnder('/deep/er/')).toBe('/deep/er');
  });

  it('reads the element rather than the document, which is not the same on a deep link', async () => {
    // `document.baseURI` falls back to the current URL when no base element exists, so reading
    // it from `/library/<uuid>` would prefix every later call with that recording.
    history.pushState({}, '', '/library/8e29d6b4-0000-0000-0000-000000000000');
    try {
      expect(await baseUnder(null)).toBe('');
    } finally {
      history.pushState({}, '', '/');
    }
  });
});
