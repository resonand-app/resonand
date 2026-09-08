/**
 * The category tree (`UI-17b`, §V7).
 *
 * **Assembled here from the flat list the API sends**, the same way the filter's popover assembles
 * it (`categories.ts`): `id`, `parent_id`, `name`, `position` is the right shape to send and the
 * wrong shape to draw, and having one function build the tree is what keeps the two places it is
 * drawn in agreement.
 *
 * **Five endpoints, five actions, and no "save the tree" button.** Create, rename, re-parent,
 * reorder and delete are separate calls because they are separate things: a single save would mean
 * the interface working out what changed, which is how a reorder silently becomes a re-parent.
 *
 * **Reordering is siblings only**, which is what `ordered_ids` means -- the API refuses a list
 * spanning two parents. So the control is up and down among the categories at the same level, and
 * the whole sibling list is sent in its new order rather than a pair of positions.
 *
 * **A category cannot be moved under its own descendant.** The database would take it and the
 * tree would then have a cycle nobody can draw; the filter's assembler drops such a branch rather
 * than following it, which means the categories would simply disappear. Refusing here is the
 * cheaper half of that pair.
 *
 * **Deleting states its consequence in numbers** (§V7). The foreign key is `ON DELETE SET NULL`,
 * so the recordings lose their category and are not deleted -- and because deleting takes the
 * sub-categories with it, the count is of everything underneath, not just the one row. "Are you
 * sure?" tells nobody anything they did not already know.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { Button, Dialog, IconButton, InlineField, Modal, Select, TextField } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { inDrawnOrder, treeOf } from '@/features/library/categories';
import type { CategoryNode } from '@/features/library/categories';

import type { Category, CategoryEdits } from './data';

export interface CategoryTreeProps {
  uuid: string;
  categories: readonly Category[];
  edits: CategoryEdits;
  /** Level 30. Below it the tree is a list of names and nothing else. */
  canManage: boolean;
}

export function CategoryTree({ uuid, categories, edits, canManage }: CategoryTreeProps) {
  const { t } = useTranslation('librarySettings');
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const rows = inDrawnOrder(treeOf(categories));

  if (rows.length === 0 && !canManage) {
    return <p style={quiet}>{t('categories.none')}</p>;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2 style={heading}>{t('categories.title')}</h2>
      {rows.length === 0 && <p style={quiet}>{t('categories.first')}</p>}
      <ul aria-label={t('categories.title')} style={list}>
        {rows.map((node) => (
          <Row
            key={node.category.id}
            node={node}
            rows={rows}
            categories={categories}
            edits={edits}
            canManage={canManage}
            onDelete={() => {
              setDeleting(node);
            }}
          />
        ))}
      </ul>

      {canManage && (
        <form
          style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}
          onSubmit={(event) => {
            event.preventDefault();
            const name = newName.trim();
            if (name === '') return;
            edits.create.mutate({ name, parentId: null });
            setNewName('');
          }}
        >
          <TextField
            label={t('categories.add')}
            value={newName}
            maxLength={200}
            onChange={(event) => {
              setNewName(event.target.value);
            }}
          />
          <Button variant="secondary" type="submit" disabled={newName.trim() === ''}>
            {t('categories.create')}
          </Button>
        </form>
      )}

      {deleting !== null && (
        <DeleteCategory
          uuid={uuid}
          node={deleting}
          onCancel={() => {
            setDeleting(null);
          }}
          onConfirm={() => {
            edits.destroy.mutate(deleting.category.id);
            setDeleting(null);
          }}
        />
      )}
    </section>
  );
}

