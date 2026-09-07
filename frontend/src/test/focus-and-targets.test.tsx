/**
 * Nothing focusable is invisible when focused, and nothing tappable is under 44px (`UI-32b`).
 *
 * `UI-32b`'s criterion, as the test it asks for: a walk over every focusable element the system
 * renders. The two failures it exists to catch are the two that a person looking at a screen
 * cannot see. A missing focus ring is visible only while something has focus, and it is invisible
 * to everybody who arrived by mouse -- so the control it belongs to works perfectly for the person
 * who built it and is unreachable for somebody who cannot use a pointer. A small target is
 * invisible to whoever hits it first time.
 *
 * Both claims are read out of `components.css` rather than restated here. That way a rule that
 * stops covering a control fails, and a control added later that no rule covers fails as well --
 * which is the case that actually happens, because `UI-34` is about to add thirteen of them.
 *
 * **jsdom has no layout**, so nothing here measures a pixel: `getBoundingClientRect` is all
 * zeroes and would make every assertion pass. The chain checked instead is the one that produces
 * the pixels -- the control carries `data-hit-target`, the stylesheet grows that to
 * `var(--hit-target)` in both axes, and `--hit-target` is 44px in `tokens/spacing.css`. Each link
 * is checked, and the last one is checked against the token rather than against the number.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/design-system';
import CSS from '@/design-system/components.css?raw';
import Specimens from '@/dev/Specimens';

import { focusRules, KNOWN_SMALL_TARGETS, withoutFocusState } from './focus-and-targets';
import { rulesIn } from './interaction-layer';

const { draws, mutes } = focusRules(CSS);

/* The layout tokens as text. Through `import.meta.glob` rather than as an import, because the
   barrel rule reads a `?raw` exception at the top of the system and not one a directory down --
   and a token file is not a component reached past the barrel either way. */
