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

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { Shell, Sidebar, TopNav } from '@/design-system';

import { destinationOf, destinationTo, initialsOf } from './destinations';
import { useLibraries, useTrashCount } from './library-data';
import { routes, toSearch } from './routes';
import { useSession } from './session';
import { useSidebarCollapse } from './use-sidebar-collapse';

export interface AppShellProps {
  children: ReactNode;
  player?: ReactNode;
  tray?: ReactNode;
  /** The account menu, opened by the avatar. `UI-4e` hands it in so the frame stays presentational. */
  profile?: ReactNode;
  onUpload?: () => void;
  onProfile?: () => void;
}

export function AppShell({ children, player, tray, onUpload, onProfile }: AppShellProps) {
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  const location = useLocation();
  const { account } = useSession();
  const { own, shared } = useLibraries();
  const trashCount = useTrashCount();
  const { collapsed, toggle } = useSidebarCollapse();

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
          {...(onProfile ? { onProfile } : {})}
          labels={{
            search: t('nav.search'),
            sidebar: t('nav.sidebar'),
            upload: t('nav.upload'),
            account: t('nav.account'),
          }}
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
      {...(player ? { player } : {})}
      {...(tray ? { tray } : {})}
    >
      {children}
    </Shell>
  );
}
