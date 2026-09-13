/**
 * The account menu behind the avatar (`UI-4e`, §2.2).
 *
 * Identity, the theme, Settings and sign out. Nothing more -- everything else about an account is
 * in `V10`, and a menu that grew a third of the settings view would be two places to change one
 * thing.
 *
 * **The theme row is light and dark, and it says which one you are in.** Following the system is
 * still a choice and still lives in Settings (`UI-20d`); what it is not is a third stop on a
 * control somebody presses to change the light in front of them.
 *
 * **Signing out forgets everything cached**, which the mutation does (`UI-4a`). On a shared
 * machine the next person must not find the last one's library names in the sidebar.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ProfileMenu, useTheme } from '@/design-system';
import type { AnchoredOverlay } from '@/design-system';

import { initialsOf } from '@/app/destinations';
import { routes } from '@/app/routes';
import { useSession, useSignOut } from '@/app/session';

export interface ProfileProps {
  onClose: () => void;
  /**
   * Where it hangs, from the system's own positioning (`UI-34a`).
   *
   * The hook is called by whoever renders the anchor -- the shell, which owns the nav -- because
   * the anchor ref it hands out has to reach the avatar button. This component is given the other
   * half of the pair.
   */
  surface: Pick<AnchoredOverlay<HTMLButtonElement, HTMLDivElement>, 'surfaceRef' | 'surfaceStyle'>;
}

export function Profile({ onClose, surface }: ProfileProps) {
  const { surfaceRef, surfaceStyle } = surface;
  const { t } = useTranslation('shell');
  const { t: common } = useTranslation();
  const navigate = useNavigate();
  const { account } = useSession();
  const { resolved, setChoice } = useTheme();
  const signOut = useSignOut();

  return (
    <ProfileMenu
      ref={surfaceRef}
      style={surfaceStyle}
      name={account?.display_name ?? ''}
      email={account?.email ?? ''}
      initials={initialsOf(account?.display_name)}
      theme={t(`theme.${resolved}`)}
      themeIcon={resolved === 'dark' ? 'moon' : 'sun'}
      onTheme={() => {
        // Two states here and three in Settings (`UI-20d`): a menu row is a switch somebody
        // flicks when the room changes, and "follow the system" is not a third thing to flick
        // past on the way. It reads and writes what is on screen, so the row is never a step
        // behind a device that changed its mind.
        setChoice(resolved === 'dark' ? 'light' : 'dark');
      }}
      onSettings={() => {
        onClose();
        void navigate(routes.settings);
      }}
      onSignOut={() => {
        onClose();
        signOut.mutate();
        void navigate(routes.signIn, { replace: true });
      }}
      labels={{
        theme: t('profile.theme'),
        settings: t('sidebar.settings'),
        signOut: common('action.signOut'),
      }}
    />
  );
}
