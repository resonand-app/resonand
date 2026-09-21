# Resonand — vision

Why this project exists, who it is for, and where it is going. It carries no technical detail —
the data model, permission resolution and interface brief live in a working specification that is
not published while the first version is being built.

The order is deliberate. Decisions in the early sections govern the later ones, never the other
way round. If a technical decision ever contradicts something written here, it is the technical
decision that gets revisited.

---

## 1. Positioning

### What it is

A self-hosted archive for the recordings that matter. It keeps the original intact, transcribes
it with whichever service you choose, and lets you search inside everything you have ever
recorded.

### The problem

Important audio is not lost for lack of space. It is lost because it ends up scattered across old
phones, messaging threads and cloud accounts, and because an audio file you cannot skim is an
audio file nobody ever opens again. It ends up existing without being available.

### The verb the project rests on

**Re-find**, not store. Storing audio is what a folder does, and it is free. Everything that
makes Resonand worth existing — transcription, search inside the audio, a navigable waveform,
organisation that persists — is in the service of finding one specific moment again inside
hundreds of hours.

Control over your data is the precondition, not the proposition. Inside the self-hosted community
data sovereignty is not a differentiator: everybody there takes it for granted. Outside that
community it very much is.

### A destination, not a replacement

**Resonand is not a recorder.** It does not compete with the voice memos app on your phone; it is
where those files end up. The operating system's recorder is not the rival, it is the input.

That has two intended consequences. Nobody has to change how they record. And it avoids the one
piece of ground where device makers have a structural advantage, because their record button is
built into the system.

First-party capture — recording from the application, a mobile app — stays a long-term
possibility for when the project is mature. Never a precondition for being useful.

### What it is not

Not a recorder. It does not transcribe by itself. Not an audio editor, not a podcast player, not
a music library manager. It is where audio goes once it has been recorded, with whatever it takes
for it to still be useful ten years from now.

---

## 2. Who it is for

Three layers with different jobs, not three equivalent personas.

**Acquisition — whoever installs it.** Somebody with a homelab already running Immich,
Paperless-ngx or Jellyfin. It is the only realistic arrival channel for a self-hosted project.
They evaluate on concrete criteria: Docker image quality, documentation, backups, resource usage
and whether the project looks alive. **This layer decides feature priorities.**

**Retention — whoever uses it.** The family or circle of the person above, with accounts created
for them. They install nothing, they arrive on a phone, and they judge on one thing only: whether
they find what they were looking for. This is why the application does not get abandoned after
two months. **This layer is what justifies the entire multi-user machinery** — without it, half
the architecture would be premature. It is written down here so that settled decisions do not get
reopened in six months.

**Credibility — whoever gives it weight.** Journalists, researchers, people doing oral history.
Not volume, but the reason this deserves to exist and the source of the best testimony. Not the
group to design for, but not one to shut out either.

The initial focus is the technical profile. Over time the audience widens through better
documentation, a better image and, above all, much easier installation. **The promise never
changes**; it is the same for every layer. What changes is the barrier to entry.

---

## 3. What people will use it for

### The voices you do not want to lose

You recorded your grandmother explaining what the village used to be like, across three
afternoons, forty minutes each. You have not opened it in two years because you cannot remember
which one has the part about the factory, and listening to all of it to find out is a job you
never quite start. With an archive, you type *factory* and you are there in three seconds.

The emotional anchor. It is what sells the project.

### Interviews and field material

Thirty interviews for a report, a thesis or an oral-history project. You need to find who said
one specific thing without remembering which interview it was in, with a timestamp so you can
cite it. The services that solve this well ask you to hand over your sources' audio.

The professional endorsement. It is what legitimises the project.

### Thinking out loud

You record ideas while walking or driving, because that is when they come. The problem is not
recording them, it is that you never listen to them again and they pile up like a graveyard of
voice notes. A searchable archive — later queryable by an assistant through the API — turns that
pile into material you can use.

The daily use. It is what retains the project.

### And beyond that

Lectures and notes from a whole course, minutes and meetings of local organisations, rehearsals
and musical ideas, association and village-history archives, language and dialect fieldwork,
soundscapes and birdsong, a spoken personal diary.

That list is visibly heterogeneous on purpose: it is what shows Resonand is a platform and not a
single-purpose tool.

