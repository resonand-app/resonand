/**
 * What a failure is, on this side of the wire (`UI-3b`, §1.9).
 *
 * Every endpoint fails the same way -- `application/problem+json` carrying `type`, `title`,
 * `detail` and `status` -- so the interface parses that shape once, here, and every view is
 * handed a value rather than a response to interpret. The four rules §1.9 states are properties
 * of this object and not conventions a view is trusted to remember:
 *
 * - **`detail` is written to be shown to a person, so show it.** `message` is `detail`, and
 *   there is deliberately no per-status wording to substitute for it.
 * - **404 means "no such thing", including things that exist but are not yours.** The ACL
 *   answers 404 rather than 403 on purpose (`DEC-14`), so `isMissing` is the only thing the
 *   interface knows -- and it may never be rendered as "you do not have permission".
 * - **409 is a conflict the person can resolve**, so it belongs in front of them as a choice.
 * - **422 is field-level**, so `fields` carries the field names and a banner is the wrong place.
 *
 * A transport failure is the one problem the API did not write. It arrives here as a problem all
 * the same, because a view that has to tell "the instance answered badly" from "the instance did
 * not answer" in every `catch` is a view that will get it wrong somewhere.
 */

/** One field the request got wrong, as `422` reports it. */
export interface FieldProblem {
  field: string;
  detail: string;
}

/** The body every failure arrives in. */
export interface ProblemDocument {
  type: string;
  title: string;
  detail: string;
  status: number;
  // Written out with `undefined` because `exactOptionalPropertyTypes` is on: a document being
  // built up from a response that may or may not carry one has to be able to say so.
  request_id?: string | undefined;
  errors?: FieldProblem[] | undefined;
}

/** The status the interface gives a failure that never reached the instance. */
export const UNREACHABLE = 0;

/**
 * The instance could not be reached at all -- offline, stopped, or a proxy in between.
 *
 * Written here rather than taken from a response, because there is no response. It states the
 * fact and does not apologise, which is what §1.5 asks of every message the product writes.
 */
export const UNREACHABLE_DETAIL = 'The instance could not be reached. It may be offline.';

export class ApiProblem extends Error {
  readonly type: string;
  readonly title: string;
  readonly detail: string;
  readonly status: number;
  readonly requestId: string | undefined;
  readonly fields: FieldProblem[];

  constructor(document: ProblemDocument) {
    // `detail` and not `title`, so `message` -- what an unhandled rejection prints, what a
    // failing test prints, and what a view reaches for first -- is already the sentence the API
    // wrote to be shown to a person. There is nothing else to substitute for it (§1.9).
    super(document.detail);
    this.name = 'ApiProblem';
    this.type = document.type;
    this.title = document.title;
    this.detail = document.detail;
    this.status = document.status;
    this.requestId = document.request_id;
    this.fields = document.errors ?? [];
  }

  /** No session, or it expired. The only status the interface answers by leaving the view. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /**
   * There is no such thing here.
   *
   * Including things that exist and are not yours: the ACL refuses with 404 so that a 403 cannot
   * confirm a recording exists (`DEC-14`). "Not found" is therefore the whole of what the
   * interface knows, and "you do not have permission to see this" is a sentence it may not write
   * -- `no-permission-wording.test.ts` is what keeps that true across the views.
   */
  get isMissing(): boolean {
    return this.status === 404;
  }

  /** Something the person can resolve -- a name already taken, a job already running. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** A field-level problem, which belongs next to the field rather than in a banner. */
  get isFieldProblem(): boolean {
    return this.status === 422 && this.fields.length > 0;
  }

  /** The instance never answered. Distinct from every status it could have answered with. */
  get isUnreachable(): boolean {
    return this.status === UNREACHABLE;
  }

  /** What went wrong on the field named, if anything did. */
  fieldDetail(field: string): string | undefined {
    return this.fields.find((problem) => problem.field === field)?.detail;
  }
}

/** Whether an unknown caught value is one of ours. */
export function isApiProblem(value: unknown): value is ApiProblem {
  return value instanceof ApiProblem;
}

/**
 * Read a failed response into a problem.
 *
 * A body that is not a problem document still becomes one: a proxy's HTML error page, an empty
 * 502, a truncated response. The status is the one thing always known, so it carries the title
 * and the interface says what it can rather than throwing a parse error over a network error.
 */
export async function problemFrom(response: Response): Promise<ApiProblem> {
  const fallback: ProblemDocument = {
    type: '/errors/error',
    title: 'Error',
    detail: `The instance answered ${String(response.status)} and said nothing more.`,
    status: response.status,
  };
  const requestId = response.headers.get('x-request-id') ?? undefined;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new ApiProblem({ ...fallback, ...(requestId ? { request_id: requestId } : {}) });
  }
  if (!isProblemDocument(body)) {
    return new ApiProblem({ ...fallback, ...(requestId ? { request_id: requestId } : {}) });
  }
  // The header is the fallback for the body's own `request_id`, not the other way round: a
  // proxy can add a header, and only the instance writes the field.
  return new ApiProblem({
    ...body,
    status: body.status || response.status,
    ...((body.request_id ?? requestId) ? { request_id: body.request_id ?? requestId } : {}),
  });
}

/** The problem the interface writes itself, for a request that never arrived. */
export function unreachable(cause: unknown): ApiProblem {
  const problem = new ApiProblem({
    type: '/errors/unreachable',
    title: 'No answer',
    detail: UNREACHABLE_DETAIL,
    status: UNREACHABLE,
  });
  problem.cause = cause;
  return problem;
}

function isProblemDocument(value: unknown): value is ProblemDocument {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProblemDocument>;
  return typeof candidate.detail === 'string' && typeof candidate.title === 'string';
}
