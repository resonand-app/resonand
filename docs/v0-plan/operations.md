# Operations and deployment

`OPS-*` — the image, the configuration, backups, and what an operator can see. An instance
nobody can back up or upgrade is one nobody should trust an archive to.

## Track D · Operations and deployment

- [ ] **OPS-1** · Multi-stage `Dockerfile`: frontend build, backend with `ffmpeg`, final image
      without the toolchain, non-root user. ⇢ INF-1

- [ ] **OPS-2** · Example `docker-compose.yml` with volumes for the database and the storage, plus a
      documented `.env.example`. ⇢ OPS-1

- [ ] **OPS-3** · Configuration **through environment variables only**, validated at startup with
      useful messages (not a stack trace). ⇢ API-1

- [ ] **OPS-4** · **Subdomain and subpath** support (`/sonarium`), both tested behind a reverse
      proxy. In v0 because retrofitting a base path into an SPA is genuinely painful, and the
      subpath is the one that always ends up broken. ⇢ OPS-2, UI-4 🧪

- [ ] **OPS-5** · `/healthz` and `/readyz`, and structured logs with request correlation. ⇢ API-1

- [ ] **OPS-7** · Automatic migrations at startup with locking, and a documented rollback path.
      ⇢ DAT-1, OPS-1

- [ ] **OPS-6** · **Backup and restore that are actually exercised.** A consistent copy of the
      SQLite database in WAL mode (`VACUUM INTO`) without stopping the service, plus what to copy
      from `storage/`. ⇢ OPS-2 🧪
      🧪 Restore into a clean container and assert the archive is complete, and upgrade a populated
      database from the previous migration revision and assert nothing was lost. Formal
      cross-version documentation is a later milestone; during v0 I am upgrading my own real
      archive continuously, which is when these break.

---
