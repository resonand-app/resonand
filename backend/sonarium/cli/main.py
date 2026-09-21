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
from tempfile import TemporaryDirectory
from typing import Annotated

import typer
from pydantic import SecretStr
from sqlalchemy.orm import Session

from sonarium import __version__
from sonarium.api.app import create_app
from sonarium.archive import (
    MANIFEST_NAME,
    SIDECAR_NAME,
    SIDECAR_SUFFIX,
    apply_manifest,
    apply_sidecar,
    export_recording,
    find_by_uuid,
    library_named_by,
    manifest_for,
    read_manifest,
    read_sidecar,
)
from sonarium.cli import integrity
from sonarium.cli.backup import backup_database, storage_note, verify_backup
from sonarium.core.config import MINIMUM_SECRET_LENGTH, Settings, get_settings
from sonarium.core.errors import SonariumError
from sonarium.core.formats import is_accepted
from sonarium.db import search_index, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database, build_engine
from sonarium.db.migrate import upgrade_to_head
from sonarium.db.models import Audio, Library
from sonarium.jobs.handlers import Context
from sonarium.jobs.queue import enqueue, enqueue_transcription
from sonarium.jobs.worker import Worker, drain
from sonarium.media import storage
from sonarium.media.probe import probe as probe_media
from sonarium.transcription import preflight
from sonarium.transcription.registry import build_provider

SNAPSHOT = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "contract" / "openapi.json"
)
"""Where the interface keeps its copy of the document (``UI-3a``).

Derived from this file's own location so the command works from either half of the repository,
which is where it is run from. It is a default and not a constant: ``--output`` is how anybody
outside a working tree points it somewhere real.
"""

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


@app.command()
def openapi(
    output: Annotated[
        Path,
        typer.Option(help="Where to write the document."),
    ] = SNAPSHOT,
    check: Annotated[
        bool,
        typer.Option("--check", help="Do not write; fail if the file is not what this produces."),
    ] = False,
) -> None:
    """Write the published API document, which the interface generates its client from.

    ``UI-3a`` commits the snapshot rather than fetching it at build time, for the reason every
    generated file here is committed: a reviewer sees it change. This command is what refreshes
    it and, with ``--check``, what CI runs so a backend change that alters the API cannot land
    with a stale snapshot beside it -- which would otherwise be discovered as a runtime surprise
    in the interface rather than as a failing job.

    The document is written from settings of its own and not from the environment: an instance
    on a subpath publishes a ``servers`` entry, and a snapshot that carried one administrator's
    subpath would make every generated URL wrong for everybody else.
    """
    document = json.dumps(_published_document(), indent=2, sort_keys=True) + "\n"
    if check:
        current = output.read_text(encoding="utf-8") if output.is_file() else ""
        if current != document:
            typer.echo(
                f"{output} is not what the API publishes. Run `sonarium openapi` and commit it.",
                err=True,
            )
            raise typer.Exit(code=1)
        typer.echo(f"{output} matches the API.")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")
    typer.echo(f"Wrote {output}.")


