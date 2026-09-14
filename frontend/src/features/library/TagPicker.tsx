/**
 * The tag filter: the chips that are on, and a `+ tag` that suggests more (`UI-8b`, §V3).
 *
 * **The suggestions are already permission-filtered and the interface does not filter again.**
 * `GET /tags` answers only tags on recordings the caller can read, which is what stops a tag name
 * leaking between accounts -- and a second filter here would be a second implementation of an ACL,
 * in the layer least able to enforce one. If a suggestion arrives, it is one this person may see.
 *
 * **A chip is a filter, not a tag on a recording.** Removing one narrows the list less; it never
 * edits anything. The chips are buttons that say so, and the tags themselves are shown verbatim,
 * accents and all (§1.5) -- `field` is a word somebody typed, not a slug.
 *
 * The API matches on a prefix, so the field is a prefix search rather than a fuzzy one. Saying
 * that plainly in the placeholder is cheaper than explaining why "moria" finds nothing.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { Button, Chip, Icon, TextField, useAnchoredOverlay } from '@/design-system';

export interface TagPickerProps {
  /** The tag slugs currently narrowing the list, from the URL. */
  value: string[];
  onChange: (slugs: string[]) => void;
}

/** How many suggestions to offer. A list longer than this is a list nobody reads. */
const SUGGESTIONS = 8;

export function TagPicker({ value, onChange }: TagPickerProps) {
  const { t } = useTranslation('library');
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const surface = useAnchoredOverlay<HTMLButtonElement>({
    open,
    onClose: () => {
      setOpen(false);
      setPrefix('');
    },
    placement: 'bottom',
    align: 'start',
  });
  const { anchorRef, surfaceRef, surfaceStyle, id } = surface;

  const { data } = useQuery({
    queryKey: keys.tags(prefix),
    queryFn: () => get('/api/tags', { query: { prefix, limit: SUGGESTIONS } }),
    enabled: open,
    // Tags change when somebody edits a recording, which is rarely and never while this popover
    // is open. Re-asking on every keystroke's cache miss is enough.
    staleTime: 30_000,
  });

  // Already on: a suggestion for a filter that is already applied is a row that does nothing.
  const suggestions = (data ?? []).filter((one) => !value.includes(one.tag.slug));

  return (
    <>
      {value.map((slug) => (
        <Chip key={slug} active>
          {slug}
          <button
            type="button"
            data-ds="chip-remove"
            aria-label={t('filters.removeTag', { tag: slug })}
            onClick={() => {
              onChange(value.filter((one) => one !== slug));
            }}
            style={{
              display: 'grid',
              placeItems: 'center',
              marginLeft: 4,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={13} />
          </button>
        </Chip>
      ))}
      <Button
        ref={anchorRef}
        variant="ghost"
        icon="tag"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {t('filters.addTag')}
      </Button>
      {open && (
        <div
          ref={surfaceRef}
          id={id}
          style={{
            ...surfaceStyle,
            zIndex: 'var(--z-menu)',
            width: 260,
            padding: 'var(--space-3)',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-panel)',
            boxShadow: 'var(--elevation-overlay)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <TextField
            label={t('filters.tagPrefix')}
            value={prefix}
            onChange={(event) => {
              setPrefix(event.target.value);
            }}
          />
          <ul
            aria-label={t('filters.tagSuggestions')}
            style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 220, overflowY: 'auto' }}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.tag.slug}>
                <button
                  type="button"
                  data-ds="tag-suggestion"
                  onClick={() => {
                    // The slug is what the API filters on, and the name is what a person reads.
                    onChange([...value, suggestion.tag.slug]);
                    setOpen(false);
                    setPrefix('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    width: '100%',
                    minHeight: 34,
                    border: 'none',
                    borderRadius: 'var(--radius-control)',
                    padding: '0 var(--space-3)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--type-ui-size)',
                    cursor: 'pointer',
                  }}
                >
                  <span>{suggestion.tag.name}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--type-numeric-size)',
                      fontVariantNumeric: 'var(--type-numeric-variant)',
                      color: 'var(--text-3)',
                    }}
                  >
                    {suggestion.uses}
                  </span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--type-ui-size-sm)',
                  color: 'var(--text-3)',
                }}
              >
                {t('filters.noTags')}
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
