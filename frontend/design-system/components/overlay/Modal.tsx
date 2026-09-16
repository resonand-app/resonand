import type { ReactNode } from 'react';

import { useAnchoredOverlay } from './use-anchored-overlay';

export interface ModalProps {
  open: boolean;
  /** Asked to close: `Esc`, a pointer on the scrim, or the panel's own close control. */
  onClose: () => void;
  /** The panel. A `Dialog`, or a `TypedConfirm`. */
  children: ReactNode;
}

/**
 * What puts a dialog in front of the page (`UI-34a`).
 *
 * `Dialog` is the panel and nothing else -- its title, its description, its close control and its
 * footer -- which is right, and leaves the half that is not drawing: a scrim, a focus trap, `Esc`,
 * a pointer outside, a locked page behind, and focus returned to whatever opened it. That half is
 * the same for every dialog in the product, so it is written once here rather than once per view.
 *
 * It is separate from `Dialog` rather than an `open` prop on it, because the two are genuinely
 * different objects: the panel is a shape, and this is a behaviour. Composing them keeps the
 * panel renderable on its own -- a specimen page draws twenty of them at once, and none of them
 * should be trapping a keyboard.
 *
 * Focus lands on the first focusable thing in the panel, which for a `Dialog` is its close
 * control. That is right for a confirm -- `Enter` then means cancel -- and wrong for anything
 * somebody opened in order to type, so a dialog with a field puts `data-initial-focus` on it and
 * gets the caret instead.
 *
 * `Sheet` is the phone's answer to the same problem and does its own placing for the same reason:
 * it is anchored to the bottom of the viewport rather than to a control on the page.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  const { surfaceRef } = useAnchoredOverlay({
    open,
    onClose,
    anchored: false,
    lockScroll: true,
  });

  if (!open) return null;

  return (
    <>
      <div
        data-ds="scrim"
        aria-hidden
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-scrim)' }}
      />
      {/* The centring wrapper and not the panel itself: the panel owns its width, and a dialog
          taller than the viewport has to be able to scroll rather than to have its footer fall
          off the bottom of the screen. */}
      <div
        ref={surfaceRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--z-dialog)',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-4)',
          overflowY: 'auto',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', maxWidth: '100%' }}>{children}</div>
      </div>
    </>
  );
}
