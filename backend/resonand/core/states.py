"""The four transcription states (``JOB-11``, ``UI-8c``).

**They are not a column.** A recording's state is derived from what transcripts and jobs exist
for it, and the order of the questions is what makes the answer well defined:

1. an active transcript means ``done``, whatever else happened on the way there -- re-transcribing
   after a failure leaves the failure in the job table, and a recording that has a transcript is
   not in a failed state;
2. otherwise a ``transcribe`` job pending or running means ``running``, pending included, because
   a job waiting on its backoff is one that is going to run;
3. otherwise a failed one means ``failed``;
4. otherwise ``none``.

They live here rather than beside either of the two places that answer the question, because
there are two: :func:`resonand.api.presenters.transcription_state` answers it for one recording
and :func:`resonand.db.search.apply_filters` answers it in SQL for a whole query. If those two
ever disagree, the badge on a card and the toggle that was supposed to select it say different
things about the same recording.
"""

from __future__ import annotations

from enum import StrEnum


class TranscriptionState(StrEnum):
    """What the badge says, and what the filter selects."""

    NONE = "none"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
