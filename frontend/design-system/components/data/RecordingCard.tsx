import type { HTMLAttributes } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import { IconButton } from '../forms/IconButton';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';
import { Icon } from '../foundation/Icon';
import { Chip } from './Chip';
import { StateBadge } from './StateBadge';

export interface RecordingCardProps extends HTMLAttributes<HTMLElement> {
  name: string;
  /**
   * Where the title goes: the card's keyboard path into the recording (`UI-6b`).
   *
   * A link, for the reasons `LibraryCard`'s carries one -- opening a recording is a navigation,
   * and the play button beside it is a different action that must not be the only control on a
   * card somebody reached with a keyboard.
   */
  href?: string;
  /** Mono metadata: duration and date, e.g. "48:12 · 12 Mar 2026". */
  meta?: string;
  state?: TranscriptionState;
  /**
   * The category, resolved against the library's own tree by whoever renders the card.
   *
   * An id on the recording and a name here: the card does not know the library, and a component
   * that fetched a tree to draw one word would fetch it once per card.
   */
  category?: string;
  /** User-entered tags, shown verbatim. */
  tags?: string[];
  /**
   * How many tags to draw before the rest become a count.
   *
   * A card is 320px and a recording can carry a dozen tags. Wrapping them all makes every card a
   * different height, which is the one thing a grid of cards cannot survive.
   */
  maxTags?: number;
  /** A discreet mark for a recording shared on its own, apart from its library. */
  sharedIndividually?: boolean;
  /**
   * Whether this is the recording the player is playing (`UI-6c`).
   *
   * It marks the card and turns the play control into a pause, because the control that started
   * the sound is the one somebody reaches for to stop it. The mark is not a colour alone: the
   * card takes the accent ring, which is legible next to a selected card and in both themes.
   */
  playing?: boolean;
  peaks?: Peaks | undefined;
  played?: number;
  pending?: boolean;
  onPlay?: () => void;
  /** The copy, for an application that has its own (`UI-22a`). */
  labels?: {
    play?: (name: string) => string;
    /** The same control, once this is the recording being played. */
    pause?: (name: string) => string;
    /** The transcription state, in the interface's language. `StateBadge`'s own is English. */
    state?: string;
    /** "+3", or whatever a language makes of a count of tags not drawn. */
    moreTags?: (count: number) => string;
    sharedIndividually?: string;
  };
}

/**
 * A recording as a card, for the grid view of a library.
 *
 * The play control is a real button in the corner, which is what leaves the opposite corner free
 * for `UI-9a`'s selection checkbox -- the two must not fight, because selecting forty recordings
 * and playing one are things people do in the same minute.
 *
 * It asks for `variant="accent-soft"` rather than passing the same two colours through `style`,
 * which is what it did until `UI-32a` -- and an inline background is a paint no hover rule can
 * reach, so the card's play button was one of the two controls in the product that did not
 * respond to a pointer.
 */
export function RecordingCard({
  name,
  meta,
  state = 'done',
  category,
  tags = [],
  maxTags = 3,
  sharedIndividually = false,
  playing = false,
  href,
  labels,
  peaks,
  played = 0,
  pending = false,
  onPlay,
  style,
  ...rest
}: RecordingCardProps) {
  return (
    <article
      data-ds="recording-card"
      data-playing={playing ? 'true' : undefined}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        padding: '14px var(--panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--weight-semibold)',
              fontSize: 'var(--type-body-size)',
              letterSpacing: '-0.005em',
              color: 'var(--text)',
              // A title wraps rather than being cut: "Interview with grandma Teresa -- the house
              // on Carrer Nou" is an ordinary title, and an ellipsis in the middle of it is a
              // recording somebody cannot identify (§V3).
              textWrap: 'pretty',
            }}
          >
            {href === undefined ? (
              name
            ) : (
              <a data-ds="recording-card-title" href={href}>
                {name}
              </a>
            )}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {meta}
          </span>
        </div>
        <IconButton
          icon={playing ? 'pause' : 'play'}
          variant="accent-soft"
          size={32}
          label={
            playing
              ? (labels?.pause?.(name) ?? `Pause ${name}`)
              : (labels?.play?.(name) ?? `Play ${name}`)
          }
          onClick={onPlay}
        />
      </div>
      <Waveform
        peaks={peaks}
        size="record"
        played={played}
        playhead={played > 0}
        pending={pending}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <StateBadge state={state} {...(labels?.state === undefined ? {} : { label: labels.state })} />
        {sharedIndividually && (
          <Chip data-kind="shared" title={labels?.sharedIndividually}>
            <Icon name="share-2" size={13} />
          </Chip>
        )}
        {category !== undefined && <Chip data-kind="category">{category}</Chip>}
        {tags.slice(0, maxTags).map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
        {tags.length > maxTags && (
          <Chip data-kind="overflow">
            {labels?.moreTags?.(tags.length - maxTags) ?? `+${String(tags.length - maxTags)}`}
          </Chip>
        )}
      </div>
    </article>
  );
}
