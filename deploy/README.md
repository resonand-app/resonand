# Running Resonand

Everything here describes the software as it stands. Where something has not been exercised yet,
it says so — an operations document that overstates what has been tested is worse than none.

> **Status: there is no published image yet.** The software is complete and every instruction
> below is exercised — CI restores a backup into a clean container by following this file step for
> step — but nothing is on a registry. What makes a clone work is
> [`docker-compose.override.yml`](docker-compose.override.yml), which sits beside the compose file,
> which compose loads without being asked, and which **builds the image out of this clone** instead
> of pulling one. So `deploy/` is a working deployment and not yet a pair of files to copy
> somewhere of their own: copied out without the override, the compose file names an image that
> does not exist. The first release is what changes that, scoped as `REL-5` in
> [`../docs/next-plan/release.md`](../docs/next-plan/release.md).

## What an instance is

Three things:

- **The image** — one container, the backend and the web interface together. It runs the job
  worker in-process, so there is nothing else to schedule. Until the first release it is built
  from this clone rather than pulled, which is the one difference between this document and the
  one that replaces it.
- **The volume at `/data`** — the SQLite database and the tree of original files. This is the
  archive. Everything else is replaceable.
- **The `.env`** — every setting, all of them read from the environment.

Copy [`.env.example`](.env.example) to `.env`, set `RESONAND_SECRET_KEY` and
`RESONAND_TRANSCRIPTION_BASE_URL`, then, from this directory:

```bash
docker compose up -d          # builds the image the first time, which takes a few minutes
docker compose logs -f resonand
```

The instance migrates its own database on the way up.

## The first run

Open the instance in a browser. While no account exists it offers **Create the first account**, and
that account is the administrator — the one that creates all the others. The screen is gone the
moment an account exists and the endpoint behind it refuses from then on, so it is not a door left
standing open on an instance somebody forgot about.

If a browser cannot reach it yet — a server with nothing in front of it, or a restore you want to
check before pointing anything at it — the same account is made from the command line:

```bash
docker compose exec resonand resonand create-admin --email you@example.org --display-name "Your Name"
```

It prompts for the password rather than taking it as an argument, so it stays out of your shell
history, and it prints the identifier of the personal library it just created. Note that down:
`resonand import` is the other thing that wants it.

**Everybody else is created in Settings → Administration → Accounts.** There is no registration
form and no invitation link — the administrator creates the account, sets its password, and tells
the person what it is by whatever means the two of them already trust.

**The instance sends no email.** That is not a setting nobody has filled in: there is no SMTP
configuration anywhere in it. One fewer credential to hold, one fewer service to be down, and no
way for an archive of somebody's family to announce itself to a mail server run by a third party.
The cost is real and worth stating. A forgotten password is reset by the administrator, in
**Settings → Administration → Accounts**. And when the account that is locked out is the only
administrator there is, `create-admin` is the way back in: it creates another one at any time, not
only on an empty instance, and from there the first account's password is reset in the interface
like anybody else's. Which is also worth knowing the other way round — anybody who can run commands
in that container can make themselves an administrator, and `SECURITY.md` says plainly that the
operator is not an attacker in this model.

Each account gets a **personal library**, and that one cannot be shared: it is where a recording
goes when nobody chose, so it stays theirs. Everything else is a library somebody made and shared
from **Library settings → Who has access**, at one of three levels — **Can read** (listen and read
the transcript), **Can edit** (change titles, categories and tags), and **Can manage** (everything
above, plus sharing it onwards).

## Transcription

`RESONAND_TRANSCRIPTION_BASE_URL` is the one setting with no sensible default, because there is
nothing to fall back to: this application does not transcribe, and an instance without an endpoint
stores and plays audio and searches nothing.

Point it at any endpoint that speaks the OpenAI-compatible shape **and returns timed segments** —
the two are not the same claim, and the second is where most of them fail. Give it an address on
your own network and the interface says so on every recording, because it can tell a private
address from a public one and you should not have to take that on trust:

```ini
# A faster-whisper server on the same network as the instance. The address below is an example
# on private space -- substitute the one yours is actually on.
RESONAND_TRANSCRIPTION_BASE_URL=http://192.168.10.20:8000/v1
RESONAND_TRANSCRIPTION_MODEL=Systran/faster-whisper-large-v3
```

**Check it before you trust it.** `resonand check-transcription` sends a generated tone, never any
of your audio, and says what the endpoint actually did with it:

```bash
docker compose exec resonand resonand check-transcription
```

Which endpoints are verified, which are known to fail and why, and the exact criterion a model has
to meet are in [`transcription.md`](transcription.md).

### How much disk the volume needs

