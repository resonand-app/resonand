/**
 * `UI-1b`'s criterion, asserted now that `Icon` is a module something can import (`UI-1d`).
 *
 * Two properties, and the second is the one worth a test. Every name the system documents still
 * resolves, which is what makes the move off the CDN a no-op for every screen that already says
 * `<Icon name="search" />`. And an unknown name fails loudly rather than rendering nothing: the
 * old component put an empty `<i>` on the page, which looks like a spacing bug and gets debugged
 * as one, sometimes long after the typo that caused it.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Icon } from './Icon';
import type { IconName } from './Icon';

/** Every name the README and the prompt file document. Written out, not derived from the
    registry -- a test that reads the same list as the code under it proves only that the list
    equals itself. */
const DOCUMENTED: IconName[] = [
  'align-left',
  'alert-circle',
  'check',
  'chevron-left',
  'circle-dashed',
  'clock',
  'library',
  'loader',
  'log-out',
  'moon',
  'more-vertical',
  'panel-left',
  'pause',
  'play',
  'plus',
  'search',
  'share-2',
  'skip-back',
  'skip-forward',
  'sliders-horizontal',
  'tag',
  'trash-2',
  'upload',
  'x',
];

describe('Icon', () => {
  it.each(DOCUMENTED)('draws %s', (name) => {
    const { container } = render(<Icon name={name} data-testid="icon" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('sizes the box and the glyph together', () => {
    // 21 is the nav size. The span reserves the space and the glyph fills it; if the two ever
    // disagree the icon sits off-centre in every row it appears in.
    render(<Icon name="search" size={21} data-testid="icon" />);
    const box = screen.getByTestId('icon');
    expect(box.style.width).toBe('21px');
    expect(box.style.height).toBe('21px');
    expect(box.querySelector('svg')?.getAttribute('width')).toBe('21');
  });

  it('hides the glyph from assistive technology', () => {
    // The span carries whatever the caller puts on it -- `StateBadge` passes a `title`. The SVG
    // underneath is decoration, and an icon announced twice is worse than one announced once.
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('throws in development on a name it does not know', () => {
    expect(import.meta.env.DEV).toBe(true);
    // React logs the thrown error as well; the assertion is about the throw, not the noise.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<Icon name={'definitely-not-a-glyph' as IconName} />)).toThrow(
        /no glyph named "definitely-not-a-glyph"/,
      );
    } finally {
      quiet.mockRestore();
    }
  });
});
