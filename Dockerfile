# Sonarium -- the container image (`OPS-1`).
#
# THIS IMAGE IS BACKEND-ONLY, ON PURPOSE. The frontend build stage cannot be written yet:
# `frontend/` carries no toolchain until `INF-3`, and a stage running `npm ci` against a directory
# with no `package.json` would fail every build, including every CI run. The stage is written out
# below, commented, saying exactly what it will do and which task turns it on. A green build that
# is honest about being backend-only is worth more than a red one that is aspirational.
#
# The build context is the repository root, because the frontend and the backend are both in it:
#
#   docker build -t sonarium:local .
#
# Layer order is the point of this file: the lock file and the manifest arrive on their own and
# the source arrives afterwards, so editing code does not reinstall dependencies.

# --- The uv binary, pinned -------------------------------------------------
# Taken from its own image rather than installed with a script, so the version is a tag and not
# whatever the network served that morning.
FROM ghcr.io/astral-sh/uv:0.11.17 AS uv

# --- Backend build ---------------------------------------------------------
FROM python:3.12-slim-bookworm AS backend-build

COPY --from=uv /uv /uvx /usr/local/bin/

# `UV_PYTHON_DOWNLOADS=never` matters more than it looks: a downloaded standalone interpreter
# would leave the virtualenv pointing at a binary the final image does not have. This build uses
# the image's own python3.12, which the runtime stage shares.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /src

# Dependencies from the lock alone. `--no-install-project` is what keeps this layer valid across
# every source change; `--frozen` refuses to re-resolve, so the image gets what CI got and not a
# newer resolution of the same constraints.
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# Then the project. `--no-editable` installs a built wheel into the environment, so the runtime
# stage needs the virtualenv and nothing else from here -- including the `sonarium` command and
# the migration tree, which lives inside the package for exactly that reason.
COPY backend/ ./
RUN uv sync --frozen --no-dev --no-editable

# --- Frontend build -- NOT WIRED YET, ADDED BY `INF-3` ---------------------
#
# `frontend/` is directory scaffolding only. `INF-3` brings Vite, React, strict TypeScript,
# ESLint, Prettier and Vitest, and with them the `package.json` and `package-lock.json` that the
# stage below needs. Turning it on is three edits, all of them here:
#
#   1. uncomment this stage,
#   2. uncomment the `COPY --from=frontend-build` line in the runtime stage,
#   3. delete the backend-only warning at the top of this file.
#
# FROM node:22-bookworm-slim AS frontend-build
# WORKDIR /src
# # The lock file on its own first, for the same reason as the backend above.
# COPY frontend/package.json frontend/package-lock.json ./
# RUN npm ci
# COPY frontend/ ./
# # Vite writes a hashed bundle into dist/, which the API serves as the SPA shell. Making that
# # shell work under a subpath as well as a subdomain is `OPS-4`, not this stage.
# RUN npm run build

# --- Runtime ---------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

# ffmpeg brings ffprobe with it, and both are needed at runtime rather than at build time: the
# metadata probe, the waveform peaks and the Opus derivative all shell out to them. Nothing from
# the build toolchain is in this stage -- no uv, no compilers, no node.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# A named volume mounted over an empty directory inherits that directory's ownership from the
# image, which is why /data and both of its mount points are created and chowned here instead of
# at first run. Skipping this is how a non-root container ends up unable to write to its own
# volume, and the failure looks like a permissions bug in the application.
RUN groupadd --system --gid 10001 sonarium \
 && useradd --system --uid 10001 --gid 10001 --home-dir /app --no-create-home sonarium \
 && mkdir -p /app /data/storage \
 && chown -R sonarium:sonarium /app /data

COPY --from=backend-build --chown=sonarium:sonarium /app/.venv /app/.venv
# The licence travels with the image: it is what anyone running a modified copy has to comply with.
COPY --chown=sonarium:sonarium LICENSE /app/LICENSE
# COPY --from=frontend-build --chown=sonarium:sonarium /src/dist /app/static

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
USER sonarium
EXPOSE 8000

LABEL org.opencontainers.image.title="Sonarium" \
      org.opencontainers.image.description="A self-hosted archive for the recordings that matter." \
      org.opencontainers.image.source="https://github.com/sonarium-app/sonarium" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

# `/readyz` rather than `/healthz`: the question a restart should turn on is whether the
# instance can serve, not whether the process is answering. A container that answered
# `/healthz` with an unreachable database would be restarted forever by something watching the
# wrong one. Written as a python one-liner because the image carries no curl and does not need
# to; a non-2xx status raises, which is what docker reads.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/readyz', timeout=3)"]

# No entry-point script and no migration step here: the application migrates itself at startup
# under a file lock (`OPS-7`), so the ordinary upgrade is to pull a new image and restart. It
# also runs the job worker in-process; set `SONARIUM_RUN_WORKER=false` and run `sonarium work`
# in a second container to split them.
#
# `--proxy-headers` is on because this is meant to sit behind a reverse proxy (`OPS-4`), and
# without it every session is recorded as coming from the proxy. uvicorn only trusts those
# headers from 127.0.0.1 by default; a proxy on another host needs
# `--forwarded-allow-ips` set to its address, and deliberately not to `*`.
CMD ["uvicorn", "sonarium.api.app:create_app", "--factory", \
     "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
