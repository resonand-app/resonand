/**
 * Initials, for names that are not English (`UI-35d`).
 *
 * A display name is whatever somebody typed, so the first letter is routinely one with an accent
 * on it -- and the two obvious ways to take a first letter both drop it. `name[0]` takes a UTF-16
 * unit and `[...name][0]` takes a code point; a decomposed `Á` is an `A` followed by a combining
 * acute, so both hand back a bare `A` and quietly misspell somebody's name in a circle they see
 * every day.
 */

import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsOf('Sam Rivera')).toBe('SR');
    expect(initialsOf('Ángela Ruiz')).toBe('ÁR');
  });

  it('keeps an accent that is spelled as a combining mark', () => {
    expect(initialsOf('A\u0301ngela Ruiz')).toBe('A\u0301R');
  });

  it('gives one letter rather than a blank circle for one word', () => {
    expect(initialsOf('Alex')).toBe('A');
  });

  it('ignores the middle of a long name', () => {
    expect(initialsOf('Ana Maria Ruiz')).toBe('AR');
  });

  it('survives whatever somebody types into a display name', () => {
    expect(initialsOf('   ')).toBe('');
    expect(initialsOf('')).toBe('');
    expect(initialsOf('  sam   rivera  ')).toBe('SR');
  });
});
