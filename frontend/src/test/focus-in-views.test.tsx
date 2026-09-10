/**
 * 🧪 The focus treatment reaches every interactive element in every view (`UI-23c`, §1.7).
 *
 * `focus-and-targets.test.tsx` holds the design system to this by mounting all thirty-two
 * components. What it cannot see is the application: a view is components *arranged*, and the
 * wrappers, rows and hit areas written in `src/features/` are markup no specimen page contains.
 * That gap is why `UI-23c` is a Phase F task rather than something `UI-32b` finished.
 *
 * **What actually makes this hold, stated plainly.** `components.css` opens with one blanket rule
 * -- a `:where()` list ending in `[tabindex]:not([tabindex^='-'])` -- so anything a keyboard can
 * reach gets the ring by construction, application markup included. This file is therefore not
 * discovering that each control was remembered; it is guarding the two ways that guarantee can be
 * lost, and it is worth having precisely because the guarantee is invisible:
 *
 * - **the rule gets narrowed.** Someone replaces the `:where()` list with the four tags they were
 *   thinking about, and every `role="button"` row in the library loses its ring silently.
 * - **a control opts out inline.** `style={{ outline: 'none' }}` beats every rule in the file, and
 *   is exactly how the two shipped fields lost their ring before `UI-32b`.
 *
 * Both are checked against the mounted views rather than against the stylesheet alone, because
 * what has to be true is that the rule covers *these* controls -- and the walk is unscoped, so an
 * element outside `[data-ds]` is application markup and is checked like anything else.
 *
 * The contrast half of `UI-23c` is not here. AA in both themes is `contrast.node.test.ts`, which
 * resolves each token through its `var()` chain and computes the real ratios -- a stronger check
 * than a rendered page could give, and one jsdom could not perform at all.
 */

import { describe, expect, it } from 'vitest';

import CSS from '@/design-system/components.css?raw';
import { mockApi } from '@/test/api/server';
import { VIEWS, mountView } from '@/test/views';

import { focusRules } from './focus-and-targets';
import { WHOLE_SYSTEM } from './timeouts';

mockApi();

const { draws, mutes } = focusRules(CSS);

/**
 * Everything in the mounted view a keyboard can reach.
 *
 * `tabIndex >= 0` rather than a list of tag names, for the reason the system's own walk uses it:
 * jsdom computes it the way a browser does, so a `<button>`, an `<a href>` and a
 * `<div role="button" tabIndex={0}>` all answer for themselves, and a `tabIndex={-1}` scroll
 * target correctly does not.
 */
function reachable(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('*')].filter(
    (element) => element.tabIndex >= 0,
  );
}

/** How a failure names an element, so a red test says which control to go and look at. */
function describeElement(element: HTMLElement): string {
  const owner = element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? 'application markup';
  const name = element.getAttribute('aria-label') ?? element.textContent.slice(0, 30);
  return `${element.tagName.toLowerCase()} in ${owner} (${name.trim()})`;
}

/**
 * Whether anything draws a ring for this element -- itself, or something above it.
 *
 * `rules` is a parameter rather than the module's `draws` so that the guard at the bottom can ask
 * the same question with nothing to answer it, and prove the coverage comes from the stylesheet.
 */
function covered(element: HTMLElement, rules: readonly string[] = draws): boolean {
  const own = rules.some((selector) => element.matches(selector));
  const muted = mutes.some((selector) => element.matches(selector));
  // A suppressed outline is only allowed where something above draws the ring instead: a field
  // puts it around the box so it follows the control's own radius.
  const above =
    rules.length === 0 ? null : (element.parentElement?.closest(rules.join(', ')) ?? null);
  return (own && !muted) || above !== null;
}

describe.each(VIEWS)('$name', WHOLE_SYSTEM, (view) => {
  it('draws the focus ring on every control a keyboard can reach', async () => {
    await mountView(view);
    const walked = reachable();
    // The view has controls at all, which is the one way this could pass having checked nothing.
    expect(walked.length, `${view.name} rendered nothing focusable`).toBeGreaterThan(0);

    const uncovered = walked.filter((element) => !covered(element)).map(describeElement);
    expect(uncovered).toEqual([]);
  });

  it('suppresses no ring in a style object', async () => {
    await mountView(view);
    for (const element of reachable()) {
      expect(element.style.outline, describeElement(element)).toBe('');
    }
  });
});

describe('the check itself', WHOLE_SYSTEM, () => {
  it('is answered by the stylesheet and not by the walk', async () => {
    // Every assertion above passes because a rule in `components.css` matches. With no rules to
    // match, the same controls must come back uncovered -- otherwise `covered` is returning true
    // for a reason of its own and the whole file is decoration.
    const [first] = VIEWS;
    if (first === undefined) throw new Error('VIEWS is empty, so nothing above checked anything.');
    await mountView(first);
    const walked = reachable();
    expect(walked.length).toBeGreaterThan(0);
    expect(walked.every((element) => !covered(element, []))).toBe(true);
  });

  it('rests on the blanket rule, so narrowing it fails here', () => {
    // The `:where()` list is what carries application markup. If it is ever replaced by a list of
    // tag names, a `role="button"` row keeps working and stops being visible when focused, which
    // is the failure nobody reports because everybody who would notice arrived by mouse.
    const blanket = draws.find((selector) => selector.startsWith(':where('));
    expect(blanket).toBeDefined();
    expect(blanket).toContain("[tabindex]:not([tabindex^='-'])");
  });
});
