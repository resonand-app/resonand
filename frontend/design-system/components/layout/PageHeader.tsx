import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';

export interface PageHeaderProps {
  /**
   * The page title. **The only Chillax on the screen**, and there is one of these per view.
   *
   * A string and not a node, on purpose: a node here is how somebody eventually puts a second
   * typeface, an icon or a badge inside the one piece of display type the product has. That
   * holds whether or not the title can be corrected -- `onTitleSave` is how a view makes it
   * editable, and the pencil it draws belongs to this component rather than to the caller.
   */
  title: string;
  /**
   * Makes the title correctable in place, and is what draws the pencil beside it.
   *
   * Called on blur, and on `Enter`, with the new value -- never with the old one. Omit it and
   * the title is a heading and nothing else, which is what every view but the recording's
   * wants: a library's name is corrected in its settings, and a screen whose title is the
   * subject's own name is the exception rather than the rule.
   *
   * The caller decides whether that is allowed. A title somebody may not change has no
   * `onTitleSave`, so there is no pencil and nothing to click -- the third state `InlineField`
   * draws under a hairline is not drawn here, because a page title is already a fact on a page.
   */
  onTitleSave?: (value: string) => void;
  /**
   * Names the pencil for a screen reader. Required by `onTitleSave` and ignored without it.
   *
   * The design system holds no copy, so the word arrives from the view's own translations.
   */
  editLabel?: string;
  /** The mono meta line under it: "37 recordings · 24 h 12 min". Numbers, tabular. */
  meta?: string;
  /** A library's colour dot, or a state badge -- anything that qualifies the title. */
  before?: ReactNode;
  /** Right-aligned actions. One primary at most, per the type rule about primaries. */
  actions?: ReactNode;
}

/**
 * The one page title per screen, and the enforcement point for that rule (`UI-35b`).
 *
 * Chillax appears in exactly two places in this product: the wordmark, and the title of the view
 * you are looking at. It is a soft geometric sans that is lovely at 33px and wrong in a 36px row,
 * and a system with one display face survives only if there is one component that draws it.
 *
 * So `title` is a `string`. Every other slot here takes a node, and this one does not, because a
 * node is how a second typeface gets inside the page title six months from now -- as an icon, a
 * badge, a "beta" pill. A view that needs something beside the title puts it in `before`, at the
 * interface's own size.
 *
 * **A title can be corrected in place, and that is a prop rather than a node** (`UI-11i`). The
 * recording's title is the subject's own name and the specification has it inline-editable as
 * the one Chillax element, so the affordance is built in here where the type is drawn: the
 * pencil is the design system's, at the interface's size and never in Chillax, and the string
 * stays a string. Handing the caller a node to put beside the title would have given away the
 * very thing the rule above protects.
 *
 * **The heading stays a heading.** The control goes inside the `h1` rather than replacing it,
 * because a screen's one document heading is how a screen reader user finds their place, and a
 * page whose title is a button and nothing else has no heading at all.
 */
export function PageHeader({
  title,
  onTitleSave,
  editLabel,
  meta,
  before,
  actions,
}: PageHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  /* Whether the exit was `Esc`. A cancel blurs the input, and the blur handler would otherwise
     save the very draft the cancel just threw away. */
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  /* Moving focus into the input is finishing the click that asked for it, not stealing focus on
     arrival, which is what `autoFocus` would be and what the rule against it is about. The caret
     goes to the end: the value is usually a title being corrected rather than replaced. */
  useEffect(() => {
    if (!editing) return;
    const node = input.current;
    if (node === null) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [editing]);

  const start = () => {
    setDraft(title);
    cancelled.current = false;
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft !== title) onTitleSave?.(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      setDraft(title);
      setEditing(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  // Every branch draws the same type, so nothing moves when the input arrives or leaves.
  const titleType = {
    fontFamily: 'var(--type-page-title-family)',
    fontSize: 'var(--type-page-title-size)',
    fontWeight: 'var(--type-page-title-weight)',
    letterSpacing: 'var(--type-page-title-tracking)',
    lineHeight: 'var(--type-page-title-leading)',
  };

  return (
    <header
      data-ds="page-header"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-6)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {before}
          <h1
            style={{
              margin: 0,
              ...titleType,
              color: 'var(--text)',
              minWidth: 0,
              textWrap: 'pretty',
            }}
          >
            {onTitleSave === undefined ? (
              title
            ) : editing ? (
              <input
                type="text"
                ref={input}
                value={draft}
                aria-label={editLabel}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onBlur={commit}
                onKeyDown={onKeyDown}
                data-ds="page-title-input"
                style={{
                  ...titleType,
                  width: '100%',
                  // The box is drawn by the padding, so the text sits where the heading's did
                  // rather than stepping right by the padding's width the moment it is clicked.
                  margin: '-4px -11px',
                  padding: '4px 11px',
                  border: 'none',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text)',
                }}
              />
            ) : (
              <button
                type="button"
                data-ds="page-title"
                // The title is a large target already, but at 33px over 4px of padding it lands
                // a couple of pixels under the floor, and the overlay is what carries it over.
                data-hit-target=""
                onClick={start}
                style={{
                  // `inline` and not a flex row: the button has to flow as the heading's text
                  // did, or the title wraps at the shrunk width of a flex item and the pencil
                  // is left centred in the gap beside it rather than after the last word.
                  display: 'inline',
                  // The same offsets as the input, so the hover tint and the field it becomes
                  // cover the same ground and the title never moves between the two.
                  margin: '-4px -11px',
                  padding: '4px 11px',
                  border: 'none',
                  borderRadius: 'var(--radius-control)',
                  textAlign: 'left',
                  textWrap: 'pretty',
                  ...titleType,
                }}
              >
                {title}
                {/* An affordance and not the control: the whole title starts editing, because a
                    20px target beside a 400px heading is a target nobody aims at. It trails the
                    last word inside the text, so a title that wraps takes its pencil with it. */}
                <span
                  data-ds="page-title-pencil"
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    verticalAlign: 'baseline',
                    marginInlineStart: 12,
                  }}
                >
                  <Icon name="pencil" size={20} />
                </span>
              </button>
            )}
          </h1>
        </div>
        {meta !== undefined && (
          <span
            style={{
              fontFamily: 'var(--type-numeric-family)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {meta}
          </span>
        )}
      </div>
      {actions !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
