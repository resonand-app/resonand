/**
 * §1.8's keyboard model, once (`UI-4g`).
 *
 * One handler on the document rather than a binding per view, for a reason that is not tidiness:
 * `Space` plays and pauses **anywhere no field has focus**, and a rule of that shape cannot be
 * written per view -- every view would have to agree about what "no field has focus" means, and
 * the one that got it wrong would eat a space bar in a search box.
 *
 * The whole model is a table so it can be read against the specification and tested key by key.
 * What is not here is as deliberate as what is: no shortcut has a modifier except `⌘K`, because a
 * product whose shortcuts need a chord is a product whose shortcuts nobody learns.
 *
 * **Nothing fires while somebody is typing.** A field, a textarea, a select or anything
 * `contenteditable` swallows every binding except `Escape` -- which is how you leave a field, and
 * therefore the one that has to work inside one.
 */

/** What a binding asks the interface to do. Each is answered by whoever owns that thing. */
export type Command =
  | 'focus-search'
  | 'play-pause'
  | 'seek-back'
  | 'seek-forward'
  | 'skip-back'
  | 'skip-forward'
  | 'previous-segment'
  | 'next-segment'
  | 'open'
  | 'toggle-selection'
  | 'dismiss';

/** How far the arrows move, in seconds (§1.8). */
export const SEEK_SECONDS = 5;
export const SKIP_SECONDS = 15;

export interface Binding {
  key: string;
  /** `⌘K` on a Mac, `Ctrl+K` elsewhere. The only chord in the product. */
  withModifier?: boolean;
  shift?: boolean;
  command: Command;
  /** Whether it still fires while a field has focus. Only `Escape` does. */
  whileTyping?: boolean;
}

export const BINDINGS: readonly Binding[] = [
  { key: 'k', withModifier: true, command: 'focus-search' },
  { key: '/', command: 'focus-search' },
  { key: ' ', command: 'play-pause' },
  { key: 'ArrowLeft', command: 'seek-back' },
  { key: 'ArrowRight', command: 'seek-forward' },
  { key: 'ArrowLeft', shift: true, command: 'skip-back' },
  { key: 'ArrowRight', shift: true, command: 'skip-forward' },
  { key: 'ArrowUp', command: 'previous-segment' },
  { key: 'ArrowDown', command: 'next-segment' },
  { key: 'Enter', command: 'open' },
  { key: 'Escape', command: 'dismiss', whileTyping: true },
];

/**
 * Which command a key press means, or nothing.
 *
 * `Space` and `Enter` are the two that depend on where focus is, and both are handled by leaving
 * them alone: a focused row answers `Enter` by opening and `Space` by toggling its selection,
 * and the browser is what routes a key to the focused element. This function only reports what
 * a press means; refusing to act on a press the focused element already handled is the caller's
 * business, and `interactive()` is what it asks.
 */
export function commandFor(event: KeyboardEvent): Command | null {
  const typing = isTyping(event.target);
  const modifier = event.metaKey || event.ctrlKey;
  for (const binding of BINDINGS) {
    if (binding.key.toLowerCase() !== event.key.toLowerCase()) continue;
    if ((binding.withModifier ?? false) !== modifier) continue;
    if ((binding.shift ?? false) !== event.shiftKey) continue;
    if (typing && !(binding.whileTyping ?? false)) return null;
    return binding.command;
  }
  return null;
}

/**
 * Whether the press landed somewhere that eats keys.
 *
 * Deliberately generous: a `contenteditable` inside a component nobody has written yet is still
 * somewhere somebody is typing, and the failure of guessing wrong here is a space bar that plays
 * a recording in the middle of a sentence.
 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/** Whether the focused element answers this key itself, so the global handler must not. */
export function interactive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || tag === 'summary' || target.role === 'button';
}
