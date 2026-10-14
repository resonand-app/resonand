# The HTTP surface, after the first version

`API-*` — the endpoints the first version did not have. What it built is recorded in
[`docs/v0.1.0-plan/api.md`](../v0.1.0-plan/api.md), and the numbering continues from it: an
identifier is never reused, whichever folder minted it.

Any change here refreshes `frontend/src/api/contract/openapi.json` and the types generated from it
in the same commit, and keeps one msw handler per path that honours the parameters the path
documents.

## Favourites

The feature is introduced in [`data.md`](data.md), beside `DAT-11`.

- [x] **API-26** · 🧪 **Marking a favourite, and every recording saying whether it is one.**
      `PUT /api/audio/{audio_uuid}/favourite` marks it and `DELETE` on the same path unmarks it,
      both `204` and both idempotent, through `DAT-11`'s module; a recording the caller cannot read
      is `404`, as everywhere. The routes depend on `current_caller` and name their parameter
      `audio_uuid`, which is what `test_no_route_escapes_the_acl.py` walks.

      `AudioSummary` gains `is_favourite`, and so `AudioDetail` and every search hit carry it too.
      It is fetched **once per page**, the way `_individually_shared` is, so
      `test_a_page_costs_what_it_shows.py` gains one query and not one per row.

      Like every other API mutation, neither route publishes on `/api/events`: a mark is private,
      so there is nobody else to tell, and the tab that made it invalidates its own cache.

      *Rejected:* a single `POST .../favourite/toggle`. A toggle is not idempotent, so a retry or a
      double click undoes what it was meant to repeat, and the client has to know the state anyway
      to draw the heart.

      🧪 Marking and unmarking answer `204` however often they are repeated; an unreadable or
      trashed recording answers `404` and writes nothing; `is_favourite` is true for the account
      that marked it and false for another account reading the same recording; the page-cost test
      holds at one more query. ⇢ DAT-11

      *Done when:* any client can mark and unmark a recording and read the mark back from every
      shape a recording is presented in, at a cost that does not grow with the page.

- [x] **API-27** · 🧪 **Every recording you can see, filtered and sorted like a library.**
      `GET /api/audio` already lists every readable recording across libraries, and nothing calls
      it, because it takes no filter, no sort and no ordering at all — so its offset paging is not
      even stable. It takes the library listing's `recording_filters` and `recording_sort`, except
      `category_id`, which names a category inside one library and means nothing across several.
      It adds `favourite=true` from `DAT-11`'s filter and `sort=favourited_at`, accepted only with
      `favourite=true` and refused with a problem document otherwise, since a recording that is not
      marked has no such time. The ordering is `_ordering`'s: nulls last, `Audio.id` to break ties.

      `favourite` sits in the shared filters, so the library listing and `GET /api/search` accept it
      too. The interface draws no toggle for it yet; this is what makes one cheap later.

      This is also the listing the roadmap's *Shared with me* needs, which is a reason to build it
      as a general listing rather than as a favourites endpoint.

      *Rejected:* `GET /api/favourites`. It would be a second listing with its own filters to keep
      in step with the first, for a question the general one answers with one parameter.

      🧪 The filters, the sort and the direction each change what comes back; two pages of a
      sorted listing neither repeat nor skip a row; `favourite=true` returns the caller's
      favourites from more than one library and nothing they have lost access to; `favourited_at`
      without `favourite=true` is refused. The msw handler honours `favourite` and the sort, or the
      view built on it cannot be tested. ⇢ DAT-11

      *Done when:* the favourites view can be built on this listing alone, and so can a view of
      recordings shared individually.

## Emptying the trash

What [`ROADMAP.md`](../../ROADMAP.md) called *emptying the trash in bulk*. Today the only way to
destroy something before its retention runs out is `API-19`'s one call per item, which is also why
the trash can only be emptied one row at a time. The view is `INT-8` in
[`integration.md`](integration.md).

- [x] **API-28** · 🧪 **Destroying many things in the trash in one call, and saying first what
      that would destroy.** Three routes, all in the trash namespace for the reason `purge`'s
      docstring gives — the irreversible call is never a flag on the reversible one — and all
      resolving through `acl/query.py` at manage, as `DAT-10` left the trash:

      - `GET /api/trash/summary` — what the caller's trash holds, in the numbers a confirmation
        states: recordings, libraries, total duration, transcripts, and the instant it was counted
        at. The interface cannot add these up itself, because the trash listing is paged.
      - `POST /api/trash/purge` — destroys a selection, given as recording and library uuids. A
        uuid the caller cannot purge — not in the trash, not theirs to manage, already gone — is
        skipped and reported back with the rest, never told apart, for the reason a `404` is never
        a `403` here. A selection over a bound the task sets is refused with `422`.
      - `DELETE /api/trash?trashed_before=<instant>` — empties it. The instant is required, and is
        the one the summary returned: what was sent to the trash after somebody read the numbers is
        not what they agreed to destroy, and is left where it is.

      All three answer the same way `purge_library` already does: a library takes everything in
      it, and a recording inside a library that is also being destroyed is counted once. The rows
      go in the one write session and the files after the commit, as `purge` does today (`REV-1`);
      if the full demo archive shows that holding the write lock for longer than a second, the rows
      are committed in chunks, and the task records the measurement either way.

      **Measured, and no chunks.** The full demo archive with `extras.sh`'s shapes, every
      recording trashed: 250 recordings and a library emptied in one call held the write lock
      for about 0.6 s, and most of that was not the rows. `remove_recording`'s delete synchronised
      the session after each row by scanning every recording already loaded, which made a purge
      of *n* quadratic — the retention purge and `purge_library` included. With that turned off
      the same empty holds the lock for 85 ms, about 0.34 ms a recording, so a second is somewhere
      near 3,000 recordings in one empty. The summary reads the same set in 45 ms. A selection
      is bounded at 500 uuids of each kind, which is `422` past it.

      Each route has a client in `src/api/` and the OpenAPI snapshot and `schema.ts` are
      regenerated in the same commit. `API.md` documents them. ⇢ DAT-10

      🧪 An editor's trash empties nothing they do not manage; a selection mixing a trashed
      recording, a live one and somebody else's destroys only the first and reports the other two
      alike; the summary's numbers match what the purge then destroys; an item trashed after
      `trashed_before` survives the empty; a library and a recording inside it, both selected, are
      destroyed once and counted once; the files are gone from `storage/` afterwards.

      *Done when:* the whole trash, or any part of it, can be destroyed in one call whose effect
      was stated in numbers beforehand, and nothing outside what was stated is touched.
