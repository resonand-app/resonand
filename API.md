# The HTTP API

The web interface is one client of this API and has no privileged path into the archive: every
screen in it is built out of the endpoints below, and anything it can do, a script of yours can do.

**Everything lives under `/api`.** The instance publishes its own document — the same one this
repository commits at `frontend/src/api/contract/openapi.json`, from which the interface's types are
generated — and serves a browsable copy of it:

| | |
|---|---|
| `GET /api/openapi.json` | The OpenAPI 3.1 document, which is the field-level truth |
| `/api/docs` | The same thing, browsable, with every schema expanded |

This page is the part that document cannot tell you: how to get a session, what the conventions
mean, and which endpoints matter for the things people actually want to automate.

## Signing in

**There are no API tokens in this version.** The API authenticates the same way the interface does,
with a session cookie, and a script holds one by keeping a cookie jar. Personal access tokens are on
[`ROADMAP.md`](ROADMAP.md); until they arrive, a script signs in as an account somebody created, and
it holds that account's password.

```bash
curl -sS -c jar -X POST https://archive.example.org/api/auth/session \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.org","password":"…"}'
```

That sets `resonand_session`, which is `HttpOnly`, `SameSite=Lax`, scoped to the instance's base
path, `Secure` whenever the request arrived over HTTPS, and good for as long as
`RESONAND_SESSION_TTL_DAYS` says. Every later call carries the jar:

```bash
curl -sS -b jar https://archive.example.org/api/auth/me
```

`DELETE /api/auth/session` ends that session; `GET /api/auth/sessions` lists the ones an account
has, with `DELETE /api/auth/sessions/{id}` and `DELETE /api/auth/sessions` to revoke one or all of
the others. Sign-in attempts are counted per address and slowed after a few — a script that retries
a wrong password in a loop will be told to wait, and `SECURITY.md` explains what that counter is and
is not.

An instance configured for HTTPS refuses a password over plain HTTP rather than accepting it and
setting a cookie the browser will discard.

## The conventions

- **`uuid`s in URLs, never the integer ids.** Those exist and are internal; nothing public exposes
  them, and a URL built out of one will not work tomorrow.
- **404 rather than 403** for anything you may not read. A 403 confirms the thing exists, which is
  itself worth something to somebody who should not know.
- **Errors are RFC 9457 problem documents**, `application/problem+json`, with `type`, `title`,
  `status`, `detail` and a `request_id`. Read `detail` for people, `type` for code, and quote the
  `request_id` in a bug report — it is the one thing that finds the request again in the logs.
- **Lists are pages**: `{ "items": [...], "limit": …, "offset": …, "total": … }`, with `limit` and
  `offset` as query parameters. `total` is the whole count, not the page's.
- **No CORS headers are sent**, deliberately — the interface is served from the same origin as the
  API, so nothing needs them. A browser application on another origin cannot call this instance;
  a server-side client can, and that is the supported shape.

## What is worth automating

| | |
|---|---|
| `GET /api/instance` | Answers before you have a session: version, upload ceiling, accepted extensions, sharing levels, how long the trash keeps things |
| `POST /api/libraries/{library_uuid}/audio` | Upload, `multipart/form-data`, fields `file`, `language` and `transcribe`. Ask for the transcription here and there is no second call |
| `GET /api/audio` | Every recording you can see, paged |
| `GET /api/search` | The whole archive, with `q`, `library`, `category_id`, `tag`, `recorded_from`, `recorded_to`, `min_duration_ms`, `max_duration_ms` and `transcription_state`. `GET /api/search/about` says in words what this index can and cannot match, so a client can show its limits rather than guess them |
| `POST /api/audio/{audio_uuid}/transcribe` | Ask for one; `GET …/transcription` is what is happening to it; `…/transcribe/cancel` gives up |
| `GET /api/audio/{audio_uuid}/transcript` | The active transcript as timed segments. `…/transcripts` lists every version, and one is made active with `…/transcripts/{id}/activate` |
| `GET /api/audio/{audio_uuid}/original` | The original file, byte for byte, exactly as it was ingested |
| `GET /api/events` | `text/event-stream`: what changed, as it changes, rather than polling |

**Playback is the one endpoint shaped by the browser rather than by the API.**
`GET /api/audio/{audio_uuid}/stream` serves ranges for the `<audio>` element, and because that
element cannot send a header, `POST /api/audio/{audio_uuid}/playback-token` mints a short-lived
signed token for the query string. A script with a cookie jar needs neither: ask for the stream, or
the original, with the jar.

## What this API will not do for you

- **It will not search inside audio that has no transcript.** Search is over transcripts and
  metadata; a recording nobody has transcribed is findable by its title, tags, category and dates
  and not by anything said in it.
- **It will not transcribe.** `POST …/transcribe` queues work for whatever endpoint the operator
  configured, and `GET /api/transcription/destination` says where that is — including whether the
  address is on private space — before anything is sent.
- **It will not let you act for somebody else.** Every endpoint resolves permissions for the account
  whose session you hold, with no impersonation and no service account. An administrator's extra
  reach is the `/api/admin` group and nothing else.
