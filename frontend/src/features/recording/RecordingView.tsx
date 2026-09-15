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
 * **One piece of display type, and it is correctable in place** (`UI-11i`). The title is the
 * view's `PageHeader` title and nothing else on the screen is Chillax. §V5 has it inline-editable
 * as that one element: a recording's title is the subject's own name rather than a label the
 * product chose, and it is most often wrong exactly where it is largest -- a filename nobody
 * looked at, sitting over the waveform of the thing it names. So it is corrected here as well as
 * in the panel (`UI-13a`), both through the same `PATCH /audio/{uuid}`.
 *
 * Two controls on one screen for one field is worth being deliberate about. The panel is where a
 * title is corrected *among the other seven fields*, in a column somebody opened to change
 * things; the header is where it is corrected *because you are looking at it*. Neither is the
 * other's shortcut. The title is still a `string` -- `PageHeader` draws the pencil itself, so
 * `UI-35b` holds exactly as it did.
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
 * **The left column is one scrolling section: the waveform, and the transcript under it**
 * (`UI-11g`). The player is what the screen opens with and the transcript is what the screen is
 * for, and on a laptop the first was taking most of the height the second needed. So it scrolls:
 * the panel fades as it goes, the transcript is left with the whole section, and the bar at the
 * foot of the shell picks the waveform up on the way (`UI-11h`). The column below the player is
 * a full column whatever is in it, so this is the same movement on every recording rather than a
 * thing that only long transcripts can do.
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

import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { isPlainClick } from '@/app/links';
import { transcriptionState } from '@/features/library/recordings';
import { toLibrary } from '@/app/routes';
import {
  Breadcrumb,
  Button,
  IconButton,
  PageHeader,
  RowSkeleton,
  Sheet,
  StateCard,
} from '@/design-system';
import { useIsPhone } from '@/app/hooks/use-is-phone';
import * as format from '@/i18n/format';
import { recordedAt } from '@/i18n/time';

import { MetadataPanel, PANEL_WIDTH } from './MetadataPanel';
import { RecordingPlayer } from './RecordingPlayer';
import { Transcript } from './Transcript';
import { TrashedBand } from './TrashedBand';
import { TranscriptionState } from './TranscriptionState';
import { useRecording } from './data';
import type { RecordingContext } from './data';
import { useUpdateRecording } from './metadata';
import { useTranscripts } from './transcripts';
import type { Transcripts } from './transcripts';
import { usePanel } from './use-panel';

