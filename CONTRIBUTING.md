# Contributing

The short version: **issues, security reports and code are all welcome.** Code opened with
`0.1.0`, which is what this page said it was waiting for.

## What is welcome today

**Security reports.** [`SECURITY.md`](SECURITY.md) is the whole of it. If you found a way into
somebody else's recordings, that is the report this project most wants — use GitHub's private
vulnerability reporting rather than an issue, because a working exploit on a public tracker is one
anybody can run against an instance that has not upgraded yet.

**Disagreement with the premises.** [`VISION.md`](VISION.md) says what this is for, who it is for
and what it will never do. An issue arguing that one of those is wrong is more useful than a patch,
because everything else follows from them and they are cheap to change now and expensive later.

**Bugs you hit running it.** Say what you did, what happened and what you expected, and give the
version — `resonand version`, or the line in **Settings → About**. If you are on a commit rather
than a release, say which.

**Whether it works with your transcription endpoint.** [`deploy/`](deploy/README.md) lists what has
been verified, and the list is short because it only contains things somebody actually ran.
`resonand check-transcription` prints what an endpoint did with a generated tone before any of your
audio moves — run it before reporting an endpoint as broken.

**Code.** It was held back while the first version was used in private, because in this niche
credibility comes from the author actually using the thing. That is done, so the door is open —
with one request: **open an issue before a large change**, so that nobody spends a weekend on
something that turns out to disagree with [`VISION.md`](VISION.md). A small fix needs no
permission.

**Translations.** Every user-visible string lives in `frontend/src/i18n/en/`, so a second language
is a directory beside it rather than a change to the interface. The machinery is there and has
never been exercised by a real translation; the first one will find what English was hiding.

## What is still slow

One person maintains this, in the evenings. A pull request will be read, and it may be read a week
later. Nothing here is abandoned because it was quiet for a fortnight.

## What happens to an issue

A report small enough to just fix becomes a pull request, and the description closes the issue with
`Fixes #12`. Nothing else is needed.

A request big enough to argue about first gets **scoped into the plan** — `docs/next-plan/`, one
file per track — where it is given an identifier, a reason and a criterion for being done. The
issue stays where the conversation is; the plan entry is what somebody builds against, and it names
the issue it came from. That is not ceremony for its own sake: it is how a request survives the
six months between being a good idea and being somebody's evening.

## Opening a pull request

Sometimes the fix is smaller than the issue describing it. Either way:

- **One concern per pull request**, and its description answers four things: the problem in terms
  somebody would recognise from using the archive, what changed and why that way, what you rejected,
  and how you verified it — including what you did *not* verify.
- **The quality gate runs locally and in CI, and they are the same commands.** `uvx pre-commit
  install` once, then never `--no-verify`. Backend: `ruff`, `mypy` strict, `pytest`. Frontend:
  `eslint`, `prettier`, `tsc`, `vitest`.
- **Commits are [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**, lowercase,
  imperative, no scope. The body says *why*, never what the diff already shows.

[`AGENTS.md`](AGENTS.md) is the full version — repository layout, the rules that are not negotiable,
and the reasoning behind them. It is written for the person working on this daily and is long; you
do not need to read it to file an issue.

## Code of conduct

[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). It is short, and it is not decoration.
