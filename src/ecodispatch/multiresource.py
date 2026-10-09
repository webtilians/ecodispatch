from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Callable, Iterable, Mapping, Sequence


@dataclass(frozen=True)
class OperationalResource:
    resource_id: str
    base_id: str
    capabilities: frozenset[str]
    available_at_min: float = 0.0
    location_id: str | None = None

    def __post_init__(self):
        if not self.resource_id:
            raise ValueError("resource_id is required")
        if not self.capabilities:
            raise ValueError("resource must have at least one capability")
        if self.available_at_min < 0:
            raise ValueError("available_at_min must be non-negative")


@dataclass(frozen=True)
class Requirement:
    capability: str
    count: int = 1

    def __post_init__(self):
        if not self.capability:
            raise ValueError("capability is required")
        if self.count < 1:
            raise ValueError("requirement count must be >= 1")


@dataclass(frozen=True)
class OperationalIncident:
    incident_id: str
    arrival_min: float
    requirements: tuple[Requirement, ...]

    def __post_init__(self):
        if self.arrival_min < 0:
            raise ValueError("arrival_min must be non-negative")
        if not self.requirements:
            raise ValueError("incident requires at least one resource slot")


@dataclass(frozen=True)
class ResourceAssignment:
    resource_id: str
    capability: str
    dispatch_min: float
    travel_min: float
    arrival_min: float
    release_min: float


@dataclass(frozen=True)
class BundleDispatch:
    incident_id: str
    complete: bool
    assignments: tuple[ResourceAssignment, ...]
    missing_capabilities: tuple[str, ...]
    bundle_ready_min: float | None
    queue_wait_min: float | None


TravelTime = Callable[[OperationalResource, OperationalIncident], float]
ServiceTime = Callable[[OperationalResource, OperationalIncident, str], float]


def _expanded_slots(requirements: Sequence[Requirement]) -> list[str]:
    slots: list[str] = []
    for requirement in requirements:
        slots.extend([requirement.capability] * requirement.count)
    return slots


def dispatch_atomic_bundle(
    resources: Sequence[OperationalResource],
    incident: OperationalIncident,
    *,
    travel_time: TravelTime,
    service_time: ServiceTime,
) -> tuple[BundleDispatch, tuple[OperationalResource, ...]]:
    """Assign a complete heterogeneous resource bundle or mutate nothing.

    v1.7.2a intentionally implements an architecture oracle rather than an
    EcoDispatch policy. Slots are ordered by scarcity, then filled by the
    eligible distinct resource with the earliest predicted arrival.

    A resource can expose multiple capabilities but can fill only one
    simultaneous slot for this incident.
    """
    slots = _expanded_slots(incident.requirements)
    eligibility = {
        capability: [r for r in resources if capability in r.capabilities]
        for capability in set(slots)
    }
    slots.sort(key=lambda capability: (len(eligibility[capability]), capability))

    chosen: list[tuple[OperationalResource, str, float, float]] = []
    used: set[str] = set()
    missing: list[str] = []

    for capability in slots:
        candidates: list[tuple[float, str, OperationalResource, float]] = []
        for resource in eligibility[capability]:
            if resource.resource_id in used:
                continue
            travel = float(travel_time(resource, incident))
            if travel < 0:
                raise ValueError("travel time must be non-negative")
            dispatch = max(incident.arrival_min, resource.available_at_min)
            arrival = dispatch + travel
            candidates.append((arrival, resource.resource_id, resource, travel))

        if not candidates:
            missing.append(capability)
            continue

        arrival, _, resource, travel = min(candidates)
        used.add(resource.resource_id)
        chosen.append((resource, capability, travel, arrival))

    if missing:
        result = BundleDispatch(
            incident_id=incident.incident_id,
            complete=False,
            assignments=(),
            missing_capabilities=tuple(sorted(missing)),
            bundle_ready_min=None,
            queue_wait_min=None,
        )
        return result, tuple(resources)

    assignments: list[ResourceAssignment] = []
    by_id = {resource.resource_id: resource for resource in resources}

    for resource, capability, travel, arrival in chosen:
        dispatch = max(incident.arrival_min, resource.available_at_min)
        duration = float(service_time(resource, incident, capability))
        if duration < 0:
            raise ValueError("service time must be non-negative")
        release = arrival + duration
        assignments.append(
            ResourceAssignment(
                resource_id=resource.resource_id,
                capability=capability,
                dispatch_min=dispatch,
                travel_min=travel,
                arrival_min=arrival,
                release_min=release,
            )
        )
        by_id[resource.resource_id] = replace(
            resource,
            available_at_min=release,
            location_id=incident.incident_id,
        )

    ready = max(a.arrival_min for a in assignments)
    wait = max(0.0, ready - incident.arrival_min)
    result = BundleDispatch(
        incident_id=incident.incident_id,
        complete=True,
        assignments=tuple(sorted(assignments, key=lambda a: a.resource_id)),
        missing_capabilities=(),
        bundle_ready_min=ready,
        queue_wait_min=wait,
    )
    updated = tuple(by_id[r.resource_id] for r in resources)
    return result, updated


def resources_from_exact_assets(payload: Mapping) -> tuple[OperationalResource, ...]:
    """Instantiate only source rows explicitly marked as exact single units."""
    out: list[OperationalResource] = []
    for asset in payload.get("exact_assets", []):
        if asset.get("source_status") != "catalogued_exact":
            continue
        if asset.get("units") != 1:
            raise ValueError("v1.7.2a exact_assets must be individual units")
        out.append(
            OperationalResource(
                resource_id=asset["resource_id"],
                base_id=asset["facility_id"],
                capabilities=frozenset(asset["capabilities"]),
                location_id=asset["facility_id"],
            )
        )
    return tuple(out)
