/**
 * The desktop frame, wired to the archive (`UI-4c`, `UI-4d`, `UI-4e`, §2.2).
 *
 * `Shell` is the layout and knows nothing (`UI-35a`); this is what fills it. The division is
 * `DEC-22`'s: presentational in the design system, data-bound in the application. So the sidebar
 * is given libraries and a trash count, the nav is given a query and an account, and neither of
 * them has ever heard of TanStack Query.
 *
 * **The sidebar collapses at 1180 and not at 900**, which is the order §2.2 gives and the reason
 * it matters: three 320px cards fit at 1280 with the sidebar out, so the sidebar has to go before
 * the grid drops to two columns rather than after. Below 720 this component is not rendered at
 * all -- the phone shell replaces it rather than narrowing it (`UI-4f`, `DEC-23`).
 *
 * The player and the tray are passed through. They belong to `UI-5` and `UI-18` and both outlive
 * every view, which is exactly why they are given to the frame rather than rendered inside one.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { Shell, Sidebar, TopNav, useAnchoredOverlay } from '@/design-system';

import { MediaSession } from '@/player/MediaSession';
import { PhonePlayer } from '@/player/PhonePlayer';
import { Player } from '@/player/Player';
import { connect } from '@/player/audio';
import { usePlayback } from '@/player/store';

import { PhoneShell } from './PhoneShell';
import { Profile } from './Profile';
import { destinationOf, destinationTo, initialsOf } from './destinations';
import { useLibraries, useTrashCount } from './library-data';
import { routes, toSearch } from './routes';
import { useSession } from './session';
import { SEEK_SECONDS, SKIP_SECONDS } from './keyboard';
import { useIsPhone } from './use-is-phone';
import { useKeyboard } from './useKeyboard';
import { useSidebarCollapse } from './use-sidebar-collapse';

export interface AppShellProps {
  children: ReactNode;
  /** The per-screen header, which is where the account avatar lives on a phone (§2.3). */
  header?: ReactNode;
  player?: ReactNode;
  tray?: ReactNode;
  /** The account menu, opened by the avatar. `UI-4e` hands it in so the frame stays presentational. */
  profile?: ReactNode;
  onUpload?: () => void;
  onProfile?: () => void;
}

export function AppShell({ children, player, tray, header, onUpload, onProfile }: AppShellProps) {
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  const location = useLocation();
  const { account } = useSession();
  const { own, shared } = useLibraries();
  const trashCount = useTrashCount();
  const { collapsed, toggle } = useSidebarCollapse();
  const isPhone = useIsPhone();
  const [uploading, setUploading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // The account menu hangs off the avatar, and the system's positioning is what makes it flip
  // when it runs out of room, close on Escape and close on a pointer outside it (`UI-34a`).
  const profile = useAnchoredOverlay<HTMLButtonElement>({
    open: profileOpen,
    onClose: () => {
      setProfileOpen(false);
    },
    placement: 'bottom',
    align: 'end',
  });
  const search = useRef<HTMLInputElement>(null);

  // The audio element is connected once, by the frame, and never by a view. It is outside React
  // and outside the routes, which is what "survives every navigation" means in code (`UI-5b`).
  useEffect(connect, []);

  // The shell owns the bindings that are about the shell. The player's are added by `UI-5`, and a
  // view's -- moving between transcript segments, opening a row -- by the view: `useKeyboard`
  // ignores a command nobody answers, so an unanswered key stays the browser's.
  useKeyboard({
    'focus-search': () => {
      search.current?.focus();
      search.current?.select();
    },
    'play-pause': () => {
      usePlayback.getState().toggle();
    },
    'seek-back': () => {
      usePlayback.getState().nudge(-SEEK_SECONDS);
    },
    'seek-forward': () => {
      usePlayback.getState().nudge(SEEK_SECONDS);
    },
    'skip-back': () => {
      usePlayback.getState().nudge(-SKIP_SECONDS);
    },
    'skip-forward': () => {
      usePlayback.getState().nudge(SKIP_SECONDS);
    },
  });

  // Replaced rather than narrowed (`DEC-23`). Below 720 the desktop frame is not rendered at all,
  // so nothing in it is competing for a screen it was never drawn for.
  if (isPhone) {
    return (
      <PhoneShell
        {...(header === undefined ? {} : { header })}
        player={
          <>
            <MediaSession />
            {player ?? <PhonePlayer />}
          </>
        }
        {...(tray ? { upload: tray } : {})}
        uploading={uploading}
        onUploadTab={setUploading}
      >
        {children}
      </PhoneShell>
    );
  }

  return (
    <Shell
      nav={
        <TopNav
          initials={initialsOf(account?.display_name)}
          onToggleSidebar={toggle}
          onQueryChange={(query) => {
            void navigate(toSearch(query), { replace: location.pathname === routes.search });
          }}
          {...(onUpload ? { onUpload } : {})}
          onProfile={() => {
            onProfile?.();
            setProfileOpen((open) => !open);
          }}
          searchRef={search}
          avatarRef={profile.anchorRef}
          labels={{
            search: t('nav.search'),
            sidebar: t('nav.sidebar'),
            upload: t('nav.upload'),
            account: t('nav.account'),
          }}
          accountMenu={
            profileOpen ? (
              <Profile
                surface={profile}
                onClose={() => {
                  setProfileOpen(false);
                }}
              />
            ) : null
          }
        />
      }
      sidebar={
        <Sidebar
          own={own}
          // Absent rather than empty (§2.2): a group saying nobody has shared anything with you,
          // on every screen, is a thing to read every time.
          {...(shared.length > 0 ? { shared } : {})}
          {...(trashCount > 0 ? { trashCount } : {})}
          collapsed={collapsed}
          activeId={destinationOf(location.pathname)}
          onSelect={(id) => {
            void navigate(destinationTo(id));
          }}
        />
      }
      player={
        <>
          <MediaSession />
          {player ?? <Player />}
        </>
      }
      {...(tray ? { tray } : {})}
    >
      {children}
    </Shell>
  );
}
