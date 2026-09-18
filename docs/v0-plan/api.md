# The HTTP surface

`API-*` — sessions, authentication, the error shape, pagination, and one module per resource
group. The web interface is one client of this API among others (principle 4), so it is built
for a documented HTTP surface rather than for whatever the interface happens to need.

## Phase 2 · API skeleton and authentication 🔒

From the end of this phase onwards the four parallel tracks open up.

- [x] **API-1** 🔒 · FastAPI skeleton: configuration through environment variables, uniform errors
      (`type`/`title`/`detail`), pagination, and published OpenAPI. ⇢ DAT-3

- [x] **API-2** 🔒 · Authentication dependency that resolves the user and injects the ACL level into
      every endpoint. **No endpoint checks permissions on its own**, and anything unreadable
      returns **404 rather than 403**. ⇢ API-1, DAT-3 🧪

- [x] **API-3** · Local accounts: login, cookie session (`HttpOnly`/`SameSite=Lax`) carrying an
      opaque `session` id, Argon2id hashing, password change, and revocation of one session or all
      of them. Registration is admin-only in v0. ⇢ API-2, DAT-1 🧪

- [x] **API-7** · Bootstrap: the first user created is an administrator, who then creates the rest
      by hand. ⇢ API-3

- [x] **API-8** · CRUD endpoints for `library`, `category`, `tag` and `share`, with the correct
      levels (sharing requires 30). Library-level shares only in v0; the endpoint shape already
      accepts `audio_id`. Libraries are addressed by `uuid`. ⇢ API-2, DAT-4 🧪

- [x] **API-9** · CRUD endpoints for `audio` (metadata: title, notes, recording date, category,
      tags) at level 20. ⇢ API-8 🧪

**The seven endpoints the interface needs and does not have.** Every one was found by specifying a
view against the API as built and discovering the view could not be drawn. They are listed together
because they share a cause — the interface specification is a client of the API and this is what
being a client uncovered — and because `UI-*` tasks depend on them individually.

- [x] **API-10** · **Filter and sort a library's recordings.** `GET /libraries/{uuid}/audio`
      currently takes only `limit` and `offset`. It gains the parameters search already
      supports — category, tags (all of which must match), the four transcription states,
      recording-date range, duration range — plus a sort over recording date / upload date /
      duration / title with a direction. ⇢ API-9 🧪
      *`UI-8`'s entire filter bar and `UI-7`'s column sort are unbuildable without it, and the two
      must resolve to the same sort.*

- [x] **API-11** · **Request or retry a transcription on an existing recording.** Only possible at
      upload time today. `POST /audio/{uuid}/transcribe` at level 20, with the optional language
      from `JOB-2`'s contract. **A recording with a pending or running job returns 409 rather than
      queueing a second one** — the call to action and the retry button are the same endpoint, and a
      double click must not cost two transcriptions. ⇢ JOB-2, API-9 🧪
      *`UI-15`'s call to action, its retry and re-transcribe all depend on it; so, in practice, does
      `UI-14`, since without it a second transcript can never exist.*

- [x] **API-12** 🔒 · **The transcription destination, readable by any caller.** The provider is
      only visible through the administrator-only `GET /admin/transcription`, so **a non-admin
      cannot be told where their audio is going** — which makes `UI-25` unimplementable for exactly
      the people principle 2 protects. A narrow `GET /transcription/destination` returns the
      provider, the host, whether it is local and whether it is configured, and **nothing else**: no
      credential, no flag about one, no base URL carrying auth. ⇢ JOB-2 🧪
      *This is principle 2's only implementation. Until it exists, "no silent egress" is a sentence
      in a document rather than a property of the software, which is why it carries the lock.*

- [x] **API-13** · **Update your own profile.** Only password change exists. `PATCH /auth/me` takes
      display name, email and language, re-deriving `email_normalised` and answering 409 on a
      collision. Theme is not here: it is per-device and lives in browser storage. ⇢ API-3, DAT-1 🧪

- [x] **API-14** · **Trashed libraries, and retention everybody can read.** Only trashed recordings
      can be listed, and `trash_retention_days` is only on the administrator-only `/admin/status`,
      so a non-admin cannot be told how long anything has left. Add `GET /trash/libraries` mirroring
      `/trash/audio`, and put `trash_retention_days` on `GET /instance`, where instance facts
      already live. ⇢ API-8 🧪
      *`INT-1` shows one list with the time each item has left, and cannot do either half today.*