@app.command("import")
def import_files(
    source: Annotated[Path, typer.Argument(help="A file or a directory to take recordings from.")],
    library: Annotated[
        str | None,
        typer.Option(help="The uuid of the library to import into, for anything that names none."),
    ] = None,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Say what would happen.")] = False,
    transcribe: Annotated[bool, typer.Option(help="Queue transcription for each one.")] = False,
) -> None:
    """Import recordings, recursively.

    **Re-import is idempotent.** A file next to a Sonarium sidecar carrying a ``uuid`` that is
    already here updates that recording rather than creating a second copy -- which is what makes
    the export round trip verify the archive instead of doubling it.

    An export carries an archive manifest, and reading it back recreates the libraries and the
    sharing they had -- against accounts that are already here. Accounts are never created from
    an export: create them first, and a library whose owner is missing is refused by name rather
    than handed to whoever ran the import. Everything else goes where ``--library`` says, which
    is also what an import of loose files with no sidecars needs.
    """
    settings = _settings()
    database = _database(settings)
    candidates = _candidates(source)
    if not candidates:
        typer.echo(f"Nothing to import from {source}.")
        return

    manifest = _manifest_from(source)
    resolved = {} if dry_run else _restore_instance(database, manifest)
    planned = _libraries_named_by(manifest)

    added = updated = 0
    for path in candidates:
        sidecar = _sidecar_beside(path)
        if dry_run:
            typer.echo(f"{_dry_run_verdict(database, sidecar, library, planned)}: {path.name}")
            continue
        try:
            if _import_one(
                database, settings, path, library, sidecar, resolved, transcribe=transcribe
            ):
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

    One directory per recording, named for its identifier, holding all four. Two recordings that
    were uploaded under the same filename therefore cannot overwrite each other in the export.

    An archive manifest at the root describes the instance itself -- the accounts, the libraries
    and who each was shared with -- so a round trip gives back the shape of the archive and not
    only its contents. It carries no credentials of any kind.

    The sidecar carries the recording's ``uuid``, so what this writes can be read back into an
    empty instance and produce the same archive rather than a second copy of it.
    """
    settings = _settings()
    database = _database(settings)
    written = 0
    with database.read_session() as session:
        query = session.query(Audio).filter(Audio.deleted_at.is_(None))
        trashed = session.query(Audio).filter(Audio.deleted_at.is_not(None))
        described = session.query(Library).filter(Library.deleted_at.is_(None))
        if library:
            found = session.query(Library).filter(Library.uuid == library).one_or_none()
            if found is None:
                typer.echo(f"There is no library with uuid {library}.", err=True)
                raise typer.Exit(code=2)
            query = query.filter(Audio.library_id == found.id)
            trashed = trashed.filter(Audio.library_id == found.id)
            described = described.filter(Library.id == found.id)
        for audio in query.order_by(Audio.id):
            export_recording(
                session,
                audio,
                destination,
                settings.resolved_storage_dir,
                copy_audio=not metadata_only,
            )
            written += 1
        manifest = manifest_for(
            session,
            list(described.order_by(Library.id)),
            recordings=written,
            skipped_in_trash=trashed.count(),
        )
    destination.mkdir(parents=True, exist_ok=True)
    (destination / MANIFEST_NAME).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
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


@app.command("check-transcription")
def check_transcription(
    audio: Annotated[
        Path | None,
        typer.Option("--audio", help="A real recording to ask about, instead of a generated tone."),
    ] = None,
) -> None:
    """Ask the configured engine what it can do, before any recording is sent to it (``TRX-1``).

    Three seconds of tone is generated and submitted, so this says nothing about anybody's audio
    and works on an instance with nothing in it yet. A tone has no speech in it, so an engine that
    answers correctly may still return no segments for it -- pass ``--audio`` with a real recording
    to see how coarse its segments are and whether it names speakers.
    """
    settings = _settings()
    if not settings.transcription_base_url:
        typer.echo("No transcription service is configured, so there is nothing to ask.")
        raise typer.Exit(code=1)
    provider = build_provider(settings)
    try:
        with TemporaryDirectory(prefix="sonarium-probe-") as workspace:
            if audio is None:
                sample = preflight.sample_audio(Path(workspace) / "sample.opus")
                duration_ms = int(preflight.SAMPLE_SECONDS * 1000)
            else:
                sample = audio
                duration_ms = probe_media(audio).duration_ms or 0
            report = preflight.probe(provider, audio=sample, duration_ms=duration_ms)
    finally:
        provider.close()

    typer.echo(f"{settings.transcription_provider} · {settings.transcription_model}")
    typer.echo(f"  {report.detail}")
    for finding in report.findings:
        mark = "?" if finding.ok is None else ("ok" if finding.ok else "no")
        typer.echo(f"  [{mark:>2}] {finding.question}: {finding.answer}")
    if not report.usable:
        raise typer.Exit(code=1)


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
        session.flush()
        library = users.personal_library(session, user.id)
        address, identifier, library_uuid = user.email, user.id, library.uuid
    typer.echo(f"Created administrator {address} (#{identifier}).")
    # The personal library comes with the account, and its uuid is what `sonarium import` takes.
    # Without this line the only way to learn it is to sign in and read it out of a URL.
    typer.echo(f"Personal library: {library_uuid}")


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


def _published_document() -> dict[str, object]:
    """The OpenAPI document, from an instance configured the way every instance is by default."""
    return create_app(_snapshot_settings()).openapi()


def _snapshot_settings() -> Settings:
    """Settings that describe no particular deployment.

    Explicit rather than ``get_settings()``: a ``SONARIUM_BASE_PATH`` in the shell that generated
    the snapshot would be published in it as a ``servers`` entry, and every client generated from
    it afterwards would prefix its calls with somebody else's subpath.
    """
    return Settings(secret_key=SecretStr("0" * MINIMUM_SECRET_LENGTH), base_path="")


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
    """The sidecar an export wrote for this file, if there is one.

    The directory's own ``sonarium.json`` is only taken when this is the one recording in it,
    which is the shape an export writes. A folder of loose files with a single sidecar dropped in
    would otherwise hand every one of them the same uuid, and the second file would update what
    the first had just created.
    """
    shared = path.parent / SIDECAR_NAME
    if shared.is_file() and _holds_one_recording(path.parent):
        return shared
    for candidate in (
        path.with_suffix(SIDECAR_SUFFIX),
        path.parent / f"{path.stem}{SIDECAR_SUFFIX}",
    ):
        if candidate.exists():
            return candidate
    return None


def _holds_one_recording(directory: Path) -> bool:
    found = 0
    for entry in directory.iterdir():
        if entry.is_file() and is_accepted(entry.name):
            found += 1
            if found > 1:
                return False
    return found == 1


def _read_sidecar_quietly(sidecar: Path | None) -> dict[str, object] | None:
    """The sidecar's contents, or nothing at all if it cannot be read as one."""
    if sidecar is None:
        return None
    try:
        return read_sidecar(sidecar)
    except (ValueError, OSError):
        return None


