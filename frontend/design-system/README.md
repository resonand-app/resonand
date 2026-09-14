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

**Contrast is a test, not a hope.** Every pair of tokens the interface puts together is audited against WCAG AA in both themes, and a token change that breaks it fails CI (`UI-33c`). Writing that audit found three things: the four transcription-state colours had no light ramp and failed AA between 2.35 and 3.06; the two badge fills never flipped, drawing a near-black chip on a white card; and the library ramp's light half was declared but never aliased, so an amber library sat at 1.89 against white. All three are fixed.

**Colour.** Dark is the default; light is a full peer, not an afterthought. Amber runs 300–900 (`--amber-*`); 400 is the accent on dark, 700 on light. Every amber step declares the on-colour that clears AA against it — 600 is a mid-tone and takes `#241C10`, never white. Neutrals are two ramps: `--ink-*` (blue-black, dark mode) and `--paper-*` (warm, light mode), aliased through semantic names (`--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--text-3`) that flip on `[data-theme="light"]`. Never place `--text-3` on anything lighter than `--bg`. Two background colours per screen, maximum: the page and the surface.

**Library colour** is user-chosen from seven muted hues (`--library-amber` … `--library-teal`), each with a light-mode pair. It identifies a library and never carries meaning. It is never derived from the name or the audio.

**Type.** Three families, three jobs, no fourth case. **Chillax** (600) is the wordmark and the single page title per screen — nothing else, ever; it is a soft geometric sans, lovely at 33px and wrong in a 36px row. **Geist** is the interface: 17px/600 for section and card titles, 15px/1.6 for body and transcript, 13px for the working size. **Geist Mono**, tabular, for anything comparable to another number: durations, timestamps, counts, playback speed, and 10px/.12em uppercase group labels.

**The waveform** is the signature element. Amplitude sampled into rounded bars — 3px wide, 1.65px gap, fully rounded caps, minimum bar height equal to bar width so a silent passage stays a row of dots instead of disappearing. Played bars take `--wave`, unplayed `--wave-dim`, with a 2px rounded playhead. It appears at exactly five sizes: 20 (dense row), 38 (library card), 52 (recording card), 34 (player), 130 (audio detail). Peaks are computed once on ingest and stored, so a recording draws the same shape everywhere. **Until that job has run there is no waveform** — a dashed rule and a duration, never an invented shape.

**Shape.** 14px panels and cards, 10px inputs and menu items, 8px chips, pill for buttons and the search field, circle for avatars and the play control. No sharp corners anywhere.

**Elevation, not borders.** Four steps, not three: `raised` (row groups), `panel` (nav, sidebar), `card` (the two card components, a deeper two-layer shadow — cards float further off the page than the chrome does, which is what makes a grid of them read as objects), `overlay` (menus, dialogs, search). `--elevation-card` was always there and the count here said three; `UI-33c` settled it as a step rather than folding it into `panel`, because the difference is deliberate and visible in every library grid.

There is a fifth token, `--elevation-accent`, which is **not a step**: it is the primary button's amber glow, and it is here rather than written into the component because hard-coded it did not flip, so a light-mode button carried the dark-mode glow (`UI-33a`).

Borders exist only as hairline dividers inside a panel and as the dashed edge of an empty state. No gradients, no textures, no blur, no glass. Cards are solid surfaces — a card carrying a gradient tint was explicitly rejected.

**Backgrounds and imagery.** None. There is no photography, no illustration, no pattern. The waveform is the only graphic the product owns, and it is real data.

**Interaction.** Hover raises a surface one step (`transparent` → `--surface-2`, `--surface-2` → `--border`) or moves the accent one step lighter on dark, one darker on light; press takes `--accent-pressed`. Disabled is 0.38 opacity, never a colour change. Focus is a single treatment everywhere: a 2px `--accent` ring at 2px offset. Hit targets never go under 44px even where the visual is 32px — grown with a pseudo-element rather than by growing the box, so a row of controls keeps its rhythm.

All of it lives in `components.css` and none of it is a React state variable (`UI-32a`). **Until that file existed, every rule in this paragraph was documented and unimplemented** — the components are inline style objects, and `:hover`, `:focus-visible`, `:active` and `@media` cannot be written as a property on one. The specimen boards faked them with a prototyping harness that does not ship. The one hover that is not a surface step is the destructive button's: `--state-failed-bg` is the deepest red in the palette and filling with `--state-failed` itself has no on-colour that clears AA in both themes, so it answers with an inset `--border-control` edge instead.

**Motion.** 120ms for state, 200ms for panels, `cubic-bezier(.2,0,.2,1)`. The transcript highlight following playback is the only thing that moves on its own, and it stops under `prefers-reduced-motion`. No bounce, no spring, no entrance animation.

`prefers-reduced-motion` is honoured in three places and each is checked (`UI-32c`): both duration tokens zero themselves, **every transition in the system is written in terms of one of them** — which is what makes that zeroing sufficient rather than decorative — and a script that scrolls asks for itself, with `usePrefersReducedMotion`. That last one is not optional politeness: `scrollTo({ behavior: 'smooth' })` consults no token, no media query and no stylesheet, so the transcript's follow-scroll is the one movement in the product that can only be stopped in TypeScript.

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

