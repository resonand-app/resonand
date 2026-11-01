# Decisions that block work after the first version

`DEC-*`. The ones the first version needed are settled in
[`docs/v0.1.0-plan/decisions.md`](../v0.1.0-plan/decisions.md); these block work here, and each is
cited from elsewhere, which is why they carry numbers at all.

Each is written as a recommendation until it is decided, and deciding one is its own commit.

## DEC-2 · Local ↔ OIDC account linking

Two accounts with the same email address, one local and one from an identity provider: merge
automatically, reject, or require confirmation from the account that already exists.

**Recommendation:** reject by default, offer explicit linking from the profile, and put a
`RESONAND_OIDC_AUTO_LINK` deployment flag behind it for single-family instances. Automatic merging
by email is a privilege escalation whenever the provider does not verify the address, and nothing
in the protocol obliges it to.

**Blocks** the OIDC work on [`ROADMAP.md`](../../ROADMAP.md), which cannot be scoped until this is
answered.

## DEC-6 · A companion transcription container

The principle that the application does not transcribe is correct as architecture, and requiring
somebody to configure a provider before anything works is an enormous barrier for exactly the
audience a one-click installation is meant to reach.

**Recommendation:** an **optional companion container** with a local engine, separate from the
application and consumed through the same provider interface as anything else. It still does not
transcribe; it works without configuring anything.

**Conditions `OPS-11`** in [`release.md`](release.md), so it has to be decided before the packaging
is designed rather than after.

## DEC-27 · Who may take a recording out of a library

Today **Can edit** is enough to send a recording to the trash, to restore it, to delete it for
good from the trash, and to move it into any other library the caller edits. None of that is what
the level says it is. The wording the interface shows when somebody shares a library —
`resonand.core.levels`, which `UI-17` reads — describes an editor as somebody who can *"change
titles, categories and tags, but not share"*: it never mentions removing anything.

The move is the sharper half of it. Ownership lives on the library and not on the recording, so a
recording moved into a library its editor owns has changed hands: the person who shared their
library has lost it from that library, and the person they trusted to fix typos in titles now owns
it.

**Decided** on 2026-10-14: taking a recording out of a library needs **Can manage** on the
recording.

- Sending it to the trash, restoring it, and deleting it from the trash need manage. The trash
  lists what the caller manages, not what they edit.
- Moving it needs manage on the recording and edit on the destination, so moving *in* is still an
  editor's gesture and moving *out* is not.
- Uploading into a library is unchanged at edit: adding something takes nothing away from anybody.
- Manage is resolved through `audio_acl` like every other check, so an individual grant at manage
  counts. Whoever was trusted to share a recording onwards was already trusted with more than an
  editor.

It is the line a library already has: trashing, restoring and purging a library need manage
today. A recording now answers to the same rule as the thing it sits in.

*Rejected:* letting the uploader trash their own upload with edit alone. It answers the case
somebody will actually meet — an editor uploads the wrong file and cannot take it back — but
`uploaded_by` is attribution and nothing else, and making it a permission is a second ownership
model beside the library's. That editor asks a manager.
*Rejected:* moving trash to manage and leaving the move at edit. It looks like the smaller change
and protects nothing, because a move out of a shared library is a deletion that also transfers
ownership.

**The cost, named:** this changes what a grant that already exists allows. Somebody given Can edit
under `0.1.0` loses the trash and the move out on the version that ships this, and an owner who
meant them to keep both has to raise them to Can manage. That makes it a minor release, and the
`CHANGELOG.md` entry has to say it in those words.

**Blocks** `DAT-10` in [`data.md`](data.md), which applies it.

## DEC-28 · How a permanent deletion is confirmed

`UI-34m` built `TypedConfirm` for the one gesture the archive cannot take back: before a recording
or a library leaves the trash for good, the name has to be typed. It was meant to be the gesture
that says *this is the irreversible one*, distinct from the ordinary confirm that sends something
to the trash.

It does not hold up once somebody uses it. Raised as #69: a title taken from a filename is long,
the name only ever appears inside a sentence, and the placeholder that repeats it cannot be
selected — so somebody clearing a dozen recordings drags a selection twelve times, one row at a
time. And it guards a step that is already the third deliberate one: a recording reaches *Delete
now* only by being sent to the trash, then by opening the trash, then by pressing the button on
its row.

**Decided** on 2026-11-01: **a permanent deletion is confirmed in an ordinary dialog, and nothing
is typed.** What `TypedConfirm` was there to protect is kept, and moved into the dialog's words
and its focus:

- The title says *permanently* and names what goes: one recording by its title, or several by
  their count.
- The description states the cost in numbers — recordings, duration, transcripts — and that it
  cannot be undone, which is the promise `UI-34m` was written to keep and the reason "Are you
  sure?" alone is never enough.
- The danger button repeats the verb — *Delete permanently* — so the button read last says the
  same as the title read first.
- **Focus opens on Cancel**, so a dialog dismissed by habit with Enter destroys nothing.

The difference from sending something to the trash is now in what the dialog says rather than in
what it asks for: one says it can be restored for so many days, the other says it cannot be
undone.

*Rejected:* keeping the typed name and fixing how it is shown, which is what #69 offered. It makes
one deletion easier to read and still asks for twelve retypes, or twelve selections, where twelve
clicks would do — and bulk deletion (`INT-8`) cannot ask for a name at all, so the product would
carry two confirmations for the same consequence.
*Rejected:* typing a fixed word, "delete", instead of the name. It is friction with nothing left
to read, since the word is the same every time.

**The cost, named:** a confirm without a gesture is easier to pass on autopilot. What stands
between a click and a loss is the trash itself and the retention window in front of it, the three
steps above, and the focus on Cancel. The specification in `docs/internal/`, which names typed
confirmation for the trash, is superseded on this point.

**Blocks** `INT-7` and `INT-8` in [`integration.md`](integration.md), which apply it.
