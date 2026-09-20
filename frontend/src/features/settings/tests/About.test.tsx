/**
 * V10 · The source offer (`UI-38`).
 *
 * This is the one thing in the interface with a licence behind it rather than a specification:
 * `AGPL-3.0` section 13 owes the Corresponding Source to somebody who only ever meets this over a
 * network. So the assertions are about the offer surviving -- present, pointing at this build, and
 * not contingent on the API answering -- rather than about how it looks.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { mockApi } from '@/test/api/server';

import { About } from '../About';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <About />
    </QueryClientProvider>,
  );
}

describe('the instance offers its source', () => {
  it('links to the source of this build', () => {
    show();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', __SOURCE_URL__);
  });

  it('offers the source before the API has said anything', () => {
    show();
    // The version comes from `GET /instance` and the link does not. Section 13 is owed whether or
    // not the instance is well enough to answer a query.
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(screen.getByText(/free software under the AGPL-3.0/)).toBeInTheDocument();
  });

  it('names the version once the instance has answered', async () => {
    show();
    await waitFor(() => {
      expect(
        screen.getByText(/^Sonarium \S+, free software under the AGPL-3\.0\.$/),
      ).toBeInTheDocument();
    });
  });

  it('leaves the archive rather than navigating out of it', () => {
    show();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });
});
