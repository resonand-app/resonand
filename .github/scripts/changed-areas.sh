#!/usr/bin/env bash
# Which of CI's jobs a change can reach (`INF-17`), as `job=true|false` lines for $GITHUB_OUTPUT.
#
#   .github/scripts/changed-areas.sh <a pull request's base sha | a push's before sha>
#
# Each pattern is what that job reads, found by reading the job rather than guessed from a file's
# extension, so a job that starts reading something new has to be named here -- the weekly run in
# ci.yml is the backstop for the day somebody forgets. Anything this cannot measure reaches every
# job: failing open would be a green check over a suite that never ran.
set -euo pipefail

base="$("$(dirname "$0")/change-base.sh" "${1:-}")"
if [[ -z "$base" ]]; then
  printf '%s=true\n' backend frontend image
  exit 0
fi

# A rename is read as a deletion and an addition, so a file moved out of backend/ is a change to it.
changed="$(git diff --no-renames --name-only "$base" HEAD)"

# What decides which jobs run is a change to every job.
everything='^\.github/(workflows/ci\.yml|scripts/(change-base|changed-areas)\.sh)$'

# `resonand openapi --check` compares against the interface's committed snapshot.
backend='^backend/|^frontend/src/api/contract/openapi\.json$'
# `one-version-everywhere.node.test.ts` holds the backend's three version files and scripts/.
frontend='^frontend/|^scripts/|^backend/(pyproject\.toml|uv\.lock|resonand/__init__\.py)$'
# What the Dockerfile copies, and the two scripts the job runs against the image.
image='^(backend|frontend)/|^(Dockerfile|\.dockerignore|LICENSE)$|^\.github/scripts/'

# The image carries the package and the bundle, and neither contains a test.
shipped="$(grep -vE '(^|/)tests?/|\.test\.tsx?$' <<< "$changed" || true)"

reaches() {
  if grep -qE "$1|$everything" <<< "$2"; then echo true; else echo false; fi
}

echo "backend=$(reaches "$backend" "$changed")"
echo "frontend=$(reaches "$frontend" "$changed")"
echo "image=$(reaches "$image" "$shipped")"
