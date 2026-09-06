import type { HTMLAttributes } from 'react';

import { IconButton } from '../forms/IconButton';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';

export interface LibraryCardProps extends HTMLAttributes<HTMLElement> {
  name: string;
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
}

/**
 * A library on the landing page: a solid raised surface, and no gradient.
 *
 * The waveform along the bottom is the library's most recent recording, which is the only thing
 * on the card that is not a number -- a library that has been added to lately looks different
 * from one that has not, without anything having to say so.
 *
 * **`onOpen` is a mouse convenience and is knowingly not keyboard-reachable (`UI-1g`).** The two
 * jsx-a11y rules below are suppressed rather than satisfied, because the obvious way to satisfy
 * them makes the card worse: `role="button"` on an `<article>` that contains the overflow control
 * nests one control inside another, and a screen reader then announces a button whose label is
 * the whole card and loses the menu inside it. The card needs a real open affordance -- the title
 * as a link to `/libraries/<uuid>`, which is a route that exists -- and that is `UI-31b`'s to add
 * when it wires this component to data. Inventing it inside a transcription would be the redesign
 * these five tasks are told not to do.
 */
export function LibraryCard({
  name,
  meta,
  colour = 'var(--library-clay)',
  peaks,
  played = 0,
  pending = false,
  onOpen,
  style,
  ...rest
}: LibraryCardProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- UI-31b, see above
    <article
      onClick={onOpen}
      style={{
        width: '100%',
        height: 'var(--card-height)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-card)',
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
        <IconButton icon="more-vertical" variant="ghost" size={26} label={`Options for ${name}`} />
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
        {name}
      </h3>
      <span
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-3)',
        }}
      >
        {meta}
      </span>
      <div style={{ marginTop: 'auto' }}>
        <Waveform peaks={peaks} size="card" played={played} pending={pending} />
      </div>
    </article>
  );
}
