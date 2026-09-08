/**
 * What is selected, and what a range means (`UI-9a`, `UI-9d`, §V3).
 *
 * **A set of uuids, and not the recordings.** A selection has to survive a filter change, a sort,
 * a page arriving and a recording being renamed -- and it has to survive being two hundred long
 * without the bulk bar holding two hundred objects to count them. What it cannot survive is the
 * recording leaving the list it was selected in, which is why `retain` exists: after a bulk move,
 * what is still selected is what did not move (`UI-9c`).
 *
 * **The order is the list's, not the click order.** `⇧`-click selects everything between the last
 * click and this one, and "between" is only meaningful in the order on screen -- so the anchor is
 * an index into the rows as drawn, and the caller passes the uuids in that order.
 *
 * It is a plain module rather than a store: a selection belongs to one view and dies with it.
 * `UI-5`'s playback and `UI-18`'s tray outlive a route and are stores for that reason; a set of
 * ticked checkboxes that survived navigation would be a bulk action somebody had forgotten about.
 */

export interface SelectionState {
  /** The uuids selected, in no particular order. */
  selected: ReadonlySet<string>;
  /** Where the last plain click landed, for the next `⇧`-click to measure from. */
  anchor: string | null;
}

export const EMPTY: SelectionState = { selected: new Set(), anchor: null };

/** Turn one on or off, and remember where the click was. */
export function toggle(state: SelectionState, uuid: string): SelectionState {
  const selected = new Set(state.selected);
  if (selected.has(uuid)) selected.delete(uuid);
  else selected.add(uuid);
  return { selected, anchor: uuid };
}

/**
 * Select everything between the last click and this one, in the order on screen.
 *
 * Adds rather than replaces: `⇧`-clicking twice in two places selects both runs, which is what
 * somebody picking a few groups out of eight hundred recordings expects. With no anchor -- a
 * `⇧`-click as the first thing anybody does -- it is an ordinary click, because a range from
 * nowhere has no meaning and refusing to do anything reads as a broken checkbox.
 */
export function extendTo(
  state: SelectionState,
  uuid: string,
  order: readonly string[],
): SelectionState {
  if (state.anchor === null) return toggle(state, uuid);
  const from = order.indexOf(state.anchor);
  const to = order.indexOf(uuid);
  if (from === -1 || to === -1) return toggle(state, uuid);

  const selected = new Set(state.selected);
  for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) {
    const one = order[index];
    if (one !== undefined) selected.add(one);
  }
  // The anchor stays where it was, so a second `⇧`-click grows or shrinks the same run rather
  // than starting a new one from the end of the last.
  return { selected, anchor: state.anchor };
}

/** Everything in view, or nothing. The header checkbox. */
export function selectAll(
  state: SelectionState,
  order: readonly string[],
  on: boolean,
): SelectionState {
  return on ? { selected: new Set(order), anchor: state.anchor } : EMPTY;
}

/** Keep only these, which after a partial failure is the ones that did not succeed (`UI-9c`). */
export function retain(state: SelectionState, uuids: readonly string[]): SelectionState {
  const keep = new Set(uuids);
  return {
    selected: new Set([...state.selected].filter((uuid) => keep.has(uuid))),
    anchor: state.anchor !== null && keep.has(state.anchor) ? state.anchor : null,
  };
}

/** Whether every row in view is selected, some of them, or none. The header's three states. */
export function coverage(state: SelectionState, order: readonly string[]): boolean | 'mixed' {
  if (order.length === 0) return false;
  const chosen = order.filter((uuid) => state.selected.has(uuid)).length;
  if (chosen === 0) return false;
  return chosen === order.length ? true : 'mixed';
}
