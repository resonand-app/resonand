"""Signing in, signing out, and the first run (``API-3``, ``API-7``).

Registration is administrator-only in v0: the first account created is the administrator, and
that account creates the rest by hand. Open registration and OIDC are both later milestones, and
both are surface rather than model -- the schema already carries ``oidc_subject``.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from resonand import __version__
from resonand.api.deps import (
    CurrentCaller,
    InstanceSettings,
    ReadSession,
    WriteSession,
    current_caller,
)
from resonand.api.rate_limit import AttemptLimiter, address_key, client_key
from resonand.api.schemas import (
    Bootstrap,
    ChangePassword,
    GrantableLevel,
    InstanceState,
    Me,
    SessionSummary,
    SignIn,
    UpdateMe,
)
from resonand.api.security import hash_password, needs_rehash, verify_password
from resonand.api.transport import scheme_of
from resonand.core import formats
from resonand.core.config import Settings
from resonand.core.errors import ConflictError, InvalidRequestError, NotFoundError
from resonand.core.levels import DESCRIPTIONS, GRANTABLE
from resonand.core.text import normalise_email
from resonand.db import sessions, users

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


def _client_limiter(request: Request, settings: Settings) -> AttemptLimiter:
    """The second counter, for one place trying many accounts (``SEC-3``)."""
    existing = getattr(request.app.state, "login_client_limiter", None)
    if isinstance(existing, AttemptLimiter):
        return existing
    made = AttemptLimiter(settings.login_attempts_per_client_per_minute)
    request.app.state.login_client_limiter = made
    return made


def _cookie_path(settings: Settings) -> str:
    """Where the cookie is scoped, which is what the browser asked for rather than what we got."""
    return f"{settings.base_path}/" if settings.base_path else "/"


def _set_cookie(response: Response, token: str, settings: Settings, request: Request) -> None:
    """Put the session on the response, marked for the connection it is crossing.

    ``Secure`` is the one attribute that describes the browser's channel rather than the instance,
    and a browser discards a ``Secure`` cookie that arrived over plain HTTP without saying so. Read
    per request for the same reason the path is read per deployment: both are facts about what the
    browser did, and an instance reachable two ways has two answers.
    """
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure_for(scheme_of(request)),
        max_age=settings.session_ttl_days * 24 * 3600,
        path=_cookie_path(settings),
    )


def _require_secure_transport(request: Request, settings: Settings) -> None:
    """Refuse to take a password over a channel the instance has said it does not use.

    Raised before the password is read rather than after, because the alternative is checking a
    credential that has already crossed in clear and then answering with a cookie the browser is
    about to throw away -- which reads, from the sign-in form, as a wrong password.
    """
    if settings.refuses_plain_http() and scheme_of(request) != "https":
        raise InvalidRequestError(
            "This instance is reached over HTTPS. This connection is not, so a session opened "
            "here would not be kept. Use the HTTPS address.",
            code="insecure_transport",
        )


@router.get("/instance", response_model=InstanceState, summary="What this instance is")
def instance_state(session: ReadSession, settings: InstanceSettings) -> InstanceState:
    """Answered without a session, because the sign-in screen needs it before there is one.

    It is also where the facts every view needs live, so that nothing hard-codes them: how long
    the trash keeps things (``INT-1``) and what an upload may be (``UI-18a``).
    """
    return InstanceState(
        name="resonand",
        version=__version__,
        needs_bootstrap=users.count_users(session) == 0,
        trash_retention_days=settings.trash_retention_days,
        max_upload_bytes=settings.max_upload_bytes,
        accepted_extensions=sorted(formats.ACCEPTED_EXTENSIONS),
        video_extensions=sorted(formats.VIDEO_EXTENSIONS),
        levels=[
            GrantableLevel(level=int(level), description=DESCRIPTIONS[level]) for level in GRANTABLE
        ],
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
    _require_secure_transport(request, settings)
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
    _set_cookie(response, token, settings, request)
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
    _require_secure_transport(request, settings)
    client = request.client.host if request.client else None
    key = address_key(normalise_email(str(body.email)), client)
    limiter = _limiter(request, settings)
    # Both counters, and the address one is keyed on where the attempt came from as well. Counting
    # an address alone meant somebody who knew yours could spend its budget from anywhere and keep
    # you out of your own account, while one client could still walk a whole address list at full
    # speed (`SEC-3`).
    if not limiter.check(key) or not _client_limiter(request, settings).check(client_key(client)):
        raise InvalidRequestError(
            "Too many sign-in attempts. Wait a minute and try again.",
            code="too_many_requests",
        )
    user = users.find_by_email(session, str(body.email))
    # Verified before the account is tested, and verified even when there is no account. The two
    # conditions are deliberately not short-circuited: `verify_password` is the expensive part of
    # this endpoint, so letting an unknown address skip it answers in microseconds where a real
    # one takes tens of milliseconds -- which is `_SAME_ANSWER` undone by the clock (`SEC-2`).
    correct = verify_password(user.password_hash if user is not None else None, body.password)
    if user is None or not correct or user.disabled_at is not None:
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
    _set_cookie(response, token, settings, request)
    return Me.model_validate(user)


@router.delete("/auth/session", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
def sign_out(
    caller: CurrentCaller,
    session: WriteSession,
    settings: InstanceSettings,
    response: Response,
    request: Request,
) -> None:
    sessions.revoke(session, caller.id, caller.session.id)
    # The same attributes it was set with: a browser matches a deletion on name, domain and path,
    # and will not let a plain-HTTP response clear a cookie marked `Secure`.
    response.delete_cookie(
        settings.session_cookie_name,
        path=_cookie_path(settings),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure_for(scheme_of(request)),
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
