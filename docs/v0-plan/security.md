# Pre-publication hardening

`SEC-*` — what was fixed in the pass made before this repository became something anybody could
read.

A private repository and a public one have the same code and a different threat model. The pass
that produced this track asked one question of the application — *what does somebody get to try,
now that they can read how it works* — and produced four answers, all of them in the part of the
surface an unauthenticated caller can reach.

None of these were exploited, and none of them are hypothetical either: three are things the code
did, in writing, that a reader of the source would have seen before an operator did.

---

- [x] **SEC-1** · **A ceiling on a request body, enforced before anything reads it.** Every other
      limit runs inside an endpoint, which is to say after the body has arrived: `UploadFile` is a
      spooled temporary file, so by the time `upload` compared anything against
      `SONARIUM_MAX_UPLOAD_BYTES`, the bytes were already on disk — the same disk as the database
      and the originals, because the image points `TMPDIR` into the data volume. Worse, the body
      is parsed *before* the dependency that authenticates the caller, so a request with no
      session at all could put them there. The check moved out to ASGI, where a declared length
      over the ceiling is refused with nothing buffered, nothing parsed and nobody authenticated.
      See [`api/limits.py`](../../backend/sonarium/api/limits.py). 🧪

- [x] **SEC-2** · **The sign-in path stopped answering through the clock.** Every failure returns
      one sentence precisely so the instance cannot be asked which addresses have accounts here —
      and then the code returned early when there was no account, so an address that existed took
      about 80 ms to refuse and one that did not took under 3 ms. That is a difference anybody can
      measure across the internet, and it undoes the single answer completely. There is now a hash
      of a secret nobody holds, computed once at import, verified against when there is nothing
      real to verify against. See [`api/security.py`](../../backend/sonarium/api/security.py). 🧪

- [x] **SEC-3** · **What the sign-in throttle counts against.** Counting per address alone was
      wrong in both directions at once: it throttled nothing, because one client could try sixty
      addresses a minute and never reach a limit, and it was a weapon, because anybody who knew an
      address could spend that address's budget from anywhere and lock its owner out of their own
      account for as long as they cared to. Two counters now, and neither is the address on its
      own — address and client together, and client alone at a higher ceiling. Spraying many
      accounts from many addresses is deliberately not covered: that needs state this process does
      not keep and a view of the network it cannot see, which is the reverse proxy's job.
      See [`api/rate_limit.py`](../../backend/sonarium/api/rate_limit.py). 🧪

- [x] **SEC-4** · **The headers a browser needs in order to defend the page.** Sonarium serves its
      interface, its API and its users' audio from one origin and was sending none of them. Three
      do real work rather than appearing on a list: `frame-ancestors`, because the irreversible
      actions here are a confirmation dialog away and a confirmation dialog in an invisible iframe
      is the oldest trick there is; `nosniff`, because the streaming endpoint serves bytes somebody
      uploaded under a type guessed from the extension they chose; and a `Content-Security-Policy`
      the interface actually complies with. See
      [`api/headers.py`](../../backend/sonarium/api/headers.py). 🧪

---

Two things this pass decided **not** to do, both worth knowing:

**The history was not squashed.** It was checked instead — no secrets across 301 commits,
`docs/internal/` never committed, no machine paths. The commit bodies are half the documentation
of this project, and blame is worth more than a clean slate.

**Private vulnerability reporting is a public-repository feature**, so it could not be enabled
before the repository was public. [`SECURITY.md`](../../SECURITY.md) points at that button, which
is why the order was: make public, enable reporting, then announce.
