/**
 * 🧪 Every view passes axe, in both themes (`UI-23a`, §1.7).
 *
 * One of the four criteria the views were declared done against, checked here because this is the
 * first point at which every view exists. A per-view assertion written while that view was being
 * built would have been eight separate promises; this is one, and it is the one that keeps being
 * true.
 *
 * **Both themes, because the markup differs between them.** Light is a token redefinition and not
 * a second stylesheet, so most of what changes is colour -- which axe cannot see in jsdom anyway,
 * and which `contrast.node.test.ts` owns. What it does catch is the thing a token swap is not:
 * an icon that changes with the theme, a control that draws a different label, a state that is
 * conveyed by an attribute in one theme and not the other. Cheap to check, and the failure it
 * catches is one nobody would look for.
 *
 * The companion check is `every-view-is-audited.node.test.ts`: this file walks `VIEWS`, and that
 * one holds `VIEWS` to the views that exist on disk. Together they are `UI-23a`'s criterion --
 * *a new view without one fails CI* -- which neither half gives on its own.
 */

import { describe, expect, it } from 'vitest';

import { mockApi } from '@/test/api/server';
import { describeViolations, violationsIn } from '@/test/support/axe';
import { VIEWS, mountView } from '@/test/support/views';

import { WHOLE_SYSTEM } from './support/timeouts';

mockApi();

const THEMES = ['dark', 'light'] as const;

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
  it.each(THEMES)('has nothing for axe to report in the %s theme', async (theme) => {
    await mountView(view, { theme });
    const violations = await violationsIn();
    expect(
      violations,
      violations.length === 0
        ? ''
        : `${view.name} fails axe in the ${theme} theme:\n${describeViolations(violations)}`,
    ).toEqual([]);
  });
});
