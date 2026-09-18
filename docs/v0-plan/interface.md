# The interface

`UI-*` — every view, and the design system and application spine underneath them. Sixty per cent
of the first version's tasks are here.

Two altitudes in one file. The first section names the frontend work at the altitude of a view;
everything after it cuts each of those into pieces one person can finish in a sitting. Nothing
in the second half is new scope -- it is the same work, cut small enough to start.

## Track C · Frontend

`UI-1`/`UI-2` can start during Phase 1, and `UI-3`/`UI-4` against mocks during Phase 2.

- [x] **UI-1** · **Adopt the design system**, which is already built and vendored at
      `frontend/design-system/` (`DEC-8`). This task is not a design task: it is wiring the
      finished system into the application. Link `styles.css`, port each component from its `.jsx`
      to strict TSX against the `.d.ts` that ships beside it, **self-host Geist and bundle Lucide**
      so the interface makes no outbound request to render itself, and add a Vitest check that
      fails if a hex colour, an `rgb()` or a font name appears anywhere in a component. The theme
      is `light` / `dark` / follow-the-system and nothing else.
      *Done when:* every component in the system renders in the app in both themes, and the
      no-hardcoded-colour test passes.

- [x] **UI-2** · **Waveform component** — the product's signature visual element, specified by the
      system: amplitude in rounded bars at the five documented sizes (20 dense row · 38 library
      card · 52 recording card · 34 player · 130 audio detail), played vs pending bars, a 2px
      rounded playhead, click to seek on the large one, and minimum bar height equal to bar width
      so silence stays a row of dots. It reduces `ING-5`'s stored min/max pairs to the available
      pixel width — a 48-minute recording is ~28,800 pairs — and when the peaks job has not run it
      renders **a dashed rule and the duration, never an invented shape**. ⇢ UI-1, ING-5

- [x] **UI-3** · API client generated from the OpenAPI spec (`openapi-typescript`), with shared
      types. ⇢ API-1
      *This is what keeps the interface a client of the API rather than a privileged path into it.*

- [x] **UI-4** · Navigation shell, in the two forms the interface specification settles. **Desktop:**
      the floating shell — a 52px top nav carrying the mark, the global search field, upload and the
      account; a 224px sidebar (52px collapsed) listing your libraries and, separately, libraries
      shared with you, then Trash and Settings; the content area; and the 64px player pinned along
      the bottom whenever something is playing, everything separated by a 12px gap. **Phone:** not a
      narrowed desktop but four bottom tabs — Libraries, Search, Upload, Settings — with the player
      docked directly above them as a compact strip that expands to a full-screen player. The
      sidebar's contents become the Libraries tab. ⇢ UI-1, UI-3

- [x] **UI-31** · **Libraries landing**, the application's home: the create tile first, then a card
      per library carrying its name, its user-chosen colour, its recording count and total duration,
      and the waveform of its most recent recording. Libraries shared with you are a second,
      separately titled group that **disappears entirely rather than sitting empty**. A brand-new
      account has exactly one library — the personal one — and that state is an invitation to upload,
      not an empty grid. ⇢ UI-4, API-8

- [x] **UI-5** · **Persistent player**: it survives view changes, and a decision on whether the
      large player and the compact one are the same component in two states or two synchronised
      components (*recommendation: a single global state, two presentations*). Integration with the
      **Media Session API** for system controls on mobile. ⇢ UI-2, UI-4

- [x] **UI-6** · **View A · Library grid**: header with owner, shares, count and total duration;
      audio card with the **four transcription states visually distinguishable**, category, tags
      with overflow, and a play button on the card. ⇢ UI-5, API-9

- [x] **UI-7** · **View A' · Dense compact list** — for 800 audios the grid is useless. Fixed-height
      36px row, virtualised, and the scrollbar honest about the full length before everything is
      fetched. ⇢ UI-6, API-10, ING-14

- [x] **UI-8** · Filters and sorting, as **one filter bar under the page header** rather than a
      second rail: a category popover holding the tree, tag chips, the four transcription states as
      toggles, the sort control, and the grid/list switch. A permanent rail would drop the card grid
      from three columns to two at 1280 and is a lot of chrome for a family archive; a popover also
      collapses honestly onto a phone. Sorting is by recording date / upload date / duration /
      title, and **the list's column headings and the bar's sort control are the same sort**.
      ⇢ UI-6, API-10, DAT-6, DAT-7, ING-12

- [x] **UI-9** · Multiple selection and bulk actions: assign category, add tag, move between
      libraries, send to trash. ⇢ UI-7

- [x] **UI-10** · Grid states: empty (an invitation to upload, not a sad drawing), loading
      (skeletons), and error. ⇢ UI-6

- [x] **UI-11** · **View B · Detail** with a large player and a seekable waveform, 0.75×–2× speed
      and ±15 s skips. ⇢ UI-5, ING-7

- [x] **UI-12** · **Synchronised transcript** — the central moment of the product: the active
      segment is highlighted as it plays, clicking a segment seeks to that moment, and the scroll
      follows playback without hijacking the user's manual scrolling. ⇢ UI-11, JOB-6

- [x] **UI-13** · Metadata panel, inline-editable according to permission, technical metadata
      collapsed, and a **read-only state that clearly reads as non-editable without looking
      broken**. It is a 320px panel to the right of the transcript on desktop, collapsible, and a
      **bottom sheet on a phone** opened from the essentials line — the transcript needs the full
      width and it is the centre of the product. ⇢ UI-11, API-9

- [x] **UI-14** · Transcript selector when there is more than one (model, language, date, which one
      is active). `JOB-7` makes re-transcription possible, so without this it is unreachable from
      the interface. The manual editor is a later milestone. ⇢ UI-13, JOB-7, API-11

- [x] **UI-15** · Transcription states in the detail view: missing (with a call to action), in
      progress (with progress if the provider offers it), and **failed with the real error message
      and a retry button** — the error explains what happened and what to do, it does not
      apologise. ⇢ UI-13, JOB-2, API-11

- [x] **UI-16** · **View C · Search**, which is two surfaces over one endpoint: the **quick-hits
      dropdown** anchored under the nav search field for the three-second case, and the **full
      search view** that `Enter` and its see-all row lead to, carrying the filters (library, date
      range, duration range, tags, transcription state). Both show transcript results with a context
      fragment, a timestamp, and playback from that exact point **without opening the detail view**.
      Several matches in one recording are grouped under it, three shown, "+N more" expands. A
      metadata match has no timestamp and no play-from-here, and needs a form that says so. The
      recall note from `GET /search/about` is shown, not hard-coded. ⇢ UI-5, JOB-10, JOB-11

- [x] **UI-17** · **View D · Library and sharing**: edit name and description, manage the category
      tree, a panel with who has access, at what level, who granted it and when, and the level
      selector **explained in plain language**, rendered from the API's own `level_description` so
      the wording cannot drift. Library-level grants only in v0. ⇢ UI-4, API-8, API-15

- [x] **UI-18** · **View E · Upload dialog**: drag and drop, multiple files, per-file progress,
      destination (library + category), the transcription request from `UI-25`, handling of hash
      duplicates and unsupported formats, and **an upload that is not lost when switching tabs**.
      ⇢ UI-4, ING-2, ING-3, UI-25

- [x] **UI-19** · **View F · Move audio dialog** — its own design, because it has non-obvious
      consequences. It must explicitly warn that it will change who can see the audio and that the
      category will be lost. ⇢ UI-13, ING-10

- [x] **UI-20** · **View G · Settings**, one destination with sections rather than a scattering of
      screens: **Account** (display name, email, password change), **Sessions** (every active
      sign-in with the current one marked and not revocable by mistake, revoke one or sign out
      everywhere), **Appearance** (language, and theme as light / dark / follow the system), and —
      only when `is_admin` — **Administration** from `INT-3`, which keeps its own chrome inside so
      nobody wanders into it. **There are no avatar images**: no storage exists for one and fetching
      one from an external service would violate principle 2, so identity is initials or a derived
      mark. Tokens are not in v0. ⇢ UI-4, API-3, API-13

- [x] **UI-21** · **View J · Authentication**: local sign-in, and the first-run screen that creates
      the initial administrator when `GET /instance` reports the instance needs bootstrapping.
      **There is no sign-up path and the screen must not imply one** — registration is
      administrator-only in v0, so the design system's app kit, whose login screen offers to create
      an account, is wrong here and is not copied forward. Wrong credentials, an unknown address and
      a disabled account are **indistinguishable on purpose**; rate-limiting is a real state.
      ⇢ API-3, API-7

