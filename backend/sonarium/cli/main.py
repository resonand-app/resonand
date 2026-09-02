"""The ``sonarium`` command.

Bulk import, full export and the integrity check are the commands that make principle 1 real
(``ING-11``, ``ING-13``); they arrive with the ingestion track. This module is their entry point
and, until then, the backend's proof that it installs.
"""

from __future__ import annotations

import typer

from sonarium import __version__

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


if __name__ == "__main__":  # pragma: no cover
    app()
