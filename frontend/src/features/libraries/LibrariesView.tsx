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

import { toLibrary } from '@/app/routes';
import { CreateLibraryCard, LibraryCard, PageHeader } from '@/design-system';
import * as format from '@/i18n/format';

import { colourOf } from '@/app/library-data';

import { useLibraryList } from './data';
import type { LibrarySummary } from './data';
import { useAfterPaint, useLatestWaveform } from './use-latest-waveform';

/**
 * The four levels, as the short name a byline has room for.
 *
 * Not the API's `level_description`, which is a whole sentence -- "Can read: listen and read the
 * transcript, and change nothing." -- written for the sharing panel, where somebody is deciding
 * what to grant. On a card it is a fact about a library you already have, and the fact is three
 * words. `UI-17c` renders the API's wording where the API's wording is the point.
 */
const LEVEL_NAMES: Record<number, string> = { 10: 'read', 20: 'edit', 30: 'manage', 40: 'owner' };

export function LibrariesView() {
  const { t } = useTranslation('libraries');
  const { own, shared, recordings, durationMs } = useLibraryList();
  const painted = useAfterPaint();

  return (
    <section>
      <PageHeader
        title={t('title')}
        meta={`${t('common:count.recordings', { count: recordings })} · ${format.total(durationMs)}`}
      />
      <Grid>
        <CreateLibraryCard labels={{ action: t('create.action'), hint: t('create.hint') }} />
        {own.map((library) => (
          <Card key={library.uuid} library={library} waveforms={painted} />
        ))}
      </Grid>
      {shared.length > 0 && (
        <section style={{ marginTop: 'var(--space-10)' }}>
          <h2
            style={{
              margin: '0 0 var(--space-4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-overline-size)',
              fontWeight: 'var(--type-overline-weight)',
              letterSpacing: 'var(--type-overline-tracking)',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            {t('shared.title')}
          </h2>
          <Grid>
            {shared.map((library) => (
              <Card key={library.uuid} library={library} waveforms={painted} byline />
            ))}
          </Grid>
        </section>
      )}
    </section>
  );
}

/**
 * One library, with everything the summary already carries and the one thing it does not.
 *
 * The counts and the colour come out of the list request that drew the grid; the waveform is a
 * second and a third request per card, so it is deferred and the card renders `pending` until it
 * lands (§V2). Nothing on the card waits for it.
 */
export function Card({
  library,
  waveforms,
  byline = false,
}: {
  library: LibrarySummary;
  waveforms: boolean;
  /** Name the owner and what you may do here. For a library somebody else shared. */
  byline?: boolean;
}) {
  const { t } = useTranslation('libraries');
  const { peaks, pending } = useLatestWaveform(library, waveforms);

  return (
    <LibraryCard
      name={library.name}
      href={toLibrary(library.uuid)}
      colour={colourOf(library.colour)}
      meta={`${t('common:count.recordings', { count: library.audio_count })} · ${format.total(
        library.total_duration_ms,
      )}`}
      {...(byline
        ? {
            byline: t('shared.byline', {
              owner: library.owner.display_name,
              level: t(`common:level.${LEVEL_NAMES[library.level] ?? 'read'}`),
            }),
          }
        : {})}
      peaks={peaks}
      pending={pending}
      labels={{ options: (name) => t('card.options', { name }) }}
    />
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
