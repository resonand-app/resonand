# Changelog

Newest first, in the shape [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) describes.

## What the number promises

[Semantic versioning](https://semver.org/), which before `1.0.0` means something narrower than it
will later:

- **A patch fixes.** `0.1.0` to `0.1.1` never changes an endpoint, a setting name, or anything on
  disk.
- **A minor may break.** Read this file before taking one. Where an upgrade needs a step of its
  own, it is written here and not left to be discovered.
- **`1.0.0` waits for two things to be frozen**: the HTTP API, and the on-disk archive format. The
  second is the one that matters — an archive outlives the software that wrote it, and a format
  that is still moving is not something to promise anybody's recordings to.

Every release migrates its own database on the way up, whatever the number says. The path back is
in [`deploy/README.md`](deploy/README.md), and it is a restore rather than a down-migration.

## [0.1.0] — 2026-09-23

The first release: an archive for the recordings that matter, which keeps the original
byte-for-byte, transcribes it through a service you choose, and lets you search inside everything
you have.

What it does:

- **Search inside the audio.** Full text across every transcript you can see, with timestamps that
  play from that second. Filters for library, category, tag, recording date, duration and
  transcription state.
- **The original, untouched.** Kept exactly as ingested and verifiable against its hash with
  `resonand fsck`. A compressed copy is derived separately for playback.
- **Transcripts as timed segments**, so the transcript follows playback and a line seeks to its
  moment. Every version is kept; one is active.
- **Libraries, a category tree and tags**, with sharing per library at three levels — read, edit,
  manage.
- **Accounts created by an administrator**, sessions you can list and revoke, and permissions
  resolved on every read and write.
- **A documented HTTP API** ([`API.md`](API.md)), which the web interface is merely one client of.
- **A complete export**: `resonand export` writes the originals, a JSON sidecar each, and `.vtt`
  and `.srt`, in a shape that needs none of this software to read. `resonand import` reads it back.
- **One container.** It migrates its own database, runs its own job worker, and is configured
  entirely through environment variables.

What it deliberately is not, in this release: it does not transcribe (it consumes an endpoint you
run or pay for), there are no API tokens, no OIDC, no individual-recording sharing, no transcript
editing, and no translations beyond English. [`ROADMAP.md`](ROADMAP.md) says which of those are
coming and which never will.

Two constraints worth knowing before you trust an archive to it:

- **One process writes.** The API and the worker share a single process and a single lock, because
  SQLite allows one writer. Running a second container against the same volume is not supported.
- **Audio leaves when a transcription is asked for**, to whatever endpoint the operator configured,
  and the interface says so before each request.

Published as `ghcr.io/resonand-app/resonand:0.1.0` for `linux/amd64` and `linux/arm64`.

[0.1.0]: https://github.com/resonand-app/resonand/releases/tag/v0.1.0
