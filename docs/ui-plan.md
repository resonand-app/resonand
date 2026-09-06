# Sonarium v0 — UI build plan

The build plan for the interface, task by task. `docs/v0-plan.md` Track C names twenty-six pieces
of frontend work at the altitude of a view; this document is where each of those becomes a list of
things one person can finish in one sitting. Nothing here is new scope. It is the same work, cut
small enough to start.

The interface is drawn. `frontend/design-system/` is the signed-off visual language (`DEC-8`), and
a click-through prototype now exists covering eight routes, six overlays and fifty-six view-states
in both themes. What does not exist is a single line of application code: `frontend/src/` is five
empty directories, there is no `package.json`, and no `.tsx` file exists anywhere in the
repository. This plan starts from that.

## Why this document exists

Three things forced it.

**The prototype is a prototype.** It builds forty-odd screens out of inline HTML on top of eight
of the twenty-one shipped components. Every pattern it invented — the filter bar, the bulk bar, the
upload tray, the skeletons, the empty-state card, the technical metadata rows — exists once, as
markup, inside a single artboard. Ported view by view, each of those becomes one copy per view.
Extracted first, each is written once. That extraction is Phase C and it is the largest single
block of work here.

**The design system owes thirteen components.** The interface specification's §5 named them; the
prototype's second canvas drew all thirteen with their states, their geometry and a "when not to
use it" note each. They are pixel specimens with no props, no keyboard behaviour and no positioning
strategy. They have to be built before the views that need them, or nine views produce nine
one-offs.

**Seven API tasks and one split are prerequisites, not parallel work.** Nine gaps were found when
the views were specified against the backend as built. Four of them only change what the interface
can fetch; five decide whether a control exists at all. They close first.

## How to read it

### Identifiers

Every task carries a **stable identifier** whose parent is the Track C task in `docs/v0-plan.md` it
decomposes: `UI-6a`, `UI-6b`, `UI-6c` are the library grid. The suffix follows the `API-7b`
precedent already in the plan. **Identifiers are never renumbered.** A task that turns out to
belong to Milestone 1 keeps its letter and moves to `ROADMAP.md`, which is why gaps here are
expected and are not mistakes.

Four parents are new, because Track C has no task for them:

| New parent | What it covers | Why it has no parent today |
|---|---|---|
| `UI-32` | The CSS interaction layer | The system is written entirely in inline style objects, so `:hover`, `:focus-visible`, `:active` and `@media` cannot be expressed at all. `UI-23` assumes they can |
| `UI-33` | Token reconciliation | Six values in shipped components bypass the tokens, and four token groups the views need do not exist |
| `UI-34` | The thirteen components the system owes | `UI-1` is a porting task. Authoring thirteen new components with keyboard and positioning behaviour is not porting |
| `UI-35` | The ten composites the prototype invented | Named nowhere. They are the reason a view is a hundred lines instead of six hundred |

Notation is the plan's: `⇢ X, Y` depends on those, `🔒` on the critical path, `🧪` carries a
mandatory test. A task is done when it meets the criterion written next to it, not when it works.

### What one task is

One task is **one branch, one commit, one session**. The branch is the identifier lowercased plus a
slug (`ui-12b-follow-and-release`). The commit is Conventional Commits in the repository's voice,
citing the identifier bare in the body. If a task cannot be finished in a sitting it was cut too
big — say so in the review and split it, keeping the parent letter and adding a number
(`UI-12b1`, `UI-12b2`).

### Where the fields and states come from

**This document is committed, and `docs/internal/design/ui-ux-specification.md` is not.** So this
plan names what to build and points at the section that says what it contains; it does not
reproduce field tables, state tables or copy. Read the specification section cited before starting
a task. In a fresh clone the specification is absent — that is deliberate, and the
`sonarium-design` skill already says to stop rather than guess the fields.

The prototype is the visual and state reference: `docs/internal/design/provenance/Sonarium app
prototype design.zip`. Where the two disagree, **the specification wins** — the prototype was built
from it, not the other way round.

---

## Decisions this plan takes

### DEC-20 · The frontend libraries

Chosen once, here, so no task chooses again.

| Concern | Choice | Why this one |
|---|---|---|
| Build, dev server | **Vite 8** + React 19 + TypeScript strict | Already the decision in `docs/v0-plan.md` and already written into the commented Dockerfile stage |
| Routing | **React Router 7**, declarative mode | Eight routes, and §2.1 puts real state in the URL — the query, the filters, the view mode. Query-param handling is the requirement, not loaders |
| Server state | **TanStack Query 5** | Every list endpoint is `limit`/`offset` with a `total`; caching, invalidation after a mutation, and a known total before the rows arrive are exactly its shape |
| Client state | **Zustand 5** | Three stores that outlive a route: playback, the upload tray, toasts. `UI-5` asks for one playback state with two presentations; a store is that sentence |
| Virtualisation | **TanStack Virtual 3** | 36px rows over 800 recordings, and a few hundred transcript segments |
| i18n | **i18next** + react-i18next | `UI-22` wants every literal externalised and a pseudo-locale for the +30% check |
| Icons | **lucide-react** | Replaces the CDN UMD build and its `createIcons` effect. Bundled, tree-shaken, no outbound request |
| Fonts | The **`geist`** npm package | Ships both faces as woff2. Closes the Google Fonts `@import` that `UI-1` was already told to close |
| Tests | **Vitest** + Testing Library + jsdom; **Playwright** for `INT-6`; **axe-core** in both | Mirrors the backend's arrangement: the same checks locally and in CI |
| Test doubles | **MSW 2** | The API is real by the time views are built, but a view test must not need a running instance |

Nothing here is a framework. Everything is replaceable one file at a time, which is the property
that matters for a project that intends to be maintained by one person for years.

**The row said Vite 6 when this was signed.** By the time `INF-3a` installed it, Vite 6 was the
registry's `previous` tag and 8 was `latest`; Vitest had reached 5 and ESLint 10. The table now
says what actually landed, because a decision record that disagrees with `package-lock.json` is
worse than no record. The exact versions live in the lock file, which is the only place a version
should be written twice.

The one thing that is a ceiling rather than a choice: **TypeScript is 6.0.3 and not 7.**
TypeScript 7 is the Go port, and `typescript-eslint` peer-requires `typescript >=4.8.4 <6.1.0` —
so `INF-3b`, which needs `typescript-eslint`, decides this and not preference. Revisit when
`typescript-eslint` supports it; nothing else in the stack is holding it back.

### DEC-21 · The design system is TypeScript, in place

`frontend/design-system/` **becomes the application's component source**, converted from `.jsx` to
strict `.tsx` where it stands. The hand-written `.d.ts` files fold into the components they
document; the `.prompt.md` files stay, because they are the only record of when not to use a
component. A generated `index.ts` barrel is added — the adherence config that shipped with the
system already forbids reaching into `components/**` and mandates importing from a barrel that was
never authored.

The alternative was `UI-1`'s literal wording: keep the system as a `.jsx` design artifact and port
it into `src/components/ui/`. That produces two copies of twenty-one components with no mechanism
to keep them in step, and the design tool commits nothing upstream, so the re-syncability it would
buy does not exist. `DEC-8` said one system, versioned with the code. This is that.

`UI-1`'s stated scope survives intact: every component, self-hosted Geist, bundled Lucide, and a
test that fails on a hex colour in a component. It said thirty-two; the count is thirty-four, and
`INF-9` is where that gets fixed at the source.

### DEC-22 · Presentational in the system, data-bound in the app

