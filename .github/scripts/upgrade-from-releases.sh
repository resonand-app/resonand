#!/usr/bin/env bash
# Does an archive written by every released image survive this one? (`OPS-9`)
#
#   .github/scripts/upgrade-from-releases.sh <candidate image> [host:port]
#
# `OPS-6`'s walk seeds each revision with SQL this checkout wrote, so it proves that today's idea
# of an old schema upgrades. This lets the published image write the archive itself -- through its
# own CLI and its own API, the way somebody's instance was filled -- then starts the candidate on
# the same volume and asks whether everything that was there still is.
#
# The releases are this repository's `v*` tags, read from the remote so that a shallow checkout
# sees them. A pre-release is skipped, and so is a tag on the commit being built: on release day
# that tag's image is the candidate, not something anybody has pulled yet.
#
# What it writes is limited to what every release so far can do. The day a release changes one of
# the calls below, the call for the releases before it has to stay, because those images are the
# point.
set -euo pipefail

candidate="${1:?usage: upgrade-from-releases.sh <candidate image> [host:port]}"
address="${2:-127.0.0.1:8000}"
base="http://$address"
here="$(dirname "$0")"
container=resonand-upgrade
volume=resonand-upgrade
password=a-password-long-enough-to-accept
secret="$(openssl rand -hex 32)"
work="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" > /dev/null 2>&1 || true
  docker volume rm "$volume" > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# A peeled `^{}` line is the commit an annotated tag points at, and wins over the tag object.
releases="$(
  git ls-remote --tags origin 'refs/tags/v*' | awk -v head="$(git rev-parse HEAD)" '
    { name = $2; sub("^refs/tags/", "", name)
      if (name ~ /\^\{\}$/) { sub(/\^\{\}$/, "", name); commit[name] = $1 }
      else if (!(name in commit)) commit[name] = $1 }
    END { for (name in commit) if (name !~ /-/ && commit[name] != head) print substr(name, 2) }
  ' | sort -V
)"
# Failing open here would be a green check over an upgrade nobody ran.
test -n "$releases" || { echo "no released image to upgrade from"; exit 1; }

start() {
  docker run -d --name "$container" -v "$volume:/data" -p "$address:8000" \
    -e RESONAND_SECRET_KEY="$secret" \
    -e RESONAND_TRANSCRIPTION_BASE_URL=http://whisper.invalid/v1 \
    "$1" > /dev/null
  "$here/wait-for-healthy.sh" "$container" 60
}

sign_in() {
  curl -fsS -c "$work/$1.jar" -o /dev/null -X POST "$base/api/auth/session" \
    -H 'content-type: application/json' \
    -d "{\"email\": \"$1@example.test\", \"password\": \"$password\"}"
}

# api <account> <method> <path> [json body]
api() {
  curl -fsS -b "$work/$1.jar" -X "$2" "$base$3" -H 'content-type: application/json' ${4:+-d "$4"}
}

fail() {
  echo "upgrading from $release: $*"
  docker logs "$container" 2>&1 | tail -40
  exit 1
}

# Both over their limits (`DAT-12`), which no release before 0.2.0 enforced, so `0006` has to
# shorten them on the way up. The first words are what search has to find afterwards.
long_title="Lighthouse keeper remembers the winter storm"
long_title+="$(printf ' and the sea kept rising%.0s' $(seq 1 9))"
long_name="Recordings shared with the whole family"
long_name+="$(printf ' and everyone after them%.0s' $(seq 1 4))"