- [x] **UI-22** · i18n plumbing: English as the base, **every literal externalised**, localised date
      and duration formatting. Shipping actual translations is a later milestone; making them
      possible without touching components is v0. ⇢ UI-4

- [x] **UI-23** · Accessibility as the floor: visible keyboard focus, `prefers-reduced-motion`
      respected, AA contrast, full keyboard navigation of the player and the transcript.
      ⇢ UI-12 🧪 axe audit on every view.

- [x] **UI-24** · A real mobile-first pass: much of the consumption happens on a phone, with
      headphones, on the move. Gestures, touch target sizes, and the player coexisting with the
      system controls. PWA installability and offline behaviour are a later milestone. ⇢ UI-23

- [x] **UI-25** · **External transcription disclosure** — principle 2 made visible. Wherever a
      transcription is requested, the interface names **which provider the audio will be sent to**
      and that it will leave the instance, before the request is made; per `DEC-9`, the
      administration view says the same thing for every watched folder configured to transcribe on
      arrival. No silent egress anywhere, including the retry path. ⇢ UI-13, JOB-2, API-12 🧪
      *This is the one principle with no other implementing task. Without it, principle 2 is a
      sentence in a document rather than a property of the software.*

The four below were found while decomposing this track into session-sized
work. They are registered here because this document hands out the numbers, and an identifier that
lives in only one of the two would eventually be handed out twice. Their tasks are written out
there, not here.

- [x] **UI-32** · **The CSS interaction layer.** The design system is written entirely in inline
      style objects, so `:hover`, `:focus-visible`, `:active` and `@media` cannot be expressed at
      all — which means the interaction rules its README states, the single focus treatment `UI-23`
      requires and the 44px hit targets the accessibility floor demands are documented and none of
      them is implemented. ⇢ UI-1 🧪
- [x] **UI-33** · **Token reconciliation.** Six values in shipped components bypass the tokens, and
      four token groups the views need — a z-index scale, breakpoints, a disabled opacity, border
      widths — do not exist. ⇢ UI-1 🧪
- [x] **UI-34** · **The thirteen components the design system owes**, named by the interface
      specification's §5 and drawn in the prototype. `UI-1` is a porting task; authoring thirteen
      new components with keyboard and positioning behaviour is not porting. ⇢ UI-32
- [x] **UI-35** · **The ten composites the prototype invented** — the filter bar, the bulk bar, the
      upload tray, the skeletons and the rest. Each exists once as markup inside a single artboard,
      and each is needed by three or more views. ⇢ UI-34


### Four parents this track did not have

Decomposing the work above into session-sized pieces needed four identifiers Track C never named.
They are parents, not new scope: each covers work the views assume exists.

| New parent | What it covers | Why it had no parent |
| --- | --- | --- |
| `UI-32` | The CSS interaction layer | The system is written entirely in inline style objects, so `:hover`, `:focus-visible`, `:active` and `@media` cannot be expressed at all. `UI-23` assumes they can |
| `UI-33` | Token reconciliation | Six values in shipped components bypass the tokens, and four token groups the views need do not exist |
| `UI-34` | The thirteen components the system owes | `UI-1` is a porting task. Authoring thirteen new components with keyboard and positioning behaviour is not porting |
| `UI-35` | The ten composites the prototype invented | Named nowhere. They are the reason a view is a hundred lines instead of six hundred |

---

## Phase C · The design system

The largest block, and the one that decides how much every view after it costs. Four workstreams:
convert what exists, fix what bypasses the tokens, add the CSS the inline styles cannot express,
and author the twenty-three components that do not exist yet.

### C.1 · Convert what exists (UI-1)

Twenty-one components, 822 lines of `.jsx`, each with a `.d.ts` beside it that already documents
its props. This is transcription with a type checker watching, not redesign. **No visual change is
allowed in these tasks** — if a component looks different afterwards, something was ported wrong.

- [x] **UI-1a** · Self-host Geist and Geist Mono from the `geist` package and delete the Google
      Fonts `@import` from `tokens/fonts.css`. Chillax is already shipped as a variable woff2.
      _Done when:_ the interface renders with the network blocked. An archive that phones out to
      Google to draw itself breaks in an air-gapped deployment and reads badly everywhere else.

- [x] **UI-1b** · Replace the CDN Lucide with `lucide-react` and rewrite `Icon`. The `name` string
      API stays — `Icon` is the one file that changes if a real icon set ever arrives — but the
      `createIcons` effect and the `window.lucide` dependency go.
      _Done when:_ no HTML file loads a script from unpkg, and every documented glyph name still
      resolves. 🧪 an unknown name fails loudly in development rather than rendering nothing

- [x] **UI-1c** · Tokens as the entry point: keep the seven CSS files as the source of truth, link
      `styles.css` from the app entry, and add the `index.ts` barrel the adherence config already
      mandates. Export the token names as a typed union so a typo is a compile error.
      _Done when:_ the app imports from `@/design-system` and nothing reaches into `components/**`.

- [x] **UI-1d** · Convert `components/foundation/` — `Icon`, `Logo`. ⇢ UI-1b, UI-1c
- [x] **UI-1e** · Convert `components/forms/` — `Button`, `IconButton`, `TextField`, `SearchField`,
      `ColorSwatchPicker`. `TextField` and `SearchField` use `defaultValue` today, so `TopNav`'s
      `query` prop cannot drive the field: make them controlled. ⇢ UI-1c
- [x] **UI-1f** · Convert `components/media/` — `Waveform`, `PlayerBar`, `TranscriptLine`. The
      waveform's own defects are `UI-2`, not here. ⇢ UI-1c
- [x] **UI-1g** · Convert `components/data/` — `StateBadge`, `Chip`, `LibraryCard`,
      `CreateLibraryCard`, `RecordingRow`, `RecordingCard`. Strip the real-looking default props
      (a person's name, a recording's title) so a forgotten prop is visibly empty rather than
      plausible. ⇢ UI-1c
- [x] **UI-1h** · Convert `components/navigation/` — `TopNav`, `Sidebar`, `ProfileMenu`,
      `SearchResults`, `Dialog`. `Item` and `GroupLabel` inside `Sidebar` stay unexported.
      ⇢ UI-1c

- [x] **UI-1i** · 🧪 The tokens-only guard: a test that fails if a hex colour, an `rgb()`, an
      `hsl()` or a font-family string appears anywhere under `components/`. Port the three rules
      the shipped `_adherence.oxlintrc.json` already encodes into ESLint as well, so the failure
      arrives while typing and not only in CI.
      _Done when:_ introducing `#FF0000` into a component fails two checks.

- [x] **UI-1j** · The theme provider: `light` / `dark` / follow-the-system and nothing else. An
      explicit choice writes `data-theme` on the document element and persists **per device** in
      `localStorage`; follow-the-system **writes nothing** and lets `prefers-color-scheme` decide.
      The system ships no `prefers-color-scheme` handling at all today.
      _Done when:_ the choice survives a reload, and clearing it returns to the system's. 🧪 all
      three states, and a `localStorage` that throws

- [x] **UI-1k** · A development-only specimen route rendering the seventeen guideline cards and
      every component in both themes on one page.
      _Done when:_ `UI-1`'s criterion — every component renders in the app in both themes — is
      something you can look at rather than assert. It is also where `UI-33c`'s contrast audit and
      `UI-32c`'s focus check are performed.

- [x] **UI-1l** · Update `frontend/design-system/README.md`: the index gains rows for everything
      Phase C adds, the three _Caveats_ about Geist, Lucide and the kit's login screen are struck
      as closed, and the _Corrections_ section records that `ui_kits/app/` is now provenance rather
      than a starting point.
      _Done when:_ the README describes the system that exists. It is the visual authority; a stale
      authority is worse than none. ⇢ UI-1a, UI-1b, UI-34, UI-35

### C.2 · The waveform (UI-2)

The product's signature element, and the one shipped component with real defects.

- [x] **UI-2a** · Resample instead of truncate. `peaks.slice(0, count)` shows only the **beginning**
      of a recording whenever the stored array is longer than the rendered bar count, which
      contradicts the system's own promise that a recording draws the same shape everywhere.
      Reduce min/max pairs to the available pixel width. Also drop `preserveAspectRatio="none"`,
      which stretches the bars. **The `useId` swap already landed in `UI-1f`** — the React
      Compiler's purity rule refuses a random value read during render, so the conversion could
      not put the original back.
      _Done when:_ the same recording is recognisably the same shape at 20px and at 130px.
      🧪 identical shape across all five heights ⇢ ING-14

