import type { HTMLAttributes } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import { Checkbox } from '../forms/Checkbox';
import { IconButton } from '../forms/IconButton';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';
import { Icon } from '../foundation/Icon';
import { Chip } from './Chip';
import { StateBadge } from './StateBadge';

// `onSelect` hands back whether it is now selected rather than a DOM event, and `HTMLAttributes`
// already has one. Omitting it is what lets the narrower signature stand rather than silently
// shadow a native handler -- the same arrangement `Sidebar` makes for the same reason.
export interface RecordingCardProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
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
   * Whether this card is selected, and the control that changes that (`UI-9a`).
   *
   * The checkbox is in the corner **opposite the play button**, which is the whole design of it:
   * two controls in one corner makes every click a decision about which one you meant. It appears
   * on hover, or whenever a selection already exists -- so a grid at rest is a grid of recordings
   * rather than a form, and once somebody is selecting, every card says it can be.
   */
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  /** Whether anything at all is selected, which is what keeps the boxes visible. */
  selecting?: boolean;
  /**
   * Whether this is the recording the player is playing (`UI-6c`).
   *
   * It marks the card and turns the play control into a pause, because the control that started
   * the sound is the one somebody reaches for to stop it. The mark is not a colour alone: the
   * card takes the accent ring, which is legible next to a selected card and in both themes.
   *
   * **The shape is lit, not filled.** The card's waveform takes the accent while this is the
   * recording being played, and otherwise does nothing: the player at the foot of the shell is
   * the one drawing where a recording has got to, and a grid of waveforms filling in behind it
   * is the same fact said a dozen times (`UI-6c`).
   */
  playing?: boolean;
  /** The shape of the recording. A picture of what is in the file, and it does not move. */
  peaks?: Peaks | undefined;
  pending?: boolean;
  onPlay?: () => void;
  /**
   * Open the recording, from anywhere on the card (`UI-6b`).
   *
   * The mouse convenience over the whole surface, exactly as `LibraryCard` has it: `href` on the
   * title stays the keyboard path and the thing a screen reader is given, and this is what makes
   * the other nine tenths of the card worth aiming at.
   */
  onOpen?: () => void;
  /** The copy, for an application that has its own (`UI-22a`). */
  labels?: {
    /** What the waveform says before the peaks job has run. */
    noWaveform?: string;
    play?: (name: string) => string;
    /** The same control, once this is the recording being played. */
    pause?: (name: string) => string;
    /** The transcription state, in the interface's language. `StateBadge`'s own is English. */
    state?: string;
    /** "+3", or whatever a language makes of a count of tags not drawn. */
    moreTags?: (count: number) => string;
    select?: (name: string) => string;
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
 * **The whole card opens the recording and the title link is the keyboard path**, the arrangement
 * `LibraryCard` already makes: a title is a small thing to aim at on a surface that is obviously
 * one thing, and the two controls on it say so by being the two places a click does not open it.
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
  selected = false,
  onSelect,
  selecting = false,
  playing = false,
  href,
  labels,
  peaks,
  pending = false,
  onPlay,
  onOpen,
  style,
  ...rest
}: RecordingCardProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- the title link is the keyboard path, as on `LibraryCard`
    <article
      onClick={(event) => {
        if (onOpen === undefined) return;
        // The checkbox picks the recording and the play button plays it. Neither opens it.
        if (
          event.target instanceof Element &&
          event.target.closest('[data-ds="card-select"], [data-ds="card-play"]') !== null
        ) {
          return;
        }
        // A modifier click stays the browser's, so the title link can still open a new tab.
        // Anything else cancels it: following the `href` would reload out of the router.
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
      data-ds="recording-card"
      data-interactive={onOpen === undefined ? undefined : 'true'}
      data-playing={playing ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-selecting={selecting || selected ? 'true' : undefined}
      style={{
        borderRadius: 'var(--radius-panel)',
        padding: '14px var(--panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: onOpen === undefined ? 'default' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {onSelect !== undefined && (
          <span data-ds="card-select" style={{ flex: '0 0 auto', paddingTop: 2 }}>
            <Checkbox
              checked={selected}
              onChange={onSelect}
              size="card"
              label={labels?.select?.(name) ?? `Select ${name}`}
            />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--weight-semibold)',
              fontSize: 'var(--type-body-size)',
              letterSpacing: 'var(--type-title-tracking)',
              color: 'var(--text)',
              // A title wraps rather than being cut: "Field recording, long take -- the house
              // on Field notes" is an ordinary title, and an ellipsis in the middle of it is a
              // recording somebody cannot identify (§V3).
              textWrap: 'pretty',
            }}
          >
            {href === undefined ? (
              name
            ) : (
              <a data-ds="recording-card-title" data-hit-target href={href}>
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
        <span data-ds="card-play" style={{ flex: '0 0 auto', display: 'flex' }}>
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
        </span>
      </div>
      {/* Lit while this is the one playing, and static either way: the shape of the recording,
          never a second playhead (see `playing`). */}
      <Waveform
        peaks={peaks}
        size="record"
        lit={playing}
        pending={pending}
        noWaveformLabel={labels?.noWaveform}
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
