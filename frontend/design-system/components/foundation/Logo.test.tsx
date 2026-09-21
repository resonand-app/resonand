/**
 * The lockup's two decisions (`UI-1d`, `UI-36`).
 *
 * Whether the wordmark is there: `showWordmark={false}` is what the collapsed sidebar and the
 * avatar tile use, and the wordmark appearing where it should not is the system's most visible rule
 * broken -- it is the wordmark and the single page title per screen, and there is no third case.
 *
 * And what it announces. The mark is the S, so the letters on screen are the name without it:
 * the name is given rather than read off them, and a change that drops it leaves the nav saying
 * "reonand" to anybody who cannot see it.
 *
 * The letters are asserted against the product's name rather than as a literal (`NAME` below).
 * `NAM-3` renamed every string in the repository and could not see this one, because the word is
 * split around the mark and neither half contains the old name -- so the lockup went on reading
 * "Sonarium" with a green suite behind it, and the test was asserting that it did.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo';

/** The mark is the s, so what is drawn as text is the name either side of it. */
const NAME = 'resonand';
const S = NAME.indexOf('s');
const BEFORE = NAME.slice(0, S);
const AFTER = NAME.slice(S + 1);

describe('Logo', () => {
  it('spells the product, with the mark standing in for its s', () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toBe(BEFORE + AFTER);
  });

  it('is named for the product rather than for the letters left on screen', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Resonand' })).toBeDefined();
  });

  it('drops the wordmark and keeps the mark', () => {
    const { container } = render(<Logo showWordmark={false} />);
    expect(container.textContent).toBe('');
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
      for (const half of [BEFORE, AFTER]) {
        expect(screen.getAllByText(half).at(-1)?.style.fontSize).toBe(
          `calc(var(--type-wordmark-scale) * ${String(size)}px)`,
        );
      }
    }
  });
});
