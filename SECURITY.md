# Security

Resonand holds recordings of people's families, their interviews and their thinking out loud. A
flaw here is not an inconvenience; it is somebody's grandmother's voice in a stranger's hands. That
is the standard reports are read against.

## Status

**The first version is complete and in private use. There is no release, no published image and no
supported version.** `main` is the only thing that exists, so a fix lands there and nowhere else —
there is nothing to backport to.

If you are running this, you built it yourself from a commit you chose, and you are ahead of where
the project says it is. That is allowed, and a report from you is worth more than one from anybody
else.

## Reporting

**Use GitHub's private vulnerability reporting** — the *Report a vulnerability* button under the
repository's **Security** tab. It opens a thread only you and the maintainer can read, which is
what keeps a working exploit off a public issue tracker while it is still working.

**Please do not open a public issue for a vulnerability.** Anything else — a crash, a wrong
permission that does not leak anything, an operational surprise — is an ordinary issue and is
welcome there.

What helps, in rough order:

- What an attacker gets. "Reads recordings in a library not shared with them" is a finding;
  "the header is missing" is a lint result until it is attached to one.
- How to reproduce it against a fresh instance, including whether the attacker needs an account on
  it, and whether they need to be an administrator.
- The commit you saw it on.

You do not need a proof-of-concept exploit, and you should not run one against anybody else's
instance.

## What to expect

One person maintains this, in the evenings. Rather than promise hours:

- An acknowledgement that a human has read it, within a week.
- An assessment — whether it is a vulnerability, and what it can reach — within two weeks.
- A fix on `main` for anything that lets somebody read or destroy an archive they do not own,
  ahead of any feature work.

If a report goes unanswered past those, assume it was missed rather than ignored, and say so on
the same thread.

Credit in the commit and the release notes if you want it, and not if you do not. There is no
money; the project has none.

## What Resonand assumes

A report is easier to judge against the model the software is actually built on:

- **One instance, one origin.** The API and the interface are served from the same container. The
  session cookie is `HttpOnly`, `SameSite=Lax` and same-origin, and there is no configured origin
  anywhere.
- **Accounts are made by hand.** There is no open registration. The first account is the
  administrator; that person creates the rest. Everybody with an account is somebody the operator
  chose.
- **Resonand speaks plain HTTP and expects a reverse proxy in front of it** for TLS. The compose
  file binds to loopback for that reason.
- **The operator is not an attacker in this model.** Whoever holds the database file and the
  storage tree holds the archive; the permission system exists to keep *accounts* apart from each
  other, not to keep anything from the person running the server.
- **Audio leaves when transcription is requested**, to whatever `RESONAND_TRANSCRIPTION_BASE_URL`
  names, and the interface says so before each request. That is principle 2, and the destination is
  the operator's choice — pointing it at a hosted endpoint uploads recordings to that company, as
  designed.

## Known limitations

Stated here rather than left to be found. None of these is a report; all of them are things a
report might reasonably assume were oversights.

- **The sign-in throttle is not a security boundary.** It is an in-memory counter that resets when
  the container restarts, and it exists to make guessing slow. Distributed attempts across many
  addresses are the reverse proxy's job, and `resonand/api/rate_limit.py` says so.
- **`style-src` allows `'unsafe-inline'`.** The interface styles elements through React's `style`
  prop in enough places that removing it is a change to the interface rather than to a header. No
  relaxation applies to `script-src`, which is what stops an injected script running.
- **`SameSite=Lax` is the only thing standing between the API and cross-site requests.** Every
  state-changing endpoint is a `POST`, `PATCH`, `PUT` or `DELETE`, so a modern browser will not
  send the cookie cross-site — but there is no token and no `Origin` check behind it.
- **A playback token travels in a URL.** `<audio>` cannot send a header, so a short-lived signed
  token in the query string is the fallback when a cookie does not reach the media request. It
  names one recording, expires in minutes, and the recording's real permissions are checked when it
  is redeemed. It is still a URL, and a URL gets copied.
- **Anybody who can read a library can see who else it is shared with**, including their addresses.
- **There is no audit log.** Who looked at what is not recorded.

## Out of scope

- The reverse proxy, its TLS configuration, and anything reachable because an instance was
  published to the internet without one.
- The transcription service the operator points the instance at, and what that service does with
  audio sent to it.
- Anything that requires filesystem access to the data volume, for the reason given above.
- Dependency advisories with no reachable path through this code. Report them if you have the path;
  the lock files are updated on their own schedule otherwise.
