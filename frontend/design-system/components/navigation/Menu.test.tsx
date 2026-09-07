/**
 * A menu is a list of actions, and the two things it must get right are which ones it shows and
 * how a keyboard walks them (`UI-34c`).
 *
 * The first is a design rule with teeth: **there is no `disabled` on a menu item**, so an action
 * the user cannot take is absent. The test for that is a compile-time one -- the prop does not
 * exist to pass -- and the one written here is the observable half: what the menu draws is what
 * it was given, and nothing arrives greyed out.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Menu } from './Menu';
import type { MenuItem } from './Menu';

const ACTIONS: MenuItem[] = [
  { id: 'download', label: 'Download the original', icon: 'upload' },
  { id: 'move', label: 'Move to another library', icon: 'library' },
  { id: 'trash', label: 'Send to trash', icon: 'trash-2', destructive: true, separated: true },
];

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Recording options' }));
};

describe('Menu', () => {
  it('opens from its trigger and says so', async () => {
    render(<Menu label="Recording options" items={ACTIONS} />);
    const trigger = screen.getByRole('button', { name: 'Recording options' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await openMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('runs the action and closes', async () => {
    const onSelect = vi.fn();
    render(<Menu label="Recording options" items={ACTIONS} onSelect={onSelect} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move to another library' }));
    expect(onSelect).toHaveBeenCalledWith('move');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('draws only what it was given', async () => {
    // The rule, from the outside: a caller with nothing to hide passes three items and gets
    // three. A caller who filters passes two and gets two -- there is no fourth, greyed out,
    // inviting somebody to work out why.
    render(<Menu label="Recording options" items={ACTIONS.slice(0, 2)} />);
    await openMenu();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryByRole('menuitem', { name: 'Send to trash' })).toBeNull();
  });

  it('walks with the arrows and wraps at the ends', async () => {
    render(<Menu label="Recording options" items={ACTIONS} />);
    await openMenu();
    // The overlay put focus on the first item; a menu is short and known, so wrapping is right
    // here where it is wrong in a list of thirty sort orders.
    expect(screen.getByRole('menuitem', { name: 'Download the original' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Send to trash' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Download the original' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Send to trash' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Download the original' })).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    render(<Menu label="Recording options" items={ACTIONS} />);
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Recording options' })).toHaveFocus();
  });

  it('marks the destructive item rather than colouring it in a component', async () => {
    render(<Menu label="Recording options" items={ACTIONS} />);
    await openMenu();
    const trash = screen.getByRole('menuitem', { name: 'Send to trash' });
    expect(trash).toHaveAttribute('data-destructive', 'true');
    // The red is `components.css`'s, keyed off that attribute, like every other colour here.
    expect(trash.style.color).toBe('');
  });

  it('takes a trigger the caller wires itself', async () => {
    const onSelect = vi.fn();
    render(
      <Menu
        label="Library actions"
        items={ACTIONS}
        onSelect={onSelect}
        trigger={({ onToggle }) => (
          <button type="button" onClick={onToggle}>
            Actions
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeDefined();
  });
});
