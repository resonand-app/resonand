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


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Check a password against its hash, in constant time as far as the library allows.

    An account with no password hash -- one that only signs in through OIDC, or a seeded one --
    verifies as false rather than raising, so the sign-in path has one shape for every failure and
    cannot be used to find out which accounts have local passwords.
    """
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
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
