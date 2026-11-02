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

## [0.2.0] — 2026-11-02

Favourites, a trash that can be emptied in one go, and a limit on how long a name can be. **Read
*Upgrading from 0.1.0* before taking it**: one permission narrows, and the upgrade rewrites any
title or library name over its new limit.

### Upgrading from 0.1.0

- **Take a database backup first**, as [`deploy/README.md`](deploy/README.md) describes under
  *Upgrading*. Two migrations run on the way up, and the second shortens every title over 200
  characters and every library name over 100. That backup is the only way back to the long ones;
  the startup log's `names_shortened` line says how many were changed.
- **Look at who has *Can edit* on a shared library.** From this release they can no longer move a
  recording out of it, send one to the trash, restore one or delete one for good. Raise anybody
  who should keep doing that to *Can manage* in the library's *Who has access*.
- Then pin `0.2.0` in `docker-compose.yml` and run `docker compose pull && docker compose up -d`.
  Nothing in `.env` changes.

### Added

- **Favourites.** A heart on every recording, on its card, its row and its own page, marks it as
  one of yours, and *Favourites* in the sidebar gathers every recording you have marked, whichever
  library it is in, newest mark first. A mark is yours alone: nobody else sees it, and nothing
  counts how many people marked anything. A library shared with you read-only can now be
  selected, to mark or unmark a selection. Over the API, `PUT` and `DELETE` on
  `/api/audio/{audio_uuid}/favourite` mark and unmark, every recording carries `is_favourite`, and
  `GET /api/audio` now takes a library's filters and sorts, with `favourite=true` and
  `sort=favourited_at`, and without a `sort` lists the most recently recorded first. A library's
  listing and `GET /api/search` take `favourite=true` as well.
- **The trash can be destroyed in one call, whole or in part.** `GET /api/trash/summary` says
  what emptying it would destroy, in numbers and as of an instant; `DELETE /api/trash` takes that
  instant as `trashed_before` and leaves anything trashed since; `POST /api/trash/purge` destroys a
  selection and lists back every uuid it did not. `API.md` has the details.
- **The trash can be emptied, or any part of it, in one go.** Rows in the trash can be ticked,
  and *Delete permanently* destroys what is ticked; *Empty trash* destroys everything in it.
  Either asks once, saying how many recordings go, and anything sent to the trash while that
  question was open is left alone.
- **Trashing or moving a recording, and trashing a library, says that it worked.** Each ends in
  a toast, and a trash carries *Undo*, which puts it back where it was. When one fails, the toast
  gives the reason the instance gave.
- **`resonand import --restore`** takes a recording it updates back out of the trash. Without it,
  the trash is left as it is and the import says so; a library in the trash is never restored by
  an import, since that would bring back everything in it.
- **An export carries each account's favourites.** Every recording's sidecar names who marked it
  as a favourite and when, and `resonand import` gives each account its favourites back in the
  order it marked them, printing any address it has no account for. An export written before
  this imports as it always has, and `0.1.0` reading one written after it imports everything but
  the favourites, without saying so.

### Changed

- **Only somebody who can manage a library can take a recording out of it.** Moving a recording
  out to another library, sending it to the trash, restoring it and deleting it for good now need
  *Can manage*; *Can edit* no longer allows any of them. A move used to let an editor carry a
  recording off into a library of their own, which handed it to them. **If you gave somebody
  *Can edit* and want them to keep moving and trashing recordings, raise them to *Can manage*** in
  the library's *Who has access*. Uploading and changing titles, categories and tags are unchanged.
- **Titles and library names have a length limit.** A recording's title is at most 200
  characters and a library's name at most 100. On upgrade, any longer title or name is shortened
  at the last word that fits, recordings in the trash included; the full filename is still on the
  recording, under its technical details. From now on a longer name is refused when it is typed,
  and one that comes from a filename or an imported sidecar is shortened the same way.
- **Deleting from the trash asks for a confirmation, and no longer for the name.** *Delete now*
  opens a dialog that names what goes and says it goes permanently; nothing has to be typed. It
  opens with the focus on *Cancel*, so pressing Enter as it appears destroys nothing.
- **A run on a selection reports in a toast that goes away on its own.** Tagging, categorising,
  moving or trashing several recordings used to end in a report drawn above the grid that stayed
  until somebody dismissed it. It is a toast now: gone after six seconds, or twelve when it carries
  an action; *Retry* on whatever failed, *Undo* after a trash; and a failure with something to do
  about it stays until it is dismissed. Pointing at it or focusing it holds it.
- **The published image says which commit built it.** `docker inspect` on it carries the
  `version`, `revision` and `created` labels, which `0.1.0`'s did not.
- **The browser tab shows the whole mark.** The favicon was the S on its own, which read as a
  stray letter rather than as Resonand; it is now the full mark, arcs included.

### Fixed

- **An import onto a recording in the trash no longer reads as an ordinary update.** It applied
  the sidecar there and counted it as updated, so the recording stayed out of sight and went on
  counting down to its purge with nothing said. Each one is now named as it is imported, the
  summary ends `(1 still in the trash)`, and `--dry-run` says `would update (in the trash)`. The
  same goes for a recording whose library is in the trash. The summary line is unchanged when
  nothing was in the trash, and so is the exit status.
- **A recording no longer opens with its transcript missing.** About one load in five showed
  how many segments there were and no lines under them, until the column was scrolled. The
  lines are now drawn on every load.
- **The account menu can be walked with the keyboard.** The arrow keys, Home and End move
  through it, as they do through any menu.
- **`resonand fsck` no longer fails on work in progress.** Run on a live instance while a recording
  was being transcoded or cut up for transcription, it reported the file being written as left
  behind and exited non-zero. A fragment is now a finding only once every job for its recording
  has finished, failed or been cancelled.

Published as `ghcr.io/resonand-app/resonand:0.2.0` for `linux/amd64` and `linux/arm64`.

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

[0.2.0]: https://github.com/resonand-app/resonand/releases/tag/v0.2.0
[0.1.0]: https://github.com/resonand-app/resonand/releases/tag/v0.1.0
