from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Callable, Mapping, Sequence


@dataclass(frozen=True)
class OperationalResource:
    resource_id: str
    base_id: str
    capabilities: frozenset[str]
    operational_scope: str = "regional_or_local"
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


def _incomplete_reason(
    slots: Sequence[str],
    eligibility: Mapping[str, Sequence[OperationalResource]],
) -> tuple[str, ...]:
    missing: list[str] = []
    for capability in sorted(set(slots)):
        required = slots.count(capability)
        deficit = required - len(eligibility[capability])
        if deficit > 0:
            missing.extend([capability] * deficit)
    if not missing:
        missing.append("distinct_resource_capacity_conflict")
    return tuple(missing)


def dispatch_atomic_bundle(
    resources: Sequence[OperationalResource],
    incident: OperationalIncident,
    *,
    travel_time: TravelTime,
    service_time: ServiceTime,
) -> tuple[BundleDispatch, tuple[OperationalResource, ...]]:
    """Assign a complete heterogeneous resource bundle or mutate nothing.

    v1.7.2a is an architecture oracle, not an EcoDispatch policy comparison.
    It solves the small bundle assignment exactly over distinct resources.

    Objective:
      1) minimize the time at which the whole bundle has arrived;
      2) minimize total resource arrival time;
      3) deterministic lexical tie-break.

    A resource can expose multiple capabilities but can fill only one
    simultaneous slot for the incident.
    """
    slots = _expanded_slots(incident.requirements)
    eligibility = {
        capability: [r for r in resources if capability in r.capabilities]
        for capability in set(slots)
    }
    slots.sort(key=lambda capability: (len(eligibility[capability]), capability))

    candidate_rows: dict[str, list[tuple[float, str, OperationalResource, float]]] = {}
    for capability in set(slots):
        rows = []
        for resource in eligibility[capability]:
            travel = float(travel_time(resource, incident))
            if travel < 0:
                raise ValueError("travel time must be non-negative")
            dispatch = max(incident.arrival_min, resource.available_at_min)
            arrival = dispatch + travel
            rows.append((arrival, resource.resource_id, resource, travel))
        candidate_rows[capability] = sorted(rows, key=lambda row: (row[0], row[1]))

    best_key: tuple | None = None
    best_choice: tuple[tuple[OperationalResource, str, float, float], ...] | None = None

    def search(
        slot_index: int,
        used: set[str],
        chosen: list[tuple[OperationalResource, str, float, float]],
    ) -> None:
        nonlocal best_key, best_choice
        if slot_index == len(slots):
            arrivals = [row[3] for row in chosen]
            lexical = tuple(sorted((row[1], row[0].resource_id) for row in chosen))
            key = (max(arrivals), sum(arrivals), lexical)
            if best_key is None or key < best_key:
                best_key = key
                best_choice = tuple(chosen)
            return

        capability = slots[slot_index]
        for arrival, _, resource, travel in candidate_rows[capability]:
            if resource.resource_id in used:
                continue
            if best_key is not None and arrival > best_key[0]:
                continue
            used.add(resource.resource_id)
            chosen.append((resource, capability, travel, arrival))
            search(slot_index + 1, used, chosen)
            chosen.pop()
            used.remove(resource.resource_id)

    search(0, set(), [])

    if best_choice is None:
        result = BundleDispatch(
            incident_id=incident.incident_id,
            complete=False,
            assignments=(),
            missing_capabilities=_incomplete_reason(slots, eligibility),
            bundle_ready_min=None,
            queue_wait_min=None,
        )
        return result, tuple(resources)

    assignments: list[ResourceAssignment] = []
    by_id = {resource.resource_id: resource for resource in resources}

    for resource, capability, travel, arrival in best_choice:
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
    wait = max(0.0, max(a.dispatch_min for a in assignments) - incident.arrival_min)
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


def resources_from_exact_assets(
    payload: Mapping,
    *,
    include_external_support: bool = False,
) -> tuple[OperationalResource, ...]:
    """Instantiate exact single units without assuming external support is local.

    By default, assets explicitly labelled as national/external support remain in
    the catalogue but are not considered continuously available to Málaga.
    """
    out: list[OperationalResource] = []
    for asset in payload.get("exact_assets", []):
        if asset.get("source_status") != "catalogued_exact":
            continue
        if asset.get("units") != 1:
            raise ValueError("v1.7.2a exact_assets must be individual units")

        scope = asset.get("operational_scope", "regional_or_local")
        if scope == "national_external_support" and not include_external_support:
            continue

        out.append(
            OperationalResource(
                resource_id=asset["resource_id"],
                base_id=asset["facility_id"],
                capabilities=frozenset(asset["capabilities"]),
                operational_scope=scope,
                location_id=asset["facility_id"],
            )
        )
    return tuple(out)
