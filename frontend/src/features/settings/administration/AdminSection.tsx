import type { ReactNode } from 'react';

/**
 * One area of administration, as a card.
 *
 * Exported so the four sections do not each invent a heading: users, the provider, the queue and
 * the instance's own status are four different subjects and one visual rhythm.
 *
 * **The chrome is here and not in `Administration`.** The grid places these; what a section
 * looks like is the section's business, so a fifth one added later is a card without anybody
 * having to remember to wrap it. `--radius-panel` is the app's card corner -- the same one a
 * recording card, the sidebar and the top nav draw.
 */
export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-panel)',
        background: 'var(--surface)',
        boxShadow: 'var(--elevation-raised)',
        // The grid track can be narrower than a uuid or a provider address. Without this the
        // card refuses to shrink and the column pushes the page sideways instead.
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-overline-size)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--type-overline-tracking)',
            color: 'var(--text-3)',
          }}
        >
          {title}
        </h3>
        {description !== undefined && (
          <p
            style={{
              margin: 0,
              maxWidth: 520,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
