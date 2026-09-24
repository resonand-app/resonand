/**
 * 🧪 Every view passes axe, and in both themes wherever the two draw different markup (`UI-23a`,
 * `INF-24`, §1.7).
 *
 * One of the four criteria the views were declared done against, checked here because this is the
 * first point at which every view exists. A per-view assertion written while that view was being
 * built would have been eight separate promises; this is one, and it is the one that keeps being
 * true.
 *
 * **Light where the markup differs, and only there.** Light is a token redefinition and not a
 * second stylesheet, so most of what changes is colour -- which axe cannot see in jsdom anyway,
 * and which `contrast.node.test.ts` owns. What an audit in light does catch is the thing a token
 * swap is not: an icon that changes with the theme, a control that draws a different label. That
 * happens in the modules that read the theme and nowhere else, so a state that puts one on the
 * page names it as `themed`, and `every-view-is-audited.node.test.ts` holds those names to every
 * module that reads it. Auditing everything twice read the same markup twenty times over.
 *
 * **And the states behind a trigger** (`UI-23a1`). A view has more surfaces than the one a URL
 * lands on: an overlay is raised by a click, a panel is reached by a query parameter, and a trash
 * with rows in it is a different screen from the good empty one. Walking `VIEWS` alone audited
 * eight first impressions and nothing else, while the harness said in its own comment that the
 * dialogs were "audited where they are raised". `STATES` is the rest of the surface.
 *
 * The companion check is `every-view-is-audited.node.test.ts`: this file walks both lists, and
 * that one holds `VIEWS` to the views on disk and `STATES` to the overlays and sections on disk.
 * Together they are `UI-23a`'s criterion -- *a new view without one fails CI* -- which neither
 * half gives on its own.
 */

import { describe, expect, it } from 'vitest';

import { mockApi } from '@/test/api/server';
import { describeViolations, violationsIn } from '@/test/support/axe';
import { STATES, VIEWS, mountState, mountView } from '@/test/support/views';

import { WHOLE_SYSTEM } from './support/timeouts';

mockApi();

/** Dark everywhere, and light as well where the surface draws something different in it. */
function themesOf(surface: { themed?: string }): readonly ('dark' | 'light')[] {
  return surface.themed === undefined ? ['dark'] : ['dark', 'light'];
}

/**
 * The audit can fail.
 *
 * Sixteen green ticks are also what a misconfigured axe produces -- a bad selector, a rule set
 * switched off wholesale, a run against a container that was already unmounted -- and the whole
 * file would keep passing for the rest of the project's life. So the run is pointed at markup
 * that is definitely wrong before it is trusted about markup that looks right.
 */
describe('the audit itself', () => {
  it('reports a control with no name, so a green run means something', async () => {
    // Into a container of its own, and taken out again: Testing Library's cleanup only removes
    // what Testing Library mounted, and markup left on `document.body` is a second `<main>` in
    // every test that runs after this one.
    const broken = document.createElement('div');
    broken.innerHTML = '<button></button>';
    document.body.append(broken);
    try {
      const violations = await violationsIn(broken);
      expect(violations.map((one) => one.id)).toContain('button-name');
    } finally {
      broken.remove();
    }
  });
});

describe.each(VIEWS)('$name', WHOLE_SYSTEM, (view) => {
  it.each(themesOf(view))('has nothing for axe to report in the %s theme', async (theme) => {
    await mountView(view, { theme });
    await nothingToReport(view.name, theme);
  });
});

describe.each(STATES)('$name', WHOLE_SYSTEM, (state) => {
  it.each(themesOf(state))('has nothing for axe to report in the %s theme', async (theme) => {
    await mountState(state, { theme });
    await nothingToReport(state.name, theme);
  });
});

/** Audit whatever is on the page, and say which surface and which theme if it fails. */
async function nothingToReport(name: string, theme: string): Promise<void> {
  const violations = await violationsIn();
  expect(
    violations,
    violations.length === 0
      ? ''
      : `${name} fails axe in the ${theme} theme:\n${describeViolations(violations)}`,
  ).toEqual([]);
}
