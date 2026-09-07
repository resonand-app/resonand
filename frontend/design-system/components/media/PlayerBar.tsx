import type { CSSProperties, HTMLAttributes } from 'react';

import { IconButton } from '../forms/IconButton';
import type { Peaks } from './peaks';
import { Waveform } from './Waveform';

const MONO: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--weight-medium)',
  fontSize: 'var(--type-numeric-size)',
  fontVariantNumeric: 'var(--type-numeric-variant)',
};

export interface PlayerBarProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Library name shown beneath the title. */
  library?: string;
  peaks?: Peaks | undefined;
  /** Formatted elapsed time, mono and tabular. */
  position?: string;
  duration?: string;
  /** Played fraction, 0-1. Must agree with the position label. */
  played?: number;
  playing?: boolean;
  /** Playback rate label, e.g. 1.0x, 1.25x. */
  speed?: string;
  onToggle?: () => void;
  /**
   * The two skips, which were drawn and not wired (`UI-5c`).
   *
   * They existed as controls with no callback, so the bar rendered two buttons that did nothing
   * -- which is worse than not having them. §1.8 binds the same movement to `⇧←` and `⇧→`, so
   * the amount is fifteen seconds in both places or the product has two opinions.
   */
  onBack?: () => void;
  onForward?: () => void;
  /**
   * The copy, for an application that has its own (`UI-22a`).
   *
   * English defaults, so a specimen renders labelled controls; replaceable, because a string
   * baked into the system is one the interface can never translate.
   */
  labels?: {
    play?: string;
    pause?: string;
    back?: string;
    forward?: string;
  };
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
 *
 * The play control asks for `variant="accent"` rather than passing the accent through `style`,
 * which is what it did until `UI-32a`: an inline background is a paint no hover rule can reach,
 * so the most-pressed button in the product was one that did not respond to a pointer. The two
 * skip controls still state their own colour, and can -- nothing needs to vary it.
 */
export function PlayerBar({
  title = '',
  library = '',
  peaks,
  position = '',
  duration = '',
  played = 0,
  playing = false,
  speed = '1.0×',
  onToggle,
  onBack,
  onForward,
  labels,
  style,
  ...rest
}: PlayerBarProps) {
  return (
    <div
      data-ds="player-bar"
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
          label={labels?.back ?? 'Back 15 seconds'}
          onClick={onBack}
          style={{ color: 'var(--text-2)' }}
        />
        <IconButton
          icon={playing ? 'pause' : 'play'}
          variant="accent"
          size={38}
          label={playing ? (labels?.pause ?? 'Pause') : (labels?.play ?? 'Play')}
          onClick={onToggle}
        />
        <IconButton
          icon="skip-forward"
          variant="ghost"
          size={30}
          label={labels?.forward ?? 'Forward 15 seconds'}
          onClick={onForward}
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
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {library}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ ...MONO, color: 'var(--accent)' }}>{position}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Waveform peaks={peaks} size="player" played={played} playhead />
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
