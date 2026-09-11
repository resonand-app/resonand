/**
 * The signature element, and the three promises it makes (`UI-2a`–`UI-2d`).
 *
 * jsdom resolves no custom properties and reports every element as zero-width, so the drawing
 * here runs on the fallback geometry -- which is the token values, written down. That is enough
 * for every property below, all of which are about proportion and behaviour rather than about
 * how many bars fit in a real 88px column.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { generatePeaks } from './generate-peaks';
import { WAVE_SIZES } from './wave-sizes';
import { Waveform } from './Waveform';

const PEAKS = generatePeaks(7, 1200);

/** The loudest value in each of `points` equal windows -- the drawing's own reduction, again. */
function reduceTo(values: number[], points: number): number[] {
  return Array.from({ length: points }, (_, i) => {
    const start = Math.floor((i * values.length) / points);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / points));
    return Math.max(...values.slice(start, end));
  });
}

/** Every bar's height as a fraction of the drawing's own height: the silhouette, scale removed. */
function silhouette(container: HTMLElement): number[] {
  const svg = container.querySelector('svg');
  const height = Number(svg?.getAttribute('height'));
  return [...container.querySelectorAll('rect')].map(
    (bar) => Number(bar.getAttribute('height')) / height,
  );
}

describe('Waveform', () => {
  it('draws the same shape at every one of the five sizes', () => {
    // `UI-2a`'s criterion: the same recording is recognisably the same recording at 20px and at
    // 130px. Three things legitimately differ between the sizes and none of them is the shape --
    // the absolute heights, because the drawings are different heights; the bar count, because
    // the dense row uses 2px bars and the rest 3px at the same pitch; and the quietest buckets,
    // which sit on a floor of one bar width. So the comparison is the envelope: each silhouette
    // reduced to the same twenty points, the way the drawing itself reduces the peaks.
    const envelopes = WAVE_SIZES.map((size) => {
      const { container, unmount } = render(<Waveform peaks={PEAKS} size={size} />);
      const envelope = reduceTo(silhouette(container), 20);
      unmount();
      return envelope;
    });

    const reference = envelopes[0] ?? [];
    expect(reference).toHaveLength(20);
    for (const envelope of envelopes.slice(1)) {
      envelope.forEach((value, i) => {
        expect(value).toBeCloseTo(reference[i] ?? 0, 1);
      });
    }
  });

  it('takes its height from the size rather than from a number', () => {
    for (const [size, height] of [
      ['dense', 20],
      ['card', 38],
      ['record', 52],
      ['player', 34],
      ['detail', 130],
    ] as const) {
      const { container, unmount } = render(<Waveform peaks={PEAKS} size={size} />);
      expect(container.querySelector('svg')?.getAttribute('height')).toBe(String(height));
      unmount();
    }
  });

  it('keeps silence visible as a row of dots', () => {
    // `UI-2c`: the floor is the bar width, so a silent passage does not disappear into the
    // midline. Every bar square, none of them zero.
    const { container } = render(<Waveform peaks={new Array<number>(600).fill(0)} size="record" />);
    const bars = [...container.querySelectorAll('rect')];
    expect(bars.length).toBeGreaterThan(5);
    for (const bar of bars) {
      expect(Number(bar.getAttribute('height'))).toBe(Number(bar.getAttribute('width')));
    }
  });

  it('draws played bars only once something has been played', () => {
    const { container: resting } = render(<Waveform peaks={PEAKS} size="record" />);
    expect(resting.querySelector('clipPath')).toBeNull();

    const { container: playing } = render(<Waveform peaks={PEAKS} size="record" played={0.4} />);
    expect(playing.querySelector('clipPath')).not.toBeNull();
  });

  it('gives the playhead its width from the token', () => {
    const { container } = render(
      <Waveform peaks={PEAKS} size="detail" played={0.5} playhead />,
    );
    const head = [...container.querySelectorAll('rect')].at(-1);
    expect(head?.getAttribute('width')).toBe('2');
    // Rounded, and centred on the position rather than starting at it.
    expect(head?.getAttribute('rx')).toBe('1');
  });

  describe('pending', () => {
    it('draws a rule and the duration, and no bars at all', () => {
      render(<Waveform peaks={PEAKS} size="card" pending duration="48:12" />);
      expect(screen.getByText('48:12')).toBeDefined();
      expect(document.querySelectorAll('rect')).toHaveLength(0);
      expect(document.querySelector('line')).not.toBeNull();
    });

    it('says so plainly when there is not even a duration', () => {
      render(<Waveform size="card" pending />);
      expect(screen.getByText('No waveform yet')).toBeDefined();
    });

    it('ignores peaks, played and playhead', () => {
      // `UI-2d`: a recording whose peaks job has not run cannot be made to draw a waveform by
      // passing one. This is the assertion, not the comment above it.
      const { container } = render(
        <Waveform peaks={PEAKS} size="detail" played={0.9} playhead pending duration="48:12" />,
      );
      expect(container.querySelectorAll('rect')).toHaveLength(0);
      expect(container.querySelector('clipPath')).toBeNull();
    });
  });

  describe('no peaks at all', () => {
    it('draws the rule rather than one bar stretched the width of the surface', () => {
      // A reduction of nothing is one bucket, and one bucket in a 460px bar is a flat line with a
      // playhead on it -- which reads as a broken waveform rather than as an absent one.
      const { container } = render(<Waveform peaks={[]} size="player" played={0.4} playhead />);
      expect(container.querySelectorAll('rect')).toHaveLength(0);
      expect(container.querySelector('line')).not.toBeNull();
    });

    it('is the same drawing whether the peaks are absent or empty', () => {
      const absent = render(<Waveform size="player" />).container.innerHTML;
      const { container } = render(<Waveform peaks={[]} size="player" />);
      expect(container.innerHTML).toBe(absent);
    });
  });

  describe('seeking', () => {
    it('is not a control unless it can seek', () => {
      const { container } = render(<Waveform peaks={PEAKS} size="record" />);
      expect(container.querySelector('[role="slider"]')).toBeNull();
    });

    it('reports where along it was clicked', async () => {
      const onSeek = vi.fn();
      render(<Waveform peaks={PEAKS} size="detail" onSeek={onSeek} label="Seek" />);
      const slider = screen.getByRole('slider');
      // jsdom lays nothing out, so the box is supplied.
      slider.getBoundingClientRect = () =>
        ({ left: 0, width: 200, top: 0, height: 130, right: 200, bottom: 130, x: 0, y: 0 }) as DOMRect;
      await userEvent.pointer({ target: slider, coords: { clientX: 50 }, keys: '[MouseLeft]' });
      expect(onSeek).toHaveBeenCalledWith(0.25);
    });

    it('can be seeked from the keyboard', async () => {
      // A click-to-seek surface that only takes a mouse is a seek half the people cannot perform.
      const onSeek = vi.fn();
      render(<Waveform peaks={PEAKS} size="detail" played={0.5} onSeek={onSeek} label="Seek" />);
      const slider = screen.getByRole('slider');
      slider.focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(onSeek).toHaveBeenLastCalledWith(0.51);
      await userEvent.keyboard('{ArrowLeft}');
      expect(onSeek).toHaveBeenLastCalledWith(0.49);
      await userEvent.keyboard('{Home}');
      expect(onSeek).toHaveBeenLastCalledWith(0);
      await userEvent.keyboard('{End}');
      expect(onSeek).toHaveBeenLastCalledWith(1);
    });

    it('says where it is', () => {
      render(<Waveform peaks={PEAKS} size="detail" played={0.375} onSeek={vi.fn()} label="Seek" />);
      const slider = screen.getByRole('slider');
      expect(slider.getAttribute('aria-valuenow')).toBe('38');
      expect(slider.getAttribute('aria-label')).toBe('Seek');
    });

    it('never seeks outside the recording', async () => {
      const onSeek = vi.fn();
      render(<Waveform peaks={PEAKS} size="detail" played={0} onSeek={onSeek} label="Seek" />);
      screen.getByRole('slider').focus();
      await userEvent.keyboard('{ArrowLeft}');
      expect(onSeek).toHaveBeenLastCalledWith(0);
    });
  });
});