The archive itself, **plus headroom for one upload of the largest recording you will send**.

An upload is buffered to a temporary file in full before the endpoint that stores it runs — this
is the web framework's doing, not a choice this software gets to make — so every recording is
written to disk twice: once as that buffer, once into the archive. The image points `TMPDIR` at
`/data/tmp` so that the buffer lands on the volume you sized for audio rather than on the
container's writable layer, which is usually much smaller and is not what your backups point at.
The buffer is removed as soon as the request finishes.

With `RESONAND_MAX_UPLOAD_BYTES` at its default of 8 GB, that is 8 GB of headroom in the worst
case. Lower the setting if the volume cannot spare it: an upload that runs the volume out of
space fails late, having already spent the transfer.

## Behind a reverse proxy

Resonand speaks plain HTTP and expects something in front of it for TLS. The compose file binds
to `127.0.0.1` for that reason: a session cookie on plain HTTP across a network is the whole
session in clear text.

Both arrangements work and both are tested (`OPS-4`). Pick one.

### A subdomain — `resonand.example.org`

Leave `RESONAND_BASE_PATH` unset. Nothing is rewritten.

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

### A subpath — `example.org/resonand`

Set `RESONAND_BASE_PATH=/resonand`. Resonand accepts the prefix being passed through *or*
stripped, because every guide on the internet does one or the other:

```nginx
location /resonand/ {
    proxy_pass http://127.0.0.1:8000/resonand/;   # passes the prefix through
    # proxy_pass http://127.0.0.1:8000/;          # strips it -- also fine
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8G;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}
```

The session cookie is scoped to the subpath either way, so Resonand cannot send it to another
application on the same domain.

**`RESONAND_BASE_PATH` is the prefix the browser sees, not the one the container receives.** It is
what Resonand writes into the served page as the root every asset resolves against, so it has to
match the address bar even where the proxy has already stripped it. Nothing is rebuilt to move an
instance between the two arrangements — the same image serves both, and changing the variable and
restarting is the whole of it.

**`client_max_body_size` is a convenience here, not a boundary.** Resonand enforces its own
ceilings before it reads a body (`SEC-1`): `RESONAND_MAX_UPLOAD_BYTES` for a recording and
`RESONAND_MAX_REQUEST_BYTES` for everything else. Raise the proxy's limit so it does not refuse an
upload the instance would have accepted — but an instance reached directly, or through a proxy
configured generously, is not relying on that line to stay standing.

**Resonand sets its own security headers** (`SEC-4`) -- a content policy, `nosniff`,
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

`RESONAND_SESSION_COOKIE_SECURE` decides whether the cookie is marked `Secure`, and a browser
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

**What `resonand backup` covers:** the database. It uses SQLite's `VACUUM INTO`, so it runs while
the service is up and produces a consistent copy — which copying the file with `cp` does not, in
WAL mode. It refuses to overwrite an existing file, and it opens the copy to check it, because a
backup nobody has opened is a file rather than a backup.

```bash
docker compose exec resonand resonand backup /data/backups/$(date +%F).sqlite
```

**What it does not cover:** the originals under `/data/storage`. They are the bulk of the archive
by orders of magnitude and they never change once written, so an incremental file-level copy is
both cheaper and better suited than anything this software could do on a schedule. Point restic,
Borg, rsync or your filesystem's snapshots at the volume.

A database backup without the originals restores an archive that knows about recordings it does
not have. `resonand fsck` will tell you exactly which ones.

### Restoring

1. Stop the container.
2. Put the backup at `/data/resonand.db` in the volume, and restore `/data/storage` alongside it
   from whatever took it.
3. **Make sure what you restored is owned by uid 10001**, the unprivileged account the image runs
   as. Restored files carry the ownership of whoever restored them, and a database the process
   cannot write is a container that exits on `attempt to write a readonly database` before it
   serves anything — a restore that looks finished and is not.

   ```bash
   docker run --rm -u 0 -v <your-volume>:/data resonand:<tag> chown -R 10001:10001 /data
   ```

4. Start the container. It migrates the restored database forward if the image is newer.
5. `docker compose exec resonand resonand fsck` — this is the step that tells you whether the two
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
git pull && docker compose up -d --build
```

`--build` because there is no image to pull yet; after the first release this is
`docker compose pull && docker compose up -d` and the clone stops being part of the instance.

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
# put the pre-upgrade backup back at /data/resonand.db
# go back to the commit you were on: git checkout <previous commit>
#   -- after the first release this is pinning the previous tag in docker-compose.yml instead
docker compose up -d --build
```

