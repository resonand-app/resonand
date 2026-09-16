# Running Sonarium

Everything here describes the software as it stands. Where something has not been exercised yet,
it says so — an operations document that overstates what has been tested is worse than none.

> **Status: not ready to install.** The backend works and is tested; there is no web interface
> yet. Following this gets you a working HTTP API and nothing to look at. See
> [`../docs/v0-plan/`](../docs/v0-plan/) for what is left.

## What an instance is

Three things:

- **The image** — one container, backend and (later) the web interface together. It runs the job
  worker in-process, so there is nothing else to schedule.
- **The volume at `/data`** — the SQLite database and the tree of original files. This is the
  archive. Everything else is replaceable.
- **The `.env`** — every setting, all of them read from the environment.

Copy [`.env.example`](.env.example) to `.env`, set `SONARIUM_SECRET_KEY` and
`SONARIUM_TRANSCRIPTION_BASE_URL`, then:

```bash
docker compose up -d
docker compose logs -f sonarium
```

The instance migrates its own database on the way up. The first account you create through the
API is the administrator, and after that registration is administrator-only.

### How much disk the volume needs

The archive itself, **plus headroom for one upload of the largest recording you will send**.

An upload is buffered to a temporary file in full before the endpoint that stores it runs — this
is the web framework's doing, not a choice this software gets to make — so every recording is
written to disk twice: once as that buffer, once into the archive. The image points `TMPDIR` at
`/data/tmp` so that the buffer lands on the volume you sized for audio rather than on the
container's writable layer, which is usually much smaller and is not what your backups point at.
The buffer is removed as soon as the request finishes.

With `SONARIUM_MAX_UPLOAD_BYTES` at its default of 8 GB, that is 8 GB of headroom in the worst
case. Lower the setting if the volume cannot spare it: an upload that runs the volume out of
space fails late, having already spent the transfer.

## Behind a reverse proxy

Sonarium speaks plain HTTP and expects something in front of it for TLS. The compose file binds
to `127.0.0.1` for that reason: a session cookie on plain HTTP across a network is the whole
session in clear text.

Both arrangements work and both are tested (`OPS-4`). Pick one.

### A subdomain — `sonarium.example.org`

Leave `SONARIUM_BASE_PATH` unset. Nothing is rewritten.

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Uploads are whole recordings. The default of 1 MB will reject every one of them.
    client_max_body_size 8G;
    # And a multi-gigabyte upload over a slow connection takes longer than 60 seconds.
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}
```

### A subpath — `example.org/sonarium`

Set `SONARIUM_BASE_PATH=/sonarium`. Sonarium accepts the prefix being passed through *or*
stripped, because every guide on the internet does one or the other:

```nginx
location /sonarium/ {
    proxy_pass http://127.0.0.1:8000/sonarium/;   # passes the prefix through
    # proxy_pass http://127.0.0.1:8000/;          # strips it -- also fine
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8G;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}
```

The session cookie is scoped to the subpath either way, so Sonarium cannot send it to another
application on the same domain.

**`client_max_body_size` is a convenience here, not a boundary.** Sonarium enforces its own
ceilings before it reads a body (`SEC-1`): `SONARIUM_MAX_UPLOAD_BYTES` for a recording and
`SONARIUM_MAX_REQUEST_BYTES` for everything else. Raise the proxy's limit so it does not refuse an
upload the instance would have accepted — but an instance reached directly, or through a proxy
configured generously, is not relying on that line to stay standing.

**Sonarium sets its own security headers** (`SEC-4`) -- a content policy, `nosniff`,
`frame-ancestors 'none'` and a referrer policy. A proxy that adds its own will produce two of
each, and where they disagree the browser takes the stricter one, which is usually not the one
anybody intended. Pass them through rather than adding a second set.

**If the proxy runs on a different host** from the container, uvicorn will not trust its
`X-Forwarded-*` headers — it trusts `127.0.0.1` only — and every session will be recorded as
coming from the proxy. Add `--forwarded-allow-ips=<the proxy's address>` to the command. Not `*`:
that lets any client claim any address.

## Backups

