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
 */

import { useTranslation } from 'react-i18next';

import { BUCKETS, useWaveform } from '@/api/waveform';
import { toRecording } from '@/app/routes';
import { RecordingCard } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';

import { transcriptionState } from './recordings';
import type { Categories, Recording } from './recordings';

export interface RecordingGridProps {
  recordings: Recording[];
  categories: Categories;
  /** Whether the deferred per-card waveform fetches may start (`UI-31b`). */
  waveforms: boolean;
}

export function RecordingGrid({ recordings, categories, waveforms }: RecordingGridProps) {
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
          waveforms={waveforms}
        />
      ))}
    </div>
  );
}

function Card({
  recording,
  category,
  waveforms,
}: {
  recording: Recording;
  category: string | undefined;
  waveforms: boolean;
}) {
  const { t, i18n } = useTranslation('library');
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
      labels={{
        play: (name) => t('card.play', { name }),
        state: t(`common:transcription.${state}`),
        moreTags: (count) => t('card.moreTags', { count }),
        sharedIndividually: t('card.sharedIndividually'),
      }}
    />
  );
}
