import type { ReactNode } from 'react';

/**
 * What the detail column is kept at, so the bar does not change width every time the status does.
 * Measured from the longest of them -- "72% · Checking" -- because a bar that grows by fourteen
 * pixels when a file finishes is a row that moves under the eye reading it.
 */
const DETAIL_WIDTH = 108;

export interface ProgressProps {
  /** How far along, 0-1. There is no other way to describe progress here, on purpose. */
  value: number;
  /** The thing being measured: a file name, or "Overall". */
  label: string;
  /**
   * What is beside the bar, mono: "64% · 284 MB", or a glyph for an outcome with nothing left to
   * count. A node rather than a string because "uploaded" as a word is the same information as a
   * tick and takes four times the room -- but a glyph needs its own accessible name, which only
   * the caller has.
   */
  detail?: ReactNode;
  /** Hides the label row for a bar that sits under something already naming it. */
  showLabel?: boolean;
}

/**
 * Per-file upload progress, and nothing else (`UI-34i`).
 *
 * **It has no indeterminate mode, deliberately, and the absence is the component.** There is
 * exactly one other thing in this product somebody would reach for a progress bar for --
 * transcription -- and transcription has no percentage: the job reports a state and a start time,
 * and the honest way to describe it is "running, started 4 minutes ago", which `StateBadge` and a
 * relative time already do. A bar that filled itself at an invented rate, or slid back and forth
 * for eleven minutes, would be the interface making something up about somebody's recording.
 *
 * So there is no `indeterminate` prop to reach for. That is not an oversight to be fixed the first
 * time a view wants one: it is the fix. The test asserts the prop does not exist.
 *
 * `value` is clamped rather than trusted. A byte counter that overshoots -- a retried chunk, a
 * server that counts the request body differently -- would otherwise draw a bar wider than its
 * track, which reads as a bug in the upload rather than in the arithmetic.
 */
export function Progress({ value, label, detail, showLabel = true }: ProgressProps) {
  const fraction = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    // The detail is centred against the name and the bar together, not against the bar: a tick
    // level with a 4px rule and a name above it reads as a mark that belongs to the rule alone.
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showLabel && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size)',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </span>
        )}
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          data-ds="progress"
          style={{
            height: 4,
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
          }}
        >
          <div
            data-ds="progress-fill"
            style={{
              width: `${String(fraction * 100)}%`,
              height: '100%',
              borderRadius: 'var(--radius-pill)',
              transition: 'width var(--transition-state)',
            }}
          />
        </div>
      </div>
      {detail !== undefined && (
        <span
          style={{
            flex: '0 0 auto',
            minWidth: DETAIL_WIDTH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-numeric-size)',
            fontVariantNumeric: 'var(--type-numeric-variant)',
            color: 'var(--text-3)',
          }}
        >
          {detail}
        </span>
      )}
    </div>
  );
}