- [x] **API-15** · **A narrow person lookup for sharing.** Only administrators can list accounts, so
      a non-admin library manager cannot resolve who to share with. `GET /users/lookup` is available
      to anyone holding level 30 on at least one library, matches on the **full normalised email and
      nothing else**, and returns **at most one** account. ⇢ API-8 🧪
      🧪 A prefix or name search would let any library manager enumerate the instance's accounts —
      the same leak `DAT-6`'s ACL-filtered autocomplete exists to prevent. The test is that a
      partial address finds nobody.
      *Sharing needs to confirm one address somebody was given out of band. It does not need a
      directory, and the difference is the whole design of the endpoint.*

- [x] **API-16** · **One namespace for the API, one for the interface.** Every router moves under
      `/api`, and the published document and its viewer move with them. The API is mounted at the
      root today, so the interface's routes and the API's paths are a single namespace that the API
      already occupies — `/search` is the clearest case, but every top-level name the API takes is
      a name a view can never be given. `/healthz` and `/readyz` stay where they are: whatever
      restarts the container probes them, and they are not part of the documented surface.
      *Done when:* a hard refresh on every route in §2.1 reaches the interface, and
      `backend/tests/api/test_spa.py` asserts the two namespaces are disjoint rather than asserting
      where they collide. ⇢ DEC-24 🧪
      *It runs before `UI-3a`, because the snapshot `UI-3a` commits carries every path in it and a
      rename afterwards is a second regeneration plus a second review of the diff.*

- [x] **API-17** · **How a transcription is going, readable by whoever can read the recording.**
      `transcription_state` says which of the four states a recording is in and nothing more, but
      `UI-15b` says how long it has been running and which attempt this is, and `UI-15c` shows
      **the real error text**. All three live on the job, and the only way to read a job was the
      administrator-only `GET /admin/jobs` — which takes no recording to filter by — so on a
      family instance the person whose recording had failed was the one person who could not be
      told why. `GET /audio/{uuid}/transcribe` is the request; this is the answer:
      `GET /audio/{uuid}/transcription` at read level, returning the state, `attempts`,
      `started_at` for the attempt that is actually running, and the last failure's message.
      It reports and reaches out to nothing.
      *Done when:* the three states `UI-15` draws can each be rendered from one request, and a
      reader of somebody else's shared library can ask about a recording they can hear. ⇢ JOB-1,
      API-11 🧪
      *Found while building `UI-15`: §6 assumed the job was readable and no task made it so, which
      is why the identifier comes after `API-16` rather than beside `API-11`.*

- [ ] **API-18** · **The permission vocabulary, so the interface can describe a level nobody
      holds.** `level_description` is sent on a `ShareSummary`, which means the API describes the
      levels **in use** rather than the levels that exist: a library shared with one person at
      `edit` carries that one sentence and no other. `UI-34k`'s whole design is that the selector
      renders the API's wording rather than a copy of it -- so at the moment somebody chooses what
      another person may do, the two options they are not on have nothing to show.
      Add the grantable levels and their descriptions to `GET /instance`, beside the other facts
      about the instance that every view reads rather than hard-codes, from
      `sonarium.core.levels.GRANTABLE` and `DESCRIPTIONS`:

      ```
      levels  [ {"level": 10, "description": "Can read: ..."}, ... ]   READ, EDIT, MANAGE
      ```

      **Owner is not in it.** It is read off `library.owner_id`, a `CHECK` refuses a share row
      carrying it, and an option nobody can ever pick is one `UI-34c` says not to draw.
      `/instance` is answered without a session, and none of this is a secret: it is the product's
      own description of what sharing means.
      *Done when:* `UI-17c`'s level selector renders three sentences with one share in the
      library, and the interface has no copy of the wording left in it. ⇢ API-14, DAT-1 🧪
      *Found while building `UI-17c`: §6 listed nine gaps and this was not one of them, because
      the panel reads correctly for the level somebody already has -- it is the two they might
      change to that are blank. The interface ships a short name in the gap and says so in the
      component, which is a label rather than a second copy of the sentence and is exactly the
      drift `UI-34k` exists to prevent.*

