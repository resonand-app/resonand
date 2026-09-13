/**
 * The three-second case (`UI-16a`, §3.2).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { mockApi } from '@/test/api/server';

import { QuickHits } from '../QuickHits';
import { marked, unmarked } from '../fragment';

mockApi();

function show(query: string, handlers: { onOpen?: (uuid: string) => void; onSeeAll?: () => void }) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <QuickHits
        query={query}
        onOpen={handlers.onOpen ?? (() => undefined)}
        onSeeAll={handlers.onSeeAll ?? (() => undefined)}
      />
    </QueryClientProvider>,
  );
}

describe('the quick hits', () => {
  it('shows the recording, the line that matched and where in it that is', async () => {
    show('Nadal', {});
    expect(await screen.findByText('Sopar de Nadal 1998')).toBeInTheDocument();
    expect(screen.getByText(/la casa del carrer Nou/)).toBeInTheDocument();
    // 1 084 000 ms into the recording, as a place rather than a length.
    expect(screen.getByText('18:04')).toBeInTheDocument();
  });

  it('opens the recording somebody pressed, not the one with the same name', async () => {
    const onOpen = vi.fn();
    show('Nadal', { onOpen });
    await userEvent.click(await screen.findByText('Sopar de Nadal 1998'));
    expect(onOpen).toHaveBeenCalledWith(expect.any(String));
  });

  it('counts what it found honestly on the see-all row, which is the way out', async () => {
    const onSeeAll = vi.fn();
    show('Nadal', { onSeeAll });
    await userEvent.click(await screen.findByText(/all 1 result for/i));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it('draws nothing at all until something matches', () => {
    // Not "no results" under the field: after one letter that is an answer to a question nobody
    // has finished asking. The full view is where an empty result is stated.
    const { container } = show('zzzznothing', {});
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the marking', () => {
  it('renders what the database marked, as an element rather than as markup', () => {
    render(<p>{marked('...la <mark>casa</mark> del carrer Nou...')}</p>);
    const mark = screen.getByText('casa');
    expect(mark.tagName).toBe('MARK');
  });

  it('puts an angle bracket in a recording on the page as an angle bracket', () => {
    // A transcript is somebody's speech and the fragment around the marking is text, never HTML.
    render(<p>{marked('he said <b>hello</b> then')}</p>);
    expect(screen.getByText(/he said <b>hello<\/b> then/)).toBeInTheDocument();
  });

  it('gives the same words back plain, for somewhere that can only take a string', () => {
    expect(unmarked('...la <mark>casa</mark> del carrer...')).toBe('...la casa del carrer...');
  });
});
