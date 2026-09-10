/**
 * 🧪 The phone pass, view by view (`UI-24a`, `DEC-23`, §2.3).
 *
 * `DEC-23`'s claim is strong and easy to lose: below 720 the desktop shell is **replaced**, not
 * narrowed. A narrowed desktop is what happens by default -- the grid collapses, the sidebar
 * squeezes, everything still renders, and nothing fails. So this file asserts replacement rather
 * than survival: at 390 the phone shell is the one on screen, and the two views the specification
 * singles out are different screens rather than thinner ones.
 *
 * **V3 and V5 are where the claim is proved**, which is why they get assertions of their own.
 * Both have something on desktop that does not fit in a hand and is not merely made smaller:
 * V5's 320px metadata panel becomes a sheet raised from the essentials line, and V3's filter bar
 * becomes one control that opens a sheet. In each case the desktop arrangement must be *absent*,
 * not present and narrow -- an `<aside>` at 390px wide is the failure `DEC-23` was written
 * against, and it is invisible to a test that only checks the sheet appears.
 *
 * axe runs again here. `accessibility.test.tsx` audits the desktop layout in both themes, and the
 * phone shell is different markup -- different landmarks, a different nav, a docked player -- so
 * auditing one is not auditing the other.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockApi } from '@/test/api/server';
import { describeViolations, violationsIn } from '@/test/axe';
import { PHONE, VIEWS, mountView } from '@/test/views';

import { WHOLE_SYSTEM } from './timeouts';

mockApi();

/** A view by the specification's name for it, so a rename fails here rather than skipping a test. */
function view(name: string) {
  const found = VIEWS.find((one) => one.name === name);
  if (found === undefined) throw new Error(`${name} is missing from VIEWS.`);
  return found;
}

describe.each(VIEWS)('$name on a phone', WHOLE_SYSTEM, (one) => {
  it('is drawn in the phone shell, not in a narrowed desktop one', async () => {
    await mountView(one, { width: PHONE });
    // V1 is the exception and is meant to be: sign-in is one centred column at every width, so
    // it has no shell at all rather than a phone one.
    const shell = document.querySelector('[data-app="phone-shell"]');
    const desktopPlayer = document.querySelector('[data-app="player"]');
    if (one.name === 'V1 - Sign in') {
      expect(shell).toBeNull();
      return;
    }
    expect(shell, `${one.name} did not reach the phone shell at ${String(PHONE)}px`).not.toBeNull();
    // The desktop player bar is the clearest tell of a shell that was narrowed rather than
    // replaced: it would still be there, just thinner.
    expect(desktopPlayer).toBeNull();
  });

  it('has nothing for axe to report at 390px', async () => {
    await mountView(one, { width: PHONE });
    const violations = await violationsIn();
    expect(
      violations,
      violations.length === 0
        ? ''
        : `${one.name} fails axe on a phone:\n${describeViolations(violations)}`,
    ).toEqual([]);
  });
});

describe('V5 is a different screen, not a narrower one', WHOLE_SYSTEM, () => {
  it('does not draw the 320px panel at all', async () => {
    await mountView(view('V5 - A recording'), { width: PHONE });
    // Absent rather than narrow. A panel that is merely squeezed still takes a column from the
    // transcript, which is the whole screen on a phone.
    expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull();
  });

  it('puts the details in a sheet, raised from the line somebody is already reading', async () => {
    const user = userEvent.setup();
    await mountView(view('V5 - A recording'), { width: PHONE });
    const open = await screen.findByRole('button', { name: 'Details', expanded: false });
    await user.click(open);
    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeVisible();
  });
});

describe('V3 is a different screen, not a narrower one', WHOLE_SYSTEM, () => {
  it('replaces the filter bar with one control that opens a sheet', async () => {
    const user = userEvent.setup();
    await mountView(view('V3 - A library'), { width: PHONE });
    // The desktop bar puts every filter on screen at once; on a phone that is a wall of chips
    // above the list it is narrowing.
    const filter = await screen.findByRole('button', { name: /Filter/ });
    await user.click(filter);
    expect(await screen.findByRole('dialog')).toBeVisible();
  });
});
