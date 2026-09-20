import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/design-system';

import { UPLOAD_ROW_SELECTOR } from './upload-row';

/** How many rows are on screen at once before the list scrolls. */
const VISIBLE_ROWS = 5;

/** Where the measured cap is written, so the stylesheet keeps the viewport limit beside it. */
const ROWS_PROPERTY = '--tray-rows';

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
 * The upload tray's chrome, docked above the player at the right of the frame (`UI-35i`).
 *
 * **The chrome only.** Which files are going, how far each has got, what to do about one that
 * failed and what happens if the tab is closed are `UI-18e`'s upload state machine, which lives in
 * a store because it has to outlive every route change. This is the panel that shows it: a header
 * that is always readable, a collapsed state that is one line, and the fact that it sits above the
 * player rather than over it.
 *
 * **A column at the right, not a band across the foot.** The tray reports on a batch while
 * somebody carries on using the view underneath, so it takes one panel's width and leaves the page
 * visible. Five rows at a time and the sixth is scrolled to: a list as long as the batch is a tray
 * that takes the screen exactly when the batch is big enough to need it.
 *
 * It collapses to a line rather than closing, because an upload of thirty files takes long enough
 * that somebody will want the screen back and short enough that they will want to know. The
 * summary is the same string in both states, so collapsing loses the list and never the answer.
 *
 * **There is no close control while anything is still going.** The tray is the only place an
 * upload's progress exists, and a close button beside a running upload is one somebody presses.
 */
export function UploadTray({ summary, collapsed, onToggle, onClose, children }: UploadTrayProps) {
  const { t } = useTranslation();
  const [scroll, rows] = useFiveRows();
  return (
    <section
      aria-label={t('upload.region')}
      style={{
        flex: '0 0 auto',
        width: '100%',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
        padding: collapsed ? '0 var(--space-3) 0 var(--space-4)' : 'var(--space-3) var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: collapsed ? 0 : 'var(--space-3)',
        maxHeight: collapsed ? 'var(--hit-target)' : undefined,
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
        {/* A chevron and never a second cross: two crosses side by side are two ways to make the
            tray go away, and one of them is keeping the uploads. */}
        <IconButton
          icon={collapsed ? 'chevron-up' : 'chevron-down'}
          variant="ghost"
          size={26}
          label={collapsed ? t('upload.show') : t('upload.hide')}
          onClick={onToggle}
        />
        {onClose !== undefined && (
          <IconButton
            icon="x"
            variant="ghost"
            size={26}
            label={t('upload.close')}
            onClick={onClose}
          />
        )}
      </header>
      {!collapsed && (
        <div
          ref={scroll}
          style={{
            overflowY: 'auto',
            // The scrollbar is drawn over the scrollport's own edge, and a row that ends
            // underneath it is a bar that looks unfinished and a tick with nowhere to sit.
            paddingRight: 'var(--space-4)',
            // The window is the second limit: five rows of a wrapped failure are taller than a
            // short one, and the tray may not outgrow the view it is reporting on.
            maxHeight: `var(${ROWS_PROPERTY}, 40vh)`,
          }}
        >
          <div
            ref={rows}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
          >
            {children}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Cap the list at five rows, measured rather than assumed.
 *
 * A row is a name and a bar until it is a row with a wrapped error and a button under it, so five
 * rows has no height a stylesheet could hold -- and a fixed one would show four and a half of them
 * exactly when a file has failed and the row matters most. The cap is written as a custom property
 * on the scrollport so the viewport limit stays in the style beside it, and it is left unset while
 * there are five rows or fewer: nothing to cap, and the list is as tall as it is.
 *
 * The rows are observed and the scrollport is not: the scrollport is what the cap is applied to,
 * so measuring it would answer with the height it has just been given.
 */
function useFiveRows(): [
  (node: HTMLDivElement | null) => void,
  (node: HTMLDivElement | null) => void,
] {
  const port = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const scrollport = port.current;
    const content = list.current;
    if (scrollport === null || content === null) return;
    const rows = content.querySelectorAll(UPLOAD_ROW_SELECTOR);
    const last = rows[VISIBLE_ROWS - 1];
    if (rows.length <= VISIBLE_ROWS || last === undefined) {
      scrollport.style.removeProperty(ROWS_PROPERTY);
      return;
    }
    const height = last.getBoundingClientRect().bottom - content.getBoundingClientRect().top;
    scrollport.style.setProperty(ROWS_PROPERTY, `min(${String(Math.ceil(height))}px, 40vh)`);
  }, []);

  const attachPort = useCallback((node: HTMLDivElement | null) => {
    port.current = node;
  }, []);

  const attachList = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      list.current = node;
      // A row that reflows without the tray re-rendering -- a window resized, a font arriving --
      // moves the fifth row's bottom, and nothing else would say so.
      if (node === null || typeof ResizeObserver === 'undefined') return;
      observer.current = new ResizeObserver(measure);
      observer.current.observe(node);
    },
    [measure],
  );

  // Every commit, because a file arriving or a failure growing a row is a render and the cap is
  // wrong until it is measured again. It writes a style and holds no state, so nothing cascades.
  useLayoutEffect(measure);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [attachPort, attachList];
}
