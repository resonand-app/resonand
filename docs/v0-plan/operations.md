# Operations and deployment

`OPS-*` — the image, the configuration, backups, and what an operator can see. An instance
nobody can back up or upgrade is one nobody should trust an archive to.

## Track D · Operations and deployment

- [x] **OPS-1** · Multi-stage `Dockerfile`: frontend build, backend with `ffmpeg`, final image
      without the toolchain, non-root user. ⇢ INF-1

- [x] **OPS-2** · Example `docker-compose.yml` with volumes for the database and the storage, plus a
      documented `.env.example`. ⇢ OPS-1

- [x] **OPS-3** · Configuration **through environment variables only**, validated at startup with
      useful messages (not a stack trace). ⇢ API-1
      *A misconfigured instance now says what to fix, one line per problem, and exits 1 without a
      traceback — checked only on the branch that reads the environment, which is the container's
      entry point and the only place a person wrote the configuration. An empty
      `RESONAND_SECRET_KEY` reads as absent rather than as a zero-length secret, which is what
      `deploy/.env.example` ships and what used to walk past every `is None` guard in front of
      the signer. A missing transcription endpoint is said rather than refused: it costs one
      feature, and refusing would cost the archive.*

- [x] **OPS-4** · **Subdomain and subpath** support (`/resonand`), both tested behind a reverse
      proxy. In v0 because retrofitting a base path into an SPA is genuinely painful, and the
      subpath is the one that always ends up broken. ⇢ OPS-2, UI-4 🧪
      *The prefix stays a fact of the deployment: the bundle is built with a relative base and
      names no prefix anywhere, and the API writes the one it is serving under into the shell's
      `<base href>` as it hands it over. The router reads that back for its `basename` and the
      client for its own, so the three URLs the client does not build — the player's stream, the
      download link and the upload — take the same prefix as everything that goes through it. A
      build-time `base` was the alternative and it makes the arrangement an input to the image,
      which is the one thing this product does not have.*
      *Two things were in the way and neither announced itself. The content policy said
      `base-uri 'none'`, which makes a browser drop the base element in silence; it is `'self'`
      now, which still leaves an injected base nowhere to point. And the hashed assets were a
      **mount**, which accumulates its own prefix onto `root_path` — so behind a proxy that
      strips the deployment prefix, `/assets/index-abc.js` was looked for inside
      `static/assets/assets/` and the page loaded nothing. Everything the bundle holds is served
      through the one fallback route now, with the immutable header decided by the path rather
      than by the router.*
      *Covered end to end rather than by reading the markup: the base href is taken out of the
      served page, the bundle's relative `src` resolved against it exactly as a browser resolves
      it, and the result asked for — under both proxy configurations, since `deploy/README.md`
      offers both and only one of them used to work.*

- [x] **OPS-5** · `/healthz` and `/readyz`, and structured logs with request correlation. ⇢ API-1

- [x] **OPS-7** · Automatic migrations at startup with locking, and a documented rollback path.
      ⇢ DAT-1, OPS-1

- [x] **OPS-6** · **Backup and restore that are actually exercised.** A consistent copy of the
      SQLite database in WAL mode (`VACUUM INTO`) without stopping the service, plus what to copy
      from `storage/`. ⇢ OPS-2 🧪
      🧪 Restore into a clean container and assert the archive is complete, and upgrade a populated
      database from the previous migration revision and assert nothing was lost. Formal
      cross-version documentation is a later milestone; during v0 I am upgrading my own real
      archive continuously, which is when these break.
      *Both halves of the marker are now met. The restore runs in CI's `image` job, which fills an
      instance, backs it up, destroys the container and its volume, restores into a fresh one
      following [`deploy/README.md`](../../deploy/README.md) step for step, and ends on `fsck` —
      which re-hashes every original, so a clean report is byte-level proof that both halves of
      the backup came back. The rehearsal found a step the instructions did not have: restored
      files carry the restorer's uid, and the container exits on "attempt to write a readonly
      database" before it serves anything. The upgrade is written as a walk over the revision
      tree, so it covers `0004` on the day it lands rather than the session after; `OPS-9` in
      [`next-plan`](../next-plan/release.md) narrows to the cross-version half accordingly.
      What remains is not a task: performing the restore against the real archive, which is
      condition 3 of [when v0 is done](README.md).*

---
