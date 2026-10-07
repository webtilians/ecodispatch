from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from math import hypot
from typing import FrozenSet, Sequence, Tuple

Point = Tuple[float, float]


def euclidean(a: Point, b: Point) -> float:
    return hypot(a[0] - b[0], a[1] - b[1])


@dataclass(frozen=True)
class DemandNode:
    name: str
    point: Point
    risk_weight: float


@dataclass(frozen=True)
class CandidateBase:
    name: str
    point: Point


@dataclass(frozen=True)
class Resource:
    name: str
    point: Point
    capabilities: FrozenSet[str]
    speed_kmh: float = 60.0
    co2_g_per_km: float = 180.0


@dataclass(frozen=True)
class Incident:
    name: str
    point: Point
    required_capability: str
    severity: float
    deadline_min: float


@dataclass(frozen=True)
class PlacementAssignment:
    demand: str
    base: str
    distance: float


@dataclass(frozen=True)
class PlacementResult:
    selected: tuple[CandidateBase, ...]
    objective: float
    assignment: tuple[PlacementAssignment, ...]


@dataclass(frozen=True)
class DispatchPair:
    resource: Resource
    incident: Incident
    eta_min: float
    distance_km: float
    cost: float


@dataclass(frozen=True)
class DispatchResult:
    pairs: tuple[DispatchPair, ...]
    unserved_incidents: tuple[Incident, ...]
    total_secondary_cost: float


def weighted_k_median_exact(
    demand: Sequence[DemandNode],
    candidates: Sequence[CandidateBase],
    k: int,
    metric=euclidean,
) -> PlacementResult:
    """Exact small-instance weighted metric k-median solver.

    Objective:
        min_{S subset F, |S|=k} sum_j w_j * min_{f in S} d(j,f)

    This implementation enumerates subsets and is intended as a validation
    oracle for small experiments, not as the future production solver.
    """
    if not (1 <= k <= len(candidates)):
        raise ValueError("k must be between 1 and the number of candidates")
    if any(node.risk_weight < 0 for node in demand):
        raise ValueError("risk weights must be non-negative")

    best_subset: tuple[CandidateBase, ...] | None = None
    best_cost = float("inf")
    best_assignment: tuple[PlacementAssignment, ...] = ()

    for subset in combinations(candidates, k):
        total = 0.0
        assignments: list[PlacementAssignment] = []
        for node in demand:
            base = min(subset, key=lambda b: metric(node.point, b.point))
            distance = metric(node.point, base.point)
            total += node.risk_weight * distance
            assignments.append(
                PlacementAssignment(node.name, base.name, distance)
            )

        if total < best_cost:
            best_cost = total
            best_subset = tuple(subset)
            best_assignment = tuple(assignments)

    assert best_subset is not None
    return PlacementResult(best_subset, best_cost, best_assignment)


def eta_and_distance(resource: Resource, incident: Incident, metric=euclidean):
    if resource.speed_kmh <= 0:
        raise ValueError("resource speed must be positive")
    distance_km = metric(resource.point, incident.point)
    eta_min = 60.0 * distance_km / resource.speed_kmh
    return eta_min, distance_km


def secondary_edge_cost(
    resource: Resource,
    incident: Incident,
    eta_min: float,
    distance_km: float,
    *,
    w_harm: float = 1.0,
    w_emissions: float = 0.0005,
    w_distance: float = 0.05,
) -> float:
    """Secondary dispatch cost after severity coverage and cardinality are fixed."""
    harm = incident.severity * eta_min
    emissions_g = resource.co2_g_per_km * distance_km
    return (
        w_harm * harm
        + w_emissions * emissions_g
        + w_distance * distance_km
    )


def feasible_pair(resource: Resource, incident: Incident, metric=euclidean):
    if incident.required_capability not in resource.capabilities:
        return None
    eta_min, distance_km = eta_and_distance(resource, incident, metric)
    if eta_min > incident.deadline_min:
        return None
    return (
        eta_min,
        distance_km,
        secondary_edge_cost(resource, incident, eta_min, distance_km),
    )


