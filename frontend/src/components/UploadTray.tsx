import type { ReactNode } from 'react';

import { IconButton } from '@/design-system';

export interface UploadTrayProps {
  /** The one-line summary: "3 of 30 uploaded, 1 failed". Shown collapsed as well as expanded. */
  summary: string;
  /** Whether it is showing the single line or the whole list. The view owns this. */
  collapsed: boolean;
  onToggle: () => void;
  /**
   * Closing it. **Absent while anything is still going**, because a tray you can close
   * mid-upload is a tray somebody closes mid-upload -- pass `undefined` until everything has
   * finished or failed.
   */
  onClose?: () => void;
  /** A `Progress` per file, and whatever a failed one needs beside it. `UI-18e` fills this. */
  children?: ReactNode;
}

/**
 * The upload tray's chrome, docked above the player (`UI-35i`).
 *
 * **The chrome only.** Which files are going, how far each has got, what to do about one that
 * failed and what happens if the tab is closed are `UI-18e`'s upload state machine, which lives in
 * a store because it has to outlive every route change. This is the panel that shows it: a header
 * that is always readable, a collapsed state that is one line, and the fact that it sits above the
 * player rather than over it.
 *
 * It collapses to a line rather than closing, because an upload of thirty files takes long enough
 * that somebody will want the screen back and short enough that they will want to know. The
 * summary is the same string in both states, so collapsing loses the list and never the answer.
 *
 * **There is no close control while anything is still going.** The tray is the only place an
 * upload's progress exists, and a close button beside a running upload is one somebody presses.
 */
export function UploadTray({ summary, collapsed, onToggle, onClose, children }: UploadTrayProps) {
  return (
    <section
      aria-label="Uploads"
      style={{
        flex: '0 0 auto',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
        padding: collapsed ? '0 var(--space-3) 0 var(--space-4)' : 'var(--space-3) var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: collapsed ? 0 : 'var(--space-3)',
        maxHeight: collapsed ? 'var(--hit-target)' : '40vh',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          minHeight: 'var(--hit-target)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flex: '0 0 auto',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {summary}
        </span>
        <IconButton
          icon={collapsed ? 'chevron-down' : 'x'}
          variant="ghost"
          size={26}
          label={collapsed ? 'Show the uploads' : 'Hide the uploads'}
          onClick={onToggle}
          style={collapsed ? { rotate: '180deg' } : undefined}
        />
        {onClose !== undefined && (
          <IconButton icon="x" variant="ghost" size={26} label="Close the tray" onClick={onClose} />
        )}
      </header>
      {!collapsed && (
        <div
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}
