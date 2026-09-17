"""🧪 What the sign-in counters are keyed on (``SEC-3``).

``test_grinding_through_a_password_list_is_slowed_down`` in ``test_auth`` covers the thing the
limiter was built for. These cover the two things keying it on the address alone got wrong, and
both are the kind of bug that passes every test you would think to write about throttling:

* it **locked the wrong person out** -- an address's budget was spendable from anywhere, so
  knowing somebody's address was enough to keep them out of their own account;
* it **throttled nothing** -- sixty addresses tried from one client touched sixty untouched
  counters.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.rate_limit import SWEEP_AT_KEYS, AttemptLimiter
from sonarium.core.config import Settings
from sonarium.db.engine import Database

from tests.api.conftest import API_BASE, PASSWORD

CLIENT_CEILING = 6
"""Low enough that the test does not pay for sixty Argon2 verifications to prove a point."""


@pytest.fixture
def throttled_settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        log_format="console",
        login_attempts_per_minute=3,
        login_attempts_per_client_per_minute=CLIENT_CEILING,
    )


@pytest.fixture
def throttled_app(throttled_settings: Settings, database: Database) -> FastAPI:
    app = create_app(throttled_settings)
    app.state.database = database
    return app


def _browser(app: FastAPI, host: str) -> Iterator[TestClient]:
    with TestClient(
        app, base_url=API_BASE, raise_server_exceptions=False, client=(host, 40000)
    ) as client:
        yield client


@pytest.fixture
def attacker(throttled_app: FastAPI) -> Iterator[TestClient]:
    yield from _browser(throttled_app, "198.51.100.7")


@pytest.fixture
def owner(throttled_app: FastAPI) -> Iterator[TestClient]:
    yield from _browser(throttled_app, "203.0.113.4")


def test_somebody_elses_failures_cannot_keep_you_out_of_your_own_account(
    attacker: TestClient, owner: TestClient, throttled_settings: Settings, accounts: dict[str, int]
) -> None:
    """The half of ``SEC-3`` that was a denial of service rather than a protection.

    Anybody who knew an address could spend its whole budget from anywhere, and the owner -- with
    the right password, from their own machine -- was told to wait a minute. Indefinitely, for as
    long as the attacker cared to keep going.
    """
    del accounts
    for _ in range(throttled_settings.login_attempts_per_minute + 2):
        attacker.post("/auth/session", json={"email": "admin@example.test", "password": "no"})

    assert (
        attacker.post(
            "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
        ).json()["type"]
        == "/errors/too_many_requests"
    )

    signed_in = owner.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert signed_in.status_code == status.HTTP_200_OK


def test_one_client_cannot_walk_an_address_list(
    attacker: TestClient, accounts: dict[str, int]
) -> None:
    """The other half: every attempt naming a fresh address found a fresh counter.

    Each of these would have passed under the old key, because no address is tried twice.
    """
    del accounts
    answers = [
        attacker.post(
            "/auth/session", json={"email": f"person{index}@example.test", "password": "guess"}
        )
        for index in range(CLIENT_CEILING + 2)
    ]

    assert answers[0].json()["type"] == "/errors/unauthenticated"
    assert answers[-1].json()["type"] == "/errors/too_many_requests"


def test_a_signed_in_account_is_not_still_being_counted(
    owner: TestClient, accounts: dict[str, int]
) -> None:
    """Getting it right after mistyping it clears the account's own counter, as it always did."""
    del accounts
    owner.post("/auth/session", json={"email": "admin@example.test", "password": "typo"})
    assert (
        owner.post(
            "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
        ).status_code
        == status.HTTP_200_OK
    )


def test_the_counter_does_not_grow_without_end() -> None:
    """A dictionary only ever added to is a leak anybody without a session can drive.

    The window is set to nothing so every entry is already expired, which is what a minute-old
    burst looks like by the time the next one arrives.
    """
    limiter = AttemptLimiter(per_window=1, window_seconds=0.0)
    for index in range(SWEEP_AT_KEYS * 2):
        limiter.check(f"address:{index}@example.test|198.51.100.7")

    assert limiter.tracked() <= SWEEP_AT_KEYS
