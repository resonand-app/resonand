/**
 * V3 and V4 · A library (`UI-6a`, §V3, §V4).
 *
 * One route and two densities. The grid and the dense list are not two views: they share the
 * header, the filter bar, the sort, the selection and the URL, and they differ in how a recording
 * is drawn. §V4 is emphatic that the sort is the same sort -- clicking a column heading and
 * changing the bar's control have to be indistinguishable in effect -- and the cheapest way to
 * keep that true is for there to be one component that owns both.
 *
 * **Which density is in the URL** (`UI-4b`), so a dense list is a thing somebody can link to and
 * reload into. The grid is the default, so only `?view=list` is ever written.
 *
 * What arrives in later tasks: the filter bar (`UI-8a`), selection and the bulk bar (`UI-9a`),
 * and the states (`UI-10a`).
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { PAGE_SIZE } from '@/api/paged';
import { useUrlState } from '@/app/url-state';
import { Button, StateCard } from '@/design-system';
import { useAfterPaint } from '@/app/use-after-paint';

import { LibraryFilters } from './LibraryFilters';
import { LibraryHeader } from './LibraryHeader';
import { RecordingGrid } from './RecordingGrid';
import { RecordingList } from './RecordingList';
import { useLibrary } from './data';
import { libraryQuery, useCategories, useRecordings } from './recordings';

export function LibraryView() {
  const { uuid = '' } = useParams();
  const context = useLibrary(uuid);
  const { filters } = useUrlState();
  const categories = useCategories(uuid);
  const painted = useAfterPaint();
  // The grid takes one page; the dense list windows over the whole library and so is handed the
  // filters without a window of their own.
  const recordings = useRecordings(uuid, libraryQuery(filters, { limit: PAGE_SIZE, offset: 0 }));

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} onRetry={context.refetch} />;
  }

  const libraryName = context.library?.name ?? '';

  return (
    <section>
      <LibraryHeader context={context} />
      <LibraryFilters categories={categories.all} />
      {filters.view === 'list' ? (
        <RecordingList
          libraryUuid={uuid}
          categories={categories}
          query={libraryQuery(filters)}
          libraryName={libraryName}
          waveforms={painted}
        />
      ) : (
        <RecordingGrid
          recordings={recordings.items}
          categories={categories}
          libraryName={libraryName}
          waveforms={painted}
        />
      )}
    </section>
  );
}

/**
 * A library that is not there, a library that is not yours, and an instance that never answered.
 *
 * The first two are one state and have to stay one state: the ACL refuses with 404 so that a 403
 * cannot confirm a recording exists (`DEC-14`), which means "it may have been deleted, or it may
 * never have been yours" is the whole of what this screen knows. It must never write "you do not
 * have permission" -- that sentence would give away exactly what the 404 exists to withhold.
 */
function Unavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('library');
  const problem = isApiProblem(error) ? error : undefined;

  if (problem?.isMissing === true) {
    return <StateCard icon="library" title={t('missing.title')} body={t('missing.body')} />;
  }

  const offline = problem?.isUnreachable ?? false;
  return (
    <StateCard
      icon="alert-circle"
      title={offline ? t('unreachable.title') : t('error.title')}
      body={offline ? t('common:state.offline') : (problem?.detail ?? t('error.title'))}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:action.retry')}
        </Button>
      }
    />
  );
}
