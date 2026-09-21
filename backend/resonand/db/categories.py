"""The category tree (``DAT-7``).

One taxonomy per library, with ``parent_id`` giving a tree from the first migration even though
the first interface shows a single level. The tree is cheap to carry and expensive to add later:
retrofitting a parent onto a flat taxonomy means deciding what every existing category's parent
should be, which is a question only the user can answer and only while they still remember.

Three rules the database cannot express on its own and this module therefore owns:

* **Per-level uniqueness** is enforced by two partial indexes, because SQLite treats ``NULL``s as
  distinct and a single index over ``(library_id, parent_id, name)`` would let two root categories
  share a name. This module turns the resulting ``IntegrityError`` into something a person can
  read.
* **A category cannot become its own ancestor.** SQLite will happily let you point a node at its
  own child, and the result is a subtree that has vanished from the tree while still being in the
  table.
* **A category stays inside its library.** Moving one between libraries is not offered at all:
  the recordings in it belong to the old library, and the composite foreign key on ``audio``
  exists precisely so that a category and its recordings can never end up in different ones.
"""

from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from resonand.acl.query import require_library
from resonand.core.errors import ConflictError, InvalidRequestError, NotFoundError
from resonand.core.levels import Level
from resonand.db.models import Audio, Category, Library


def list_categories(session: Session, user_id: int, library_uuid: str) -> list[Category]:
    """The whole tree of one library, in the order the interface draws it."""
    library, _ = require_library(session, user_id, library_uuid, Level.READ)
    return list(
        session.execute(
            select(Category)
            .where(Category.library_id == library.id)
            .order_by(Category.parent_id, Category.position, Category.name)
        )
        .scalars()
        .all()
    )


def get_category(session: Session, user_id: int, category_id: int, required: Level) -> Category:
    """One category, checked through the library it belongs to.

    Categories have no public identifier of their own (``DEC-14``): they are reachable only
    through a library the caller can already read, so their integer id discloses nothing that the
    library's permissions did not already.
    """
    category = session.get(Category, category_id)
    if category is None:
        raise NotFoundError("No such category.")
    owning = session.get(Library, category.library_id)
    if owning is None:
        raise NotFoundError("No such category.")
    require_library(session, user_id, owning.uuid, required)
    return category


def create_category(
    session: Session,
    user_id: int,
    library_uuid: str,
    *,
    name: str,
    parent_id: int | None = None,
) -> Category:
    """Add a node to a library's tree."""
    library, _ = require_library(session, user_id, library_uuid, Level.EDIT)
    cleaned = _clean(name)
    if parent_id is not None:
        parent = session.get(Category, parent_id)
        if parent is None or parent.library_id != library.id:
            raise InvalidRequestError("That parent category is not in this library.")
    _require_name_free(session, library.id, parent_id, cleaned, excluding=None)
    category = Category(
        library_id=library.id,
        parent_id=parent_id,
        name=cleaned,
        position=_next_position(session, library.id, parent_id),
    )
    session.add(category)
    _flush(session, cleaned)
    return category


def rename_category(session: Session, user_id: int, category_id: int, *, name: str) -> Category:
    """Change a category's name, keeping it unique among its siblings."""
    category = get_category(session, user_id, category_id, Level.EDIT)
    cleaned = _clean(name)
    _require_name_free(
        session, category.library_id, category.parent_id, cleaned, excluding=category.id
    )
    category.name = cleaned
    _flush(session, category.name)
    return category


def move_category(
    session: Session, user_id: int, category_id: int, *, parent_id: int | None
) -> Category:
    """Re-parent a category, refusing anything that would detach a subtree from the tree."""
    category = get_category(session, user_id, category_id, Level.EDIT)
    if parent_id is not None:
        parent = session.get(Category, parent_id)
        if parent is None or parent.library_id != category.library_id:
            raise InvalidRequestError("That parent category is not in this library.")
        if parent_id == category_id:
            raise ConflictError("A category cannot be inside itself.")
        if category_id in _ancestors(session, parent_id):
            raise ConflictError(
                "A category cannot be moved inside one of its own subcategories: the whole "
                "branch would disappear from the tree."
            )
    _require_name_free(
        session, category.library_id, parent_id, category.name, excluding=category.id
    )
    category.parent_id = parent_id
    category.position = _next_position(session, category.library_id, parent_id)
    _flush(session, category.name)
    return category


