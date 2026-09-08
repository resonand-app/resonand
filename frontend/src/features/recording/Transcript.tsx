/**
 * The synchronised transcript (`UI-12a`, `UI-12d`, §V5).
 *
 * The centre of the product: the screen where a recording and what was said in it are the same
 * object. Four decisions hold it up.
 *
 * **Exactly one active line at a time**, and it is derived rather than stored. The store has one
 * position; the active index is `segmentAt` over that position, subscribed as a number, so a
 * screenful of lines re-renders when the active one changes and not four times a second because
 * the position moved a hundred milliseconds. Before the first segment starts there is **no**
 * active line rather than the first one: a recording with two minutes of room noise has not
 * reached its transcript yet.
 *
 * **Clicking a line seeks to that moment**, which is the interaction the whole screen exists for.
 * `TranscriptLine` makes that a real control -- a role, a tab stop, `Enter` and `Space` -- because
 * a seek that needs a mouse is a seek half the people who need this screen cannot perform.
 *
 * **It virtualises, because the real shape of this content is a few hundred segments.** A
 * 48-minute interview is one to three sentences every ten seconds; a three-hour recording is a
 * thousand lines, and the active one has to be findable after a seek to the end of it. The rows
 * are measured rather than assumed: a line is one visual row or three depending on the width and
 * the sentence, and a fixed estimate would put the playhead's line in the wrong place halfway
 * down a long transcript.
 *
 * **The scroll follows playback and releases the moment somebody scrolls** (`UI-12b`), which is
 * `use-follow.ts` -- and it is offered back through a band that stays until it is used, never a
 * toast that vanishes before it is read.
 *
 * **There is no edit affordance anywhere on it** (`UI-12d`). Manual editing is a later milestone,
 * and a text cursor on a transcript line promises an editor that does not exist. `speaker` is
 * usually empty in v0 and is accommodated without being depended on: when it is there it prefixes
 * the line, and when it is not, nothing shifts.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, TranscriptLine, usePrefersReducedMotion } from '@/design-system';
import * as format from '@/i18n/format';
import { usePlayback } from '@/player/store';

import type { RecordingContext } from './data';
import { segmentAt } from './transcripts';
import type { Segment, Transcripts } from './transcripts';
import { useFollow } from './use-follow';

/** How tall a line is before it has been measured. One row of body text plus its padding. */
const ESTIMATED_LINE = 46;

/** How many lines to draw beyond the viewport, so a fast scroll does not show empty space. */
const OVERSCAN = 10;

/** How tall the scroller gets. The transcript is the screen, so it takes what it can. */
const MAX_HEIGHT = 640;

export interface TranscriptProps {
  context: RecordingContext;
  transcripts: Transcripts;
}

