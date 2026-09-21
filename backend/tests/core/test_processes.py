"""Every external tool runs as an argument list, with a ceiling (``core.processes``)."""

from __future__ import annotations

import pytest
from resonand.core.errors import ToolError
from resonand.core.processes import run_tool, tool_path


def test_a_tool_that_is_not_installed_says_so() -> None:
    with pytest.raises(ToolError, match="not on PATH"):
        tool_path("resonand-no-such-tool")


def test_output_comes_back_as_bytes_and_as_text() -> None:
    result = run_tool(["echo", "grandmother"])
    assert result.stdout == b"grandmother\n"
    assert result.text.strip() == "grandmother"


def test_a_failing_tool_carries_the_tail_of_its_stderr() -> None:
    with pytest.raises(ToolError, match="exited 1"):
        run_tool(["sh", "-c", "echo something broke >&2; exit 1"])


def test_a_failing_tool_can_be_inspected_instead_of_raising() -> None:
    result = run_tool(["sh", "-c", "exit 3"], check=False)
    assert result.returncode == 3


def test_a_tool_with_no_ceiling_is_not_an_option() -> None:
    with pytest.raises(ToolError, match="timed out"):
        run_tool(["sleep", "5"], timeout=0.2)


def test_an_empty_command_is_refused() -> None:
    with pytest.raises(ToolError, match="no command"):
        run_tool([])
