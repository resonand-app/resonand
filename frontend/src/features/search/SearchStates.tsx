/**
 * V6's four states, and the sentence that does real work in one of them (`UI-16g`, §V6, §3.5).
 *
 * **Nothing typed is a state with something to say.** A blank page with a field in it tells
 * somebody nothing about what they can look for, so the resting state names what is searchable --
 * transcripts, titles, notes and tags -- and how big the archive is. On a phone this is the Search
 * tab's resting state, which makes it the first thing somebody sees when they reach for the
 * feature the product exists for.
 *
 * **The recall note is shown, never copied.** `GET /search/about` answers one sentence describing
 * what this index cannot do, and it is an endpoint rather than a constant in the bundle so that
 * the day the index changes the interface stops describing the old behaviour without anybody
 * remembering to edit it. So there is no fallback string here: nothing to show is nothing shown,
 * and a hard-coded sentence beside it would be the second copy that eventually disagrees.
 *
 * **It does its real work in the no-results state.** The honest answer to "why did this find
 * nothing" is often that the search matches the start of the last word and does not know that
 * words are related -- not that the archive lacks the word. Somewhere unobtrusive under the
 * results, and next to the empty answer where it explains it.
 */

import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { Button, CardSkeleton, StateCard } from '@/design-system';
import { count as formatCount } from '@/i18n/format';

import { useRecallNote } from './data';

/** How many skeletons while a search runs. Enough to read as a list, not as a page. */
const SKELETONS = 3;

/** Nothing typed: what can be looked for, and how much there is of it. */
export function NothingTyped({ recordings }: { recordings: number }) {
  const { t } = useTranslation('search');
  return (
    <StateCard
      icon="search"
      dashed
      title={t('states.resting.title')}
      body={t('states.resting.body')}
      footnote={
        recordings === 0
          ? undefined
          : t('states.resting.size', { count: recordings, formatted: formatCount(recordings) })
      }
    />
  );
}

/** Running: the shape of the answer, not a spinner in the middle of the page. */
export function Searching() {
  const { t } = useTranslation('search');
  return (
    <div
      role="status"
      aria-label={t('common:state.loading')}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {Array.from({ length: SKELETONS }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Nothing matched: and the note that may be the actual answer. */
export function NoResults({ query }: { query: string }) {
  const { t } = useTranslation('search');
  return (
    <StateCard
      icon="search"
      title={t('states.none.title', { query })}
      body={t('states.none.body')}
      footnote={<RecallNote />}
    />
  );
}

/** The instance did not answer, or answered with a problem. */
export function SearchFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('search');
  const problem = isApiProblem(error) ? error : undefined;
  const offline = problem?.isUnreachable ?? false;
  return (
    <StateCard
      icon="alert-circle"
      title={offline ? t('states.unreachable') : t('states.failed')}
      body={offline ? t('common:state.offline') : (problem?.detail ?? t('states.failed'))}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:action.retry')}
        </Button>
      }
    />
  );
}

/**
 * What this search cannot do, in the instance's own words.
 *
 * Rendered as whatever the endpoint says and nothing else. Absent while it has not answered,
 * because a note about the index that the index did not write is not a note about the index.
 */
export function RecallNote() {
  const recall = useRecallNote();
  if (recall === undefined) return null;
  return (
    <span
      data-app="recall-note"
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        lineHeight: 'var(--type-body-leading)',
        color: 'var(--text-3)',
        textWrap: 'pretty',
      }}
    >
      {recall}
    </span>
  );
}
