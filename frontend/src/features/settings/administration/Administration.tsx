/**
 * Administration, inside Settings and visibly apart from it (`INT-3a`, §V10).
 *
 * **Its own chrome, so nobody wanders in by accident.** Everything else in Settings changes one
 * person's own account; this changes the instance for everybody on it, and the two must not read
 * as the same kind of screen. So it is a different surface with its own heading and a plain
 * statement of what it is -- reached by a deliberate step, which is the tab, rather than by
 * scrolling past Appearance.
 *
 * **Four cards and not one column.** The four subjects are independent -- who has an account,
 * where audio is sent, what the workers are doing, what the instance is holding -- and a single
 * stack made them read as four paragraphs of one document, with the status an operator came for
 * two screens below the fold. A card each gives every one an edge, and the grid spends the width
 * that Settings' reading column was throwing away. The outer box goes with them: a card inside a
 * card is one border too many, and `INT-3a`'s separation is four edges now instead of one.
 *
 * **It says what it is rather than warning about it.** A banner shouting that this is dangerous
 * would be the wrong register for a page an operator opens every week; what the heading owes is
 * the fact -- these settings belong to the instance and everybody on it -- stated once, calmly,
 * and then the sections.
 *
 * **Nothing here is fetched until somebody opens it.** The queries live in the sections, and the
 * sections are only mounted on this tab, so a person who never opens Administration never asks
 * the instance for its job queue.
 */

import { useTranslation } from 'react-i18next';

import type { CSSProperties } from 'react';

import { Provider } from './Provider';
import { Queue } from './Queue';
import { SystemStatus } from './SystemStatus';
import { Users } from './Users';

/**
 * Two columns that wrap, rather than a four-cell grid.
 *
 * A grid aligns rows, so the shorter card in the top row gets a hole under it the height of its
 * neighbour -- and the queue, which grows with the instance, decides how big that hole is. Two
 * flex columns each pack their own cards tight, and `wrap` with a `--admin-card-width` basis is
 * what drops them to one column on a narrow window, without a fifth number to keep in step with
 * the four in `breakpoints.css`.
 */
const COLUMNS: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--grid-gap)',
  alignItems: 'flex-start',
};

const COLUMN: CSSProperties = {
  flex: '1 1 var(--admin-card-width)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--grid-gap)',
  // A flex item's floor is its content, and a uuid has no wrap points. Without this the column
  // refuses to shrink and the page scrolls sideways.
  minWidth: 0,
};

export function Administration() {
  const { t } = useTranslation('settings');

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text)',
          }}
        >
          {t('administration.title')}
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-2)',
          }}
        >
          {t('administration.intro')}
        </p>
      </header>
      <div style={COLUMNS}>
        {/* What an operator changes, and the long one. */}
        <div style={COLUMN}>
          <Users />
          <Queue />
        </div>
        {/* What the instance is set to and what it is holding. */}
        <div style={COLUMN}>
          <Provider />
          <SystemStatus />
        </div>
      </div>
    </section>
  );
}
