/**
 * The category filter: a popover holding the tree (`UI-8a`, §V3).
 *
 * **A popover and not a rail.** §V3 rejected a permanent left rail for the filters because it
 * drops the card grid from three columns to two at 1280, which is a lot of screen for a family
 * archive to spend on a control nobody is using most of the time. What the popover buys is that a
 * deep tree can exist without owning any width at all -- and it is the only honest form on a
 * phone, where a rail is not an option.
 *
 * **One selectable at a time**, because a recording has at most one category. So these are radios
 * rather than checkboxes, and "Any category" is one of them rather than a Clear button: clearing
 * a filter and choosing "all of them" are the same act, and two controls for it is one too many.
 *
 * The depth is an indent rather than nested lists. A keyboard moving down a tree of `<ul>`s has to
 * escape each one, and what somebody wants from `↓` in a list of categories is the next category.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon, useAnchoredOverlay } from '@/design-system';

import { inDrawnOrder, treeOf } from './categories';
import type { Category } from './recordings';

export interface CategoryPickerProps {
  categories: readonly Category[];
  /** The selected category, or undefined for any. */
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation('library');
  const [open, setOpen] = useState(false);
  const surface = useAnchoredOverlay<HTMLButtonElement>({
    open,
    onClose: () => {
      setOpen(false);
    },
    placement: 'bottom',
    align: 'start',
  });
  // Destructured once rather than read inside the JSX: `react-hooks/refs` is right that reading a
  // ref during render is a bug waiting to happen, and `Profile` takes the same shape for the same
  // reason.
  const { anchorRef, surfaceRef, surfaceStyle, id } = surface;

  const rows = inDrawnOrder(treeOf(categories));
  const selected = rows.find((row) => row.category.id === value)?.category;

  const choose = (id: number | undefined) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="secondary"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {selected?.name ?? t('filters.anyCategory')}
        <Icon name="chevron-down" size={15} />
      </Button>
      {open && (
        <div
          ref={surfaceRef}
          id={id}
          role="radiogroup"
          aria-label={t('filters.category')}
          style={{
            ...surfaceStyle,
            zIndex: 'var(--z-menu)',
            minWidth: 220,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 'var(--space-2)',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-panel)',
            boxShadow: 'var(--elevation-overlay)',
          }}
        >
          <Row
            label={t('filters.anyCategory')}
            depth={0}
            selected={value === undefined}
            onSelect={() => {
              choose(undefined);
            }}
          />
          {rows.map((row) => (
            <Row
              key={row.category.id}
              label={row.category.name}
              depth={row.depth}
              selected={row.category.id === value}
              onSelect={() => {
                choose(row.category.id);
              }}
            />
          ))}
          {rows.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: 'var(--space-3)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                color: 'var(--text-3)',
              }}
            >
              {t('filters.noCategories')}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Row({
  label,
  depth,
  selected,
  onSelect,
}: {
  label: string;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-ds="category-row"
      data-selected={selected ? 'true' : undefined}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minHeight: 34,
        border: 'none',
        borderRadius: 'var(--radius-control)',
        padding: `0 var(--space-3) 0 calc(var(--space-3) + ${String(depth * 14)}px)`,
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 15, flex: '0 0 auto' }}>
        {selected && <Icon name="check" size={15} />}
      </span>
      {label}
    </button>
  );
}
