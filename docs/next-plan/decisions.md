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
