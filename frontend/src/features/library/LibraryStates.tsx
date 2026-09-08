/**
 * V3 and V4's states (`UI-10a`, `UI-10b`, §3.5).
 *
 * **The two empty states are different screens and have to stay different.** §3.5 calls confusing
 * them the classic mistake, and it is worth spelling out why: "nothing uploaded yet" is a new
 * library and the way out is to add something; "the filter matched nothing" is a mistyped tag and
 * the way out is to undo it. A single "No recordings" serves neither -- the person with the empty
 * library reads it as broken, and the person with the filter reads it as an empty library.
 *
 * So the filtered one **names the filter and offers to clear it, and says how many recordings are
 * actually there** -- because the useful fact is that the library is not empty, only hidden.
 */

import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import type { Filters } from '@/app/url-state';
import { Button, CardSkeleton, RowSkeleton, StateCard } from '@/design-system';

export interface EmptyProps {
  /** How many recordings the library holds regardless of the filter. */
  total: number;
  filters: Filters;
  onClear: () => void;
  /** Whether anything can be added here, which decides whether the invitation has an action. */
  canEdit: boolean;
}

/** Nothing uploaded yet: an invitation, never a sad drawing. */
export function NothingYet({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation('library');
  return (
    <StateCard
      icon="upload"
      dashed
      title={t('empty.nothing.title')}
      body={canEdit ? t('empty.nothing.body') : t('empty.nothing.readOnly')}
    />
  );
}

/**
 * The filter matched nothing: recoverable, and it says so.
 *
 * It names what is on rather than saying "your filters", because somebody who set a tag three
 * screens ago has forgotten which one -- and naming it is what turns a dead end into one click.
 */
export function NothingMatched({ total, filters, onClear }: Omit<EmptyProps, 'canEdit'>) {
  const { t } = useTranslation('library');
  const named = [
    filters.categoryId === undefined ? undefined : t('empty.matched.category'),
    ...filters.tags.map((tag) => `#${tag}`),
    ...filters.states.map((state) => t(`common:transcription.${state}`)),
  ].filter((one): one is string => one !== undefined);

  return (
    <StateCard
      icon="search"
      title={t('empty.matched.title')}
      body={t('empty.matched.body', { filters: named.join(', ') })}
      action={
        <Button variant="secondary" onClick={onClear}>
          {t('empty.matched.clear')}
        </Button>
      }
      footnote={t('empty.matched.total', { count: total })}
    />
  );
}

/** Skeletons at the density that is on screen, so nothing jumps when the recordings arrive. */
export function Loading({ dense }: { dense: boolean }) {
  if (dense) {
    return (
      <div aria-hidden>
        {Array.from({ length: 12 }, (_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-width), 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * The recordings could not be listed.
 *
 * **What is already buffered keeps playing** (§3.5), which is not a thing this component does but
 * a thing it must not undo: the player lives in the shell, outside the routes, and nothing here
 * touches it. Saying so is the point -- an error state that unmounted the player would be an
 * error state that stopped the music.
 */
export function ListFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('library');
  const problem = isApiProblem(error) ? error : undefined;
  const offline = problem?.isUnreachable ?? false;

  return (
    <StateCard
      icon="alert-circle"
      title={offline ? t('unreachable.title') : t('empty.failed.title')}
      body={offline ? t('common:state.offline') : (problem?.detail ?? t('empty.failed.title'))}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:action.retry')}
        </Button>
      }
    />
  );
}
