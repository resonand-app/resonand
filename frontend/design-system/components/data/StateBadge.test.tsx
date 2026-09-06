/**
 * Colour is never the only signal (`UI-1g`).
 *
 * The four transcription states have to be told apart by somebody who cannot see the difference
 * between the green and the red -- `UI-6b` requires it of the card grid -- and `UI-8c` requires
 * the filter toggles to use the same words as the badge, so that the filter and the badge cannot
 * say different things about one recording. Both rest on there being one list of four, each with
 * a word and a glyph.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TRANSCRIPTION_STATE_NAMES, TRANSCRIPTION_STATES } from '../../transcription-states';
import { StateBadge } from './StateBadge';

describe('StateBadge', () => {
  it('knows exactly the four states the API reports', () => {
    expect(TRANSCRIPTION_STATE_NAMES).toEqual(['none', 'running', 'done', 'failed']);
  });

  it.each(TRANSCRIPTION_STATE_NAMES)('says the word for %s as well as drawing a glyph', (state) => {
    const { container } = render(<StateBadge state={state} />);
    expect(screen.getByText(TRANSCRIPTION_STATES[state].label)).toBeDefined();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each(TRANSCRIPTION_STATE_NAMES)('keeps the word as a title in the dense row (%s)', (state) => {
    // A 36px row has no space for the word and no excuse for dropping it.
    const { container } = render(<StateBadge state={state} variant="glyph" />);
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      TRANSCRIPTION_STATES[state].label,
    );
  });
});