The composites the prototype invented split on one line: **if it can be rendered from props alone
it belongs in `frontend/design-system/`; if it holds a query, a mutation or a store it belongs in
`frontend/src/components/`.** So `Shell`, `PageHeader`, `StateSlot`, `AvatarStack`, `KeyValueList`
and `ToastRegion` join the system. `FilterBar`, `BulkBar`, `UploadTray` and `ResultGroup` do not —
they are application components built out of system primitives.

Without this line, "make it reusable" ends with the design system importing TanStack Query.

### DEC-23 · The phone shell is built from prose

The prototype draws the desktop shell only. The phone shell — four bottom tabs, the docked player
strip that expands, the filter sheet, the metadata sheet — exists as §2.3's prose and ASCII
diagrams plus the `Sheet` component, which was drawn specifically to unblock it. It is built from
that, and `UI-4f`, `UI-5f`, `UI-8e`, `UI-13f` and `UI-24a` are where the phone layout gets decided
in code rather than in a picture. If any of them turns out to need a drawing first, stop and get
one; a phone layout guessed at 375px is cheaper to draw than to rewrite.

### Three repairs before anything cites them (INF-9)

- **`UI-31` names two different things.** It is the libraries landing in `docs/v0-plan.md` and
  shipping actual translations in `ROADMAP.md`. Both documents promise identifiers are never
  renumbered, so one of them is wrong. **`UI-31` stays the libraries landing** — it is the one with
  dependents — and the roadmap's becomes `UI-36`.
- **The component count is stated three ways.** The filesystem holds twenty-one; the design
  system's README enumerates those twenty-one by name without ever stating a number; the
  specification says nineteen, and that `UI-1` will port thirty-two. The filesystem is right:
  **21 shipped + 13 owed = 34**, and `CreateLibraryCard` and `ColorSwatchPicker` are the two that
  arrived after the count was written. **The wrong number exists only in the specification**, which
  is not committed — so this half of the repair lands locally and is invisible to a fresh clone.
- **The four-state search widening had a parent already.** `JOB-11` in `docs/v0-plan.md` promises
  search's transcription state as "all four states, repeatable", and the rest of `JOB-11` is built —
  so the widening is a split of a partly-done task, not a new one. It is **`JOB-11b`**, following
  the `API-7b` precedent, and not `API-10b`: `API-10` is the library grid, and a suffix names its
  parent. Renaming is free only until something cites it, which is now.

`INF-9` makes those three true, in one commit, across `ROADMAP.md`, `docs/v0-plan.md`, this
document and the specification. It also **registers `UI-32`–`UI-35` and `JOB-11b` in
`docs/v0-plan.md`**, which is the numbering authority — an identifier that exists only here is an
identifier the other document will one day hand out twice. Every task below is written against the
repaired numbers.

---

## Phase A · Close the API gaps the interface depends on

Ten gaps, seven existing tasks, one new split. All eight land before the views that need them,
because five of the ten decide whether a control exists at all and a control designed around a
shape that then changes is a rewrite, not a tweak. The shape each one needs is in the
specification's §6.1 — parameter lists and response bodies are written out there.

**The tenth is not in §6.1**, because it was found here rather than there: `UI-18a` is told to read
the size limit and the accepted formats "from the instance rather than hard-coded", and `GET
/instance` carries neither. It is folded into `API-14`, which is already the task that grows
`InstanceState`.

**Two of the eight are not independent.** `JOB-11b` rewrites the filter that `API-10` then wires
into the library grid — the same `Filters`, the same `apply_filters`, the same dependency. `JOB-11b`
goes first. The other six touch disjoint files.

These are backend tasks. They belong to this plan only because the interface cannot be finished
without them.

- [ ] **API-12** · 🔒 `GET /transcription/destination` — the provider, its host, whether it is
      local, whether it is configured, readable by **any authenticated caller**.
      *Done when:* a non-admin can be told where their audio goes. Until then `UI-25` — principle
      2's only implementation — is unbuildable for exactly the people it protects. 🧪 a non-admin
      gets the same answer an admin does, minus the credential.

- [ ] **API-10** · Filter and sort a library's recordings. `GET /libraries/{uuid}/audio` takes
      today only `limit` and `offset`, newest first. It gains search's filter parameters plus
      `sort` and `direction`.
      *Done when:* `UI-8`'s filter bar and `UI-7d`'s column sort are expressible as one request.
      🧪 every sort field, both directions, stable under pagination.

- [ ] **JOB-11b** · Widen `/search`'s `transcription_state` to all four states and make it
      repeatable. It accepts `none|done` today, which is why two of V6's four state toggles are
      drawn visibly disabled in the prototype. The four states are derived, not stored: `done` is an
      active transcript, `running` and `failed` are the `transcribe` job's state, and the filter has
      to read them the way `AudioSummary` already does or the badge and the toggle disagree.
      *Done when:* the same four toggles work in a library and in search. 🧪 repeated parameters
      are a union, not the last one wins; and the filter's answer equals the badge's, state by
      state, over a fixture holding all four.

- [ ] **API-11** · `POST /audio/{uuid}/transcribe`, level 20, 202 with the job, **409 when one is
      already pending or running**.
      *Done when:* `UI-15a`'s call to action, `UI-15c`'s retry and `UI-14`'s re-transcription have
      an endpoint. 🧪 the 409, because the interface renders it as a state and not as an error.

- [ ] **API-13** · `PATCH /auth/me` for display name, email and language. Only the password can be
      changed today.
      *Done when:* V10's Account and Appearance sections can save. 🧪 email uniqueness against
      `user.email_normalised`, which already exists.

- [ ] **API-14** · `GET /trash/libraries` as `Page[LibrarySummary]`, and the instance facts the
      interface reads before it can draw: `trash_retention_days`, `max_upload_bytes` and the
      accepted formats, all added to `GET /instance`.
      *Done when:* the trash can show one mixed list, everybody — not only admins — can be told how
      long they have, and `UI-18a` can state the size limit without hard-coding it. `/instance` is
      the one call made without a session and already gives out the version; none of these four is
      a secret. The retention half is the cheapest of the ten.

- [ ] **API-15** · `GET /users/lookup?email=` — **full normalised email only, at most one result**,
      for any holder of level 30 on at least one library.
      *Done when:* V7 can add a person without an administrator. It is deliberately not a
      directory: a prefix search would let any library manager enumerate the instance. 🧪 a partial
      address returns nothing, not a list.

- [ ] **ING-14** · `GET /audio/{uuid}/waveform?peaks=N`, N capped server-side. **This is a format
      change, not a parameter.** The blob's header stores peaks *per second* in one byte, so a
      48-minute recording reduced to 200 pairs is 0.07 peaks per second — not an integer, not a
      byte, and `encode` refuses it. Version 2 stores `duration_ms` instead, which is the quantity
      that survives resampling; `decode` keeps reading version 1, so nothing has to be recomputed
      and the version byte does the job it was put there for.
      *Done when:* twenty-six dense rows cost twenty-six kilobytes rather than megabytes. A
      48-minute recording stores about 28,800 min/max pairs and V4 draws them into 88 pixels.
      ⇢ ING-5 🧪 the downsample of a downsample is the same shape, and a version 1 blob still reads.

---

## Phase B · The toolchain

Six tasks, none of them interesting, all of them blocking. Three call sites already carry
written-out instructions for turning the frontend on — `Dockerfile`, `.github/workflows/ci.yml` and
`.pre-commit-config.yaml` each explain what they are waiting for and why they are not failing
today. Follow them.