Down-migrations exist and `resonand.db.migrate.downgrade` will run one, but nothing calls it
automatically and nothing should. Down-migrations are exercised far less than up-migrations, and
a rollback that runs by itself when a container fails to start is how one bad deploy becomes a
lost archive.

## Checking the archive

```bash
docker compose exec resonand resonand fsck          # re-hashes every original
docker compose exec resonand resonand fsck --fast   # checks only that the files are there
```

`fsck` re-hashes every original and compares it against what was recorded at ingestion, reports
files that no recording points at, and exits non-zero on any finding — so a cron job or a CI step
notices. It is read-only. Repairing is deliberately a separate thing, because a tool that fixes
things while it is looking at them is one nobody dares run on a Sunday.

`--fast` answers a different question: whether the files are present, not whether they are
unchanged. Worth knowing if you run it nightly and conclude your hashes are being checked.

## Getting your data out

```bash
docker compose exec resonand resonand export /data/export
```

One directory per recording, named for the recording's identifier, holding four things: the
original file, a JSON sidecar carrying all its metadata and its full transcript, and `.vtt` and
`.srt` derived from the same segments. The audio and the subtitles share a name, so a media player
finds the subtitles on its own. No part of it needs Resonand to read.

A directory each rather than one flat folder, because two recordings made on the same phone very
often arrive under the same filename and one of them would overwrite the other on the way out.

Beside them, `resonand-archive.json` describes the instance: the accounts, the libraries, and who
each library was shared with. It carries **no credentials of any kind** — no passwords, no hashes,
no session keys. An export is something you copy onto a disk and carry; it says who the recordings
belonged to, and it is not a way into an instance.

Recordings in the trash are not exported. The manifest records how many were skipped, so a count
that does not match the archive has a reason written down.

### Reading it back

```bash
docker compose exec resonand resonand import /data/export
```

The sidecar carries the recording's identifier, so an import **updates rather than duplicates** —
the transcript included, which is not added a second time. That is what makes exporting an archive
and importing it into an empty instance a way to verify the archive rather than a way to double it.

**Create the accounts first.** Because no credentials travel, an import cannot create people. Into
an empty instance the order is:

1. `resonand create-admin --email … --display-name …`, which also prints the personal library's
   identifier.
2. Sign in, and create everybody else in **Settings → Administration**.
3. `resonand import /data/export`.

The manifest then recreates the libraries — with the identifiers they had — and the sharing, and
each recording goes back into the library it came out of. A library whose owner has no account
here is refused by name rather than handed to whoever ran the import, and the addresses it is
waiting for are printed. Create them and run the import again; it is safe to repeat.

A personal library is the one thing that does not keep its identifier: it arrives with the
account, so the one here already has its own and the export's is mapped onto it.

`--library <uuid>` takes anything the manifest does not place, and importing loose files that
carry no sidecar needs it. `--dry-run` says what would happen, and where, without importing
anything.

**This is not a way to restore an instance.** It restores the archive and its shape; it does not
restore passwords, sessions, or anything else an account has. Restoring an instance whole is what
the backup above is for.

## One process writes

The container runs the API and the job worker in a single process, and that is the whole of the
supported topology — not a default waiting to be tuned. Every write in the instance serialises
through one in-process lock, because SQLite allows one writer at a time and a lock is the honest
way to honour that rather than a generous timeout and the hope that nothing overlaps.

A second process against the same database gives you two locks that know nothing about each
other. Overriding the image's command with `--workers 2`, or running `resonand work` in its own
container with `RESONAND_RUN_WORKER=false`, both do exactly that: the guarantee falls back to the
five-second `busy_timeout` that exists for a backup or a `sqlite3` shell, and under write
contention somebody's request fails with `database is locked`. Nothing in the code retries above
that timeout, and no test covers two processes on one file.

**To do more work at once, raise `RESONAND_JOB_CONCURRENCY`**, which adds threads inside the one
process that owns the lock. Splitting the worker onto its own machine is a real thing to want —
transcoding on a box with a GPU — and it is a change to make when the database is something two
machines can both write to, not before. Sharing a volume is not that.

Transcription is the exception, and has a second number of its own. However many threads the
worker runs, only `RESONAND_TRANSCRIPTION_CONCURRENCY` of them will have a recording at the engine
at any moment — one, by default. The threads are this machine's; the engine is not, and a local
server with a single GPU answers two requests slower than it answers them one after the other,
with a real chance that the second runs it out of memory and fails a recording halfway. The other
work is not held up behind it: a thread that finds only a transcription it may not start takes the
next probe or waveform instead, so a file uploaded during a long transcription still gets its
duration and its waveform straight away. Raise it for a hosted endpoint, or for a server you know
serves several at a time.