export function Transcript({ context, transcripts }: TranscriptProps) {
  // The virtualiser measures live DOM nodes and returns different results from the same inputs,
  // which is what the React Compiler is entitled to assume does not happen -- the same directive
  // and the same reason as `RecordingList`.
  'use no memo';

  const { t } = useTranslation('recording');
  const scroller = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  // The scroll is the one thing in the product that moves by itself, and no stylesheet can reach
  // inside a `scrollTo` -- so the preference is read here and asked for by name (`UI-32c`).
  const follow = useFollow(scroller, !reduced);
  const recording = context.recording;
  const segments = transcripts.active?.segments ?? [];

  const isCurrent = usePlayback((state) => state.recording?.uuid === recording?.uuid);
  // Subscribed as an index rather than as a position: this is the one number the transcript
  // cares about, and it changes every ten seconds rather than four times a second.
  const active = usePlayback((state) => (isCurrent ? segmentAt(segments, state.positionMs) : -1));

  // eslint-disable-next-line react-hooks/incompatible-library -- see the directive above
  const virtualiser = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ESTIMATED_LINE,
    overscan: OVERSCAN,
  });

  // Keep the line being spoken in the middle of the scroller. The offset comes from the
  // virtualiser, which knows where every index is whether or not it is drawn -- so a seek to the
  // end of a three-hour recording lands on the right line rather than on the last one rendered.
  const centre = follow.centreOn;
  useEffect(() => {
    if (!follow.following || active < 0) return;
    const offset = virtualiser.getOffsetForIndex(active, 'center')?.[0];
    if (offset === undefined) return;
    centre(offset);
    // `virtualiser` is deliberately not a dependency: it is a new object every render, and this
    // has to run when the active line changes rather than on every frame of a scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, follow.following, centre]);

  if (recording === undefined || segments.length === 0) return null;

  /** Jump to a moment, loading the recording first if it is not the one playing. */
  const seekTo = (segment: Segment) => {
    const playback = usePlayback.getState();
    // Choosing a line is somebody saying where they want to be, so it takes following back up.
    follow.resume();
    if (!isCurrent) {
      playback.play({
        uuid: recording.uuid,
        title: recording.title,
        library: context.library?.name ?? '',
        durationMs: recording.duration_ms,
        hasWaveform: recording.has_waveform,
      });
    }
    playback.seek(segment.start_ms);
  };

  return (
    <section data-app="transcript" aria-label={t('transcript.label')}>
      <Heading count={transcripts.active?.segment_count ?? segments.length} />
      {!follow.following && <Released onResume={follow.resume} />}
      <div
        ref={scroller}
        data-app="transcript-scroller"
        onScroll={follow.onScroll}
        style={{
          height: `min(60vh, ${String(MAX_HEIGHT)}px)`,
          overflowY: 'auto',
          contain: 'strict',
        }}
      >
        <div style={{ height: virtualiser.getTotalSize(), position: 'relative' }}>
          {virtualiser.getVirtualItems().map((item) => {
            const segment = segments[item.index];
            if (segment === undefined) return null;
            return (
              <div
                key={item.key}
                ref={virtualiser.measureElement}
                data-index={item.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${String(item.start)}px)`,
                }}
              >
                <TranscriptLine
                  at={format.timestamp(segment.start_ms)}
                  active={item.index === active}
                  aria-current={item.index === active ? 'true' : undefined}
                  onClick={() => {
                    seekTo(segment);
                  }}
                >
                  {/* The speaker prefixes the line when there is one. `speaker` is usually null
                      in v0, and a label reserved for it would be an empty column on every line
                      of every transcript in the archive. */}
                  {segment.speaker === null || segment.speaker === '' ? (
                    segment.text
                  ) : (
                    <>
                      <b style={{ fontWeight: 'var(--weight-semibold)' }}>{segment.speaker}</b>{' '}
                      {segment.text}
                    </>
                  )}
                </TranscriptLine>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * The offer to start following again (`UI-12b`).
 *
 * **A band that stays, not a toast.** It sits between the heading and the lines and does not go
 * away on a timer, because the person it is for is reading -- they will look up when they are
 * ready, and a message that has already faded is a feature they never find. It says what
 * happened rather than what to do, because what happened is the part that is surprising.
 */
function Released({ onResume }: { onResume: () => void }) {
  const { t } = useTranslation('recording');
  return (
    <div
      data-app="follow-released"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
        padding: 'var(--space-2) var(--space-3)',
        marginBottom: 'var(--space-2)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-control)',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 190,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-2)',
        }}
      >
        {t('transcript.released')}
      </span>
      <Button variant="secondary" icon="align-left" onClick={onResume}>
        {t('transcript.resume')}
      </Button>
    </div>
  );
}

/**
 * The transcript's own heading: how many segments, and what clicking one does (`UI-12d`).
 *
 * The hint is here rather than on each line because it is a property of the whole thing, and
 * because the alternative -- a tooltip per line -- is nine hundred tooltips. **No edit
 * affordance**: not a pencil, not a "suggest a correction", nothing. Manual editing is a later
 * milestone and every hint of it here is a promise this version cannot keep.
 */
function Heading({ count }: { count: number }) {
  const { t } = useTranslation('recording');
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-2)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text)',
        }}
      >
        {t('transcript.heading', { count })}
      </h2>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
        }}
      >
        {t('transcript.hint')}
      </span>
    </header>
  );
}
