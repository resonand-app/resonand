/**
 * The tray chrome, and the control that is missing while an upload is running (`UI-35i`).
 *
 * The tray is the only place an upload's progress exists, so a close button beside a running one
 * is a button somebody presses -- and then thirty files are going somewhere nobody can see. It is
 * absent until everything has finished or failed, which is `UI-34c`'s rule in a second place.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Progress } from '@/design-system';

import { UploadTray } from './UploadTray';

describe('UploadTray', () => {
  it('says the same thing collapsed as expanded', () => {
    // Collapsing loses the list and never the answer.
    const { rerender } = render(
      <UploadTray summary="3 of 30 uploaded, 1 failed" collapsed onToggle={vi.fn()} />,
    );
    expect(screen.getByText('3 of 30 uploaded, 1 failed')).toBeDefined();
    rerender(
      <UploadTray summary="3 of 30 uploaded, 1 failed" collapsed={false} onToggle={vi.fn()}>
        <Progress value={0.64} label="Entrevista àvia 03.m4a" />
      </UploadTray>,
    );
    expect(screen.getByText('3 of 30 uploaded, 1 failed')).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('shows the files only when it is open', () => {
    render(
      <UploadTray summary="3 of 30 uploaded" collapsed onToggle={vi.fn()}>
        <Progress value={0.64} label="Entrevista àvia 03.m4a" />
      </UploadTray>,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('opens and closes from one control', async () => {
    const onToggle = vi.fn();
    render(<UploadTray summary="3 of 30 uploaded" collapsed onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show the uploads' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('has no close control while anything is still going', () => {
    render(<UploadTray summary="3 of 30 uploaded" collapsed onToggle={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Close the tray' })).toBeNull();
  });

  it('gains one once everything has finished', async () => {
    const onClose = vi.fn();
    render(<UploadTray summary="30 uploaded" collapsed onToggle={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close the tray' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is a named region, because it outlives the view that started it', () => {
    render(<UploadTray summary="3 of 30 uploaded" collapsed onToggle={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Uploads' })).toBeDefined();
  });
});
