# Transcription compatibility

`TRX-*` — what an engine has to look like for Resonand to consume it, and what the provider
boundary has to become to reach more than one of them.

Engine independence is principle 3: changing engine must cost nothing and lose nothing. The
boundary in [`backend/resonand/transcription/`](../../backend/resonand/transcription/) was designed
against a protocol rather than against a vendor, which is why it holds up — but it is still a
claim supported by one implementation, which is the condition under which such claims are usually
false. This track is what makes it a tested property.

## What the boundary already gets right

Four decisions are load-bearing and are not reopened by anything here. **Submit-and-poll rather
than one blocking call**, which is what the whole second tier of the market speaks. **Segments as
the only unit**, with plain text derived by a method and stored nowhere, because prose cannot be
re-timed and chunking has to re-time every part it submits. **The none-versus-`auto` distinction**
in `resolve_language`, three states where most clients have two, on the axis where engines
disagree most quietly. And **`redact()` against a server echoing the key back**, which is the kind
of thing that is normally added after an incident rather than before one.

## What it does not yet do

**The provider is not asked anything.** It is built from configuration, handed a file and asked
for segments. It does not say how large a request it will take, what granularity it returns,
whether it diarises, or what unit its timestamps are in. Every one of those facts currently lives
in the operator's head and is expressed, if at all, as a `RESONAND_*` variable they are expected to
know the right value for.

That single gap is most of this track. It is purely additive against one implementation and
invasive against four, which is why it comes first.

**And "OpenAI-compatible" is not a compatibility statement.** It describes a URL shape. It says
nothing about whether the model behind that URL returns segments, what units it reports them in,
or how large a request it accepts — and all three vary *within* the set of servers that claim it,
including within OpenAI's own product line. The compatibility unit is **endpoint plus model**, and
only the endpoint is configured today.

---

## Phase G · Making one provider into a boundary

- [x] **TRX-3** 🔒 · **The capability declaration.** A provider states what it can do, and the
      worker asks rather than the operator being made responsible for it: maximum request bytes,
      maximum duration, the granularity it returns, whether it diarises, what unit its timestamps
      are in, and whether it needs a reachable URL. `handle_transcribe` currently derives its
      chunking ceiling from `transcription_request_max_bytes`, a global with a 25 MB default, so a
      forty-minute interview is cut into four parts for an engine that would have taken it in one
      — four requests where one would do, four times the failure surface, and on a per-request
      biller four minimums instead of one. **A property of the provider instance, never of
      `Settings`**, so that `TRX-14` and `TRX-15` are additive rather than a rewrite. ⇢ JOB-2 🧪
      *Everything else in this track depends on it, and it is the one thing that should not wait.*

- [x] **TRX-12** · **What a transcript is, not only where it came from.** `transcript` records
      `provider`, `model` and `language` and nothing about the artefact, so the interface cannot
      tell a diarised transcript from an undiarised one without reading every segment, and cannot
      tell *diarisation returned nothing* from *diarisation was never asked for* at all. Most of
      the answer is derivable from the segments and belongs in the presenter — whether there are
      speakers, how many, the median segment duration. Two facts go on the row because deriving
      them is not available: the **task** that produced it, which is what `TRX-D6` tells a version
      and a translation apart by, and **how many parts it was stitched from**, which is what says
      whether its speaker labels can be trusted at all. ⇢ JOB-6, DAT-1 🧪
      *Reading capability from live configuration instead would be wrong two ways: the configured
      provider changes while old transcripts persist and the selector shows both, and the archive
      outlives the provider — `resonand export` carries transcripts onto instances configured
      differently.*
      *An engine reference and a diarisation flag belong here by the same argument and are
      deliberately not added yet: with one engine configured and nothing asking for diarisation,
      both are backfillable by the migration that first needs them, and a column with no writer is
      a guess about a shape that has not been designed. `stitched_from` is the one that genuinely
      cannot be reconstructed afterwards.*

