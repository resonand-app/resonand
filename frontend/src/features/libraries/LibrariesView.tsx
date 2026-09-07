/**
 * V2 · The libraries landing (`UI-31a`, §V2).
 *
 * The application's home, and the answer to two questions in one screen: where do I go, and what
 * is in here. The title block answers the second with numbers that are counted and not rounded
 * (§1.4) -- `537 recordings · 149 h 44 min` is a claim somebody can check, and `500+ recordings`
 * is not.
 *
 * **The create tile is first, and it needs no data.** It is drawn before the list has arrived, so
 * a brand-new account whose one library is still in flight is looking at something it can act on
 * rather than at three grey rectangles.
 *
 * **The grid is `auto-fill` from `--card-width`.** Three columns at 1440 is what the drawing
 * shows, but three columns is the consequence of the card being 320px wide and not the rule -- a
 * hard `repeat(3, 1fr)` gives 480px cards on a wide screen and a horizontal scrollbar on a narrow
 * one, and it is the one thing §V2's structure note asks this grid not to do.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { CreateLibraryCard, LibraryCard, PageHeader } from '@/design-system';
import * as format from '@/i18n/format';

import { useLibraryList } from './data';

export function LibrariesView() {
  const { t } = useTranslation('libraries');
  const { own, recordings, durationMs } = useLibraryList();

  return (
    <section>
      <PageHeader
        title={t('title')}
        meta={`${t('common:count.recordings', { count: recordings })} · ${format.total(durationMs)}`}
      />
      <Grid>
        <CreateLibraryCard labels={{ action: t('create.action'), hint: t('create.hint') }} />
        {own.map((library) => (
          <LibraryCard key={library.uuid} name={library.name} />
        ))}
      </Grid>
    </section>
  );
}

/**
 * The card grid, at whatever number of columns the space divides into.
 *
 * `minmax(var(--card-width), 1fr)` rather than a fixed track: the cards grow to fill the row they
 * are on, so the grid has no ragged right edge at any width, and it drops to two columns and then
 * to one on its own.
 */
export function Grid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-width), 1fr))',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}
