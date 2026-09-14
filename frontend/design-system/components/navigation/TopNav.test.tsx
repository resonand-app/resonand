/**
 * The search field in the nav can be typed in, and driven from outside (`UI-1h`).
 *
 * `TopNav` passed `query` to a field that turned it into a `defaultValue`, so the prop was inert
 * and nothing said so. `UI-1e` made the field forward `value` instead, which turns a `value` with
 * no `onChange` into a field React refuses to let anybody type in -- so the fix and the regression
 * arrive together, and both are asserted here. `UI-4e` needs both to put the query in the URL.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TopNav } from './TopNav';

describe('TopNav', () => {
  it('shows the query it is given, and follows it when it changes', () => {
    const { rerender } = render(<TopNav query="rehearsal" />);
    expect(screen.getByRole('textbox')).toHaveValue('rehearsal');
    rerender(<TopNav query="field recording" />);
    expect(screen.getByRole('textbox')).toHaveValue('field recording');
  });

  it('reports typing even when nobody passed a query', async () => {
    const onQueryChange = vi.fn();
    render(<TopNav onQueryChange={onQueryChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'à');
    expect(onQueryChange).toHaveBeenCalledWith('à');
  });

  it('does not warn about a value with no handler', () => {
    // React's own warning for a controlled field nobody is listening to. It is a console message
    // rather than a failure, so it would otherwise scroll past in CI for the life of the project.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<TopNav query="rehearsal" />);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
