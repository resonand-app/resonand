/**
 * The design system's entry point (`UI-1c`).
 *
 * One import specifier, `@/design-system`, and nothing outside this folder reaches past it into
 * `components/**` -- a lint rule says so, because a barrel nobody is held to is a longer path to
 * the same file. What it buys is the freedom `DEC-21` assumes: the system is the application's
 * component source and is versioned with it, so a component that moves between family folders,
 * or gains a wrapper, or is split in two, is a change to this file and to nothing that consumes
 * it.
 *
 * The stylesheet is deliberately not re-exported from here. `styles.css` is linked once from the
 * application entry and read directly by the seventeen cards in `guidelines/`; a CSS import
 * buried in a barrel is one that fires whenever anything imports anything, in an order nobody
 * controls.
 *
 * **It exports the tokens and, for now, nothing else.** The twenty-one components are still
 * `.jsx` -- `UI-1d` through `UI-1h` convert them one family folder at a time, and each of those
 * tasks adds its own line here. That is the whole reason the conversion is five tasks instead of
 * one: the barrel is where you can see how far it has got.
 */

export { TOKENS, token } from '@/design-system/tokens';
export type { Token } from '@/design-system/tokens';
