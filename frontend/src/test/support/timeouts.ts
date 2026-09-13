/**
 * The one timeout that is not the default.
 *
 * Three test files mount every component in `design-system/` in a single tree -- the specimen
 * page, the focus and hit-target audit, and the interaction layer's check that no component
 * declares a property the stylesheet owns. Each takes a couple of seconds on its own and more
 * than five when sixty test files are competing for the machine, which is how they came to fail
 * in a full run and pass when run alone.
 *
 * It is scoped to those files rather than raised across the board on purpose: the rest of the
 * suite is component-sized, and a global raise would stop a genuinely hung test from being
 * reported as one.
 *
 * Pass it as a `describe` option: `describe('...', WHOLE_SYSTEM, () => { ... })`.
 */
export const WHOLE_SYSTEM = { timeout: 30_000 };
