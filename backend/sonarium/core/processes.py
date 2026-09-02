"""Running external tools.

``ffmpeg`` and ``ffprobe`` are the only external processes the application starts. They are always
invoked as an argument list -- never through a shell -- with an explicit timeout, because an
hours-long file handed to a tool with no ceiling is how a job worker stops answering.
"""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from sonarium.core.errors import ToolError

DEFAULT_TIMEOUT = 60.0


@dataclass(frozen=True, slots=True)
class ToolResult:
    """What a finished tool left behind."""

    command: tuple[str, ...]
    returncode: int
    stdout: bytes
    stderr: bytes

    @property
    def text(self) -> str:
        """Standard output decoded for parsing."""
        return self.stdout.decode("utf-8", errors="replace")

    @property
    def error_text(self) -> str:
        """Standard error decoded for a message the user will actually read."""
        return self.stderr.decode("utf-8", errors="replace")


def tool_path(name: str) -> Path:
    """Locate a tool on ``PATH``, failing with a message that says what to install."""
    found = shutil.which(name)
    if found is None:
        raise ToolError(f"{name} is not installed or not on PATH")
    return Path(found)


def run_tool(
    command: Sequence[str],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    stdin_bytes: bytes | None = None,
    check: bool = True,
) -> ToolResult:
    """Run a tool to completion and capture both streams as bytes.

    ``check`` raises :class:`ToolError` on a non-zero exit, carrying the tail of standard error --
    which for ffmpeg is the only part that ever says what was actually wrong.
    """
    if not command:
        raise ToolError("no command given")
    resolved = (str(tool_path(command[0])), *command[1:])
    try:
        completed = subprocess.run(  # noqa: S603 -- fixed argument list, never a shell
            resolved,
            input=stdin_bytes,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:  # pragma: no cover -- tool_path already covers this
        raise ToolError(f"{command[0]} is not installed or not on PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise ToolError(f"{command[0]} timed out after {timeout:.0f}s") from exc

    result = ToolResult(
        command=tuple(resolved),
        returncode=completed.returncode,
        stdout=completed.stdout or b"",
        stderr=completed.stderr or b"",
    )
    if check and result.returncode != 0:
        tail = "\n".join(result.error_text.strip().splitlines()[-6:])
        raise ToolError(f"{command[0]} exited {result.returncode}: {tail}")
    return result
