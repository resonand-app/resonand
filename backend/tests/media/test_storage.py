"""The original is written once and never rewritten (``ING-1``, principle 1)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from resonand.core.errors import ConflictError, InvalidRequestError, NotFoundError
from resonand.core.ids import new_uuid
from resonand.media import storage

UUID = "abcdef01-2345-4678-8abc-def012345678"


def test_a_recording_is_sharded_so_no_directory_ever_holds_ten_thousand(tmp_path: Path) -> None:
    path = storage.original_path(tmp_path, UUID, ".m4a")
    assert path.relative_to(tmp_path).as_posix() == f"ab/{UUID}/original.m4a"


def test_the_derivative_sits_next_to_the_original(tmp_path: Path) -> None:
    assert storage.derived_path(tmp_path, UUID).parent == storage.recording_dir(tmp_path, UUID)


def test_an_original_cannot_be_overwritten(tmp_path: Path) -> None:
    """There is no legitimate path that writes an original twice."""
    storage.store_original(tmp_path, UUID, [b"first"], filename="note.m4a")
    with pytest.raises(ConflictError):
        storage.store_original(tmp_path, UUID, [b"second"], filename="note.m4a")


def test_the_stored_bytes_are_the_bytes_that_arrived(tmp_path: Path) -> None:
    path, digest = storage.store_original(tmp_path, UUID, [b"one", b"two"], filename="n.m4a")
    assert path.read_bytes() == b"onetwo"
    assert digest.size_bytes == 6


def test_a_crash_mid_write_leaves_no_file_that_looks_complete(tmp_path: Path) -> None:
    """A half file under the final name would pass every later check that only looks for one."""
    destination = tmp_path / "ab" / UUID / "original.m4a"

    def failing() -> Iterator[bytes]:
        yield b"the first part"
        raise OSError("the disk went away")

    with pytest.raises(OSError, match="disk went away"):
        storage.atomic_write(destination, failing())
    assert not destination.exists()
    assert list(destination.parent.glob("*")) == []


def test_a_format_the_archive_does_not_ingest_is_refused(tmp_path: Path) -> None:
    with pytest.raises(InvalidRequestError, match="not a format"):
        storage.store_original(tmp_path, UUID, [b"x"], filename="notes.pdf")


def test_a_video_container_is_accepted(tmp_path: Path) -> None:
    """The file with your grandmother in it is quite often the mp4."""
    path, _ = storage.store_original(tmp_path, UUID, [b"x"], filename="grandmother.mp4")
    assert path.name == "original.mp4"


def test_the_stored_path_is_relative_so_the_archive_can_be_moved(tmp_path: Path) -> None:
    """An absolute path would tie the archive to one machine's directory layout."""
    path, _ = storage.store_original(tmp_path, UUID, [b"x"], filename="n.m4a")
    stored = storage.relative(tmp_path, path)
    assert not stored.startswith("/")
    assert storage.resolve(tmp_path, stored) == path


def test_a_stored_path_that_escapes_the_archive_is_refused(tmp_path: Path) -> None:
    """Defence against a corrupted or hand-edited row, which on a delete is somebody else's file."""
    with pytest.raises(InvalidRequestError, match="outside the archive"):
        storage.resolve(tmp_path, "../../etc/passwd")


def test_the_derivative_may_be_replaced_because_it_is_derived(tmp_path: Path) -> None:
    storage.replace_derived(tmp_path, UUID, [b"first"])
    storage.replace_derived(tmp_path, UUID, [b"second"])
    assert storage.derived_path(tmp_path, UUID).read_bytes() == b"second"


def test_deleting_a_recording_takes_its_directory_with_it(tmp_path: Path) -> None:
    storage.store_original(tmp_path, UUID, [b"x"], filename="n.m4a")
    storage.replace_derived(tmp_path, UUID, [b"y"])
    assert storage.delete_recording(tmp_path, UUID) == 2
    assert not storage.recording_dir(tmp_path, UUID).exists()
    assert not (tmp_path / "ab").exists(), "the empty shard goes too"


def test_deleting_something_that_is_not_there_is_not_an_error(tmp_path: Path) -> None:
    assert storage.delete_recording(tmp_path, UUID) == 0


def test_the_original_is_found_whatever_extension_it_has(tmp_path: Path) -> None:
    storage.store_original(tmp_path, UUID, [b"x"], filename="note.flac")
    assert storage.find_original(tmp_path, UUID).name == "original.flac"


def test_a_missing_original_says_so(tmp_path: Path) -> None:
    with pytest.raises(NotFoundError, match="missing"):
        storage.find_original(tmp_path, UUID)


def test_every_original_can_be_walked_for_the_integrity_check(tmp_path: Path) -> None:
    made = {new_uuid() for _ in range(3)}
    for uuid in made:
        storage.store_original(tmp_path, uuid, [b"x"], filename="n.m4a")
    assert len(storage.stored_files(tmp_path)) == 3


def test_something_that_is_not_an_identifier_is_refused(tmp_path: Path) -> None:
    with pytest.raises(InvalidRequestError, match="not a recording identifier"):
        storage.recording_dir(tmp_path, "../escape")