- [x] **TRX-13** · **Speaker labels across a seam.** `Segment.speaker` has existed since the first
      migration, the parser already reads it and the transcript already renders it, so a server
      with diarisation in front of it returns labels **today** — and `restitch` will merge them
      confidently and wrongly, because `SPEAKER_00` in part 1 is not `SPEAKER_00` in part 4. Do not
      chunk while diarisation is on and the recording fits the engine's declared single-request
      limit; where it genuinely does not fit, **drop the labels rather than stitch two label
      spaces**. ⇢ TRX-3, JOB-13 🧪
      🧪 A diarised recording long enough to be cut must come back either whole with its labels or
      chunked with none, and never with labels from two parts merged.
      *The same rule as the waveform: an absent fact is shown as absent, never invented. Renumbering
      or merging label spaces heuristically produces a transcript that is confidently wrong about
      who spoke, which nobody reports as a transcription bug.*

- [x] **TRX-1** · **A preflight probe, as a CLI verb.** Submit three seconds of generated audio
      and report what came back: endpoint reachable, credentials accepted, and — the question the
      task exists for — whether the engine answers in the shape that carries segments at all. It
      **returns a capability record as a value** rather than caching into process state, so
      `TRX-15` can later store it against an engine row unchanged. ⇢ TRX-3 🧪
      *A tone has no speech in it, so an engine may correctly return no segments for one: whether
      speakers are named and how coarse segments are can only be observed from real audio, which
      the verb takes optionally. The raw time unit is deliberately not reported — a provider
      normalises to milliseconds behind the contract, so reaching for it would tie a
      provider-agnostic probe to one provider's parsing to report a fact already acted on. What is
      checked instead is that the timings landed inside audio whose length we chose.*
      *The highest-leverage task here. OpenAI's own current and cheaper transcription models
      support `response_format=json` only, so the single most likely thing an operator does —
      point the base URL at `api.openai.com/v1` and set the model to the one the vendor's
      documentation recommends — fails at the first transcription, having already sent the
      recording. This turns that into a sentence before any audio moves. Fixtures are generated
      with ffmpeg at test time and the binary is already in the image, so the audio costs nothing.*

- [x] **TRX-10** · **The connection test proves the wrong thing.** `POST /admin/transcription/test`
      fetches `/models` and reports success on any 2xx, so against a model that cannot return
      segments it goes **green** and the first transcription then fails after the upload. The one
      button an operator presses to check their configuration succeeds on precisely the
      configuration that cannot work. Replace what it proves with `TRX-1`'s probe, and report the
      capabilities it found. ⇢ TRX-1 🧪
      *The panel that shows the result is not in the interface specification, so the endpoint and
      the CLI verb can land before the view does.*

- [x] **TRX-7** · **`_time_scale` mis-scales by 1000× on a mostly-silent part.** Seconds-versus-
      milliseconds is decided by comparing the furthest reported `end` against a tenth of the
      submitted duration. For a seconds-reporting server that is always safe; for a
      millisecond-reporting one it fails whenever speech ends before a tenth of the part — a
      ten-minute part whose speaker stops at thirty seconds reports `30000`, the threshold is
      `60000`, and the value is read as seconds and multiplied by a thousand, placing the last
      segment at 8h 20m. The anchor is right and a one-sided test is not enough; a
      provider-declared unit removes the guess for every engine that documents one.
      ⇢ TRX-3 🧪

- [x] **TRX-8** · **An unprobed recording is submitted whole, whatever its size.** When the probe
      has not run or failed, `duration_ms` is 0, the plan becomes a single part, and a three-hour
      file is uploaded in full to an endpoint that rejects it at 25 MB — after the upload. The
      fallback also assumes a recording is *short* when it does not know, which is the wrong
      direction. ⇢ TRX-3 🧪
      *Done with `TRX-7`: they are the same bug on the same path and they compound. The fallback
      substitutes the ceiling for an unknown duration, which is the largest possible value, which
      maximises `TRX-7`'s threshold and so the window in which a millisecond server is misread.*

---

## Decisions taken

### TRX-D4 · A diarising engine on a recording that has to be chunked

