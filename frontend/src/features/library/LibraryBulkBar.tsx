/**
 * What replaces the filter bar while a selection exists (`UI-9a`, `UI-9b`, `UI-9c`, §V3).
 *
 * A count and never a list of names: it has to survive a selection of two hundred, and two
 * hundred titles is a paragraph where a number belongs. `BulkBar` owns the row -- the same height
 * as `FilterBar`, so nothing moves when the first checkbox is ticked -- and this fills it with the
 * four actions §V3 names. What a run did is reported by `useBulk` in a toast (`UI-46`), which
 * outlives this bar: when everything succeeds nothing stays selected and the filter bar is back.
 *
 * **Every action here is a glyph** (`BulkBar` says why). The four are a category, a tag, a move
 * and the trash, which are the four a person reads off an icon without being told -- and the row
 * has to hold them at 1280 with the sidebar out, beside a count and a select-all that carries a
 * number. The labels are not lost, they are the accessible names. Move and trash use the same two
 * glyphs `RecordingActions` uses for the same two things on one recording, because a person who
 * has learnt them on a recording has learnt them here.
 *
 * **Below `COLLAPSE` the last two fold into an overflow menu**, where they are rows with the same
 * glyphs and their words back. Four icon buttons and a count and a two-step select-all do not fit
 * a phone's row, and a bar that wraps to two lines is one that moves the list somebody is
 * selecting in. Which two fold is not arbitrary: category and tag are the ones a popover and a
 * field hang off, and an overflow row that opens a second overlay is one overlay too many.
 *
 * Move is the one action that opens a dialog, because it has consequences somebody has to have
 * been told about before it happens: it changes who can see the recordings, by name, and it loses
 * their category. `MoveDialog` states all three and hands back a destination; the moving is done
 * here, through the same `useBulk` run as the other three, so a selection where a third of the
 * moves fail reports itself the way the rest of this bar does (`UI-19b`, `UI-9c`).
 *
 * **Move and trash need Can manage** (`DEC-27`), so a library somebody only edits gets the first
 * two and no overflow menu at all: a menu holding nothing they may do is a door to a refusal.
 *
 * **The heart is first, and it is there for anybody who can read** (`UI-42`): a favourite is the
 * caller's own mark and asks nothing of the recordings, so a library shared read-only gets a
 * selection with the two favourite actions in it and nothing else. Two rather than one toggle,
 * because a selection that is partly marked has to be able to go either way in one press.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useNarrowerThan } from '@/app/hooks/use-narrower-than';
import { BulkBar } from '@/components/BulkBar';
import { MoveDialog } from '@/components/MoveDialog';
import { Button, IconButton, Menu, TextField } from '@/design-system';

import { CategoryPicker } from './CategoryPicker';
import type { Category, Recording } from './recordings';
import type { Bulk } from './use-bulk';

/**
 * Where the bar stops holding its four actions and grows an overflow menu instead.
 *
 * Measured rather than chosen. Expanded, the row needs 437px: 16 for the checkbox, 66 for the
 * count, 91 for select-all, 192 for the five controls, and the gaps and padding between them. It
 * wraps at a bar 436px wide and fits at 456. The threshold is the viewport that leaves room for
 * the two labels that grow -- "200 selected" over "1 selected", and "Select all 812" over "Select
 * all", together about 54px -- which no archive small enough to develop against will show.
 *
 * It is deliberately not `--breakpoint-phone`, which answers a different question -- which shell
 * is drawn -- and is 720, where all four still fit with room to spare.
 */
const COLLAPSE = 560;

export interface LibraryBulkBarProps {
  count: number;
  allSelected: boolean | 'mixed';
  onSelectAll: (selected: boolean) => void;
  onClear: () => void;
  /** How many recordings the filter matches, which is what the second select-all step names. */
  matching: number;
  /** Select every recording the filter matches, and not only the page that has been fetched. */
  onSelectEverything: () => void;
  /** The recordings selected, which "add a tag" needs in full to avoid replacing what is there. */
  selected: readonly Recording[];
  /**
   * The tree a category is picked from. Absent where the selection spans libraries, because a
   * category belongs to one library and means nothing in the next (`UI-44`).
   */
  categories?: readonly Category[] | undefined;
  /** Whether the caller edits everything selected, which a category and a tag need. */
  canEdit: boolean;
  /**
   * Whether the caller manages everything selected, and so may move it out (`DEC-27`). The view
   * also asks that it all sit in one library: the move dialog names who gains and loses access
   * against the library the recordings are leaving.
   */
  canMove: boolean;
  /** Whether the caller manages everything selected, which sending it to the trash needs. */
  canTrash: boolean;
  bulk: Bulk;
}