- [ ] **INF-3a** · Vite 6 + React 19 + TypeScript in strict mode, the `@/` path alias, and
      `dev` / `build` / `preview` scripts. `frontend/src/`'s five directories keep their names.
      *Done when:* `npm run build` writes a hashed bundle into `frontend/dist/`, which `.gitignore`
      already expects. ⇢ INF-1

- [ ] **INF-3b** · ESLint (typescript-eslint, react-hooks, jsx-a11y) and Prettier, configured to
      agree with `.editorconfig` and with the backend's line width.
      *Done when:* `npm run lint` and `npm run format:check` pass on an empty app. ⇢ INF-3a

- [ ] **INF-3c** · Vitest + Testing Library + jsdom, with coverage thresholds and a `test:unit`
      script.
      *Done when:* one trivial component test runs in CI. ⇢ INF-3a

- [ ] **INF-3d** · Wire both into `pre-commit` and CI so they fail identically, which is the
      standard the backend already holds itself to.
      *Done when:* the hooks the `.pre-commit-config.yaml` comment promises exist, and
      `ci.yml` grows a `frontend` job. ⇢ INF-3b, INF-3c (amends INF-4, INF-5)

- [ ] **INF-3e** · Turn on the Dockerfile's frontend stage: uncomment the build stage, uncomment
      the `COPY --from=frontend-build` line, delete the backend-only warning at the top. Three
      edits, all in one file, all already marked.
      *Done when:* the image serves the built SPA from `/app/static` and `/readyz` still answers.
      ⇢ INF-3a 🧪 the existing image smoke test also loads the shell

- [ ] **INF-9** · The three repairs above: `UI-36` in `ROADMAP.md`, `JOB-11b` here, the component
      count in the specification, and `UI-32`–`UI-35` plus `JOB-11b` registered in
      `docs/v0-plan.md`.
      *Done when:* `UI-31` means one thing, the component count means one number, and no identifier
      exists in one document and not the other. It runs **before** Phase A rather than beside it,
      because Phase A's commits cite these numbers.

---

## Phase C · The design system

The largest block, and the one that decides how much every view after it costs. Four workstreams:
convert what exists, fix what bypasses the tokens, add the CSS the inline styles cannot express,
and author the twenty-three components that do not exist yet.

### C.1 · Convert what exists (UI-1)

Twenty-one components, 822 lines of `.jsx`, each with a `.d.ts` beside it that already documents
its props. This is transcription with a type checker watching, not redesign. **No visual change is
allowed in these tasks** — if a component looks different afterwards, something was ported wrong.

- [ ] **UI-1a** · Self-host Geist and Geist Mono from the `geist` package and delete the Google
      Fonts `@import` from `tokens/fonts.css`. Chillax is already shipped as a variable woff2.
      *Done when:* the interface renders with the network blocked. An archive that phones out to
      Google to draw itself breaks in an air-gapped deployment and reads badly everywhere else.

- [ ] **UI-1b** · Replace the CDN Lucide with `lucide-react` and rewrite `Icon`. The `name` string
      API stays — `Icon` is the one file that changes if a real icon set ever arrives — but the
      `createIcons` effect and the `window.lucide` dependency go.
      *Done when:* no HTML file loads a script from unpkg, and every documented glyph name still
      resolves. 🧪 an unknown name fails loudly in development rather than rendering nothing

- [ ] **UI-1c** · Tokens as the entry point: keep the seven CSS files as the source of truth, link
      `styles.css` from the app entry, and add the `index.ts` barrel the adherence config already
      mandates. Export the token names as a typed union so a typo is a compile error.
      *Done when:* the app imports from `@/design-system` and nothing reaches into `components/**`.

- [ ] **UI-1d** · Convert `components/foundation/` — `Icon`, `Logo`. ⇢ UI-1b, UI-1c
- [ ] **UI-1e** · Convert `components/forms/` — `Button`, `IconButton`, `TextField`, `SearchField`,
      `ColorSwatchPicker`. `TextField` and `SearchField` use `defaultValue` today, so `TopNav`'s
      `query` prop cannot drive the field: make them controlled. ⇢ UI-1c
- [ ] **UI-1f** · Convert `components/media/` — `Waveform`, `PlayerBar`, `TranscriptLine`. The
      waveform's own defects are `UI-2`, not here. ⇢ UI-1c
- [ ] **UI-1g** · Convert `components/data/` — `StateBadge`, `Chip`, `LibraryCard`,
      `CreateLibraryCard`, `RecordingRow`, `RecordingCard`. Strip the real-looking default props
      (`Martí Colom`, `The house on Carrer Nou`) so a forgotten prop is visibly empty rather than
      plausible. ⇢ UI-1c
- [ ] **UI-1h** · Convert `components/navigation/` — `TopNav`, `Sidebar`, `ProfileMenu`,
      `SearchResults`, `Dialog`. `Item` and `GroupLabel` inside `Sidebar` stay unexported.
      ⇢ UI-1c

- [ ] **UI-1i** · 🧪 The tokens-only guard: a test that fails if a hex colour, an `rgb()`, an
      `hsl()` or a font-family string appears anywhere under `components/`. Port the three rules
      the shipped `_adherence.oxlintrc.json` already encodes into ESLint as well, so the failure
      arrives while typing and not only in CI.
      *Done when:* introducing `#FF0000` into a component fails two checks.

- [ ] **UI-1j** · The theme provider: `light` / `dark` / follow-the-system and nothing else. An
      explicit choice writes `data-theme` on the document element and persists **per device** in
      `localStorage`; follow-the-system **writes nothing** and lets `prefers-color-scheme` decide.
      The system ships no `prefers-color-scheme` handling at all today.
      *Done when:* the choice survives a reload, and clearing it returns to the system's. 🧪 all
      three states, and a `localStorage` that throws

- [ ] **UI-1k** · A development-only specimen route rendering the seventeen guideline cards and
      every component in both themes on one page.
      *Done when:* `UI-1`'s criterion — every component renders in the app in both themes — is
      something you can look at rather than assert. It is also where `UI-33c`'s contrast audit and
      `UI-32c`'s focus check are performed.

- [ ] **UI-1l** · Update `frontend/design-system/README.md`: the index gains rows for everything
      Phase C adds, the three *Caveats* about Geist, Lucide and the kit's login screen are struck
      as closed, and the *Corrections* section records that `ui_kits/app/` is now provenance rather
      than a starting point.
      *Done when:* the README describes the system that exists. It is the visual authority; a stale
      authority is worse than none. ⇢ UI-1a, UI-1b, UI-34, UI-35

### C.2 · The waveform (UI-2)

The product's signature element, and the one shipped component with real defects.

- [ ] **UI-2a** · Resample instead of truncate. `peaks.slice(0, count)` shows only the **beginning**
      of a recording whenever the stored array is longer than the rendered bar count, which
      contradicts the system's own promise that a recording draws the same shape everywhere.
      Reduce min/max pairs to the available pixel width. Also: `useId` for the clip path rather
      than `Math.random()`, and drop `preserveAspectRatio="none"`, which stretches the bars.
      *Done when:* the same recording is recognisably the same shape at 20px and at 130px.
      🧪 identical shape across all five heights ⇢ ING-14

- [ ] **UI-2b** · The five sizes as named variants reading `--wave-height-*` — 20 dense row, 38
      library card, 52 recording card, 34 player, 130 audio detail — and the geometry from
      `--wave-bar-width`, `--wave-bar-gap-ratio` and `--wave-playhead-width`. All nine tokens exist
      and none of them is currently read; the numbers are re-derived in JavaScript instead.
      *Done when:* changing a token changes the drawing.

