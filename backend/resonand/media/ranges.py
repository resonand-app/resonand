"""HTTP ``Range`` requests (``ING-7``).

Seeking has to work for real, and seeking is entirely a ``Range`` conversation: the browser asks
for the bytes around where you dragged the playhead to, and if the answer is a 200 with the whole
file, the player silently downloads two hours of audio to play thirty seconds in the middle.

Parsing is deliberately strict about what it accepts and forgiving about what it does with it. An
unsatisfiable range gets 416 with the length, which is what tells a player it guessed past the
end; a malformed header is ignored entirely and the whole file is served, because a header this
application does not understand is not a reason to refuse somebody their recording.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CHUNK_BYTES = 256 * 1024
"""How much is read per iteration while streaming. Large enough not to syscall per packet, small
enough that a cancelled request stops promptly."""

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")


@dataclass(frozen=True, slots=True)
class ByteRange:
    """A resolved span of a file, inclusive at both ends as HTTP defines it."""

    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start + 1

    def content_range(self, size: int) -> str:
        """The ``Content-Range`` header for this span of a file of ``size`` bytes."""
        return f"bytes {self.start}-{self.end}/{size}"


def parse_range(header: str | None, size: int) -> ByteRange | None:
    """Resolve a ``Range`` header against a known file size.

    Returns ``None`` when there is no range to honour -- either the header is absent or it is
    something this code does not understand -- and raises
    :class:`UnsatisfiableRangeError` when the header is well formed but asks for bytes that
    are not there.

    Only a single range is honoured. Multipart ranges are legal HTTP and no audio element has
    ever sent one; supporting them would be code with no caller, which is code that is wrong by
    the time it has one.
    """
    if not header or size <= 0:
        return None
    match = _RANGE.match(header.strip())
    if match is None:
        return None
    first, last = match.group(1), match.group(2)
    if not first and not last:
        return None
    if not first:
        # bytes=-500: the final 500 bytes. A player does this to read a trailing index.
        length = int(last)
        if length <= 0:
            raise UnsatisfiableRangeError(size)
        return ByteRange(start=max(0, size - length), end=size - 1)
    start = int(first)
    if start >= size:
        raise UnsatisfiableRangeError(size)
    end = size - 1 if not last else min(int(last), size - 1)
    if end < start:
        raise UnsatisfiableRangeError(size)
    return ByteRange(start=start, end=end)


class UnsatisfiableRangeError(Exception):
    """The range is well-formed and asks for bytes that do not exist.

    Carries the size, because a 416 without ``Content-Range: bytes */size`` leaves the player
    with no way to correct itself.
    """

    def __init__(self, size: int) -> None:
        super().__init__(f"range beyond the end of a {size}-byte file")
        self.size = size
