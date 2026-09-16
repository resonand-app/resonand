/**
 * Fetching a whole library rather than a window of it (`UI-9a`).
 *
 * Tested here rather than through the view, because what has to be right is the loop and not the
 * screen: the second select-all step asks for every recording a filter matches, and a list that
 * is four pages long has to come back as four requests and one array. The view's own test proves
 * the two steps; this proves the paging under them, at a length no rendering test would sit
 * through.
 */

import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { MAX_PAGE_SIZE } from '@/api/paged';
import { RECORDINGS, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { fetchEveryRecording } from '../recordings';

mockApi();

/** A library of `total` recordings, answering `limit` and `offset` the way the API does. */
function aLibraryOf(total: number): string[] {
  const asked: string[] = [];
  const every = Array.from({ length: total }, (_, index) => ({
    ...archive.recordings[0],
    uuid: `eeeeeeee-0000-4000-8000-${String(index).padStart(12, '0')}`,
    library_uuid: RECORDINGS,
    title: `Recording ${String(index)}`,
  }));
  server.use(
    http.get('/api/libraries/:library_uuid/audio', ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      asked.push(`${String(limit)}@${String(offset)}`);
      return HttpResponse.json({
        items: every.slice(offset, offset + limit),
        total,
        limit,
        offset,
      });
    }),
  );
  return asked;
}

describe('every recording a filter matches', () => {
  it('pages through the lot at the largest page the API answers', async () => {
    const asked = aLibraryOf(450);
    const every = await fetchEveryRecording(RECORDINGS, { sort: 'recorded_at' });
    expect(every).toHaveLength(450);
    // Three requests and not nine: none of these pages is going on screen, so the only thing that
    // matters about the window is how few round trips it costs.
    expect(asked).toEqual([
      `${String(MAX_PAGE_SIZE)}@0`,
      `${String(MAX_PAGE_SIZE)}@200`,
      `${String(MAX_PAGE_SIZE)}@400`,
    ]);
  });

  it('stops on a page that answers with nothing, rather than asking past the end for ever', async () => {
    // A library that shrank between two of these requests reports a total the rows no longer
    // reach. Trusting the total alone is an infinite loop against a live archive.
    server.use(
      http.get('/api/libraries/:library_uuid/audio', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          items: [],
          total: 900,
          limit: Number(url.searchParams.get('limit')),
          offset: Number(url.searchParams.get('offset')),
        });
      }),
    );
    expect(await fetchEveryRecording(RECORDINGS, {})).toEqual([]);
  });

  it('carries the filter into every page, so the selection is what is on screen', async () => {
    const asked: string[] = [];
    server.use(
      http.get('/api/libraries/:library_uuid/audio', ({ request }) => {
        const url = new URL(request.url);
        asked.push(url.searchParams.get('tag') ?? '');
        return HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 });
      }),
    );
    await fetchEveryRecording(RECORDINGS, { tag: ['field'] });
    expect(asked).toEqual(['field']);
  });
});
