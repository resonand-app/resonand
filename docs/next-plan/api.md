# The HTTP surface, after the first version

`API-*` — the endpoints the first version did not have. What it built is recorded in
[`docs/v0.1.0-plan/api.md`](../v0.1.0-plan/api.md), and the numbering continues from it: an
identifier is never reused, whichever folder minted it.

Any change here refreshes `frontend/src/api/contract/openapi.json` and the types generated from it
in the same commit, and keeps one msw handler per path that honours the parameters the path
documents.

What `0.2.0` shipped of this track is in [`docs/v0.2.0-plan/api.md`](../v0.2.0-plan/api.md).

## Who a library can go to

- [ ] **API-29** · 🧪 **`GET /users` lists everybody a library can be shared with.** Every active
      account but the caller's, ordered by display name regardless of case and accents, as `UserSummary` —
      the shape a share already answers with, so who runs the instance stays administration's. The
      gate is `API-15`'s, holding manage on one library, which `DEC-29` notes every account passes.
      `GET /users/lookup` is marked deprecated in the OpenAPI document and otherwise unchanged.
      ⇢ DEC-29

      🧪 The caller and disabled accounts are left out, the order ignores case and accents, and an entry
      carries `id`, `display_name` and `email` and nothing else.

      *Done when:* a library manager who is not an administrator can learn every account id a
      share can be made to, without typing an address.
