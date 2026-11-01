"""The trash as a whole: what it holds, and destroying much of it in one call (``API-28``).

**Everything here destroys, or says what destroying would cost**, and lives in the trash namespace
for the reason the single purges beside ``/trash/audio`` give: the irreversible call is never a
flag on a reversible one. Restoring stays one call per item (``INT-1c``).

What a caller's trash is, and how a selection or an instant narrows it, is described once, in
:mod:`resonand.db.trash`, at manage through :mod:`resonand.acl.query`.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import AfterValidator, AwareDatetime

from resonand.api.deps import ArchiveDatabase, CurrentCaller, InstanceSettings, ReadSession
from resonand.api.schemas import PurgeResult, PurgeSelection, TrashSummary, TrashTally
from resonand.core.time import is_instant, now_instant, to_instant
from resonand.db import trash as trash_repo
from resonand.media import storage

router = APIRouter(prefix="/trash", tags=["trash"])


def _storable(moment: datetime) -> datetime:
    """Refuse an instant that does not compare as one against a stored ``deleted_at``.

    Instants are compared as text, and a year below 1000 is written unpadded and sorts after every
    real one, which would turn a bounded empty into an unbounded one.
    """
    try:
        written = to_instant(moment)
    except OverflowError:
        written = ""
    if not is_instant(written):
        raise ValueError("Give the instant the summary was counted at.")
    return moment


TrashedBefore = Annotated[
    AwareDatetime,
    AfterValidator(_storable),
    Query(description="The `counted_at` of the summary somebody agreed to. Required."),
]


@router.get("/summary", response_model=TrashSummary)
def summary(caller: CurrentCaller, session: ReadSession) -> TrashSummary:
    """What emptying the trash would destroy, counted now.

    The interface cannot add this up itself, because the trash it lists is paged.
    """
    counted_at = now_instant()
    tally = trash_repo.summarise(session, caller.id, counted_at)
    return TrashSummary(**_tally(tally).model_dump(), counted_at=counted_at)


@router.post("/purge", response_model=PurgeResult)
def purge(
    body: PurgeSelection,
    caller: CurrentCaller,
    database: ArchiveDatabase,
    settings: InstanceSettings,
) -> PurgeResult:
    """Destroy a selection of the trash, and report every uuid that was not destroyed.

    Its transaction is its own, and the files go after the commit, for the reason
    ``DELETE /trash/audio/{audio_uuid}`` gives (``REV-1``).
    """
    with database.write_session() as session:
        purged = trash_repo.purge_selection(
            session,
            caller.id,
            library_uuids=body.library_uuids,
            audio_uuids=body.audio_uuids,
        )
    _remove_files(settings.resolved_storage_dir, purged.audio_uuids)
    return PurgeResult(destroyed=_tally(purged.tally), skipped=purged.skipped)


@router.delete("", response_model=TrashTally)
def empty(
    trashed_before: TrashedBefore,
    caller: CurrentCaller,
    database: ArchiveDatabase,
    settings: InstanceSettings,
) -> TrashTally:
    """Empty the trash of everything sent to it up to ``trashed_before``, and nothing after.

    The instant is required rather than defaulting to now: what was trashed after somebody read
    the numbers is not what they agreed to destroy, and is left where it is.
    """
    with database.write_session() as session:
        purged = trash_repo.empty(session, caller.id, to_instant(trashed_before))
    _remove_files(settings.resolved_storage_dir, purged.audio_uuids)
    return _tally(purged.tally)


def _tally(tally: trash_repo.Tally) -> TrashTally:
    return TrashTally(
        recordings=tally.recordings,
        libraries=tally.libraries,
        duration_ms=tally.duration_ms,
        transcripts=tally.transcripts,
    )


def _remove_files(storage_dir: Path, audio_uuids: list[str]) -> None:
    for audio_uuid in audio_uuids:
        storage.delete_recording(storage_dir, audio_uuid)
