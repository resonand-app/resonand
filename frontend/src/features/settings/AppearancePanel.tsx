/**
 * V10 · Appearance (`UI-20d`, §V10).
 *
 * Two controls and nothing else. One identity, no palette switcher: a product that lets somebody
 * repaint it is a product whose contrast guarantees are somebody else's problem.
 *
 * **They are stored in two different places, and that is the point.** The theme is per device,
 * in browser storage, because it is a property of the screen you are looking at -- the same
 * person wants light on a laptop in a bright room and dark on a phone in bed, and an
 * account-level setting can only be wrong for one of them. "Follow the system" is already a
 * per-device idea. Language is per person and saves against the account, because it is a fact
 * about who is reading rather than about what they are reading on.
 *
 * **Language ships with one option, on purpose, and is drawn as settled rather than as
 * unfinished.** `UI-22` makes translation possible without touching a component, and this control
 * being present and functional from v0 is what proves the round trip works: a language that saves,
 * reloads and comes back is the test. Adding the control later alongside the first translation
 * would mean discovering the plumbing is broken at the worst possible moment. So the hint states
 * that English is the only language this version speaks -- which reads as a complete answer,
 * where a lone disabled select would read as a bug.
 */

import { useTranslation } from 'react-i18next';

import { useSession } from '@/app/session';
import { THEME_CHOICES, Select, useTheme } from '@/design-system';
import type { ThemeChoice } from '@/design-system';
import { BASE, PSEUDO } from '@/i18n';

import { useUpdateAccount } from './data';

/** The width both controls take, so two selects with different labels line up. */
const CONTROL_WIDTH = 260;

export function AppearancePanel() {
  const { t, i18n } = useTranslation('settings');
  const { choice, setChoice } = useTheme();
  const { account } = useSession();
  const update = useUpdateAccount();

  // The pseudo-locale is a development tool for `UI-24c`'s string pass and never an option on a
  // real instance: `import.meta.env.DEV` is a literal `false` in a build, so the entry and its
  // string are dropped rather than shipped and hidden.
  const languages = import.meta.env.DEV ? [BASE, PSEUDO] : [BASE];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Setting hint={t('appearance.themeHint')}>
        <Select<ThemeChoice>
          label={t('appearance.theme')}
          value={choice}
          width={CONTROL_WIDTH}
          options={THEME_CHOICES.map((one) => ({
            value: one,
            label: t(`appearance.themeChoice.${one}`),
          }))}
          onChange={setChoice}
        />
      </Setting>
      <Setting hint={t('appearance.languageHint')}>
        <Select
          label={t('appearance.language')}
          value={account?.language ?? BASE}
          width={CONTROL_WIDTH}
          options={languages.map((one) => ({
            value: one,
            label: t(`appearance.languages.${one}`),
          }))}
          onChange={(language) => {
            // The interface changes at once and the account catches up, rather than the language
            // waiting on a round trip: this is the one setting whose effect is the whole screen.
            void i18n.changeLanguage(language);
            update.mutate({ language });
          }}
        />
      </Setting>
    </div>
  );
}

function Setting({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {children}
      <p
        style={{
          margin: 0,
          maxWidth: 420,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
        }}
      >
        {hint}
      </p>
    </section>
  );
}
