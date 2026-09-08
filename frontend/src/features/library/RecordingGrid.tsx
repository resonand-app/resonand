/**
 * V3's card grid (`UI-6b`, §V3).
 *
 * A card per recording, three up at 1280, and the same `auto-fill` track the landing page uses --
 * three columns is what a 320px card does in the space, not a number written down.
 *
 * **The four transcription states are distinguishable without colour.** `StateBadge` carries a
 * glyph and a word as well as a colour, which is what makes "in progress" and "failed" different
 * to somebody who cannot tell the amber from the red -- and the word is the interface's, not the
 * system's English constant.
 *
 * **The date is the recording's own.** §1.3's wall: `recorded_at` is a wall-clock reading and is
 * rendered exactly as written, never converted to the reader's timezone, and a recording with no
 * date of its own says the date shown is the upload's.
 *
 * **Playing happens here and the route does not change** (`UI-6c`). The player is the shell's and
 * outlives every view (`UI-5a`), so a card hands it a recording and reads back whether that
 * recording is the one playing -- there is one playback state, and a grid that kept its own idea
 * of what was playing would be the second.
 */

import { useTranslation } from 'react-i18next';

import { BUCKETS, useWaveform } from '@/api/waveform';
import { toRecording } from '@/app/routes';
import { RecordingCard } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';
import { playedFraction, usePlayback } from '@/player/store';

import { transcriptionState } from './recordings';
import type { Categories, Recording } from './recordings';

export interface RecordingGridProps {
  recordings: Recording[];
  categories: Categories;
  /** The library's name, which the player shows under the title (§3.1). */
  libraryName: string;
  /** Whether the deferred per-card waveform fetches may start (`UI-31b`). */
  waveforms: boolean;
}

export function RecordingGrid({
  recordings,
  categories,
  libraryName,
  waveforms,
}: RecordingGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-width), 1fr))',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}
    >
      {recordings.map((recording) => (
        <Card
          key={recording.uuid}
          recording={recording}
          category={categories.nameOf(recording.category_id)}
          libraryName={libraryName}
          waveforms={waveforms}
        />
      ))}
    </div>
  );
}

function Card({
  recording,
  category,
  libraryName,
  waveforms,
}: {
  recording: Recording;
  category: string | undefined;
  libraryName: string;
  waveforms: boolean;
}) {
  const { t, i18n } = useTranslation('library');
  // Subscribed narrowly: a card re-renders when it becomes the playing one, and the position is
  // read only by the card that is playing. Subscribing every card to `positionMs` would re-render
  // a screenful of cards several times a second.
  const isCurrent = usePlayback((state) => state.recording?.uuid === recording.uuid);
  const isPlaying = usePlayback((state) => isCurrent && state.status === 'playing');
  const played = usePlayback((state) => (isCurrent ? playedFraction(state) : 0));
  // `has_waveform` is the flag, never an empty blob guessed at (§3.5): the request that would
  // 404 is not made, and the card draws a dashed rule until the peaks job has run.
  const { peaks, pending } = useWaveform(
    recording.uuid,
    BUCKETS.card,
    waveforms && recording.has_waveform,
  );

  const when = recordedAt(recording, i18n.language);
  const state = transcriptionState(recording.transcription_state);

  return (
    <RecordingCard
      name={recording.title}
      href={toRecording(recording.uuid)}
      meta={`${format.duration(recording.duration_ms)} · ${when.text}`}
      state={state}
      {...(category === undefined ? {} : { category })}
      tags={recording.tags.map((tag) => tag.name)}
      sharedIndividually={recording.is_shared_individually}
      peaks={peaks}
      pending={pending}
      played={played}
      playing={isPlaying}
      onPlay={() => {
        const state = usePlayback.getState();
        // The same control pauses what it started. Anything else is a new recording, which
        // replaces whatever was playing rather than queueing behind it -- there is no queue.
        if (isCurrent) state.toggle();
        else
          state.play({
            uuid: recording.uuid,
            title: recording.title,
            library: libraryName,
            durationMs: recording.duration_ms,
            hasWaveform: recording.has_waveform,
          });
      }}
      labels={{
        play: (name) => t('card.play', { name }),
        pause: (name) => t('card.pause', { name }),
        state: t(`common:transcription.${state}`),
        moreTags: (count) => t('card.moreTags', { count }),
        sharedIndividually: t('card.sharedIndividually'),
      }}
    />
  );
}
