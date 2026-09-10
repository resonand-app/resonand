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
 * **Two columns, and the transcript gets the remaining width** (`UI-11c`). The panel is a fixed
 * 320px and can be folded away, because a 1280px screen reading a three-hour interview is a
 * screen where 320px of metadata is 320px of transcript -- and what somebody folds away stays
 * folded, per device, since it is a property of the screen and not of the account.
 *
 * **On a phone the panel is a bottom sheet** (`UI-13f`), opened from the essentials line. Not a
 * narrowed column and not a section under the transcript: the transcript needs the full width and
 * it is the reason the screen exists, so the details come up over it when they are asked for and
 * are out of the way the rest of the time (`DEC-23`: the phone layout is a different screen).
 *
 * **What stands where the transcript would be depends on the state** (`UI-15`). A recording with
 * one gets the transcript; the other three states get the screen's middle, because a call to
 * action in the place the thing is missing from reads as a screen that knows what it has, and the
 * same words in a corner of the panel read as an aside.
 *
 * **A recording in the trash says so in a band that stays** (`UI-11d`), and that band replaces
 * the read-only line rather than sitting above it: both would be true and only one of them is
 * the reason nothing on the screen can be changed.
 *
 * **Read-only says so once, quietly** (§3.5). One line under the essentials, not a banner and not
 * a lock on every field: the fields draw their own non-editable state and the actions that cannot
 * be taken are absent, so the screen reads as intentional rather than as broken.
 *
 * **Not found says what it knows and no more** (`UI-11e`). The ACL answers 404 for a recording
 * that is not there and for one that was never yours, deliberately, because a 403 would confirm
 * it exists (`DEC-14`). So this screen can say it may have been deleted or may never have been
 * yours, and that the instance does not distinguish the two -- and it must never write "you do
 * not have permission", which is the one sentence that gives away what the 404 withholds.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { transcriptionState } from '@/features/library/recordings';
import { toLibrary } from '@/app/routes';
import {
  Button,
  Icon,
  IconButton,
  PageHeader,
  RowSkeleton,
  Sheet,
  StateCard,
} from '@/design-system';
import { useIsPhone } from '@/app/use-is-phone';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';

import { MetadataPanel, PANEL_WIDTH } from './MetadataPanel';
import { RecordingPlayer } from './RecordingPlayer';
import { Transcript } from './Transcript';
import { TrashedBand } from './TrashedBand';
import { TranscriptionState } from './TranscriptionState';
import { useRecording } from './data';
import type { RecordingContext } from './data';
import { useTranscripts } from './transcripts';
import type { Transcripts } from './transcripts';
import { usePanel } from './use-panel';

export function RecordingView() {
  const { uuid = '' } = useParams();
  const context = useRecording(uuid);
  const transcripts = useTranscripts(uuid);
  const panel = usePanel();
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useTranslation('recording');

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} onRetry={context.refetch} />;
  }
  if (context.recording === undefined) return <Loading />;

  return (
    <article>
      <Whereabouts context={context} />
      <Essentials
        context={context}
        version={transcripts.activeVersion}
        actions={
          isPhone ? (
            // Opened from the essentials line, which is where somebody reading the four facts
            // above it is already looking (§V5).
            <Button
              variant="secondary"
              aria-expanded={sheetOpen}
              onClick={() => {
                setSheetOpen(true);
              }}
            >
              {t('panel.label')}
            </Button>
          ) : (
            <IconButton
              icon="panel-left"
              variant="ghost"
              label={panel.collapsed ? t('panel.show') : t('panel.hide')}
              active={!panel.collapsed}
              aria-expanded={!panel.collapsed}
              onClick={panel.toggle}
            />
          )
        }
      />
      {context.isTrashed && <TrashedBand context={context} />}
      {context.isReadOnly && !context.isTrashed && (
        <p
          style={{
            margin: '0 0 var(--space-6)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {t('readOnly')}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          // `minmax(0, 1fr)` and not `1fr`: a virtualised transcript in a `1fr` track can be
          // pushed wider by its own content, and the column that gives way is the panel.
          gridTemplateColumns:
            isPhone || panel.collapsed
              ? 'minmax(0, 1fr)'
              : `minmax(0, 1fr) ${String(PANEL_WIDTH)}px`,
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <RecordingPlayer context={context} />
          <Middle context={context} transcripts={transcripts} />
        </div>
        {!isPhone && !panel.collapsed && (
          <aside aria-label={t('panel.label')}>
            <MetadataPanel context={context} transcripts={transcripts} />
          </aside>
        )}
      </div>
      {isPhone && (
        <Sheet
          open={sheetOpen}
          title={t('panel.label')}
          onClose={() => {
            setSheetOpen(false);
          }}
        >
          <MetadataPanel context={context} transcripts={transcripts} />
        </Sheet>
      )}
    </article>
  );
}

/**
 * The transcript, or the reason there is not one (`UI-15`, §V5).
 *
 * The state comes from the recording rather than from the transcript request, because those two
 * answer different questions: a 404 from `GET /transcript` means there is no active transcript,
 * and which of the three transcript-less states that is -- never asked for, running, failed -- is
 * on the recording (`transcription_state`).
 */
function Middle({ context, transcripts }: { context: RecordingContext; transcripts: Transcripts }) {
  const { t } = useTranslation('recording');
  const recording = context.recording;
  if (recording === undefined) return null;

  const state = transcriptionState(recording.transcription_state);

  if (state === 'done') {
    if (transcripts.error !== null && transcripts.error !== undefined) {
      return (
        <StateCard
          icon="alert-circle"
          title={t('transcript.failed')}
          body={isApiProblem(transcripts.error) ? transcripts.error.detail : undefined}
          action={
            <Button variant="secondary" onClick={transcripts.refetch}>
              {t('common:action.retry')}
            </Button>
          }
        />
      );
    }
    // Skeleton lines at the transcript's own shape, so nothing jumps when they arrive (§3.5).
    if (transcripts.isPending) {
      return (
        <div aria-hidden>
          {Array.from({ length: 8 }, (_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      );
    }
    return <Transcript context={context} transcripts={transcripts} />;
  }

  return <TranscriptionState context={context} state={state} />;
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
        <Link to={toLibrary(library.uuid)} data-app="breadcrumb-library" data-hit-target>
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
  actions,
}: {
  context: RecordingContext;
  version: number | undefined;
  actions?: ReactNode;
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

  return <PageHeader title={recording.title} meta={meta.join(' · ')} actions={actions} />;
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
