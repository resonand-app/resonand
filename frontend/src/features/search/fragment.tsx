/**
 * The matched words, marked by the database rather than by the interface (`UI-16d`, §V6).
 *
 * `fragment` arrives from SQLite's own `snippet()` with the matched term wrapped in `<mark>`, and
 * §V6 is explicit that **the interface renders the marking rather than doing its own
 * highlighting**. The reason is not laziness: the index decides what matched -- accents folded, a
 * prefix wildcard on the last token (`JOB-14`) -- and an interface that highlighted what somebody
 * typed would draw a different answer from the one the search gave, most visibly in exactly the
 * cases the recall note is about.
 *
 * So the markup is parsed and re-emitted as real `<mark>` elements. **Never as HTML.** A
 * transcript is somebody's speech and a fragment is a slice of it: the surrounding text is data,
 * it is put in the document as text nodes, and an angle bracket in a recording stays an angle
 * bracket instead of becoming a tag. That is also why the split is on the two literal tags and
 * everything between them is passed through untouched.
 */

import type { CSSProperties, ReactNode } from 'react';

/** The two tags `snippet()` is asked for, and the only markup a fragment can carry. */
const TAGS = /(<mark>|<\/mark>)/;

/**
 * What a marked word looks like.
 *
 * The accent's soft pair rather than a yellow of its own: it is the one colour in the product that
 * means "this is what you asked for", and a highlight drawn in anything else would be a second
 * accent. Set here because a browser's default `mark` is a hard yellow that ignores the theme
 * entirely -- in dark it is a torch shining out of the panel.
 */
const MARK: CSSProperties = {
  background: 'var(--accent-soft)',
  color: 'var(--accent-on-soft)',
  borderRadius: 'var(--radius-chip)',
  padding: '0 2px',
};

export function marked(fragment: string): ReactNode[] {
  let inside = false;
  const parts: ReactNode[] = [];

  for (const [index, piece] of fragment.split(TAGS).entries()) {
    if (piece === '<mark>') {
      inside = true;
      continue;
    }
    if (piece === '</mark>') {
      inside = false;
      continue;
    }
    if (piece === '') continue;
    parts.push(
      inside ? (
        <mark key={index} data-app="search-mark" style={MARK}>
          {piece}
        </mark>
      ) : (
        piece
      ),
    );
  }

  return parts;
}

/** The same fragment as plain words, for somewhere that can only take a string. */
export function unmarked(fragment: string): string {
  return fragment
    .split(TAGS)
    .filter((piece) => piece !== '<mark>' && piece !== '</mark>')
    .join('');
}