export function LibraryBulkBar({
  count,
  allSelected,
  onSelectAll,
  onClear,
  matching,
  onSelectEverything,
  selected,
  categories,
  canEdit,
  canMove,
  canTrash,
  bulk,
}: LibraryBulkBarProps) {
  const { t } = useTranslation('library');
  const [tagging, setTagging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [tag, setTag] = useState('');
  const collapsed = useNarrowerThan(COLLAPSE);
  const uuids = selected.map((one) => one.uuid);

  return (
    <>
      <BulkBar
        count={count}
        allSelected={allSelected}
        onSelectAll={onSelectAll}
        onClear={onClear}
        matching={matching}
        onSelectEverything={onSelectEverything}
        actions={
          bulk.running === null ? (
            <>
              <IconButton
                icon="heart"
                label={t('bulk.favourite')}
                onClick={() => {
                  void bulk.favourite(uuids, true);
                }}
              />
              <IconButton
                icon="heart-off"
                label={t('bulk.unfavourite')}
                onClick={() => {
                  void bulk.favourite(uuids, false);
                }}
              />
              {canEdit && categories !== undefined && (
                <CategoryPicker
                  categories={categories}
                  value={undefined}
                  compact
                  // Not "Any category": in the bulk bar this control does something rather than
                  // narrowing something, and a filter's words on an action is how somebody assigns
                  // a category by accident while trying to clear a filter.
                  placeholder={t('bulk.category')}
                  onChange={(categoryId) => {
                    const category = categories.find((one) => one.id === categoryId);
                    void bulk.assignCategory(uuids, category ?? null);
                  }}
                />
              )}
              {canEdit && (
                <IconButton
                  icon="tag"
                  label={t('bulk.addTag')}
                  aria-expanded={tagging}
                  onClick={() => {
                    setTagging(true);
                  }}
                />
              )}
              {!canMove && !canTrash ? null : collapsed ? (
                <Menu
                  label={t('bulk.more')}
                  items={[
                    ...(canMove
                      ? [{ id: 'move', label: t('bulk.move'), icon: 'folder-input' as const }]
                      : []),
                    ...(canTrash
                      ? [
                          {
                            id: 'trash',
                            label: t('bulk.trash'),
                            icon: 'trash-2' as const,
                            destructive: true,
                            separated: canMove,
                          },
                        ]
                      : []),
                  ]}
                  onSelect={(id) => {
                    if (id === 'move') setMoving(true);
                    if (id === 'trash') void bulk.trash(uuids);
                  }}
                />
              ) : (
                <>
                  {canMove && (
                    <IconButton
                      icon="folder-input"
                      label={t('bulk.move')}
                      onClick={() => {
                        setMoving(true);
                      }}
                    />
                  )}
                  {canTrash && (
                    <IconButton
                      icon="trash-2"
                      label={t('bulk.trash')}
                      onClick={() => {
                        void bulk.trash(uuids);
                      }}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--type-numeric-size)',
                fontVariantNumeric: 'var(--type-numeric-variant)',
                color: 'var(--text-3)',
              }}
            >
              {/* A count and not a bar: there is no percentage to be had from N requests until
                  they answer, and one that jumped in tenths would be a fiction. */}
              {t('bulk.running', {
                done: bulk.running.done,
                total: bulk.running.total,
              })}
            </span>
          )
        }
      />
      {moving && (
        <MoveDialog
          recordings={selected}
          categoryName={(id) => categories?.find((one) => one.id === id)?.name}
          onClose={() => {
            setMoving(false);
          }}
          onConfirm={(destination) => {
            setMoving(false);
            void bulk.move(uuids, destination);
          }}
        />
      )}
      {tagging && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <TextField
            label={t('bulk.tagName')}
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
            }}
          />
          <Button
            variant="primary"
            disabled={tag.trim() === ''}
            onClick={() => {
              const name = tag.trim();
              setTag('');
              setTagging(false);
              void bulk.addTag(selected, name);
            }}
          >
            {t('bulk.apply')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTagging(false);
              setTag('');
            }}
          >
            {t('common:action.cancel')}
          </Button>
        </div>
      )}
    </>
  );
}
