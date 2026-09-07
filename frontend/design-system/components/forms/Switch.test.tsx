/**
 * A switch is a thing that is on, and it says so both ways (`UI-34e`).
 *
 * The state has to be readable without seeing the knob, because the four transcription states are
 * not the only place in this product where colour is not allowed to be the only signal -- and a
 * toggle whose whole appearance is "which end is the dot at" is the clearest case of it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch';

function Harness({ onChange }: { onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onChange?.(next);
      }}
      label="Transcribe when the upload finishes"
      description="Transcription is sent to api.openai.com."
    />
  );
}

describe('Switch', () => {
  it('is a switch and not a checkbox', () => {
    // They are announced differently and they mean different things: a checkbox is part of a set
    // you will submit, a switch is a thing that is on.
    render(<Harness />);
    expect(screen.getByRole('switch')).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('reports its state without anybody having to look at it', async () => {
    render(<Harness />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('takes effect on a click and on a key', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('carries the consequence beside it, not behind a confirm', () => {
    // There is no confirm step after a switch, so the thing it will do has to be readable before
    // it is flipped. This is where §3.4's disclosure goes.
    render(<Harness />);
    expect(screen.getByText('Transcription is sent to api.openai.com.')).toBeDefined();
  });

  it('does nothing while it is unavailable', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Watch a folder" disabled />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is one control, so the label is part of the target', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByText('Transcribe when the upload finishes'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
