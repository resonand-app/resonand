/**
 * Every component renders (`UI-1k`).
 *
 * `UI-1`'s criterion is visual and the specimen page is how you look at it, but "every component
 * renders in both themes" is also a thing a machine can check, and the page is the one place that
 * imports all twenty-one at once. A component that throws on mount -- a missing glyph name, a prop
 * that is now required, an import that did not survive a rename -- fails here rather than in the
 * first view that happens to use it.
 *
 * Both themes, because a token that exists in one palette and not the other is exactly the kind of
 * thing that renders fine until somebody switches.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WHOLE_SYSTEM } from '@/test/support/timeouts';

import { ThemeProvider } from '@/design-system';

import Specimens from '@/dev/Specimens';

const FAMILIES = ['Foundation', 'Forms', 'Media', 'Data', 'Navigation', 'TopNav', 'Guidelines'];

function renderIn(theme: 'light' | 'dark') {
  window.localStorage.setItem('sonarium-theme', theme);
  return render(
    <ThemeProvider>
      <Specimens />
    </ThemeProvider>,
  );
}

describe('the specimen page', WHOLE_SYSTEM, () => {
  it.each(['light', 'dark'] as const)('renders every family in %s', (theme) => {
    const { container } = renderIn(theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    for (const family of FAMILIES) {
      expect(screen.getByRole('heading', { name: family, level: 2 })).toBeDefined();
    }
    // The whole system drawn at once: a waveform per size, the glyph set, the cards, the rows.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(30);
  });

  it('draws the registered glyphs, including the ones reached by a computed name', () => {
    renderIn('dark');
    // `StateBadge` picks its glyph from a state string rather than a literal, which is the path
    // that used to render an empty box when a name was wrong. Both kinds are on the page.
    expect(screen.getByTitle('search')).toBeDefined();
    expect(screen.getByTitle('alert-circle')).toBeDefined();
    expect(screen.getAllByTitle('No transcript').length).toBeGreaterThan(0);
  });

  it('frames the seventeen guideline cards rather than porting them', () => {
    renderIn('dark');
    const frames = screen.getAllByTitle(/^(colors|type|spacing|shape|motion|brand)-/);
    expect(frames).toHaveLength(17);
  });

  it('offers all three theme choices', () => {
    renderIn('dark');
    for (const choice of ['light', 'dark', 'system']) {
      expect(screen.getByRole('button', { name: choice })).toBeDefined();
    }
  });
});
