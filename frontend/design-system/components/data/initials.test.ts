/**
 * Initials, for names that are not English (`UI-35d`).
 *
 * The archive is Catalan, so the first letter of a name is routinely one with an accent on it --
 * and the two obvious ways to take a first letter both drop it. `name[0]` takes a UTF-16 unit and
 * `[...name][0]` takes a code point; a decomposed `À` is an `A` followed by a combining grave, so
 * both hand back a bare `A` and quietly misspell somebody's name in a circle they see every day.
 */

import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsOf('Martí Colom')).toBe('MC');
    expect(initialsOf('Àvia Teresa')).toBe('ÀT');
  });

  it('keeps an accent that is spelled as a combining mark', () => {
    expect(initialsOf('Àvia Teresa')).toBe('ÀT');
  });

  it('gives one letter rather than a blank circle for one word', () => {
    expect(initialsOf('Joana')).toBe('J');
  });

  it('ignores the middle of a long name', () => {
    expect(initialsOf('Maria del Carme Puig')).toBe('MP');
  });

  it('survives whatever somebody types into a display name', () => {
    expect(initialsOf('   ')).toBe('');
    expect(initialsOf('')).toBe('');
    expect(initialsOf('  martí   colom  ')).toBe('MC');
  });
});