- [ ] **UI-2c** · Played and pending bars, the 2px rounded playhead, click-to-seek on the large
      size, and minimum bar height equal to bar width so a silent passage stays a row of dots.
      *Done when:* silence is visible. 🧪 an all-zero peak array draws dots, not nothing

- [ ] **UI-2d** · The `pending` state: a dashed rule and the duration, **never an invented shape**.
      *Done when:* a recording whose peaks job has not run cannot be made to draw a waveform.
      🧪 `pending` ignores `peaks`, `played` and `playhead`

### C.3 · Token reconciliation (UI-33)

Six values in shipped components bypass the tokens, and four groups the views need do not exist.
Both are cheap now and expensive after thirty views reference them.

- [ ] **UI-33a** · The six bypasses: `TextField`'s raw `#C4574A` error ring (which matches no
      token), `Button`'s hard-coded `rgba(232,180,92,.2)` amber glow (which does not flip in light
      mode), `TranscriptLine`'s 14px/1.55 and `borderRadius: 9` (neither on the type scale nor the
      radius scale), the assorted one-off sizes (13.5, 12.5, 11, 10.5px) against a declared
      four-step scale, and `Chip` using `--radius-pill` while `--radius-chip: 8px` sits unused by
      any component.
      *Done when:* every value in every component is a token, and `--radius-chip` is either used or
      deleted. ⇢ UI-1i

- [ ] **UI-33b** · The four missing groups: a **z-index scale** (the player, the tray, dialogs,
      menus, toasts and the scrim all stack today by DOM order), **breakpoint tokens** for 1280 /
      1180 / 900 / 720 (which exist only in specification prose), an **opacity token** for the 0.38
      disabled state, and **border-width** tokens for the 1px / 1.5px / 2px hairlines.
      *Done when:* no layout number is a literal. ⇢ UI-32a

- [ ] **UI-33c** · 🧪 Document `--elevation-card` as the fourth elevation step or fold it into the
      three the README describes, then **audit AA contrast for every semantic token pair in both
      themes as a test**. Never place `--text-3` on anything lighter than `--bg`.
      *Done when:* a token change that breaks contrast fails CI rather than shipping. ⇢ UI-1k

### C.4 · The CSS interaction layer (UI-32)

Every component is a function returning inline style objects. That makes `:hover`,
`:focus-visible`, `:active`, `@media` and pseudo-elements impossible — so the interaction rules the
README states, the single focus treatment `UI-23` requires and the 44px hit targets the
accessibility floor demands are all documented and none of them is implemented. The specimen boards
faked them with a prototyping harness that does not ship.

- [ ] **UI-32a** · Author `components.css`: real selectors for hover, press, focus-visible and
      disabled, values still `var(--token)`, targeting `data-*` attributes on component roots.
      Components keep their inline layout styles and stop trying to own state.
      *Done when:* hovering a row raises it one surface step without a React state variable.
      ⇢ UI-1d…UI-1h

- [ ] **UI-32b** · The single focus treatment — a 2px `--accent` ring at 2px offset — on **every**
      interactive element, and 44px hit targets where the visual is 32 or 34, via a pseudo-element
      rather than by growing the box. `TextField` and `SearchField` currently set `outline: none`
      and give nothing back.
      *Done when:* nothing focusable is invisible when focused, and nothing tappable is under 44px.
      🧪 a test that walks every component's focusables ⇢ UI-32a

- [ ] **UI-32c** · `prefers-reduced-motion` verified end to end: the two duration tokens already
      zero themselves, but the transcript's follow-scroll is a script and has to opt in by itself.
      *Done when:* with reduced motion set, nothing moves on its own. ⇢ UI-32a

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

- [ ] **UI-34a** · The anchored-overlay primitive underneath the five overlay components: portal,
      placement, focus trap, `Esc`, outside click, and inert background. Not itself exported as a
      component in the index. ⇢ UI-32a 🔒
- [ ] **UI-34b** · `Select` — picks one value from a list: the filter bar, sort, the level
      selector, the category picker, playback speed. Not for two or three short options; those are
      chips. States: resting, labelled, disabled, open, focused. ⇢ UI-34a
- [ ] **UI-34c** · `Menu` — card and row overflow, library actions, job actions. **An unavailable
      action is absent, never disabled.** Destructive items take `--state-failed`. `ProfileMenu`
      stays a specific dialog and is not refactored onto this. ⇢ UI-34a
- [ ] **UI-34d** · `Tabs` — Settings' four sections and the phone metadata sheet. A hairline track
      with a 2px accent bar, no pill track: a pill track reads as a filter.
- [ ] **UI-34e** · `Switch` — a setting that takes effect at once. **Never for something that needs
      a Save**, which is why Account's fields are not switches.
- [ ] **UI-34f** · `Checkbox` — multiple selection that does not fight the play button: 18px on a
      card in the opposite corner, 16px in its own column in a row, and a **mixed** state for the
      header. ⇢ UI-32a
- [ ] **UI-34g** · `Sheet` — the pattern the entire phone layout rests on: the metadata panel and
      the filter bar. Grabber, swipe-down dismissal, focus trap. ⇢ UI-34a
- [ ] **UI-34h** · `Toast` — bulk outcomes, an upload finishing, a background failure. Success is
      one line; failure is multi-line with actions. **Never the only place a result exists.**
      ⇢ UI-34a
- [ ] **UI-34i** · `Progress` — per-file upload progress **and nothing else**. It has **no
      indeterminate mode**, deliberately, so transcription cannot borrow it: transcription has no
      percentage and is described in elapsed time. 🧪 the component has no such prop to reach for
- [ ] **UI-34j** · `Tooltip` — a truncated title in full, a technical field's meaning, an icon-only
      control's name. **Never the only place information exists**, and never where the permission
      wording goes. ⇢ UI-34a
- [ ] **UI-34k** · `LevelSelector` — Can read / Can edit / Can manage as radio rows **with the
      plain wording visible**, rendering the API's `level_description` rather than a copy of it, so
      the two cannot drift. Owner is never selectable. ⇢ UI-34b
- [ ] **UI-34l** · `InlineField` — the metadata panel's workhorse, in three states:
      editable-at-rest, editing, and **read-only because of permission**, which must read as
      deliberately non-editable rather than broken. No box, no pencil, no disabled control. Saves
      on blur. ⇢ UI-32a
- [ ] **UI-34m** · `TypedConfirm` — permanent deletion only. States what will be destroyed in
      numbers and requires the exact name typed. Settle case and accent sensitivity, since the
      names are Catalan and the prototype compares with a bare `===`. 🧪 the action cannot fire
      before the match
- [ ] **UI-34n** · `EgressNotice` — §3.4's disclosure, in its **three placements** (dialog, panel,
      beside a retry) and its **two registers** (local, calm; off the instance, factual), plus the
      no-provider-configured case. ⇢ API-12

### C.6 · The composites the prototype invented (UI-35)

Ten patterns the prototype builds from inline HTML, each needed by three or more views. Six are
presentational and join the system; four hold data and stay in the application, per `DEC-22`.

- [ ] **UI-35a** · `Shell` — the desktop frame: nav 52, sidebar 224 (52 collapsed), content,
      player 64, everything floating in a 12px gap, and the player **absent rather than empty**
      when nothing is playing. Design system. ⇢ UI-33b
- [ ] **UI-35b** · `PageHeader` — the Chillax page title, the mono meta line, and right-aligned
      actions. It is also the enforcement point for **one Chillax title per screen and nothing
      else, ever**. Design system.
