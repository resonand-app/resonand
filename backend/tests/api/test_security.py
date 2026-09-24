"""🧪 What a password is stored under (``API-3``, ``INF-18``).

The suite hashes at argon2-cffi's cheapest parameters (the root ``conftest.py``), so nothing else in
it would notice production's being weakened. This is the one place that says what they are, and it
says it in numbers rather than by the profile's name, because a name is exactly what an upgrade of
the library can redefine.
"""

from __future__ import annotations

from argon2 import Type, extract_parameters
from resonand.api import security


def test_a_password_is_stored_under_argon2id_at_rfc_9106_strength() -> None:
    """Three passes over 64 MiB in four lanes: RFC 9106's second recommendation."""
    parameters = security.PASSWORD_PARAMETERS
    assert parameters.type is Type.ID
    assert parameters.time_cost == 3
    assert parameters.memory_cost == 64 * 1024
    assert parameters.parallelism == 4
    assert (parameters.salt_len, parameters.hash_len) == (16, 32)


def test_the_suite_hashes_at_test_strength() -> None:
    """The swap is what keeps the suite fast, so losing it is a failure rather than a slow run."""
    stored = security.hash_password("a-long-enough-password")
    assert extract_parameters(stored).time_cost == 1
    assert security.verify_password(stored, "a-long-enough-password")
