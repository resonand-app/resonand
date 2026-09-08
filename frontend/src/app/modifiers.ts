/**
 * Whether a modifier was held, for a control that is not handed the event (`UI-9a`, `UI-9d`).
 *
 * `⇧`-click selects a range, and a range is a property of the click rather than of the checkbox
 * that received it. The design system's `Checkbox` hands back whether it is now checked, which is
 * the right signature for a checkbox -- one that took a modifier as a prop would be a checkbox
 * that knew about ranges, in a library that does not know what a recording is.
 *
 * So the modifier is read from the last pointer or key event instead. `mousedown` rather than
 * `click`, because that is the event that carries the state at the moment somebody pressed, and
 * the key listeners keep it right for a keyboard that holds `⇧` and presses `Space`.
 *
 * One listener set for the tab, installed on first read and never removed: it is three booleans
 * and no allocation, and a hook per row would be one listener per visible recording.
 */

let shift = false;
let installed = false;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const read = (event: MouseEvent | KeyboardEvent) => {
    shift = event.shiftKey;
  };
  window.addEventListener('mousedown', read, { capture: true });
  window.addEventListener('keydown', read, { capture: true });
  window.addEventListener('keyup', read, { capture: true });
  // A window that loses focus while `⇧` is down never sees the `keyup`, and the next click a
  // minute later would extend a range nobody asked for.
  window.addEventListener('blur', () => {
    shift = false;
  });
}

/** Whether `⇧` was down for the event being handled. */
export function shiftHeld(): boolean {
  install();
  return shift;
}

/** For a test that needs to say what the keyboard was doing. */
export function forgetModifiers(): void {
  shift = false;
}