- [ ] **UI-35c** · `StateSlot` — §3.5's state family as three exports: the centred message card
      (icon, title, body, action, footnote), the card skeleton, and the row skeleton. Seven states
      share it: loading, nothing-yet, filter-matched-nothing, error, read-only, partial failure,
      offline. Design system. ⇢ UI-1g
- [ ] **UI-35d** · `AvatarStack` — overlapping initials avatars. The prototype uses
      `gap: -6px`, which is not valid CSS, and gets its overlap from a negative margin by accident.
      Design system.
- [ ] **UI-35e** · `KeyValueList` — the mono key/value rows used by the technical metadata section,
      the provider card and system status. Design system.
- [ ] **UI-35f** · `ToastRegion` — placement above the player, the polite live region, stacking and
      dismissal. `Toast` itself is `UI-34h`. Design system. ⇢ UI-34h, UI-33b
- [ ] **UI-35g** · `FilterBar` — the composite shell: a slot row, the divider, the state toggles,
      the sort control and the view switch, with its contents passed in. Used by V3, V4 and V6.
      Application. ⇢ UI-34b, UI-34c
- [ ] **UI-35h** · `BulkBar` — the accent-soft bar that replaces the filter bar during a selection.
      **Count only, never names**, because it has to survive 200 selected. Application. ⇢ UI-34f
- [ ] **UI-35i** · `UploadTray` — the tray chrome and its collapsed single line; the upload state
      machine is `UI-18e`. Application. ⇢ UI-34i
- [ ] **UI-35j** · `ResultGroup` — a recording heading with its matches, three shown and `+N more`.
      Application. ⇢ UI-1g

---

## Phase D · The application spine

Nothing on a screen yet. Everything a screen needs.

### D.1 · The API client (UI-3)

- [ ] **UI-3a** · `openapi-typescript` against a committed `openapi.json` snapshot, with an
      `api:types` script and a CI check that the snapshot matches the running app's schema.
      *Done when:* a backend field rename breaks the frontend build. That is the point: it keeps
      the interface a client of the API rather than a privileged path into it. ⇢ API-1, INF-3a
- [ ] **UI-3b** · The typed fetch wrapper: cookie credentials, `application/problem+json` parsed
      into a typed error, and §1.9's rules encoded once — **`detail` is written to be shown to a
      person, so show it**; **404 means "no such thing", including things that exist but are not
      yours, so never render "you do not have permission"**; 409 is a user-resolvable conflict;
      422 belongs next to the field, not in a banner. 🧪 all four ⇢ UI-3a
- [ ] **UI-3c** · TanStack Query wiring: a query-key convention, a helper over `Page<T>` that
      exposes `total` before the items arrive, and one invalidation map so a mutation does not
      have to know who cares. ⇢ UI-3b
- [ ] **UI-3d** · MSW handlers covering every endpoint, for tests only. Fixtures come from the
      prototype's sample data, which was written to be plausible for a Catalan family archive.
      *Done when:* a view test needs no running instance. ⇢ UI-3a

### D.2 · i18n and formatting (UI-22)

Before the views, not after. Retrofitting externalised strings across thirty views is the one
mistake here that cannot be undone cheaply.

- [ ] **UI-22a** · i18next with `en` as the base, one namespace per view, and an ESLint rule that
      fails on a bare string literal in JSX. ⇢ INF-3b
- [ ] **UI-22b** · The formatters, once: `48:12` under an hour and `1:12:40` over, `149 h 44 min`
      for totals, counts with thin spaces and never rounded, `284 MB` from `size_bytes`,
      `0.75x`–`2.0x`. All mono, all `tabular-nums`. 🧪 each format ⇢ UI-22a
- [ ] **UI-22c** · The two kinds of time, which are **never mixed**: `recorded_at` with its
      `recorded_at_offset` is a wall-clock reading **rendered exactly as written and never
      converted to the viewer's timezone**; everything else is a UTC instant rendered locally.
      `recorded_at_source` is a quiet mono label, not a warning, and a null `recorded_at` falls
      back to `created_at` while **saying plainly that the date shown is not the recording's own**.
      🧪 a recording made in another timezone reads the same everywhere ⇢ UI-22b
- [ ] **UI-22d** · A `+30%` pseudo-locale, generated, selectable in development.
      *Done when:* the string-length check `UI-24c` performs is a switch and not a spreadsheet.

### D.3 · Routing and the shell (UI-4)

- [ ] **UI-4a** · The router and §2.1's eight routes, the session guard, and the not-found route.
      Public identifiers are UUIDs; a sequential id never appears in a URL. `/sign-in` is the only
      public route, and `GET /instance` is the only call made without a session.
      **Settle the namespace before naming a route.** `INF-3e` serves the shell as a fallback
      registered after every router, so the API keeps every path it already has — and the API is
      mounted at the root, which means a client route spelled like an endpoint *is* the endpoint.
      A hard refresh on `/libraries/<uuid>` reaches `GET /libraries/{uuid}` and answers 401, not
      the shell; both are GET on one path and no ordering fixes it. Either the eight routes avoid
      the API's top-level names, or `/` becomes content negotiation on paths the API owns. The
      first is cheaper and is the one to take unless there is a reason not to.
      `backend/tests/api/test_spa.py` asserts the collision so it cannot be rediscovered.
      ⇢ UI-3b
- [ ] **UI-4b** · URL state, exactly as §2.1 divides it. **In the URL:** the search query and its
      filters; a library's `view=list`, category, tags, state toggles and sort; the recording being
      viewed. **Not in the URL:** what is playing and where it is, the tray's contents, whether a
      dialog is open. Upload and move deliberately have no route — an upload that dies on
      navigation is the one thing `UI-18` forbids. 🧪 every filter survives a reload and a back
      button ⇢ UI-4a
- [ ] **UI-4c** · The desktop shell assembled from `UI-35a`, with the sidebar auto-collapsing below
      1180 — **before** the card grid drops to two columns at 900, which is why the order matters.
      ⇢ UI-35a, UI-33b
- [ ] **UI-4d** · Sidebar wiring: your libraries with the personal one first, then **shared with
      you as a separate group that disappears entirely rather than sitting empty**, then Trash with
      its count and Settings. Administration is not a sidebar entry. ⇢ UI-4c, API-8
- [ ] **UI-4e** · TopNav wiring: the search field, the upload button, and the avatar opening
      `ProfileMenu` with the theme toggle, Settings and sign out. ⇢ UI-4c, UI-1j
- [ ] **UI-4f** · The phone shell — **not a narrowed desktop**. Four bottom tabs (Libraries,
      Search, Upload, Settings); no nav search field, no upload button, no sidebar toggle; the
      account avatar moves into the per-screen header; the sidebar's contents become the Libraries
      tab; Upload is a tab rather than a modal. Below 720 it replaces the desktop shell entirely.
      ⇢ UI-4c, UI-34g, DEC-23
- [ ] **UI-4g** · §1.8's keyboard model as **one** global handler, not per view: `⌘K`/`Ctrl+K` and
      `/` focus search, `Space` plays and pauses when no field has focus, `←`/`→` seek ∓5s,
      `⇧←`/`⇧→` ∓15s, `↑`/`↓` move transcript segments, `Enter` opens, `Space` toggles a
      selection, `⇧`-click selects a range, `Esc` closes or clears. 🧪 every binding, and none of
      them firing inside an input ⇢ UI-4a, UI-5a

### D.4 · The player (UI-5)

- [ ] **UI-5a** · The playback store: **one playback state, two presentations**, surviving every
      route change. Never two waveforms at two scales drifting a frame apart. ⇢ UI-3b
