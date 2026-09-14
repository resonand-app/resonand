/**
 * Saving on blur, and the state that must not read as broken (`UI-34l`).
 *
 * Two things here are easy to get wrong in ways nobody notices until somebody loses a caption they
 * typed. `Esc` blurs the field, so a naive blur handler saves the very draft the cancel just threw
 * away. And read-only because of permission has to look like a decision rather than a bug: a
 * disabled input on a library somebody shared with you reads as the product being broken, every
 * time you open the panel.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InlineField } from './InlineField';

function Harness({ onSave }: { onSave: (value: string) => void }) {
  const [value, setValue] = useState('Digitised cassette');
  return (
    <>
      <InlineField
        label="Title"
        value={value}
        onSave={(next) => {
          setValue(next);
          onSave(next);
        }}
      />
      <button type="button">Somewhere else</button>
    </>
  );
}

describe('InlineField', () => {
  it('shows the value as text until somebody wants to change it', () => {
    render(<Harness onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Digitised cassette/ })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('saves when you click away', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Digitised cassette/ }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'Rehearsal 1999');
    await userEvent.click(screen.getByRole('button', { name: 'Somewhere else' }));
    expect(onSave).toHaveBeenCalledWith('Rehearsal 1999');
  });

  it('saves on Enter as well, because a caption is one line', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Digitised cassette/ }));
    await userEvent.type(screen.getByRole('textbox'), ' i 1999{Enter}');
    expect(onSave).toHaveBeenCalledWith('Digitised cassette i 1999');
  });

  it('puts back what was there on Escape, and saves nothing', async () => {
    // The trap: `Esc` blurs, and a blur that saves would store the draft the cancel threw away.
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Digitised cassette/ }));
    await userEvent.type(screen.getByRole('textbox'), ' something else{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Digitised cassette/ })).toBeDefined();
  });

  it('says nothing when nothing changed', async () => {
    // A blur that always saves is a PATCH per glance, and a new version of a recording's title
    // every time somebody tabs through the panel.
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Digitised cassette/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Somewhere else' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('opens from the keyboard, not only from a pointer', async () => {
    render(<Harness onSave={vi.fn()} />);
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('is not a control at all when it is read-only', () => {
    render(
      <InlineField label="Title" value="Digitised cassette" onSave={vi.fn()} readOnly />,
    );
    // No box, no pencil, no disabled control: a fact on a page rather than an input somebody
    // will keep trying to click.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Digitised cassette')).toBeVisible();
  });

  it('shows a placeholder where there is nothing yet', () => {
    render(<InlineField label="Notes" value="" placeholder="No notes" onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /No notes/ })).toBeDefined();
  });

  it('lets a newline be a newline in notes', async () => {
    const onSave = vi.fn();
    render(<InlineField label="Notes" value="" onSave={onSave} multiline />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByRole('textbox'), 'One{Enter}Two');
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith('One\nTwo');
  });
});
