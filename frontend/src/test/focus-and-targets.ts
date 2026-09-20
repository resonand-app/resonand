/**
 * The two accessibility floors, read out of the stylesheet (`UI-32b`).
 *
 * One focus treatment on every interactive element, and no target under 44px. Both are stated in
 * the specification's §1.7, both were stated in the design system's README, and until `UI-32a`
 * neither existed -- there was nowhere to write them. Now that there is, the question is whether
 * every control is actually reached by them, and that is not a question a screenshot answers: a
 * ring is missing only while something has focus, and a target is small only to the person who
 * missed it.
 *
 * So this module extracts the two claims from `components.css` and `focus-and-targets.test.tsx`
 * holds the mounted system to them. Reading the stylesheet rather than restating it is the whole
 * point: a rule that stops covering a control fails, and a control added later that nothing
 * covers fails as well.
 */

import { rulesIn, selectorParts } from './interaction-layer';

/**
 * A selector rewritten to match while nothing has focus.
 *
 * `:focus-visible` is a state a test cannot put an element into -- jsdom has no pointer, no
 * heuristic and no notion of whether focus arrived from a key or a click -- so the check is
 * whether the *element* is one the rule is about, which is the selector with the state taken
 * off. `:has(:focus-visible)` collapses the same way: what is left names the wrapper, which is
 * exactly the element that draws the ring.
 */
export function withoutFocusState(selector: string): string {
  return selector.replace(/:has\(:focus-visible\)/g, '').replace(/:focus-visible/g, '');
}

export interface FocusRules {
  /** Selectors of elements that draw the ring, or draw it for a descendant. */
  draws: string[];
  /** Selectors of elements whose own outline is deliberately suppressed. */
  mutes: string[];
}

/**
 * Which selectors draw the focus ring and which suppress one.
 *
 * Both halves are needed, because `outline: none` is the way a field moves its ring to the box
 * around it -- and also the way a component loses its ring entirely. The difference is whether
 * something above it draws one, and that is what the test checks rather than trusts.
 */
export function focusRules(css: string): FocusRules {
  const draws: string[] = [];
  const mutes: string[] = [];
  for (const { selector, properties, declarations } of rulesIn(css)) {
    if (!properties.includes('outline')) continue;
    if (!selector.includes(':focus-visible')) continue;
    const suppressed = /outline\s*:\s*none/.test(declarations);
    for (const part of selectorParts(withoutFocusState(selector))) {
      (suppressed ? mutes : draws).push(part.trim());
    }
  }
  return { draws, mutes };
}

export interface TargetExemption {
  /** The `data-ds` name of the component. */
  component: string;
  why: string;
}

/**
 * The controls that do not carry `data-hit-target`, and why each is allowed not to.
 *
 * The pseudo-element that grows a 32px control to 44 cannot be applied to a stacked row: a 34px
 * row grown to 44 overlaps its neighbours by 5px at each edge, so the top of every row would
 * belong to two targets and which one a click lands on would be decided by DOM order. A
 * full-bleed row is short in one axis and the width of a panel in the other, which is a large
 * target rather than a small one -- and the specification's floor is about the second kind.
 *
 * Held to the same standard as every other list of exceptions in this repository: an entry says
 * why, and the test fails if a component stops needing its entry.
 */
export const KNOWN_SMALL_TARGETS: TargetExemption[] = [
  {
    component: 'recording-row',
    why: 'A full-bleed 36px row in a virtualised list of hundreds. Growing it to 44 would overlap the rows above and below, and 36 is the declared floor for the dense list (`UI-7`).',
  },
  {
    component: 'transcript-line',
    why: 'A full-bleed line of transcript, stacked with no gap. It is as wide as the panel and its height follows the text it holds, which is usually well over 44.',
  },
  {
    component: 'sidebar-item',
    why: 'A full-bleed 32px destination in a stacked list, and desktop-only: `UI-4f` replaces the sidebar with four bottom tabs below 720, so no finger ever meets one. Collapsed to 52px it is 32x32, and the sidebar is the one place where growing the target would push a library off the screen.',
  },
  {
    component: 'menu-row',
    why: 'A full-bleed 34px row inside an overlay 236px wide, stacked 2px apart. This is the case the components canvas drew as "34px visual / 44px target", and the overlap is why the target is the row.',
  },
  {
    component: 'search-hit',
    why: 'A full-bleed result row whose height is set by two lines of text, in an overlay as wide as the search field.',
  },
  {
    component: 'search-see-all',
    why: 'The last row of the results overlay, full-bleed, under a hairline that separates it from the hits above it.',
  },
  {
    component: 'waveform',
    why: 'Two sizes take an `onSeek`. The detail one is 130px tall by token (`--wave-height-detail`). The player one is 34px, and is the bar\'s full-bleed waveform slot -- several hundred pixels wide beside a 38px play control, which is the "34px visual, wide row" case `menu-row` and `search-hit` are here for. §3.1 requires that one to be seekable at that height. The other three sizes are not interactive at all.',
  },
  {
    component: 'select-menu',
    why: 'The listbox itself is focusable only so that it can receive the arrow keys -- nobody clicks it. What is clicked are its options, which are 32px rows in a stacked list, and the row is the target for the reason every other row here is.',
  },
  {
    component: 'create-library-card',
    why: 'A card with the same footprint as a library card: 320x188 by token. Nothing here is small.',
  },
];

/**
 * Application markup that is exempt from the 44px floor, and why (`UI-24b`).
 *
 * The parallel of `KNOWN_SMALL_TARGETS` for controls the application composes rather than the
 * design system ships. Keyed by `data-app`, which is the application's own naming, and held to
 * the same rule: an entry is a promise that this control is *a large target that is short*
 * rather than a small one -- `components.css` states the distinction, and a full-bleed control
 * whose height is set by one line of text is the case it names.
 *
 * A control that is genuinely small does not belong here. It gets `data-hit-target`, which grows
 * the target with a pseudo-element and moves nothing next to it -- which is what the recording
 * card's title link and the recording breadcrumb both got when this list was written.
 */
export const KNOWN_SMALL_TARGETS_IN_VIEWS: TargetExemption[] = [
  {
    component: 'result-title',
    why: 'The title of a search result, `flex: 1` across the whole width of the result card and clipped to one line. It is as wide as the card and as tall as its text, which is the full-bleed row case rather than a discrete control.',
  },
];
