import type { CSSProperties, HTMLAttributes } from 'react';

import { IconButton } from '../forms/IconButton';
import { Waveform } from './Waveform';

const MONO: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: '11.5px',
  fontVariantNumeric: 'tabular-nums',
};

export interface PlayerBarProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Library name shown beneath the title. */
  library?: string;
  peaks?: number[];
  seed?: number;
  /** Formatted elapsed time, mono and tabular. */
  position?: string;
  duration?: string;
  /** Played fraction, 0-1. Must agree with the position label. */
  played?: number;
  playing?: boolean;
  /** Playback rate label, e.g. 1.0x, 1.25x. */
  speed?: string;
  onToggle?: () => void;
}

/**
 * The persistent player: one playback state, pinned to the bottom of the shell, surviving every
 * navigation.
 *
 * **The sample-data defaults are gone (`UI-1f`).** It used to arrive already playing a recording
 * called "The house on Carrer Nou" from a library called "Àvia Teresa", 37.5% through. A forgotten
 * prop then looked like a working player showing somebody else's audio, which is the one kind of
 * bug a screenshot cannot catch. Empty is now visibly empty. The defaults that survive are the
 * ones that are decisions rather than content: the speed pill reads 1.0x because that is where
 * playback starts.
 */
export function PlayerBar({
  title = '',
  library = '',
  peaks,
  seed = 11,
  position = '',
  duration = '',
  played = 0,
  playing = false,
  speed = '1.0×',
  onToggle,
  style,
  ...rest
}: PlayerBarProps) {
  return (
    <div
      style={{
        height: 'var(--player-height)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 16px',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)' }}>
        <IconButton
          icon="skip-back"
          variant="ghost"
          size={30}
          label="Back 15 seconds"
          style={{ color: 'var(--text-2)' }}
        />
        <IconButton
          icon={playing ? 'pause' : 'play'}
          size={38}
          label={playing ? 'Pause' : 'Play'}
          onClick={onToggle}
          style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
        />
        <IconButton
          icon="skip-forward"
          variant="ghost"
          size={30}
          label="Forward 15 seconds"
          style={{ color: 'var(--text-2)' }}
        />
      </div>
      <div
        style={{
          width: 250,
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <span
          style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', color: 'var(--text-3)' }}
        >
          {library}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ ...MONO, color: 'var(--accent)' }}>{position}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Waveform peaks={peaks} seed={seed} height={34} played={played} playhead />
        </div>
        <span style={{ ...MONO, color: 'var(--text-3)' }}>{duration}</span>
      </div>
      <span
        style={{
          ...MONO,
          color: 'var(--text-2)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-pill)',
          padding: '6px 12px',
        }}
      >
        {speed}
      </span>
    </div>
  );
}
