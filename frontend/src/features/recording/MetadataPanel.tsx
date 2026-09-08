/**
 * V5's metadata panel (`UI-13a`, `UI-13b`, §V5).
 *
 * A 320px column to the right of the transcript, and a caption you are correcting rather than a
 * form you are filling in. That distinction is the whole design: **nothing here has a Save
 * button**, because a panel of eight fields with eight Save buttons is a form, and what somebody
 * is actually doing is fixing a title the transcription got wrong. `InlineField` saves on blur,
 * and `Esc` puts back what was there.
 *
 * **Read-only is a third state, not a disabled field** (§3.5). Below level 20 the values sit on
 * the page under a hairline: no box, no pencil, no greyed-out control. A disabled input reads as
 * broken; text on a page reads as a decision, and the decision was made by whoever shared the
 * library. `InlineField` draws that state itself, which is why it exists rather than being a
 * `TextField` with a flag.
 *
 * **The technical fields are collapsed** (`UI-13d`), because a sample rate is a fact somebody
 * looks up twice a year and everything above it is what they came for.
 *
 * **A category is cleared with `clear_category`, never with a null** (`UI-13c`). In JSON a null
 * and "leave it alone" are the same value, and the endpoint reads them as such -- so the one flag
 * is what makes "no category" expressible at all.
 *
 * **The recorded date is shown with where it came from, and is not edited here** (`UI-13b`). §1.3
 * is the reason it is shown the way it is: `recorded_at` is a wall-clock reading and is rendered
 * exactly as written, never converted, with its offset beside it when one is known. The
 * provenance is quiet and factual -- from inside the file, from its name, or from the file's own
 * date, which **is not the recording's** and says so. Editing it needs a control the design
 * system does not have: a text field over a wall-clock string invites "12 March" and sends it to
 * a column that parses datetimes, and inventing a date picker here would be a component authored
 * inside a view.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { InlineField } from '@/design-system';
import { CategoryPicker } from '@/features/library/CategoryPicker';
import { recordedAt } from '@/i18n/time';

import { TagEditor } from './TagEditor';
import { TechnicalDetails } from './TechnicalDetails';
import type { RecordingContext } from './data';
import { useUpdateRecording } from './metadata';

/** The panel's width, from §V5. The transcript takes everything else. */
export const PANEL_WIDTH = 320;

export function MetadataPanel({ context }: { context: RecordingContext }) {
  const { t, i18n } = useTranslation('recording');
  const recording = context.recording;
  const update = useUpdateRecording(recording?.uuid ?? '', recording?.library_uuid ?? '');

  if (recording === undefined) return null;

  const readOnly = !context.canEdit;
  const when = recordedAt(recording, i18n.language);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <InlineField
        label={t('panel.title')}
        value={recording.title}
        readOnly={readOnly}
        onSave={(title) => {
          // An empty title is not a title. The endpoint refuses one, and offering to send it
          // would be offering to fail.
          if (title.trim() === '') return;
          update.mutate({ title: title.trim() });
        }}
      />
      <InlineField
        label={t('panel.notes')}
        value={recording.notes ?? ''}
        placeholder={t('panel.noNotes')}
        readOnly={readOnly}
        multiline
        onSave={(notes) => {
          // Cleared notes are `null` and not an empty string: the field is absent on the
          // recording, and `""` would be a note somebody wrote that happens to say nothing.
          update.mutate({ notes: notes.trim() === '' ? null : notes });
        }}
      />
      <Recorded
        text={when.text}
        isOwn={when.isOwn}
        provenance={when.provenance}
        offset={when.offset}
      />
      <Field label={t('panel.category')}>
        {readOnly ? (
          <Fact>{context.categoryName ?? t('panel.noCategory')}</Fact>
        ) : (
          <CategoryPicker
            categories={context.categories.all}
            value={recording.category_id ?? undefined}
            placeholder={t('panel.noCategory')}
            // "No category" rather than "Any category": this control files a recording, and a
            // filter's words on an action is how somebody clears a category by accident.
            anyLabel={t('panel.noCategory')}
            onChange={(categoryId) => {
              update.mutate(
                categoryId === undefined ? { clear_category: true } : { category_id: categoryId },
              );
            }}
          />
        )}
      </Field>
      <TagEditor
        value={recording.tags.map((tag) => tag.name)}
        readOnly={readOnly}
        onChange={(names) => {
          update.mutate({ tags: names });
        }}
      />
      <TechnicalDetails recording={recording} />
    </div>
  );
}

/** A labelled row: the 10px mono overline the panel's fields share, and whatever is under it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-overline-size)',
          fontWeight: 'var(--type-overline-weight)',
          letterSpacing: 'var(--type-overline-tracking)',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** A value somebody cannot change: on the page, not in a disabled control (§3.5). */
function Fact({ children }: { children: ReactNode }) {
  return (
    <span
      data-ds="inline-field-static"
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 'var(--field-height)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
      }}
    >
      {children}
    </span>
  );
}

/**
 * When it was recorded, and how the archive knows (`UI-13b`, §1.3).
 *
 * Three sources, weakest last, and the weakest one is the interesting case: a file's modification
 * time is when the file was written, which for a cassette digitised in 2019 is 2019 and not the
 * evening in 1998 that is on the tape. Saying so is the difference between an archive that makes
 * a claim and one that says where its claim came from.
 */
function Recorded({
  text,
  isOwn,
  provenance,
  offset,
}: {
  text: string;
  isOwn: boolean;
  provenance: 'container' | 'filename' | 'filesystem' | null;
  offset: string | null;
}) {
  const { t } = useTranslation('recording');

  return (
    <Field label={t('panel.recorded')}>
      <span
        style={{
          fontFamily: 'var(--type-numeric-family)',
          fontSize: 'var(--type-ui-size)',
          fontVariantNumeric: 'var(--type-numeric-variant)',
          color: 'var(--text)',
        }}
      >
        {text}
        {offset !== null && <span style={{ color: 'var(--text-3)' }}>{` ${offset}`}</span>}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          color: 'var(--text-3)',
        }}
      >
        {isOwn && provenance !== null
          ? t(`common:time.source.${provenance}`)
          : t('panel.dateNotItsOwn')}
      </span>
    </Field>
  );
}
