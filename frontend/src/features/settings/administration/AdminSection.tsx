import type { ReactNode } from 'react';

/**
 * One area of administration, in the chrome they share.
 *
 * Exported so the four sections do not each invent a heading: users, the provider, the queue and
 * the instance's own status are four different subjects and one visual rhythm.
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
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-meta-size)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-meta)',
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
