# Transcription, after the first version

`TRX-*` and the two provider shapes v0 did not build. The findings here came out of the same
transcriber-compatibility analysis as the ones in
[`docs/v0.1.0-plan/transcription.md`](../v0.1.0-plan/transcription.md), which is where the decisions
governing all of them are written up; these are the ones the first version declined, and they keep
the identifiers they were found under because the code cites several of them by name.

## The provider contract

- [ ] **TRX-2** · **The poll loop, and the queue state a submitted job waits in.** The contract is
      submit-and-poll, but the worker calls `poll()` once and raises if there is no result, and none
      of the queue's five states means *submitted to the provider, come back later*. A worker and
      queue change rather than a contract change — recorded so the contract does not get reopened to
      fix it. `external_id` is also written only in `finish()`, so the field whose whole purpose is
      to survive a restart is never written while a restart could matter. ⇢ JOB-5

- [ ] **JOB-4** · **Webhook provider**: the application publishes the file behind a signed URL and
      the service returns the result to an authenticated callback endpoint. Subject to the same
      disclosure rule as every other egress path (`UI-25`). *Whether this is worth building at all
      is `TRX-D1`, which is open: a signed URL is a public URL for as long as it lives, and the
      archive's first principle is that the original never leaves except to a provider the operator
      chose.*

- [ ] **JOB-5** · **Upload-and-wait provider**, polling against `external_id`. ⇢ TRX-2

## What an engine is allowed to be

- [ ] **TRX-4** · **Normalise granularity at the boundary**: accept native segments, utterances or
      words, and group up to segments in one place. Segments-only is the right invariant and does
      not move; enforcing it by *refusing* anything not already segment-shaped is what excludes
      every engine whose finest unit is the word. This is what widens the market past the Whisper
      family. ⇢ TRX-3

- [ ] **TRX-17** · **Normalise the reported language at the boundary.** The detected language is
      whatever the engine chose to call it, and it is stored that way: a `faster-whisper` server
      answers `ja`, Groq's `whisper-large-v3` answers `English`, and `transcript.language` carries
      both spellings of the same kind of fact through the presenter to the API. Parse it to a code
      where `resolve_language` already sends one — an engine whose answer is in a vocabulary it
      will not accept back cannot round-trip its own detection, and an archive whose engine changed
      holds two vocabularies in one column with nothing recording which row is in which. Small
      today because only the transcript panel reads it; not small once anything filters or groups
      by it, because by then the column has to be repaired rather than constrained. ⇢ TRX-3
      *Found by `JOB-3`'s second deployment. One engine cannot show this, however carefully it is
      read, which is most of the argument for the second one.*

- [ ] **TRX-9** · **Say plainly why an untimed engine is declined.** Wyoming — the Home Assistant
      voice ecosystem, which is precisely the homelab audience [`VISION.md`](../../VISION.md) names
      — returns text with no timestamps and cannot satisfy this archive. Somebody already running
      `wyoming-faster-whisper` will reasonably expect to point Resonand at it, and what they get
      today is a connection error against a port that does not speak HTTP.

- [ ] **TRX-11** · **Seams duplicate speech when segments are coarse.** `restitch` keeps a segment
      by its midpoint and the seam sits in the middle of a three-second overlap, so a segment whose
      *span* crosses the seam survives in both parts and the speech inside the overlap appears
      twice. A fragment at sentence scale; up to three seconds at every cut against an engine
      returning thirty-second segments. The overlap is sized for word-scale run-up, and once
      `TRX-3` declares granularity it can be sized for what is actually coming back. ⇢ TRX-3

## Several engines, and what the operator may say about them

- [ ] **TRX-14** · **Several engines in one instance**, routed by the recording's **declared**
      language (`TRX-D5`), and an engine whose task is to translate rather than to transcribe.
      Needs a recording-level language — there is nothing between the instance default and the
      per-request parameter today — and makes the destination endpoint answer per recording and per
      task rather than per instance (`TRX-D8`). ⇢ TRX-3, TRX-15

- [ ] **TRX-15** · **Configuration in the interface rather than the environment**, with sensitive
      values encrypted at rest under a key that stays outside the database (`TRX-D7`). The provider
      is built once at startup and held for the worker's life, so this is also where that becomes a
      per-job resolution. ⇢ TRX-12

- [ ] **TRX-16** · **Translations as their own class**, distinct from versions (`TRX-D6`), with the
      vocabulary to match: "v1 / v2 / show this one" is version language and says nothing useful
      about a translation. ⇢ TRX-14

- [ ] **TRX-6** · **Five trust classes where there are now two.** "External" collapses a box the
      operator rents and controls, an EU-resident provider with zero retention contracted, and a US
      cloud that may train on the input — and for the credibility layer that distinction *is* the
      decision. Not an assessment of anybody's compliance: somewhere for the operator to declare
      what they have contracted, shown where the audio leaves. ⇢ TRX-15

## Metering

- [ ] **TRX-5** · **Wire the usage sink, or delete the module.** `metering.py` is complete and
      correct, both call sites build a provider without a sink, and so nothing is metered and
      `UsageRecord.outcome` only ever says `submitted`.
      *Settled for now, and recorded here rather than left as a question: `REV-5` took the
      documentation branch, `JOB-2` ships without the rows, and the table lands with the first
      thing that reads them. Until something does, the module stays, doing nothing, on purpose.*
