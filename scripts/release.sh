#!/usr/bin/env bash
# Set the version everywhere it is written (`INF-12`).
#
#   scripts/release.sh 0.1.0
#
# It does not commit, tag or push. What it leaves is a tree where every file agrees on one
# version and the gate is green -- which is the part that is easy to get half right by hand,
# because four of the six places are generated and two of those are checked by something whose
# failure message never mentions a version. `resonand openapi --check` says the published
# document differs from the snapshot; `npm ci` says the lock file is out of sync with the
# manifest. Neither says "you bumped the version in one file".
set -euo pipefail

version="${1:-}"
[[ -n "$version" ]] || {
  echo "usage: scripts/release.sh <version>    e.g. scripts/release.sh 0.1.0" >&2
  exit 2
}

# Semantic versioning without build metadata, which nothing here has a use for. A leading `v` is
# refused rather than stripped: the tag carries one and the manifests do not, and a `v` that
# reaches pyproject.toml builds a wheel nobody can install.
if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "not a version this can set: $version" >&2
  echo "expected MAJOR.MINOR.PATCH with an optional -prerelease, and no leading v" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

# A dirty tree would mix the bump into whatever else is in flight, and the point of running this
# rather than editing six lines is that the diff it leaves is small enough to read in one screen.
# Untracked files are nobody's business here.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "the working tree has uncommitted changes -- commit or stash them first" >&2
  exit 1
fi

echo "Setting the version to $version."

# --- The two written by hand ------------------------------------------------
# Anchored to the table and the assignment rather than to a line number, and to the *first*
# `version` under [project], which is the project's own -- every later one belongs to a
# dependency specifier.
python3 - "$version" <<'PY'
import re
import sys
from pathlib import Path

version = sys.argv[1]


def replace(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    new, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"{path}: expected one match for {pattern!r}, found {count}")
    path.write_text(new, encoding="utf-8")


replace(
    Path("backend/pyproject.toml"),
    r'(?s)(\[project\].*?^version = ")[^"]+(")',
    rf"\g<1>{version}\g<2>",
)
replace(
    Path("backend/resonand/__init__.py"),
    r'^(__version__ = ")[^"]+(")',
    rf"\g<1>{version}\g<2>",
)
PY

# --- The four that are generated --------------------------------------------
# npm owns package.json and package-lock.json together: the lock carries the version twice, and
# `npm ci` refuses a lock that disagrees with its manifest -- so editing the manifest alone
# breaks every install rather than merely being untidy.
( cd frontend && npm version --no-git-tag-version --allow-same-version "$version" > /dev/null )

# uv.lock records the project's own version beside its dependencies'.
( cd backend && uv lock --quiet )

# The published API document carries it in `info.version`, and the interface's types are
# generated from that file.
( cd backend && uv run resonand openapi )

# --- What the gate would say ------------------------------------------------
# Only the two checks this change can break. The suites are the caller's business.
( cd backend && uv lock --check && uv run resonand openapi --check )

echo
git --no-pager diff --stat
echo
echo "Nothing is committed. Run the gate, then commit."
