"""Signing in, signing out, and the first run (``API-3``, ``API-7``).

Registration is administrator-only in v0: the first account created is the administrator, and
that account creates the rest by hand. Open registration and OIDC are both later milestones, and
both are surface rather than model -- the schema already carries ``oidc_subject``.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from sonarium import __version__
from sonarium.api.deps import (
    CurrentCaller,
    InstanceSettings,
    ReadSession,
    WriteSession,
    current_caller,
)
from sonarium.api.rate_limit import AttemptLimiter
from sonarium.api.schemas import (
    Bootstrap,
    ChangePassword,
    InstanceState,
    Me,
    SessionSummary,
    SignIn,
    UpdateMe,
)
from sonarium.api.security import hash_password, needs_rehash, verify_password
from sonarium.core.config import Settings
from sonarium.core.errors import ConflictError, InvalidRequestError, NotFoundError
from sonarium.core.text import normalise_email
from sonarium.db import sessions, users

router = APIRouter(tags=["authentication"])

MINIMUM_PASSWORD_LENGTH = 10

_SAME_ANSWER = "That email and password do not match an account."
"""One answer for a wrong address and a wrong password. Two answers would make the sign-in form
an oracle for which addresses have accounts here."""


def _limiter(request: Request, settings: Settings) -> AttemptLimiter:
    """The instance's limiter, created on first use so a bare app still works."""
    existing = getattr(request.app.state, "login_limiter", None)
    if isinstance(existing, AttemptLimiter):
        return existing
    made = AttemptLimiter(settings.login_attempts_per_minute)
    request.app.state.login_limiter = made
    return made


def _set_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=settings.session_ttl_days * 24 * 3600,
        path=f"{settings.base_path}/" if settings.base_path else "/",
    )


@router.get("/instance", response_model=InstanceState, summary="What this instance is")
def instance_state(session: ReadSession) -> InstanceState:
    """Answered without a session, because the sign-in screen needs it before there is one."""
    return InstanceState(
        name="sonarium",
        version=__version__,
        needs_bootstrap=users.count_users(session) == 0,
    )


@router.post("/auth/bootstrap", response_model=Me, status_code=status.HTTP_201_CREATED)
def bootstrap(
    body: Bootstrap,
    session: WriteSession,
    settings: InstanceSettings,
    response: Response,
    request: Request,
) -> Me:
    """Create the first account, which is an administrator (``API-7``).

    Refused the moment any account exists, so this is not a way in later. The first run is the
    only moment an instance has nobody to authorise the request.
    """
    if users.count_users(session) > 0:
        raise ConflictError("This instance already has an account. Sign in instead.")
    if len(body.password) < MINIMUM_PASSWORD_LENGTH:
        raise InvalidRequestError(
            f"A password needs at least {MINIMUM_PASSWORD_LENGTH} characters."
        )
    user = users.create_user(
        session,
        email=str(body.email),
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        is_admin=True,
    )
    _, token = sessions.create_session(
        session,
        user.id,
        ttl_days=settings.session_ttl_days,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    _set_cookie(response, token, settings)
    return Me.model_validate(user)


@router.post("/auth/session", response_model=Me, summary="Sign in")
def sign_in(
    body: SignIn,
    session: WriteSession,
    settings: InstanceSettings,
    response: Response,
    request: Request,
) -> Me:
    """Exchange an email and a password for a session cookie."""
    key = normalise_email(str(body.email))
    limiter = _limiter(request, settings)
    if not limiter.check(key):
        raise InvalidRequestError(
            "Too many sign-in attempts. Wait a minute and try again.",
            code="too_many_requests",
        )
    user = users.find_by_email(session, str(body.email))
    if user is None or not verify_password(user.password_hash, body.password):
        raise InvalidRequestError(_SAME_ANSWER, code="unauthenticated")
    if user.disabled_at is not None:
        raise InvalidRequestError(_SAME_ANSWER, code="unauthenticated")
    limiter.forget(key)
    if user.password_hash and needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    _, token = sessions.create_session(
        session,
        user.id,
        ttl_days=settings.session_ttl_days,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    _set_cookie(response, token, settings)
    return Me.model_validate(user)


@router.delete("/auth/session", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
def sign_out(
    caller: CurrentCaller,
    session: WriteSession,
    settings: InstanceSettings,
    response: Response,
) -> None:
    sessions.revoke(session, caller.id, caller.session.id)
    response.delete_cookie(
        settings.session_cookie_name,
        path=f"{settings.base_path}/" if settings.base_path else "/",
    )


@router.get("/auth/me", response_model=Me, summary="The signed-in account")
def me(caller: CurrentCaller) -> Me:
    return Me.model_validate(caller.user)


@router.patch("/auth/me", response_model=Me, summary="Change your own account")
def update_me(body: UpdateMe, caller: CurrentCaller, session: WriteSession) -> Me:
    """Display name, address and language (``API-13``).

    Only the password could be changed before, which left V10's Account and Appearance sections
    with nothing to save to. Changing an address re-derives ``email_normalised`` -- the key
    identity is decided on -- and answers 409 on a collision, the same as creating an account.

    Theme is deliberately absent. It is a property of the screen rather than of the person, and
    "follow the system" is already a per-device idea, so it lives in browser storage.
    """
    return Me.model_validate(
        users.update_profile(
            session,
            caller.id,
            display_name=body.display_name,
            email=body.email,
            language=body.language,
            clear_language=body.clear_language,
        )
    )


@router.post("/auth/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePassword,
    caller: CurrentCaller,
    session: WriteSession,
) -> None:
    """Change a password, ending every other session.

    Signing the other sessions out is the point of changing a password when you think somebody
    else has it. Leaving them alive would make the change decorative.
    """
    if not verify_password(caller.user.password_hash, body.current_password):
        raise InvalidRequestError("That is not your current password.")
    user = session.get(type(caller.user), caller.id)
    if user is None:
        raise NotFoundError("No such account.")
    user.password_hash = hash_password(body.new_password)
    sessions.revoke_all(session, caller.id, except_session_id=caller.session.id)


@router.get("/auth/sessions", response_model=list[SessionSummary])
def list_sessions(caller: CurrentCaller, session: ReadSession) -> list[SessionSummary]:
    """Every session this account has, so somebody can notice one they did not start."""
    return [
        SessionSummary(
            id=row.id,
            created_at=row.created_at,
            last_seen_at=row.last_seen_at,
            expires_at=row.expires_at,
            revoked_at=row.revoked_at,
            user_agent=row.user_agent,
            ip=row.ip,
            is_current=row.id == caller.session.id,
        )
        for row in sessions.list_sessions(session, caller.id)
    ]


@router.delete("/auth/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: int, caller: CurrentCaller, session: WriteSession) -> None:
    """Sign one session out from another one."""
    if not sessions.revoke(session, caller.id, session_id):
        raise NotFoundError("No such session.")


@router.delete("/auth/sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_other_sessions(caller: CurrentCaller, session: WriteSession) -> None:
    """Sign out everywhere else. One UPDATE, which is why the session table exists."""
    sessions.revoke_all(session, caller.id, except_session_id=caller.session.id)


__all__ = ["current_caller", "router"]
