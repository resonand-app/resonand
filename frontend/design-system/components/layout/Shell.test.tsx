/**
 * The tray is over the view and not part of it (`UI-35i`).
 *
 * It reports on a batch somebody carries on working through, so a band of frame it took for
 * itself would reflow the whole page -- the sidebar, the grid and the player -- the moment an
 * upload started, and again when it finished. The same rule and the same measurement as the
 * toasts: out of the flow, clearing the player when there is one.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Shell } from './Shell';

function slotOf(container: HTMLElement): HTMLElement {
  const slot = container.querySelector<HTMLElement>('[data-ds="shell-tray"]');
  if (slot === null) throw new Error('no tray slot');
  return slot;
}

describe('Shell', () => {
  it('floats the tray over the view rather than giving it a band of the frame', () => {
    const { container } = render(
      <Shell nav={<nav />} sidebar={<aside />} tray={<p>uploading</p>}>
        <p>a view</p>
      </Shell>,
    );
    expect(slotOf(container).style.position).toBe('fixed');
    expect(screen.getByText('a view')).toBeDefined();
  });

  it('clears the bar when one is drawn, and drops to the gutter when none is', () => {
    // The presence of `player` cannot answer this: the frame is handed one on every screen and the
    // bar decides for itself whether it has a recording to show. Asking the prop left the tray
    // floating a bar's height above nothing.
    const { container, rerender } = render(
      <Shell nav={<nav />} sidebar={<aside />} tray={<p>uploading</p>} player={<div />} playerVisible>
        <p>a view</p>
      </Shell>,
    );
    expect(slotOf(container).style.bottom).toContain('--player-height');
    rerender(
      <Shell nav={<nav />} sidebar={<aside />} tray={<p>uploading</p>} player={<div />}>
        <p>a view</p>
      </Shell>,
    );
    expect(slotOf(container).style.bottom).not.toContain('--player-height');
  });

  it('has no tray slot at all when nothing is uploading', () => {
    const { container } = render(
      <Shell nav={<nav />} sidebar={<aside />}>
        <p>a view</p>
      </Shell>,
    );
    expect(container.querySelector('[data-ds="shell-tray"]')).toBeNull();
  });
});
