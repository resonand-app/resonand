/**
 * The three presentations of one player (`UI-5c`, `UI-5d`, §3.1).
 *
 * The bar at the bottom of the shell is the same sound as the 130px player in the detail view, so
 * two rules decide what it draws rather than any styling:
 *
 * **When the recording being played is the one on screen, the bar drops its waveform.** The
 * detail view's waveform is the one that moves, and the bar collapses to the position and the
 * duration with a note saying which one is which. Two waveforms at two scales drifting a frame
 * apart is what makes people believe there are two players.
 *
 * **When the file will not play, the bar does not vanish.** It states the fact and offers to try
 * again. A player that disappeared on failure would leave somebody looking at a shell that
 * reflowed for no reason they can see.
 *
 * §3.1's six states are all here and none of them is a spinner: buffering is a disabled transport
 * with the position holding, no peaks is a position and a duration with **no invented shape**,
 * and still-being-processed is a quiet line rather than a warning.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { toRecording } from '@/app/routes';
import { PlayerBar } from '@/design-system';
import { duration as asDuration, speed as asSpeed } from '@/i18n/format';

import { RATES, advanceRate, playedFraction, usePlayback } from './store';
import { usePlayingPeaks } from './use-playing-peaks';

export interface PlayerProps {
  /** The recording the view is showing, if it is showing one. */
  onScreen?: string | undefined;
}

export function Player({ onScreen }: PlayerProps) {
  const { t } = useTranslation('player');
  const navigate = useNavigate();
  const state = usePlayback();
  // Where a drag on the bar's waveform is, so the position beside it says where the drag is
  // going rather than where the sound still is.
  const [preview, setPreview] = useState<number | null>(null);
  const { recording, status } = state;
  const isOnScreen = onScreen !== undefined && onScreen === recording?.uuid;
  // Not asked for while the detail view's waveform is the one on screen: the bar draws no second
  // shape, so there is no second picture to fetch.
  const peaks = usePlayingPeaks(!isOnScreen);

  // Absent, not empty (§3.1). A 64px bar with nothing in it is a control somebody keeps looking
  // at to work out what it is for, and the shell reflows without it.
  if (recording === null || status === 'idle') return null;

  const end = state.durationMs || (recording.durationMs ?? 0);
  const position = asDuration(preview === null ? state.positionMs : preview * end);
  const total = asDuration(state.durationMs || recording.durationMs);

  return (
    <div data-app="player" data-status={status}>
      <PlayerBar
        title={recording.title}
        href={toRecording(recording.uuid)}
        // The bar opens what is playing through the router; the `href` above would reload the page.
        onOpen={() => {
          void navigate(toRecording(recording.uuid));
        }}
        library={note(recording.library, {
          failed: status === 'failed' ? t('state.failed') : undefined,
          onScreen: isOnScreen ? t('state.onScreen') : undefined,
          original: recording.fromOriginal === true ? t('state.fromOriginal') : undefined,
          noWaveform: !recording.hasWaveform ? t('state.noWaveform') : undefined,
        })}
        // Absent collapses the slot to the position and the total, which is what the bar shows
        // for a recording on screen or one whose peaks job has not run.
        peaks={peaks}
        position={position}
        duration={total}
        played={playedFraction(state)}
        playing={status === 'playing'}
        advance={advanceRate(state)}
        playedAt={state.positionAt}
        speed={asSpeed(state.rate)}
        // Cycling and not a menu: the bar has one line of room, and §1.4's six rates are a
        // short enough ring to get back to 1.0x by pressing again. The detail view's player is
        // where the whole list is offered.
        onSpeed={() => {
          const at = RATES.indexOf(state.rate as (typeof RATES)[number]);
          usePlayback.getState().setRate(RATES[(at + 1) % RATES.length] ?? 1);
        }}
        onToggle={() => {
          if (status === 'failed') {
            // Retrying is playing it again from where it stopped, which is what "try again" means
            // to somebody who pressed play a moment ago.
            usePlayback.getState().play(recording);
            return;
          }
          usePlayback.getState().toggle();
        }}
        // §3.1's waveform in the bar is seekable, and it is the widest target in the player.
        onSeek={(fraction) => {
          if (end > 0) usePlayback.getState().seek(Math.round(fraction * end));
        }}
        onPreview={setPreview}
        onBack={() => {
          usePlayback.getState().nudge(-15);
        }}
        onForward={() => {
          usePlayback.getState().nudge(15);
        }}
        onClose={() => {
          usePlayback.getState().stop();
        }}
        labels={{
          play: t('action.play'),
          pause: t('action.pause'),
          back: t('action.back'),
          forward: t('action.forward'),
          close: t('action.close'),
          speed: t('action.speed'),
          seek: t('action.seek', { title: recording.title }),
        }}
        aria-busy={status === 'buffering'}
      />
    </div>
  );
}

/**
 * The line under the title.
 *
 * The library it came from, and at most one thing about the playback -- said quietly, in the
 * place a person is already reading, rather than as a banner that moves the layout. The order is
 * how much it matters: a file that will not play first, then which waveform is moving, then the
 * two that are about processing.
 */
function note(
  library: string,
  states: {
    failed?: string | undefined;
    onScreen?: string | undefined;
    original?: string | undefined;
    noWaveform?: string | undefined;
  },
): string {
  const said = states.failed ?? states.onScreen ?? states.original ?? states.noWaveform;
  return said === undefined ? library : `${library} · ${said}`;
}