/** One category: its name, where it hangs, where it sits among its siblings, and its removal. */
function Row({
  node,
  rows,
  categories,
  edits,
  canManage,
  onDelete,
}: {
  node: CategoryNode;
  rows: readonly CategoryNode[];
  categories: readonly Category[];
  edits: CategoryEdits;
  canManage: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation('librarySettings');
  const { category, depth } = node;
  const siblings = categories
    .filter((one) => one.parent_id === category.parent_id)
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
  const at = siblings.findIndex((one) => one.id === category.id);

  const move = (by: number) => {
    const reordered = [...siblings];
    const [moved] = reordered.splice(at, 1);
    if (moved === undefined) return;
    reordered.splice(at + by, 0, moved);
    edits.reorder.mutate(reordered.map((one) => one.id));
  };

  // Anything that is not this category or below it. A parent inside its own subtree is a cycle,
  // and a cycle is a branch the tree assembler drops -- so the whole subtree would vanish.
  const forbidden = new Set(inDrawnOrder([node]).map((one) => one.category.id));
  const parents: SelectOption[] = [
    { value: '', label: t('categories.atRoot') },
    ...rows
      .filter((one) => !forbidden.has(one.category.id))
      .map((one) => ({ value: String(one.category.id), label: one.category.name })),
  ];

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        paddingLeft: `calc(${String(depth)} * var(--space-5))`,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <InlineField
          value={category.name}
          readOnly={!canManage}
          onSave={(name) => {
            const trimmed = name.trim();
            if (trimmed === '' || trimmed === category.name) return;
            edits.rename.mutate({ id: category.id, name: trimmed });
          }}
        />
      </span>
      {canManage && (
        <>
          <Select
            value={category.parent_id === null ? '' : String(category.parent_id)}
            options={parents}
            ariaLabel={t('categories.parentOf', { name: category.name })}
            width={160}
            onChange={(parent) => {
              edits.reparent.mutate({
                id: category.id,
                parentId: parent === '' ? null : Number(parent),
              });
            }}
          />
          <IconButton
            icon="chevron-up"
            variant="ghost"
            size={32}
            disabled={at <= 0}
            label={t('categories.up', { name: category.name })}
            onClick={() => {
              move(-1);
            }}
          />
          <IconButton
            icon="chevron-down"
            variant="ghost"
            size={32}
            disabled={at < 0 || at >= siblings.length - 1}
            label={t('categories.down', { name: category.name })}
            onClick={() => {
              move(1);
            }}
          />
          <IconButton
            icon="trash-2"
            variant="ghost"
            size={32}
            label={t('categories.remove', { name: category.name })}
            onClick={onDelete}
          />
        </>
      )}
    </li>
  );
}

/**
 * The confirm, with the count in it.
 *
 * The count is asked for when the dialog opens rather than kept beside every row: a number per
 * category on a screen nobody is deleting from is a request per category on every visit, and this
 * is the one moment it matters.
 */
function DeleteCategory({
  uuid,
  node,
  onCancel,
  onConfirm,
}: {
  uuid: string;
  node: CategoryNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('librarySettings');
  const subtree = inDrawnOrder([node]).map((one) => one.category.id);

  const { data: affected } = useQuery({
    queryKey: [...keys.libraryCategories(uuid), 'affected', subtree],
    queryFn: async () => {
      // One `total` per category in the subtree, which is what "and everything under it" means
      // in numbers. `limit: 1` because the count is in the envelope and the rows are not wanted.
      const counts = await Promise.all(
        subtree.map((id) =>
          get('/api/libraries/{library_uuid}/audio', {
            path: { library_uuid: uuid },
            query: { category_id: id, limit: 1 },
          }),
        ),
      );
      return counts.reduce((sum, page) => sum + page.total, 0);
    },
  });

  return (
    <Modal open onClose={onCancel}>
      <Dialog
        title={t('categories.deleteTitle', { name: node.category.name })}
        {...(affected === undefined
          ? {}
          : {
              // Absent until the number has arrived: "0 recordings lose their category",
              // computed from a count that has not come back, is the one thing this must not say.
              description: t(
                subtree.length > 1 ? 'categories.deleteWithChildren' : 'categories.deleteBody',
                { count: affected, children: subtree.length - 1 },
              ),
            })}
        onClose={onCancel}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={onCancel}>
              {t('common:action.cancel')}
            </Button>
            <Button variant="danger" type="button" onClick={onConfirm}>
              {t('categories.deleteConfirm')}
            </Button>
          </>
        }
      />
    </Modal>
  );
}

const heading = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--type-ui-size)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text)',
} as const;

const quiet = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--type-ui-size-sm)',
  color: 'var(--text-3)',
} as const;

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
} as const;
