"""The ``sonarium`` command.

Three of these carry principles rather than convenience. ``import`` and ``export`` are principle 1
-- one command in, one command out, in a format that needs no software. ``fsck`` is principle 5:
an archive that cannot prove nothing has gone missing is not an archive.

Everything here runs as whoever administers the instance, over their own database file, so none
of it goes through the ACL. The ACL protects accounts from each other; the person holding the
database is not one of the accounts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from sonarium import __version__
from sonarium.archive import apply_sidecar, export_recording, find_by_uuid, read_sidecar
from sonarium.cli import integrity
from sonarium.cli.backup import backup_database, storage_note, verify_backup
from sonarium.core.config import Settings, get_settings
from sonarium.core.errors import SonariumError
from sonarium.core.formats import is_accepted
from sonarium.db import search_index, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database, build_engine
from sonarium.db.migrate import upgrade_to_head
from sonarium.db.models import Audio, Library
from sonarium.jobs.handlers import Context
from sonarium.jobs.queue import enqueue
from sonarium.jobs.worker import Worker, drain
from sonarium.media import storage
from sonarium.transcription.registry import build_provider

app = typer.Typer(
    name="sonarium",
    help="A self-hosted archive for the recordings that matter.",
    no_args_is_help=True,
    add_completion=False,
)


@app.callback()
def main() -> None:
    """Keeps every command explicitly named, so ``sonarium import`` never becomes the default."""


@app.command()
def version() -> None:
    """Print the version and exit."""
    typer.echo(f"sonarium {__version__}")


@app.command("import")
def import_files(
    source: Annotated[Path, typer.Argument(help="A file or a directory to take recordings from.")],
    library: Annotated[str, typer.Option(help="The uuid of the library to import into.")],
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Say what would happen.")] = False,
    transcribe: Annotated[bool, typer.Option(help="Queue transcription for each one.")] = False,
) -> None:
    """Import recordings, recursively, into one library.

    **Re-import is idempotent.** A file next to a Sonarium sidecar carrying a ``uuid`` that is
    already here updates that recording rather than creating a second copy -- which is what makes
    the export round trip verify the archive instead of doubling it.
    """
    settings = _settings()
    database = _database(settings)
    candidates = _candidates(source)
    if not candidates:
        typer.echo(f"Nothing to import from {source}.")
        return

    added = updated = 0
    for path in candidates:
        sidecar = _sidecar_beside(path)
        if dry_run:
            action = "update" if _would_update(database, sidecar) else "add"
            typer.echo(f"would {action}: {path.name}")
            continue
        try:
            if _import_one(database, settings, path, library, sidecar, transcribe=transcribe):
                updated += 1
            else:
                added += 1
        except SonariumError as error:
            typer.echo(f"skipped {path.name}: {error.detail}", err=True)

    if not dry_run:
        typer.echo(f"Imported {added} recordings, updated {updated}.")


@app.command()
def export(
    destination: Annotated[Path, typer.Argument(help="Where to write the export.")],
    library: Annotated[str | None, typer.Option(help="Only this library's uuid.")] = None,
    metadata_only: Annotated[
        bool, typer.Option("--metadata-only", help="Skip copying the audio.")
    ] = False,
) -> None:
    """Export the archive: the originals, a JSON sidecar each, and derived .vtt and .srt.

    The sidecar carries the recording's ``uuid``, so what this writes can be read back into an
    empty instance and produce the same archive rather than a second copy of it.
    """
    settings = _settings()
    database = _database(settings)
    written = 0
    with database.read_session() as session:
        query = session.query(Audio).filter(Audio.deleted_at.is_(None))
        if library:
            found = session.query(Library).filter(Library.uuid == library).one_or_none()
            if found is None:
                typer.echo(f"There is no library with uuid {library}.", err=True)
                raise typer.Exit(code=2)
            query = query.filter(Audio.library_id == found.id)
        for audio in query.order_by(Audio.id):
            export_recording(
                session,
                audio,
                destination,
                settings.resolved_storage_dir,
                copy_audio=not metadata_only,
            )
            written += 1
    typer.echo(f"Exported {written} recordings to {destination}.")


@app.command()
def fsck(
    fast: Annotated[
        bool, typer.Option("--fast", help="Check that files exist without re-hashing them.")
    ] = False,
    as_json: Annotated[bool, typer.Option("--json", help="Machine-readable output.")] = False,
) -> None:
    """Check that every recording's file is present and unchanged.

    Read-only, and it exits non-zero on any finding so that a cron job or a CI step can notice.
    Repairing is deliberately a separate command: a tool that fixes things while it is looking at
    them is one nobody dares run on a Sunday.
    """
    settings = _settings()
    database = _database(settings)
    with database.read_session() as session:
        report = integrity.check(session, settings.resolved_storage_dir, verify_hashes=not fast)
    if as_json:
        typer.echo(
            json.dumps(
                {
                    "checked": report.checked,
                    "clean": report.is_clean,
                    "findings": [
                        {"kind": f.kind, "detail": f.detail, "uuid": f.uuid}
                        for f in report.findings
                    ],
                },
                indent=2,
            )
        )
    else:
        for finding in report.findings:
            typer.echo(f"{finding.kind}: {finding.detail}", err=True)
        typer.echo(report.summary())
    if not report.is_clean:
        raise typer.Exit(code=1)


@app.command()
def reindex() -> None:
    """Rebuild both search indexes from the recordings themselves."""
    settings = _settings()
    database = _database(settings)
    with database.write_session() as session:
        covered = search_index.rebuild_all(session)
    typer.echo(f"Reindexed {covered} recordings.")


@app.command()
def work(
    once: Annotated[bool, typer.Option("--once", help="Drain the queue and stop.")] = False,
) -> None:
    """Run the job worker.

    The container runs one inside the API process; this is for running it apart, which is the
    seam that lets the worker move to its own container later without a schema change.
    """
    settings = _settings()
    database = _database(settings)
    provider = None
    if settings.transcription_base_url:
        provider = build_provider(settings)
    worker = Worker(
        Context(database=database, settings=settings, provider=provider),
        concurrency=settings.job_concurrency,
    )
    if once:
        typer.echo(f"Ran {drain(worker)} jobs.")
        return
    worker.start()
    typer.echo("Working. Press Ctrl-C to stop.")
    try:
        while True:  # pragma: no cover -- the long-running path
            worker._stopping.wait(3600)
    except KeyboardInterrupt:  # pragma: no cover
        worker.stop()


@app.command("create-admin")
def create_admin(
    email: Annotated[str, typer.Option(help="The account's address.")],
    display_name: Annotated[str, typer.Option(help="The name shown in the interface.")],
    password: Annotated[str, typer.Option(prompt=True, hide_input=True)],
) -> None:
    """Create an administrator from the command line.

    The web interface offers this too, on first run. This exists for the case the first run does
    not cover: an instance whose only administrator has been locked out.
    """
    from sonarium.api.security import hash_password  # noqa: PLC0415 -- CLI-only dependency

    settings = _settings()
    database = _database(settings)
    with database.write_session() as session:
        user = users.create_user(
            session,
            email=email,
            display_name=display_name,
            password_hash=hash_password(password),
            is_admin=True,
        )
    typer.echo(f"Created administrator {user.email} (#{user.id}).")


@app.command()
def backup(
    destination: Annotated[Path, typer.Argument(help="Where to write the database copy.")],
    verify: Annotated[bool, typer.Option(help="Open the copy and check it.")] = True,
) -> None:
    """Take a consistent copy of the database without stopping the service.

    Uses VACUUM INTO. Copying a SQLite file in WAL mode with cp is a way to get a torn
    database, because the file and its write-ahead log are two things caught at two moments.
    """
    settings = _settings()
    result = backup_database(settings, destination)
    typer.echo(f"Wrote {result.path} ({result.size_bytes / 1_000_000:.1f} MB).")
    if verify:
        typer.echo(f"Verified: {verify_backup(result.path)} recordings in the copy.")
    typer.echo(storage_note(settings))


@app.command("verify-backup")
def verify_backup_command(
    path: Annotated[Path, typer.Argument(help="The backup to open.")],
) -> None:
    """Open a backup and check it.

    A backup nobody has opened is a file, not a backup.
    """
    typer.echo(f"{path.name}: {verify_backup(path)} recordings, integrity check passed.")


@app.command()
def migrate() -> None:
    """Bring the database up to the latest revision."""
    settings = _settings()
    settings.prepare_directories()
    upgrade_to_head(build_engine(settings))
    typer.echo("The database is at the latest revision.")


# --- Plumbing -------------------------------------------------------------


def _settings() -> Settings:
    settings = get_settings()
    settings.prepare_directories()
    return settings


def _database(settings: Settings) -> Database:
    return Database(build_engine(settings))


def _candidates(source: Path) -> list[Path]:
    """Every accepted file under a path, in a stable order."""
    if source.is_file():
        return [source] if is_accepted(source.name) else []
    return sorted(path for path in source.rglob("*") if path.is_file() and is_accepted(path.name))


def _sidecar_beside(path: Path) -> Path | None:
    """The sidecar an export wrote next to this file, if there is one."""
    for candidate in (
        path.with_suffix(".sonarium.json"),
        path.parent / f"{path.stem}.sonarium.json",
    ):
        if candidate.exists():
            return candidate
    return None


def _would_update(database: Database, sidecar: Path | None) -> bool:
    if sidecar is None:
        return False
    try:
        payload = read_sidecar(sidecar)
    except (ValueError, OSError):
        return False
    with database.read_session() as session:
        return find_by_uuid(session, str(payload.get("uuid", ""))) is not None


def _import_one(
    database: Database,
    settings: Settings,
    path: Path,
    library_uuid: str,
    sidecar: Path | None,
    *,
    transcribe: bool,
) -> bool:
    """Import one file. Returns whether it updated a recording that was already here."""
    payload = None
    if sidecar is not None:
        try:
            payload = read_sidecar(sidecar)
        except (ValueError, OSError) as error:
            typer.echo(f"ignoring {sidecar.name}: {error}", err=True)

    with database.write_session() as session:
        if payload is not None:
            existing = find_by_uuid(session, str(payload.get("uuid", "")))
            if existing is not None:
                apply_sidecar(session, existing, payload)
                return True

        library = session.query(Library).filter(Library.uuid == library_uuid).one_or_none()
        if library is None:
            raise SonariumError(f"There is no library with uuid {library_uuid}.")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=library.owner_id,
            storage_path="",
            original_filename=path.name,
        )
        if payload is not None and payload.get("uuid"):
            audio.uuid = str(payload["uuid"])
            session.flush()
        stored, digest = storage.store_original(
            settings.resolved_storage_dir,
            audio.uuid,
            _chunks(path),
            filename=path.name,
        )
        audio.storage_path = storage.relative(settings.resolved_storage_dir, stored)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        session.flush()
        if payload is not None:
            apply_sidecar(session, audio, payload)
        else:
            search_index.index_audio(session, audio.id)
        enqueue(session, "probe", audio_id=audio.id, idempotency_key=f"probe:{audio.uuid}")
        if transcribe:
            enqueue(
                session,
                "transcribe",
                audio_id=audio.id,
                idempotency_key=f"transcribe:{audio.uuid}",
            )
    return False


def _chunks(path: Path, size: int = 1024 * 1024) -> list[bytes]:
    """Read a file in blocks. A list rather than a generator so the caller can retry it."""
    blocks: list[bytes] = []
    with path.open("rb") as handle:
        while True:
            block = handle.read(size)
            if not block:
                return blocks
            blocks.append(block)


if __name__ == "__main__":  # pragma: no cover
    app()
