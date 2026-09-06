/**
 * `token()` is the only thing standing between a component and a literal colour (`UI-1c`).
 *
 * The union is what makes a typo a compile error; this is the two-line function that turns a
 * checked name into something CSS will accept. The names themselves are checked against the
 * stylesheets by `design-system-tokens.node.test.ts`, which reads the CSS -- what is asserted
 * here is only the shape it hands back.
 */

import { describe, expect, it } from 'vitest';

import { token, TOKENS } from './tokens';

describe('token()', () => {
  it('wraps a name as a CSS value', () => {
    expect(token('--accent')).toBe('var(--accent)');
    expect(token('--wave-height-detail')).toBe('var(--wave-height-detail)');
  });

  it('accepts every name it declares', () => {
    for (const name of TOKENS) expect(token(name)).toBe(`var(${name})`);
  });
});