- [x] **UI-2b** · The five sizes as named variants reading `--wave-height-*` — 20 dense row, 38
      library card, 52 recording card, 34 player, 130 audio detail — and the geometry from
      `--wave-bar-width`, `--wave-bar-gap-ratio` and `--wave-playhead-width`. All nine tokens exist
      and none of them is currently read; the numbers are re-derived in JavaScript instead.
      _Done when:_ changing a token changes the drawing.

- [x] **UI-2c** · Played and pending bars, the 2px rounded playhead, click-to-seek on the large
      size, and minimum bar height equal to bar width so a silent passage stays a row of dots.
      _Done when:_ silence is visible. 🧪 an all-zero peak array draws dots, not nothing

- [x] **UI-2d** · The `pending` state: a dashed rule and the duration, **never an invented shape**.
      _Done when:_ a recording whose peaks job has not run cannot be made to draw a waveform.
      🧪 `pending` ignores `peaks`, `played` and `playhead`

### C.3 · Token reconciliation (UI-33)

Six values in shipped components bypass the tokens, and four groups the views need do not exist.
Both are cheap now and expensive after thirty views reference them.

- [x] **UI-33a** · The six bypasses: `TextField`'s raw `#C4574A` error ring (which matches no
      token), `Button`'s hard-coded `rgba(232,180,92,.2)` amber glow (which does not flip in light
      mode), `TranscriptLine`'s 14px/1.55 and `borderRadius: 9` (neither on the type scale nor the
      radius scale), the assorted one-off sizes (13.5, 12.5, 11, 10.5px) against a declared
      four-step scale, and `Chip` using `--radius-pill` while `--radius-chip: 8px` sits unused by
      any component.
      _Done when:_ every value in every component is a token, and `--radius-chip` is either used or
      deleted. ⇢ UI-1i

- [ ] **UI-33a1** · The type values came back. `TranscriptLine` and several components written
      after `UI-33a` set raw `lineHeight` and `letterSpacing` instead of reading the scale, and the
      guard cannot see them: `token-adherence` reads colour and font family only. Widening the
      guard is the task rather than the handful of edits, because a rule that holds only while
      somebody remembers it is what produced this second entry. ⇢ UI-33a 🧪

- [x] **UI-33b** · The four missing groups: a **z-index scale** (the player, the tray, dialogs,
      menus, toasts and the scrim all stack today by DOM order), **breakpoint tokens** for 1280 /
      1180 / 900 / 720 (which exist only in specification prose), an **opacity token** for the 0.38
      disabled state, and **border-width** tokens for the 1px / 1.5px / 2px hairlines.
      _Done when:_ no layout number is a literal. ⇢ UI-32a

- [x] **UI-33c** · 🧪 Document `--elevation-card` as the fourth elevation step or fold it into the
      three the README describes, then **audit AA contrast for every semantic token pair in both
      themes as a test**. Never place `--text-3` on anything lighter than `--bg`.
      _Done when:_ a token change that breaks contrast fails CI rather than shipping. ⇢ UI-1k

### C.4 · The CSS interaction layer (UI-32)

Every component is a function returning inline style objects. That makes `:hover`,
`:focus-visible`, `:active`, `@media` and pseudo-elements impossible — so the interaction rules the
README states, the single focus treatment `UI-23` requires and the 44px hit targets the
accessibility floor demands are all documented and none of them is implemented. The specimen boards
faked them with a prototyping harness that does not ship.

- [x] **UI-32a** · Author `components.css`: real selectors for hover, press, focus-visible and
      disabled, values still `var(--token)`, targeting `data-*` attributes on component roots.
      Components keep their inline layout styles and stop trying to own state.
      _Done when:_ hovering a row raises it one surface step without a React state variable.
      ⇢ UI-1d…UI-1h

- [x] **UI-32b** · The single focus treatment — a 2px `--accent` ring at 2px offset — on **every**
      interactive element, and 44px hit targets where the visual is 32 or 34, via a pseudo-element
      rather than by growing the box. `TextField` and `SearchField` currently set `outline: none`
      and give nothing back.
      _Done when:_ nothing focusable is invisible when focused, and nothing tappable is under 44px.
      🧪 a test that walks every component's focusables ⇢ UI-32a
      **Eight controls carry a documented exemption from the 44px floor, and all eight are stacked
      rows.** The pseudo-element cannot be applied to one: a 34px menu row grown to 44 overlaps its
      neighbours by 5px at each edge, so the top of every row belongs to two targets and which one
      a click lands on is settled by DOM order. A full-bleed row is short in one axis and the width
      of a panel in the other. The list is in `focus-and-targets.ts` and is checked in both
      directions, like the colour guard's.

- [ ] **UI-32b1** · The 44px exemption list has outgrown the account of it written here, and one
      entry defers to a task that has since finished. Either an exemption earns a sentence saying
      why it is one, or it stops being exempt; a list nobody reconciles is how a floor quietly
      becomes a suggestion. ⇢ UI-32b

- [x] **UI-32c** · `prefers-reduced-motion` verified end to end: the two duration tokens already
      zero themselves, but the transcript's follow-scroll is a script and has to opt in by itself.
      _Done when:_ with reduced motion set, nothing moves on its own. ⇢ UI-32a

### C.5 · The thirteen components the system owes (UI-34)

Nine primitives and four compositions, drawn in the prototype's second canvas with their states and
geometry, specified in §5. Each lands in its family folder as `.tsx` + `.prompt.md`, with a row in
the README index. Each is one task, and each carries the three invariants the canvas footer
restates: one focus treatment, 44px minimum target, disabled is 0.38 opacity and never a colour
change.

Positioning is the shared unknown. `Select`'s menu, `Menu`, `Tooltip`, `Toast` and `Sheet` all need
an anchoring and escape strategy, and the shipped `ProfileMenu` and `SearchResults` solve it with
`position: absolute` inside their anchors. **`UI-34a` settles it for all of them** — a small
anchored-overlay primitive with focus trapping, `Esc`, outside-click and scroll containment — and
the rest consume it.

- [x] **UI-34a** · The anchored-overlay primitive underneath the five overlay components: portal,
      placement, focus trap, `Esc`, outside click, and inert background. Not itself exported as a
      component in the index. ⇢ UI-32a 🔒

- [ ] **UI-34a1** · `Dialog` announces nothing. `UI-34a` promised a focus trap, `Esc`, an outside
      click and an **inert background**; the trap holds and the background does not, and `Dialog`
      carries no `aria-modal` — so every create, rename, share, move and upload panel is a div a
      screen reader walks straight out of, into a page that is still operable behind it. `Sheet`
      and `TypedConfirm` both have the attribute, which is what makes this an omission rather than
      a position. ⇢ UI-34a 🧪
- [x] **UI-34b** · `Select` — picks one value from a list: the filter bar, sort, the level
      selector, the category picker, playback speed. Not for two or three short options; those are
      chips. States: resting, labelled, disabled, open, focused. ⇢ UI-34a
- [x] **UI-34c** · `Menu` — card and row overflow, library actions, job actions. **An unavailable
      action is absent, never disabled.** Destructive items take `--state-failed`. `ProfileMenu`
      stays a specific dialog and is not refactored onto this. ⇢ UI-34a
- [x] **UI-34d** · `Tabs` — Settings' four sections and the phone metadata sheet. A hairline track
      with a 2px accent bar, no pill track: a pill track reads as a filter.
- [x] **UI-34e** · `Switch` — a setting that takes effect at once. **Never for something that needs
      a Save**, which is why Account's fields are not switches.
- [x] **UI-34f** · `Checkbox` — multiple selection that does not fight the play button: 18px on a
      card in the opposite corner, 16px in its own column in a row, and a **mixed** state for the
      header. ⇢ UI-32a
- [x] **UI-34g** · `Sheet` — the pattern the entire phone layout rests on: the metadata panel and
      the filter bar. Grabber, swipe-down dismissal, focus trap. ⇢ UI-34a
