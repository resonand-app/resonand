/**
 * 🧪 Gestures and targets on a phone (`UI-24b`, §2.3).
 *
 * Four claims, and the first one had to be built rather than checked. `UI-9a` reveals the
 * selection checkbox on hover, on focus, or once a selection exists -- three desktop facts. On a
 * phone none of them is available before the first recording is picked, so the box sat there at
 * `visibility: hidden` and **a selection could not be started at all**. `use-long-press.ts` is
 * that gap closed; the rest of this file is verification.
 *
 * The other three:
 *
 * - **Swipe down collapses the player**, which is the one gesture somebody uses without looking.
 * - **Nothing tappable is under 44px**, checked against the mounted views rather than the
 *   specimen page, because a control the application composes is one no specimen contains.
 * - **No drag-and-drop.** Worth stating precisely, because the upload dialog does accept a file
 *   dropped from the desktop and that is `UI-18a` asking for it. What `UI-24b` forbids is
 *   drag-and-drop *as an interaction* -- a draggable row, a drag to reorder, a drag to move
 *   between libraries -- none of which works on a touchscreen, and the entry point for getting
 *   audio in is the system picker. So the check is that nothing is `draggable` and nothing
 *   handles a drag it started itself.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePlayback } from '@/player/store';
import { mockApi } from '@/test/api/server';
import { FIELD_TAKE } from '@/test/api/archive';
import { PHONE, VIEWS, mountView } from '@/test/support/views';

import { KNOWN_SMALL_TARGETS, KNOWN_SMALL_TARGETS_IN_VIEWS } from './focus-and-targets';
import { WHOLE_SYSTEM } from './support/timeouts';

mockApi();

afterEach(() => {
  usePlayback.getState().stop();
  vi.useRealTimers();
});

function view(name: string) {
  const found = VIEWS.find((one) => one.name === name);
  if (found === undefined) throw new Error(`${name} is missing from VIEWS.`);
  return found;
}

/** Every card currently drawn. */
function cards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-ds="recording-card"]')];
}

/** The first card, which is the one a press is aimed at. */
function firstCard(): HTMLElement {
  const [card] = cards();
  if (card === undefined) throw new Error('The library drew no cards to press.');
  return card;
}

/** A touch press held for `ms`, without lifting. Pointer type matters: a mouse is excluded. */
async function pressAndHold(target: HTMLElement, ms: number): Promise<void> {
  const user = userEvent.setup();
  await user.pointer({ keys: '[TouchA>]', target });
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('long-press to select', WHOLE_SYSTEM, () => {
  it('starts a selection where a phone otherwise could not', async () => {
    await mountView(view('V3 - A library'), { width: PHONE });
    const card = firstCard();
    expect(card.dataset.selected).toBeUndefined();

    await pressAndHold(card, 600);
    await screen.findByText(/1 selected|selected/i);
    expect(firstCard().dataset.selected).toBe('true');
  });

  it('does not fire on a tap, which is how a recording is opened', async () => {
    const user = userEvent.setup();
    await mountView(view('V3 - A library'), { width: PHONE });
    const card = firstCard();
    const title = within(card).getByRole('link').textContent;

    await user.pointer([{ keys: '[TouchA>]', target: card }, { keys: '[/TouchA]' }]);
    // The tap opened the recording rather than picking it, so the library is no longer on
    // screen: nothing was selected on the way out, which is the claim.
    expect(cards().some((one) => one.dataset.selected === 'true')).toBe(false);
    await screen.findByRole('heading', { name: title, level: 1 });
  });

  it('does not fire when the finger is scrolling', async () => {
    const user = userEvent.setup();
    await mountView(view('V3 - A library'), { width: PHONE });
    const card = firstCard();

    // Down, then away: a finger on its way down a long library rests on a card for exactly as
    // long as this, and a selection appearing under it is the commonest phone-gesture bug there
    // is.
    await user.pointer({ keys: '[TouchA>]', target: card, coords: { clientX: 100, clientY: 100 } });
    await user.pointer({ target: card, coords: { clientX: 100, clientY: 260 } });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(firstCard().dataset.selected).toBeUndefined();
  });

  it('is a touch gesture, so a mouse held down selects nothing', async () => {
    const user = userEvent.setup();
    await mountView(view('V3 - A library'), { width: PHONE });
    const card = firstCard();

    await user.pointer({ keys: '[MouseLeft>]', target: card });
    await new Promise((resolve) => setTimeout(resolve, 600));

    // A mouse has hover, which is `UI-9a`'s answer -- and a held button over a list is somebody
    // about to drag-select text.
    expect(firstCard().dataset.selected).toBeUndefined();
  });
});

describe('swipe down collapses the player', WHOLE_SYSTEM, () => {
  it('is a gesture and not only a button', async () => {
    const user = userEvent.setup();
    await mountView(view('V5 - A recording'), { width: PHONE });

    // Loaded through the store rather than by pressing play: what is under test is the gesture,
    // and getting audio going is `UI-23b`'s subject a file away.
    usePlayback.getState().play({
      uuid: FIELD_TAKE,
      title: 'Field recording, long take',
      library: 'Field recordings',
      durationMs: 2_892_000,
      hasWaveform: true,
    });
    usePlayback.getState().report({ status: 'playing' });

    // The strip's own expand control is the title, which is also the page heading -- so it is
    // reached through the strip rather than by name.
    const strip = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-app="phone-player"]');
      if (found === null) throw new Error('The docked player strip is not there.');
      return found;
    });
    await user.click(within(strip).getByRole('button', { name: /Field recording, long take/ }));

    const full = document.querySelector<HTMLElement>('[data-app="phone-player-full"]');
    expect(full, 'The player did not expand.').not.toBeNull();
    if (full === null) return;

    // Down three hundred pixels and released, which is the gesture somebody makes without
    // looking at the screen -- the collapse button is there too, and is not what this checks.
    await user.pointer([
      { keys: '[TouchA>]', target: full, coords: { clientX: 180, clientY: 120 } },
      { keys: '[/TouchA]', target: full, coords: { clientX: 180, clientY: 420 } },
    ]);

    expect(document.querySelector('[data-app="phone-player-full"]')).toBeNull();
  });
});

