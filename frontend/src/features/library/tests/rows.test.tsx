/**
 * The dense list's pages, read beside each other after the list has lost rows (`UI-44`).
 *
 * Each page is fetched at its own offset, so a page read fresh beside one that is out of date
 * starts as many rows late as the list has lost, and those rows are never drawn.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { PAGE_SIZE } from '@/api/paged';
import { keys } from '@/api/keys';
import { createQueryClient } from '@/api/query-client';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { EVERYWHERE } from '../recordings';
import { useRows } from '../rows';

mockApi();

describe('pages read beside each other', () => {
  it('brings the pages already held up to date when the next one is read', async () => {
    const template = archive.recordings[0];
    let every = Array.from({ length: 120 }, (_, index) => ({
      ...template,
      uuid: `eeeeeeee-0000-4000-8000-${String(index).padStart(12, '0')}`,
      title: `Recording ${String(index)}`,
      is_favourite: true,
    }));
    server.use(
      http.get('/api/audio', ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get('limit') ?? PAGE_SIZE);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return HttpResponse.json({
          items: every.slice(offset, offset + limit),
          total: every.length,
          limit,
          offset,
        });
      }),
    );
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const query = { favourite: true };
    const { result, rerender } = renderHook(
      ({ start, end }: { start: number; end: number }) =>
        useRows(EVERYWHERE, query, { start, end }),
      { wrapper, initialProps: { start: 0, end: 10 } },
    );
    await waitFor(() => {
      expect(result.current.rowAt(49)?.title).toBe('Recording 49');
    });

    // Three unmarked in place: stale, and on purpose not refetched (`invalidate.ts`).
    every = every.slice(3);
    await client.invalidateQueries({ queryKey: keys.everyRecording(), refetchType: 'none' });
    rerender({ start: 50, end: 60 });

    await waitFor(() => {
      expect(result.current.rowAt(50)?.title).toBe('Recording 53');
    });
    await waitFor(() => {
      expect(result.current.rowAt(49)?.title).toBe('Recording 52');
    });
    expect(result.current.rowAt(0)?.title).toBe('Recording 3');
  });
});