- [x] **UI-34h** · `Toast` — bulk outcomes, an upload finishing, a background failure. Success is
      one line; failure is multi-line with actions. **Never the only place a result exists.**
      ⇢ UI-34a
      **It does not consume `UI-34a` after all.** The anchored overlay places a surface against a
      control and a toast has no anchor; the placement, the polite live region, the stacking and
      the timers are all `UI-35f`'s `ToastRegion`, which is one region for every toast because two
      announcing themselves over each other is a screen reader nobody can follow.
- [x] **UI-34i** · `Progress` — per-file upload progress **and nothing else**. It has **no
      indeterminate mode**, deliberately, so transcription cannot borrow it: transcription has no
      percentage and is described in elapsed time. 🧪 the component has no such prop to reach for
- [x] **UI-34j** · `Tooltip` — a truncated title in full, a technical field's meaning, an icon-only
      control's name. **Never the only place information exists**, and never where the permission
      wording goes. ⇢ UI-34a
- [x] **UI-34k** · `LevelSelector` — Can read / Can edit / Can manage as radio rows **with the
      plain wording visible**, rendering the API's `level_description` rather than a copy of it, so
      the two cannot drift. Owner is never selectable. ⇢ UI-34b
- [x] **UI-34l** · `InlineField` — the metadata panel's workhorse, in three states:
      editable-at-rest, editing, and **read-only because of permission**, which must read as
      deliberately non-editable rather than broken. No box, no pencil, no disabled control. Saves
      on blur. ⇢ UI-32a
- [x] **UI-34m** · `TypedConfirm` — permanent deletion only. States what will be destroyed in
      numbers and requires the exact name typed. Settle case and accent sensitivity, since a
      name is whatever somebody typed and the prototype compares with a bare `===`. 🧪 the action
      cannot fire
      before the match
      **Settled as: NFC-normalised, trimmed, case-insensitive, accent-sensitive.** The first two
      because `À` has two Unicode spellings and phone keyboards add trailing spaces; case-insensitive
      because shift is a typing convention and not part of a name; accent-sensitive because an
      accent is part of the word, and this is the one place where being strict costs a retype and
      being lax costs a library. **The confirm button is drawn and `disabled` rather than absent**
      — `UI-34c`'s rule is for an action you will never be able to take, and this is one you are
      three keystrokes away from.
- [x] **UI-34n** · `EgressNotice` — §3.4's disclosure, in its **three placements** (dialog, panel,
      beside a retry) and its **two registers** (local, calm; off the instance, factual), plus the
      no-provider-configured case. ⇢ API-12

### C.6 · The composites the prototype invented (UI-35)

Ten patterns the prototype builds from inline HTML, each needed by three or more views. Six are
presentational and join the system; four hold data and stay in the application, per `DEC-22`.

- [x] **UI-35a** · `Shell` — the desktop frame: nav 52, sidebar 224 (52 collapsed), content,
      player 64, everything floating in a 12px gap, and the player **absent rather than empty**
      when nothing is playing. Design system. ⇢ UI-33b
- [x] **UI-35b** · `PageHeader` — the Chillax page title, the mono meta line, and right-aligned
      actions. It is also the enforcement point for **one Chillax title per screen and nothing
      else, ever**. Design system.
- [x] **UI-35c** · `StateSlot` — §3.5's state family as three exports: the centred message card
      (icon, title, body, action, footnote), the card skeleton, and the row skeleton. Seven states
      share it: loading, nothing-yet, filter-matched-nothing, error, read-only, partial failure,
      offline. Design system. ⇢ UI-1g
- [x] **UI-35d** · `AvatarStack` — overlapping initials avatars. The prototype uses
      `gap: -6px`, which is not valid CSS, and gets its overlap from a negative margin by accident.
      Design system.
- [x] **UI-35e** · `KeyValueList` — the mono key/value rows used by the technical metadata section,
      the provider card and system status. Design system.
- [x] **UI-35f** · `ToastRegion` — placement above the player, the polite live region, stacking and
      dismissal. `Toast` itself is `UI-34h`. Design system. ⇢ UI-34h, UI-33b
- [x] **UI-35g** · `FilterBar` — the composite shell: a slot row, the divider, the state toggles,
      the sort control and the view switch, with its contents passed in. Used by V3, V4 and V6.
      Application. ⇢ UI-34b, UI-34c
- [x] **UI-35h** · `BulkBar` — the accent-soft bar that replaces the filter bar during a selection.
      **Count only, never names**, because it has to survive 200 selected. Application. ⇢ UI-34f
- [x] **UI-35i** · `UploadTray` — the tray chrome and its collapsed single line; the upload state
      machine is `UI-18e`. Application. ⇢ UI-34i
- [x] **UI-35j** · `ResultGroup` — a recording heading with its matches, three shown and `+N more`.
      Application. ⇢ UI-1g

---

## Phase D · The application spine

Nothing on a screen yet. Everything a screen needs.

### D.1 · The API client (UI-3)

- [x] **UI-3a** · `openapi-typescript` against a committed `openapi.json` snapshot, with an
      `api:types` script and a CI check that the snapshot matches the running app's schema.
      _Done when:_ a backend field rename breaks the frontend build. That is the point: it keeps
      the interface a client of the API rather than a privileged path into it. ⇢ API-1, INF-3a
- [x] **UI-3b** · The typed fetch wrapper: cookie credentials, `application/problem+json` parsed
      into a typed error, and §1.9's rules encoded once — **`detail` is written to be shown to a
      person, so show it**; **404 means "no such thing", including things that exist but are not
      yours, so never render "you do not have permission"**; 409 is a user-resolvable conflict;
      422 belongs next to the field, not in a banner. 🧪 all four ⇢ UI-3a
- [x] **UI-3c** · TanStack Query wiring: a query-key convention, a helper over `Page<T>` that
      exposes `total` before the items arrive, and one invalidation map so a mutation does not
      have to know who cares. ⇢ UI-3b
- [x] **UI-3d** · MSW handlers covering every endpoint, for tests only. The fixtures are
      deliberately generic and deliberately not uniform — a library shared by somebody else, a
      recording whose own time is unknown, one with no waveform yet, a title long enough to wrap,
      and all four transcription states at once. They are the repository's only invented archive;
      the demo instance is built outside it (`DAT-8`).
      _Done when:_ a view test needs no running instance. ⇢ UI-3a

### D.2 · i18n and formatting (UI-22)

Before the views, not after. Retrofitting externalised strings across thirty views is the one
mistake here that cannot be undone cheaply.

- [x] **UI-22a** · i18next with `en` as the base, one namespace per view, and an ESLint rule that
      fails on a bare string literal in JSX. ⇢ INF-3b

- [ ] **UI-22a1** · Three accessible names in the upload tray are English in the source. They are
      `aria-label` values assembled by expression, which is exactly where `UI-22a`'s ESLint rule
      cannot reach: it sees literals, and these are not literals. The copy moves to
      `src/i18n/en/`, and what stops the next one is a test rather than a reviewer. ⇢ UI-22a 🧪
- [x] **UI-22b** · The formatters, once: `48:12` under an hour and `1:12:40` over, `149 h 44 min`
      for totals, counts with thin spaces and never rounded, `284 MB` from `size_bytes`,
      `0.75x`–`2.0x`. All mono, all `tabular-nums`. 🧪 each format ⇢ UI-22a
- [x] **UI-22c** · The two kinds of time, which are **never mixed**: `recorded_at` with its
      `recorded_at_offset` is a wall-clock reading **rendered exactly as written and never
      converted to the viewer's timezone**; everything else is a UTC instant rendered locally.
      `recorded_at_source` is a quiet mono label, not a warning, and a null `recorded_at` falls
      back to `created_at` while **saying plainly that the date shown is not the recording's own**.
      🧪 a recording made in another timezone reads the same everywhere ⇢ UI-22b
- [x] **UI-22d** · A `+30%` pseudo-locale, generated, selectable in development.
      _Done when:_ the string-length check `UI-24c` performs is a switch and not a spreadsheet.

### D.3 · Routing and the shell (UI-4)

- [x] **UI-4a** · The router and §2.1's eight routes **exactly as specified**, the session guard,
      and the not-found route. Public identifiers are UUIDs; a sequential id never appears in a
      URL. `/sign-in` is the only public route, and `GET /api/instance` is the only call made
      without a session. The namespace question this task used to carry is settled by `DEC-24` and
      closed by `API-16`: the API is under `/api`, the interface owns everything else, and
      `backend/tests/api/test_spa.py` asserts the two cannot collide. ⇢ UI-3b, API-16
