# Ingestion, storage and playback

`ING-*` — getting audio in and getting it back out: storage layout, hashing, `ffprobe`, the
waveform, the Opus derivative, `Range` streaming and the integrity check. Principle 1 is made
structural here rather than aspirational.

## Track A · Ingestion, storage and playback

- [x] **ING-1** · Storage layout: `storage/<uuid[0:2]>/<uuid>/original.<ext>` with `derived.opus`
      next to it. The original stays **intact**, never rewritten. ⇢ API-1

- [x] **ING-2** · Upload through the API: multipart with progress, configurable size limit,
      restricted to the format allowlist under **Ingestion rules**. ⇢ ING-1, API-9 🧪
      *Resumption was in this task and is not in the product. `UI-18f` decided against it —
      resuming a multipart upload needs a protocol on both sides, and an interface that offers a
      pause it cannot honour is worse than one that never offers it — and
      `src/test/no-resumable-uploads.node.test.ts` now fails the build if any copy implies
      otherwise. The clause is struck here rather than left to contradict the test.*

- [x] **ING-3** · Streaming SHA-256 hash during ingestion and **duplicate detection**: it warns and
      offers to continue, it never blocks silently. Byte-identical files only — a re-encoded copy
      of the same recording has a different hash, and the interface must not imply otherwise. The
      match **includes trashed recordings** and offers to restore instead. Title defaults to the
      filename without its extension. ⇢ ING-2 🧪

- [x] **ING-4** · `ffprobe` → `duration_ms`, `sample_rate`, `channels`, `codec`, `mime`,
      `size_bytes`. Run as a job, not inline with the request. ⇢ ING-2, JOB-1

- [x] **ING-5** · Waveform peak computation, stored in `audio.waveform` (compact BLOB, not JSON).
      It is the product's "thumbnail". Mono `int8` min/max pairs at a fixed rate, behind a
      one-byte format version. ⇢ ING-4 🧪

- [x] **ING-14** · **A downsampling parameter on the waveform endpoint.** The blob is sized for the
      full recording — at 10 peaks per second a 48-minute recording is ~28,800 pairs — so a screen
      of 26 dense rows is megabytes of peaks for 20px of drawing each. `GET /audio/{uuid}/waveform`
      takes a peak count, capped server-side, and reduces before it writes. ⇢ ING-5 🧪
      *`UI-7`'s waveform column and `UI-31`'s per-card waveform are both unaffordable without it.*

- [x] **ING-6** · Transcoding to Opus into `derived_path` for browser playback, audio-only even
      when the original is a video container. ⇢ ING-4

- [x] **ING-7** · **Authenticated streaming with `Range` (HTTP 206).** `<audio>` cannot send
      headers: session cookie or a short-lived signed token in the URL. ⇢ ING-6, API-3 🧪
      🧪 Seeking has to work for real: test partial and overlapping `Range` requests.

- [x] **ING-8** · Download of the original with its original filename. ⇢ ING-7

- [x] **ING-10** · Moving an audio between libraries: clears the category, changes who can see it,
      and **preserves the individual `share` rows**. Single transaction. The preservation clause has
      no visible effect in v0 and is implemented anyway, because retrofitting it is a data-loss bug.
      ⇢ API-9 🧪

- [x] **ING-11** · CLI `resonand import` (bulk, recursive, with `--dry-run`) and `resonand export`
      (audio + a JSON sidecar carrying the `uuid`, all metadata and the full transcript, with
      `.vtt`/`.srt` derived). **Re-import is idempotent**: a recording already present is updated,
      not duplicated. ⇢ ING-3 🧪
      *This is principle 1. It ships in v0 even though nobody else will use it, because it is the
      promise the whole argument rests on and because adding it later always gets postponed.*
      *Split once the four defects had been read against the code, because one sitting does not
      hold both halves: `ING-11a` is the layout and the defects, `ING-11b` is the round trip
      itself, which is exit criterion 4 and ends in an act against the real archive rather than
      in a test.*

- [x] **ING-11a** · **One directory per recording**, named for its `uuid`, holding the original,
      the sidecar and the subtitles. ⇢ ING-11 🧪
      *The layout was the decision, and it answers two of the four defects by shape rather than
      by care. A flat export let two recordings sharing a filename overwrite each other — where
      `store_original` would have refused — and paired a sidecar to its audio by a stem that any
      punctuation in the filename broke. The audio and the subtitles now share one sanitised
      stem, which is also what makes a media player find the `.srt` beside the recording. A flat
      directory with the `uuid` appended to every filename was the alternative: less work, and it
      puts the identifier into every name a person reads.*
      *The other two defects were read back rather than reshaped. `category` is restored by name
      into whichever library the recording lands in, created there if it is missing; `library` is
      now what decides that library, so `--library` became the fallback and the override rather
      than the only destination, and an export read back into the instance it came from lands
      where it came from instead of collapsing into one library. A transcript the recording
      already has is not added a second time — matched on provenance and segments but not on
      `source`, because a transcript an engine produced goes out as `service` and comes back as
      `imported`, and every round trip would otherwise look like new content.*
      *`resonand.json` is only believed when it is the one recording in its directory. A folder of
      loose files with a single sidecar dropped into it would otherwise hand every one of them the
      same `uuid`, and the second file would update what the first had just created.*

