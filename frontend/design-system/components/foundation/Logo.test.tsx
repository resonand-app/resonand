/**
 * The lockup's two decisions (`UI-1d`, `UI-36`).
 *
 * Whether the wordmark is there: `showWordmark={false}` is what the collapsed sidebar and the
 * avatar tile use, and Chillax appearing where it should not is the system's most visible rule
 * broken -- it is the wordmark and the single page title per screen, and there is no third case.
 *
 * And what it announces. The mark is the S, so the word on screen is six letters: the name is
 * given rather than read off the text, and a change that drops it leaves the nav saying
 * "onarium" to anybody who cannot see it.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo';

describe('Logo', () => {
  it('sets the wordmark beside the mark by default', () => {
    render(<Logo />);
    expect(screen.getByText('onarium')).toBeDefined();
  });

  it('is named for the product rather than for the letters left on screen', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Resonand' })).toBeDefined();
  });

  it('drops the wordmark and keeps the mark', () => {
    const { container } = render(<Logo showWordmark={false} />);
    expect(screen.queryByText('onarium')).toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('hides the mark from assistive technology', () => {
    // It sits inside a lockup that carries the name, or inside a control that already has a
    // label. An announced decoration is one more thing between somebody and the page.
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('scales the wordmark with the mark rather than beside it', () => {
    // The brand kit draws the lockup as one object. A caller that could size the halves apart
    // could draw a lockup the kit does not contain, so `size` has to reach both.
    for (const size of [18, 34]) {
      const { container } = render(<Logo size={size} />);
      expect(container.querySelector('svg')?.getAttribute('height')).toBe(String(size));
      expect(screen.getAllByText('onarium').at(-1)?.style.fontSize).toBe(
        `calc(var(--type-wordmark-scale) * ${String(size)}px)`,
      );
    }
  });
});
