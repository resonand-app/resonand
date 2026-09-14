/**
 * The tags on one recording, added and removed (`UI-13c`, §V5).
 *
 * Deliberately not `TagPicker`, which is V3's filter. That one deals in **slugs**, because a slug
 * is what `GET /libraries/{uuid}/audio` filters on, and removing one of its chips narrows a list
 * less. This one deals in **names**, because a name is what `PATCH /audio/{uuid}` writes and what
 * a person reads, and removing one of these chips changes the recording. Two components with one
 * shape and two vocabularies is better than one component that takes a flag saying which of two
 * things it is editing.
 *
 * **The canonical name wins over the typed one.** The backend normalises a tag to match it and
 * the first writer owns its display name, so if `field` already exists, somebody typing
 * `Memoria` gets the tag that is already there under the spelling it already has. Otherwise
 * `Interview` and `field` are one tag whose displayed name is whichever spelling was saved last,
 * which is a name that changes under people who did not touch it.
 *
 * **A tag nobody has used yet is still allowed.** The suggestions are what exists; the field is
 * not a picker. Somebody naming a new tag owns its spelling, which is the same rule from the
 * other side.
 *
 * **`PATCH` replaces the whole list**, so every change sends every tag the recording has. That is
 * the endpoint's shape and not an accident to work around: it is why the bulk "add a tag" action
 * has to read each recording first (`use-bulk.ts`), and why this component is given the tags
 * rather than fetching them.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { Button, Chip, Icon, TextField, useAnchoredOverlay } from '@/design-system';

import { sameTag } from './tag-names';

/** How many suggestions to offer. A list longer than this is a list nobody reads. */
const SUGGESTIONS = 8;

export interface TagEditorProps {
  /** The tag names on this recording, as the API sent them. */
  value: readonly string[];
  /** The whole list, because the endpoint replaces it. */
  onChange: (names: string[]) => void;
  /** Below level 20 the tags are facts rather than controls (§3.5). */
  readOnly?: boolean;
}

export function TagEditor({ value, onChange, readOnly = false }: TagEditorProps) {
  const { t } = useTranslation('recording');
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const surface = useAnchoredOverlay<HTMLButtonElement>({
    open,
    onClose: () => {
      setOpen(false);
      setTyped('');
    },
    placement: 'bottom',
    align: 'start',
  });
  const { anchorRef, surfaceRef, surfaceStyle, id } = surface;

  const { data } = useQuery({
    queryKey: keys.tags(typed),
    queryFn: () => get('/api/tags', { query: { prefix: typed, limit: SUGGESTIONS } }),
    enabled: open,
    staleTime: 30_000,
  });

  const suggestions = (data ?? []).filter((one) => !value.includes(one.tag.name));

  const add = (name: string) => {
    const cleaned = name.trim();
    if (cleaned === '') return;
    // The spelling that already exists beats the one just typed.
    const known = (data ?? []).find((one) => sameTag(cleaned, one.tag.name))?.tag.name;
    const canonical = known ?? cleaned;
    if (!value.includes(canonical)) onChange([...value, canonical]);
    setOpen(false);
    setTyped('');
  };

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
        {t('panel.tags')}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', minHeight: 30 }}>
        {value.map((name) => (
          <Chip key={name}>
            {name}
            {!readOnly && (
              <button
                type="button"
                data-ds="chip-remove"
                aria-label={t('panel.removeTag', { tag: name })}
                onClick={() => {
                  onChange(value.filter((one) => one !== name));
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
            )}
          </Chip>
        ))}
        {value.length === 0 && readOnly && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {t('panel.noTags')}
          </span>
        )}
        {!readOnly && (
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
            {t('panel.addTag')}
          </Button>
        )}
      </div>
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
            label={t('panel.tagName')}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              add(typed);
            }}
          />
          <ul
            aria-label={t('panel.tagSuggestions')}
            style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 220, overflowY: 'auto' }}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.tag.slug}>
                <button
                  type="button"
                  data-ds="tag-suggestion"
                  onClick={() => {
                    add(suggestion.tag.name);
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
            {suggestions.length === 0 && typed.trim() !== '' && (
              <li
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--type-ui-size-sm)',
                  color: 'var(--text-3)',
                }}
              >
                {t('panel.newTag', { tag: typed.trim() })}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
