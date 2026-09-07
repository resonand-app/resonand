import { Button, StateBadge, TranscriptLine } from '@/design-system';
import type { TranscriptionState } from '@/design-system';

export interface ResultMatch {
  /** Segment id, for the key and for the seek. */
  id: string | number;
  /** Timestamp inside the recording, formatted. "18:04". */
  at: string;
  /** The matching line of transcript, verbatim. */
  text: string;
}

export interface ResultGroupProps {
  title: string;
  /** Library and date, mono: "Àvia Teresa · 12 Mar 2026". */
  meta?: string;
  state?: TranscriptionState;
  /** The matches for this recording, in time order. */
  matches: ResultMatch[];
  /** How many there are in total, which is not always how many were sent. */
  total?: number;
  /** How many to show before the rest become a count. */
  shown?: number;
  onOpen?: () => void;
  /** Play this recording from that moment, without leaving the results. */
  onPlay?: (match: ResultMatch) => void;
  onShowAll?: () => void;
}

/**
 * One recording, with the lines of its transcript that matched (`UI-35j`).
 *
 * Search is across everything somebody has ever recorded, so the unit of a result is a recording
 * and not a line: forty matches in one interview are one result with forty matches, never forty
 * results. Grouping them is what stops a single long recording from filling the page.
 *
 * **Three, and then a count.** The fourth match tells somebody almost nothing the third did not,
 * and the count tells them the thing they actually want to know -- whether this is the recording.
 * `+N more` opens the recording at its transcript rather than expanding here: past three matches
 * the question has stopped being "which recording" and started being "where in it".
 *
 * The matched lines are `TranscriptLine`s, the same component the audio detail view uses, so a
 * line reads identically in the two places somebody meets it -- and clicking one seeks, here as
 * there.
 */
export function ResultGroup({
  title,
  meta,
  state = 'done',
  matches,
  total,
  shown = 3,
  onOpen,
  onPlay,
  onShowAll,
}: ResultGroupProps) {
  const visible = matches.slice(0, shown);
  const rest = (total ?? matches.length) - visible.length;

  return (
    <article
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-raised)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </button>
        {meta !== undefined && (
          <span
            style={{
              flex: '0 0 auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {meta}
          </span>
        )}
        <StateBadge state={state} variant="glyph" />
      </header>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((match) => (
          <TranscriptLine
            key={match.id}
            at={match.at}
            onClick={
              onPlay === undefined
                ? undefined
                : () => {
                    onPlay(match);
                  }
            }
          >
            {match.text}
          </TranscriptLine>
        ))}
      </div>
      {rest > 0 && (
        <div>
          <Button variant="ghost" onClick={onShowAll}>
            +{rest} more in this recording
          </Button>
        </div>
      )}
    </article>
  );
}
