/**
 * The two text fields forward `value` instead of translating it (`UI-1e`).
 *
 * The `.jsx` these replace took a `value` prop and applied it as `defaultValue`. That is a
 * controlled-looking API over an uncontrolled field: the caller sets `value`, every later change
 * to it is ignored, and nothing warns -- which is why `TopNav`'s `query` prop could not drive its
 * own search field, and why search's design of keeping the query in the URL (§2.1) would have
 * failed in the least obvious way.
 *
 * The test is a rerender, because a single render passes either way. That is the whole shape of
 * the bug.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchField } from './SearchField';
import { TextField } from './TextField';

describe('TextField', () => {
  it('follows `value` when it changes', () => {
    const { rerender } = render(<TextField value="first" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('first');
    rerender(<TextField value="second" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('second');
  });

  it('still takes `defaultValue` for a field nobody is driving', () => {
    render(<TextField defaultValue="as typed" />);
    expect(screen.getByRole('textbox')).toHaveValue('as typed');
  });

  it('reports what was typed', async () => {
    const onChange = vi.fn();
    render(<TextField value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders the error message and not only the ring', () => {
    // An error a person can see the shape of but not read is a field they cannot fix.
    render(<TextField error="You already have a library with this name." />);
    expect(screen.getByText('You already have a library with this name.')).toBeDefined();
  });
});

describe('SearchField', () => {
  it('follows `value` when it changes', () => {
    const { rerender } = render(<SearchField value="teresa" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('teresa');
    rerender(<SearchField value="carrer nou" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('carrer nou');
  });

  it('hides the keyboard hint when there is none to give', () => {
    render(<SearchField shortcut={null} />);
    expect(screen.queryByText('⌘K')).toBeNull();
  });
});
