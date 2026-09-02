"""Live sign-ins (``DEC-12``).

The cookie carries an opaque secret and nothing else. A stateless signed cookie would have been
less code, and it cannot deliver either of the two things that were promised: revoking one
session (``API-3``) and listing the sessions an account has open (``UI-20``). With a row per
session, "sign out everywhere" is one ``UPDATE``.

A revoked session is marked, never deleted, because the profile view shows what was signed out
and when -- which is the only way somebody notices a session they did not start.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session as DbSession

from sonarium.api.security import hash_session_token, new_session_token
from sonarium.core.time import instant_after, now_instant
from sonarium.db.engine import changed_rows
from sonarium.db.models import Session, User

TOUCH_INTERVAL_SECONDS = 60
"""How stale ``last_seen_at`` is allowed to get. Writing it on every request would turn every
read into a write, and serialise the whole archive behind the write lock for no benefit."""


def create_session(
    db: DbSession,
    user_id: int,
    *,
    ttl_days: int,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[Session, str]:
    """Open a session. Returns the row and the secret, which is the only time the secret exists."""
    token = new_session_token()
    row = Session(
        user_id=user_id,
        token_hash=hash_session_token(token),
        created_at=now_instant(),
        last_seen_at=now_instant(),
        user_agent=(user_agent or None),
        ip=(ip or None),
        expires_at=instant_after(timedelta(days=ttl_days)),
    )
    db.add(row)
    db.flush()
    return row, token


def resolve_session(db: DbSession, token: str) -> tuple[Session, User] | None:
    """Find the live session a cookie refers to, and whose it is.

    Every reason to refuse -- unknown token, revoked, expired, disabled account -- returns the
    same ``None``. The caller cannot tell them apart and neither can whoever presented the cookie.
    """
    row = db.execute(
        select(Session).where(Session.token_hash == hash_session_token(token))
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at <= now_instant():
        return None
    user = db.get(User, row.user_id)
    if user is None or user.disabled_at is not None:
        return None
    return row, user


def touch(db: DbSession, session_id: int) -> None:
    """Record that a session was used, without writing on every request."""
    db.execute(update(Session).where(Session.id == session_id).values(last_seen_at=now_instant()))


def needs_touch(row: Session) -> bool:
    """Whether enough time has passed to be worth a write."""
    return row.last_seen_at < instant_after(timedelta(seconds=-TOUCH_INTERVAL_SECONDS))


def revoke(db: DbSession, user_id: int, session_id: int) -> bool:
    """Sign one session out. Only the account that owns it may."""
    result = db.execute(
        update(Session)
        .where(
            Session.id == session_id,
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
        )
        .values(revoked_at=now_instant())
    )
    return bool(changed_rows(result))


def revoke_all(db: DbSession, user_id: int, *, except_session_id: int | None = None) -> int:
    """Sign out everywhere. One UPDATE, which is the whole reason this table exists."""
    query = update(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None))
    if except_session_id is not None:
        query = query.where(Session.id != except_session_id)
    return changed_rows(db.execute(query.values(revoked_at=now_instant())))


def list_sessions(db: DbSession, user_id: int) -> list[Session]:
    """Every session an account has, most recently used first (``UI-20``)."""
    return list(
        db.execute(
            select(Session).where(Session.user_id == user_id).order_by(Session.last_seen_at.desc())
        )
        .scalars()
        .all()
    )


def purge_expired(db: DbSession) -> int:
    """Drop sessions that expired long enough ago to be of no interest."""
    result = db.execute(
        update(Session)
        .where(Session.expires_at <= now_instant(), Session.revoked_at.is_(None))
        .values(revoked_at=now_instant())
    )
    return changed_rows(result)
