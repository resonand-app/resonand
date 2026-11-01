/**
 * One region, announced politely, above the player (`UI-35f`).
 *
 * Three decisions worth holding in place. Two stacks in two corners is a product where "did that
 * work?" depends on which corner you looked at. `assertive` interrupts somebody mid-sentence to
 * say an upload finished. And a stack whose toasts share one timer is one where the third is gone
 * before it was read.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast';
import { ToastRegion } from './ToastRegion';
import type { ToastEntry } from './ToastRegion';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const entry = (id: string, timeout?: number | null): ToastEntry => ({
  id,
  content: <Toast>{`Moved ${id}`}</Toast>,
  ...(timeout === undefined ? {} : { timeout }),
});

describe('ToastRegion', () => {
  it('is a polite live region that exists before it has anything to say', () => {
    const { container } = render(<ToastRegion toasts={[]} onDismiss={vi.fn()} />);
    const region = container.querySelector('[data-ds="toast-region"]');
    // Added to the page at the same moment as its content, a live region announces nothing.
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('stacks what it is given', () => {
    render(<ToastRegion toasts={[entry('a'), entry('b')]} onDismiss={vi.fn()} />);
    expect(screen.getByText('Moved a')).toBeDefined();
    expect(screen.getByText('Moved b')).toBeDefined();
  });

  it('gives each toast its own timer', () => {
    const onDismiss = vi.fn();
    render(
      <ToastRegion toasts={[entry('a', 1000), entry('b', 5000)]} onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledWith('a');
    expect(onDismiss).not.toHaveBeenCalledWith('b');
  });

  it('keeps a toast that carries an action until it is dismissed', () => {
    // An action nobody had time to read is an action nobody was offered.
    const onDismiss = vi.fn();
    render(<ToastRegion toasts={[entry('failed', null)]} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('holds the timer while the pointer is on the toast, and resumes where it stopped', () => {
    // Reaching for Undo must never race the clock that takes it away (`UI-46`).
    const onDismiss = vi.fn();
    render(<ToastRegion toasts={[entry('a', 1000)]} onDismiss={onDismiss} />);
    const slot = screen.getByText('Moved a').closest<HTMLElement>('[data-ds="toast-slot"]');
    if (slot === null) throw new Error('no slot');
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerEnter(slot);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerLeave(slot);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('holds the timer while the focus is inside the toast', () => {
    const onDismiss = vi.fn();
    render(
      <ToastRegion
        toasts={[
          {
            id: 'a',
            timeout: 1000,
            content: <Toast actions={<button type="button">Undo</button>}>Moved a</Toast>,
          },
        ]}
        onDismiss={onDismiss}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: 'Undo' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      screen.getByRole('button', { name: 'Undo' }).blur();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('sits above the player rather than over it', () => {
    // The play button is the one control that has to stay reachable while anything else happens.
    const { container, rerender } = render(
      <ToastRegion toasts={[entry('a')]} onDismiss={vi.fn()} playerVisible />,
    );
    const region = container.querySelector<HTMLElement>('[data-ds="toast-region"]');
    expect(region?.style.bottom).toContain('--player-height');
    rerender(<ToastRegion toasts={[entry('a')]} onDismiss={vi.fn()} />);
    expect(
      container.querySelector<HTMLElement>('[data-ds="toast-region"]')?.style.bottom,
    ).not.toContain('--player-height');
  });

  it('lets a pointer through where there is no toast', () => {
    // An empty live region spanning the width must not be a sheet of glass over the view.
    const { container } = render(<ToastRegion toasts={[]} onDismiss={vi.fn()} />);
    expect(container.querySelector('[data-ds="toast-region"]')).toHaveStyle({
      pointerEvents: 'none',
    });
  });
});
