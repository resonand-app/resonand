# Sonarium Design System

Sonarium is a personal audio archive: you upload recordings, they get transcribed, and you can then search across everything you have ever recorded by what was said in it. Recordings live in **libraries** the user creates, names and colours themselves; a library can be kept private or shared with specific people. The product's two hard promises shape the whole interface — **nothing is shared until you share it**, and **nothing is destroyed without being told what will be lost**.

This system was designed from scratch for v0. There was no prior visual language, no existing app, and no logo.

## Status

**This is the final visual language for v0 — `DEC-8` in [`docs/v0-plan.md`](../../docs/v0-plan.md).** It supersedes the *Archive* palette (a warm neutral with an indigo ink accent, Instrument Serif / Instrument Sans / IBM Plex Mono) and the interface proposal that carried it, both of which have been retired. There is no palette left to choose between and no earlier proposal to reconcile against.

What this system does **not** decide is where anything goes. Navigation, routes, and every view with its real fields, states and actions are in the **interface specification** (`docs/internal/design/ui-ux-specification.md`), which is checked against the backend as built. Read it before designing a screen. Like the functional specification and the strategy notes, it is a working document and is not published while the first version is being built — so it is present in a working tree and absent from a fresh clone of the public repository.

## Sources

- [`VISION.md`](../../VISION.md) — why the product exists, who it is for, and the principles it will not break.
- The interface design brief — every view that needed designing, with the open decisions per view. Absorbed into the interface specification above and retired to `docs/internal/design/provenance/`.
- The Chillax variable family, supplied by the user. Shipped in `assets/fonts/`.
- Two dark-interface screenshots supplied as mood reference (thin sidebar, quiet chrome, near-monochrome).

The direction was chosen by the user from four built candidates in `Sonarium - style directions.dc.html`; the winner was **1c Trace** (floating panels), with the waveform swapped to the rounded-bar treatment from 1b. `Sonarium - design system.dc.html` is the signed-off specimen board that this system was compiled from. Both are kept under `docs/internal/design/provenance/` for the record and are not part of the shipped system.

---

## VISUAL FOUNDATIONS

**The idea.** An archive that floats. Panels sit apart from the page on real elevation; nothing draws a box around itself, and no two panels ever share an edge. Structure comes from a 12px gap and three steps of shadow, not from borders. The palette is a blue-black neutral with exactly one chromatic family — amber — so a played waveform, a primary button and an active nav item are all visibly the same signal.

**Colour.** Dark is the default; light is a full peer, not an afterthought. Amber runs 300–900 (`--amber-*`); 400 is the accent on dark, 700 on light. Every amber step declares the on-colour that clears AA against it — 600 is a mid-tone and takes `#241C10`, never white. Neutrals are two ramps: `--ink-*` (blue-black, dark mode) and `--paper-*` (warm, light mode), aliased through semantic names (`--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--text-3`) that flip on `[data-theme="light"]`. Never place `--text-3` on anything lighter than `--bg`. Two background colours per screen, maximum: the page and the surface.

**Library colour** is user-chosen from seven muted hues (`--library-amber` … `--library-teal`), each with a light-mode pair. It identifies a library and never carries meaning. It is never derived from the name or the audio.

**Type.** Three families, three jobs, no fourth case. **Chillax** (600) is the wordmark and the single page title per screen — nothing else, ever; it is a soft geometric sans, lovely at 33px and wrong in a 36px row. **Geist** is the interface: 17px/600 for section and card titles, 15px/1.6 for body and transcript, 13px for the working size. **Geist Mono**, tabular, for anything comparable to another number: durations, timestamps, counts, playback speed, and 10px/.12em uppercase group labels.

