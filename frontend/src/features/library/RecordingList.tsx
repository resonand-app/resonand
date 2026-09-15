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
 *
 * **A sortable heading and the filter bar's control are one sort** (`UI-7d`, §V4). Neither holds
 * a sort of its own: both write `sort` and `direction` to the URL and read them back, so clicking
 * a heading and choosing in the bar are indistinguishable in effect, and the arrow on the heading
 * is right even when the bar was what changed it. `aria-sort` says the same thing to a screen
 * reader that the arrow says to everybody else.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { fromList } from '@/app/came-from';
import { toRecording } from '@/app/routes';
import { shiftHeld } from '@/app/modifiers';
import { useUrlState } from '@/app/url-state';
import type { SortDirection, SortField } from '@/app/url-state';
import { Icon, RecordingRow, RowSkeleton } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';
import { usePlayback } from '@/player/store';

import { transcriptionState } from './recordings';
import { useLongPress } from './use-long-press';
import type { Categories, Recording } from './recordings';
import { useRowCount, useRows } from './rows';

/** `--row-height`. The virtualiser needs it as a number, and it is the token's value. */
const ROW_HEIGHT = 36;

/** How many rows to draw beyond the viewport, so a fast scroll does not show empty space. */
const OVERSCAN = 8;

/** How tall the scroll container gets. The virtualiser measures the element, not this. */
const MAX_HEIGHT = 720;

export interface RecordingListProps {
  libraryUuid: string;
  /** The selection, when this library offers one (`UI-9a`). Absent where it does not. */
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (uuid: string, extend: boolean) => void;
  };
  /** The library's category tree, for the column that names one. */
  categories: Categories;
  /** The API query the rows are drawn from: the filters, without a window. */
  query: Record<string, unknown>;
  /** The library's name, which the player shows under the title (§3.1). */
  libraryName: string;
}

export function RecordingList({
  libraryUuid,
  categories,
  query,
  libraryName,
  selection,
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
      <Columns selecting={selection !== undefined} />
      <div
        ref={scroller}
        style={{
          height: `min(70vh, ${String(MAX_HEIGHT)}px)`,
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
                    {...(selection === undefined ? {} : { selection })}
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
 * The four headings the API can sort by are buttons (`UI-7d`); the rest are labels, because a
 * heading that looks pressable and does nothing is worse than one that plainly is not.
 */
function Columns({ selecting }: { selecting: boolean }) {
  const { t } = useTranslation('library');
  const { filters, set } = useUrlState();

  const sortBy = (field: SortField) => {
    // A heading already sorted flips its direction; a new one starts in the direction that reads
    // as "most interesting first" for what it holds -- newest, longest, and A to Z.
    const direction: SortDirection =
      filters.sort === field
        ? filters.direction === 'desc'
          ? 'asc'
          : 'desc'
        : field === 'title'
          ? 'asc'
          : 'desc';
    set({ sort: field, direction });
  };

  const sortable = (field: SortField) => ({
    sort: filters.sort === field ? filters.direction : undefined,
    onSort: () => {
      sortBy(field);
    },
    hint: t(directionHint(field, filters.sort === field ? filters.direction : undefined)),
  });

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
      {selecting && (
        <span
          role="columnheader"
          style={{ width: 16, flex: '0 0 auto' }}
          aria-label={t('list.select')}
        />
      )}
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
      <Heading label={t('list.title')} style={{ flex: 1, minWidth: 0 }} {...sortable('title')} />
      <Heading
        label={t('list.date')}
        column="date"
        style={{ width: 104, flex: '0 0 auto' }}
        {...sortable('recorded_at')}
      />
      <Heading
        label={t('list.duration')}
        style={{ width: 46, flex: '0 0 auto', justifyContent: 'flex-end' }}
        {...sortable('duration_ms')}
      />
      <span role="columnheader" data-column="category" style={{ width: 116, flex: '0 0 auto' }}>
        {t('list.category')}
      </span>
      <span role="columnheader" data-column="tags" style={{ width: 148, flex: '0 0 auto' }}>
        {t('list.tags')}
      </span>
    </div>
  );
}

/** What pressing a heading will do, which is what its accessible name has to say (`UI-8d`). */
function directionHint(field: SortField, current: SortDirection | undefined): string {
  if (current === undefined) return field === 'title' ? 'sort.toAscending' : 'sort.toDescending';
  return current === 'desc' ? 'sort.toAscending' : 'sort.toDescending';
}

/**
 * One sortable column heading.
 *
 * `aria-sort` on the cell and the arrow inside it are the same fact twice, for two different
 * readers. The button carries what pressing it will do rather than what the column currently is,
 * for the reason the bar's direction control does.
 */
function Heading({
  label,
  column,
  sort,
  hint,
  onSort,
  style,
}: {
  label: string;
  column?: string;
  sort: SortDirection | undefined;
  hint: string;
  onSort: () => void;
  style?: CSSProperties;
}) {
  return (
    <span
      role="columnheader"
      aria-sort={sort === undefined ? 'none' : sort === 'asc' ? 'ascending' : 'descending'}
      {...(column === undefined ? {} : { 'data-column': column })}
      style={style}
    >
      <button
        type="button"
        data-ds="column-heading"
        onClick={onSort}
        aria-label={`${label}: ${hint}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          font: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          color: sort === undefined ? 'inherit' : 'var(--text-2)',
          cursor: 'pointer',
          justifyContent: style?.justifyContent,
        }}
      >
        {label}
        {sort !== undefined && (
          <Icon name={sort === 'desc' ? 'chevron-down' : 'chevron-up'} size={13} />
        )}
      </button>
    </span>
  );
}

function Row({
  recording,
  category,
  libraryName,
  selection,
}: {
  recording: Recording;
  category: string | undefined;
  libraryName: string;
  selection?: RecordingListProps['selection'];
}) {
  const { t, i18n } = useTranslation('library');
  const navigate = useNavigate();
  const { search } = useLocation();
  const isCurrent = usePlayback((state) => state.recording?.uuid === recording.uuid);
  const isPlaying = usePlayback((state) => isCurrent && state.status === 'playing');
  const state = transcriptionState(recording.transcription_state);
  const when = recordedAt(recording, i18n.language);
  // The dense list has the same problem the grid does: a phone has no hover and no tab key, so
  // until a selection exists there is nothing to press (`UI-24b`).
  const longPress = useLongPress(
    selection === undefined
      ? undefined
      : () => {
          selection.onToggle(recording.uuid, false);
        },
  );

  return (
    <RecordingRow
      {...longPress.handlers}
      name={recording.title}
      duration={format.duration(recording.duration_ms)}
      date={when.text}
      {...(category === undefined ? {} : { category })}
      tags={recording.tags.map((tag) => tag.name)}
      state={state}
      playing={isPlaying}
      {...(selection === undefined
        ? {}
        : {
            selected: selection.selected.has(recording.uuid),
            onSelect: () => {
              selection.onToggle(recording.uuid, shiftHeld());
            },
          })}
      onOpen={() => {
        // A press that has just selected this row also produces a click, and the row reads a
        // click as "open me". Opening now would take somebody who asked to select one recording
        // to that recording instead.
        if (longPress.consumedByPress()) return;
        void navigate(toRecording(recording.uuid), fromList(search));
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
        select: (name) => t('card.select', { name }),
        state: t(`common:transcription.${state}`),
      }}
    />
  );
}
