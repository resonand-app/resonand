# Contributing

The short version: **issues and security reports are welcome now, code is not yet.** That is a
deliberate stage rather than a closed door, and this page says which is which.

## What is welcome today

**Security reports.** [`SECURITY.md`](SECURITY.md) is the whole of it. If you built this from a
commit and found a way into somebody else's recordings, that is worth hearing about long before
there is anything to install — use GitHub's private vulnerability reporting rather than an issue.

**Disagreement with the premises.** [`VISION.md`](VISION.md) says what this is for, who it is for
and what it will never do. An issue arguing that one of those is wrong is more useful than a patch,
because everything else follows from them and they are cheap to change now and expensive later.

**Bugs you hit running it.** You built it from source, so you are ahead of where the project says
it is — which makes your report better than most. Say what you did, what happened and what you
expected.

**Whether it works with your transcription endpoint.** [`deploy/`](deploy/README.md) lists what has
been verified, and the list is short because it only contains things somebody actually ran.
`resonand check-transcription` prints what an endpoint did with a generated tone before any of your
audio moves — run it before reporting an endpoint as broken.

## What is not open yet

**Code.** Not because contributions are unwelcome, but because the first version is deliberately
being used in private before it is offered to anyone: in this niche credibility comes from the
author actually using the thing, and the fastest way to lose it is to ship something that loses
files. A pull request today would be reviewed against conventions that are still moving, by
somebody whose attention is on getting the archive to survive several weeks of real use.

**Translations.** Every user-visible string already lives in `frontend/src/i18n/en/`, so the
machinery is there and the second language is not a big change. It waits for the same moment, for
the same reason: a translation of copy that is still being rewritten is work thrown away.

Both open with the first installable release. If you want to be told when, watch the repository.

## If you are going to open a pull request anyway

Sometimes the fix is smaller than the issue describing it. In that case:

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
