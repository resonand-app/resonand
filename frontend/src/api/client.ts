/**
 * The typed fetch wrapper (`UI-3b`).
 *
 * One place where a request is made, so §1.9's rules are encoded once and every view is handed a
 * value or an `ApiProblem` rather than a `Response` to interpret. Three things it settles:
 *
 * **The API is at `/api`, relative, on this origin** (`DEC-24`). Nothing here knows a hostname:
 * the interface and the API come out of the same container and the session cookie is the
 * authorisation, so `credentials` is `same-origin` and there is no header to attach and no token
 * to keep anywhere.
 *
 * **Every path and every parameter is checked against the committed document** (`UI-3a`). The
 * types come from `schema.ts`, so a renamed field or a dropped query parameter is a build
 * failure here rather than an empty column in a view.
 *
 * **A failure is an exception, and it is always an `ApiProblem`.** Including one the API never
 * sent -- a request that did not arrive is a problem with `status` 0, so a caller has one thing
 * to catch instead of two.
 *
 * Uploading is deliberately not here. `UI-18` needs per-request progress, which `fetch` cannot
 * report, and a wrapper that grew an `XMLHttpRequest` path for one endpoint would make every
 * other call pay for it in reading.
 */

import { ApiProblem, problemFrom, unreachable } from './problem';
import type { paths } from './contract/schema';

/**
 * What every path is relative to.
 *
 * Empty, and that is the answer rather than an omission: the paths in `schema.ts` already carry
 * `/api` because that is where the API is mounted (`API-16`), so a call site names the exact
 * path the document publishes and nothing is assembled out of pieces.
 *
 * It exists because an instance on a subpath (`OPS-4`) serves everything under a prefix the
 * bundle cannot be built with -- the prefix is a runtime fact of the instance, not of the
 * build. When that is closed this is the one place the client changes, and `UI-4a`'s router
 * basename is the other half of the same answer.
 */
export const DEPLOYMENT_BASE = '';

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** The statuses this API answers with when a call worked. */
type SuccessStatus = 200 | 201 | 202 | 204;

type OperationOf<P extends keyof paths, M extends Method> = M extends keyof paths[P]
  ? NonNullable<paths[P][M]>
  : never;

/** The paths that answer this method at all. Anything else is a compile error at the call. */
export type PathWith<M extends Method> = {
  [P in keyof paths]: [OperationOf<P, M>] extends [never] ? never : P;
}[keyof paths];

type ParametersOf<P extends keyof paths, M extends Method> =
  OperationOf<P, M> extends { parameters: infer Params } ? Params : never;

type PathParamsOf<P extends keyof paths, M extends Method> =
  ParametersOf<P, M> extends { path?: infer Declared } ? NonNullable<Declared> : never;

type QueryParamsOf<P extends keyof paths, M extends Method> =
  ParametersOf<P, M> extends { query?: infer Declared } ? NonNullable<Declared> : never;

/**
 * The JSON body an operation takes, or `never` when it takes none.
 *
 * The pattern requires `requestBody` rather than allowing it, because an operation without one
 * is generated as `requestBody?: never` -- which matches an optional pattern and infers the body
 * as `unknown`, making every bodyless call demand a body it has no shape for.
 */
type BodyOf<P extends keyof paths, M extends Method> =
  OperationOf<P, M> extends { requestBody: { content: { 'application/json': infer Body } } }
    ? NonNullable<Body>
    : never;

type ResponsesOf<P extends keyof paths, M extends Method> =
  OperationOf<P, M> extends { responses: infer Answers } ? Answers : never;

type JsonOf<Response_> = Response_ extends { content: { 'application/json': infer Body } }
  ? Body
  : undefined;

/** What a call resolves to: the success response's body, or nothing for a `204`. */
export type ResultOf<P extends keyof paths, M extends Method> = JsonOf<
  ResponsesOf<P, M>[Extract<keyof ResponsesOf<P, M>, SuccessStatus>]
>;

/**
 * One option, required exactly when the operation requires it.
 *
 * Three cases, and the middle one is worth writing down. `never` means the endpoint has none, so
 * passing one is an error. A group whose members are all optional -- every list endpoint's
 * filters -- is itself optional, or reading a library would mean passing an empty `query` to say
 * nothing. Anything with a required member has to be given, which is what stops a call omitting
 * the uuid it is about and finding out in the browser.
 */
type Takes<Key extends string, Value> = [Value] extends [never]
  ? Partial<Record<Key, never>>
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {} extends Value
    ? Partial<Record<Key, Value>>
    : Record<Key, Value>;

