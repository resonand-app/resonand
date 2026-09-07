import type { HTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export interface SearchHit {
  /** "recording" shows a transcript excerpt; "library" shows a library. */
  kind?: 'recording' | 'library';
  title: string;
  /** Matching transcript line, or the library's own metadata. */
  excerpt?: string;
  /** Timestamp of the match inside the recording, e.g. "18:04". */
  at?: string;
}

export interface SearchResultsProps extends HTMLAttributes<HTMLDivElement> {
  hits?: SearchHit[];
  /** Total match count, shown on the see-all row. */
  total?: number;
  query?: string;
  onOpen?: (hit: SearchHit) => void;
  onSeeAll?: () => void;
}

/**
 * The quick-hits dropdown beneath the top-nav search field.
 *
 * For the three-second case only: the top few recordings with the matching line and its timestamp.
 * Everything else -- the honest count, the filters, playing from a match without leaving the
 * results -- is the full search view, and the see-all row is the way there.
 */
export function SearchResults({
  hits = [],
  total,
  query = '',
  onOpen,
  onSeeAll,
  style,
  ...rest
}: SearchResultsProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-overlay)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...style,
      }}
      {...rest}
    >
      {hits.map((hit, i) => (
        <button
          type="button"
          key={`${hit.title}-${hit.at ?? String(i)}`}
          onClick={() => onOpen?.(hit)}
          style={{
            border: 'none',
            background: 'transparent',
            borderRadius: 'var(--radius-control)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '8px 10px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
            transition: 'background var(--transition-state)',
          }}
        >
          <Icon
            name={hit.kind === 'library' ? 'library' : 'align-left'}
            size={15}
            color="var(--text-3)"
            style={{ marginTop: 2 }}
          />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 'var(--type-ui-size)',
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hit.title}
            </span>
            <span
              style={{
                fontSize: 'var(--type-ui-size-sm)',
                lineHeight: 'var(--type-body-leading)',
                color: 'var(--text-3)',
              }}
            >
              {hit.excerpt}
            </span>
          </span>
          {hit.at !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--type-numeric-size)',
                color: 'var(--text-3)',
                fontVariantNumeric: 'var(--type-numeric-variant)',
                marginTop: 2,
              }}
            >
              {hit.at}
            </span>
          )}
        </button>
      ))}
      <div style={{ height: 1, background: 'var(--hairline)', margin: '4px 0' }} />
      <button
        type="button"
        onClick={onSeeAll}
        style={{
          border: 'none',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px 4px',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
            flex: 1,
            textAlign: 'left',
          }}
        >
          All {total} results for “{query}”
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-overline-size)',
            color: 'var(--text-3)',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-chip)',
            padding: '2px 6px',
          }}
        >
          ↵
        </span>
      </button>
    </div>
  );
}
