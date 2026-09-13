/**
 * The phone frame (`UI-4f`, `DEC-23`, §2.3).
 *
 * **Not a narrowed desktop.** Much of the listening happens one-handed, walking, with headphones,
 * so the destinations are at the bottom where the thumb is and the top of the screen carries the
 * one thing that identifies the screen. Three things the desktop has are simply not here: the nav
 * search field, the upload button and the sidebar toggle. Search is a tab, upload is a tab, and
 * the sidebar's contents are the Libraries tab.
 *
 * **Upload is a tab and still has no route** (§2.1, §2.3). That looks like a contradiction and is
 * not: the tab shows the upload panel over whatever is on screen without changing the address, so
 * navigating away does not unmount an upload in progress -- which is the one thing `UI-18`
 * forbids. A route would make the browser's back button an abort button.
 *
 * The player strip is passed in and docks directly above the tabs (`UI-5f`). It is a strip with a
 * hairline progress line and not a waveform: a 3px-bar waveform is not usable at that size with a
 * thumb.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { Icon } from '@/design-system';
import type { IconName } from '@/design-system';

import { routes } from '@/app/routes';
import { tabOf } from '@/app/tabs';
import type { PhoneTab } from '@/app/tabs';

export interface PhoneShellProps {
  children: ReactNode;
  /** The per-screen header. The account avatar lives in here rather than in a nav (§2.3). */
  header?: ReactNode;
  player?: ReactNode;
  /** Which tab is showing the upload panel, and how to change it. Not in the URL, on purpose. */
  uploading?: boolean;
  onUploadTab?: (uploading: boolean) => void;
  /** The upload panel itself, shown over the view while the Upload tab is on. */
  upload?: ReactNode;
}

/**
 * The four, in the order §2.3 lists them.
 *
 * The glyphs are the sidebar's, so the same destination is the same picture in both shells --
 * `sliders-horizontal` is Settings there and is Settings here.
 */
const TABS: { tab: PhoneTab; icon: IconName; to?: string }[] = [
  { tab: 'libraries', icon: 'library', to: routes.libraries },
  { tab: 'search', icon: 'search', to: routes.search },
  { tab: 'upload', icon: 'upload' },
  { tab: 'settings', icon: 'sliders-horizontal', to: routes.settings },
];

export function PhoneShell({
  children,
  header,
  player,
  uploading = false,
  onUploadTab,
  upload,
}: PhoneShellProps) {
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  const location = useLocation();
  const current = uploading ? 'upload' : tabOf(location.pathname);

  return (
    <div
      data-app="phone-shell"
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {header !== undefined && (
        <header style={{ flex: '0 0 auto', padding: 'var(--panel-gap)' }}>{header}</header>
      )}
      {/* `clip` on the cross axis, as the desktop shell does: a phone screen has one direction
          and a view that could be pushed sideways on it is a view nobody can read. */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'clip',
          padding: '0 var(--panel-gap) var(--panel-gap)',
        }}
      >
        {uploading ? upload : children}
      </main>
      {player}
      <nav
        aria-label={t('tabs.label')}
        style={{
          flex: '0 0 auto',
          display: 'grid',
          gridTemplateColumns: `repeat(${String(TABS.length)}, 1fr)`,
          background: 'var(--surface)',
          // No border: the elevation step is what separates it, like every other panel.
          boxShadow: 'var(--elevation-panel)',
          // Below the tabs on a phone is the home indicator, which is the system's and not ours.
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {TABS.map(({ tab, icon, to }) => (
          <button
            key={tab}
            type="button"
            aria-current={current === tab ? 'page' : undefined}
            onClick={() => {
              if (to === undefined) {
                onUploadTab?.(!uploading);
                return;
              }
              onUploadTab?.(false);
              void navigate(to);
            }}
            style={{
              // 44px is the floor everywhere in the product, and this is the control most often
              // pressed while walking.
              minHeight: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              background: 'transparent',
              color: current === tab ? 'var(--accent)' : 'var(--text-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-overline-size)',
              cursor: 'pointer',
            }}
          >
            <Icon name={icon} size={21} />
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
