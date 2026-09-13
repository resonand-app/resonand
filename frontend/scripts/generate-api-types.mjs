/**
 * Turn the committed API document into types (`UI-3a`).
 *
 * A script rather than a line in `package.json`, for the reason `generate-tokens.mjs` is one:
 * the options are the interesting part, they need explaining, and the test that checks the
 * committed file is current has to generate it exactly the same way. Two copies of a generator
 * invocation is how a file becomes unreproducible.
 *
 *     npm run api:types
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCUMENT = join(ROOT, 'src', 'api', 'contract', 'openapi.json');
export const OUTPUT = join(ROOT, 'src', 'api', 'contract', 'schema.ts');

export const BANNER = `/**
 * The API's shape, as types (\`UI-3a\`).
 *
 * Generated from \`openapi.json\` by \`npm run api:types\`. Editing it is pointless -- the check
 * in \`api-schema.node.test.ts\` fails on anything the generator would not write.
 */
`;

/**
 * How the document is read.
 *
 * `defaultNonNullable: false` because the six fields it changes are all inputs with a default --
 * `clear_language`, `clear_parent`, `transcribe` and their kind. Left on, a default makes the
 * property required, so saving a display name would mean sending `clear_language: false` beside
 * it at every call site. No response type is affected either way, which is what makes this a
 * choice about request bodies rather than a loosening of the whole surface.
 */
export const OPTIONS = { defaultNonNullable: false };

/** The file `npm run api:types` writes, as a string. */
export async function render(documentPath = DOCUMENT) {
  const ast = await openapiTS(pathToFileURL(documentPath), OPTIONS);
  return `${BANNER}\n${astToString(ast)}`;
}

/** What the document holds, for the checks that are about the document rather than the types. */
export function document(documentPath = DOCUMENT) {
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(documentPath, 'utf8'));
  return parsed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUTPUT, await render(), 'utf8');
  console.warn(`Wrote ${OUTPUT}.`);
}