interface Common {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * A filter nobody set, spelled as such.
 *
 * `exactOptionalPropertyTypes` is on, so `{ limit: undefined }` is not the same as `{}` to the
 * compiler -- and a view reading its filters out of the URL has a value that is genuinely
 * undefined for every toggle nobody touched. The wrapper drops those rather than sending them,
 * so the type says what the runtime does.
 */
type Unset<Params> = { [Key in keyof Params]: Params[Key] | undefined };

export type CallOptions<P extends keyof paths, M extends Method> = Common &
  Takes<'path', PathParamsOf<P, M>> &
  Takes<'query', Unset<QueryParamsOf<P, M>>> &
  Takes<'body', BodyOf<P, M>>;

/**
 * Whether a call needs options at all.
 *
 * Read off the assembled options rather than off the parts: when everything in them is optional,
 * `{}` would say nothing, and `get('/api/instance')` should be the whole call.
 */
type Arguments<P extends keyof paths, M extends Method> =
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  {} extends CallOptions<P, M> ? [options?: CallOptions<P, M>] : [options: CallOptions<P, M>];

/**
 * The options as this function reads them.
 *
 * The generic types above are what a call site is checked against; this is the one shape the
 * body of the function works in, so the checking and the sending are not written twice.
 */
interface Given {
  path?: Record<string, string | number>;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** What can be written into a query string: a scalar, or repeated scalars. */
type QueryValue = string | number | boolean | null | undefined | (string | number | boolean)[];

export async function request<P extends keyof paths, M extends Method>(
  method: M,
  path: P & PathWith<M>,
  ...[options]: Arguments<P, M>
): Promise<ResultOf<P, M>> {
  const given = (options ?? {}) as Given;
  const url = DEPLOYMENT_BASE + fill(path, given.path) + search(given.query);
  const hasBody = given.body !== undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method: method.toUpperCase(),
      // The session cookie is the authorisation and the interface is served from this origin,
      // so it is sent and nothing else is. `include` would be a cross-origin arrangement that
      // does not exist here.
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...given.headers,
      },
      ...(hasBody ? { body: JSON.stringify(given.body) } : {}),
      ...(given.signal ? { signal: given.signal } : {}),
    });
  } catch (cause) {
    // An abort is the caller's own decision -- a query the person navigated away from -- and
    // reporting it as an unreachable instance would put a banner on the screen they left.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw unreachable(cause);
  }

  if (!response.ok) throw await problemFrom(response);
  return (await bodyOf(response)) as ResultOf<P, M>;
}

export function get<P extends PathWith<'get'>>(
  path: P,
  ...args: Arguments<P, 'get'>
): Promise<ResultOf<P, 'get'>> {
  return request('get', path, ...args);
}

export function post<P extends PathWith<'post'>>(
  path: P,
  ...args: Arguments<P, 'post'>
): Promise<ResultOf<P, 'post'>> {
  return request('post', path, ...args);
}

export function put<P extends PathWith<'put'>>(
  path: P,
  ...args: Arguments<P, 'put'>
): Promise<ResultOf<P, 'put'>> {
  return request('put', path, ...args);
}

export function patch<P extends PathWith<'patch'>>(
  path: P,
  ...args: Arguments<P, 'patch'>
): Promise<ResultOf<P, 'patch'>> {
  return request('patch', path, ...args);
}

/** `delete` is a keyword, and `remove` is what the views mean anyway. */
export function remove<P extends PathWith<'delete'>>(
  path: P,
  ...args: Arguments<P, 'delete'>
): Promise<ResultOf<P, 'delete'>> {
  return request('delete', path, ...args);
}

/** Put the path parameters into the path, encoded. */
function fill(template: string, params?: Record<string, string | number>): string {
  return template.replace(/{([^}]+)}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new Error(`${template} needs a ${name}, and none was given.`);
    }
    return encodeURIComponent(String(value));
  });
}

/**
 * Build the query string.
 *
 * An array becomes repeated parameters rather than one comma-joined value, because that is what
 * the API reads: `JOB-11b` made the four transcription-state toggles a repeatable parameter
 * whose values are a union, and a single joined string would filter for one state named oddly.
 * `undefined` and `null` are dropped, so a filter nobody set is a parameter nobody sends -- the
 * difference between "any state" and "state: none" is one the URL has to keep.
 */
function search(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const one of value) parameters.append(name, String(one));
      continue;
    }
    parameters.append(name, String(value));
  }
  const rendered = parameters.toString();
  return rendered ? `?${rendered}` : '';
}

/** The body, or nothing at all -- a `204` has none and `response.json()` would throw on it. */
async function bodyOf(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  return JSON.parse(text);
}

export { ApiProblem };
