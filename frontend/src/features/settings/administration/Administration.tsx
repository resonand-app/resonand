/**
 * Administration, inside Settings and visibly apart from it (`INT-3a`, §V10).
 *
 * **Its own chrome, so nobody wanders in by accident.** Everything else in Settings changes one
 * person's own account; this changes the instance for everybody on it, and the two must not read
 * as the same kind of screen. So it is a different surface with its own heading and a plain
 * statement of what it is -- reached by a deliberate step, which is the tab, rather than by
 * scrolling past Appearance.
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

import { Provider } from './Provider';
import { Users } from './Users';

export function Administration() {
  const { t } = useTranslation('settings');

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        // A different surface from the rest of Settings, which is the whole of `INT-3a`: the
        // border and the inset are what make this read as somewhere else rather than as the
        // fourth paragraph of a settings page.
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-2)',
        background: 'var(--surface-2)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
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
      <Users />
      <Provider />
    </section>
  );
}