- [x] **UI-4b** · URL state, exactly as §2.1 divides it. **In the URL:** the search query and its
      filters; a library's `view=list`, category, tags, state toggles and sort; the recording being
      viewed. **Not in the URL:** what is playing and where it is, the tray's contents, whether a
      dialog is open. Upload and move deliberately have no route — an upload that dies on
      navigation is the one thing `UI-18` forbids. 🧪 every filter survives a reload and a back
      button ⇢ UI-4a
- [x] **UI-4c** · The desktop shell assembled from `UI-35a`, with the sidebar auto-collapsing below
      1180 — **before** the card grid drops to two columns at 900, which is why the order matters.
      ⇢ UI-35a, UI-33b
- [x] **UI-4d** · Sidebar wiring: your libraries with the personal one first, then **shared with
      you as a separate group that disappears entirely rather than sitting empty**, then Trash with
      its count and Settings. Administration is not a sidebar entry. ⇢ UI-4c, API-8
- [x] **UI-4e** · TopNav wiring: the search field, the upload button, and the avatar opening
      `ProfileMenu` with the theme toggle, Settings and sign out. ⇢ UI-4c, UI-1j
- [x] **UI-4f** · The phone shell — **not a narrowed desktop**. Four bottom tabs (Libraries,
      Search, Upload, Settings); no nav search field, no upload button, no sidebar toggle; the
      account avatar moves into the per-screen header; the sidebar's contents become the Libraries
      tab; Upload is a tab rather than a modal. Below 720 it replaces the desktop shell entirely.
      ⇢ UI-4c, UI-34g, DEC-23

- [ ] **UI-4f1** · **The phone cannot reach the trash.** `UI-4f` says the sidebar's contents
      become the Libraries tab, and `UI-4d` makes the trash a sidebar entry carrying its count; the
      four tabs are Libraries, Search, Upload and Settings, and nothing under them links to it. A
      recording deleted on a phone can be restored only by typing the URL — the one gesture the
      whole retention promise exists to make safe. `useTrashCount` already has the number.
      ⇢ UI-4f, INT-1a 🧪
- [x] **UI-4g** · §1.8's keyboard model as **one** global handler, not per view: `⌘K`/`Ctrl+K` and
      `/` focus search, `Space` plays and pauses when no field has focus, `←`/`→` seek ∓5s,
      `⇧←`/`⇧→` ∓15s, `↑`/`↓` move transcript segments, `Enter` opens, `Space` toggles a
      selection, `⇧`-click selects a range, `Esc` closes or clears. 🧪 every binding, and none of
      them firing inside an input ⇢ UI-4a, UI-5a

### D.4 · The player (UI-5)

- [x] **UI-5a** · The playback store: **one playback state, two presentations**, surviving every
      route change. Never two waveforms at two scales drifting a frame apart. ⇢ UI-3b
- [x] **UI-5b** · The audio element over `GET /audio/{uuid}/stream` with `Range` requests, the
      session cookie carrying auth. `POST /audio/{uuid}/playback-token` is the **fallback, not the
      default**, because a token in a URL lands in browser history. Seek, ±15s, 0.75×–2× speed.
      🧪 a seek into the last minute of a three-hour file ⇢ UI-5a, ING-7
- [x] **UI-5c** · The three presentations: the full `PlayerBar`; the quiet bar that **drops its
      waveform when the playing recording is the one on screen**, with the note saying which
      waveform moves; and the failed bar, which states the fact and **does not vanish**.
      ⇢ UI-5a, UI-2c
- [x] **UI-5d** · §3.1's six states: nothing playing (the shell reflows, the player is absent),
      buffering (transport present and disabled, position holds), playing or paused, the file will
      not play, still processing (playing the original, said quietly), and no waveform yet
      (position and duration only, no invented shape). ⇢ UI-5c
- [x] **UI-5e** · Media Session API: the title, the library name as artist, **the mark as
      artwork**. It is what makes the lock screen work with headphones on the move. ⇢ UI-5a
- [x] **UI-5f** · The phone player: a compact strip docked directly above the tabs — play/pause,
      title, a hairline progress line, **not** a waveform — expanding on tap to a full-screen
      player and collapsing on swipe down. ⇢ UI-4f, UI-5c

---

## Phase E · The views

In the specification's §7 order, and for the reason it gives: each step depends on the one before.
Within a view, the states are the work, not the happy path.

**A view is done when** it has the desktop layout and the phone layout, every state in its state
table including read-only and **both** empty states, both themes, the focus treatment visible, and
**no field the specification does not list** — a field a design promises and the API cannot fill
becomes a promise somebody has to break.

### E.1 · V2 · Libraries landing (UI-31)

The application's home.

- [x] **UI-31a** · The grid — the create tile first, then a card per library — and the title block's
      count and total duration. Auto-fill from `--card-width`, not a hard three columns.
      ⇢ UI-4c, API-8
- [x] **UI-31b** · `LibraryCard` wiring: name, the user-chosen colour, recording count, total
      duration, and the waveform of the most recent recording **fetched lazily after the cards are
      on screen**, rendering `pending` until it arrives. ⇢ UI-31a, ING-14, UI-2d
- [x] **UI-31c** · The shared-with-you group: separately titled, with the owner and level as a
      byline, **absent entirely when empty**. ⇢ UI-31a
- [x] **UI-31d** · The four states: loading skeletons; the brand-new account, which has exactly one
      library and is **an invitation to upload rather than an empty grid**; error; and unreachable.
      ⇢ UI-31a, UI-35c
- [x] **UI-31e** · The create-library dialog: name, colour, the "nothing is shared until you share
      it" line, and the 409 duplicate name **beside the field**. ⇢ UI-34a, UI-1e

### E.2 · V3 and V4 · A library (UI-6, UI-7, UI-8, UI-9, UI-10)

The screens the product is used from, and the largest view in the plan.

- [x] **UI-6a** · The header: name, owner when shared, recording count, total duration, the avatar
      stack of who has access, and the Settings button **only when you can manage it**. Read-only
      adds one quiet line. ⇢ UI-35b, UI-35d, API-8
- [x] **UI-6b** · The card grid and `RecordingCard` wiring: the **four transcription states
      visually distinguishable without colour**, category, tags with overflow, and a play button on
      the card. ⇢ UI-6a, UI-1g, API-9
- [x] **UI-6c** · Play from a card, and the playing card marked. ⇢ UI-6b, UI-5a
- [x] **UI-7a** · The dense list: a fixed 36px row, virtualised, with the sticky column header and
      **a scrollbar honest about the full 537 before the first page is fetched** — which is why
      every page response carries `total`. ⇢ UI-6b, API-10
- [x] **UI-7b** · Column collapse as width shrinks: tags below 900, category below 800, waveform
      below 700, date below 620. Title, duration, state and play never collapse. ⇢ UI-7a
- [x] **UI-7c** · The waveform column, at 20px, against the downsampled endpoint. Without it, this
      column is unaffordable and is not drawn. ⇢ UI-7a, ING-14, UI-2b
- [x] **UI-7d** · Click-to-sort column headings, and **the same sort as the filter bar's control**
      — one sort, two ways to express it. ⇢ UI-7a, UI-8d, API-10
- [x] **UI-8a** · The category popover holding the tree, assembled client-side from the flat list,
      one selectable. ⇢ UI-35g, UI-34b, API-8
- [x] **UI-8b** · Tag chips and `+ tag`, autocompleting against `GET /tags`, which is **already
      ACL-filtered — the interface does not filter again**. ⇢ UI-35g
- [x] **UI-8c** · The four transcription states as toggles, sharing `StateBadge`'s vocabulary so
      the filter and the badge cannot say different words. ⇢ UI-35g, API-10
- [x] **UI-8d** · The sort control (recording date, upload date, duration, title, each with a
      direction) and the grid/list switch, both in the URL. ⇢ UI-35g, UI-4b, API-10
- [x] **UI-8e** · The phone filter bar: the whole bar collapses into a `Sheet`. A permanent rail was
      rejected on desktop because it drops the grid from three columns to two at 1280; on a phone a
      popover is the only honest form. ⇢ UI-8a, UI-34g, UI-4f
- [x] **UI-9a** · The selection model: a checkbox on cards in the **opposite corner from the play
      button**, its own column in rows, appearing on hover or once a selection exists, with the
      header carrying **mixed**. ⇢ UI-34f, UI-6b, UI-7a
