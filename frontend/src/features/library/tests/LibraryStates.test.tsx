/**
 * The two empty states, and the two defects they shipped with (`UI-10a1`, `UI-18a1`).
 *
 * Both are the same failure in different words: a state that tells somebody what to do and then
 * cannot help them do it. One rendered a translation key where the filter's name belonged; the
 * other extended an invitation with no button on it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpenUploadContext } from '@/app/upload-dialog';
import type { Filters } from '@/app/url-state';

import { NothingMatched, NothingYet } from '../LibraryStates';

const FILTERS: Filters = {
  tags: [],
  states: [],
  sort: 'recorded_at',
  direction: 'desc',
  view: 'grid',
};

describe('the filter matched nothing', () => {
  it('names the category rather than the key that names it', () => {
    render(
      <NothingMatched
        total={12}
        filters={{ ...FILTERS, categoryId: 4 }}
        onClear={vi.fn()}
        categoryName="Fieldwork"
      />,
    );
    expect(screen.getByText(/Fieldwork/)).toBeInTheDocument();
    // The defect: `empty.matched.category` had no entry, so i18next rendered the key itself.
    expect(screen.queryByText(/empty\.matched/)).not.toBeInTheDocument();
  });

  it('still names the filter while the category tree is on its way', () => {
    render(
      <NothingMatched
        total={12}
        filters={{ ...FILTERS, categoryId: 4 }}
        onClear={vi.fn()}
        categoryName={undefined}
      />,
    );
    expect(screen.getByText(/a category/)).toBeInTheDocument();
  });

  it('names a tag and a category together', () => {
    render(
      <NothingMatched
        total={3}
        filters={{ ...FILTERS, categoryId: 4, tags: ['interviews'] }}
        onClear={vi.fn()}
        categoryName="Fieldwork"
      />,
    );
    expect(screen.getByText(/Fieldwork, #interviews/)).toBeInTheDocument();
  });
});

describe('nothing uploaded yet', () => {
  it('offers the upload its invitation invites', async () => {
    const open = vi.fn();
    render(
      <OpenUploadContext.Provider value={open}>
        <NothingYet canEdit />
      </OpenUploadContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /upload a recording/i }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('offers nothing to somebody who may only read', () => {
    render(
      <OpenUploadContext.Provider value={vi.fn()}>
        <NothingYet canEdit={false} />
      </OpenUploadContext.Provider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws no button where there is no shell to open one', () => {
    // A specimen page, and a good many tests, render a view with no frame around it.
    render(<NothingYet canEdit />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
