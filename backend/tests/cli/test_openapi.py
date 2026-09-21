"""The committed API document (``UI-3a``).

The interface generates its typed client from a snapshot in the repository rather than from a
running instance, so the snapshot has to be two things: reproducible, and checkable. These tests
hold both -- the document does not describe the machine that wrote it, and a stale file fails
rather than being quietly regenerated.
"""

from __future__ import annotations

import json
from pathlib import Path

from resonand.cli.main import SNAPSHOT, app
from typer.testing import CliRunner

runner = CliRunner()


def test_the_document_describes_the_api_and_nothing_but(tmp_path: Path) -> None:
    """Every path under ``/api`` (``API-16``), and no route that depends on the filesystem."""
    written = tmp_path / "openapi.json"
    result = runner.invoke(app, ["openapi", "--output", str(written)])
    assert result.exit_code == 0, result.output
    document = json.loads(written.read_text(encoding="utf-8"))
    outside = [path for path in document["paths"] if not path.startswith("/api/")]
    assert not outside, f"these are published but are not the API: {outside}"
    assert len(document["paths"]) > 40


def test_the_document_names_no_server(tmp_path: Path) -> None:
    """A snapshot carrying whoever generated it's subpath makes every generated URL wrong."""
    written = tmp_path / "openapi.json"
    runner.invoke(app, ["openapi", "--output", str(written)])
    assert "servers" not in json.loads(written.read_text(encoding="utf-8"))


def test_writing_it_twice_writes_the_same_bytes(tmp_path: Path) -> None:
    """Otherwise the check below is a coin toss and the diff is noise."""
    first, second = tmp_path / "one.json", tmp_path / "two.json"
    runner.invoke(app, ["openapi", "--output", str(first)])
    runner.invoke(app, ["openapi", "--output", str(second)])
    assert first.read_bytes() == second.read_bytes()


def test_the_committed_snapshot_is_current() -> None:
    """What CI runs. A backend change that alters the API fails here rather than in the browser."""
    result = runner.invoke(app, ["openapi", "--check"])
    assert result.exit_code == 0, result.output


def test_a_stale_snapshot_fails_the_check(tmp_path: Path) -> None:
    stale = tmp_path / "openapi.json"
    stale.write_text('{"openapi": "3.1.0"}\n', encoding="utf-8")
    result = runner.invoke(app, ["openapi", "--check", "--output", str(stale)])
    assert result.exit_code == 1
    assert "resonand openapi" in result.output


def test_a_missing_snapshot_fails_the_check_rather_than_writing_one(tmp_path: Path) -> None:
    absent = tmp_path / "nowhere" / "openapi.json"
    result = runner.invoke(app, ["openapi", "--check", "--output", str(absent)])
    assert result.exit_code == 1
    assert not absent.exists()


def test_the_snapshot_lives_where_the_interface_reads_it() -> None:
    """The default is derived from this file's location, so it is worth asserting it lands."""
    assert SNAPSHOT.is_file()
    assert SNAPSHOT.parts[-5:] == ("frontend", "src", "api", "contract", "openapi.json")