export function RecordingView() {
  const { uuid = '' } = useParams();
  const context = useRecording(uuid);
  const transcripts = useTranscripts(uuid);
  const panel = usePanel();
  const isPhone = useIsPhone();
  const scroller = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useTranslation('recording');

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} onRetry={context.refetch} />;
  }
  if (context.recording === undefined) return <Loading />;

  // The columns scroll, not the page (`UI-11c`). Not on the phone (`DEC-23`): that shell hands
  // down no settled height, and a transcript filling an unsettled one draws every segment -- so
  // there the player keeps its place and the page scrolls under it.
  const fills = !isPhone;

  return (
    <article
      {...(fills ? { 'data-fills': '' } : {})}
      style={
        fills ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined
      }
    >
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
          // `minmax(0, 1fr)` on the row too: an implicit row is sized to its tallest item, so the
          // panel would set the grid's height rather than fit inside it.
          ...(fills
            ? { gridTemplateRows: 'minmax(0, 1fr)', alignItems: 'stretch', flex: 1, minHeight: 0 }
            : { alignItems: 'start' }),
          gap: 'var(--space-6)',
        }}
      >
        <div
          style={{ minWidth: 0, ...(fills ? { display: 'flex', flexDirection: 'column' } : {}) }}
        >
          {/* The player and what is under it are one scrolling section (`UI-11g`): the waveform
              is what the screen opens with, and a scroll puts it away and leaves the transcript
              the whole column. Two scrollports, one inside the other, is a wheel that moves
              whichever of them the pointer happens to be over. */}
          <div
            ref={scroller}
            data-app="recording-scroller"
            style={fills ? { flex: 1, minHeight: 0, overflowY: 'auto' } : undefined}
          >
            <RecordingPlayer context={context} {...(fills ? { scroller } : {})} />
            {/* A full column whatever is in it, so the waveform can always be scrolled away --
                a three-line transcript and a recording with none at all behave like the
                forty-minute one rather than pinning the picture to the screen. */}
            <div style={fills ? { minHeight: '100%' } : undefined}>
              <Middle
                context={context}
                transcripts={transcripts}
                fills={fills}
                {...(fills ? { scroller } : {})}
              />
            </div>
          </div>
        </div>
        {/* A tall panel is not a reason for the player to leave the screen. */}
        {!isPhone && !panel.collapsed && (
          <aside
            aria-label={t('panel.label')}
            style={{
              // The column's own gutter, and it has to be here rather than on the panel: a field
              // draws its focus ring outside its box, so with the fields flush to both edges the
              // ring escaped left over the waveform and was clipped away on the right. It is also
              // what keeps the pencils clear of the scrollbar this column grows when it overflows.
              paddingInline: 'var(--space-2)',
              ...(fills ? { minHeight: 0, overflowY: 'auto', overflowX: 'clip' } : {}),
            }}
          >
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
function Middle({
  context,
  transcripts,
  fills,
  scroller,
}: {
  context: RecordingContext;
  transcripts: Transcripts;
  fills: boolean;
  scroller?: RefObject<HTMLDivElement | null>;
}) {
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
    return (
      <Transcript
        context={context}
        transcripts={transcripts}
        fills={fills}
        {...(scroller === undefined ? {} : { scroller })}
      />
    );
  }

  return <TranscriptionState context={context} state={state} />;
}

/**
 * The library and category it came from, and the way back to them.
 *
 * A link and not a history step: somebody who arrived from a search result has no library behind
 * them to go back to, and "back" on this screen means the library this recording is in.
 *
 * **One way back, not two.** The library's name is the control, with the chevron that says which
 * direction it goes; nothing else on the screen names the same destination again.
 */
function Whereabouts({ context }: { context: RecordingContext }) {
  const { t } = useTranslation('recording');
  const navigate = useNavigate();
  const { library, categoryName } = context;
  if (library === undefined) return null;

  const href = toLibrary(library.uuid);

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <Breadcrumb
        name={library.name}
        href={href}
        detail={categoryName}
        label={t('breadcrumb.label')}
        onNavigate={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          void navigate(href);
        }}
      />
    </div>
  );
}

/**
 * The title, and the four facts under it.
 *
 * The date is the recording's own and is rendered exactly as written (§1.3): a conversation
 * recorded at half six in the evening was recorded at half six in the evening, and converting it
 * to the reader's timezone would make it a different evening for somebody abroad. A recording
 * with no date of its own says so rather than passing the upload's off as the recording's.
 *
 * **The title is corrected here** (`UI-11i`), through the same mutation the panel uses, and only
 * where `canEdit` says so -- which is already false for a recording in the trash, so the band
 * saying it cannot be edited and the title being editable can never disagree (`UI-11d`).
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
  const update = useUpdateRecording(recording?.uuid ?? '', recording?.library_uuid ?? '');
  if (recording === undefined) return null;

  const when = recordedAt(recording, i18n.language);
  const meta = [
    when.isOwn ? when.text : t('common:time.notItsOwn', { date: when.text }),
    format.duration(recording.duration_ms),
    t('essentials.uploadedBy', { name: recording.uploaded_by.display_name }),
    version === undefined ? undefined : t('essentials.version', { version }),
  ].filter((part): part is string => part !== undefined);

  return (
    <PageHeader
      title={recording.title}
      meta={meta.join(' · ')}
      actions={actions}
      {...(context.canEdit
        ? {
            editLabel: t('essentials.editTitle'),
            onTitleSave: (title: string) => {
              // An empty title is not a title. The endpoint refuses one, and offering to send it
              // would be offering to fail.
              if (title.trim() === '') return;
              update.mutate({ title: title.trim() });
            },
          }
        : {})}
    />
  );
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
