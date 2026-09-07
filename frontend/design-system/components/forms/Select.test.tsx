/**
 * The keyboard model, which is the whole reason this is not a `<select>` (`UI-34b`).
 *
 * Dropping the native control means dropping everything it did for free, and the part nobody
 * notices missing until they cannot use the product is the keyboard: `ArrowDown` to open, the
 * arrows to move, `Enter` to choose, `Home` and `End` to the ends. Each of those is asserted here
 * because each is a line of code that can be deleted without anything looking wrong.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';
import type { SelectOption } from './Select';

const SORTS: SelectOption[] = [
  { value: 'recorded', label: 'Recording date' },
  { value: 'uploaded', label: 'Upload date' },
  { value: 'duration', label: 'Duration', disabled: true },
  { value: 'title', label: 'Title' },
];

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('recorded');
  return (
    <Select
      label="Sort"
      value={value}
      options={SORTS}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole('combobox');

describe('Select', () => {
  it('shows the chosen label rather than its value', () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent('Recording date');
  });

  it('shows the placeholder when nothing is chosen', () => {
    render(<Select options={SORTS} placeholder="Any category" ariaLabel="Category" />);
    expect(trigger()).toHaveTextContent('Any category');
  });

  it('opens on ArrowDown and closes on Escape', async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    // And focus is back on the control that opened it, not on the body.
    expect(trigger()).toHaveFocus();
  });

  it('opens with the highlight on what is already chosen', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const list = screen.getByRole('listbox');
    const active = list.getAttribute('aria-activedescendant');
    expect(document.getElementById(active ?? '')).toHaveTextContent('Recording date');
  });

  it('moves with the arrows, chooses with Enter, and closes', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('uploaded');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveTextContent('Upload date');
  });

  it('steps over an option nobody may choose', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(trigger());
    // recorded -> uploaded -> (duration is disabled) -> title
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('title');
  });

  it('stops at the ends rather than wrapping', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    const list = screen.getByRole('listbox');
    // A list that wraps makes "am I at the bottom?" a question you have to keep answering.
    expect(document.getElementById(list.getAttribute('aria-activedescendant') ?? '')).toHaveTextContent(
      'Recording date',
    );
  });

  it('goes to the ends with Home and End', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{End}{Enter}');
    expect(onChange).toHaveBeenCalledWith('title');
  });

  it('does not choose an option that is disabled', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByText('Duration'));
    expect(onChange).not.toHaveBeenCalled();
    // And the menu stays open, because nothing happened.
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('says what it is and what it controls', async () => {
    render(<Harness />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Recording date');
  });

  it('cannot be opened while it is disabled', async () => {
    render(<Select options={SORTS} disabled ariaLabel="Sort" />);
    await userEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
