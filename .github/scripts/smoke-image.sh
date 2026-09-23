#!/usr/bin/env bash
# Does this image do the job an operator depends on? (`OPS-1`, `OPS-8`)
#
#   .github/scripts/smoke-image.sh resonand:ci [container] [port]
#
# A build only proves the image assembles. This proves two more things: that a fresh container
# creates its own schema and reports itself ready -- which is exactly what was broken when the
# migration tree was located relative to the source tree rather than shipped inside the package --
# and that the interface the same image built is the one it serves.
#
# It is a file rather than a workflow step because two workflows ask the question: the gate, on
# every commit, and the release, before it pushes anything anybody can pull. Two copies would
# drift, and the one that drifts is the copy that runs on release day.
set -euo pipefail

image="${1:?usage: smoke-image.sh <image> [container] [port]}"
container="${2:-resonand-smoke}"
port="${3:-8000}"

# On the way out however this ends, so a failure leaves nothing holding the port for the next
# step -- the release workflow runs this twice on one runner.
trap 'docker rm -f "$container" > /dev/null 2>&1 || true' EXIT

docker run -d --name "$container" -p "$port:8000" \
  -e RESONAND_SECRET_KEY="$(openssl rand -hex 32)" \
  -e RESONAND_TRANSCRIPTION_BASE_URL=http://whisper.invalid/v1 \
  "$image" > /dev/null

"$(dirname "$0")/wait-for-healthy.sh" "$container" 30
curl -fsS "localhost:$port/readyz"
echo

# The shell, asked for the way a browser asks for it. `#root` is what main.tsx mounts into, so its
# absence means the bundle was not copied rather than that a page was merely served -- which a 200
# on its own would not distinguish.
shell=$(curl -fsS -H 'Accept: text/html' "localhost:$port/")
echo "$shell" | grep -q 'id="root"' || {
  echo "the image served no application shell:"
  echo "$shell" | head -20
  exit 1
}

# The hashed bundle the shell points at, actually fetched. A shell referencing a bundle that 404s
# is the failure this catches and the one a smoke test on `/` misses.
bundle=$(echo "$shell" | grep -o '/assets/[^"]*\.js' | head -1)
test -n "$bundle" || { echo "the shell references no bundle"; exit 1; }
curl -fsS "localhost:$port${bundle}" > /dev/null
echo "served the shell and ${bundle}"