**The waveform** is the signature element. Amplitude sampled into rounded bars — 3px wide, 1.65px gap, fully rounded caps, minimum bar height equal to bar width so a silent passage stays a row of dots instead of disappearing. Played bars take `--wave`, unplayed `--wave-dim`, with a 2px rounded playhead. It appears at exactly five sizes: 20 (dense row), 38 (library card), 52 (recording card), 34 (player), 130 (audio detail). Peaks are computed once on ingest and stored, so a recording draws the same shape everywhere. **Until that job has run there is no waveform** — a dashed rule and a duration, never an invented shape.

**Shape.** 14px panels and cards, 10px inputs and menu items, 8px chips, pill for buttons and the search field, circle for avatars and the play control. No sharp corners anywhere.

**Elevation, not borders.** Three steps: `raised` (row groups), `panel` (nav, sidebar, cards), `overlay` (menus, dialogs, search). Borders exist only as hairline dividers inside a panel and as the dashed edge of an empty state. No gradients, no textures, no blur, no glass. Cards are solid surfaces — a card carrying a gradient tint was explicitly rejected.

**Backgrounds and imagery.** None. There is no photography, no illustration, no pattern. The waveform is the only graphic the product owns, and it is real data.

**Interaction.** Hover raises a surface one step (`transparent` → `--surface-2`) or moves the accent one step lighter on dark, one darker on light; press takes `--accent-pressed`. Disabled is 0.38 opacity, never a colour change. Focus is a single treatment everywhere: a 2px `--accent` ring at 2px offset. Hit targets never go under 44px even where the visual is 32px.

**Motion.** 120ms for state, 200ms for panels, `cubic-bezier(.2,0,.2,1)`. The transcript highlight following playback is the only thing that moves on its own, and it stops under `prefers-reduced-motion`. No bounce, no spring, no entrance animation.

**Layout.** Fixed shell: nav 52, sidebar 224 (52 collapsed), player 64, all floating in a 12px gap. Cards 320×188, three up at 1280, 16px grid gap. Dense rows 36px — that is the floor. Page padding 28.

---

## CONTENT FUNDAMENTALS

Plain, concrete, second person. The interface says what happened and what it will cost, then stops.

- **Second person, present tense.** "Search everything you've recorded." "Name it and pick a colour."
- **Say the consequence, in numbers.** "Deleting this library also deletes its 84 recordings." Never "Are you sure?" on its own.
- **Sentence case everywhere.** Buttons, labels, menu items, dialog titles. Uppercase only for the 10px mono group labels.
- **Errors state the fact, not the feeling.** "You already have a library with this name." Never "Oops!", never an apology, never an exclamation mark.
- **Absence is stated plainly.** "No waveform yet." "No transcript." Not "Processing…", not a spinner with no words.
- **No marketing register.** No "supercharge", "unleash", "seamless", "effortless", "powerful".
- **No emoji.** Anywhere.
- **User content is verbatim.** Library names, recording names, tags and transcripts are shown exactly as entered, accents and non-English words included — the product's own copy is English, its content is not.
- **Numbers are formatted, not rounded away.** "149 h 44 min", "48:12", "537 recordings".

---

## ICONOGRAPHY

**Lucide**, from CDN (`https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js`), at 1.7px stroke with round caps and joins, on a 24px grid. Sizes: 17px in rows and buttons, 15px for state glyphs, 21px in the nav.

⚠️ **Substitution, flagged.** The sources supplied no icon set — no codebase, no Figma, no sprite. The glyphs in the signed-off specimen board were drawn for the exploration; Lucide is the closest published match to their weight and construction and replaces them, so the system ships a real, complete, maintained set rather than a partial hand-drawn one. If you have an icon set you would rather use, hand it over and `Icon` is the only file that changes.

Use `Icon` for every glyph; do not inline SVG in a screen. Common names: `search`, `upload`, `panel-left`, `library`, `plus`, `play`, `pause`, `skip-back`, `skip-forward`, `share-2`, `more-vertical`, `trash-2`, `sliders-horizontal`, `moon`, `log-out`, `align-left`, `clock`, `tag`, `x`, `chevron-left`. Transcription states map to `circle-dashed`, `loader`, `check`, `alert-circle`.

