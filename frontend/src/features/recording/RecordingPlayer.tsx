/**
 * V5's player panel: the 130px waveform and the transport under it (`UI-11b`, `UI-11f`, §V5).
 *
 * **It is the same playback state as the bar in the shell**, not a second player (`UI-5a`, §3.1).
 * There is one position, one duration and one rate, and both surfaces read them -- which is why
 * nothing here holds state of its own and every control writes to the store. The bar drops its
 * own waveform while this one is on screen, because two waveforms at two scales drifting a frame
 * apart is what makes people believe there are two players.
 *
 * **The waveform is the seek control.** At 130px there is room for a real one: the peaks come
 * from the downsampled endpoint at `BUCKETS.detail`, the playhead is drawn, and a click or an
 * arrow key seeks (`Waveform` owns both, and reports a fraction). Seeking is the browser's --
 * `GET /audio/{uuid}/stream` honours `Range`, so jumping into the last minute of a three-hour
 * file fetches that minute (`UI-5b`).
 *
 * **No peaks is a state and not an empty box** (`UI-11f`, §3.5). `has_waveform` is the flag, so
 * the request that would 404 is never made, and the panel draws the dashed rule at the full 130px
 * with the duration beside it -- plus one quiet line, in this view's own words, saying the picture
 * is still being made. Never an invented shape: a waveform is a claim about a recording.
 *
 * **The speed control is a menu of the six rates rather than a pill that cycles.** A pill that
 * advances on each press is four presses to get from 2x back to 1x, and it cannot be read before
 * it is used. The rates are the store's, so the bar's pill and this menu cannot offer different
 * ones.
 */

import { useTranslation } from 'react-i18next';

import { BUCKETS, useWaveform } from '@/api/waveform';
import { Button, IconButton, Menu, Waveform } from '@/design-system';
import * as format from '@/i18n/format';
import { RATES, advanceRate, playedFraction, usePlayback } from '@/player/store';

import type { RecordingContext } from './data';

/** How far the two skip controls move. §1.8's fifteen seconds, the same as `⇧←` and `⇧→`. */
const SKIP_SECONDS = 15;

export function RecordingPlayer({ context }: { context: RecordingContext }) {
  const { t } = useTranslation('recording');
  const recording = context.recording;
  const state = usePlayback();
  const isCurrent = state.recording?.uuid === recording?.uuid;
  const { peaks, pending } = useWaveform(
    recording?.uuid ?? '',
    BUCKETS.detail,
    recording?.has_waveform === true,
  );

  if (recording === undefined) return null;

  const libraryName = context.library?.name ?? '';
  const isPlaying = isCurrent && state.status === 'playing';
  // The store's duration while this recording is loaded, and the API's before it is: the length
  // is known from the recording, so the total does not appear a second after the panel does. It
  // stays nullable, because a recording the probe has not reached has no length -- and `--:--` is
  // what unknown looks like, where `00:00` would be a length (§1.4).
  const knownMs = isCurrent && state.durationMs > 0 ? state.durationMs : recording.duration_ms;
  const durationMs = knownMs ?? 0;
  const played = isCurrent ? playedFraction(state) : 0;

  /** Play this recording, or pause it if it is the one playing. */
  const toggle = () => {
    const playback = usePlayback.getState();
    if (isCurrent) {
      if (playback.status === 'failed') playback.play(described());
      else playback.toggle();
      return;
    }
    playback.play(described());
  };

  /** This recording, as the player needs it described (§3.1). */
  const described = () => ({
    uuid: recording.uuid,
    title: recording.title,
    library: libraryName,
    durationMs: recording.duration_ms,
    hasWaveform: recording.has_waveform,
  });

  /** Seeking a recording that is not loaded loads it first: the position is where it starts. */
  const seekTo = (fraction: number) => {
    const playback = usePlayback.getState();
    if (!isCurrent) playback.play(described());
    playback.seek(Math.round(fraction * durationMs));
  };

  return (
    <section
      data-app="detail-player"
      aria-label={t('player.label')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
      }}
    >
      <Waveform
        peaks={peaks}
        size="detail"
        played={played}
        playhead
        advance={isCurrent ? advanceRate(state) : 0}
        playedAt={state.positionAt}
        pending={pending}
        duration={format.duration(knownMs)}
        onSeek={seekTo}
        label={t('player.seek', { title: recording.title })}
      />
      {pending && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {t('player.noWaveform')}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton
            icon="skip-back"
            variant="ghost"
            size={32}
            label={t('player.back', { seconds: SKIP_SECONDS })}
            onClick={() => {
              usePlayback.getState().nudge(-SKIP_SECONDS);
            }}
            style={{ color: 'var(--text-2)' }}
          />
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            variant="accent"
            size={44}
            label={isPlaying ? t('player.pause') : t('player.play')}
            onClick={toggle}
            aria-busy={isCurrent && state.status === 'buffering'}
          />
          <IconButton
            icon="skip-forward"
            variant="ghost"
            size={32}
            label={t('player.forward', { seconds: SKIP_SECONDS })}
            onClick={() => {
              usePlayback.getState().nudge(SKIP_SECONDS);
            }}
            style={{ color: 'var(--text-2)' }}
          />
        </div>
        <span
          style={{
            fontFamily: 'var(--type-numeric-family)',
            fontSize: 'var(--type-numeric-size)',
            fontVariantNumeric: 'var(--type-numeric-variant)',
            color: 'var(--text-2)',
          }}
        >
          {/* The position first and in the accent, the total after it and quieter: one of the
              two changes four times a second and the other never does. */}
          <span style={{ color: 'var(--accent)' }}>
            {format.duration(isCurrent ? state.positionMs : 0)}
          </span>
          {` / ${format.duration(knownMs)}`}
        </span>
        <Speed />
      </div>
    </section>
  );
}

/**
 * The six rates the store offers, as a menu.
 *
 * The label carries the current rate, so the control reads as the answer to "how fast is this
 * playing" rather than as a control whose state has to be inferred from somewhere else.
 */
function Speed() {
  const { t } = useTranslation('recording');
  const rate = usePlayback((state) => state.rate);

  return (
    <Menu
      label={t('player.speed')}
      width={140}
      items={RATES.map((one) => ({ id: String(one), label: format.speed(one) }))}
      onSelect={(id) => {
        usePlayback.getState().setRate(Number(id));
      }}
      trigger={({ open, onToggle }) => (
        <Button
          variant="secondary"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('player.speedNow', { speed: format.speed(rate) })}
          onClick={onToggle}
        >
          {format.speed(rate)}
        </Button>
      )}
    />
  );
}
