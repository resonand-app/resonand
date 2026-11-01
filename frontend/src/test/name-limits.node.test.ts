/**
 * The fields stop where the API does (`UI-45`).
 *
 * `src/api/limits.ts` is typed by hand, because a generated type carries no `maxLength`. So this
 * reads the committed `openapi.json` and fails when a limit moves on one side only: a field that
 * allows more than the API is a name that is typed and then refused.
 *
 * The module is read as text rather than imported, because it belongs to the application's
 * TypeScript project and this file to the Node one.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface Property {
  maxLength?: number;
  anyOf?: Property[];
}

const schemas = (
  JSON.parse(readFileSync(new URL('../api/contract/openapi.json', import.meta.url), 'utf8')) as {
    components: { schemas: Record<string, { properties: Record<string, Property> }> };
  }
).components.schemas;

const limits = readFileSync(new URL('../api/limits.ts', import.meta.url), 'utf8');

/** The number `src/api/limits.ts` exports under this name. */
function limit(name: string): number {
  const found = new RegExp(`export const ${name} = (\\d+);`).exec(limits);
  if (found?.[1] === undefined) throw new Error(`src/api/limits.ts exports no ${name}`);
  return Number(found[1]);
}

const TITLE_MAX_LENGTH = limit('TITLE_MAX_LENGTH');
const LIBRARY_NAME_MAX_LENGTH = limit('LIBRARY_NAME_MAX_LENGTH');

/** The `maxLength` a request body declares for one field, whether or not it is nullable. */
function declared(schema: string, field: string): number | undefined {
  const property = schemas[schema]?.properties[field];
  return property?.maxLength ?? property?.anyOf?.find((each) => each.maxLength)?.maxLength;
}

describe('the name limits', () => {
  it('stop a title where the API does', () => {
    expect(declared('UpdateAudio', 'title')).toBe(TITLE_MAX_LENGTH);
  });

  it('stop a library name where the API does, on create and on rename', () => {
    expect(declared('CreateLibrary', 'name')).toBe(LIBRARY_NAME_MAX_LENGTH);
    expect(declared('UpdateLibrary', 'name')).toBe(LIBRARY_NAME_MAX_LENGTH);
  });
});
