/**
 * How long a name can be (`DAT-12`), for the fields that edit one (`UI-45`).
 *
 * The API refuses a longer name with `422`; a field holding `maxLength` at these numbers means it
 * never has to. `name-limits.node.test.ts` holds both against the committed `openapi.json`.
 *
 * `maxLength` counts UTF-16 code units and the API counts code points, so a name full of emoji is
 * held a little shorter in a field than the API would accept. That is the safe direction.
 */

/** A recording's title. */
export const TITLE_MAX_LENGTH = 200;

/** A library's name. */
export const LIBRARY_NAME_MAX_LENGTH = 100;