- [x] **API-19** · **Emptying the trash now, rather than at the end of the month.** Deletion is
      always a trash with retention (principle 5), and `INT-2` empties it on a schedule -- but
      `INT-1` offers **Delete now** behind a typed confirmation, and there is no endpoint under it.
      `DELETE /audio/{uuid}` and `DELETE /libraries/{uuid}` both trash, deliberately: *"there is no
      immediate hard delete anywhere"*. So the one destructive gesture the interface draws is the
      one the API refuses to perform.
      Add it **inside the trash namespace** rather than as a flag on the trashing verb:

      ```
      DELETE /trash/audio/{uuid}       level 20, and only when it is already trashed
      DELETE /trash/libraries/{uuid}   level 30, and it takes the recordings with it
      ```

      Deleting from the trash is what permanent deletion **is**, and putting it there means the
      dangerous call cannot be reached by getting a query parameter wrong on the ordinary one.
      **Something not in the trash answers 404**, not 400: permanent deletion is reachable only
      from the place that lists what it would destroy.
      It reuses `retention.remove_recording` and `storage.delete_recording` rather than opening a
      second delete path -- the row inside the transaction and the files after it, for the reason
      the retention module gives -- so a purge on demand and a purge on schedule cannot drift into
      two answers to the same question.
      *Done when:* `INT-1c`'s `TypedConfirm` has an endpoint, and the numbers it states -- the
      library's `audio_count` and `total_duration_ms` -- are what actually goes. ⇢ INT-2, API-14 🧪
      🧪 A recording that is not trashed cannot be purged; purging a library removes its
      recordings and their files; and the search index no longer matches either.
      *Found while building `INT-1c`: §6 listed nine gaps and this was not one of them, because
      the trash was read as a listing problem. Restore had an endpoint and Delete now never did.*

- [x] **API-20** · **Which accounts are disabled, and which run the instance.** `GET /admin/users`
      answers `UserSummary` -- `id`, `display_name`, `email` -- and the `User` row's `is_admin` and
      `disabled_at` are both dropped by the presenter. `INT-3b` lists accounts and offers
      **disable** or **re-enable**, which is a choice it cannot make without knowing which one the
      account is already in, and it marks administrators, which it cannot see either.
      **Widening `UserSummary` is the wrong fix.** It is what a share and `API-15`'s lookup answer
      with, so `is_admin` on it would tell any library manager who runs the instance -- the same
      class of leak the lookup is deliberately narrow to prevent. Add an administrator-only
      `AdminUser` beside it, answered by the four `/admin/users` routes and nowhere else:

      ```
      id  display_name  email  is_admin  disabled_at  created_at
      ```

      `disabled_at` rather than a boolean, because "disabled since March" is a fact the row has and
      "disabled" is a fact it does not.
      *Done when:* `INT-3b` draws one action per account rather than two, and disable and enable
      answer with the account they changed. ⇢ API-7, INT-3 🧪
      🧪 The shape a share answers with is unchanged, which is what keeps the leak closed.

- [x] **API-21** · **Stop a transcription that is under way.** `API-11` starts one and `API-17`
      says how it is going, and between them a recording could be committed to minutes of a
      provider's time with no way back: the only cancel in the product is `INT-3d`'s, which takes
      a job id and is administrator-only, so on a family instance the person whose hour of audio
      was being sent somewhere was the one person who could not stop it.
      `POST /audio/{uuid}/transcribe/cancel` at level 20 -- the same level as asking, because
      starting and stopping are the same decision about somebody's quota and somebody's audio.
      A recording with nothing in flight answers 409, mirroring the endpoint it undoes.
      **The row is not the whole of it.** A claimed job's handler runs for minutes outside any
      transaction, so cancelling has to reach three places or it reaches none: `finish` and `fail`
      must leave a cancellation standing rather than marking the job done on top of it, and
      `JOB-13`'s loop must ask between parts, or the other ten requests of a twelve-part hour are
      sent after somebody has already stopped it. That last one is principle 2 rather than a
      refund: the audio is what cannot be taken back.
      **Nothing is kept and nothing is resumed.** `cancelled` is not a fifth state -- `JOB-11`
      reads it as `none` -- so the recording returns to its call to action with exactly as much
      transcript as it had before, and asking again queues fresh work.
      *Done when:* a transcription can be stopped from the recording it belongs to, by anybody
      who could have started it, and a job cancelled mid-flight leaves no transcript and is not
      retried. ⇢ API-11, API-17, JOB-13 🧪
      *Found while building `UI-15`: the running card is where somebody sits for minutes, and it
      was the one state in it with nothing to press.*

- [x] **API-24** · 🔒 🧪 **The connection decides whether the session survives it.**
      `SONARIUM_SESSION_COOKIE_SECURE` was a static `true`, so every cookie was marked `Secure`
      and a browser on plain HTTP discarded it without a word — the instance logged a successful
      sign-in, the next request was answered `401`, and `UI-4a`'s guard returned somebody to the
      sign-in screen as though their password were wrong. `Secure` describes the connection and
      not the instance, and one instance is legitimately reached both ways, so it is read per
      request from the scheme a trusted proxy resolved. Three values: `auto` reads the connection,
      `true` pins it *and* refuses a plain-HTTP sign-in before the password is read, `false` pins
      it off. The scheme is read from `X-Forwarded-Proto` for any proxy on a local address, which
      `--forwarded-allow-ips` does not cover by default and a homelab's container-network proxy
      always needs; the address that flag governs stays narrow, because `SEC-3`'s counters are
      keyed on it. **Done when** a session opened over plain HTTP is still there on the next
      request, when a proxy uvicorn did not trust still yields a marked cookie, and when the suite
      no longer sets the flag to make itself work — nine fixtures did, which is why nothing caught
      this.

