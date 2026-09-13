import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Icon } from '../foundation/Icon';

export interface InlineFieldProps {
  /** What is stored now. */
  value: string;
  /** Called on blur, and on `Enter` in a single-line field, with the new value. */
  onSave: (value: string) => void;
  /** The 10px mono overline above it: RECORDED, CATEGORY, TITLE. */
  label?: string;
  /**
   * Shown in place of an empty value. "No notes", "Untitled".
   *
   * Optional on purpose: a field whose emptiness is self-evident under its own overline reads
   * better empty than filled with a sentence about being empty.
   */
  placeholder?: string;
  /**
   * **Read-only because of permission**, which is a different thing from disabled.
   *
   * It draws the third state: no box, no pencil, no disabled control -- the value simply sits on
   * the page under a hairline. A greyed-out input reads as broken; text on a page reads as a
   * decision, and the decision was made by whoever shared the library.
   */
  readOnly?: boolean;
  /** A textarea rather than an input. The notes field, and nothing else so far. */
  multiline?: boolean;
}

/**
 * The metadata panel's workhorse, in three states (`UI-34l`).
 *
 * Editable at rest, editing, and read-only because of permission. The third is the hard one and
 * the reason this is a component rather than a `TextField` with a flag: **it has to read as
 * deliberately non-editable rather than as broken**. So it is not a disabled input. There is no
 * box, no pencil and no greyed-out control -- the value sits on the page under a hairline, which
 * is what a fact looks like when it is somebody else's to change.
 *
 * **It saves on blur**, which is the panel's whole interaction model: nothing here has a Save
 * button, because a panel of eight fields with eight Save buttons is a form, and this is a
 * caption you are correcting. `Enter` saves a single-line field too; `Esc` puts back what was
 * there and gives up.
 *
 * The pencil is an affordance and not a control -- clicking anywhere on the row starts editing,
 * because a 15px target beside a 200px row is a target nobody aims at.
 */
export function InlineField({
  value,
  onSave,
  label,
  placeholder,
  readOnly = false,
  multiline = false,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  /* Whether the exit was `Esc`. A cancel blurs the field, and the blur handler would otherwise
     save the very draft the cancel just threw away. */
  const cancelled = useRef(false);

  const start = () => {
    if (readOnly) return;
    setDraft(value);
    cancelled.current = false;
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft !== value) onSave(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      setDraft(value);
      setEditing(false);
      return;
    }
    // `Enter` in a textarea is a newline, and notes have paragraphs.
    if (event.key === 'Enter' && !multiline) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const overline =
    label === undefined ? null : (
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-overline-size)',
          fontWeight: 'var(--type-overline-weight)',
          letterSpacing: 'var(--type-overline-tracking)',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </span>
    );

  const shown = value === '' ? (placeholder ?? '') : value;

  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {overline}
        <span
          data-ds="inline-field-static"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 0',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
          }}
        >
          {shown}
        </span>
      </div>
    );
  }

  if (editing) {
    const shared = {
      autoFocus: true,
      value: draft,
      onChange: (event: { target: { value: string } }) => {
        setDraft(event.target.value);
      },
      onBlur: commit,
      onKeyDown,
      'aria-label': label,
      style: {
        width: '100%',
        border: 'none',
        background: 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        color: 'var(--text)',
        resize: 'none' as const,
      },
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {overline}
        <span
          data-ds="field-box"
          style={{
            minHeight: 'var(--field-height)',
            display: 'flex',
            alignItems: 'center',
            padding: multiline ? '8px 11px' : '0 11px',
            borderRadius: 'var(--radius-control)',
            background: 'var(--surface-2)',
          }}
        >
          {multiline ? <textarea rows={3} {...shared} /> : <input type="text" {...shared} />}
        </span>
        <span style={{ fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
          Saves when you click away.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {overline}
      <button
        type="button"
        data-ds="inline-field"
        data-hit-target=""
        // A field with nothing in it and no placeholder has no text to be named by, and an
        // unnamed button is one a screen reader announces as "button". The label names it only
        // then: where there is a value, the value is what should be read out.
        aria-label={shown === '' ? label : undefined}
        onClick={start}
        onFocus={start}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          minHeight: 'var(--field-height)',
          padding: '9px 11px',
          border: 'none',
          borderRadius: 'var(--radius-control)',
          textAlign: 'left',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          transition: 'background var(--transition-state)',
        }}
      >
        <span style={{ minWidth: 0, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{shown}</span>
        <span data-ds="inline-field-pencil" aria-hidden style={{ display: 'flex' }}>
          <Icon name="pencil" size={15} />
        </span>
      </button>
    </div>
  );
}
