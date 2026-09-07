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

import { useTranslation } from 'react-i18next';

import { PlayerBar } from '@/design-system';
import type { Peaks } from '@/design-system';
import { duration as asDuration, speed as asSpeed } from '@/i18n/format';

import { playedFraction, usePlayback } from './store';

export interface PlayerProps {
  /** The recording the view is showing, if it is showing one. */
  onScreen?: string | undefined;
  /** The peaks, when the bar is the surface drawing them. */
  peaks?: Peaks | undefined;
}

export function Player({ onScreen, peaks }: PlayerProps) {
  const { t } = useTranslation('player');
  const state = usePlayback();
  const { recording, status } = state;

  // Absent, not empty (§3.1). A 64px bar with nothing in it is a control somebody keeps looking
  // at to work out what it is for, and the shell reflows without it.
  if (recording === null || status === 'idle') return null;

  const isOnScreen = onScreen !== undefined && onScreen === recording.uuid;
  const position = asDuration(state.positionMs);
  const total = asDuration(state.durationMs || recording.durationMs);

  return (
    <div data-app="player" data-status={status}>
      <PlayerBar
        title={recording.title}
        library={note(recording.library, {
          failed: status === 'failed' ? t('state.failed') : undefined,
          onScreen: isOnScreen ? t('state.onScreen') : undefined,
          original: recording.fromOriginal === true ? t('state.fromOriginal') : undefined,
          noWaveform: !recording.hasWaveform ? t('state.noWaveform') : undefined,
        })}
        // No waveform when the peaks job has not run, and none when the recording is on screen:
        // the first would be an invented shape, the second a second player.
        {...(isOnScreen || !recording.hasWaveform ? {} : { peaks })}
        position={position}
        duration={total}
        played={playedFraction(state)}
        playing={status === 'playing'}
        speed={asSpeed(state.rate)}
        onToggle={() => {
          if (status === 'failed') {
            // Retrying is playing it again from where it stopped, which is what "try again" means
            // to somebody who pressed play a moment ago.
            usePlayback.getState().play(recording);
            return;
          }
          usePlayback.getState().toggle();
        }}
        onBack={() => {
          usePlayback.getState().nudge(-15);
        }}
        onForward={() => {
          usePlayback.getState().nudge(15);
        }}
        labels={{
          play: t('action.play'),
          pause: t('action.pause'),
          back: t('action.back'),
          forward: t('action.forward'),
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