- [x] **UI-9b** · The bulk bar's four actions — assign category, add tag, move, send to trash — plus
      clear. ⇢ UI-35h, UI-9a
- [x] **UI-9c** · Partial failure as a **designed state**, because there is no bulk endpoint and 200
      recordings is 200 requests: report what moved and what did not, **leave the failures
      selected**, and offer Retry N. 🧪 a run where a third fail ⇢ UI-9b, UI-34h, UI-35f
- [x] **UI-9d** · `⇧`-click range selection, `Space` to toggle, `Esc` to clear. ⇢ UI-9a, UI-4g
- [x] **UI-10a** · The **two different empty states**: nothing uploaded yet, an invitation rather
      than a sad drawing; and the filter matched nothing, which **names the filter and offers to
      clear it** while saying how many recordings are there. ⇢ UI-35c, UI-8a

- [ ] **UI-10a1** · Filtering a library by category with nothing matching renders
      `empty.matched.category` — the key itself — because `library.json` has no such key. `UI-10a`
      asks that sentence to **name the filter**, which the tag branch does and this branch never
      could. Both halves land together: the missing key, and the category's own name inside it.
      ⇢ UI-10a 🧪
- [x] **UI-10b** · Loading skeletons for both densities, the error state, and the unreachable state
      in which **what is already buffered keeps playing**. ⇢ UI-35c
- [x] **UI-10c** · Read-only: no checkboxes, no bulk bar, no Settings button, one quiet line. The
      unavailable actions are **absent rather than disabled** — a disabled row of buttons reads as
      a bug, their absence reads as a decision. ⇢ UI-6a, UI-9a

### E.3 · V5 · Audio detail (UI-11, UI-12, UI-13, UI-14, UI-15, UI-25, UI-19)

The most important single screen, and the one whose phone layout is a genuinely different screen.

- [x] **UI-11a** · The breadcrumb, the Chillax title, and the essentials line — date and time,
      duration, uploader, transcript version. ⇢ UI-35b, API-9
- [x] **UI-11b** · The large player panel: the 130px waveform with a playhead and click-to-seek,
      the transport with ±15s, the position and duration, and the speed pill from 0.75× to 2×.
      ⇢ UI-2c, UI-5b
- [x] **UI-11c** · The two-column layout: the transcript taking the full remaining width and a
      320px collapsible panel to its right. ⇢ UI-11a
- [x] **UI-11d** · The trashed band: it can be played and restored, **not edited**, and it says how
      many days are left. ⇢ UI-11a, API-14
- [x] **UI-11e** · Not found — the 404 wording that says it may have been deleted or may never have
      been yours, and that **the instance does not say which**. Never "you do not have permission".
      ⇢ UI-35c, UI-3b
- [x] **UI-11f** · No waveform yet, in the detail view's own words. ⇢ UI-2d
- [x] **UI-11g** · The player panel and what is under it as **one scrolling section**: the waveform
      is what the screen opens with, a scroll takes it away — fading as it goes — and the
      transcript is left the whole column. On a laptop the picture was taking the height the
      reading needed. The column under the player is a full column whatever is in it, so a
      three-line transcript and a recording with no transcript at all do this exactly as a
      forty-minute one does. 🧪 one scrollport and not two, and the waveform can always be
      scrolled away ⇢ UI-11b, UI-11c, UI-12a
- [x] **UI-11h** · The bar takes the waveform over once the panel has faded, decided by
      **visibility and not by the route**: reading a transcript is being on the recording's page
      with no waveform in front of you, which is exactly when the bar has to have one. Two
      thresholds rather than one, so a trackpad's own jitter cannot flip the shape back and forth.
      🧪 the handover, and that it holds inside the dead band ⇢ UI-11g, UI-5c
- [x] **UI-11i** · The title corrected where it is largest, as §V5 has always had it —
      inline-editable as the one Chillax element. A recording's title is the subject's own name
      rather than a label the product chose, and it is most often wrong right where it is biggest:
      a filename nobody looked at, over the waveform of the thing it names. `PageHeader` grows an
      `onTitleSave` and keeps `title` a `string`, so the pencil is the design system's own, at the
      interface's size and never in Chillax — `UI-35b` is about foreign nodes in the display type
      and holds exactly as it did. Two controls over one field, deliberately: the panel is where a
      title is corrected among the other seven, the header where it is corrected because you are
      looking at it. **Absent rather than inert below level 20**, which is `UI-34l`'s rule for the
      panel applied to the title. 🧪 the heading survives the control, the panel agrees after a
      save, and there is no pencil at level 10 ⇢ UI-11a, UI-13a, UI-35b
- [x] **UI-12a** · The transcript: virtualised segments, exactly one active line, click a line to
      seek. `speaker` is usually empty in v0 — accommodate it without depending on it.
      ⇢ UI-11b, JOB-6
- [x] **UI-12b** · 🔒 **Follow and release** — the centre of the product and the easiest thing to
      get subtly wrong. The scroll follows playback, stops the moment the user scrolls, and offers
      to resume with **a persistent band, never a toast that vanishes**. The prototype's reference
      implementation distinguishes its own scroll from the user's with an 80ms flag; keep that.
      🧪 a programmatic scroll does not release, a user scroll does ⇢ UI-12a
- [x] **UI-12c** · `↑`/`↓` between segments, which seek; full keyboard operation; and the follow
      animation opting out under `prefers-reduced-motion`, since it is the only thing on the screen
      that moves by itself. ⇢ UI-12b, UI-4g, UI-32c
- [x] **UI-12d** · The panel header — the segment count, and the hint that clicking a line jumps
      there. **No edit affordance anywhere**: a text cursor promises a manual editor that is a later
      milestone. ⇢ UI-12a
- [x] **UI-13a** · The metadata panel's title and notes as `InlineField`, saving on blur through
      `PATCH /audio/{uuid}` at level 20 or above. ⇢ UI-34l, UI-11c, API-9
- [x] **UI-13b** · Recorded date and time with its provenance label — from the container, from the
      filename, or **from the file's own date, which is not the recording's**. ⇢ UI-13a, UI-22c
- [x] **UI-13c** · Category and tags: clearing a category sends `clear_category: true` rather than a
      null, and tags go as a list of names using **the canonical name from autocomplete rather than
      the one typed**, because the backend owns normalisation and the first writer owns the display
      name. ⇢ UI-13a, UI-34b
- [x] **UI-13d** · The technical section, collapsed: the seven mono fields and a copyable `sha256`,
      which is what makes an original checkable. ⇢ UI-35e
- [x] **UI-13e** · The actions: Download always; Move, Share and Send to trash only when you can
      edit, and **absent rather than disabled** otherwise. ⇢ UI-13a, UI-10c
- [x] **UI-13f** · The phone metadata panel as a **bottom sheet** opened from the essentials line,
      because the transcript needs the full width. ⇢ UI-34g, UI-13a, UI-4f
- [x] **UI-14a** · The transcript selector when there is more than one — model, language, date,
      which is active — and activation through the atomic switch. Without it, re-transcription is
      unreachable from the interface. ⇢ UI-13a, JOB-7, API-11
- [x] **UI-15a** · State `none`: the call to action, and `EgressNotice` **before** the request is
      made. ⇢ UI-34n, API-11, API-12
- [x] **UI-15b** · State `running`: started N minutes ago from `started_at`, the attempt number when
      above one, the provider named, and **no progress bar** — nothing stores a percentage.
      ⇢ UI-15a, JOB-2
- [x] **UI-15c** · State `failed`: **the real error message**, what it means and what to do, the
      retry register of the egress notice, and a retry. The error explains; it does not apologise.
      ⇢ UI-15a, API-11
- [x] **UI-15d** · State `running`: **a way to stop it**. The card that says a transcription is
      happening is the one somebody sits in front of for minutes, and it was the only state with
      nothing to press. Secondary and not a danger -- nothing is destroyed, every transcript the
      recording already had survives -- and **no egress notice beside it**, which is the one
      asymmetry in the component and is deliberate: the disclosure stands in front of the paths
      that send audio, and stopping one sends nothing. ⇢ UI-15b, API-21
- [x] **UI-25a** · 🔒 `EgressNotice` wired to `GET /transcription/destination` in **all three
      placements** — the upload dialog, the detail view's call to action, and beside a retry — for
      every caller and not only administrators. ⇢ UI-34n, API-12
