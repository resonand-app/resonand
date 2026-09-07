/**
 * One tab stop for the whole strip, and the arrows move within it (`UI-34d`).
 *
 * The reason it is not a row of buttons. Settings has four sections; as four tab stops they cost
 * four presses of `Tab` on the way to whatever somebody actually came to change, every time, for
 * the life of the product. The ARIA pattern costs one, and the difference is entirely in the
 * `tabIndex` and the arrow handling below.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Tabs } from './Tabs';

const SECTIONS = [
  { value: 'account', label: 'Account' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'administration', label: 'Administration' },
];

function Harness() {
  const [value, setValue] = useState('account');
  return <Tabs label="Settings sections" tabs={SECTIONS} value={value} onChange={setValue} />;
}

describe('Tabs', () => {
  it('is one tab stop, whichever tab is current', async () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('tabindex', '-1');
    await userEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('tabindex', '0');
  });

  it('moves and switches on one key', async () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'Account' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    // Focus follows selection: after one key a keyboard is looking at what a pointer would be.
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveFocus();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Sessions');
  });

  it('wraps, and goes to the ends', async () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'Account' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Administration');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Account');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Administration');
  });

  it('says which one is current rather than only drawing it', () => {
    render(<Harness />);
    // The accent bar is a `box-shadow` in `components.css`, keyed off `data-selected`. Somebody
    // who cannot see it reads `aria-selected` instead, and both come from the same fact.
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Account');
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('data-selected', 'true');
  });

  it('names the strip', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Settings sections' })).toBeDefined();
  });
});
