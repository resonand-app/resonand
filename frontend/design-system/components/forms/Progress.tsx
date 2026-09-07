export interface ProgressProps {
  /** How far along, 0-1. There is no other way to describe progress here, on purpose. */
  value: number;
  /** The thing being measured: a file name, or "Overall". */
  label: string;
  /** The right-hand side of the label row, mono: "64% · 284 MB", "3 of 30 uploaded, 1 failed". */
  detail?: string;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            color: 'var(--text)',
          }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          {detail !== undefined && (
            <span
              style={{
                flex: '0 0 auto',
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
  );
}
