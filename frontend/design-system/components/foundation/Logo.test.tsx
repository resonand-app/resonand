/**
 * The lockup's two decisions (`UI-1d`, `UI-36`, `NAM-5`).
 *
 * Whether the wordmark is there: `showWordmark={false}` is what the collapsed sidebar and the
 * avatar tile use, and a wordmark appearing where it should not is the system's most visible rule
 * broken -- it belongs in the top nav and on the sign-in screen, and there is no third case.
 *
 * And what it announces. Both halves are artwork now, so there are no letters on screen to read
 * off: the accessible name is the only thing that says what this is, which makes it the thing to
 * assert. `NAM-3` renamed every string in the repository and could not see the old name because
 * the word was split around the mark and neither half contained it; the name is checked against
 * `NAME` below for the same reason, so a rename that misses here fails rather than ships.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo';

const NAME = 'Resonand';

describe('Logo', () => {
  it('is named for the product, which is the only thing that says so', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: NAME })).toBeDefined();
  });

  it('draws the mark and the word as two paths, so the theme reaches both', () => {
    // One path could not take a different fill for each half, and the light theme would then
    // need a second asset rather than a token.
    const { container } = render(<Logo />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('var(--accent)');
    expect(paths[1]?.getAttribute('fill')).toBe('var(--text)');
  });

  it('colours the mark through the prop, for an amber fill', () => {
    const { container } = render(<Logo color="var(--accent-on)" />);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('var(--accent-on)');
  });

  it('drops the wordmark and keeps the mark', () => {
    const { container } = render(<Logo showWordmark={false} />);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('hides the drawing from assistive technology', () => {
    // It sits inside a lockup that carries the name, or inside a control that already has a
    // label. An announced decoration is one more thing between somebody and the page.
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sizes the lockup from the mark, which is what `size` has always meant', () => {
    // The mark spans the lockup's full height, so the number every call site passes keeps
    // meaning the same thing now that the letters are artwork rather than type.
    for (const size of [18, 34]) {
      const { container } = render(<Logo size={size} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('height')).toBe(String(size));
      expect(Number(svg?.getAttribute('width')) / size).toBeCloseTo(1654.78 / 439.3, 4);
    }
  });
});
