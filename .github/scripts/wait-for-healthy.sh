#!/usr/bin/env bash
# Wait for a container to report itself healthy, or say why it never did.
#
# Three steps of the `image` job start a container and none of them can proceed until it is up.
# A copy of this loop in each of them is a copy of the diagnostic too -- which is the part that
# matters, because a container that never came up tells you nothing at all unless somebody
# remembered to print its log.
#
# The image's own HEALTHCHECK is the definition of healthy, deliberately: this waits for the same
# condition Docker restarts on, rather than for a second opinion curled from outside.
set -euo pipefail

container="$1"
timeout="${2:-60}"

for _ in $(seq 1 "$timeout"); do
  case "$(docker inspect -f '{{.State.Status}}/{{.State.Health.Status}}' "$container")" in
    running/healthy) exit 0 ;;
    # Still inside the start period, or a probe has failed and there are retries left.
    running/starting) ;;
    # Retries exhausted, or the process is gone. Neither recovers, and waiting out the timeout
    # only delays the log by a minute.
    *) break ;;
  esac
  sleep 1
done

echo "$container never became healthy:"
docker inspect -f '{{.State.Status}} ({{.State.Health.Status}})' "$container" || true
docker logs "$container" || true
exit 1
