/**
 * The lockup's one real decision is whether the wordmark is there (`UI-1d`).
 *
 * `showWordmark={false}` is what the collapsed sidebar and the avatar tile use, and Chillax
 * appearing where it should not is the system's most visible rule broken -- it is the wordmark
 * and the single page title per screen, and there is no third case.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo';

describe('Logo', () => {
  it('sets the wordmark beside the mark by default', () => {
    render(<Logo />);
    expect(screen.getByText('Sonarium')).toBeDefined();
  });

  it('drops the wordmark and keeps the mark', () => {
    const { container } = render(<Logo showWordmark={false} />);
    expect(screen.queryByText('Sonarium')).toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(4);
  });

  it('hides the mark from assistive technology', () => {
    // It sits beside the word "Sonarium", or inside a control that already has a label. An
    // announced decoration is one more thing between somebody and the page.
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
