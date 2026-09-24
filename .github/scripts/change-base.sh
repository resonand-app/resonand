#!/usr/bin/env bash
# The commit a change is measured from (`INF-15`).
#
#   .github/scripts/change-base.sh <a pull request's base sha | a push's before sha>
#
# Prints the merge base of that commit and HEAD, so a pull request is measured from where it left
# its base rather than from wherever the base has moved since. Prints nothing when there is no such
# commit here -- a scheduled or dispatched run, the first push of a branch, history that was
# rewritten -- and every caller reads nothing as "the change is everything".
set -euo pipefail

candidate="${1:-}"

# The first push of a branch names forty zeros as what came before it.
if [[ -z "$candidate" || "$candidate" =~ ^0+$ ]]; then
  exit 0
fi

git merge-base "$candidate" HEAD 2> /dev/null || true
