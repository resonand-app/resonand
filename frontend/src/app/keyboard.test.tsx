/**
 * Every binding in §1.8, and none of them firing inside a field (`UI-4g`).
 *
 * The second half is the one that matters. A shortcut that works is noticed once; a shortcut that
 * fires while somebody is typing a library's name is noticed every time, and the space bar is the
 * one that does it.
 */

import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BINDINGS, SEEK_SECONDS, SKIP_SECONDS, commandFor, isTyping } from './keyboard';
import type { Actions } from './use-keyboard';
import { useKeyboard } from './use-keyboard';

/** A key press, as the document sees one. */
function press(
  key: string,
  options: { shift?: boolean; meta?: boolean; target?: EventTarget | null } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shift ?? false,
    metaKey: options.meta ?? false,
    bubbles: true,
  });
  if (options.target) Object.defineProperty(event, 'target', { value: options.target });
  return event;
}

describe('what a key means', () => {
  it.each([
    ['⌘K focuses search', 'k', { meta: true }, 'focus-search'],
    ['/ focuses search', '/', {}, 'focus-search'],
    ['space plays and pauses', ' ', {}, 'play-pause'],
    ['left seeks back', 'ArrowLeft', {}, 'seek-back'],
    ['right seeks forward', 'ArrowRight', {}, 'seek-forward'],
    ['shift-left skips back', 'ArrowLeft', { shift: true }, 'skip-back'],
    ['shift-right skips forward', 'ArrowRight', { shift: true }, 'skip-forward'],
    ['up is the previous segment', 'ArrowUp', {}, 'previous-segment'],
    ['down is the next segment', 'ArrowDown', {}, 'next-segment'],
    ['enter opens', 'Enter', {}, 'open'],
    ['escape dismisses', 'Escape', {}, 'dismiss'],
  ])('%s', (_name, key, options, command) => {
    expect(commandFor(press(key, options))).toBe(command);
  });

  it('seeks by five and skips by fifteen, which is what the buttons do', () => {
    expect(SEEK_SECONDS).toBe(5);
    expect(SKIP_SECONDS).toBe(15);
  });

  it('has one chord and only one', () => {
    // A product whose shortcuts need a modifier is a product whose shortcuts nobody learns.
    expect(BINDINGS.filter((one) => one.withModifier)).toHaveLength(1);
  });

  it('means nothing by a key nobody bound', () => {
    expect(commandFor(press('q'))).toBeNull();
    expect(commandFor(press('k'))).toBeNull();
  });
});

describe('while somebody is typing', () => {
  it.each(['input', 'textarea', 'select'])('%s swallows every binding but escape', (tag) => {
    const field = document.createElement(tag);
    expect(commandFor(press(' ', { target: field }))).toBeNull();
    expect(commandFor(press('/', { target: field }))).toBeNull();
    expect(commandFor(press('ArrowLeft', { target: field }))).toBeNull();
    // Escape is how you leave a field, so it is the one that has to work inside one.
    expect(commandFor(press('Escape', { target: field }))).toBe('dismiss');
  });

  it('counts anything contenteditable as typing', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not implement `isContentEditable` from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTyping(editable)).toBe(true);
  });

  it('is not typing when focus is on the page', () => {
    expect(isTyping(document.createElement('div'))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

/** A component with the handler installed, so a press can be delivered the way a browser does. */
function Listening({ actions }: { actions: Actions }) {
  useKeyboard(actions);
  return (
    <div>
      <input aria-label="a field" />
      <button type="button">a button</button>
    </div>
  );
}

describe('the one handler', () => {
  it('answers a press from anywhere on the page', async () => {
    const play = vi.fn();
    render(<Listening actions={{ 'play-pause': play }} />);
    await userEvent.keyboard(' ');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('stays out of a field', async () => {
    const play = vi.fn();
    render(<Listening actions={{ 'play-pause': play }} />);
    await userEvent.click(screen.getByLabelText('a field'));
    await userEvent.keyboard(' ');
    expect(play).not.toHaveBeenCalled();
  });

  it('leaves a focused button its own space bar', async () => {
    // Otherwise one press both presses the button and toggles playback.
    const play = vi.fn();
    render(<Listening actions={{ 'play-pause': play }} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(play).not.toHaveBeenCalled();
  });

  it('lets a key through when nothing is listening for it', () => {
    // With no transcript on screen, the arrows are the browser's and scroll the page.
    renderHook(() => {
      useKeyboard({});
    });
    const event = press('ArrowDown');
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps answering after the actions are rebuilt', async () => {
    // Actions are a new object every render. A handler re-subscribed on each of them would drop
    // a press that landed in the gap.
    const first = vi.fn();
    const { rerender } = render(<Listening actions={{ 'play-pause': first }} />);
    const second = vi.fn();
    rerender(<Listening actions={{ 'play-pause': second }} />);
    await userEvent.keyboard(' ');
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