- [x] **API-22** · **Grants on one recording, not on the library around it.** `GET`, `PUT` and
      `DELETE /api/audio/{uuid}/shares`, and `source` on `ShareSummary` so a row says which of the
      two it came from. The storage needed nothing: `share.audio_id`, its `CHECK` and the partial
      unique index `ux_share_audio` shipped in the first migration, and `audio_acl` has folded
      individual grants into its `MAX()` since `DAT-3`. Nothing could write one, because the
      endpoint was never routed -- so the only way to give somebody a single recording was to give
      them the library it sits in.
      **One list, not two.** "Who has access" has one answer, and a panel showing only the grants
      made here would be as misleading as the library panel is on its own today.
      **Revoking reaches only a grant made here.** Removing an inherited one from a single
      recording would mean writing a denial, and the resolution is a `MAX()` with nothing to
      subtract with; it answers 404, which is what it is.
      **Listing takes manage, where a library's own list takes read.** There the two match --
      somebody who can read a library is in it. An individual grant is the case where they are
      not, and every inherited row names the library, says who administers it, and counts people
      who were never given this recording.
      *Done when:* one recording can be granted, raised and revoked without its library becoming
      visible, and the list says of every row which of the two it came from.
      ⇢ DAT-3, API-7, DEC-25 🧪
      🧪 A grant on a recording does not make its library visible, purging one takes its
      grants with it, and a grantee at read cannot list who else has access.

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

- **API-12** · 🔒 `GET /transcription/destination` — the provider, its host, whether it is
      local, whether it is configured, readable by **any authenticated caller**.
      _Done when:_ a non-admin can be told where their audio goes. Until then `UI-25` — principle
      2's only implementation — is unbuildable for exactly the people it protects. 🧪 a non-admin
      gets the same answer an admin does, minus the credential.

- **API-10** · Filter and sort a library's recordings. `GET /libraries/{uuid}/audio` takes
      today only `limit` and `offset`, newest first. It gains search's filter parameters plus
      `sort` and `direction`.
      _Done when:_ `UI-8`'s filter bar and `UI-7d`'s column sort are expressible as one request.
      🧪 every sort field, both directions, stable under pagination.

- **API-11** · `POST /audio/{uuid}/transcribe`, level 20, 202 with the job, **409 when one is
      already pending or running**.
      _Done when:_ `UI-15a`'s call to action, `UI-15c`'s retry and `UI-14`'s re-transcription have
      an endpoint. 🧪 the 409, because the interface renders it as a state and not as an error.

- **API-13** · `PATCH /auth/me` for display name, email and language. Only the password can be
      changed today.
      _Done when:_ V10's Account and Appearance sections can save. 🧪 email uniqueness against
      `user.email_normalised`, which already exists.

- **API-14** · `GET /trash/libraries` as `Page[LibrarySummary]`, and the instance facts the
      interface reads before it can draw: `trash_retention_days`, `max_upload_bytes` and the
      accepted formats, all added to `GET /instance`.
      _Done when:_ the trash can show one mixed list, everybody — not only admins — can be told how
      long they have, and `UI-18a` can state the size limit without hard-coding it. `/instance` is
      the one call made without a session and already gives out the version; none of these four is
      a secret. The retention half is the cheapest of the ten.

- **API-15** · `GET /users/lookup?email=` — **full normalised email only, at most one result**,
      for any holder of level 30 on at least one library.
      _Done when:_ V7 can add a person without an administrator. It is deliberately not a
      directory: a prefix search would let any library manager enumerate the instance. 🧪 a partial
      address returns nothing, not a list.


### The namespace the interface depends on

Decomposed by the frontend track, because that is where the collision was
found, and kept here because it is the API's own shape.

- **API-16** · Move every router under `/api`, and the published document and its viewer with
      them. `/healthz` and `/readyz` stay at the root; so does `/`. The test that asserts where the
      two namespaces collide becomes the test that asserts they cannot.
      _Done when:_ every route in §2.1 can be hard-refreshed into. ⇢ DEC-24 🧪