**Lucide**, bundled from the `lucide-react` package (`UI-1b`), at 1.7px stroke with round caps and joins, on a 24px grid. Sizes: 17px in rows and buttons, 15px for state glyphs, 21px in the nav. Nothing is fetched at runtime.

⚠️ **Substitution, flagged.** The sources supplied no icon set — no codebase, no Figma, no sprite. The glyphs in the signed-off specimen board were drawn for the exploration; Lucide is the closest published match to their weight and construction and replaces them, so the system ships a real, complete, maintained set rather than a partial hand-drawn one. If you have an icon set you would rather use, hand it over and `Icon` is the only file that changes.

Use `Icon` for every glyph; do not inline SVG in a screen. **`name` is one of the thirty-nine names the component registers, not any Lucide name**: `search`, `upload`, `download`, `panel-left`, `library`, `folder-input`, `plus`, `play`, `pause`, `skip-back`, `skip-forward`, `share-2`, `more-vertical`, `trash-2`, `sliders-horizontal`, `moon`, `sun`, `log-out`, `align-left`, `clock`, `tag`, `x`, `chevron-left`, `chevron-down`, `chevron-up`, `minus`, `pencil`, `hard-drive`, `cloud-upload`, `layout-grid`, `rows`, `file-audio`, `file-video`, `eye`, `eye-off`. Transcription states map to `circle-dashed`, `loader`, `check`, `alert-circle`.

The registry is written out by hand in `Icon.tsx`, which is what keeps the other fourteen hundred icons out of the bundle — measured at 759 KB against 2.6 KB. Adding a glyph is two lines there; using one that is not registered is a compile error at the call site, and a thrown error in development if it arrives as a computed string. Four of the names above are deprecated aliases upstream and the registry absorbs that, so the system's vocabulary does not move when Lucide's does.

**The mark** (`assets/sonarium-mark.svg`) is three radiating arcs — a signal, a sound wave — curling down into the letter S. It ships as a finished asset from the brand kit rather than being drawn from the `Waveform` component's own geometry, which is how its four-stroke predecessor was built. No unicode characters are used as icons. The one exception is the `↵` and `⌘K` keyboard hints, which are typographic, not iconographic.

---

## Index

| Path | What it is |
|---|---|
| `index.ts` | **The barrel. Everything is imported from `@/design-system` and nothing reaches past it into `components/**`** — a lint rule says so (`UI-1c`). |
| `styles.css` | The stylesheet, linked once from the application entry and directly by the guideline cards. Imports only. |
| `components.css` | **The interaction layer** (`UI-32a`): hover, press, focus-visible, the 44px floor and the disabled opacity, as real selectors on `data-*` attributes. A component owns its geometry and this owns everything that responds to a pointer, because an inline property beats every rule a stylesheet can write. |
| `tokens/` | `fonts` · `colors` · `typography` · `spacing` · `shape` · `layers` · `breakpoints` · `motion` · `semantic` (theme aliases: `:root` = dark, `[data-theme="light"]` and `prefers-color-scheme` = light) |
| `tokens.ts` | The 155 token names as a typed union, so `token('--surfce')` is a compile error. **Generated by `npm run tokens`; the CSS is the source of truth.** |
| `library-colors.ts` | The seven library colours as names the API stores, and the tokens that draw them. |
| `transcription-states.ts` | The four transcription states, their words and their glyphs. One list, so the badge and the filter cannot say different things. |
| `theme/` | `ThemeProvider` and `useTheme`: light, dark, or follow the system — which writes no attribute at all (`UI-1j`). Plus `usePrefersReducedMotion` and `scrollBehaviour`, which is how a script opts in to the one preference a stylesheet cannot enforce for it (`UI-32c`). |
| `tokens/layers.css` | The z-index scale. Six things overlap; before this they stacked by DOM order (`UI-33b`). |
| `tokens/breakpoints.css` | 1280 / 1180 / 900 / 720, which existed only as prose (`UI-33b`). |
| `components/layout/` | `Shell` `PageHeader` `StateCard` + `CardSkeleton` `RowSkeleton` — the frame, the one page title per screen, and §3.5's state family (`UI-35a`–`UI-35c`) |
| `components/foundation/` | `Icon` `Logo` |
| `components/forms/` | `Button` `IconButton` `TextField` `SearchField` `ColorSwatchPicker` `Select` `Switch` `Checkbox` `Progress` |
| `components/media/` | `Waveform` `PlayerBar` `TranscriptLine` |
| `components/data/` | `StateBadge` `Chip` `LibraryCard` `CreateLibraryCard` `RecordingRow` `RecordingCard` `LevelSelector` `InlineField` `TypedConfirm` `EgressNotice` `AvatarStack` `KeyValueList` |
| `components/navigation/` | `TopNav` `Sidebar` `ProfileMenu` `SearchResults` `Breadcrumb` `Dialog` `Menu` `Tabs` `Sheet` `Toast` `ToastRegion` `Tooltip` |
| `components/overlay/` | `useAnchoredOverlay` — placement, focus trapping, `Esc`, outside click and the optional scroll lock, shared by every overlay in the system (`UI-34a`). **Not exported from the barrel**: it is not a component, and a view reaching for it directly is a view inventing a sixth overlay. |
| `guidelines/` | 17 specimen cards: Colors, Type, Spacing, Brand. Standalone HTML, opened directly or framed by the specimen route. |
| `assets/` | The mark in three treatments, and the Chillax webfont |
| [`.claude/skills/sonarium-design/`](../../.claude/skills/sonarium-design/SKILL.md) | Agent-Skills entry point, outside this folder |

