/**
 * The seven colours a library can be (`UI-1e`).
 *
 * Its own module rather than a second export from `ColorSwatchPicker`, because the picker is one
 * of three places that need it: the swatch row chooses one, `LibraryCard` paints with it, and
 * the sidebar dots it. A constant living inside the component that happens to have needed it
 * first is a constant every other consumer imports a component to reach.
 *
 * A library's colour is chosen by the person who made it and is **never derived** from its name
 * or from its audio, and it identifies a library without ever carrying meaning -- there is no
 * "red is urgent" here. The API stores the name; the value below is the token that draws it, and
 * each has a light-mode pair that `[data-theme="light"]` swaps underneath.
 */

export const LIBRARY_COLORS = [
  { name: 'amber', value: 'var(--library-amber)' },
  { name: 'clay', value: 'var(--library-clay)' },
  { name: 'slate', value: 'var(--library-slate)' },
  { name: 'moss', value: 'var(--library-moss)' },
  { name: 'stone', value: 'var(--library-stone)' },
  { name: 'plum', value: 'var(--library-plum)' },
  { name: 'teal', value: 'var(--library-teal)' },
] as const satisfies readonly { name: string; value: string }[];

/** One of the seven. This is what the API stores, not a colour. */
export type LibraryColorName = (typeof LIBRARY_COLORS)[number]['name'];
