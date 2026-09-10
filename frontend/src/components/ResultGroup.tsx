import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon, StateBadge, TranscriptLine } from '@/design-system';
import type { TranscriptionState } from '@/design-system';

export interface ResultMatch {
  /** Segment id, for the key and for the seek. */
  id: string | number;
  /** Timestamp inside the recording, formatted. "18:04". */
  at: string;
  /**
   * The matching line, with the term the database marked already marked.
   *
   * A node rather than a string: the marking comes back inside the fragment and §V6 asks for it to
   * be rendered rather than re-derived from what somebody typed.
   */
  text: ReactNode;
  /**
   * Where in the recording it is, in milliseconds, or `null` for a match with no moment.
   *
   * `at` is what a person reads and this is what a seek needs, which are two different things:
   * formatting is the caller's and re-parsing "18:04" back into a number here would be the
   * interface deriving data from its own presentation.
   */
  startMs?: number | null;
  /**
   * Where it matched: inside the transcript, or in the recording's own details.
   *
   * The two arrive in one ranked list and are genuinely different things -- a title has no moment
   * in a recording -- so the difference is carried rather than inferred from a missing timestamp.
   */
  kind?: 'transcript' | 'metadata';
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
 *
 * `+N more` opens the recording at its transcript rather than expanding here. That is what the API
 * makes true as well as what reads best: `GET /search` groups the matches and sends the best three
 * with `total_matches` beside them, so the fourth match is not on this screen to be revealed --
 * there is nothing to expand into. And past three the question has stopped being "which recording"
 * and started being "where in it", which is the transcript's screen and not this one.
 *
 * The matched lines are `TranscriptLine`s, the same component the audio detail view uses, so a
 * line reads identically in the two places somebody meets it -- and clicking one seeks, here as
 * there.
 *
 * **A match in the recording's details is drawn as a different thing, not as a broken line**
 * (`UI-16f`). Transcript and metadata matches come back in one ranked list, and a title has no
 * moment in a recording to play from. Given a timestamp column it cannot fill and a play it cannot
 * offer, the honest form is one that says what it is -- a match in the details -- rather than a
 * greyed-out control that looks like the interface failing to load something.
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
  const { t } = useTranslation();
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
          data-app="result-title"
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
        {visible.map((match) =>
          match.kind === 'metadata' || match.startMs === null ? (
            <MetadataMatch key={match.id} match={match} />
          ) : (
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
          ),
        )}
      </div>
      {rest > 0 && (
        <div>
          <Button variant="ghost" onClick={onShowAll}>
            {t('search.more', { count: rest })}
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * A match in the title, the notes or a tag.
 *
 * No timestamp and nothing to press. It keeps the row shape of a transcript line so the ranked
 * list reads as one list, and replaces the timestamp with what it is instead: a label, in the
 * same mono column, saying the match is in the recording's details.
 */
function MetadataMatch({ match }: { match: ResultMatch }) {
  const { t } = useTranslation();
  return (
    <div
      data-app="metadata-match"
      style={{ display: 'flex', gap: 12, padding: '7px 9px', alignItems: 'flex-start' }}
    >
      <span
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          color: 'var(--text-3)',
        }}
      >
        <Icon name="tag" size={13} />
        {t('search.inDetails')}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          lineHeight: 'var(--type-body-leading)',
          color: 'var(--text-2)',
        }}
      >
        {match.text}
      </span>
    </div>
  );
}
