"""Short-lived tokens for playing audio (``ING-7``).

``<audio src=...>`` cannot send an ``Authorization`` header, and it does not always send cookies
either -- a cross-origin instance, a stricter browser setting, or a system media control fetching
the file outside the page. So the URL itself has to carry the permission.

The rules that make that safe: the token is **signed, not stored**, so it costs nothing to issue;
it names **one recording**, so a leaked link is one recording and not an archive; and it **expires
in minutes**, so a URL copied out of a browser's network tab is worthless by the time anybody
reads it. The recording's real permissions are still checked when the token is redeemed -- the
token says *this link was issued*, never *this person may listen*.
"""

from __future__ import annotations

import hmac
from hashlib import sha256

from pydantic import SecretStr

from sonarium.core.errors import UnauthenticatedError
from sonarium.core.time import now_instant, utc_now

DEFAULT_TTL_SECONDS = 900
"""Long enough to start playing an hour-long recording and scrub around in it, short enough that
a link pasted into a chat is already dead."""

_SEPARATOR = "."


def issue(
    secret: SecretStr, audio_uuid: str, user_id: int, *, ttl_seconds: int = DEFAULT_TTL_SECONDS
) -> str:
    """Mint a token for one recording and one account."""
    expires_at = int(utc_now().timestamp()) + ttl_seconds
    body = f"{audio_uuid}{_SEPARATOR}{user_id}{_SEPARATOR}{expires_at}"
    return f"{body}{_SEPARATOR}{_sign(secret, body)}"


def redeem(secret: SecretStr, token: str, audio_uuid: str) -> int:
    """Check a token and return whose it is, or refuse.

    Refuses on a wrong signature, a different recording, or an expired stamp -- all with the same
    message, because a token that names which of the three went wrong is a token that helps
    somebody work out how to forge one.
    """
    parts = token.split(_SEPARATOR)
    expected_parts = 4
    if len(parts) != expected_parts:
        raise UnauthenticatedError("This playback link is not valid.")
    signed_uuid, raw_user, raw_expiry, signature = parts
    body = f"{signed_uuid}{_SEPARATOR}{raw_user}{_SEPARATOR}{raw_expiry}"
    if not hmac.compare_digest(signature, _sign(secret, body)):
        raise UnauthenticatedError("This playback link is not valid.")
    if signed_uuid != audio_uuid:
        raise UnauthenticatedError("This playback link is not valid.")
    try:
        expires_at = int(raw_expiry)
        user_id = int(raw_user)
    except ValueError as error:
        raise UnauthenticatedError("This playback link is not valid.") from error
    if utc_now().timestamp() > expires_at:
        raise UnauthenticatedError("This playback link has expired. Reload the page.")
    return user_id


def _sign(secret: SecretStr, body: str) -> str:
    return hmac.new(
        secret.get_secret_value().encode("utf-8"), body.encode("utf-8"), sha256
    ).hexdigest()


def issued_at() -> str:
    """When a token was minted, for the log line that records an issue."""
    return now_instant()
