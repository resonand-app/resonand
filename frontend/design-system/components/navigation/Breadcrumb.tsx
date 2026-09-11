import type { MouseEvent } from 'react';

import { Icon } from '../foundation/Icon';

export interface BreadcrumbProps {
  /** Where this thing lives, and the way back to it. The library, on a recording's screen. */
  name: string;
  /** The link's target. A real `href`, so it opens in a new tab and shows in the status bar. */
  href: string;
  /** What it is filed under inside that place. Shown after the name, and is not a link. */
  detail?: string | undefined;
  /** Names the landmark for a screen reader: "Where this recording is". */
  label: string;
  /** Keeps a plain click in the router. A modifier click stays the browser's. */
  onNavigate?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
}

/**
 * Where you are, and the one way back (`UI-11a`).
 *
 * **The place's name is the control**, carrying the chevron that says which direction it goes, so
 * a screen needs no second control naming the same destination.
 *
 * **No underline.** The line reads as a path -- "Personal / interviews" -- and an underline inside
 * it makes a location look like prose with a link in it. The affordance is the chevron at rest
 * and the surface step on hover.
 *
 * The detail after it is not a link, because there is no screen for a category on its own.
 */
export function Breadcrumb({ name, href, detail, label, onNavigate }: BreadcrumbProps) {
  return (
    <nav
      aria-label={label}
      data-ds="breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        minWidth: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        color: 'var(--text-3)',
      }}
    >
      <a data-ds="breadcrumb-link" data-hit-target="" href={href} onClick={onNavigate}>
        <Icon name="chevron-left" size={15} />
        {name}
      </a>
      {detail !== undefined && (
        <>
          <span aria-hidden>/</span>
          {/* The name is what somebody is looking for, so the detail is what gives way. */}
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {detail}
          </span>
        </>
      )}
    </nav>
  );
}
