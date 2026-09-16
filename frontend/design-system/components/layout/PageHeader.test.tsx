/**
 * The page title, and correcting it in place (`UI-35b`, `UI-11i`).
 *
 * Two rules meet here and both are easy to break without noticing. The title is the screen's one
 * document heading, so the control that edits it has to live *inside* the `h1` rather than
 * replace it -- a page whose title is only a button has no heading for a screen reader user to
 * navigate by. And a title nobody may change must offer nothing at all: no pencil, no button, no
 * disabled control, which is the same decision `InlineField` makes for the panel.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PageHeader } from './PageHeader';

function Harness({ onTitleSave }: { onTitleSave: (value: string) => void }) {
  const [title, setTitle] = useState('Field recording, long take');
  return (
    <>
      <PageHeader
        title={title}
        meta="12:23 · Uploaded by Alex Morgan"
        editLabel="Edit the title"
        onTitleSave={(next) => {
          setTitle(next);
          onTitleSave(next);
        }}
      />
      <button type="button">Somewhere else</button>
    </>
  );
}

describe('PageHeader', () => {
  it('is a heading and nothing else when the title cannot be changed', () => {
    render(<PageHeader title="Field recordings" meta="4 recordings · 19 min" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Field recordings' })).toBeVisible();
    // No pencil and nothing to click: the same decision the panel makes for a field somebody
    // else owns, and the reason a read-only screen does not read as broken.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the heading when the title can be changed', () => {
    render(<Harness onTitleSave={vi.fn()} />);
    // The control goes inside the `h1`, so the screen still has exactly one document heading.
    expect(
      screen.getByRole('heading', { level: 1, name: /Field recording, long take/ }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /Field recording, long take/ })).toBeDefined();
  });

  it('saves when you click away', async () => {
    const onTitleSave = vi.fn();
    render(<Harness onTitleSave={onTitleSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'Rehearsal 1999');
    await userEvent.click(screen.getByRole('button', { name: 'Somewhere else' }));
    expect(onTitleSave).toHaveBeenCalledWith('Rehearsal 1999');
  });

  it('saves on Enter, because a title is one line', async () => {
    const onTitleSave = vi.fn();
    render(<Harness onTitleSave={onTitleSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    await userEvent.type(screen.getByRole('textbox'), ' II{Enter}');
    expect(onTitleSave).toHaveBeenCalledWith('Field recording, long take II');
  });

  it('puts back what was there on Escape, and saves nothing', async () => {
    // The trap: `Esc` blurs, and a blur that saves would store the draft the cancel threw away.
    const onTitleSave = vi.fn();
    render(<Harness onTitleSave={onTitleSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    await userEvent.type(screen.getByRole('textbox'), ' something else{Escape}');
    expect(onTitleSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Field recording, long take/ })).toBeDefined();
  });

  it('says nothing when nothing changed', async () => {
    // A blur that always saves is a PATCH every time somebody tabs past the title.
    const onTitleSave = vi.fn();
    render(<Harness onTitleSave={onTitleSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Somewhere else' }));
    expect(onTitleSave).not.toHaveBeenCalled();
  });

  it('moves focus into the field it just opened', async () => {
    // Finishing the click that asked for the field, which is why this is focus management and
    // not `autoFocus`.
    render(<Harness onTitleSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('names the field for a screen reader', async () => {
    render(<Harness onTitleSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Field recording, long take/ }));
    expect(screen.getByRole('textbox', { name: 'Edit the title' })).toBeDefined();
  });
});