def reorder_categories(session: Session, user_id: int, ordered_ids: list[int]) -> list[Category]:
    """Set the order of a set of siblings, in the order given."""
    if not ordered_ids:
        return []
    categories = [get_category(session, user_id, cid, Level.EDIT) for cid in ordered_ids]
    parents = {category.parent_id for category in categories}
    libraries = {category.library_id for category in categories}
    if len(parents) > 1 or len(libraries) > 1:
        raise InvalidRequestError("Only categories with the same parent can be reordered together.")
    for position, category in enumerate(categories):
        category.position = position
    session.flush()
    return categories


def delete_category(session: Session, user_id: int, category_id: int) -> None:
    """Remove a category, moving anything in it out first.

    The composite foreign key is declared ``ON DELETE SET NULL``, and SQLite sets *all* the child
    columns on that action -- including ``audio.library_id``, which is ``NOT NULL``. So deleting a
    category with recordings in it would fail with a constraint error rather than uncategorising
    them. Clearing the assignment first is what the user meant anyway.
    """
    category = get_category(session, user_id, category_id, Level.EDIT)
    descendants = _descendants(session, category.id) | {category.id}
    session.execute(
        update(Audio).where(Audio.category_id.in_(descendants)).values(category_id=None)
    )
    session.delete(category)
    session.flush()


def _clean(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise InvalidRequestError("A category needs a name.")
    return cleaned


def _next_position(session: Session, library_id: int, parent_id: int | None) -> int:
    """Put a new node last among its siblings rather than making the user drag it there."""
    highest = session.execute(
        select(func.max(Category.position)).where(
            Category.library_id == library_id,
            Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id,
        )
    ).scalar_one_or_none()
    return 0 if highest is None else int(highest) + 1


def _ancestors(session: Session, category_id: int) -> set[int]:
    """Every node between this one and the root, walked rather than recursed in SQL.

    A tree deep enough for the walk to cost anything is a tree nobody could navigate, so the
    simpler code wins; the loop guard is there for a cycle that a bug elsewhere put in the table,
    not for one this module would create.
    """
    seen: set[int] = set()
    current = session.get(Category, category_id)
    while current is not None and current.id not in seen:
        seen.add(current.id)
        current = None if current.parent_id is None else session.get(Category, current.parent_id)
    return seen


def _descendants(session: Session, category_id: int) -> set[int]:
    """Every node underneath this one."""
    found: set[int] = set()
    frontier = [category_id]
    while frontier:
        children = list(
            session.execute(select(Category.id).where(Category.parent_id.in_(frontier)))
            .scalars()
            .all()
        )
        children = [child for child in children if child not in found]
        found.update(children)
        frontier = children
    return found


def _require_name_free(
    session: Session, library_id: int, parent_id: int | None, name: str, *, excluding: int | None
) -> None:
    """Check the sibling name before writing it.

    The partial unique indexes would catch this anyway, but an ``IntegrityError`` on flush
    poisons the whole transaction -- and the caller's transaction may hold work that has
    nothing to do with categories. Writes are serialised through a single lock, so there is no
    window between this check and the insert for somebody else to use.
    """
    clash = select(Category.id).where(
        Category.library_id == library_id,
        Category.name == name,
        Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id,
    )
    if excluding is not None:
        clash = clash.where(Category.id != excluding)
    if session.execute(clash).first() is not None:
        raise ConflictError(f"There is already a category called {name!r} here.")


def _flush(session: Session, name: str) -> None:
    """Write inside a savepoint, so the backstop cannot take the caller's transaction down."""
    try:
        with session.begin_nested():
            session.flush()
    except IntegrityError as error:
        raise ConflictError(f"There is already a category called {name!r} here.") from error
