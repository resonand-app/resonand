# Operations and deployment

`OPS-*` — the image, the configuration, backups, and what an operator can see. An instance
nobody can back up or upgrade is one nobody should trust an archive to.

## Track D · Operations and deployment

- [x] **OPS-1** · Multi-stage `Dockerfile`: frontend build, backend with `ffmpeg`, final image
      without the toolchain, non-root user. ⇢ INF-1

- [x] **OPS-2** · Example `docker-compose.yml` with volumes for the database and the storage, plus a
      documented `.env.example`. ⇢ OPS-1

- [ ] **OPS-3** · Configuration **through environment variables only**, validated at startup with
      useful messages (not a stack trace). ⇢ API-1
      *Outstanding: the calling. `Settings.validate_runtime` exists and produces exactly the
      messages this asks for, and nothing outside its own test ever calls it — `create_app` runs
      `prepare_directories` and no more. The instance an operator gets by copying
      `deploy/.env.example` verbatim therefore starts: that file ships `SONARIUM_SECRET_KEY=`
      empty, pydantic reads it as a zero-length `SecretStr` rather than as absent, so the
      `is None` guard in front of the playback signer never fires and tokens are signed with an
      empty key. Validating on the branch that reads the environment leaves the tests, which pass
      settings in, untouched.*

- [ ] **OPS-4** · **Subdomain and subpath** support (`/sonarium`), both tested behind a reverse
      proxy. In v0 because retrofitting a base path into an SPA is genuinely painful, and the
      subpath is the one that always ends up broken. ⇢ OPS-2, UI-4 🧪
      *Outstanding: the bundle half. The backend is done and covered — `root_path`, the cookie
      scoped to the prefix, and eleven tests across both arrangements. The interface has no base
      path at all: no `base` in the Vite config, no `basename` on the router, and an `index.html`
      that asks the domain root for its assets. The subdomain arrangement works end to end; the
      subpath one serves a shell that can fetch neither its bundle nor its API, which is the
      arrangement `deploy/README.md` documents as tested. The prediction in this task's own second
      sentence is the thing that happened.*

- [x] **OPS-5** · `/healthz` and `/readyz`, and structured logs with request correlation. ⇢ API-1

- [x] **OPS-7** · Automatic migrations at startup with locking, and a documented rollback path.
      ⇢ DAT-1, OPS-1

- [ ] **OPS-6** · **Backup and restore that are actually exercised.** A consistent copy of the
      SQLite database in WAL mode (`VACUUM INTO`) without stopping the service, plus what to copy
      from `storage/`. ⇢ OPS-2 🧪
      🧪 Restore into a clean container and assert the archive is complete, and upgrade a populated
      database from the previous migration revision and assert nothing was lost. Formal
      cross-version documentation is a later milestone; during v0 I am upgrading my own real
      archive continuously, which is when these break.
      *Outstanding: both halves of the marker, and only those — `VACUUM INTO` against a live
      instance, the restore, and what to copy from `storage/` are all built and covered. The
      restore test restores into a clean database rather than a clean container. The upgrade test
      was written when there was one revision and says so in its own docstring; there are three
      now, so what it asserts is that an upgrade with nothing to do does nothing, and neither
      schema change that has shipped has ever run against a populated database. Writing it as a
      walk over the revision tree rather than a pair also makes it the first instance of `OPS-9`.*

---