- [ ] **UI-5b** · The audio element over `GET /audio/{uuid}/stream` with `Range` requests, the
      session cookie carrying auth. `POST /audio/{uuid}/playback-token` is the **fallback, not the
      default**, because a token in a URL lands in browser history. Seek, ±15s, 0.75×–2× speed.
      🧪 a seek into the last minute of a three-hour file ⇢ UI-5a, ING-7
- [ ] **UI-5c** · The three presentations: the full `PlayerBar`; the quiet bar that **drops its
      waveform when the playing recording is the one on screen**, with the note saying which
      waveform moves; and the failed bar, which states the fact and **does not vanish**.
      ⇢ UI-5a, UI-2c
- [ ] **UI-5d** · §3.1's six states: nothing playing (the shell reflows, the player is absent),
      buffering (transport present and disabled, position holds), playing or paused, the file will
      not play, still processing (playing the original, said quietly), and no waveform yet
      (position and duration only, no invented shape). ⇢ UI-5c
- [ ] **UI-5e** · Media Session API: the title, the library name as artist, **the mark as
      artwork**. It is what makes the lock screen work with headphones on the move. ⇢ UI-5a
- [ ] **UI-5f** · The phone player: a compact strip docked directly above the tabs — play/pause,
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

- [ ] **UI-31a** · The grid — the create tile first, then a card per library — and the title block's
      count and total duration. Auto-fill from `--card-width`, not a hard three columns.
      ⇢ UI-4c, API-8
- [ ] **UI-31b** · `LibraryCard` wiring: name, the user-chosen colour, recording count, total
      duration, and the waveform of the most recent recording **fetched lazily after the cards are
      on screen**, rendering `pending` until it arrives. ⇢ UI-31a, ING-14, UI-2d
- [ ] **UI-31c** · The shared-with-you group: separately titled, with the owner and level as a
      byline, **absent entirely when empty**. ⇢ UI-31a
- [ ] **UI-31d** · The four states: loading skeletons; the brand-new account, which has exactly one
      library and is **an invitation to upload rather than an empty grid**; error; and unreachable.
      ⇢ UI-31a, UI-35c
- [ ] **UI-31e** · The create-library dialog: name, colour, the "nothing is shared until you share
      it" line, and the 409 duplicate name **beside the field**. ⇢ UI-34a, UI-1e

### E.2 · V3 and V4 · A library (UI-6, UI-7, UI-8, UI-9, UI-10)

The screens the product is used from, and the largest view in the plan.

- [ ] **UI-6a** · The header: name, owner when shared, recording count, total duration, the avatar
      stack of who has access, and the Settings button **only when you can manage it**. Read-only
      adds one quiet line. ⇢ UI-35b, UI-35d, API-8
- [ ] **UI-6b** · The card grid and `RecordingCard` wiring: the **four transcription states
      visually distinguishable without colour**, category, tags with overflow, and a play button on
      the card. ⇢ UI-6a, UI-1g, API-9
- [ ] **UI-6c** · Play from a card, and the playing card marked. ⇢ UI-6b, UI-5a
- [ ] **UI-7a** · The dense list: a fixed 36px row, virtualised, with the sticky column header and
      **a scrollbar honest about the full 537 before the first page is fetched** — which is why
      every page response carries `total`. ⇢ UI-6b, API-10
- [ ] **UI-7b** · Column collapse as width shrinks: tags below 900, category below 800, waveform
      below 700, date below 620. Title, duration, state and play never collapse. ⇢ UI-7a
- [ ] **UI-7c** · The waveform column, at 20px, against the downsampled endpoint. Without it, this
      column is unaffordable and is not drawn. ⇢ UI-7a, ING-14, UI-2b
- [ ] **UI-7d** · Click-to-sort column headings, and **the same sort as the filter bar's control**
      — one sort, two ways to express it. ⇢ UI-7a, UI-8d, API-10
- [ ] **UI-8a** · The category popover holding the tree, assembled client-side from the flat list,
      one selectable. ⇢ UI-35g, UI-34b, API-8
- [ ] **UI-8b** · Tag chips and `+ tag`, autocompleting against `GET /tags`, which is **already
      ACL-filtered — the interface does not filter again**. ⇢ UI-35g
- [ ] **UI-8c** · The four transcription states as toggles, sharing `StateBadge`'s vocabulary so
      the filter and the badge cannot say different words. ⇢ UI-35g, API-10
- [ ] **UI-8d** · The sort control (recording date, upload date, duration, title, each with a
      direction) and the grid/list switch, both in the URL. ⇢ UI-35g, UI-4b, API-10
- [ ] **UI-8e** · The phone filter bar: the whole bar collapses into a `Sheet`. A permanent rail was
      rejected on desktop because it drops the grid from three columns to two at 1280; on a phone a
      popover is the only honest form. ⇢ UI-8a, UI-34g, UI-4f
- [ ] **UI-9a** · The selection model: a checkbox on cards in the **opposite corner from the play
      button**, its own column in rows, appearing on hover or once a selection exists, with the
      header carrying **mixed**. ⇢ UI-34f, UI-6b, UI-7a
- [ ] **UI-9b** · The bulk bar's four actions — assign category, add tag, move, send to trash — plus
      clear. ⇢ UI-35h, UI-9a
- [ ] **UI-9c** · Partial failure as a **designed state**, because there is no bulk endpoint and 200
      recordings is 200 requests: report what moved and what did not, **leave the failures
      selected**, and offer Retry N. 🧪 a run where a third fail ⇢ UI-9b, UI-34h, UI-35f
- [ ] **UI-9d** · `⇧`-click range selection, `Space` to toggle, `Esc` to clear. ⇢ UI-9a, UI-4g
- [ ] **UI-10a** · The **two different empty states**: nothing uploaded yet, an invitation rather
      than a sad drawing; and the filter matched nothing, which **names the filter and offers to
      clear it** while saying how many recordings are there. ⇢ UI-35c, UI-8a
- [ ] **UI-10b** · Loading skeletons for both densities, the error state, and the unreachable state
      in which **what is already buffered keeps playing**. ⇢ UI-35c
- [ ] **UI-10c** · Read-only: no checkboxes, no bulk bar, no Settings button, one quiet line. The
      unavailable actions are **absent rather than disabled** — a disabled row of buttons reads as
      a bug, their absence reads as a decision. ⇢ UI-6a, UI-9a

### E.3 · V5 · Audio detail (UI-11, UI-12, UI-13, UI-14, UI-15, UI-25, UI-19)

The most important single screen, and the one whose phone layout is a genuinely different screen.

- [ ] **UI-11a** · The breadcrumb, the Chillax title, and the essentials line — date and time,
      duration, uploader, transcript version. ⇢ UI-35b, API-9
- [ ] **UI-11b** · The large player panel: the 130px waveform with a playhead and click-to-seek,
      the transport with ±15s, the position and duration, and the speed pill from 0.75× to 2×.
      ⇢ UI-2c, UI-5b
- [ ] **UI-11c** · The two-column layout: the transcript taking the full remaining width and a
      320px collapsible panel to its right. ⇢ UI-11a
- [ ] **UI-11d** · The trashed band: it can be played and restored, **not edited**, and it says how
      many days are left. ⇢ UI-11a, API-14
- [ ] **UI-11e** · Not found — the 404 wording that says it may have been deleted or may never have
      been yours, and that **the instance does not say which**. Never "you do not have permission".
      ⇢ UI-35c, UI-3b