for release in $releases; do
  echo "--- upgrading an archive written by $release to $candidate"
  image="ghcr.io/resonand-app/resonand:$release"
  docker pull -q "$image" > /dev/null
  docker volume create "$volume" > /dev/null

  # A release from 0.2.0 on refuses both with 422, so it is handed the longest it accepts and
  # the checks below still hold: what comes back is at most the limit and a prefix of the long one.
  if [[ "$(printf '%s\n' 0.2.0 "$release" | sort -V | head -1)" == 0.2.0 ]]; then
    title_written="${long_title:0:200}" name_written="${long_name:0:100}"
  else
    title_written="$long_title" name_written="$long_name"
  fi

  # --- The archive, written by the release ---------------------------------------
  start "$image"
  personal=$(docker exec "$container" resonand create-admin \
    --email owner@example.test --display-name Owner --password "$password" \
    | sed -n 's/^Personal library: //p')
  test -n "$personal" || fail "create-admin did not say which library it made"

  # Three different tones, so three different hashes rather than one original and two duplicates.
  docker exec "$container" sh -c 'mkdir -p /data/tmp/upgrade && for f in 220 440 880; do
    ffmpeg -loglevel error -f lavfi -i "sine=frequency=$f:duration=3" /data/tmp/upgrade/$f.flac
  done'
  docker exec "$container" resonand import /data/tmp/upgrade --library "$personal" > /dev/null

  sign_in owner
  guest=$(api owner POST /api/admin/users "$(jq -nc --arg p "$password" \
    '{email: "guest@example.test", display_name: "Guest", password: $p}')" | jq -r .id)
  shared=$(api owner POST /api/libraries "{\"name\": \"$name_written\"}" | jq -r .uuid)
  api owner PUT "/api/libraries/$shared/shares" "{\"grantee_id\": $guest, \"level\": 20}" \
    > /dev/null

  # By the title the filename gave it rather than by position, so the order a listing happens to
  # return is not part of it.
  api owner GET "/api/libraries/$personal/audio?limit=10" > "$work/before.json"
  pick() { jq -r --arg f "$1" '.items[] | select(.title | startswith($f)) | .uuid' \
    "$work/before.json"; }
  titled=$(pick 220) moved=$(pick 440) trashed=$(pick 880)
  test -n "$titled" && test -n "$moved" && test -n "$trashed" \
    || fail "the import did not produce the three recordings it was given"

  category=$(api owner POST "/api/libraries/$personal/categories" '{"name": "Interviews"}' \
    | jq -r .id)
  api owner PATCH "/api/audio/$titled" \
    "{\"title\": \"$title_written\", \"tags\": [\"kept\"], \"category_id\": $category}" > /dev/null
  api owner POST "/api/audio/$moved/move" "{\"library_uuid\": \"$shared\"}" > /dev/null
  api owner DELETE "/api/audio/$trashed" > /dev/null

  checked=$(docker exec "$container" resonand fsck --json | jq .checked)
  test "$checked" = 3 || fail "the release's own fsck checked $checked originals, not 3"
  # The container goes and the volume stays: the candidate meets exactly what the release left.
  docker rm -f "$container" > /dev/null
  rm -f "$work"/*.jar

  # --- The same volume, under the candidate ---------------------------------------
  start "$candidate"
  docker exec "$container" resonand fsck --json > "$work/fsck.json" \
    || { cat "$work/fsck.json"; fail "fsck found something after the upgrade"; }
  jq -e '.checked == 3' "$work/fsck.json" > /dev/null \
    || fail "fsck checked $(jq .checked "$work/fsck.json") originals after the upgrade, not 3"

  sign_in owner || fail "the owner's password no longer signs in"
  sign_in guest || fail "the guest's password no longer signs in"

  api owner GET "/api/audio/$titled" > "$work/titled.json"
  title=$(jq -r .title "$work/titled.json")
  [[ ${#title} -le 200 && "$long_title" == "$title"* ]] \
    || fail "the long title came back as '$title'"
  jq -e --argjson c "$category" '[.tags[].name] == ["kept"] and .category_id == $c' \
    "$work/titled.json" > /dev/null \
    || fail "the recording lost its tag or its category: $(cat "$work/titled.json")"
  api owner GET "/api/search?q=lighthouse" | jq -e --arg u "$titled" \
    '[.. | objects | select(.uuid? == $u)] | length > 0' > /dev/null \
    || fail "search no longer finds the recording by its shortened title"

  name=$(api owner GET "/api/libraries/$shared" | jq -r .name)
  [[ ${#name} -le 100 && "$long_name" == "$name"* ]] \
    || fail "the long library name came back as '$name'"

  api guest GET /api/libraries | jq -e --arg u "$shared" \
    '[.[] | select(.uuid == $u and .level == 20)] | length == 1' > /dev/null \
    || fail "the guest lost the library shared with them"
  api guest GET "/api/audio/$moved" | jq -e --arg u "$shared" '.library_uuid == $u' > /dev/null \
    || fail "the guest cannot read the recording moved into the shared library"

  api owner GET /api/trash/audio | jq -e --arg u "$trashed" \
    '[.. | objects | select(.uuid? == $u)] | length == 1' > /dev/null \
    || fail "the recording in the trash is no longer in the trash"

  echo "an archive written by $release survives $(docker exec "$container" resonand version)"
  docker rm -f "$container" > /dev/null
  docker volume rm "$volume" > /dev/null
  rm -f "$work"/*
done