/** The floor, as a number, so a control that declares its own size can be read against it. */
const HIT_TARGET_PX = 44;

/**
 * Whether a control answers for its own size.
 *
 * jsdom lays nothing out, so a measured height is always zero and the chain checked instead is
 * the one that produces the pixels: `data-hit-target`, an exemption naming the control, or a
 * height the component states itself. The phone tabs are the last case -- `minHeight: 56`,
 * written where they are drawn and above the floor on purpose, because they are the controls most
 * often pressed while walking.
 */
function meetsTheFloor(element: HTMLElement): boolean {
  if (element.closest('[data-hit-target]') !== null) return true;
  const declared = element.style.minHeight || element.style.height;
  return declared !== '' && Number.parseFloat(declared) >= HIT_TARGET_PX;
}

describe('the 44px floor, in the views', WHOLE_SYSTEM, () => {
  it.each(VIEWS)('holds on $name', async (one) => {
    await mountView(one, { width: PHONE });
    const excusedComponents = new Set(KNOWN_SMALL_TARGETS.map((entry) => entry.component));
    const excusedInViews = new Set(KNOWN_SMALL_TARGETS_IN_VIEWS.map((entry) => entry.component));
    const small = [...document.body.querySelectorAll<HTMLElement>('*')]
      .filter((element) => element.tabIndex >= 0)
      .filter((element) => {
        if (meetsTheFloor(element)) return false;
        const owner = element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? '?';
        if (excusedComponents.has(owner)) return false;
        const named = element.closest<HTMLElement>('[data-app]')?.dataset.app ?? '?';
        return !excusedInViews.has(named);
      })
      .map((element) => {
        const owner = element.closest<HTMLElement>('[data-ds]')?.dataset.ds ?? 'application markup';
        const name = element.getAttribute('aria-label') ?? element.textContent.slice(0, 30);
        return `${element.tagName.toLowerCase()} in ${owner} (${name.trim()})`;
      });
    expect(small).toEqual([]);
  });

  it('says why for each control it excuses', () => {
    // The same rule the design system's own list is held to: an exemption without a reason a
    // reviewer can check is a place to put things.
    for (const entry of KNOWN_SMALL_TARGETS_IN_VIEWS) expect(entry.why.length).toBeGreaterThan(60);
  });
});
