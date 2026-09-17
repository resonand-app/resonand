/**
 * What replaces the filter bar while a selection exists (`UI-9a`, `UI-9b`, `UI-9c`, §V3).
 *
 * A count and never a list of names: it has to survive a selection of two hundred, and two
 * hundred titles is a paragraph where a number belongs. `BulkBar` owns the row -- the same height
 * as `FilterBar`, so nothing moves when the first checkbox is ticked -- and this fills it with the
 * four actions §V3 names, plus the report that follows a run.
 *
 * **The report is a designed state, not an error** (§3.5). Every action here is one request per
 * recording, so some succeeding and some failing is the ordinary case at two hundred. It says
 * what moved and what did not, groups the reasons rather than listing two hundred identical
 * lines, and leaves the failures selected so a retry is one click.
 *
 * **`BulkReport` is exported and rendered by the view rather than by this bar**, because it has to
 * outlive the selection: when everything succeeds nothing stays selected, this bar is replaced by
 * the filter bar, and a report nested inside it would vanish at exactly the moment it had good
 * news. That was a real bug and a test caught it.
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
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useNarrowerThan } from '@/app/hooks/use-narrower-than';
import { BulkBar } from '@/components/BulkBar';
import { MoveDialog } from '@/components/MoveDialog';
import { Button, IconButton, Menu, StateCard, TextField } from '@/design-system';

import { CategoryPicker } from './CategoryPicker';
import { reasonsIn } from './bulk';
import type { Outcome } from './bulk';
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
  categories: readonly Category[];
  bulk: Bulk;
  /** After a run: keep only these selected, which is what did not succeed (`UI-9c`). */
  onOutcome: (outcome: Outcome) => void;
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
  bulk,
  onOutcome,
}: LibraryBulkBarProps) {
  const { t } = useTranslation('library');
  const [tagging, setTagging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [tag, setTag] = useState('');
  const collapsed = useNarrowerThan(COLLAPSE);
  const uuids = selected.map((one) => one.uuid);

  const after = (outcome: Outcome) => {
    onOutcome(outcome);
  };

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
              <CategoryPicker
                categories={categories}
                value={undefined}
                compact
                // Not "Any category": in the bulk bar this control does something rather than
                // narrowing something, and a filter's words on an action is how somebody assigns
                // a category by accident while trying to clear a filter.
                placeholder={t('bulk.category')}
                onChange={(categoryId) => {
                  void bulk.assignCategory(uuids, categoryId ?? null).then(after);
                }}
              />
              <IconButton
                icon="tag"
                label={t('bulk.addTag')}
                aria-expanded={tagging}
                onClick={() => {
                  setTagging(true);
                }}
              />
              {collapsed ? (
                <Menu
                  label={t('bulk.more')}
                  items={[
                    { id: 'move', label: t('bulk.move'), icon: 'folder-input' },
                    {
                      id: 'trash',
                      label: t('bulk.trash'),
                      icon: 'trash-2',
                      destructive: true,
                      separated: true,
                    },
                  ]}
                  onSelect={(id) => {
                    if (id === 'move') setMoving(true);
                    if (id === 'trash') void bulk.trash(uuids).then(after);
                  }}
                />
              ) : (
                <>
                  <IconButton
                    icon="folder-input"
                    label={t('bulk.move')}
                    onClick={() => {
                      setMoving(true);
                    }}
                  />
                  <IconButton
                    icon="trash-2"
                    label={t('bulk.trash')}
                    onClick={() => {
                      void bulk.trash(uuids).then(after);
                    }}
                  />
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
          categoryName={(id) => categories.find((one) => one.id === id)?.name}
          onClose={() => {
            setMoving(false);
          }}
          onConfirm={(destination) => {
            setMoving(false);
            void bulk.move(uuids, destination).then(after);
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
              void bulk.addTag(selected, name).then(after);
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

/**
 * What a run did, per §3.5's partial-failure state.
 *
 * The successes are a number and the failures are their reasons, grouped: two hundred failures
 * with one cause is one thing to fix, and two hundred identical lines is a wall somebody scrolls
 * past. Retry acts on what is still selected, which is exactly what failed.
 */
export function BulkReport({ bulk }: { bulk: Bulk }) {
  const { t } = useTranslation('library');
  const outcome = bulk.outcome;
  if (outcome === null) return null;

  const failed = outcome.failed.length;
  const done = outcome.succeeded.length;

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <StateCard
        icon={failed === 0 ? 'check' : 'alert-circle'}
        title={
          failed === 0
            ? t(`bulk.allDone.${outcome.kind}`, { count: done })
            : t('bulk.partial', { done, failed })
        }
        body={
          failed === 0 ? undefined : (
            <span>
              {reasonsIn(outcome.failed).map((reason) => (
                <span key={reason.detail} style={{ display: 'block' }}>
                  {t('bulk.reason', { count: reason.count, detail: reason.detail })}
                </span>
              ))}
            </span>
          )
        }
        action={
          <Button variant="secondary" onClick={bulk.dismiss}>
            {t('bulk.dismiss')}
          </Button>
        }
        {...(failed === 0 ? {} : { footnote: t('bulk.stillSelected', { count: failed }) })}
      />
    </div>
  );
}
