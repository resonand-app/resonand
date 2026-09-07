/**
 * The instance a test runs against, installed (`UI-3d`).
 *
 * `mockApi()` in a test file is the whole setup: handlers on, archive reset between tests, and
 * an unhandled request treated as a failure rather than as a pass. That last part is the point
 * -- a view that calls an endpoint nobody mocked would otherwise hang on a promise that never
 * settles and be reported as a slow test.
 */

import { setupServer } from 'msw/node';
import type { SetupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { reset } from './archive';
import { handlers } from './handlers';

export const server: SetupServer = setupServer(...handlers);

/**
 * Turn the mock instance on for this test file.
 *
 * Call it at the top level of a test file, beside the imports. `server.use(...)` inside a test
 * overrides one endpoint for that test only -- which is how a view's failure states are tested
 * without a second copy of the archive.
 */
export function mockApi(): SetupServer {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
    reset();
  });
  afterAll(() => {
    server.close();
  });
  return server;
}

export { handlers };
