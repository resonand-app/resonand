"""Passwords and session tokens (``API-3``).

Two secrets with opposite properties, hashed for opposite reasons:

* **A password** is chosen by a person, so it is low-entropy and guessable. It gets Argon2id,
  whose whole job is to be slow enough that guessing is expensive.
* **A session token** is generated here from the system's random source, so it has 256 bits of
  entropy and cannot be guessed at any speed. It gets SHA-256, which is fast on purpose: it is
  read on every single request, and stretching a value nobody can guess would only make the
  archive slower. It is hashed at all so that a leaked database cannot be replayed as a set of
  live cookies.

The plaintext of neither is ever stored, logged or put into an exception message.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

TOKEN_BYTES = 32
"""256 bits. Anything less and the reasoning above stops holding."""

MINIMUM_PASSWORD_LENGTH = 10

_hasher = PasswordHasher()

_NO_ACCOUNT = _hasher.hash(secrets.token_urlsafe(TOKEN_BYTES))
"""A hash of a secret nobody holds, verified against when there is no real hash to verify against.

An Argon2 verification is slow on purpose, so *skipping* one is loud: an account that exists took
about 80 ms to refuse and an address that does not took under 3 ms, which is a difference anybody
can measure across the internet. The sign-in path answers every failure with one sentence
precisely so it cannot be asked which addresses have accounts here, and returning early went on
answering that question through the clock (``SEC-2``).

Hashed once at import. Doing it per call would make the work -- and so the timing -- depend on the
very thing this is here to hide.
"""


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Check a password against its hash, in constant time as far as the library allows.

    **A missing hash does the work anyway and then says no.** One shape covers both callers that
    reach it: an account that only signs in through OIDC, and an address that is not an account at
    all. Neither the message nor the time it took distinguishes them from a wrong password.
    """
    try:
        return _hasher.verify(password_hash or _NO_ACCOUNT, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Whether a stored hash was made with weaker parameters than the ones in force now."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


def new_session_token() -> str:
    """A fresh session secret. This is the only place one is created."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """The stored form of a session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_match(stored_hash: str, token: str) -> bool:
    """Compare a presented token against a stored hash without leaking timing."""
    return hmac.compare_digest(stored_hash, hash_session_token(token))