def _manifest_from(source: Path) -> dict[str, object] | None:
    """The archive manifest an export wrote at its root, if this is one."""
    root = source if source.is_dir() else source.parent
    path = root / MANIFEST_NAME
    if not path.is_file():
        return None
    try:
        return read_manifest(path)
    except (ValueError, OSError) as error:
        typer.echo(f"ignoring {path.name}: {error}", err=True)
        return None


def _restore_instance(database: Database, manifest: dict[str, object] | None) -> dict[str, int]:
    """Recreate the libraries and the sharing the export described, and say what it could not."""
    if manifest is None:
        return {}
    with database.write_session() as session:
        applied = apply_manifest(session, manifest)
    for address in applied.missing_accounts:
        typer.echo(
            f"no account here for {address}: create it and run this again to place its "
            "recordings and restore its sharing.",
            err=True,
        )
    for name in applied.refused_libraries:
        typer.echo(f"skipped library {name}: its owner has no account here.", err=True)
    if applied.libraries:
        typer.echo(f"Restored {len(applied.libraries)} libraries from {MANIFEST_NAME}.")
    return applied.libraries


def _libraries_named_by(manifest: dict[str, object] | None) -> dict[str, str]:
    """Library uuid to name, as the manifest has them, for a dry run that writes nothing."""
    described = (manifest or {}).get("libraries")
    if not isinstance(described, list):
        return {}
    return {
        str(one.get("uuid")): str(one.get("name"))
        for one in described
        if isinstance(one, dict) and one.get("uuid")
    }


def _dry_run_verdict(
    database: Database,
    sidecar: Path | None,
    library_uuid: str | None,
    planned: dict[str, str],
) -> str:
    """What ``--dry-run`` says about one file.

    It resolves the destination library rather than assuming one, because a dry run that reports
    "would add" for a file the real run will refuse is worse than no dry run. A library the
    manifest would create counts, even though a dry run has not created it.
    """
    payload = _read_sidecar_quietly(sidecar)
    with database.read_session() as session:
        if payload is not None and find_by_uuid(session, str(payload.get("uuid", ""))) is not None:
            return "would update"
        coming = planned.get(_library_uuid_in(payload))
        if coming is not None:
            return f"would add to {coming}"
        try:
            destination = _destination_library(session, payload, library_uuid, {})
        except SonariumError as error:
            return f"would skip ({error.detail})"
        return f"would add to {destination.name}"


def _library_uuid_in(payload: dict[str, object] | None) -> str:
    named = (payload or {}).get("library")
    return str(named["uuid"]) if isinstance(named, dict) and named.get("uuid") else ""


def _destination_library(
    session: Session,
    payload: dict[str, object] | None,
    library_uuid: str | None,
    resolved: dict[str, int],
) -> Library:
    """Which library a recording that is not here yet goes into.

    The manifest first, because a personal library keeps the uuid it was created with here and
    not the one the export remembers -- so the sidecar's uuid finds nothing and the recording
    would fall through to ``--library``.
    """
    if payload is not None:
        found = resolved.get(_library_uuid_in(payload))
        mapped = session.get(Library, found) if found is not None else None
        if mapped is not None:
            return mapped
        named = library_named_by(session, payload)
        if named is not None:
            return named
    if library_uuid is None:
        raise SonariumError("there is no library to import into: pass --library")
    library = session.query(Library).filter(Library.uuid == library_uuid).one_or_none()
    if library is None:
        raise SonariumError(f"There is no library with uuid {library_uuid}.")
    return library


def _import_one(
    database: Database,
    settings: Settings,
    path: Path,
    library_uuid: str | None,
    sidecar: Path | None,
    resolved: dict[str, int],
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

        library = _destination_library(session, payload, library_uuid, resolved)
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
            enqueue_transcription(session, audio_id=audio.id, audio_uuid=audio.uuid)
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
