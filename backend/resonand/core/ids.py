"""Public identifiers.

Every resource the API or a URL names is addressed by ``uuid``; the integer primary key stays
inside the process (``DEC-14``). Sequential ids in a URL are enumerable, and an archive shared
between accounts is exactly where that matters.
"""

from __future__ import annotations

import uuid

UUID_WIDTH = 36


def new_uuid() -> str:
    """A fresh public identifier."""
    return str(uuid.uuid4())


def is_uuid(value: str) -> bool:
    """Whether a string is a well-formed uuid, without caring which version it is."""
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True