> Soundscapes and birdsong are the one case where transcription contributes nothing and the
> waveform and the tags do all the work. Useful precisely for that: it shows the archive works
> even when there is no text.

---

## 4. Principles

Non-negotiable. If a future decision contradicts one of these, it is the decision that falls.

1. **No captivity.** The original is kept intact, and there is always one command that dumps
   everything — audio, metadata and transcripts — in a format readable without Resonand.
2. **Your voice does not leave unless you ask.** Audio only leaves the instance when the user
   requests an external transcription, and the interface says so in plain words. Where a standing
   configuration does the asking on your behalf — a watched folder set to transcribe on arrival —
   it is opt-in, and it says what it will send.
3. **Engine independence.** Transcription is a service consumed behind a provider interface.
   Changing engine must cost nothing and lose nothing.
4. **The API is the product.** The web interface is one client among others. Every MCP tool has to
   be implementable as a thin wrapper over an existing endpoint; if it is not, the API is badly
   designed.
5. **An archive does not break.** Versioned migrations, upgrades that lose nothing, deletion
   always through a trash with retention, and an integrity check that can prove no file has gone
   missing.

### Never

Audio editing. Podcast player. Music library manager. A transcription engine inside the
application.

---

## 5. Identity

**Visual direction.** Minimalist and modern, medium-high density, genuinely mobile-first. The
waveform is the signature element and the opportunity to have a personality; it should be
memorable beyond the standard grey bar. A colour and typography decision of its own, derived from
the theme — archive, sound, memory. **One identity, not a palette switcher.** Light and dark mode
both first-class. Accessibility as the floor, not a feature.

**Tone.** Buttons say exactly what will happen. Errors explain what happened and what to do, they
do not apologise. This is not an enterprise tool and it must not look like one.

**Communication surfaces**, in order of real importance: README with screenshots, demo instance,
installation documentation, landing page. The README is the project's primary marketing piece.

---

## 6. Responsibility and privacy

Whoever administers an instance is the data controller. Whoever distributes the software processes
no data and is therefore neither controller nor processor. The obligations — lawful basis,
informing data subjects, handling rights requests, impact assessment — fall on the administrator.

The only thing the GDPR says to the developer is recital 78, which *encourages* producers to take
data protection into account in their design so that controllers can comply. It is encouragement,
not an enforceable obligation. In practice, though, it is what decides whether a professional can
use the tool at all — so it is treated here as a design constraint rather than a legal one.

> The project provides the tools. Whoever administers an instance is the data controller and
> decides what gets recorded, who it is shared with and which external services it is connected
> to. It is the end user's responsibility to find out which rules apply to them, given where they
> are and what use they make of it — particularly regarding the recording of conversations, which
> is governed very differently from country to country. The project does not manage consent, does
> not offer certifications and makes no compliance claims on anyone else's behalf.

**Design condition.** If speaker identification is ever added, it follows the same pattern as
transcription: an optional module consuming a service the user configures, never integrated into
the application. Biometric identification is a high-risk category under the AI Act, and the
free-software exemptions do not cover high-risk systems.

---

## 7. Licence and governance

**AGPL-3.0, with no CLA.** The AGPL keeps every door open: it allows third parties to host it
provided they publish their modifications, and it prevents anyone from building a better closed
version. Declining a CLA builds trust, and the only model it closes off is open core — which was
the worst fit anyway.

The **name** is what protects official status, independently of the code licence.

---

## 8. What success looks like

Three milestones, in order. None of them is a marketing number.

1. **That I use it myself** and stop using what I used before. If that does not happen, nothing
   that comes after matters. It is the only milestone that depends on me alone.
2. **The first issue from a stranger.** Not a star: an issue. It means somebody installed it, used
   it enough to hit a limit, and cared enough to write it down.
3. **The first accepted code contribution**, plus a listing in the sector directories and a
   presence on some one-click hosting platform.

GitHub stars are not a metric. What is a metric, and almost nobody measures it, is **whether
instances survive upgrades**: an archive that breaks when you update it is not an archive.

### And the part worth writing before it is needed

What happens to the project if one day I cannot give it time. Because it is AGPL, documented and
fully exportable, nobody is left trapped: the data comes out with one command in a format that
does not need this software, and the code can be carried on by anyone. Saying that out loud is not
a weakness — it is what makes it reasonable for somebody else to rely on it.