- [ ] **UI-11f** · No waveform yet, in the detail view's own words. ⇢ UI-2d
- [ ] **UI-12a** · The transcript: virtualised segments, exactly one active line, click a line to
      seek. `speaker` is usually empty in v0 — accommodate it without depending on it.
      ⇢ UI-11b, JOB-6
- [ ] **UI-12b** · 🔒 **Follow and release** — the centre of the product and the easiest thing to
      get subtly wrong. The scroll follows playback, stops the moment the user scrolls, and offers
      to resume with **a persistent band, never a toast that vanishes**. The prototype's reference
      implementation distinguishes its own scroll from the user's with an 80ms flag; keep that.
      🧪 a programmatic scroll does not release, a user scroll does ⇢ UI-12a
- [ ] **UI-12c** · `↑`/`↓` between segments, which seek; full keyboard operation; and the follow
      animation opting out under `prefers-reduced-motion`, since it is the only thing on the screen
      that moves by itself. ⇢ UI-12b, UI-4g, UI-32c
- [ ] **UI-12d** · The panel header — the segment count, and the hint that clicking a line jumps
      there. **No edit affordance anywhere**: a text cursor promises a manual editor that is a later
      milestone. ⇢ UI-12a
- [ ] **UI-13a** · The metadata panel's title and notes as `InlineField`, saving on blur through
      `PATCH /audio/{uuid}` at level 20 or above. ⇢ UI-34l, UI-11c, API-9
- [ ] **UI-13b** · Recorded date and time with its provenance label — from the container, from the
      filename, or **from the file's own date, which is not the recording's**. ⇢ UI-13a, UI-22c
- [ ] **UI-13c** · Category and tags: clearing a category sends `clear_category: true` rather than a
      null, and tags go as a list of names using **the canonical name from autocomplete rather than
      the one typed**, because the backend owns normalisation and the first writer owns the display
      name. ⇢ UI-13a, UI-34b
- [ ] **UI-13d** · The technical section, collapsed: the seven mono fields and a copyable `sha256`,
      which is what makes an original checkable. ⇢ UI-35e
- [ ] **UI-13e** · The actions: Download always; Move, Share and Send to trash only when you can
      edit, and **absent rather than disabled** otherwise. ⇢ UI-13a, UI-10c
- [ ] **UI-13f** · The phone metadata panel as a **bottom sheet** opened from the essentials line,
      because the transcript needs the full width. ⇢ UI-34g, UI-13a, UI-4f
- [ ] **UI-14a** · The transcript selector when there is more than one — model, language, date,
      which is active — and activation through the atomic switch. Without it, re-transcription is
      unreachable from the interface. ⇢ UI-13a, JOB-7, API-11
- [ ] **UI-15a** · State `none`: the call to action, and `EgressNotice` **before** the request is
      made. ⇢ UI-34n, API-11, API-12
- [ ] **UI-15b** · State `running`: started N minutes ago from `started_at`, the attempt number when
      above one, the provider named, and **no progress bar** — nothing stores a percentage.
      ⇢ UI-15a, JOB-2
- [ ] **UI-15c** · State `failed`: **the real error message**, what it means and what to do, the
      retry register of the egress notice, and a retry. The error explains; it does not apologise.
      ⇢ UI-15a, API-11
- [ ] **UI-25a** · 🔒 `EgressNotice` wired to `GET /transcription/destination` in **all three
      placements** — the upload dialog, the detail view's call to action, and beside a retry — for
      every caller and not only administrators. ⇢ UI-34n, API-12
- [ ] **UI-25b** · The two registers and the fourth case: local and calm, off the instance and
      factual, and no provider configured. Then 🧪 **a test that fails if any transcription request
      path can be reached without the disclosure** — including the retry. This is principle 2's only
      implementation; without it the principle is a sentence in a document. ⇢ UI-25a
- [ ] **UI-19a** · The move dialog: a destination select listing **only libraries you can edit**.
      ⇢ UI-34b, ING-10
- [ ] **UI-19b** · The three consequences, stated: who can see them changes, and by name; **the
      category is lost**, because categories belong to the library they were made in; grants on a
      recording individually are kept. Plus the footnote that N recordings is N requests and the
      ones that did not move stay selected. ⇢ UI-19a, UI-9c

### E.4 · V6 · Search (UI-16)

The reason the product exists: two surfaces over one endpoint.

- [ ] **UI-16a** · The quick-hits dropdown anchored under the nav field, for the three-second case:
      the top few recordings with the matching line and its timestamp, `⌘K` or `/` to get there,
      `Enter` or the see-all row to leave. ⇢ UI-4e, UI-1h, JOB-10
- [ ] **UI-16b** · The full view: the title block with **both numbers** — recordings matched and
      matches found — and pagination with an honest count, because showing the first twenty as if
      they were all is the one thing this screen must not do. ⇢ UI-16a, UI-35b
- [ ] **UI-16c** · The filters — library, category, date range, duration range, tags — and the four
      state toggles, now that all four are answerable. ⇢ UI-35g, JOB-11b
- [ ] **UI-16d** · Results grouped under the recording, **three matches shown and `+N more`
      expanding**, each match carrying the fragment the database already marked and its timestamp.
      ⇢ UI-35j, JOB-10
- [ ] **UI-16e** · 🔒 **Play from a match without leaving the results.** Navigating to the detail
      view would defeat the screen. 🧪 the route does not change ⇢ UI-16d, UI-5a
- [ ] **UI-16f** · A metadata match has no timestamp and no play-from-here, and **needs a form that
      says so** rather than a disabled play button. ⇢ UI-16d
- [ ] **UI-16g** · The four states — nothing typed, searching, no results, error — and the recall
      note from `GET /search/about` **shown, never copied**, so the wording cannot drift from what
      the index actually does. ⇢ UI-35c, JOB-11

### E.5 · The upload tray and its dialog (UI-18)

- [ ] **UI-18a** · The dialog: a drop zone and a picker, multiple files, the accepted formats and
      the size limit read from the instance rather than hard-coded, and the line that video files
      are kept whole and played as audio. ⇢ UI-34a, ING-2
- [ ] **UI-18b** · The destination: library and category selects, defaulting to where you came from.
      Upload needs level 20 or above on the destination. ⇢ UI-18a, UI-34b
- [ ] **UI-18c** · The transcribe switch with its inline egress line — the disclosure at the moment
      the decision is made. ⇢ UI-18a, UI-34e, UI-25a
- [ ] **UI-18d** · The duplicate warning: name the recording that is already there, byte for byte,
      say if it is in the trash, and offer to **restore that one** instead. ⇢ UI-18a, ING-3
- [ ] **UI-18e** · The tray: docked above the player, **surviving every navigation** — the one thing
      `UI-18` forbids losing — collapsible to a single line, with per-file `Progress`. ⇢ UI-35i,
      UI-34i, UI-4b
- [ ] **UI-18f** · The per-file states — uploading, uploaded, too large with the instance's actual
      limit, waiting — and partial failure as the normal case at thirty files. **Uploads are not
      resumable, so the interface promises nothing**: no pause button, no "resuming". 🧪 no control
      implies resumption ⇢ UI-18e

### E.6 · V7 · Library settings and sharing (UI-17)

- [ ] **UI-17a** · Identity: name, description, colour, and the note that recolouring reaches the
      sidebar straight away. ⇢ UI-1e, API-8
- [ ] **UI-17b** · Categories: the tree assembled from the flat list, create, rename, re-parent,
      reorder through `ordered_ids`, and a delete that **states the consequence in numbers** —
      those recordings lose their category and are not deleted. ⇢ UI-17a, UI-34c