**Drop the labels, and say why.** Refusing to chunk would mean a three-hour recording gets no
transcript at all, which is a worse answer than a transcript without speaker labels. Chunking
anyway and stitching the label spaces produces a transcript that reads perfectly and attributes
speech to the wrong person, which is the failure nobody reports. So: do not chunk while
diarisation is on and the recording fits the declared limit, and beyond it transcribe without
labels rather than with invented ones. Applied by `TRX-13`.

### TRX-D5 · What routes a recording to an engine

**The declared language, never the detected one.** Routing on detection is circular — the engine
detects the language, so the language cannot choose the engine — but the real objection is
principle 2: the disclosure drawn before a request has to name where the audio is about to go, and
a routing input that is only known *after* submission makes that notice a guess. Declared routing
keeps it exact. A recording with no declared language reaches a default engine, named like any
other. Governs `TRX-14`.

### TRX-D6 · Versions and translations are different things

A **version** is another attempt in the recording's own language; they compete, and one is
`is_active`. A **translation** is a transcript in another language; it coexists and never competes.
The two are told apart by the **task that produced them**, not by comparing a detected language
against a declared one — that comparison would classify a mis-detection as a translation and drop
it silently out of both the version set and search.

Search continues to read the active transcript only, which means **a translation is not
searchable**. That is the accepted cost, and it is cheaply reversible: `segment_fts` already
indexes every segment of every transcript, so it is one join clause rather than an index rebuild.
Governs `TRX-16`.

### TRX-D7 · Where a stored credential's key lives

Configuration moves into the database and sensitive values are encrypted there (`TRX-15`). The
**key cannot** — a key stored beside what it encrypts is not encryption — so it stays in the
environment, derived from `RESONAND_SECRET_KEY` with a distinct info string so the signing key and
the encryption key are never the same bytes.

Two consequences, named here rather than discovered: rotating `RESONAND_SECRET_KEY` makes every
stored credential unreadable and they have to be re-entered; and a backup restored without the key
has unreadable credentials, which is the property worth having — a leaked database is not a leaked
API key — but it belongs in the restore documentation.

This means **the environment does not go away**. It stops describing the instance and holds only
what cannot live in the database: where the database is, the session secret, and the key above.

### TRX-D8 · What the egress notice names when there are several engines

**One destination, named, at every request point.** `TRX-D5` makes the routing input known before
submission, so the notice stays exact and does not degrade into "this may go to any of these".

What follows from it is an API shape: the destination becomes a property of the **action** rather
than of the instance. `GET /api/transcription/destination` takes no parameters today, because
there is one answer; once an engine is chosen per recording and per task it has to answer *for
this recording, for this task* — so the notice beside "translate" correctly names a different host
from the notice beside "transcribe". The **set** is the right answer in exactly one place, the
administration panel, where it is a configuration listing and nobody is about to send audio.

---

## Deferred

These keep their identifiers in
[`docs/next-plan/transcription.md`](../next-plan/transcription.md), where each is written out with
a criterion of its own: `TRX-2` (the poll loop and the queue state a submitted job waits in),
`TRX-4` (normalising words and utterances up to segments, which is what widens the market beyond
the Whisper family), `TRX-5` (wiring the metering sink, which exists and records into nothing),
`TRX-6` (five trust classes where there are now two), `TRX-9` (saying plainly why an untimed
engine is declined), `TRX-11` (seams duplicating speech when segments are coarse), `TRX-14`
(several engines routed by declared language), `TRX-15` (configuration in the interface) and
`TRX-16` (translations as their own class). `JOB-4` and `JOB-5` are there too, beside the findings
that govern them.

`TRX-D1` (whether `JOB-4`'s signed-URL path is worth building at all) and `TRX-D3` (one provider
per instance or per library) are open and are not settled here. `TRX-D1` travels with `JOB-4`;
`TRX-D3` is recorded only in the compatibility analysis, which is a working document kept out of
this repository. `TRX-D2` is subsumed by `DEC-6`, in
[`docs/next-plan/decisions.md`](../next-plan/decisions.md).