def dispatch_lexicographic(
    resources: Sequence[Resource],
    incidents: Sequence[Incident],
    metric=euclidean,
) -> DispatchResult:
    """Exact small-batch dispatcher.

    Canonical lexicographic objective (v0.6+):
      1) maximize total incident severity covered;
      2) among equal-severity solutions, maximize incidents served;
      3) among ties on (1) and (2), minimize secondary response cost.

    Severity is an application-level priority layered on top of feasible
    matching. OpenAI result #120 motivates the matching layer, but does not by
    itself provide this weighted lexicographic objective.

    Complexity is exponential in the number of incidents, so this is a
    research oracle for small batches. A scalable weighted/b-matching or
    min-cost-flow backend can replace it while preserving the public objective.
    """
    feasible: dict[tuple[int, int], tuple[float, float, float]] = {}
    for r_idx, resource in enumerate(resources):
        for i_idx, incident in enumerate(incidents):
            pair = feasible_pair(resource, incident, metric)
            if pair is not None:
                feasible[(r_idx, i_idx)] = pair

    severity_epsilon = 1e-9

    @lru_cache(maxsize=None)
    def solve(r_idx: int, mask: int):
        if r_idx == len(resources):
            return 0.0, 0, 0.0, ()

        (
            best_severity,
            best_count,
            best_cost,
            best_choices,
        ) = solve(r_idx + 1, mask)

        for i_idx in range(len(incidents)):
            bit = 1 << i_idx
            if mask & bit:
                continue
            pair = feasible.get((r_idx, i_idx))
            if pair is None:
                continue

            eta_min, distance_km, edge_cost = pair
            severity2, count2, cost2, choices2 = solve(
                r_idx + 1, mask | bit
            )
            candidate = (
                severity2 + incidents[i_idx].severity,
                count2 + 1,
                cost2 + edge_cost,
                (
                    (r_idx, i_idx, eta_min, distance_km, edge_cost),
                )
                + choices2,
            )

            candidate_severity, candidate_count, candidate_cost, _ = candidate
            severity_better = (
                candidate_severity > best_severity + severity_epsilon
            )
            severity_tied = (
                abs(candidate_severity - best_severity) <= severity_epsilon
            )
            count_better = severity_tied and candidate_count > best_count
            cost_better = (
                severity_tied
                and candidate_count == best_count
                and candidate_cost < best_cost
            )

            if severity_better or count_better or cost_better:
                (
                    best_severity,
                    best_count,
                    best_cost,
                    best_choices,
                ) = candidate

        return best_severity, best_count, best_cost, best_choices

    _, _, total_cost, choices = solve(0, 0)

    served: set[int] = set()
    pairs: list[DispatchPair] = []
    for r_idx, i_idx, eta_min, distance_km, edge_cost in choices:
        served.add(i_idx)
        pairs.append(
            DispatchPair(
                resources[r_idx],
                incidents[i_idx],
                eta_min,
                distance_km,
                edge_cost,
            )
        )

    unserved = tuple(
        incident for idx, incident in enumerate(incidents) if idx not in served
    )
    return DispatchResult(tuple(pairs), unserved, total_cost)


def greedy_k_server(
    nodes: Sequence[Point],
    initial_server_nodes: Sequence[int],
    requests: Sequence[int],
    metric=euclidean,
):
    """Nearest-server online baseline for finite k-server experiments."""
    positions = list(initial_server_nodes)
    total = 0.0
    trace = []

    for request in requests:
        server = min(
            range(len(positions)),
            key=lambda s: metric(nodes[positions[s]], nodes[request]),
        )
        origin = positions[server]
        move = metric(nodes[origin], nodes[request])
        total += move
        trace.append((request, server, origin, request, move))
        positions[server] = request

    return total, tuple(trace)


def offline_k_server_opt(
    nodes: Sequence[Point],
    initial_server_nodes: Sequence[int],
    requests: Sequence[int],
    metric=euclidean,
) -> float:
    """Exact offline optimum for small finite k-server instances."""
    initial = tuple(sorted(initial_server_nodes))

    @lru_cache(maxsize=None)
    def dp(t: int, config: tuple[int, ...]) -> float:
        if t == len(requests):
            return 0.0

        request = requests[t]
        best = float("inf")
        for server in range(len(config)):
            origin = config[server]
            new_config = list(config)
            new_config[server] = request
            canonical = tuple(sorted(new_config))
            move = metric(nodes[origin], nodes[request])
            best = min(best, move + dp(t + 1, canonical))
        return best

    return dp(0, initial)
