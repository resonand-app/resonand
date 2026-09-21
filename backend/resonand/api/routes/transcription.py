"""Where audio goes, for everybody rather than for administrators (``API-12``, ``UI-25``).

One endpoint, and it exists because of who can read it. ``GET /admin/transcription`` already
reports the provider, but it is administrator-only, so on an instance shared by a family the
people whose recordings are being sent somewhere are precisely the ones who could not find out.

**This is principle 2's only implementation.** *Nothing leaves the instance without saying so
first* is otherwise a promise in a document; the disclosure ``UI-25`` draws before every
transcription request is what makes it a property of the software, and it cannot be drawn from an
endpoint most callers get a 403 from.

It reports the narrowest thing that answers the question and reaches out to nothing: a connection
test would itself be a smaller version of the egress this exists to disclose.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from resonand.api.deps import InstanceSettings, current_caller
from resonand.api.schemas import TranscriptionDestination
from resonand.transcription import destination

router = APIRouter(prefix="/transcription", tags=["transcription"])


@router.get(
    "/destination",
    response_model=TranscriptionDestination,
    summary="Where audio is sent to be transcribed",
    dependencies=[Depends(current_caller)],
)
def transcription_destination(settings: InstanceSettings) -> TranscriptionDestination:
    """The provider, its host, and whether it is on this network.

    Any authenticated caller, deliberately: the answer is about their own recordings.
    """
    base_url = settings.transcription_base_url
    return TranscriptionDestination(
        provider=settings.transcription_provider,
        host=destination.destination_host(base_url),
        is_local=destination.is_local(base_url),
        configured=bool(base_url),
    )
