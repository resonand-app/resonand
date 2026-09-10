import type { HTMLAttributes } from 'react';

import { IconButton } from '../forms/IconButton';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';

export interface LibraryCardProps extends HTMLAttributes<HTMLElement> {
  name: string;
  /**
   * Where the title goes, which is the card's real open affordance (`UI-31b`).
   *
   * A link and not a button: opening a library is a navigation, so it is reachable by keyboard,
   * announced as a link, and can be opened in a new tab by anybody who works that way. `onOpen`
   * stays the mouse convenience over the whole card -- the two do the same thing, and this is
   * the one a screen reader is given.
   */
  href?: string;
  /** A quiet line under the meta: who owns a shared library, and what you may do in it. */
  byline?: string;
  /** Mono metadata line, e.g. "3 recordings · 2 h 04 min". */
  meta?: string;
  /** The library colour the user picked, as a `var(--library-*)` reference. */
  colour?: string;
  /** Peaks of the library's most recent recording. */
  peaks?: Peaks | undefined;
  played?: number;
  /** True when the most recent recording has no peaks yet. */
  pending?: boolean;
  onOpen?: () => void;
  /**
   * The copy, for an application that has its own (`UI-22a`).
   *
   * `options` names the overflow control, and takes the library's name because a page of cards
   * would otherwise offer a screen reader nine buttons called "Options".
   */
  labels?: {
    /** What the waveform says before the peaks job has run. */
    noWaveform?: string;
    options?: (name: string) => string;
  };
}

/**
 * A library on the landing page: a solid raised surface, and no gradient.
 *
 * The waveform along the bottom is the library's most recent recording, which is the only thing
 * on the card that is not a number -- a library that has been added to lately looks different
 * from one that has not, without anything having to say so.
 *
 * **The title is the open affordance; `onOpen` is a mouse convenience over the whole card.**
 * `href` renders the title as a link, so opening a library is reachable by keyboard, announced as
 * a link and openable in a new tab -- and the two jsx-a11y rules below stay suppressed rather
 * than satisfied, because the obvious way to satisfy them makes the card worse: `role="button"`
 * on an `<article>` that contains the overflow control nests one control inside another, and a
 * screen reader then announces a button whose label is the whole card and loses the menu inside
 * it. A card with no `href` has no keyboard path to the library and is for a specimen page, not
 * for a view.
 */
export function LibraryCard({
  name,
  href,
  byline,
  meta,
  colour = 'var(--library-clay)',
  peaks,
  played = 0,
  pending = false,
  onOpen,
  labels,
  style,
  ...rest
}: LibraryCardProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- the title link is the keyboard path, see above
    <article
      onClick={(event) => {
        if (onOpen === undefined) return;
        // A modifier click stays the browser's, so the title link can still open a new tab.
        // Anything else cancels it: following the `href` would reload out of the router.
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
      data-ds="library-card"
      data-interactive={onOpen === undefined ? undefined : 'true'}
      style={{
        width: '100%',
        height: 'var(--card-height)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        padding: 'var(--panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        cursor: onOpen ? 'pointer' : 'default',
        transition: 'box-shadow var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-chip)',
            flex: '0 0 auto',
            background: colour,
          }}
        />
        <IconButton
          icon="more-vertical"
          variant="ghost"
          size={26}
          label={labels?.options?.(name) ?? `Options for ${name}`}
          // The whole card opens the library, and opening this menu must not.
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      </div>
      <h3
        style={{
          margin: '11px 0 0',
          fontFamily: 'var(--font-sans)',
          fontWeight: 'var(--type-title-weight)',
          fontSize: 'var(--type-title-size)',
          lineHeight: 'var(--type-title-leading)',
          letterSpacing: 'var(--type-title-tracking)',
          color: 'var(--text)',
          textWrap: 'pretty',
        }}
      >
        {href === undefined ? (
          name
        ) : (
          <a data-ds="library-card-title" data-hit-target href={href}>
            {name}
          </a>
        )}
      </h3>
      {byline !== undefined && (
        <span
          style={{
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {byline}
        </span>
      )}
      <span
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'var(--type-numeric-variant)',
          color: 'var(--text-3)',
        }}
      >
        {meta}
      </span>
      <div style={{ marginTop: 'auto' }}>
        <Waveform
          peaks={peaks}
          size="card"
          played={played}
          pending={pending}
          noWaveformLabel={labels?.noWaveform}
        />
      </div>
    </article>
  );
}