- [x] **UI-25b** · The two registers and the fourth case: local and calm, off the instance and
      factual, and no provider configured. Then 🧪 **a test that fails if any transcription request
      path can be reached without the disclosure** — including the retry. This is principle 2's only
      implementation; without it the principle is a sentence in a document. ⇢ UI-25a
- [x] **UI-19a** · The move dialog: a destination select listing **only libraries you can edit**.
      ⇢ UI-34b, ING-10
- [x] **UI-19b** · The three consequences, stated: who can see them changes, and by name; **the
      category is lost**, because categories belong to the library they were made in; grants on a
      recording individually are kept. Plus the footnote that N recordings is N requests and the
      ones that did not move stay selected. ⇢ UI-19a, UI-9c

### E.4 · V6 · Search (UI-16)

The reason the product exists: two surfaces over one endpoint.

- [x] **UI-16a** · The quick-hits dropdown anchored under the nav field, for the three-second case:
      the top few recordings with the matching line and its timestamp, `⌘K` or `/` to get there,
      `Enter` or the see-all row to leave. ⇢ UI-4e, UI-1h, JOB-10
- [x] **UI-16b** · The full view: the title block with **both numbers** — recordings matched and
      matches found — and pagination with an honest count, because showing the first twenty as if
      they were all is the one thing this screen must not do. ⇢ UI-16a, UI-35b
- [x] **UI-16c** · The filters — library, category, date range, duration range, tags — and the four
      state toggles, now that all four are answerable. ⇢ UI-35g, JOB-11b
- [x] **UI-16d** · Results grouped under the recording, **three matches shown and `+N more`**,
      each match carrying the fragment the database already marked and its timestamp.
      ⇢ UI-35j, JOB-10
      **`+N more` opens the recording rather than expanding here.** This entry asked for an
      expansion and the API settles it the other way: `GET /search` groups the matches and sends
      the best three with `total_matches` beside them, so the fourth match is not on the screen to
      be revealed and expanding would need an endpoint returning every match for one recording.
      There should not be one — past three the question has stopped being _which recording_ and
      started being _where in it_, which is the transcript's screen. `UI-35j` already said so.
- [x] **UI-16e** · 🔒 **Play from a match without leaving the results.** Navigating to the detail
      view would defeat the screen. 🧪 the route does not change ⇢ UI-16d, UI-5a
- [x] **UI-16f** · A metadata match has no timestamp and no play-from-here, and **needs a form that
      says so** rather than a disabled play button. ⇢ UI-16d
- [x] **UI-16g** · The four states — nothing typed, searching, no results, error — and the recall
      note from `GET /search/about` **shown, never copied**, so the wording cannot drift from what
      the index actually does. ⇢ UI-35c, JOB-11

### E.5 · The upload tray and its dialog (UI-18)

- [x] **UI-18a** · The dialog: a drop zone and a picker, multiple files, the accepted formats and
      the size limit read from the instance rather than hard-coded, and the line that video files
      are kept whole and played as audio. ⇢ UI-34a, ING-2

- [ ] **UI-18a1** · **Neither empty state can start an upload.** `UI-10a`'s invitation is an
      invitation with no way to accept it, because `uploadOpen` lives in `AppShell` and nothing
      below it can ask. Lifting that state is the task, and the destination should arrive already
      set to the library being looked at rather than empty. ⇢ UI-18a, UI-10a1
- [x] **UI-18b** · The destination: library and category selects, defaulting to where you came from.
      Upload needs level 20 or above on the destination. ⇢ UI-18a, UI-34b
- [x] **UI-18c** · The transcribe switch with its inline egress line — the disclosure at the moment
      the decision is made. ⇢ UI-18a, UI-34e, UI-25a
- [x] **UI-18d** · The duplicate warning: name the recording that is already there, byte for byte,
      say if it is in the trash, and offer to **restore that one** instead. ⇢ UI-18a, ING-3
- [x] **UI-18e** · The tray: docked above the player, **surviving every navigation** — the one thing
      `UI-18` forbids losing — collapsible to a single line, with per-file `Progress`. ⇢ UI-35i,
      UI-34i, UI-4b
- [x] **UI-18f** · The per-file states — uploading, uploaded, too large with the instance's actual
      limit, waiting — and partial failure as the normal case at thirty files. **Uploads are not
      resumable, so the interface promises nothing**: no pause button, no "resuming". 🧪 no control
      implies resumption ⇢ UI-18e

### E.6 · V7 · Library settings and sharing (UI-17)

- [x] **UI-17a** · Identity: name, description, colour, and the note that recolouring reaches the
      sidebar straight away. ⇢ UI-1e, API-8
- [x] **UI-17b** · Categories: the tree assembled from the flat list, create, rename, re-parent,
      reorder through `ordered_ids`, and a delete that **states the consequence in numbers** —
      those recordings lose their category and are not deleted. ⇢ UI-17a, UI-34c
- [x] **UI-17c** · Who has access: each grant with the person, the level, who granted it and when;
      `LevelSelector` rendering the API's own wording; and a revoke confirm that says what the
      person loses. ⇢ UI-34k, API-8, API-18
      **A level nobody in this library holds has no wording to render**, because
      `level_description` arrives attached to a grant: the API describes the levels in use rather
      than the vocabulary. Until `API-18` answers it once, the selector falls back to the
      interface's own short name — a label, not a second copy of the API's sentence — and every
      description seen on screen is collected, so a library that uses a level explains it.
      _`granted_by` is an id with no name beside it._ The only people this screen can name are the
      owner, the signed-in account and the grantees, so when it cannot, the line says _when_
      instead of inventing a _who_: a wrong name on a permission is worse than no name.
- [x] **UI-17d** · Add a person through the narrow lookup — a full email address, at most one
      result. It is not a directory, and the interface must not look like one. ⇢ UI-17c, API-15
- [x] **UI-17e** · The three variants: the inherited-versus-individual split kept visible even
      though individual sharing is not in v0, because a moved recording can arrive carrying one;
      the personal library, which cannot be deleted or shared away; and shared-at-can-edit, where
      the panel is **read-only rather than absent**. ⇢ UI-17c
- [x] **UI-17f** · Trash this library, and the confirm that counts what goes with it and for how
      long it can come back. ⇢ UI-17a, UI-34a

### E.7 · V1 · Sign in (UI-21)

- [x] **UI-21a** · Local sign-in. **There is no sign-up path and the screen must not imply one** —
      registration is administrator-only in v0, which is why the design system's app kit login
      screen, which offers to create an account, is not copied forward. Compose it so a second
      sign-in path can be added later without a divider drawn for something that is not there.
      ⇢ UI-4a, API-3
- [x] **UI-21b** · First run: when `GET /instance` reports the instance needs bootstrapping, the
      screen creates the initial administrator and says that is what it is doing. ⇢ UI-21a, API-7
- [x] **UI-21c** · The four states: submitting; wrong credentials, an unknown address and a disabled
      account **indistinguishable on purpose**; rate-limited, which is a real state and says the
      limit; and the instance not answering, which is its own message and never "wrong password".
      🧪 the three failures produce one string ⇢ UI-21a

### E.8 · V10 · Settings (UI-20)

One destination with sections, not a scattering of screens.

- [x] **UI-20a** · The shell and its tabs, with Administration present **only** when
      `GET /auth/me` reports `is_admin`. ⇢ UI-34d, UI-4a
- [x] **UI-20b** · Account: display name and email through `PATCH /auth/me`; the password change
      that needs the current one and states the ten-character minimum **before** anything is typed.
      **There are no avatar images** — no storage exists and fetching one externally would violate
      principle 2 — so identity is initials. ⇢ UI-20a, API-13, API-3
- [x] **UI-20c** · Sessions: every active sign-in, the current one marked and **not revocable by
      mistake**, revoke one, and sign out everywhere else — **absent rather than disabled** when
      there is only one session. An unrecognised device shows its raw user-agent, because a wrong
      guess would be worse. ⇢ UI-20a, API-3
- [x] **UI-20d** · Appearance: theme as light, dark or follow the system, stored **per device**
      because it is a property of the screen; and language, which is a working single-option select
      saved against the account. English is its only entry, and it ships that way on purpose — the
      point is proving the round trip before there is a translation to lose. Design it as settled,
      not as unfinished. ⇢ UI-20a, UI-1j, API-13


## Phase F · The cross-cutting pass

Not a tidy-up. Four of these are the criteria the views were declared done against, and they are
checked once everything exists because that is the only point at which they can be.

