"""Every route goes through authentication, or is on the list of the ones that must not (``INT-5``).

This is a structural test rather than a behavioural one. Behavioural tests check the endpoints
that exist today; this one fails when somebody adds an endpoint tomorrow and forgets, which is the
failure mode that actually happens. Adding a route to the allowlist below is a deliberate act
that shows up in a diff and has to be justified in review.
"""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sonarium.api.deps import current_admin, current_caller, optional_caller
from starlette.routing import Route

PUBLIC_ROUTES: frozenset[tuple[str, str]] = frozenset(
    {
        ("GET", "/"),
        # What the instance is. Says nothing a stranger could not learn by looking at the page.
        ("GET", "/instance"),
        # Whether the instance still needs its first administrator. The sign-in screen needs it
        # before a session can exist (UI-21).
        ("POST", "/auth/bootstrap"),
        # Creates that first administrator, and refuses the moment any account exists.
        ("POST", "/auth/session"),
        # Signing in is how a session is obtained, so it cannot require one.
        ("GET", "/healthz"),
        ("GET", "/readyz"),
        # Liveness and readiness, for whatever restarts the container.
        ("GET", "/openapi.json"),
        ("GET", "/docs"),
        ("GET", "/docs/oauth2-redirect"),
        # The published API document and its viewer.
    }
)

ANONYMOUS_404_ROUTES: frozenset[tuple[str, str]] = frozenset(
    {
        ("GET", "/audio/{audio_uuid}/stream"),
        # Playback accepts either a session or a signed playback token, because <audio>
        # cannot send an Authorization header. A request with neither is refused as a 404
        # rather than a 401, for the same reason as everything else the caller may not read:
        # a 401 here would confirm that the recording exists (DEC-14).
    }
)

AUTH_DEPENDENCIES = frozenset({current_caller, current_admin, optional_caller})


def every_route(app: FastAPI) -> Iterator[APIRoute | Route]:
    """Walk the routing tree, descending into included routers.

    ``app.routes`` is not flat: an included router appears as a single entry holding its own
    routes. An audit that iterated it directly would find almost nothing and pass, which is
    worse than having no audit at all.
    """
    frontier: list[object] = [app.router]
    seen: set[int] = set()
    while frontier:
        node = frontier.pop()
        if id(node) in seen:
            continue
        seen.add(id(node))
        for route in getattr(node, "routes", []):
            # An included router appears either as a nested router or, in newer FastAPI, as a
            # lazy wrapper that keeps the real one on ``original_router``.
            nested = getattr(route, "original_router", None)
            if nested is not None:
                frontier.append(nested)
            elif hasattr(route, "routes"):
                frontier.append(route)
            if isinstance(route, APIRoute | Route):
                yield route


def api_routes(app: FastAPI) -> list[APIRoute]:
    return [route for route in every_route(app) if isinstance(route, APIRoute)]


def route_pairs(app: FastAPI) -> set[tuple[str, str]]:
    """Every method-and-path this application actually answers on."""
    pairs: set[tuple[str, str]] = set()
    for route in every_route(app):
        pairs.update((method, route.path) for method in (route.methods or set()))
    return pairs


def _requires_a_caller(route: APIRoute) -> bool:
    """Whether resolving this route forces the session to be resolved.

    Walks the whole dependency tree rather than looking at the signature, because a router-level
    dependency (which is how administration is protected) never appears in an endpoint's
    parameters.
    """
    frontier = list(route.dependant.dependencies)
    seen = set()
    while frontier:
        dependency = frontier.pop()
        if id(dependency) in seen:
            continue
        seen.add(id(dependency))
        if dependency.call in AUTH_DEPENDENCIES:
            return True
        frontier.extend(dependency.dependencies)
    return False


def test_no_endpoint_reaches_the_archive_without_resolving_the_caller(app: FastAPI) -> None:
    routes = api_routes(app)
    assert len(routes) > 20, "the walk found almost no routes, so this audit proves nothing"
    escaped = [
        f"{method} {route.path}"
        for route in routes
        for method in sorted(route.methods or set())
        if (method, route.path) not in PUBLIC_ROUTES and not _requires_a_caller(route)
    ]
    assert not escaped, (
        "these routes never resolve a session, so nothing filters what they return: "
        f"{escaped}. Either take CurrentCaller, or add them to PUBLIC_ROUTES with a reason."
    )


def test_the_allowlist_has_no_stale_entries(app: FastAPI) -> None:
    """A route that was public and has since been removed leaves a hole nobody notices."""
    existing = route_pairs(app)
    stale = {entry for entry in PUBLIC_ROUTES | ANONYMOUS_404_ROUTES if entry not in existing}
    assert not stale, f"these are allowlisted but do not exist: {sorted(stale)}"


def test_every_private_route_actually_refuses_an_anonymous_request(
    app: FastAPI, client: TestClient
) -> None:
    """The structural check above proves the dependency is declared. This one proves it bites."""
    answered: dict[str, tuple[int, int]] = {}
    for route in api_routes(app):
        for method in sorted(route.methods or set()):
            if (method, route.path) in PUBLIC_ROUTES:
                continue
            path = route.path.replace("{library_uuid}", "00000000-0000-4000-8000-000000000000")
            path = path.replace("{audio_uuid}", "00000000-0000-4000-8000-000000000000")
            path = path.replace("{sha256}", "0" * 64).replace("{category_id}", "1")
            path = path.replace("{transcript_id}", "1").replace("{session_id}", "1")
            path = path.replace("{user_id}", "1").replace("{grantee_id}", "1")
            response = client.request(method, path, json={})
            expected = 404 if (method, route.path) in ANONYMOUS_404_ROUTES else 401
            answered[f"{method} {path}"] = (response.status_code, expected)
    leaked = {
        route: f"answered {got}, expected {wanted}"
        for route, (got, wanted) in answered.items()
        if got != wanted
    }
    assert not leaked, f"these did not refuse an anonymous request as they should: {leaked}"
