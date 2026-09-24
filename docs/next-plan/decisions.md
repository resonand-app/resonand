# Decisions that block work after the first version

`DEC-*`. The ones the first version needed are settled in
[`docs/v0.1.0-plan/decisions.md`](../v0.1.0-plan/decisions.md); these two block work here, and each is
cited from elsewhere, which is why they carry numbers at all.

Each is written as a recommendation rather than an answer. Deciding one is its own commit.

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
