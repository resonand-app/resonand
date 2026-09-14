/**
 * The strings, the language, and the `+30%` locale (`UI-22a`, `UI-22d`).
 */

import { describe, expect, it } from 'vitest';

import common from '../en/common.json';
import { BASE, PSEUDO, createI18n, initialLanguage, resources } from '../index';
import { EXPANSION, pseudo, pseudoBundle } from '../pseudo';

describe('the base language', () => {
  it('answers in the sentence somebody reads, not in the key', () => {
    const i18n = createI18n(BASE);
    expect(i18n.t('action.signIn')).toBe('Sign in');
    expect(i18n.t('state.offline')).toBe('The instance could not be reached. It may be offline.');
  });

  it('counts in the plural the count actually is', () => {
    const i18n = createI18n(BASE);
    expect(i18n.t('count.recordings', { count: 1 })).toBe('1 recording');
    expect(i18n.t('count.recordings', { count: 537 })).toBe('537 recordings');
  });

  it('shows a missing key as itself, so it is visible in a screenshot', () => {
    const i18n = createI18n(BASE);
    expect(i18n.t('nothing.like.this')).toBe('nothing.like.this');
  });

  it('does not escape what React is going to escape anyway', () => {
    // Otherwise an apostrophe in a library's name arrives as `&#39;`.
    const i18n = createI18n(BASE);
    expect(i18n.t('time.notItsOwn', { date: "Alex's archive" })).toContain("Alex's archive");
  });
});

describe('the +30% locale', () => {
  it('is longer than the English it came from', () => {
    const english = 'Sign in';
    expect(pseudo(english).length).toBeGreaterThanOrEqual(
      english.length + Math.ceil(english.length * EXPANSION),
    );
  });

  it('keeps the placeholders, which have to survive to be replaced', () => {
    expect(pseudo('{{count}} recordings')).toContain('{{count}}');
  });

  it('brackets each string, so a truncated one is visible as truncated', () => {
    const rendered = pseudo('Sign in');
    expect(rendered.startsWith('«')).toBe(true);
    expect(rendered.endsWith('»')).toBe(true);
  });

  it('is obviously not English, so an un-externalised label stands out beside it', () => {
    expect(pseudo('Save')).not.toContain('Save');
  });

  it('covers every string the English bundle has', () => {
    const flatten = (value: unknown, path = ''): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, inner]) => flatten(inner, `${path}.${key}`))
        : [path];
    expect(flatten(pseudoBundle(common))).toEqual(flatten(common));
  });

  it('is a real locale the interface can be switched into', () => {
    const i18n = createI18n(PSEUDO);
    expect(i18n.t('action.save')).toContain('«');
    expect(resources[PSEUDO]).toBeDefined();
  });
});

describe('which language to start in', () => {
  it('takes an explicit request in development', () => {
    expect(initialLanguage('?lang=pseudo', [], true)).toBe(PSEUDO);
  });

  it('refuses the pseudo-locale in a build, where it is a bug and not a tool', () => {
    expect(initialLanguage('?lang=pseudo', [], false)).toBe(BASE);
  });

  it('falls back to English, which is the only language that ships', () => {
    expect(initialLanguage('', ['de-DE', 'ca-ES'], false)).toBe(BASE);
    expect(initialLanguage('', ['en-GB'], false)).toBe('en-GB');
  });
});
