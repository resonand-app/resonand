/**
 * The action cannot fire before the match (`UI-34m`'s criterion), and the match itself.
 *
 * The comparison is the interesting half. The prototype used a bare `===`, which takes none of the
 * four decisions this needs to take -- and the names in this archive are Catalan, so every one of
 * them shows up in practice: `À` has two Unicode spellings, phone keyboards add trailing spaces,
 * shift is a typing convention, and an accent is part of the word.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { matchesName } from './name-match';
import { TypedConfirm } from './TypedConfirm';

function open(onConfirm = vi.fn(), onCancel = vi.fn()) {
  render(
    <TypedConfirm
      open
      name="Àvia Teresa"
      consequence="84 recordings, 12 h 40 min of audio and their transcripts"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

const confirmButton = () => screen.getByRole('button', { name: 'Delete permanently' });

describe('matchesName', () => {
  it('accepts the name as typed', () => {
    expect(matchesName('Àvia Teresa', 'Àvia Teresa')).toBe(true);
  });

  it('accepts a different case, because shift is not part of the name', () => {
    expect(matchesName('àvia teresa', 'Àvia Teresa')).toBe(true);
  });

  it('accepts either Unicode spelling of the same letter', () => {
    // `À` as one code point, and as `A` plus a combining grave. They are the same word on screen
    // and a macOS keyboard and a Linux one do not always produce the same one -- two strings that
    // look identical and compare unequal is the worst failure a typed confirmation can have.
    expect(matchesName('Àvia Teresa', 'Àvia Teresa')).toBe(true);
  });

  it('accepts a stray space from a phone keyboard', () => {
    expect(matchesName('  Àvia Teresa ', 'Àvia Teresa')).toBe(true);
  });

  it('refuses a missing accent, because an accent is part of the word', () => {
    // The one place in the product where being strict costs a retype and being lax costs a
    // library.
    expect(matchesName('Avia Teresa', 'Àvia Teresa')).toBe(false);
  });

  it('refuses a different name, and refuses nothing at all', () => {
    expect(matchesName('Àvia', 'Àvia Teresa')).toBe(false);
    expect(matchesName('', 'Àvia Teresa')).toBe(false);
    // An empty name must never be matchable by an empty box.
    expect(matchesName('', '')).toBe(false);
  });
});

describe('TypedConfirm', () => {
  it('cannot fire before the name matches', async () => {
    const { onConfirm } = open();
    expect(confirmButton()).toBeDisabled();
    await userEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
    // And a keyboard cannot reach it either, which is what `disabled` buys over an opacity.
    confirmButton().focus();
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires once the name is typed', async () => {
    const { onConfirm } = open();
    await userEvent.type(screen.getByRole('textbox'), 'Àvia Teresa');
    expect(confirmButton()).toBeEnabled();
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('goes back to inert if the name stops matching', async () => {
    open();
    await userEvent.type(screen.getByRole('textbox'), 'Àvia Teresa');
    expect(confirmButton()).toBeEnabled();
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(confirmButton()).toBeDisabled();
  });

  it('says what will be lost, in numbers, before it asks for anything', () => {
    open();
    expect(
      screen.getByText(
        /This destroys 84 recordings, 12 h 40 min of audio and their transcripts\. It cannot be undone\./,
      ),
    ).toBeDefined();
  });

  it('is a modal dialog that Escape leaves', async () => {
    const { onCancel } = open();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is not there when it is closed', () => {
    render(
      <TypedConfirm
        open={false}
        name="Àvia Teresa"
        consequence="84 recordings"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
