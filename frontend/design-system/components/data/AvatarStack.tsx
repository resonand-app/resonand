import { initialsOf } from './initials';

export interface AvatarStackProps {
  /** Who has access. Initials are derived here so two lists cannot disagree about them. */
  people: { id: string | number; name: string }[];
  /** How many to draw before the rest become a count. */
  max?: number;
  /** Diameter in px. 26 in a library card, 32 in the share dialog. */
  size?: number;
}

/**
 * Who a library is shared with, as overlapping initials (`UI-35d`).
 *
 * **The prototype's overlap was an accident.** It set `gap: -6px`, which is not valid CSS -- gaps
 * cannot be negative -- so the declaration was dropped and the avatars overlapped only because a
 * negative margin further down happened to do it. Here the overlap is the margin, on purpose, and
 * the first avatar does not carry one.
 *
 * There are no avatar images anywhere in this product: no storage exists for one, and fetching one
 * from an external service would break the promise that nothing leaves the instance. Identity is
 * initials, and the ring between them is `--surface` so a stack reads as separate people rather
 * than as a smear.
 */
export function AvatarStack({ people, max = 4, size = 26 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div
      data-ds="avatar-stack"
      style={{ display: 'flex', alignItems: 'center' }}
      /* One label for the group rather than one per circle: a screen reader reading out four sets
         of initials tells somebody nothing, and the names are in the share dialog. */
      aria-label={`Shared with ${String(people.length)}`}
    >
      {shown.map((person, index) => (
        <span
          key={person.id}
          data-ds="avatar"
          title={person.name}
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -6,
            borderRadius: 'var(--radius-circle)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-overline-size)',
            flex: '0 0 auto',
          }}
        >
          {initialsOf(person.name)}
        </span>
      ))}
      {rest > 0 && (
        <span
          data-ds="avatar"
          data-overflow="true"
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            borderRadius: 'var(--radius-circle)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-overline-size)',
            flex: '0 0 auto',
          }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
