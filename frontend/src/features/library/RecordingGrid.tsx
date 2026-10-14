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
 *
 * **It is not tied to a library** (`UI-43`). Each card is named against its own library, and a
 * grid whose cards come from several says on each which one, after the date.
 */

import { useTranslation } from 'react-i18next';

import { BUCKETS, useWaveform } from '@/api/waveform';
import { useFavourite } from '@/app/hooks/use-favourite';
import { shiftHeld } from '@/app/modifiers';
import { toRecording } from '@/app/routes';
import { RecordingCard } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';
import { usePlayback } from '@/player/store';

import { usePlaces } from './places';
import type { Places } from './places';
import { transcriptionState } from './recordings';
import { useKeepPlace } from './use-keep-place';
import { useLongPress } from './use-long-press';
import type { Recording } from './recordings';

export interface RecordingGridProps {
  recordings: Recording[];
  /**
   * Where the cards live, when the view already knows: one library's name and tree. Absent, and
   * each card is named against its own library (`UI-43`).
   */
  places?: Places;
  /** Whether the deferred per-card waveform fetches may start (`UI-31b`). */
  waveforms: boolean;
  /**
   * The selection, when the view offers one (`UI-9a`).
   *
   * Absent where nothing could be done with it rather than disabled: what somebody cannot do is
   * not drawn (§3.5), and a grid of ticked-off checkboxes leading nowhere reads as a bug.
   */
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (uuid: string, extend: boolean) => void;
  };
}

export function RecordingGrid({ recordings, places, waveforms, selection }: RecordingGridProps) {
  const { root, open } = useKeepPlace();
  const favourite = useFavourite();
  const resolved = usePlaces(places === undefined ? recordings : []);
  const where = places ?? resolved;
  return (
    <div
      ref={root}
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
          category={where.categoryOf(recording)}
          libraryName={where.libraryOf(recording)}
          showLibrary={where.spansLibraries}
          waveforms={waveforms}
          onOpen={open}
          onFavourite={favourite}
          {...(selection === undefined ? {} : { selection })}
        />
      ))}
    </div>
  );
}

function Card({
  recording,
  category,
  libraryName,
  showLibrary,
  waveforms,
  onOpen,
  onFavourite,
  selection,
}: {
  recording: Recording;
  category: string | undefined;
  /** Undefined where the caller cannot read the library this recording sits in. */
  libraryName: string | undefined;
  showLibrary: boolean;
  waveforms: boolean;
  onOpen: (uuid: string) => void;
  onFavourite: (uuid: string, on: boolean) => void;
  selection?: RecordingGridProps['selection'];
}) {
  const { t, i18n } = useTranslation('library');
  // Subscribed to which recording is playing and nothing else. The card's waveform is static and
  // the ring is the whole mark, so no card has any reason to know the position -- which is what
  // stops a screenful of them re-rendering several times a second.
  const isCurrent = usePlayback((state) => state.recording?.uuid === recording.uuid);
  const isPlaying = usePlayback((state) => isCurrent && state.status === 'playing');
  // `has_waveform` is the flag, never an empty blob guessed at (§3.5): the request that would
  // 404 is not made, and the card draws a dashed rule until the peaks job has run.
  const { peaks, pending } = useWaveform(
    recording.uuid,
    BUCKETS.card,
    waveforms && recording.has_waveform,
  );

  const when = recordedAt(recording, i18n.language);
  const state = transcriptionState(recording.transcription_state);
  // A phone reaches the checkbox no other way: it has no hover and no tab key, so until a
  // selection exists the box is hidden and nothing can start one (`UI-24b`).
  const longPress = useLongPress(
    selection === undefined
      ? undefined
      : () => {
          selection.onToggle(recording.uuid, false);
        },
  );

  return (
    <RecordingCard
      {...longPress.handlers}
      onOpen={() => {
        // A press that has just selected this card also produces a click, and the card reads a
        // click as "open me". Opening now would take somebody who asked to select one recording
        // to that recording instead.
        if (longPress.consumedByPress()) return;
        onOpen(recording.uuid);
      }}
      name={recording.title}
      href={toRecording(recording.uuid)}
      meta={[
        format.duration(recording.duration_ms),
        when.text,
        ...(showLibrary && libraryName !== undefined ? [libraryName] : []),
      ].join(' · ')}
      state={state}
      {...(category === undefined ? {} : { category })}
      tags={recording.tags.map((tag) => tag.name)}
      sharedIndividually={recording.is_shared_individually}
      // Everything the caller can read: the mark is theirs, and asks nothing of the recording.
      favourite={{
        on: recording.is_favourite,
        onToggle: () => {
          onFavourite(recording.uuid, !recording.is_favourite);
        },
      }}
      peaks={peaks}
      pending={pending}
      playing={isPlaying}
      {...(selection === undefined
        ? {}
        : {
            selected: selection.selected.has(recording.uuid),
            selecting: selection.selected.size > 0,
            onSelect: () => {
              // The event is read from the DOM rather than passed through the checkbox's own
              // handler, because `⇧`-click is a property of the click and not of the checkbox
              // (`UI-9d`). A checkbox that took a modifier as a prop would be a checkbox that
              // knew about ranges.
              selection.onToggle(recording.uuid, shiftHeld());
            },
          })}
      onPlay={() => {
        const state = usePlayback.getState();
        // The same control pauses what it started. Anything else is a new recording, which
        // replaces whatever was playing rather than queueing behind it -- there is no queue.
        if (isCurrent) state.toggle();
        else
          state.play({
            uuid: recording.uuid,
            title: recording.title,
            library: libraryName ?? '',
            durationMs: recording.duration_ms,
            hasWaveform: recording.has_waveform,
          });
      }}
      labels={{
        noWaveform: t('player:state.noWaveform'),
        play: (name) => t('card.play', { name }),
        pause: (name) => t('card.pause', { name }),
        select: (name) => t('card.select', { name }),
        state: t(`common:transcription.${state}`),
        moreTags: (count) => t('card.moreTags', { count }),
        sharedIndividually: t('card.sharedIndividually'),
        favourite: (name) => t('card.favourite', { name }),
      }}
    />
  );
}
