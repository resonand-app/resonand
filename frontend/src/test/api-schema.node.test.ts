/**
 * `schema.ts` says what `openapi.json` says (`UI-3a`).
 *
 * The interface is a client of the API and not a privileged path into it, which only stays true
 * if a backend rename reaches the frontend as a compile error. The chain has three links: the
 * backend writes the document (`sonarium openapi`, checked in CI against a running instance's
 * schema), `npm run api:types` turns it into types, and every call is typed against those. This
 * test holds the middle link -- a snapshot that moved without the types being regenerated leaves
 * the repository describing an API that no longer exists, and the compiler happily agreeing.
 *
 * It compares the rendered file rather than the AST, for the reason the token test gives: the
 * output shape of the generator is part of what has to be reproducible, and a file nobody can
 * reproduce is a file nobody can review.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { OUTPUT, document as read, render } from '../../scripts/generate-api-types.mjs';

const document = read() as Record<string, unknown>;

describe('the typed API surface', () => {
  it('is what `npm run api:types` would write today', async () => {
    expect(readFileSync(OUTPUT, 'utf8').trim()).toBe((await render()).trim());
  }, 30_000);

  it('describes the API and nothing else', () => {
    // A spot check, because the assertion above passes just as happily against two empty files.
    const paths = Object.keys(document.paths as Record<string, unknown>);
    expect(paths.length).toBeGreaterThan(40);
    expect(paths.filter((path) => !path.startsWith('/api/'))).toEqual([]);
  });

  it('names no server, so a generated URL is relative to wherever this is served from', () => {
    // An instance on a subpath publishes one. A snapshot carrying somebody's subpath would
    // prefix every call in every other deployment with it (`OPS-4`).
    expect(document.servers).toBeUndefined();
  });

  it('carries the fields the views are specified against', () => {
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas;
    for (const name of ['AudioDetail', 'AudioSummary', 'LibrarySummary', 'InstanceState']) {
      expect(schemas).toHaveProperty(name);
    }
    const detail = schemas.AudioDetail as { properties: Record<string, unknown> };
    // The two kinds of time (§1.3) and the provenance label that says which one this is.
    expect(detail.properties).toHaveProperty('recorded_at');
    expect(detail.properties).toHaveProperty('recorded_at_offset');
    expect(detail.properties).toHaveProperty('recorded_at_source');
    expect(detail.properties).toHaveProperty('created_at');
  });
});