**What `sonarium backup` covers:** the database. It uses SQLite's `VACUUM INTO`, so it runs while
the service is up and produces a consistent copy — which copying the file with `cp` does not, in
WAL mode. It refuses to overwrite an existing file, and it opens the copy to check it, because a
backup nobody has opened is a file rather than a backup.

```bash
docker compose exec sonarium sonarium backup /data/backups/$(date +%F).sqlite
```

**What it does not cover:** the originals under `/data/storage`. They are the bulk of the archive
by orders of magnitude and they never change once written, so an incremental file-level copy is
both cheaper and better suited than anything this software could do on a schedule. Point restic,
Borg, rsync or your filesystem's snapshots at the volume.

A database backup without the originals restores an archive that knows about recordings it does
not have. `sonarium fsck` will tell you exactly which ones.

### Restoring

1. Stop the container.
2. Put the backup at `/data/sonarium.db` in the volume, and restore `/data/storage` alongside it
   from whatever took it.
3. Start the container. It migrates the restored database forward if the image is newer.
4. `docker compose exec sonarium sonarium fsck` — this is the step that tells you whether the two
   halves of the backup agree. A restore you have not run `fsck` against is a restore you have not
   checked.

The restore path and an upgrade of a populated database are both covered by tests. Neither has
yet been performed against a real archive on real hardware, which is one of the conditions in
[`../docs/v0-plan/`](../docs/v0-plan/) for the first version being finished.

## Upgrading

```bash
docker compose pull && docker compose up -d
```

The container migrates its own database on the way up, under a file lock, so two containers
overlapping during a restart cannot both migrate. The log line to look for is
`instance.migrated`, with the revision it came from and the one it went to.

**Take a database backup before an upgrade that changes the schema.** Not because migrations are
expected to fail, but because the recovery path below depends on having one.

### If an upgrade goes wrong

The instance reports both halves of the question — where the database is and where the image
expects it to be — in the startup log and through `/readyz`.

**The supported path is to restore the backup and roll the image back.** In that order, and
deliberately not "downgrade the schema":

```bash
docker compose down
# put the pre-upgrade backup back at /data/sonarium.db
# pin the previous tag in docker-compose.yml
docker compose up -d
```

Down-migrations exist and `sonarium.db.migrate.downgrade` will run one, but nothing calls it
automatically and nothing should. Down-migrations are exercised far less than up-migrations, and
a rollback that runs by itself when a container fails to start is how one bad deploy becomes a
lost archive.

## Checking the archive

```bash
docker compose exec sonarium sonarium fsck          # re-hashes every original
docker compose exec sonarium sonarium fsck --fast   # checks only that the files are there
```

`fsck` re-hashes every original and compares it against what was recorded at ingestion, reports
files that no recording points at, and exits non-zero on any finding — so a cron job or a CI step
notices. It is read-only. Repairing is deliberately a separate thing, because a tool that fixes
things while it is looking at them is one nobody dares run on a Sunday.

`--fast` answers a different question: whether the files are present, not whether they are
unchanged. Worth knowing if you run it nightly and conclude your hashes are being checked.

## Getting your data out

```bash
docker compose exec sonarium sonarium export /data/export
```

One JSON sidecar per recording carrying all its metadata and its full transcript, `.vtt` and
`.srt` derived from the same segments, and the original file beside them. No part of it needs
Sonarium to read.

The sidecar carries the recording's identifier, so `sonarium import` reads it back and **updates
rather than duplicates**. That is what makes exporting an archive and importing it into an empty
instance a way to verify the archive rather than a way to double it.

## Splitting the worker out

One container runs the API and the job worker together, which is the topology the first version
ships. To run them apart — a machine with a GPU doing transcodes, say:

```yaml
services:
  sonarium:
    environment:
      SONARIUM_RUN_WORKER: "false"
  sonarium-worker:
    image: ghcr.io/sonarium-app/sonarium:latest
    command: ["sonarium", "work"]
    env_file: .env
    volumes:
      - sonarium-data:/data
```

Both containers need the same volume, because the worker reads and writes the originals. Nothing
in the schema changes; this is the seam that made putting the worker in-process a safe choice
rather than a shortcut.
