import type { ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface StateCardProps {
  /** The glyph. `library` for nothing yet, `search` for a filter, `alert-circle` for an error. */
  icon?: IconName;
  /** One line, sentence case, no exclamation mark. "No recordings yet." */
  title: string;
  /**
   * What to do about it, or what happened. For an error this is the problem document's `detail`,
   * shown rather than replaced -- §1.9 says `detail` is written to be read by a person.
   */
  body?: ReactNode;
  /** The way out: "Upload audio", "Clear the filter", "Try again". */
  action?: ReactNode;
  /** A quieter line under the action. Retention, a count, a reason. */
  footnote?: ReactNode;
  /**
   * A dashed edge instead of a filled surface.
   *
   * For "nothing yet" only. The dashed edge is the system's one border that is not a divider, and
   * it means an empty place rather than a broken one -- which is exactly the distinction §3.5
   * calls the classic mistake.
   */
  dashed?: boolean;
}

/**
 * The centred message card: §3.5's state family, drawn once (`UI-35c`).
 *
 * Seven states share it -- loading, nothing yet, a filter that matched nothing, an error,
 * read-only, partial failure, and the instance being unreachable -- and they share it so that the
 * two that look alike stay different. **"No recordings yet" and "No recordings match that tag"
 * are not the same screen**: one is a new library and the other is a mistyped filter, and
 * confusing them is the mistake the specification names. This component makes the difference a
 * prop somebody has to choose rather than a copy-paste somebody forgets to edit.
 *
 * The copy rules are the product's: sentence case, no exclamation mark, no apology, and never a
 * sad drawing. An empty library is an invitation to act, and the action is in the card.
 */
export function StateCard({ icon, title, body, action, footnote, dashed }: StateCardProps) {
  return (
    <div
      data-ds="state-card"
      data-dashed={dashed === true ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-12) var(--space-6)',
        borderRadius: 'var(--radius-panel)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {icon !== undefined && (
        <span
          data-ds="state-card-glyph"
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-circle)',
          }}
        >
          <Icon name={icon} size={19} />
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
        <span
          style={{
            fontSize: 'var(--type-title-size)',
            fontWeight: 'var(--type-title-weight)',
            letterSpacing: 'var(--type-title-tracking)',
            color: 'var(--text)',
          }}
        >
          {title}
        </span>
        {body !== undefined && (
          // A `div` and not a `p`: `body` is a `ReactNode`, and the transcription states put a
          // whole `EgressNotice` in it -- which is a paragraph, and a paragraph inside a
          // paragraph is markup the browser silently takes apart.
          <div
            style={{
              fontSize: 'var(--type-ui-size)',
              lineHeight: 'var(--type-body-leading)',
              color: 'var(--text-2)',
              textWrap: 'pretty',
            }}
          >
            {body}
          </div>
        )}
      </div>
      {action}
      {footnote !== undefined && (
        <span style={{ fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
          {footnote}
        </span>
      )}
    </div>
  );
}

/**
 * A block of the shape the real thing will be.
 *
 * **It does not shimmer, pulse or move.** The transcript following playback is the only thing in
 * this product that moves on its own; a loading state that animates would be the second, and it
 * would animate on every screen, for everybody, for ever. A block in `--empty-fill` says the same
 * thing and says it while somebody has `prefers-reduced-motion` set.
 */
function Block({ width, height, radius }: { width: number | string; height: number; radius?: string }) {
  return (
    <span
      data-ds="skeleton-block"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius ?? 'var(--radius-chip)',
        flex: '0 0 auto',
      }}
    />
  );
}

/**
 * The card skeleton: 320x188, with a waveform-shaped block where the waveform goes (`UI-35c`).
 *
 * It matches the real layout rather than being a grey rectangle, because the point of a skeleton
 * is that the page does not jump when the data arrives. A card that knows its own shape has no
 * excuse for a spinner.
 */
export function CardSkeleton() {
  return (
    <div
      data-ds="card-skeleton"
      aria-hidden
      style={{
        width: '100%',
        height: 'var(--card-height)',
        padding: 'var(--panel-padding)',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Block width={26} height={26} />
      <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Block width="60%" height={17} />
        <Block width="40%" height={11} />
      </div>
      <div style={{ marginTop: 'auto' }}>
        <Block width="100%" height={38} />
      </div>
    </div>
  );
}

/** The dense list's skeleton: one row at `--row-height`, in the same three columns. */
export function RowSkeleton() {
  return (
    <div
      data-ds="row-skeleton"
      aria-hidden
      style={{
        height: 'var(--row-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '0 12px',
      }}
    >
      <Block width={15} height={15} radius="var(--radius-circle)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <Block width="55%" height={13} />
      </span>
      <Block width={88} height={20} />
      <Block width={46} height={11} />
    </div>
  );
}