**The mark** (`assets/sonarium-mark.svg`) is the waveform reduced to four rounded strokes of unequal height — the same geometry, cap and rhythm as the `Waveform` component, so the logo and the data read as the same object. It was designed for this system; there was no prior logo. No unicode characters are used as icons. The one exception is the `↵` and `⌘K` keyboard hints, which are typographic, not iconographic.

---

## Index

| Path | What it is |
|---|---|
| `styles.css` | The entry point consumers link. Imports only. |
| `tokens/` | `fonts` · `colors` · `typography` · `spacing` · `shape` · `motion` · `semantic` (theme aliases, `:root` = dark, `[data-theme="light"]`) |
| `components/foundation/` | `Icon` `Logo` |
| `components/forms/` | `Button` `IconButton` `TextField` `SearchField` `ColorSwatchPicker` |
| `components/media/` | `Waveform` `PlayerBar` `TranscriptLine` |
| `components/data/` | `StateBadge` `Chip` `LibraryCard` `CreateLibraryCard` `RecordingRow` `RecordingCard` |
| `components/navigation/` | `TopNav` `Sidebar` `ProfileMenu` `SearchResults` `Dialog` |
| `ui_kits/app/` | The click-through app: login → libraries landing → a library → audio detail with synced transcript |
| `guidelines/` | 17 specimen cards: Colors, Type, Spacing, Brand |
| `assets/` | The mark in three treatments, and the Chillax webfont |
| [`.claude/skills/sonarium-design/`](../../.claude/skills/sonarium-design/SKILL.md) | Agent-Skills entry point, outside this folder |

Component inventory note: no source defined a component list, so this is an authored set sized to the brief — every family here appears in a view the brief specifies. There are no speculative primitives (no Toast, Tooltip, Tabs, Switch, Select) because no view in the brief needed one at the time.

**The interface specification adds thirteen.** `Toast`, `Tooltip`, `Tabs`, `Switch`, `Select`, `Checkbox`, `Sheet`, `Menu` and `Progress` are required by views the system did not cover, plus four compositions — `LevelSelector`, `InlineField`, `TypedConfirm` and `EgressNotice`. See *Components the design system still owes* in the interface specification.

They **extend this folder in place** rather than living in a design file: same three files per component (`.jsx`, `.d.ts`, `.prompt.md`), same family folders, a row added to the index above, and the same rules — tokens only, no colour written in a component. There is one system, and it is versioned with the code.

## Caveats

- **Geist is loaded from Google Fonts**, not shipped — no binaries were supplied. Chillax is shipped as a variable woff2. If you want Geist self-hosted, send the files.
- **Icons are Lucide, substituted** — see ICONOGRAPHY.
- **Only three views are built** as high-fidelity screens: login, libraries landing, and audio detail with the synced transcript, plus a library's contents in both card and dense-row form. Trash, Settings, Admin, Upload and full Search are placeholders — those were not in the priority set.
- **All content is invented sample data** (`ui_kits/app/data.js`), written to be plausible for a Catalan family-archive user.

### Corrections the specification makes to the UI kit

Three things in `ui_kits/app/` do not match the product and must not be copied forward:

- **`LoginScreen` offers "create an account".** There is no self-registration in v0. Accounts are created by an administrator, and the only sign-up-shaped screen is the **first run** that creates the initial administrator on an instance with no accounts at all. The sign-in screen must not imply a sign-up path exists.
- **Geist is fetched from Google Fonts at runtime**, which is an outbound request on every page load. Principle 2 is about audio rather than fonts, but a self-hosted instance that phones out to Google to render its own interface reads badly and breaks in an air-gapped deployment. Self-host both Geist faces before v0 ships.
- **Lucide is loaded from a CDN.** Same reasoning: bundle it.
