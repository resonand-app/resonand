/**
 * V7 · Library settings and sharing (`UI-17a`, §V7).
 *
 * Three things in one screen, in the order somebody needs them: what the library is called, how it
 * is organised, and who can see it. The last one is where the product's first hard promise is kept
 * or broken -- nothing is shared until you share it -- which is why it is a panel of its own
 * rather than a row of controls.
 *
 * **Identity saves on blur, like the metadata panel** (`UI-34l`). A settings screen with a Save
 * button at the bottom is a screen somebody leaves without pressing it; a name being corrected is
 * the same act as a title being corrected in V5, and it reads the same way.
 *
 * **Recolouring reaches the sidebar immediately** (§V7). The colour is how a library is found in a
 * list of seven, so a swatch that needed a reload would feel like it had not worked.
 *
 * **Trashing it is the last thing on the screen, and it is not permanent** (`UI-17f`). Deletion is
 * a `deleted_at` and never a cascade: nothing inside is touched, which is what makes restoring it
 * one line. So the confirm is an ordinary dialog with a danger button rather than `TypedConfirm` --
 * that gesture means "this cannot be undone", and spending it on something recoverable is how it
 * stops meaning anything the day it is needed. What the confirm owes is the count and the window:
 * how many recordings go with it, and for how long it can come back.
 *
 * **A library you can only edit is not a settings screen, and the route says so.** Level 30 is
 * what this needs, and below it the screen is one card and a way back rather than a form whose
 * every field is read-only -- which is what it was, and which read as a permissions bug rather
 * than as a decision. This is a narrowing of `UI-17e`, whose read-only sharing panel is gone with
 * it: who else has access is still on the library's own header, in the avatar stack.
 *
 * **It does not borrow the 404's wording.** `DEC-14`'s "it may never have been yours" exists so
 * that a refusal cannot confirm a library exists -- and somebody who reached this screen is
 * already looking at the library in their sidebar, so that sentence would withhold nothing and
 * claim something untrue.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { colourOf, useCanTrashLibrary } from '@/app/library-data';
import { isPlainClick } from '@/app/links';
import { toLibrary } from '@/app/routes';
import {
  Breadcrumb,
  Button,
  ColorSwatchPicker,
  InlineField,
  PageHeader,
  StateCard,
} from '@/design-system';
import { useLibrary } from '@/features/library/data';
import { useCategories } from '@/features/library/recordings';

import { CategoryTree } from './CategoryTree';
import { SharePanel } from './SharePanel';
import { TrashLibrary } from './TrashLibrary';
import { useCategoryEdits, useShareEdits, useUpdateLibrary } from './data';

export function LibrarySettingsView() {
  const { t } = useTranslation('librarySettings');
  const navigate = useNavigate();
  const { uuid = '' } = useParams();
  const context = useLibrary(uuid);
  const update = useUpdateLibrary(uuid);
  const categories = useCategories(uuid);
  const categoryEdits = useCategoryEdits(uuid);
  const shareEdits = useShareEdits(uuid);
  const library = context.library;
  const canTrash = useCanTrashLibrary(library);

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} />;
  }
  if (library === undefined) return null;

  const href = toLibrary(uuid);

  if (!context.canManage) {
    return (
      <NotYours
        onBack={() => {
          void navigate(href);
        }}
      />
    );
  }

  return (
    <section>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Breadcrumb
          name={library.name}
          href={href}
          label={t('breadcrumb.label')}
          onNavigate={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            void navigate(href);
          }}
        />
      </div>
      <PageHeader
        title={library.name}
        before={
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              flex: '0 0 auto',
              borderRadius: 'var(--radius-chip)',
              background: colourOf(library.colour),
            }}
          />
        }
        meta={t('title')}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
          maxWidth: 640,
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <InlineField
            label={t('identity.name')}
            value={library.name}
            onSave={(name) => {
              const trimmed = name.trim();
              if (trimmed === '' || trimmed === library.name) return;
              update.mutate({ name: trimmed });
            }}
          />
          <InlineField
            label={t('identity.description')}
            value={library.description ?? ''}
            placeholder={t('identity.noDescription')}
            multiline
            onSave={(description) => {
              const trimmed = description.trim();
              if (trimmed === (library.description ?? '')) return;
              update.mutate({ description: trimmed === '' ? null : trimmed });
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <ColorSwatchPicker
              label={t('identity.colour')}
              value={library.colour}
              onChange={(colour) => {
                update.mutate({ colour });
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                color: 'var(--text-3)',
              }}
            >
              {t('identity.colourReaches')}
            </span>
          </div>
        </section>

        <CategoryTree uuid={uuid} categories={categories.all} edits={categoryEdits} canManage />

        <SharePanel library={library} shares={context.shares} edits={shareEdits} canManage />

        {/* An account's last library cannot be deleted, and the affordance is absent rather than
            disabled: the API refuses it, and a button that always fails is worse than none. */}
        {canTrash && <TrashLibrary library={library} />}
      </div>
    </section>
  );
}

/**
 * A library shared below level 30, which has settings but not yours to change.
 *
 * A state of its own and not the 404 above it: the library is real, it is in the sidebar, and it
 * opens. What is refused is this screen, and saying which level it takes is what makes the refusal
 * something somebody can act on -- by asking whoever owns it.
 */
function NotYours({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('librarySettings');
  return (
    <StateCard
      icon="library"
      title={t('notYours.title')}
      body={t('notYours.body')}
      action={
        <Button variant="secondary" onClick={onBack}>
          {t('notYours.back')}
        </Button>
      }
    />
  );
}

/**
 * A library that is not there, and one that is not yours.
 *
 * One state, and it has to stay one: the ACL answers 404 rather than 403 so that a refusal cannot
 * confirm a library exists, which means "it may have been deleted, or it may never have been
 * yours" is the whole of what this screen knows.
 */
function Unavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('librarySettings');
  const problem = isApiProblem(error) ? error : undefined;
  return (
    <StateCard
      icon={problem?.isMissing === true ? 'library' : 'alert-circle'}
      title={t(problem?.isMissing === true ? 'missing.title' : 'error.title')}
      body={problem?.isMissing === true ? t('missing.body') : problem?.detail}
    />
  );
}
