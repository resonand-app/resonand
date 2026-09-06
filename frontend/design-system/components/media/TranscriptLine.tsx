import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

export interface TranscriptLineProps extends HTMLAttributes<HTMLDivElement> {
  /** Timestamp, mono and tabular, e.g. 18:04. */
  at: string;
  /** True for the line currently being spoken. Exactly one at a time. */
  active?: boolean;
  children?: ReactNode;
}

/**
 * One timestamped line of transcript. Click to seek; the active line follows playback.
 *
 * **A line that seeks is a control, so it is reachable from the keyboard (`UI-1f`).** The `.jsx`
 * put `onClick` on a bare `<div>`, which is a seek nobody can perform without a mouse -- on the
 * screen the product exists for, and on the one element `UI-12c` promises full keyboard operation
 * of. It takes a role, a tab stop and Enter/Space only when there is an `onClick` to perform;
 * without one it stays inert text, because a transcript in a read-only view is not a list of
 * buttons. Nothing about it moved a pixel. The arrow-key model between segments is still `UI-12c`.
 */
export function TranscriptLine({
  at,
  children,
  active,
  onClick,
  onKeyDown,
  style,
  ...rest
}: TranscriptLineProps) {
  const interactive = onClick !== undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!interactive || event.defaultPrevented) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: 'flex',
        gap: 12,
        padding: '7px 9px',
        borderRadius: 9,
        background: active ? 'var(--accent-soft)' : 'transparent',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          fontSize: '11.5px',
          fontVariantNumeric: 'tabular-nums',
          color: active ? 'var(--accent-on-soft)' : 'var(--text-3)',
          flex: '0 0 auto',
          paddingTop: 2,
        }}
      >
        {at}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          lineHeight: 1.55,
          color: active ? 'var(--text)' : 'var(--text-2)',
          textWrap: 'pretty',
        }}
      >
        {children}
      </span>
    </div>
  );
}
