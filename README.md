<h1 align="center">Sonarium</h1>

<p align="center">
  <strong>A self-hosted archive for the recordings that matter.</strong><br>
  Keeps the original intact, transcribes it with the service you choose,<br>
  and lets you search inside everything you have ever recorded.
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licence: AGPL-3.0" src="https://img.shields.io/badge/licence-AGPL--3.0-blue"></a>
  <img alt="Status: pre-alpha, no code yet" src="https://img.shields.io/badge/status-design-orange">
</p>

---

> ### Status: design phase. There is no code yet.
>
> This repository currently holds the vision, the plan and the interface direction. Nothing is
> installable, and nothing here is asking you to try. The reasoning is on the record from the
> start on purpose. When there is something to install, this section will say so.

## The problem

Important audio is not lost for lack of space. It is lost because it ends up scattered across old
phones, messaging threads and cloud accounts — and because an audio file you cannot skim is an
audio file nobody ever opens again.

You recorded your grandmother explaining what the village used to be like, across three
afternoons. You have not opened it in two years, because you cannot remember which afternoon has
the part about the factory, and listening to two hours to find out is a job you never quite start.

## What Sonarium is for

**Re-finding, not storing.** Storing audio is what a folder does, and it is free. Everything here
exists to find one specific moment again inside hundreds of hours:

- **Search inside the audio.** Full-text search across every transcript in your archive, not
  inside one file at a time. Results carry a timestamp and play from that exact second.
- **The original, untouched.** The file you ingested is kept byte-for-byte, forever. A compressed
  copy is generated separately, for playback in the browser.
- **Transcripts as segments.** Always timestamped segments, never a wall of text — that is what
  makes the transcript follow along as it plays, and clicking a line seek to that moment.
- **Organisation that persists.** Libraries, a category tree and cross-cutting tags. Built for
  hundreds of hours, not for one work session.
- **Multi-user from the ground up.** Accounts for the people you share an archive with, and
  sharing at the library or the individual-recording level.
- **Programmatic access.** A first-class HTTP API, with the web interface as just another client,
  plus an MCP server so an assistant can search your archive.

## It is a destination, not a replacement

**Sonarium is not a recorder.** It does not compete with the voice-memo app on your phone — it is
where those files end up. Your phone's recorder is the input, not the rival. Nobody has to change
how they record.

## What it is not

- **It does not transcribe.** It consumes an external transcription service — one you run locally
  or one you pay for. That is a deliberate architecture decision, not a missing feature.
- Not a recorder, not an audio editor, not a podcast player, not a music library manager.

## What it guarantees

Most self-hosted tools in this space are transcribers that happen to store files. Sonarium is an
archive that happens to transcribe — which is a difference about the next ten years, not about the
feature list:

| | Guarantee |
|---|---|
| **Multi-user and sharing** | Real accounts, real permissions, sharing per library or per recording |
| **Persistent organisation** | Libraries, category tree and tags — not a flat list of uploads |
| **Search across everything** | One query over the whole archive, with timestamps |
| **Programmatic access** | Documented HTTP API and an MCP server |
| **Your audio stays put** | On your hardware. It leaves only when you ask for a transcription, and the interface says so |
| **The original is preserved** | Never re-encoded, never rewritten, and verifiable against its hash |
| **Complete export** | One command dumps audio, metadata and transcripts in a format that does not need this software |
| **Engine independence** | Swap transcription provider without losing a single transcript |

Interface quality is deliberately not a row in that table. It is the one thing you cannot verify
from a list, so it gets shown in screenshots instead — once there are screenshots to show.

## Planned stack

Python 3.12 + FastAPI · SQLite with FTS5 · React + TypeScript + Vite · a single container,
configured through environment variables.

## Documentation

| Document | Contents |
|---|---|
| [`VISION.md`](VISION.md) | Why it exists, who it is for, the principles it will not break |
| [`ROADMAP.md`](ROADMAP.md) | What comes after the first version, and what is explicitly out of scope |
| [`docs/v0-plan.md`](docs/v0-plan.md) | The build plan for the first version, task by task |

## Contributing

Not yet — there is nothing to build on. The first version is deliberately being built in private
use before it is offered to anyone, because in this niche credibility comes from the author
actually using the thing, and the fastest way to lose it is to ship something that loses files.
Contribution guidelines arrive with the first installable release.

If the idea interests you, opening an issue to disagree with something in
[`VISION.md`](VISION.md) is genuinely useful.

## Licence

[AGPL-3.0](LICENSE), with no CLA. You can run it, modify it and host it; if you host a modified
version for others, you publish your changes.
