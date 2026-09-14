/**
 * The prop that is not there (`UI-34i`).
 *
 * `UI-34i`'s test, in its own words: *the component has no such prop to reach for*. Transcription
 * has no percentage -- the job reports a state and a start time -- so a bar that could be
 * indeterminate is a bar transcription would borrow within a month, and it would then be filling
 * itself at an invented rate about somebody's recording.
 *
 * A type is the real guard and a `@ts-expect-error` is how a test says so: the assertion below
 * fails to compile the day somebody adds the prop, which is exactly when it should.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from './Progress';

describe('Progress', () => {
  it('has no indeterminate mode to reach for', () => {
    render(
      // @ts-expect-error -- there is no `indeterminate` prop, and this line is the test.
      <Progress value={0.5} label="field-recording-03.m4a" indeterminate />,
    );
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('reports how far along it is, as a number somebody can hear', () => {
    render(<Progress value={0.64} label="field-recording-03.m4a" detail="64% · 284 MB" />);
    const bar = screen.getByRole('progressbar', { name: 'field-recording-03.m4a' });
    expect(bar).toHaveAttribute('aria-valuenow', '64');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps rather than trusting the number it is given', () => {
    // A byte counter that overshoots -- a retried chunk, a server counting the request body
    // differently -- would otherwise draw a bar wider than its track, which reads as a bug in the
    // upload rather than in the arithmetic.
    const { rerender } = render(<Progress value={1.4} label="Overall" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<Progress value={-2} label="Overall" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    rerender(<Progress value={Number.NaN} label="Overall" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows the detail beside the bar, in mono', () => {
    render(<Progress value={0.1} label="Overall" detail="3 of 30 uploaded, 1 failed" />);
    expect(screen.getByText('3 of 30 uploaded, 1 failed')).toBeDefined();
  });

  it('takes a glyph for a detail, for an outcome with nothing left to count', () => {
    // "Uploaded" as a word is the same information as a tick and four times the room. The
    // accessible name comes with it, because the caller is the one that knows what it means.
    render(
      <Progress
        value={1}
        label="field-recording-03.m4a"
        detail={<span role="img" aria-label="Uploaded" />}
      />,
    );
    expect(screen.getByRole('img', { name: 'Uploaded' })).toBeDefined();
  });
});
