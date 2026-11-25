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

## DEC-29 · Who somebody sharing a library may see

`API-15` made sharing take a whole email address and nothing shorter: the lookup matched the full
normalised address and answered with at most one account, so that no library manager could walk
the instance's accounts. The price was paid by everybody who shares anything — on a family
instance of four people, sharing meant knowing and typing somebody's exact address, for a person
whose name is on the dinner table.

**Decided:** the share panel lists **every active account on the instance** but the caller's, by
display name, for anybody who manages a library. The cost is named rather than hidden: every
account manages its own personal library, so **every signed-in account can read the name and
address of every active account**. Resonand is built for a household or a small group of people
who already know each other, and on that instance the list says nothing anybody did not know.

Rejected, and why each looks better than it is:

- **Only people you already share with**, in either direction. Nothing new leaks, because those
  names already appear in share panels — and it cannot answer the first share, which is the one
  that needed help. Somebody new to the instance would still be typing an address.
- **The whole instance behind an administrator's switch.** Right for an instance whose accounts
  do not know each other, which is not the one Resonand is built for. It is a setting nobody asked
  for, with an upgrade path, and the default would be the very thing this replaces.

`GET /users/lookup` is **deprecated rather than removed**: the interface stops calling it, and a
script written against `0.1` or `0.2` keeps working until a minor release that says so takes it
away.

**Unblocks** `API-29` in [`api.md`](api.md) and `UI-49` in [`interface.md`](interface.md).
