import type { ReactNode } from 'react';

export interface KeyValueRow {
  /** The 10px mono overline: SAMPLE RATE, CHANNELS, PROVIDER. Uppercased here. */
  key: string;
  /** The fact. Mono where it is comparable to another number, which is most of them. */
  value: ReactNode;
}

export interface KeyValueListProps {
  rows: KeyValueRow[];
  /**
   * `stacked` puts the key above the value, which is what a narrow panel and a phone sheet need.
   * `inline` puts them on one row with the value right-aligned, for the provider card and system
   * status.
   */
  layout?: 'stacked' | 'inline';
}

/**
 * The mono key/value rows: technical metadata, the provider card, system status (`UI-35e`).
 *
 * Three places in the product show facts that are compared with other facts -- a sample rate
 * against another recording's, a version against the one in the release notes, a duration against
 * a limit -- and the type rule is that anything comparable to another number is mono and tabular.
 * This is that rule, as a component, so the three do not drift into three shapes.
 *
 * The value takes a node rather than a string because some of these are not text: a state badge, a
 * host name that is also a link, a duration with a unit in a quieter colour. The key is a string
 * and is uppercased here, because a key that arrives already uppercase and a key that does not
 * would otherwise sit in the same column.
 */
export function KeyValueList({ rows, layout = 'stacked' }: KeyValueListProps) {
  const inline = layout === 'inline';

  return (
    <dl
      data-ds="key-value-list"
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: inline ? 8 : 10,
      }}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            flexDirection: inline ? 'row' : 'column',
            alignItems: inline ? 'baseline' : 'stretch',
            justifyContent: inline ? 'space-between' : undefined,
            gap: inline ? 12 : 3,
            minWidth: 0,
          }}
        >
          <dt
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-overline-size)',
              fontWeight: 'var(--type-overline-weight)',
              letterSpacing: 'var(--type-overline-tracking)',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              flex: '0 0 auto',
            }}
          >
            {row.key}
          </dt>
          <dd
            style={{
              margin: 0,
              fontFamily: 'var(--type-numeric-family)',
              fontSize: 'var(--type-ui-size-sm)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-2)',
              textAlign: inline ? 'right' : 'left',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
