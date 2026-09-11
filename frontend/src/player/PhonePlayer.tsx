/**
 * The player on a phone (`UI-5f`, §2.3).
 *
 * A compact strip docked directly above the tabs: play/pause, the title, and a **hairline
 * progress line rather than a waveform** -- a 3px-bar waveform is not usable at that size with a
 * thumb, and drawing one anyway would be decoration standing where a control should be.
 *
 * **Tapping it expands to a full-screen player** with the waveform, the transport, the ±15 s
 * skips and speed. Swiping down collapses it, and so does the close control, because a gesture
 * with no visible equivalent is a gesture somebody has to be told about.
 *
 * It is the same store as the desktop bar (`UI-5a`). Nothing here has its own position.
 */

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, IconButton, Waveform } from '@/design-system';
import { duration as asDuration, speed as asSpeed } from '@/i18n/format';

import { RATES, advanceRate, playedFraction, usePlayback } from './store';
import { usePlayingPeaks } from './use-playing-peaks';

/** How far down a drag has to go before it counts as a dismissal rather than a tap. */
const SWIPE_PX = 60;

export function PhonePlayer() {
  const { t } = useTranslation('player');
  const state = usePlayback();
  const [expanded, setExpanded] = useState(false);
  const [from, setFrom] = useState<number | null>(null);
  const { recording, status } = state;
  // Asked for before the strip is opened, so expanding it draws the shape rather than the
  // sentence that stands in for one.
  const peaks = usePlayingPeaks(true);

  if (recording === null || status === 'idle') return null;

  const playing = status === 'playing';
  const position = asDuration(state.positionMs);
  const total = asDuration(state.durationMs || recording.durationMs);
  const played = playedFraction(state);

  const toggle = () => {
    if (status === 'failed') usePlayback.getState().play(recording);
    else usePlayback.getState().toggle();
  };

  if (!expanded) {
    return (
      <div
        data-app="phone-player"
        style={{
          flex: '0 0 auto',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '0 var(--space-3)',
          minHeight: 56,
          position: 'relative',
        }}
      >
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? t('action.pause') : t('action.play')}
          onClick={toggle}
        />
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minHeight: 44,
            cursor: 'pointer',
          }}
        >
          {recording.title}
        </button>
        <Icon name="chevron-down" size={17} style={{ transform: 'rotate(180deg)' }} />
        {/* The hairline. Not a waveform, and not a control: it says how far through, and the
            expanded player is where seeking happens. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            height: 2,
            background: 'var(--surface-3)',
          }}
        >
          <div
            style={{
              width: `${String(played * 100)}%`,
              height: '100%',
              background: 'var(--accent)',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-app="phone-player-full"
      onPointerDown={(event: ReactPointerEvent) => {
        setFrom(event.clientY);
      }}
      onPointerUp={(event: ReactPointerEvent) => {
        if (from !== null && event.clientY - from > SWIPE_PX) setExpanded(false);
        setFrom(null);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--panel-gap)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <IconButton
          icon="chevron-down"
          label={t('action.collapse')}
          onClick={() => {
            setExpanded(false);
          }}
        />
        <IconButton
          icon="x"
          label={t('action.close')}
          onClick={() => {
            usePlayback.getState().stop();
          }}
        />
      </div>

      {recording.hasWaveform && peaks !== undefined ? (
        <Waveform
          peaks={peaks}
          size="detail"
          played={played}
          advance={advanceRate(state)}
          playedAt={state.positionAt}
        />
      ) : (
        // No peaks, no shape. A dashed rule and a duration is the honest answer (§3.1).
        <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {t('state.noWaveform')}
        </p>
      )}

      <div>
        <h2 style={{ font: 'var(--type-title)', color: 'var(--text)', margin: 0 }}>
          {recording.title}
        </h2>
        <p style={{ color: 'var(--text-2)', margin: 0 }}>{recording.library}</p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-2)',
        }}
      >
        <span>{position}</span>
        <span>{total}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <IconButton
          icon="skip-back"
          label={t('action.back')}
          onClick={() => {
            usePlayback.getState().nudge(-15);
          }}
        />
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? t('action.pause') : t('action.play')}
          onClick={toggle}
        />
        <IconButton
          icon="skip-forward"
          label={t('action.forward')}
          onClick={() => {
            usePlayback.getState().nudge(15);
          }}
        />
      </div>

      <button
        type="button"
        aria-label={t('action.speed')}
        onClick={() => {
          const next =
            RATES[(RATES.indexOf(state.rate as (typeof RATES)[number]) + 1) % RATES.length];
          usePlayback.getState().setRate(next ?? 1);
        }}
        style={{
          alignSelf: 'center',
          minHeight: 44,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
        }}
      >
        {asSpeed(state.rate)}
      </button>
    </div>
  );
}