const SPACING = Object.values(
  import.meta.glob<string>('../../design-system/tokens/spacing.css', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).join('');

/**
 * Everything in the mounted system a keyboard can reach.
 *
 * `tabIndex >= 0` rather than a list of element names: jsdom computes it the way a browser does,
 * so a `<button>`, an `<input>`, an `<a href>` and a `<div role="button" tabIndex={0}>` all
 * answer for themselves and a `tabIndex={-1}` scroll target correctly does not.
 *
 * Scoped to the system: an element is in the walk if it carries `data-ds` or sits inside
 * something that does. The specimen page frames the seventeen guideline cards in `<iframe>`s,
 * which are focusable, are not components, and are not what this is about.
 */
function reachable(): HTMLElement[] {
  const { container } = render(
    <ThemeProvider>
      <Specimens />
    </ThemeProvider>,
  );
  return [...container.querySelectorAll<HTMLElement>('*')].filter(
    (element) => element.tabIndex >= 0 && element.closest('[data-ds]') !== null,
  );
}

/** How a failure names an element, so a red test says which control to go and look at. */
function describeElement(element: HTMLElement): string {
  const owner = element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? '?';
  const label = element.getAttribute('aria-label');
  const name = label ?? element.textContent.slice(0, 30);
  return `${element.tagName.toLowerCase()} in ${owner} (${name.trim()})`;
}

describe('the focus treatment', () => {
  it('is one treatment, and it is the one the specification names', () => {
    // A 2px `--accent` ring at 2px offset (§1.7). Every rule that draws a ring draws this ring:
    // two treatments is the failure this is guarding against, not a missing one.
    const rings = rulesIn(CSS).filter(
      (rule) =>
        rule.selector.includes(':focus-visible') && /outline\s*:\s*var/.test(rule.declarations),
    );
    expect(rings.length).toBeGreaterThan(0);
    for (const rule of rings) {
      expect(rule.declarations).toContain('var(--focus-ring-width) solid var(--accent)');
      expect(rule.declarations).toContain('var(--focus-ring-offset)');
    }
  });

  it('reaches every focusable element in the system', () => {
    const walked = reachable();
    // The walk finds the system rather than nothing, which is the one way this file could pass
    // while checking no controls at all.
    expect(walked.length).toBeGreaterThan(20);

    const uncovered = walked
      .filter((element) => {
        const own = draws.some((selector) => element.matches(selector));
        const muted = mutes.some((selector) => element.matches(selector));
        // A suppressed outline is only allowed where something above it draws the ring instead:
        // a field puts it around the box so it follows the control's own radius.
        const above = element.parentElement?.closest(draws.join(', ')) ?? null;
        return (!own || muted) && above === null;
      })
      .map(describeElement);

    expect(uncovered).toEqual([]);
  });

  it('draws the ring around a field box rather than around its input', () => {
    const walked = reachable();
    const inputs = walked.filter((element) => element.tagName === 'INPUT');
    expect(inputs.length).toBeGreaterThan(1);
    for (const input of inputs) {
      // Muted on the input, drawn on the wrapper. Both halves, because the first without the
      // second is exactly the `outline: none` that `UI-32b` was written to remove.
      expect(
        mutes.some((selector) => input.matches(selector)),
        describeElement(input),
      ).toBe(true);
      expect(input.parentElement?.closest(draws.join(', '))).not.toBeNull();
    }
  });

  it('is suppressed nowhere in a style object', () => {
    // The way the two shipped fields lost their ring, and the one way a stylesheet cannot answer.
    for (const element of reachable()) {
      expect(element.style.outline, describeElement(element)).toBe('');
    }
  });
});

describe('the 44px floor', () => {
  it('rests on a token, not on a number', () => {
    expect(SPACING).toMatch(/--hit-target:\s*44px/);
    const grower = rulesIn(CSS).find((rule) => rule.selector.includes('[data-hit-target]::after'));
    expect(grower).toBeDefined();
    // Both axes, and each independently: a 34px pill 150px wide grows down and not sideways.
    expect(grower?.declarations).toContain('min-width: var(--hit-target)');
    expect(grower?.declarations).toContain('min-height: var(--hit-target)');
    // Grown rather than moved: the target is centred on the control it belongs to.
    expect(grower?.declarations).toContain('position: absolute');
    expect(grower?.declarations).toContain('translate: -50% -50%');
  });

  it('covers every focusable control that is not excused', () => {
    const excused = new Set(KNOWN_SMALL_TARGETS.map((entry) => entry.component));
    const small = reachable()
      .filter((element) => {
        if (element.closest('[data-hit-target]') !== null) return false;
        const owner = element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? '?';
        return !excused.has(owner);
      })
      .map(describeElement);
    expect(small).toEqual([]);
  });

  it('holds no excuse for a control that is no longer small', () => {
    // The other direction, for the same reason the colour guard checks it: an exemption that
    // outlives the thing it excuses is how a list like this becomes a place to put things.
    const walked = reachable();
    const stillSmall = new Set(
      walked
        .filter((element) => element.closest('[data-hit-target]') === null)
        .map((element) => element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? '?'),
    );
    const stale = KNOWN_SMALL_TARGETS.filter((entry) => !stillSmall.has(entry.component));
    expect(stale).toEqual([]);
  });

  it('says why for each control it excuses', () => {
    for (const entry of KNOWN_SMALL_TARGETS) expect(entry.why.length).toBeGreaterThan(60);
  });
});

describe('the check itself', () => {
  it('would notice a ring that was taken away', () => {
    // Every assertion above is derived from the stylesheet, so a stylesheet that said nothing
    // would satisfy all of them quietly. This is the guard on that: the derivation finds rules.
    expect(draws.length).toBeGreaterThan(1);
    expect(mutes.length).toBeGreaterThan(1);
    expect(withoutFocusState("[data-ds='field-box']:has(:focus-visible)")).toBe(
      "[data-ds='field-box']",
    );
    expect(withoutFocusState('button:focus-visible')).toBe('button');
  });
});
