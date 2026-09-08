/**
 * V4's dense list (`UI-7a`, §V4).
 *
 * Eight hundred recordings in about twenty-six screens rather than ninety, which is the whole
 * argument for the density: for eight hundred, the grid is useless. The row is the design
 * system's 36px floor and the number that makes that arithmetic real.
 *
 * **The scrollbar is honest before the list is fetched.** The virtualiser counts `total` from the
 * first page response, not the rows in hand, so the list is as tall as the library is from the
 * moment it can be measured. A scrollbar that grows as pages arrive tells somebody the list is
 * short and they stop scrolling -- and they never find out they were wrong.
 *
 * **A row whose page is still in flight is a row.** It draws at the right height with a skeleton
 * in it, so nothing below it moves when the page lands. `RowSkeleton` is the design system's, at
 * the same height, in the same three blocks.
 *
 * **The column header is sticky and is a header.** `role="row"` over `columnheader` cells, so a
 * screen reader reads the list as a table rather than as eight hundred buttons -- and it stays on
 * screen, because a column somebody has scrolled two hundred rows past is a column they can no
 * longer name.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { BUCKETS, useWaveform } from '@/api/waveform';
import { toRecording } from '@/app/routes';
import { RecordingRow, RowSkeleton } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';
import { playedFraction, usePlayback } from '@/player/store';

import { transcriptionState } from './recordings';
import type { Categories, Recording } from './recordings';
import { useRowCount, useRows } from './rows';

/** `--row-height`. The virtualiser needs it as a number, and it is the token's value. */
const ROW_HEIGHT = 36;

/** How many rows to draw beyond the viewport, so a fast scroll does not show empty space. */
const OVERSCAN = 8;

export interface RecordingListProps {
  libraryUuid: string;
  /** The library's category tree, for the column that names one. */
  categories: Categories;
  /** The API query the rows are drawn from: the filters, without a window. */
  query: Record<string, unknown>;
  /** The library's name, which the player shows under the title (§3.1). */
  libraryName: string;
  /** Whether the deferred per-row waveform fetches may start. */
  waveforms: boolean;
}

export function RecordingList({
  libraryUuid,
  categories,
  query,
  libraryName,
  waveforms,
}: RecordingListProps) {
  // The virtualiser measures a live DOM node and hands back functions whose results change
  // without its inputs changing, which is exactly what the React Compiler is entitled to assume
  // does not happen -- `react-hooks/incompatible-library` says so about this hook by name. The
  // directive opts this one component out of memoisation; it is the library's documented answer,
  // and it is scoped to the component that virtualises rather than to the file or the build.
  'use no memo';

  const { t } = useTranslation('library');
  const scroller = useRef<HTMLDivElement>(null);

  // The height first, from page zero alone: `total` is in every page response, so the list knows
  // how tall it is one request in and never grows as the rest arrive (§V4).
  const { total } = useRowCount(libraryUuid, query);

  // eslint-disable-next-line react-hooks/incompatible-library -- see the directive above
  const virtualiser = useVirtualizer({
    count: total,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const items = virtualiser.getVirtualItems();
  // Which pages the current scroll position needs. Page zero is in the set whatever the range
  // says, and it is already in the cache from the count above.
  const rows = useRows(libraryUuid, query, {
    start: items[0]?.index ?? 0,
    end: items[items.length - 1]?.index ?? OVERSCAN,
  });

  return (
    <div role="table" aria-label={t('list.label')} aria-rowcount={total}>
      <Columns />
      <div
        ref={scroller}
        style={{
          height: 'min(70vh, 720px)',
          overflowY: 'auto',
          // The scroll container is the thing the virtualiser measures, so it owns the height.
          contain: 'strict',
        }}
      >
        <div style={{ height: virtualiser.getTotalSize(), position: 'relative' }}>
          {items.map((item) => {
            const recording = rows.rowAt(item.index);
            return (
              <div
                key={item.key}
                role="row"
                aria-rowindex={item.index + 2}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${String(item.start)}px)`,
                }}
              >
                {recording === undefined ? (
                  <RowSkeleton />
                ) : (
                  <Row
                    recording={recording}
                    category={categories.nameOf(recording.category_id)}
                    libraryName={libraryName}
                    waveforms={waveforms}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The column header.
 *
 * Each heading over a column that can go carries the same `data-column` the cell does, so the two
 * disappear together (`UI-7b`) -- a heading over a column that is not there names the wrong one.
 * `UI-7d` makes these headings sort.
 */
function Columns() {
  const { t } = useTranslation('library');
  return (
    <div
      role="row"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '0 12px',
        height: 28,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--type-overline-size)',
        letterSpacing: 'var(--type-overline-tracking)',
        textTransform: 'uppercase',
        color: 'var(--text-3)',
      }}
    >
      <span
        role="columnheader"
        style={{ width: 26, flex: '0 0 auto' }}
        aria-label={t('list.play')}
      />
      <span
        role="columnheader"
        style={{ width: 15, flex: '0 0 auto' }}
        aria-label={t('list.state')}
      />
      <span role="columnheader" style={{ flex: 1, minWidth: 0 }}>
        {t('list.title')}
      </span>
      <span role="columnheader" data-column="waveform" style={{ width: 88, flex: '0 0 auto' }}>
        {t('list.waveform')}
      </span>
      <span role="columnheader" data-column="date" style={{ width: 104, flex: '0 0 auto' }}>
        {t('list.date')}
      </span>
      <span role="columnheader" style={{ width: 46, flex: '0 0 auto', textAlign: 'right' }}>
        {t('list.duration')}
      </span>
      <span role="columnheader" data-column="category" style={{ width: 116, flex: '0 0 auto' }}>
        {t('list.category')}
      </span>
      <span role="columnheader" data-column="tags" style={{ width: 148, flex: '0 0 auto' }}>
        {t('list.tags')}
      </span>
    </div>
  );
}

function Row({
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
  const navigate = useNavigate();
  const isCurrent = usePlayback((state) => state.recording?.uuid === recording.uuid);
  const isPlaying = usePlayback((state) => isCurrent && state.status === 'playing');
  const played = usePlayback((state) => (isCurrent ? playedFraction(state) : 0));
  const { peaks, pending } = useWaveform(
    recording.uuid,
    BUCKETS.row,
    waveforms && recording.has_waveform,
  );
  const state = transcriptionState(recording.transcription_state);
  const when = recordedAt(recording, i18n.language);

  return (
    <RecordingRow
      name={recording.title}
      duration={format.duration(recording.duration_ms)}
      date={when.text}
      {...(category === undefined ? {} : { category })}
      tags={recording.tags.map((tag) => tag.name)}
      state={state}
      peaks={peaks}
      pending={pending}
      played={played}
      playing={isPlaying}
      onOpen={() => {
        void navigate(toRecording(recording.uuid));
      }}
      onPlay={() => {
        const player = usePlayback.getState();
        if (isCurrent) player.toggle();
        else
          player.play({
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
      }}
    />
  );
}