**Every component is `.tsx`, and the application's own source** (`DEC-21`, `UI-1d`–`UI-1h`). Each ships two files: the component and its `.prompt.md`, which is the only record of when *not* to use it. The hand-written `.d.ts` files are gone — they folded into the components they documented.

**To look at it: `npm run dev`, then `#/specimens`.** Every component, every glyph, the seventeen guideline cards, and a control that switches between light, dark and the system's answer (`UI-1k`). It is development-only and is not in a build.

Component inventory note: no source defined a component list, so the first twenty-one were an authored set sized to the brief. There were no speculative primitives, and there still are none — everything added since was named by a view that needed it.

**The specification's thirteen are built** (`UI-34`). `Select`, `Menu`, `Tabs`, `Switch`, `Checkbox`, `Sheet`, `Toast`, `Progress` and `Tooltip` are the nine primitives; `LevelSelector`, `InlineField`, `TypedConfirm` and `EgressNotice` are the four compositions. They extend this folder in place — same two files per component, same family folders, same rules — because there is one system and it is versioned with the code.

Underneath five of them is `components/overlay/useAnchoredOverlay` (`UI-34a`), which settles placement, focus trapping, `Esc`, the outside click and the scroll lock once. It is **not exported from the barrel**: it is not a component, and a view reaching for it directly is a view inventing a sixth overlay.

**Six of the ten composites the prototype invented are here too** (`UI-35`), in `components/layout/` and `components/data/`. The other four — `FilterBar`, `BulkBar`, `UploadTray` and `ResultGroup` — hold a query, a mutation or a store, so `DEC-22` puts them in `frontend/src/components/` instead. Without that line, "make it reusable" ends with the design system importing TanStack Query.

Three of the components carry an absence that is part of the design, and each says so in its own file: `Progress` has **no indeterminate mode**, so transcription cannot borrow it; `MenuItem` has **no `disabled`**, so an action the user cannot take is absent; and `PageHeader` takes its title as a `string`, so nothing else can get inside the one piece of display type the product has.

## Caveats

- ~~**Geist is loaded from Google Fonts**, not shipped.~~ **Closed by `UI-1a`.** Both faces ship as subset woff2 in `assets/fonts/`, Latin and Latin Extended, no italics — 84 KB for all four files. They come from `@fontsource-variable/geist` and its mono twin, and the version is written in `tokens/fonts.css`, which is the only place it exists. Nothing here reaches the network.
- ~~**Icons are Lucide, loaded from a CDN.**~~ **Closed by `UI-1b`.** Bundled and tree-shaken — see ICONOGRAPHY. The substitution itself still stands: no icon set was supplied, and `Icon` is still the one file that changes if one arrives.
- **The system is complete; the interface is not.** Thirty-four components and six composites, drawn and built. What does not exist yet is a single view: `frontend/src/` holds the application's four composites, the specimen page and a hello. Phase D puts a router, a client and a shell around them.
- **Sample content is invented**, written to be plausible for a Catalan family-archive user. It now lives in the application's `src/dev/specimen-data.ts` rather than in this folder — component defaults are deliberately empty, so a forgotten prop reads as missing rather than as somebody else's recording.

### The UI kit is provenance, not a starting point

`ui_kits/app/` — the click-through login → landing → library → audio detail — **is no longer in this folder** (`UI-1k`). It rendered `.jsx` in the browser with React and Babel fetched from unpkg, which stopped working the moment the components became `.tsx`, and the five `.card.html` component specimens went the same way for the same reason. `#/specimens` replaces all six, and replaces them with the components as the application actually imports them.

The kit is kept at `docs/internal/design/provenance/ui-kit-app/`, beside the prototype it came from — present in a working tree, absent from a fresh clone. Read it for what a screen looked like; do not copy it forward. Two of its three known divergences are now closed in code, and the third is a rule that outlives it:

- **`LoginScreen` offers "create an account".** There is no self-registration in v0. Accounts are created by an administrator, and the only sign-up-shaped screen is the **first run** that creates the initial administrator on an instance with no accounts at all. The sign-in screen must not imply a sign-up path exists — `UI-21a` says the same thing, and it is the one correction here that is still owed.
- ~~**Geist is fetched from Google Fonts at runtime.**~~ Closed by `UI-1a`.
- ~~**Lucide is loaded from a CDN.**~~ Closed by `UI-1b`.
