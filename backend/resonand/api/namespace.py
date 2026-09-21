"""Where the API lives, and where it does not (``API-16``, ``DEC-24``).

One constant in a module of its own, because two things need it and neither may import the
other: :mod:`resonand.api.app` mounts every router under it, and :mod:`resonand.api.spa` refuses
to answer a navigation inside it.

The interface is served from this same origin, so its routes and the API's paths would otherwise
be one namespace with the API already occupying it -- ``/search`` is a view and an endpoint, and
so are ``/trash`` and ``/settings`` in every version of this product that has them. A view named
after the thing it shows is the normal case, so the prefix is here rather than a rule about which
names a route may not be given.

``/healthz`` and ``/readyz`` stay outside it: they are probes rather than API surface, and the
compose file and the image's own healthcheck already name them. So does ``/``, which is the
interface when a bundle is present and the instance's own answer when it is not.
"""

from __future__ import annotations

API_PREFIX = "/api"
"""The prefix every router, the published document and its viewer are mounted under."""
