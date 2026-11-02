# The HTTP surface, after the first version

`API-*` — the endpoints the first version did not have. What it built is recorded in
[`docs/v0.1.0-plan/api.md`](../v0.1.0-plan/api.md), and the numbering continues from it: an
identifier is never reused, whichever folder minted it.

Any change here refreshes `frontend/src/api/contract/openapi.json` and the types generated from it
in the same commit, and keeps one msw handler per path that honours the parameters the path
documents.

**Nothing is queued in this track.** What `0.2.0` shipped of it is in
[`docs/v0.2.0-plan/api.md`](../v0.2.0-plan/api.md).