- [ ] **UI-17c** · Who has access: each grant with the person, the level, who granted it and when;
      `LevelSelector` rendering the API's own wording; and a revoke confirm that says what the
      person loses. ⇢ UI-34k, API-8
- [ ] **UI-17d** · Add a person through the narrow lookup — a full email address, at most one
      result. It is not a directory, and the interface must not look like one. ⇢ UI-17c, API-15
- [ ] **UI-17e** · The three variants: the inherited-versus-individual split kept visible even
      though individual sharing is not in v0, because a moved recording can arrive carrying one;
      the personal library, which cannot be deleted or shared away; and shared-at-can-edit, where
      the panel is **read-only rather than absent**. ⇢ UI-17c
- [ ] **UI-17f** · Trash this library, and the confirm that counts what goes with it and for how
      long it can come back. ⇢ UI-17a, UI-34a

### E.7 · V1 · Sign in (UI-21)

- [ ] **UI-21a** · Local sign-in. **There is no sign-up path and the screen must not imply one** —
      registration is administrator-only in v0, which is why the design system's app kit login
      screen, which offers to create an account, is not copied forward. Compose it so a second
      sign-in path can be added later without a divider drawn for something that is not there.
      ⇢ UI-4a, API-3
- [ ] **UI-21b** · First run: when `GET /instance` reports the instance needs bootstrapping, the
      screen creates the initial administrator and says that is what it is doing. ⇢ UI-21a, API-7
- [ ] **UI-21c** · The four states: submitting; wrong credentials, an unknown address and a disabled
      account **indistinguishable on purpose**; rate-limited, which is a real state and says the
      limit; and the instance not answering, which is its own message and never "wrong password".
      🧪 the three failures produce one string ⇢ UI-21a

### E.8 · V10 · Settings (UI-20)

One destination with sections, not a scattering of screens.

- [ ] **UI-20a** · The shell and its tabs, with Administration present **only** when
      `GET /auth/me` reports `is_admin`. ⇢ UI-34d, UI-4a
- [ ] **UI-20b** · Account: display name and email through `PATCH /auth/me`; the password change
      that needs the current one and states the ten-character minimum **before** anything is typed.
      **There are no avatar images** — no storage exists and fetching one externally would violate
      principle 2 — so identity is initials. ⇢ UI-20a, API-13, API-3
- [ ] **UI-20c** · Sessions: every active sign-in, the current one marked and **not revocable by
      mistake**, revoke one, and sign out everywhere else — **absent rather than disabled** when
      there is only one session. An unrecognised device shows its raw user-agent, because a wrong
      guess would be worse. ⇢ UI-20a, API-3
- [ ] **UI-20d** · Appearance: theme as light, dark or follow the system, stored **per device**
      because it is a property of the screen; and language, which is a working single-option select
      saved against the account. English is its only entry, and it ships that way on purpose — the
      point is proving the round trip before there is a translation to lose. Design it as settled,
      not as unfinished. ⇢ UI-20a, UI-1j, API-13

### E.9 · V9 · Trash and Administration (INT-1, INT-3)

- [ ] **INT-1a** · One list with a type marker, **not two sections** — the question is where a thing
      went, not whether it was a library. Sorted closest to being purged first, with the time left
      per item computed from the retention on `/instance`. ⇢ UI-4a, API-14
- [ ] **INT-1b** · A trashed library and its children grouped, and the hard case answered on screen:
      restoring one child alone puts it back in a library that is still in the trash, where you
      would not see it. ⇢ INT-1a, API-14
- [ ] **INT-1c** · Restore, one call per item; and Delete now through `TypedConfirm`, stating
      exactly what is destroyed. ⇢ INT-1a, UI-34m
- [ ] **INT-1d** · The states: items in their last day marked unmistakably, loading, and empty —
      where the good state reads as reassurance rather than as absence. ⇢ INT-1a, UI-35c
- [ ] **INT-3a** · Administration's own chrome inside Settings, so nobody wanders into it: it runs
      the instance for everybody on it, and it says so. ⇢ UI-20a, API-7
- [ ] **INT-3b** · Users: create, disable, re-enable, and the **refusal to delete an owner that
      names the libraries and recordings in the way**. Transferring content between accounts is a
      later task, so until then an account can be disabled but not deleted. ⇢ INT-3a, API-7
- [ ] **INT-3c** · The transcription provider: its fields, the egress notice in its calm register,
      and a test that is **explicit and never automatic** — opening the page contacts nothing. Plus
      the no-provider state, which says plainly that nothing on this instance can be transcribed.
      ⇢ INT-3a, UI-34n, API-7
- [ ] **INT-3d** · The job queue: real errors, `attempts`, and `ready_at` rendered as when the next
      attempt happens; retry and cancel; and an aggregate panel instead of four hundred rows when
      the queue is long. ⇢ INT-3a, JOB-1
- [ ] **INT-3e** · System status, with **the revision comparison as the loudest thing on the page**
      when the database is not where the build expects it — writes may fail or lose data until the
      migrations run. ⇢ INT-3a, UI-35e, API-7

---

## Phase F · The cross-cutting pass

Not a tidy-up. Four of these are the criteria the views were declared done against, and they are
checked once everything exists because that is the only point at which they can be.

- [ ] **UI-23a** · 🧪 An axe audit as a test **on every view**, in both themes.
      *Done when:* a new view without one fails CI. ⇢ every view
- [ ] **UI-23b** · 🧪 Full keyboard operation of the player and the transcript verified end to end,
      including seeking and moving between segments. ⇢ UI-4g, UI-12c
- [ ] **UI-23c** · The focus treatment visible on every interactive element in every view, and AA
      contrast holding in both themes. ⇢ UI-32b, UI-33c
- [ ] **UI-24a** · The phone pass, view by view. V3 and V5 are genuinely different screens, not
      narrowed ones, and this is where that is proved. ⇢ UI-4f, UI-13f, UI-8e
- [ ] **UI-24b** · Gestures and targets: long-press to select, swipe down to collapse the player, no
      drag-and-drop (the entry point is the system picker), and nothing tappable under 44px.
      Bottom-anchored controls, because much of the listening happens one-handed and walking.
      ⇢ UI-24a, UI-32b
- [ ] **UI-24c** · 🧪 The **+30% string pass** using the pseudo-locale. **The filter bar and the
      dense list break first** — check those before anything else. No layout may depend on English
      string length. ⇢ UI-22d, UI-8a, UI-7b
- [ ] **INT-5** · The security pass over the finished client: no token in a URL that persists, no
      privileged path, and the 404-not-403 rule holding everywhere. ⇢ UI-3b
- [ ] **INT-6** · 🧪 Playwright over **the utility threshold itself**: put audio in, have it
      transcribed, find a specific moment by searching everything, and play from that moment. If
      that path passes, the interface does the thing the product exists to do. ⇢ every view

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

Then D, in its own order — the client, then i18n (**before** the views, not after), then the shell,
then the player.

Then E, in the specification's §7 order. Two things inside it can start early against `UI-3d`'s
mocks if a session is short: `UI-21` sign-in and `UI-20b` Account both touch nothing else.

Then F, which cannot start early.

**What can run in parallel:** Phase A's eight tasks are independent of each other **except
`JOB-11b` and `API-10`**, which rewrite and then consume the same filter, in that order. In Phase C, the
five conversion tasks (`UI-1d`–`UI-1h`) touch disjoint folders, and `UI-34b`–`UI-34n` touch one
file each after `UI-34a`. In Phase E, V6 search, V7 sharing, V1 sign-in and V10 settings touch
disjoint routes once the shell exists.

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
