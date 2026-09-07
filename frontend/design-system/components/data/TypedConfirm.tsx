import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '../forms/Button';
import { matchesName } from './name-match';
import { TextField } from '../forms/TextField';
import { useAnchoredOverlay } from '../overlay/useAnchoredOverlay';

export interface TypedConfirmProps {
  /** The exact name that has to be typed. Shown twice: in the title and in the label. */
  name: string;
  /**
   * What will be destroyed, **in numbers**: "84 recordings, 12 h 40 min of audio and their
   * transcripts". The component supplies "This destroys" and "It cannot be undone" around it.
   */
  consequence: ReactNode;
  /** The verb, for the title and the button: "Delete", "Empty". Defaults to Delete. */
  verb?: string;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
}

/**
 * Permanent deletion, stated in numbers and typed out (`UI-34m`).
 *
 * **Only for deletion that cannot be undone.** Sending a recording to the trash is recoverable and
 * uses an ordinary confirm -- a `Dialog` with a danger button -- and using this for it would be
 * the boy who cried wolf: a gesture that means "this is the irreversible one" stops meaning
 * anything the second time it is asked for something reversible.
 *
 * It states the cost before it asks for the name, and it states it in numbers, because "Are you
 * sure?" tells somebody nothing they did not already know. The product's second hard promise is
 * that nothing is destroyed without being told what will be lost, and this component is where
 * that promise is kept.
 *
 * **The confirm button is drawn and disabled**, where `UI-34c`'s menus make an unavailable action
 * absent. The two rules do not conflict: a menu item you cannot use is one you will never be able
 * to use, and hiding it is the honest answer; this button is one you are three keystrokes away
 * from, and hiding it would remove the thing the typing is working towards. It is a real
 * `disabled` on a real `<button>`, so it is out of the tab order and cannot fire -- which is
 * `UI-34m`'s criterion, and the reason it is not an opacity with a click handler still on it.
 */
export function TypedConfirm({
  name,
  consequence,
  verb = 'Delete',
  onConfirm,
  onCancel,
  open,
}: TypedConfirmProps) {
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const matched = matchesName(typed, name);

  const { surfaceRef, id } = useAnchoredOverlay({
    open,
    onClose: onCancel,
    anchored: false,
    lockScroll: true,
  });

  if (!open) return null;

  return (
    <>
      <div data-ds="scrim" aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-scrim)' }} />
      <div
        ref={surfaceRef}
        id={id}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        tabIndex={-1}
        data-ds="typed-confirm"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          translate: '-50% -50%',
          zIndex: 'var(--z-dialog)',
          width: 420,
          maxWidth: 'calc(100% - var(--space-8))',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-panel)',
          boxShadow: 'var(--elevation-overlay)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-title-size)',
              fontWeight: 'var(--type-title-weight)',
              letterSpacing: 'var(--type-title-tracking)',
              color: 'var(--text)',
            }}
          >
            {verb} {name} permanently
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--type-ui-size)',
              lineHeight: 'var(--type-body-leading)',
              color: 'var(--text-2)',
              textWrap: 'pretty',
            }}
          >
            This destroys {consequence}. It cannot be undone.
          </p>
        </div>
        <TextField
          label={`Type ${name} to confirm`}
          value={typed}
          placeholder={name}
          autoComplete="off"
          onChange={(event) => {
            setTyped(event.target.value);
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!matched} onClick={onConfirm}>
            {verb} permanently
          </Button>
        </div>
      </div>
    </>
  );
}
