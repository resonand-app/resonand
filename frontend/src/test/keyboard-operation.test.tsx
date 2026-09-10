/**
 * 🧪 The player and the transcript are operable from the keyboard, end to end (`UI-23b`, §1.8).
 *
 * The pieces are each already tested, and that is exactly why this exists. `keyboard.test.tsx`
 * checks what a key *means* -- a table lookup, with no player attached. `Player.test.tsx` checks
 * the transport buttons, which are clicks. `Transcript.test.tsx` checks one `Enter` on one line.
 * Every one of them passes with the chain between them broken: the binding table can be right,
 * the store can be right, and the shell can still be handing the command to nobody.
 *
 * So this drives the real recording view, mounted in the real shell, using nothing but keys --
 * no click, no direct call into the store except where a browser would have made one. The claim
 * is the one §1.8 makes and the one somebody who cannot use a pointer depends on: **the whole
 * screen works from the keyboard**, including the two things that are otherwise mouse gestures,
 * seeking and moving between segments.
 *
 * **What is simulated, and why that is honest.** jsdom implements no `HTMLMediaElement`: nothing
 * plays, so nothing ever reports back that it started. `report()` is the callback the real
 * element calls, and calling it here stands in for the element rather than for the interface --
 * every command under test still travels the full path from `keydown` through `commandFor`,
 * `useKeyboard` and the shell's action into the store.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { SEEK_SECONDS, SKIP_SECONDS } from '@/app/keyboard';
import { usePlayback } from '@/player/store';
import { mockApi } from '@/test/api/server';
import { VIEWS, mountView } from '@/test/views';

import { WHOLE_SYSTEM } from './timeouts';

mockApi();

afterEach(() => {
  usePlayback.getState().stop();
});

/** V5, which is the only view carrying both a player and a transcript. */
const RECORDING = (() => {
  const view = VIEWS.find((one) => one.name === 'V5 - A recording');
  if (view === undefined) throw new Error('V5 is missing from VIEWS.');
  return view;
})();

/**
 * When each of the six segments starts.
 *
 * From the fixture rather than typed out: 17:31, then one every thirteen seconds. Written as the
 * arithmetic so that a changed fixture changes these with it.
 */
const SEGMENT_MS = Array.from({ length: 6 }, (_, index) => 17 * 60_000 + 31_000 + index * 13_000);

function segment(index: number): number {
  const at = SEGMENT_MS[index];
  if (at === undefined) throw new Error(`There is no segment ${String(index)}.`);
  return at;
}

/** Where the position is now. */
function positionMs(): number {
  return usePlayback.getState().positionMs;
}

/**
 * Put focus somewhere that is not a control.
 *
 * The bindings under test are the ones that fire *anywhere no field has focus*, and a test that
 * happened to leave focus on a button would be testing that button's own handling of the key.
 */
function focusThePage(): void {
  (document.activeElement as HTMLElement | null)?.blur();
}

describe('moving through a transcript', WHOLE_SYSTEM, () => {
  it('starts at the first segment, steps down, and steps back up', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();

    // Nothing is playing yet, so the first press means the first line -- and choosing a line is
    // also what loads the recording, which is why this is the whole journey in one key.
    await user.keyboard('{ArrowDown}');
    expect(usePlayback.getState().recording?.uuid).toBeDefined();
    expect(positionMs()).toBe(segment(0));

    await user.keyboard('{ArrowDown}');
    expect(positionMs()).toBe(segment(1));

    await user.keyboard('{ArrowUp}');
    expect(positionMs()).toBe(segment(0));
  });

  it('stops at each end rather than wrapping', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();

    // Nothing before the beginning: with no segment active, `↑` has nowhere to go.
    await user.keyboard('{ArrowUp}');
    expect(usePlayback.getState().recording).toBeNull();

    await user.keyboard('{ArrowDown}'.repeat(SEGMENT_MS.length + 2));
    // A transcript that jumped from its last line back to its first would be a seek nobody asked
    // for, so the extra presses are absorbed.
    expect(positionMs()).toBe(segment(SEGMENT_MS.length - 1));
  });

  it('jumps to the line a keyboard has landed on', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    const line = (await screen.findByText(/The building is still there/)).closest<HTMLElement>(
      '[data-ds="transcript-line"]',
    );
    if (line === null) throw new Error('A line that seeks is not a control.');
    line.focus();
    await user.keyboard('{Enter}');
    // The last of the six, reached without ever having stepped through the five before it.
    expect(positionMs()).toBe(segment(SEGMENT_MS.length - 1));
  });
});

describe('driving the player', WHOLE_SYSTEM, () => {
  it('seeks by five and skips by fifteen, in both directions', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();
    await user.keyboard('{ArrowDown}');
    const start = segment(0);

    await user.keyboard('{ArrowRight}');
    expect(positionMs()).toBe(start + SEEK_SECONDS * 1000);

    await user.keyboard('{ArrowLeft}');
    expect(positionMs()).toBe(start);

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(positionMs()).toBe(start + SKIP_SECONDS * 1000);

    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(positionMs()).toBe(start);
  });

  it('plays and pauses on the space bar', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();
    await user.keyboard('{ArrowDown}');
    // The element saying it is going. Until it does, the status is `buffering` and a toggle is
    // correctly a no-op: there is nothing yet to pause.
    usePlayback.getState().report({ status: 'playing' });

    await user.keyboard(' ');
    expect(usePlayback.getState().status).toBe('paused');

    await user.keyboard(' ');
    expect(usePlayback.getState().status).toBe('playing');
  });

  it('holds the position across a pause, because pausing is not stopping', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    usePlayback.getState().report({ status: 'playing' });
    const where = positionMs();
    await user.keyboard(' ');
    expect(positionMs()).toBe(where);
  });
});

describe('while somebody is typing', WHOLE_SYSTEM, () => {
  it('leaves the space bar to the field, having reached it by keyboard too', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();
    await user.keyboard('{ArrowDown}');
    usePlayback.getState().report({ status: 'playing' });
    const where = positionMs();

    // `/` focuses search, which is itself one of the bindings -- so this asserts the escape from
    // the page into a field is a keyboard journey as well.
    await user.keyboard('/');
    await user.keyboard(' casa');

    expect(usePlayback.getState().status).toBe('playing');
    expect(positionMs()).toBe(where);
  });

  it('leaves the arrows to the field, so a caret moves rather than the audio', async () => {
    const user = userEvent.setup();
    await mountView(RECORDING);
    focusThePage();
    await user.keyboard('{ArrowDown}');
    const where = positionMs();

    await user.keyboard('/');
    await user.keyboard('casa{ArrowLeft}{ArrowLeft}');

    expect(positionMs()).toBe(where);
  });
});
