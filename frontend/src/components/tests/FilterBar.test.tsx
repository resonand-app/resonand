/**
 * The row above a list, and the row that replaces it (`UI-35g`, `UI-35h`).
 *
 * One thing about the pair is worth a test rather than a comment: they are the same height. A list
 * that moves when the first checkbox is ticked is a list where the second click lands on the wrong
 * recording, and that is a regression a screenshot review would pass.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button, Chip } from '@/design-system';

import { BulkBar } from '../BulkBar';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('holds whatever the view filters by', () => {
    render(
      <FilterBar
        filters={<Chip active>Transcribed</Chip>}
        sort={<Button variant="secondary">Recording date</Button>}
        meta="37 recordings"
      />,
    );
    expect(screen.getByText('Transcribed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Recording date' })).toBeDefined();
    expect(screen.getByText('37 recordings')).toBeDefined();
  });

  it('draws no divider when there is nothing on the right of it', () => {
    // Search has no view switch and no sort of its own; a rule with nothing after it is a rule
    // that looks like a mistake.
    const { container } = render(<FilterBar filters={<Chip>Any state</Chip>} />);
    expect(container.querySelectorAll('span').length).toBeLessThan(3);
  });
});

describe('BulkBar', () => {
  it('reports a count and never a list of names', () => {
    render(<BulkBar count={200} allSelected="mixed" onSelectAll={vi.fn()} onClear={vi.fn()} />);
    // It has to survive 200 selected: a bar that lists what it can and truncates the rest tells
    // somebody less the more they have selected.
    expect(screen.getByText('200 selected')).toBeDefined();
  });

  it('offers select-all from the header checkbox', async () => {
    const onSelectAll = vi.fn();
    render(<BulkBar count={12} allSelected="mixed" onSelectAll={onSelectAll} onClear={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));
    // Mixed selects the rest rather than clearing, which is `Checkbox`'s rule and the reason the
    // header uses one.
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  it('clears', async () => {
    const onClear = vi.fn();
    render(<BulkBar count={12} allSelected onSelectAll={vi.fn()} onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('offers select-all as a button too, because the checkbox carries no words', async () => {
    const onSelectAll = vi.fn();
    render(<BulkBar count={12} allSelected="mixed" onSelectAll={onSelectAll} onClear={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  it('offers the rest of the library only once what is loaded is selected', async () => {
    const onSelectEverything = vi.fn();
    const rest = (allSelected: boolean | 'mixed') => (
      <BulkBar
        count={50}
        allSelected={allSelected}
        onSelectAll={vi.fn()}
        onClear={vi.fn()}
        matching={812}
        onSelectEverything={onSelectEverything}
      />
    );
    // Two steps, because one button meaning either "50" or "812" depending on how far somebody
    // scrolled is a button that trashes eight hundred recordings by surprise.
    const partial = render(rest('mixed'));
    expect(screen.queryByRole('button', { name: 'Select all 812' })).toBeNull();
    partial.unmount();
    render(rest(true));
    await userEvent.click(screen.getByRole('button', { name: 'Select all 812' }));
    expect(onSelectEverything).toHaveBeenCalledTimes(1);
  });

  it('offers nothing further when the selection already covers everything that matches', () => {
    render(
      <BulkBar
        count={812}
        allSelected
        onSelectAll={vi.fn()}
        onClear={vi.fn()}
        matching={812}
        onSelectEverything={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Select all/ })).toBeNull();
  });

  it('is the same height as the bar it replaces', () => {
    // The one that matters. Both are `--hit-target` tall, so ticking the first checkbox does not
    // move the list underneath.
    const filters = render(<FilterBar filters={<Chip>Any state</Chip>} />);
    const filterHeight = filters.container.firstElementChild?.getAttribute('style');
    filters.unmount();
    const bulk = render(
      <BulkBar count={1} allSelected="mixed" onSelectAll={vi.fn()} onClear={vi.fn()} />,
    );
    const bulkHeight = bulk.container.firstElementChild?.getAttribute('style');
    expect(filterHeight).toContain('min-height: var(--hit-target)');
    expect(bulkHeight).toContain('min-height: var(--hit-target)');
  });
});