- [x] **UI-23a** · 🧪 An axe audit as a test **on every view**, in both themes.
      _Done when:_ a new view without one fails CI. ⇢ every view

- [ ] **UI-23a1** · The harness says the upload and move dialogs are "audited where they are
      raised", and no test raises either. `UI-23a`'s criterion — a new view without an audit fails
      CI — is met for the eight routed views and silently unmet for everything behind a trigger.
      The same pass owes the trash with rows in it, the permanent-delete confirmation, and the
      Sessions, Appearance and Administration panels, each of which is audited only in the state
      where it is empty. ⇢ UI-23a 🧪
- [x] **UI-23b** · 🧪 Full keyboard operation of the player and the transcript verified end to end,
      including seeking and moving between segments. ⇢ UI-4g, UI-12c
- [x] **UI-23c** · The focus treatment visible on every interactive element in every view, and AA
      contrast holding in both themes. ⇢ UI-32b, UI-33c
- [x] **UI-24a** · The phone pass, view by view. V3 and V5 are genuinely different screens, not
      narrowed ones, and this is where that is proved. ⇢ UI-4f, UI-13f, UI-8e
- [x] **UI-24b** · Gestures and targets: long-press to select, swipe down to collapse the player, no
      drag-and-drop (the entry point is the system picker), and nothing tappable under 44px.
      Bottom-anchored controls, because much of the listening happens one-handed and walking.
      ⇢ UI-24a, UI-32b
- [x] **UI-24c** · 🧪 The **+30% string pass** using the pseudo-locale. **The filter bar and the
      dense list break first** — check those before anything else. No layout may depend on English
      string length. ⇢ UI-22d, UI-8a, UI-7b

### What the cross-cutting pass found

Four things, and none of them was visible on an English desktop screen. Each was in the product
rather than in a test, which is the argument for doing this pass at all.

- **The libraries landing skipped a heading level.** The owned grid had no heading while the
  shared group below it had one, so the page ran `h1` straight to `h3` and no screen reader could
  outline it. Found only once the audit waited for the cards to draw.
- **Three strings never reached `src/i18n/en/`**: the sidebar's six labels, the waveform's "No
  waveform yet", and — the one that matters — `EgressNotice`, principle 2's only implementation.
  The sentence telling somebody their recording is about to leave the machine was English for
  everybody.
- **A phone could not start a selection.** `UI-9a` reveals the checkbox on hover, on focus, or
  once a selection exists; a phone has none of the three before the first recording is picked.
  `UI-24b` built the long press that closes it.
- **Two card titles were text-height tap targets.** Both took `data-hit-target`.

Two limitations are recorded rather than fixed. `level_description` and the search recall sentence
are **written by the backend**, so the interface renders them in whatever language Python chose;
when a second language ships, those are backend work. And **truncation is still a visual check** —
`text-overflow` clips a string without changing its `textContent`, so no test in any environment
can see it. `?lang=pseudo` in a dev build is the tool, and the `»` ending every string is what
makes a cut one obvious.

### After the pass · the lockup the brand kit finished (UI-36)

The mark was signed off a long way before the wordmark was, so until now the system set the two
beside each other and called it a lockup: a mark that reads as an S, and then the word starting
with another one.

- [x] **UI-36** · 🧪 The lockup as the kit draws it -- the mark standing in for the S, `onarium`
      set after it, one baseline, and the proportions fixed rather than chosen: the wordmark is
      `--type-wordmark-scale` of the mark's height and sits `--type-wordmark-lead` after its ink.
      `size` reaches both halves, because a call site that could size them apart could draw a
      lockup the kit does not contain. It stays live text rather than the kit's PNGs, which is
      what keeps `color` and `[data-theme="light"]` working on it.
      **The word on screen is six letters**, so the lockup is named rather than read: without that
      the nav announces "onarium" to everybody who cannot see it.
      _Done when:_ the nav, the sign-in screen and both brand specimens draw the kit's lockup, and
      a test fails if the halves stop scaling together or the name stops being the product's.
      ⇢ UI-1d, UI-1i

---

## Order of work

Phase A first and in full, because five of its ten gaps decide whether a control exists at all.
`API-12` leads it: until it lands, `UI-25` — the only implementation of the promise that nothing
leaves the instance silently — cannot be built for exactly the non-administrators it protects.

Then B, which is an afternoon.

Then C, which is most of the remaining work and pays for itself in every view after it. Inside C:
`UI-1a`–`UI-1c` before the five conversion tasks; `UI-32a` before `UI-34`, because thirteen new
components authored against inline styles would all need redoing; and `UI-34a` before the five
overlay components that consume it.

Then D, in its own order — the namespace (`API-16`, before the snapshot that would otherwise have
to be regenerated), then the client, then i18n (**before** the views, not after), then the shell,
then the player.

Then E, in the specification's §7 order. Two things inside it can start early against `UI-3d`'s
mocks if a session is short: `UI-21` sign-in and `UI-20b` Account both touch nothing else.

Then F, which cannot start early.

**What can run in parallel:** Phase A's eight tasks are independent of each other **except
`JOB-11b` and `API-10`**, which rewrite and then consume the same filter, in that order. In Phase C, the
five conversion tasks (`UI-1d`–`UI-1h`) touch disjoint folders, and `UI-34b`–`UI-34n` touch one
file each after `UI-34a`. In Phase E, V6 search, V7 sharing, V1 sign-in and V10 settings touch
disjoint routes once the shell exists.

---

## Three the plan never carried

Found by reading the finished product against its own principles rather than against this file,
which is why none of them has a parent here. Each is v0 work: the first because the milestone ends
with somebody who is not me using this, the second because it is the clause the licence was chosen
for, the third because it is the surface a phone offers to install.

- [ ] **UI-37** · The administrator's control for `API-25`, inside `INT-3b`'s users panel: set a
      password, say plainly that every session the account holds is about to end, and show the
      value exactly once, the way an access token will have to be shown, rather than sending it
      anywhere.
      ⇢ API-25, INT-3b

- [ ] **UI-38** · **The instance offers its source.** Section 13 is the clause `AGPL-3.0` was
      chosen over `GPL` for: somebody interacting with this over a network is owed the
      Corresponding Source. A signed-in person is offered no link, no About surface and no licence
      line anywhere, and the only licence string the instance emits points at gnu.org — which is
      the licence text, not the source. One line in Settings naming the version and linking the
      repository closes it. It has to survive being forked, so the link is a build-time fact
      rather than this repository hard-coded. ⇢ UI-20a

- [ ] **UI-39** · The web-app manifest, which nobody has read since it was generated. Both colours
      are `#FFFFFF` in a product whose default is dark, so an installed instance flashes white
      before it goes dark; there is no `start_url`, no `scope` and no `id`; and all three icon
      paths are root-absolute, so they break under the arrangement `OPS-4` documents.
      `display: standalone` means a phone offers to install this, which is the path exit
      criterion 2 names. ⇢ UI-24a, OPS-4

- [x] **UI-40** · **The chromatic family becomes orange.** `DEC-8` chose amber; the brand settled
      on `#E98A5F` and never moved, so the stylesheet, the decision and the mark have disagreed
      with each other ever since — and the README's screenshots (`REL-1`) would have shipped the
      disagreement to everybody. The family rotates 19 degrees toward red with every step's
      saturation and lightness untouched, which puts `400` on the brand value and leaves the ramp
      that was signed off otherwise intact. `clay` moves with it: it sits within two degrees of
      the new accent, and at the 9px a library dot is drawn, hue is the only thing telling them
      apart.
      _Done when:_ no `--amber-*` token survives outside the library ramp, the three mark
      treatments and the lock-screen artwork carry the new value, and `contrast.node.test.ts`
      passes every pair in both themes.

---

## When the interface is done

Not when the tasks are ticked. When:

- the utility threshold passes in a browser, on a phone, with headphones: audio in, transcribed,
  a specific moment found by searching everything, played from that moment;
- every view has its states, both layouts, both themes, and no field the API cannot fill;
- `UI-25b`'s test proves no transcription can be requested anywhere without the disclosure;
- `UI-1i` proves no component contains a colour;
- `UI-23a` proves every view passes axe;
- and the interface renders with the network to everything except the instance blocked.

The rest — installability, offline, a transcript editor, sharing one recording, translations that
are not English — is `ROADMAP.md`, and none of it is allowed to shape a frame here.
