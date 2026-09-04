"""The seven library colours (``DEC-8``).

A library is identified in the sidebar, on its card and in the create dialog by a colour, and
**the user picks it**. It carries no meaning: it is not derived from the name, not derived from the
audio, and it never encodes state. Two libraries may share one.

The set is closed and lives here rather than in the interface for the same reason the permission
level wording does -- the design system defines exactly these seven as tokens
(``--library-amber`` .. ``--library-teal``, each with a light-mode pair), and a colour that is not
one of them would put a value outside the token system into the interface, which is the one thing
the system forbids. The schema enforces the set with a ``CHECK``; this is the same list, and a test
asserts the two agree.
"""

from __future__ import annotations

from enum import StrEnum


class Colour(StrEnum):
    """A library's identifying colour, chosen by whoever created it."""

    AMBER = "amber"
    CLAY = "clay"
    SLATE = "slate"
    MOSS = "moss"
    STONE = "stone"
    PLUM = "plum"
    TEAL = "teal"


DEFAULT = Colour.STONE
"""What a library gets when nobody chose. The most neutral of the seven, so an unchosen colour
reads as *not yet chosen* rather than as a decision."""
