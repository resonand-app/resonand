/**
 * Narrowing a search over everything (`UI-16c`, §V6).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toSearch } from '@/app/routes';
import { AVIA } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { SearchFilters } from './SearchFilters';

mockApi();

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.search}</div>;
}

function show(at: string = toSearch('vermut')) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Where />
        <Routes>
          <Route path={routes.search} element={<SearchFilters />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the filters', () => {
  it('offers all four transcription states, now that the API answers all four', async () => {
    show();
    for (const state of ['Not transcribed', 'Transcribing', 'Transcribed', 'Transcription failed'])
      expect(await screen.findByRole('button', { name: state })).toBeInTheDocument();
  });

  it('narrows to one library, and writes it into the URL', async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: /which library/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Àvia Teresa' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`library=${AVIA}`);
  });

  it('offers no category until a library is chosen, because a category belongs to one', async () => {
    show();
    expect(screen.queryByRole('button', { name: /category/i })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('combobox', { name: /which library/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Àvia Teresa' }));
    expect(await screen.findByRole('button', { name: /category/i })).toBeInTheDocument();
  });

  it('drops the category when the library changes, since the id means nothing there', async () => {
    show(`${toSearch('vermut')}&library=${AVIA}&category_id=1`);
    await userEvent.click(await screen.findByRole('combobox', { name: /which library/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Any library' }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('category_id');
  });

  it('asks for a duration in minutes and sends it in milliseconds', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /when and how long/i }));
    await userEvent.type(await screen.findByLabelText(/longer than/i), '30');
    expect(screen.getByTestId('where')).toHaveTextContent('min_duration_ms=1800000');
  });

  it('says how many of the four range fields are set, since they are behind a popover', async () => {
    show(`${toSearch('vermut')}&recorded_from=2026-01-01`);
    expect(await screen.findByRole('button', { name: /when and how long \(1\)/i })).toBeVisible();
  });

  it('offers no sort, because the results are ranked and reordering them discards that', () => {
    show();
    expect(screen.queryByRole('combobox', { name: /sort/i })).not.toBeInTheDocument();
  });
});
