/**
 * V10 · Settings (`UI-20a`, §V10).
 *
 * **One destination with sections, not a scattering of screens.** Everything a person changes
 * about themselves is small, and four small screens in four places is how a person ends up
 * looking for the language control under the profile menu.
 *
 * **Administration is a tab and not a route.** §V10 asks for it inside Settings and visually
 * separated, so nobody wanders into it: it runs the instance for everybody on it. A destination
 * of its own in the sidebar would be the opposite -- something you arrive at by scrolling past
 * the thing you came for. The tab exists **only** when `GET /auth/me` says `is_admin`, and it is
 * absent rather than disabled, because an administration tab that refuses to open still tells a
 * reader that administration is there and that they are not it.
 *
 * **The section is in the URL**, and `sections.ts` says which one a given URL means.
 */

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { useSession } from '@/app/session';
import { PageHeader, Tabs } from '@/design-system';
import type { Tab } from '@/design-system';

import { AccountPanel } from './AccountPanel';
import { AppearancePanel } from './AppearancePanel';
import { Administration } from './administration/Administration';
import { SessionsPanel } from './SessionsPanel';
import { SECTIONS, SECTION_PARAM, sectionIn } from './sections';
import type { Section } from './sections';

const PANEL_ID = 'settings-panel';

export function SettingsView() {
  const { t } = useTranslation('settings');
  const [parameters, setParameters] = useSearchParams();
  const { account } = useSession();
  const isAdmin = account?.is_admin === true;
  const section = sectionIn(parameters.get(SECTION_PARAM), isAdmin);

  const tabs: Tab<Section>[] = SECTIONS.filter((one) => one !== 'administration' || isAdmin).map(
    (one) => ({ value: one, label: t(`sections.${one}`) }),
  );

  return (
    <section>
      <PageHeader title={t('title')} meta={t('meta')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ borderBottom: '1px solid var(--hairline)' }}>
          <Tabs
            tabs={tabs}
            value={section}
            label={t('sections.label')}
            panelId={PANEL_ID}
            onChange={(next) => {
              const updated = new URLSearchParams(parameters);
              updated.set(SECTION_PARAM, next);
              // Replace rather than push: four sections are one screen, and a back button that
              // walked through the tabs somebody glanced at is a back button that never leaves.
              setParameters(updated, { replace: true });
            }}
          />
        </div>
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${section}`}
          tabIndex={-1}
          // A reading column for the three sections that are forms about one person, and the
          // full width for the fourth. Administration is a dashboard -- four independent cards
          // an operator scans -- and 640px turned it into one tall column beside empty space.
          style={section === 'administration' ? undefined : { maxWidth: 640 }}
        >
          <Panel section={section} />
        </div>
      </div>
    </section>
  );
}

/**
 * Whichever section is on screen.
 *
 * The fourth is `INT-3` and is a whole view of its own -- users, the provider, the queue and the
 * instance's own status.
 */
function Panel({ section }: { section: Section }) {
  switch (section) {
    case 'account':
      return <AccountPanel />;
    case 'sessions':
      return <SessionsPanel />;
    case 'appearance':
      return <AppearancePanel />;
    case 'administration':
      return <Administration />;
  }
}
