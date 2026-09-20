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

**`SONARIUM_BASE_PATH` is the prefix the browser sees, not the one the container receives.** It is
what Sonarium writes into the served page as the root every asset resolves against, so it has to
match the address bar even where the proxy has already stripped it. Nothing is rebuilt to move an
instance between the two arrangements — the same image serves both, and changing the variable and
restarting is the whole of it.

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
`X-Forwarded-*` headers — it trusts `127.0.0.1` only. Add `--forwarded-allow-ips=<the proxy's
address>` to the command. Not `*`: that lets any client claim any address.

That flag governs the address a session is recorded against, and the address the sign-in limiter
counts (`SEC-3`). It is deliberately narrow: anything trusted here can claim to be anybody, and a
whole LAN able to rotate `X-Forwarded-For` would walk through both login counters.

**The session cookie does not wait for it.** Whether the browser was on HTTPS is read from
`X-Forwarded-Proto` for any proxy on a loopback, link-local or private address, so a proxy in a
container network — the ordinary homelab shape, and outside `--forwarded-allow-ips` by default —
still produces a cookie marked `Secure`. The two are separated because their failure modes are
opposite: forging the scheme costs the forger their own sign-in and nobody else anything, while
forging the address is the protection `SEC-3` exists to provide.

### The session cookie and how you are reached

`SONARIUM_SESSION_COOKIE_SECURE` decides whether the cookie is marked `Secure`, and a browser
silently discards a `Secure` cookie that arrived over plain HTTP unless the address is loopback.
It is silent on both sides: the instance logs a successful sign-in, the browser keeps nothing, and
the person is returned to the sign-in screen as though their password were wrong.

| Value | What it does | When |
|---|---|---|
| `auto` (default) | Marked when the request arrived over HTTPS | Almost always. Each connection gets a cookie as safe as the channel it crossed, so an instance reached both ways works both ways |
| `true` | Always marked, **and signing in over plain HTTP is refused** with a message rather than accepted and dropped | An instance that is HTTPS and only HTTPS, where reaching it any other way is a mistake worth being told about |
| `false` | Never marked | An instance that is plain HTTP on purpose and would rather pin that than have it inferred |

`true` refuses before the password is read. Accepting it would take a credential over the clear
channel to answer with a cookie that cannot survive — which marking the cookie was never going to
protect.

**If people reach the instance by IP as well as by name**, `auto` is the value you want. The
common cause is a device that does not resolve the hostname — no DNS, or a split-horizon rewrite
it does not see — falling back to `http://<address>:8000` and hitting the published port directly.

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
3. **Make sure what you restored is owned by uid 10001**, the unprivileged account the image runs
   as. Restored files carry the ownership of whoever restored them, and a database the process
   cannot write is a container that exits on `attempt to write a readonly database` before it
   serves anything — a restore that looks finished and is not.

   ```bash
   docker run --rm -u 0 -v <your-volume>:/data sonarium:<tag> chown -R 10001:10001 /data
   ```

4. Start the container. It migrates the restored database forward if the image is newer.
5. `docker compose exec sonarium sonarium fsck` — this is the step that tells you whether the two
   halves of the backup agree. `fsck` re-hashes every original, so a clean report means the
   database and the files it describes are the same pair that was backed up. A restore you have
   not run `fsck` against is a restore you have not checked.

Every step above runs in CI on each change: the `image` job fills an instance, backs it up,
destroys the container *and its volume*, restores into a fresh one, and ends on `fsck`. An upgrade
of a populated database is covered too, at every revision in the tree rather than only the last
one.

Neither has yet been performed against a real archive on real hardware, which is one of the
conditions in [`../docs/v0-plan/`](../docs/v0-plan/) for the first version being finished.

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

## One process writes

The container runs the API and the job worker in a single process, and that is the whole of the
supported topology — not a default waiting to be tuned. Every write in the instance serialises
through one in-process lock, because SQLite allows one writer at a time and a lock is the honest
way to honour that rather than a generous timeout and the hope that nothing overlaps.

A second process against the same database gives you two locks that know nothing about each
other. Overriding the image's command with `--workers 2`, or running `sonarium work` in its own
container with `SONARIUM_RUN_WORKER=false`, both do exactly that: the guarantee falls back to the
five-second `busy_timeout` that exists for a backup or a `sqlite3` shell, and under write
contention somebody's request fails with `database is locked`. Nothing in the code retries above
that timeout, and no test covers two processes on one file.

**To do more work at once, raise `SONARIUM_JOB_CONCURRENCY`**, which adds threads inside the one
process that owns the lock. Splitting the worker onto its own machine is a real thing to want —
transcoding on a box with a GPU — and it is a change to make when the database is something two
machines can both write to, not before. Sharing a volume is not that.

Transcription is the exception, and has a second number of its own. However many threads the
worker runs, only `SONARIUM_TRANSCRIPTION_CONCURRENCY` of them will have a recording at the engine
at any moment — one, by default. The threads are this machine's; the engine is not, and a local
server with a single GPU answers two requests slower than it answers them one after the other,
with a real chance that the second runs it out of memory and fails a recording halfway. The other
work is not held up behind it: a thread that finds only a transcription it may not start takes the
next probe or waveform instead, so a file uploaded during a long transcription still gets its
duration and its waveform straight away. Raise it for a hosted endpoint, or for a server you know
serves several at a time.
