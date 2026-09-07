/**
 * The mixed state, which is the only part of a checkbox worth testing (`UI-34f`).
 *
 * Two things about it are decisions rather than mechanics. It is a header's state and never an
 * item's -- it means "some of the rows below are selected", which is a fact about a set. And
 * clicking it selects the rest rather than clearing, because clearing throws away a selection
 * somebody has already spent clicks building, and there is no undo for a selection.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('reports all three states the way a screen reader reads them', () => {
    const { rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} label="Select this recording" />,
    );
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    rerender(<Checkbox checked onChange={vi.fn()} label="Select this recording" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    rerender(<Checkbox checked="mixed" onChange={vi.fn()} label="Select all" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('selects the rest from mixed rather than clearing', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked="mixed" onChange={onChange} label="Select all" />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('clears from checked', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Select all" />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('has a name, because it has no words', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select Sopar de Nadal 1998" />);
    expect(screen.getByRole('checkbox', { name: 'Select Sopar de Nadal 1998' })).toBeDefined();
  });

  it('draws a glyph for both filled states and nothing for empty', () => {
    // Checked and mixed share a fill on purpose -- both mean "this selection includes something"
    // -- so the glyph is the whole of the difference and it has to be there.
    const { rerender, container } = render(
      <Checkbox checked onChange={vi.fn()} label="Select all" />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    rerender(<Checkbox checked="mixed" onChange={vi.fn()} label="Select all" />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    rerender(<Checkbox checked={false} onChange={vi.fn()} label="Select all" />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('does nothing while it is unavailable', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Select all" disabled />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
