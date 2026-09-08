/**
 * V5 · Audio detail (`UI-11a`, `UI-11e`, §V5).
 *
 * The most important single screen in the product: the one where somebody listens to a recording
 * and reads what was said. Everything on it is arranged around that, which is why the structure
 * is worth stating before the components arrive.
 *
 * **Where you are, then what it is.** The breadcrumb names the library and the category the
 * recording came from and offers the way back, because a recording reached from a search result
 * is otherwise a screen with no context at all -- `library_uuid` and `category_id` are ids on the
 * wire and names to a person, and `data.ts` is where they become names.
 *
 * **One piece of display type.** The title is the view's `PageHeader` title and nothing else on
 * the screen is Chillax. It is not editable here: `PageHeader` takes a string on purpose
 * (`UI-35b`), and the place a title is corrected is the metadata panel, where the other seven
 * fields are corrected the same way (`UI-13a`).
 *
 * **The essentials line is four facts and no more.** The recording's own date, how long it runs,
 * who uploaded it, and which transcript version is active. §V5 lists exactly those, and a field a
 * design promises that the API cannot fill is a promise somebody has to break.
 *
 * **Not found says what it knows and no more** (`UI-11e`). The ACL answers 404 for a recording
 * that is not there and for one that was never yours, deliberately, because a 403 would confirm
 * it exists (`DEC-14`). So this screen can say it may have been deleted or may never have been
 * yours, and that the instance does not distinguish the two -- and it must never write "you do
 * not have permission", which is the one sentence that gives away what the 404 withholds.
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { toLibrary } from '@/app/routes';
import { Button, Icon, PageHeader, StateCard } from '@/design-system';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';

import { RecordingPlayer } from './RecordingPlayer';
import { useRecording } from './data';
import type { RecordingContext } from './data';
import { useTranscripts } from './transcripts';

export function RecordingView() {
  const { uuid = '' } = useParams();
  const context = useRecording(uuid);
  const transcripts = useTranscripts(uuid);

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} onRetry={context.refetch} />;
  }
  if (context.recording === undefined) return <Loading />;

  return (
    <article>
      <Whereabouts context={context} />
      <Essentials context={context} version={transcripts.activeVersion} />
      <RecordingPlayer context={context} />
    </article>
  );
}

/**
 * The library and category it came from, and the way back to them.
 *
 * A link and not a history step: somebody who arrived from a search result has no library behind
 * them to go back to, and "back" on this screen means the library this recording is in.
 */
function Whereabouts({ context }: { context: RecordingContext }) {
  const { t } = useTranslation('recording');
  const { library, categoryName } = context;
  if (library === undefined) return null;

  return (
    <nav
      aria-label={t('breadcrumb.label')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          minWidth: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
        }}
      >
        <Link to={toLibrary(library.uuid)} data-app="breadcrumb-library">
          {library.name}
        </Link>
        {categoryName !== undefined && (
          <>
            <span aria-hidden>/</span>
            <span>{categoryName}</span>
          </>
        )}
      </span>
      <Link to={toLibrary(library.uuid)} data-app="breadcrumb-back" data-hit-target="">
        <Icon name="chevron-left" size={16} />
        {t('breadcrumb.back', { library: library.name })}
      </Link>
    </nav>
  );
}

/**
 * The title, and the four facts under it.
 *
 * The date is the recording's own and is rendered exactly as written (§1.3): a conversation
 * recorded at half six in the evening was recorded at half six in the evening, and converting it
 * to the reader's timezone would make it a different evening for somebody abroad. A recording
 * with no date of its own says so rather than passing the upload's off as the recording's.
 */
function Essentials({
  context,
  version,
}: {
  context: RecordingContext;
  version: number | undefined;
}) {
  const { t, i18n } = useTranslation('recording');
  const recording = context.recording;
  if (recording === undefined) return null;

  const when = recordedAt(recording, i18n.language);
  const meta = [
    when.isOwn ? when.text : t('common:time.notItsOwn', { date: when.text }),
    format.duration(recording.duration_ms),
    t('essentials.uploadedBy', { name: recording.uploaded_by.display_name }),
    version === undefined ? undefined : t('essentials.version', { version }),
  ].filter((part): part is string => part !== undefined);

  return <PageHeader title={recording.title} meta={meta.join(' · ')} />;
}

/** The page knows its own shape, so it says so while it waits (§3.5). */
function Loading() {
  const { t } = useTranslation('recording');
  return <StateCard title={t('common:state.loading')} />;
}

/**
 * A recording that is not there, one that was never yours, and an instance that never answered.
 *
 * The first two are **one state and have to stay one state**. The ACL refuses both with 404 so
 * that a 403 cannot confirm a recording exists (`DEC-14`), and the honest thing to say is that
 * the instance does not distinguish them. "You do not have permission" would be the sentence
 * that undoes the whole arrangement.
 */
function Unavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('recording');
  const problem = isApiProblem(error) ? error : undefined;

  if (problem?.isMissing === true) {
    return (
      <StateCard
        icon="circle-dashed"
        title={t('missing.title')}
        body={t('missing.body')}
        footnote={t('missing.footnote')}
      />
    );
  }

  const offline = problem?.isUnreachable ?? false;
  return (
    <StateCard
      icon="alert-circle"
      title={offline ? t('unreachable.title') : t('failed.title')}
      body={offline ? t('common:state.offline') : (problem?.detail ?? t('failed.title'))}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:action.retry')}
        </Button>
      }
    />
  );
}
