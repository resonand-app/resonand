import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /**
   * The page title. **The only Chillax on the screen**, and there is one of these per view.
   *
   * A string and not a node, on purpose: a node here is how somebody eventually puts a second
   * typeface, an icon or a badge inside the one piece of display type the product has.
   */
  title: string;
  /** The mono meta line under it: "37 recordings · 24 h 12 min". Numbers, tabular. */
  meta?: string;
  /** A library's colour dot, or a state badge -- anything that qualifies the title. */
  before?: ReactNode;
  /** Right-aligned actions. One primary at most, per the type rule about primaries. */
  actions?: ReactNode;
}

/**
 * The one page title per screen, and the enforcement point for that rule (`UI-35b`).
 *
 * Chillax appears in exactly two places in this product: the wordmark, and the title of the view
 * you are looking at. It is a soft geometric sans that is lovely at 33px and wrong in a 36px row,
 * and a system with one display face survives only if there is one component that draws it.
 *
 * So `title` is a `string`. Every other slot here takes a node, and this one does not, because a
 * node is how a second typeface gets inside the page title six months from now -- as an icon, a
 * badge, a "beta" pill. A view that needs something beside the title puts it in `before`, at the
 * interface's own size.
 */
export function PageHeader({ title, meta, before, actions }: PageHeaderProps) {
  return (
    <header
      data-ds="page-header"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-6)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {before}
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--type-page-title-family)',
              fontSize: 'var(--type-page-title-size)',
              fontWeight: 'var(--type-page-title-weight)',
              letterSpacing: 'var(--type-page-title-tracking)',
              lineHeight: 'var(--type-page-title-leading)',
              color: 'var(--text)',
              minWidth: 0,
              textWrap: 'pretty',
            }}
          >
            {title}
          </h1>
        </div>
        {meta !== undefined && (
          <span
            style={{
              fontFamily: 'var(--type-numeric-family)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {meta}
          </span>
        )}
      </div>
      {actions !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
