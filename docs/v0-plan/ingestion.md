# Ingestion, storage and playback

`ING-*` — getting audio in and getting it back out: storage layout, hashing, `ffprobe`, the
waveform, the Opus derivative, `Range` streaming and the integrity check. Principle 1 is made
structural here rather than aspirational.

## Track A · Ingestion, storage and playback

- [ ] **ING-1** · Storage layout: `storage/<uuid[0:2]>/<uuid>/original.<ext>` with `derived.opus`
      next to it. The original stays **intact**, never rewritten. ⇢ API-1

- [ ] **ING-2** · Upload through the API: multipart with progress, configurable size limit, and
      resumption for large uploads (hours-long files), restricted to the format allowlist under
      **Ingestion rules**. ⇢ ING-1, API-9 🧪

- [ ] **ING-3** · Streaming SHA-256 hash during ingestion and **duplicate detection**: it warns and
      offers to continue, it never blocks silently. Byte-identical files only — a re-encoded copy
      of the same recording has a different hash, and the interface must not imply otherwise. The
      match **includes trashed recordings** and offers to restore instead. Title defaults to the
      filename without its extension. ⇢ ING-2 🧪

- [ ] **ING-4** · `ffprobe` → `duration_ms`, `sample_rate`, `channels`, `codec`, `mime`,
      `size_bytes`. Run as a job, not inline with the request. ⇢ ING-2, JOB-1

- [ ] **ING-5** · Waveform peak computation, stored in `audio.waveform` (compact BLOB, not JSON).
      It is the product's "thumbnail". Mono `int8` min/max pairs at a fixed rate, behind a
      one-byte format version. ⇢ ING-4 🧪

- [ ] **ING-14** · **A downsampling parameter on the waveform endpoint.** The blob is sized for the
      full recording — at 10 peaks per second a 48-minute recording is ~28,800 pairs — so a screen
      of 26 dense rows is megabytes of peaks for 20px of drawing each. `GET /audio/{uuid}/waveform`
      takes a peak count, capped server-side, and reduces before it writes. ⇢ ING-5 🧪
      *`UI-7`'s waveform column and `UI-31`'s per-card waveform are both unaffordable without it.*

- [ ] **ING-6** · Transcoding to Opus into `derived_path` for browser playback, audio-only even
      when the original is a video container. ⇢ ING-4

- [ ] **ING-7** · **Authenticated streaming with `Range` (HTTP 206).** `<audio>` cannot send
      headers: session cookie or a short-lived signed token in the URL. ⇢ ING-6, API-3 🧪
      🧪 Seeking has to work for real: test partial and overlapping `Range` requests.

- [ ] **ING-8** · Download of the original with its original filename. ⇢ ING-7

- [ ] **ING-9** · *Watch folder*: watching a directory, automatic ingestion into a configured
      library and category, and moving the file to `processed/` or `failed/`. For voice notes this
      ends up being the main entry path. Transcription on arrival is **opt-in per folder and off
      by default**, with the destination provider named in the folder's configuration.
      ⇢ ING-3, JOB-1

- [ ] **ING-10** · Moving an audio between libraries: clears the category, changes who can see it,
      and **preserves the individual `share` rows**. Single transaction. The preservation clause has
      no visible effect in v0 and is implemented anyway, because retrofitting it is a data-loss bug.
      ⇢ API-9 🧪

- [ ] **ING-11** · CLI `sonarium import` (bulk, recursive, with `--dry-run`) and `sonarium export`
      (audio + a JSON sidecar carrying the `uuid`, all metadata and the full transcript, with
      `.vtt`/`.srt` derived). **Re-import is idempotent**: a recording already present is updated,
      not duplicated. ⇢ ING-3 🧪
      *This is principle 1. It ships in v0 even though nobody else will use it, because it is the
      promise the whole argument rests on and because adding it later always gets postponed.*

- [ ] **ING-12** · **Deriving `recorded_at`.** Recording date ≠ upload date, and nothing else
      populates it: `ffprobe` only returns technical metadata. Extract from, in order, container
      creation tags, the filename (`Recording 2024-03-11 18.22.m4a`, `PTT-20240311-WA0007.opus`,
      `AUD-20240311-…`), and filesystem mtime — recording which source was used, and leaving the
      field editable. Stored as wall clock plus `recorded_at_offset`, so a reading is never
      silently shifted into another timezone. ⇢ ING-4 🧪
      *Without this, every `recorded_at` in an imported archive of old voice notes is `NULL`, and
      the field, the sort order and the card decoration are all useless on day one.*

- [ ] **ING-13** · **`sonarium fsck`**: re-hash the stored originals against `audio.sha256`, report
      rows whose file is missing and files no row points at, and exit non-zero on any finding.
      Read-only; repairs are a separate explicit command. ⇢ ING-3, ING-11 🧪
      *This is principle 5 made checkable. The stated worst outcome for the project is shipping
      something that loses files; nothing else in the plan would notice if it did.*


- [x] **ING-14** · `GET /audio/{uuid}/waveform?peaks=N`, N capped server-side. **This is a format
      change, not a parameter.** The blob's header stores peaks _per second_ in one byte, so a
      48-minute recording reduced to 200 pairs is 0.07 peaks per second — not an integer, not a
      byte, and `encode` refuses it. Version 2 stores `duration_ms` instead, which is the quantity
      that survives resampling; `decode` keeps reading version 1, so nothing has to be recomputed
      and the version byte does the job it was put there for.
      _Done when:_ twenty-six dense rows cost twenty-six kilobytes rather than megabytes. A
      48-minute recording stores about 28,800 min/max pairs and V4 draws them into 88 pixels.
      ⇢ ING-5 🧪 the downsample of a downsample is the same shape, and a version 1 blob still reads.

---
