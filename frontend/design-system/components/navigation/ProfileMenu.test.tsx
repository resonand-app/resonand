/**
 * 🧪 The account menu is a menu (`INF-24a`).
 *
 * It said so -- `role="menu"` -- and drew three plain buttons inside it, which axe reads as a menu
 * with nothing in it and a screen reader as a promise the arrow keys did not keep. Nothing had
 * audited it, because nothing raised it. Its rows are items now, and they walk the way `Menu`'s
 * do, through the same `stepMenuFocus`.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProfileMenu } from './ProfileMenu';

function renderMenu() {
  render(<ProfileMenu name="Ángela Ruiz" email="angela@example.test" theme="Dark" />);
  return within(screen.getByRole('menu')).getAllByRole('menuitem');
}

describe('ProfileMenu', () => {
  it('draws its three rows as the items of the menu it says it is', () => {
    const rows = renderMenu();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(/Theme/);
    expect(rows[1]).toHaveAccessibleName('Settings');
    expect(rows[2]).toHaveAccessibleName('Sign out');
  });

  it('walks its rows with the arrow keys, wrapping at either end', async () => {
    const [theme, settings, signOut] = renderMenu();
    theme?.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(settings).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(theme).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(signOut).toHaveFocus();
  });

  it('jumps to either end with Home and End', async () => {
    const [theme, , signOut] = renderMenu();
    theme?.focus();
    await userEvent.keyboard('{End}');
    expect(signOut).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(theme).toHaveFocus();
  });
});