- [x] **ING-11c** · **The archive manifest**: `resonand-archive.json` at the root of an export,
      carrying the accounts, the libraries and who each was shared with, and an import that
      recreates the libraries and the sharing against accounts that are already here.
      ⇢ ING-11a 🧪
      *Without it the round trip has nothing to land in. An empty instance has one library — the
      admin's personal one — and `import` cannot create another, so a two-person archive with
      four libraries came back as one library with no sharing at all: exactly the structure
      condition 2 of* when v0 is done *exists to validate.*
      *It carries identities and never credentials. An export is copied onto a stick and handed
      around, and one holding password hashes would be a way into an instance rather than a
      description of one — so accounts are created by hand first, and a library whose owner has
      no account here is refused by name rather than quietly reassigned to whoever ran the
      import, which would hand one person's recordings to another and look like it had worked.
      Restoring an instance whole, credentials included, is what a backup is for (`OPS-6`).*
      *A personal library is the one exception to keeping identifiers: it arrives with the
      account, so the one here already has a uuid of its own and the manifest's is mapped to it
      by owner rather than adopted.*

- [x] **ING-11c1** · **An import says when it found no manifest**, and names the subdirectory
      that has one. ⇢ ING-11c 🧪
      *Found using it. Pointed one directory above an export, the import reports the same thing
      once per recording — that it has no library to go into — which is the symptom and never
      the cause; the manifest it could not find is not mentioned at all. Cost an hour of a real
      round trip, and a wrong diagnosis before that. The look one level down is deliberately not
      a search: it explains a mistake somebody has already made rather than going to find the
      export for them. Nothing is said when `--library` was given and no manifest exists
      anywhere, because importing a folder of recordings into a library you named is an ordinary
      thing to do and not a mistake to explain.*

- [x] **ING-11b** · **The round trip**: export the whole archive, import it into an empty
      instance, and get back what went in. ⇢ ING-11a, ING-11c 🧪
      *Exit criterion 4. The test runs both commands over the shape a real instance has — two
      people, a personal library each and two more shared in opposite directions — and ends on
      `fsck`, which re-hashes every original and so makes the claim byte-level rather than a row
      count. Three of the four defects `ING-11a` fixed would have been caught here, and were not,
      because nothing exported anything and then imported it.*
      *Stated losses, each deliberate: the trash is not exported (the manifest counts what it
      skipped, so a count that does not match has a reason); `created_at` is the row's, not the
      export's; a nested category returns as a root, because the sidecar carries a name and the
      interface has one level; only the active transcript travels, and it arrives as `imported`;
      and no credential travels at all.*
      *The second half is the act against the real archive, which is condition 4 under* when v0
      is done *and is not tickable here.*

- [x] **ING-12** · **Deriving `recorded_at`.** Recording date ≠ upload date, and nothing else
      populates it: `ffprobe` only returns technical metadata. Extract from, in order, container
      creation tags, the filename (`Recording 2024-03-11 18.22.m4a`, `PTT-20240311-WA0007.opus`,
      `AUD-20240311-…`), and filesystem mtime — recording which source was used, and leaving the
      field editable. Stored as wall clock plus `recorded_at_offset`, so a reading is never
      silently shifted into another timezone. ⇢ ING-4 🧪
      *Without this, every `recorded_at` in an imported archive of old voice notes is `NULL`, and
      the field, the sort order and the card decoration are all useless on day one.*
      *A reading is now shown to the precision it was stated at. The stored form is fixed width,
      so a source that gave only a day arrives in the column as midnight — which was presented as
      a recording made at 00:00, on exactly the archive this task exists to rescue.
      `recorded_at_precision` (migration `0004`) keeps what the source said: `date`, `minute` or
      `second`. It also reaches the container tags, where `date` and `date_recorded` routinely
      hold a bare `2024-03-11` and parse as midnight while sounding more confident than a
      filename. `NULL` is unknown rather than date-only — what rows written before the column
      carry — and renders in full, because reading an absence as date-only would withdraw a real
      time from every row a container tag populated.*

- [x] **ING-13** · **`resonand fsck`**: re-hash the stored originals against `audio.sha256`, report
      rows whose file is missing and files no row points at, and exit non-zero on any finding.
      Read-only; repairs are a separate explicit command. ⇢ ING-3, ING-11 🧪
      *This is principle 5 made checkable. The stated worst outcome for the project is shipping
      something that loses files; nothing else in the plan would notice if it did.*
      *The command has its own tests now — seven, through the Typer runner, because the part an
      operator depends on is the exit code and that was the one part nobody had run. They cover a
      clean archive exiting 0, a changed and a missing file exiting 1, `--json` staying
      machine-readable while still exiting 1, and `--fast` not noticing a changed file, which is
      stated rather than left for somebody to discover after cronning it.*
      *The two fragment kinds are visible: both are written under a leading dot, which is what
      kept them out of `stored_files`' `original.*` glob. They report as `leftover` rather than as
      `orphan` — an orphan is a whole recording the database has forgotten, and losing one is the
      failure this check exists for, so the word is not spent on a fragment.*


- **ING-14** · `GET /audio/{uuid}/waveform?peaks=N`, N capped server-side. **This is a format
      change, not a parameter.** The blob's header stores peaks _per second_ in one byte, so a
      48-minute recording reduced to 200 pairs is 0.07 peaks per second — not an integer, not a
      byte, and `encode` refuses it. Version 2 stores `duration_ms` instead, which is the quantity
      that survives resampling; `decode` keeps reading version 1, so nothing has to be recomputed
      and the version byte does the job it was put there for.
      _Done when:_ twenty-six dense rows cost twenty-six kilobytes rather than megabytes. A
      48-minute recording stores about 28,800 min/max pairs and V4 draws them into 88 pixels.
      ⇢ ING-5 🧪 the downsample of a downsample is the same shape, and a version 1 blob still reads.

---

## Deferred

`ING-9` — the watch folder — keeps its identifier in
[`docs/next-plan/ingestion.md`](../next-plan/ingestion.md). It was the only task in this track
with nothing behind it at all, and the first version's threshold is reached without it: upload is
already a way in. What held it here was never the feature but the documents that described it as
built, and correcting those cost less than building it to match them.
