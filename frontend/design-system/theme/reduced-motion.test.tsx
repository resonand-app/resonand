/**
 * With reduced motion set, nothing moves on its own (`UI-32c`).
 *
 * The criterion is end to end, and so is the check, because the preference is honoured in three
 * different places and each of them can fail on its own.
 *
 * **The tokens zero.** `tokens/motion.css` sets both durations to `0ms` under the media query.
 * **Every transition reads one of them.** That is what makes the first fact sufficient rather
 * than decorative: a component with `transition: background 120ms` would keep animating, and
 * nothing about it would look wrong in a review. **A script asks.** The transcript follows
 * playback by scrolling, and a smooth scroll is a movement no stylesheet can intervene in.
 *
 * The first two are read out of the stylesheets. The third is this hook, and it is tested against
 * a `matchMedia` that answers both ways -- including the environment that does not implement it
 * at all, which is the one a test runs in by default.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion, scrollBehaviour, usePrefersReducedMotion } from './reduced-motion';

/** Every stylesheet in the system, as text. */
const STYLES = import.meta.glob<string>(['../tokens/*.css', '../components.css'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every component source, as text. */
const SOURCES = import.meta.glob<string>('../components/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const read = (name: string) =>
  Object.entries(STYLES).find(([path]) => path.endsWith(name))?.[1] ?? '';

/**
 * A `matchMedia` that answers one way and reports listeners.
 *
 * jsdom implements neither `matchMedia` nor any media query behind it, so a hook that reads one
 * has to be given something to read. The stub is deliberately faithful about the listener pair:
 * a hook that subscribes and never unsubscribes leaks, and that is checked here rather than
 * discovered in a view that mounts a hundred transcript lines.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  return listeners;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the tokens', () => {
  it('zero both durations when reduced motion is asked for', () => {
    const motion = read('motion.css');
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(motion)?.[1];
    expect(reduced).toBeDefined();
    expect(reduced).toMatch(/--duration-state:\s*0ms/);
    expect(reduced).toMatch(/--duration-panel:\s*0ms/);
  });

  it('are the only durations anything reads', () => {
    // The fact that makes the zeroing sufficient rather than decorative. A literal duration
    // written into a component survives the media query and looks, in a review, like every other
    // transition in the system.
    const found: { where: string; value: string }[] = [];
    for (const [path, source] of Object.entries(SOURCES)) {
      if (path.includes('.test.')) continue;
      for (const match of source.matchAll(/transition:\s*\n?\s*'([^']*)'/g)) {
        found.push({ where: path, value: match[1] ?? '' });
      }
    }
    // `components.css` declares none today -- the transitions are the components' own -- so this
    // reaches for them anyway rather than assuming, because that is where the next one will go.
    // Comments come out first: that file's prose says the word `transition` several times.
    const rules = read('components.css').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of rules.matchAll(/(?:^|[;{])\s*transition:([^;}]*)/g)) {
      found.push({ where: 'components.css', value: match[1] ?? '' });
    }

    // Non-empty, because "no transition uses a literal" is also true of no transitions.
    expect(found.length).toBeGreaterThan(10);
    expect(found.filter((entry) => /\d+m?s/.test(entry.value))).toEqual([]);
    // And each does read a token, rather than merely not reading a number.
    expect(found.filter((entry) => !entry.value.includes('var(--transition-'))).toEqual([]);
  });

  it('let the platform stop scrolling on its own as well', () => {
    // The declarative half of the scroll case: it does nothing for `scrollTo({behavior})`, and
    // everything for a fragment link and a `scroll-behavior` set anywhere else later.
    const components = read('components.css');
    const reduced = components.slice(components.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('scroll-behavior: auto');
  });
});

describe('usePrefersReducedMotion', () => {
  it('reports the preference when the device has one', () => {
    stubMatchMedia(true);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it('reports no preference when the device has none', () => {
    stubMatchMedia(false);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it('subscribes while mounted and lets go afterwards', () => {
    const listeners = stubMatchMedia(true);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('renders the interface as designed where matchMedia does not exist', () => {
    // The default test environment, and any older browser. Of the two possible defaults, the one
    // that draws the product the way it was drawn is the safer answer.
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
});

describe('scrollBehaviour', () => {
  it('is the whole of the decision a call site has to make', () => {
    // `behavior: 'smooth'` as a literal is the one movement that survives every token, every
    // media query and every stylesheet. This is what `UI-12b` writes instead.
    expect(scrollBehaviour(true)).toBe('auto');
    expect(scrollBehaviour(false)).toBe('smooth');
  });
});
