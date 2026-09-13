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
 * The player and the tray belong to `UI-5` and `UI-18` and both outlive every view, which is
 * exactly why they are drawn by the frame rather than inside one: an upload that died on a
 * navigation is the one thing `UI-18` forbids. Both props stay, for a test that wants to put
 * something else there.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { Shell, Sidebar, TopNav, useAnchoredOverlay } from '@/design-system';

import { QuickHits } from '@/features/search/QuickHits';
import { UploadDialog } from '@/features/upload/UploadDialog';
import { UploadPanel, Uploads } from '@/features/upload/Uploads';
import { MediaSession } from '@/player/MediaSession';
import { PhonePlayer } from '@/player/PhonePlayer';
import { Player } from '@/player/Player';
import { connect } from '@/player/audio';
import { playerShowing, usePlayback } from '@/player/store';

import { PhoneShell } from './PhoneShell';
import { Profile } from './Profile';
import { Toasts } from './Toasts';
import { destinationOf, destinationTo, initialsOf, libraryIn } from '@/app/destinations';
import { isPlainClick } from '@/app/links';
import { useLibraries, useTrashCount } from '@/app/library-data';
import { queryIn, recordingIn, routes, toRecording, toSearch } from '@/app/routes';
import { useSession } from '@/app/session';
import { SEEK_SECONDS, SKIP_SECONDS } from '@/app/keyboard';
import { useIsPhone } from '@/app/hooks/use-is-phone';
import { useKeyboard } from '@/app/use-keyboard';
import { useSidebarCollapse } from '@/app/hooks/use-sidebar-collapse';

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
  // The bar's own answer, because the frame is handed a player whether or not there is one to
  // draw: it is what the tray sits above, and what it drops to the gutter without.
  const playerVisible = usePlayback(playerShowing);
  const [uploading, setUploading] = useState(false);
  // The upload dialog belongs to the frame, like the player and the tray: it is opened from the
  // nav on any screen, and what it starts has to outlive the screen it was started from
  // (`UI-18`, §3.3).
  const [uploadOpen, setUploadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // What is in the field, which is not what is in the URL (`UI-16a`, §3.2). Typing opens the
  // quick hits; only `Enter` and the see-all row navigate. It is seeded from the address so that
  // arriving at `/search?q=avia` -- from a link, a reload, or the phone's Search tab -- leaves
  // the field saying what is on the screen.
  const [query, setQuery] = useState(() => queryIn(location.search));
  // Where the dropdown was opened rather than whether it is: a navigation is what closes it, and
  // remembering the path it belongs to is what makes that a fact about the render instead of an
  // effect that fires after the next screen has already been drawn under it.
  const [hitsFor, setHitsFor] = useState<string | null>(null);
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
  // Whether the full results are already the screen. The field means something different there.
  const onSearch = location.pathname === routes.search;
  const hitsOpen = hitsFor === location.pathname;

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
    // Only while there is a dropdown to close. `useKeyboard` ignores a command nobody answers,
    // so `Escape` stays whatever the view under it makes of it the rest of the time.
    ...(hitsOpen
      ? {
          dismiss: () => {
            setHitsFor(null);
          },
        }
      : {}),
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
      <>
        <PhoneShell
          {...(header === undefined ? {} : { header })}
          player={
            <>
              <MediaSession />
              {player ?? <PhonePlayer />}
            </>
          }
          upload={
            tray ?? (
              <UploadPanel
                onAdd={() => {
                  setUploadOpen(true);
                }}
              />
            )
          }
          uploading={uploading}
          onUploadTab={setUploading}
        >
          {children}
          <UploadDialog
            open={uploadOpen}
            onClose={() => {
              setUploadOpen(false);
            }}
            library={libraryIn(location.pathname)}
          />
        </PhoneShell>
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Shell
        nav={
          <TopNav
            initials={initialsOf(account?.display_name)}
            query={query}
            onToggleSidebar={toggle}
            onQueryChange={(typed) => {
              setQuery(typed);
              // On the search screen the field drives the results directly and there is no
              // dropdown: a box of five hits drawn over the page that already lists them is one
              // surface hiding another. Anywhere else, typing opens the quick hits and changes no
              // address until somebody asks it to.
              if (onSearch) void navigate(toSearch(typed), { replace: true });
              else setHitsFor(typed.trim() === '' ? null : location.pathname);
            }}
            onQuerySubmit={() => {
              setHitsFor(null);
              void navigate(toSearch(query), { replace: onSearch });
            }}
            onUpload={() => {
              onUpload?.();
              setUploadOpen(true);
            }}
            onProfile={() => {
              onProfile?.();
              setProfileOpen((open) => !open);
            }}
            homeHref={routes.libraries}
            onHome={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              void navigate(routes.libraries);
            }}
            searchRef={search}
            avatarRef={profile.anchorRef}
            labels={{
              search: t('nav.search'),
              sidebar: t('nav.sidebar'),
              upload: t('nav.upload'),
              account: t('nav.account'),
              home: t('nav.home'),
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
          >
            {hitsOpen && !onSearch && (
              <QuickHits
                query={query}
                onOpen={(uuid) => {
                  setHitsFor(null);
                  void navigate(toRecording(uuid));
                }}
                onSeeAll={() => {
                  setHitsFor(null);
                  void navigate(toSearch(query));
                }}
              />
            )}
          </TopNav>
        }
        sidebar={
          <Sidebar
            own={own}
            // Absent rather than empty (§2.2): a group saying nobody has shared anything with you,
            // on every screen, is a thing to read every time.
            {...(shared.length > 0 ? { shared } : {})}
            {...(trashCount > 0 ? { trashCount } : {})}
            collapsed={collapsed}
            labels={{
              libraries: t('sidebar.libraries'),
              search: t('sidebar.search'),
              yours: t('sidebar.yours'),
              shared: t('sidebar.shared'),
              trash: t('sidebar.trash'),
              settings: t('sidebar.settings'),
            }}
            activeId={destinationOf(location.pathname)}
            onSelect={(id) => {
              void navigate(destinationTo(id));
            }}
          />
        }
        player={
          <>
            <MediaSession />
            {/* Which recording the view is showing, so the bar can drop its waveform while the
              detail view's own one is on screen (`UI-11b`, §3.1). */}
            {player ?? <Player onScreen={recordingIn(location.pathname)} />}
          </>
        }
        tray={tray ?? <Uploads />}
        playerVisible={playerVisible}
      >
        {children}
        {/* Inside the frame rather than inside a view: closing it must not be able to stop what it
            started, and neither must navigating away from wherever it was opened. */}
        <UploadDialog
          open={uploadOpen}
          onClose={() => {
            setUploadOpen(false);
          }}
          library={libraryIn(location.pathname)}
        />
      </Shell>
      {/* Beside the frame, not inside it: the region is fixed to the viewport and the one box on
          the page that scrolls is the wrong parent for it (`FBK-1`, `UI-35f`). */}
      <Toasts />
    </>
  );
}
