from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from ecodispatch import (  # noqa: E402
    CandidateBase,
    DemandNode,
    Incident,
    Resource,
    dispatch_lexicographic,
    greedy_k_server,
    offline_k_server_opt,
    weighted_k_median_exact,
)


def run_demo():
    candidates = [
        CandidateBase("B0", (0, 0)),
        CandidateBase("B1", (3, 1)),
        CandidateBase("B2", (6, 0)),
        CandidateBase("B3", (1, 5)),
        CandidateBase("B4", (5, 5)),
        CandidateBase("B5", (8, 4)),
        CandidateBase("B6", (2, 8)),
        CandidateBase("B7", (7, 8)),
    ]

    demand = [
        DemandNode("D0", (0.5, 0.5), 4.0),
        DemandNode("D1", (2.0, 1.2), 2.0),
        DemandNode("D2", (5.5, 0.8), 3.5),
        DemandNode("D3", (7.5, 1.5), 1.5),
        DemandNode("D4", (1.0, 4.5), 5.0),
        DemandNode("D5", (3.0, 5.0), 2.0),
        DemandNode("D6", (5.5, 4.8), 4.5),
        DemandNode("D7", (8.0, 5.0), 2.5),
        DemandNode("D8", (1.5, 7.5), 3.0),
        DemandNode("D9", (4.0, 7.0), 1.5),
        DemandNode("D10", (6.8, 7.8), 4.0),
        DemandNode("D11", (8.2, 8.5), 2.0),
    ]

    placement = weighted_k_median_exact(demand, candidates, k=3)
    selected = placement.selected

    resources = [
        Resource("R0", selected[0].point, frozenset({"medical", "fire"}), 75, 210),
        Resource("R1", selected[0].point, frozenset({"medical"}), 70, 170),
        Resource("R2", selected[1].point, frozenset({"fire", "drone"}), 65, 190),
        Resource("R3", selected[2].point, frozenset({"medical", "drone"}), 80, 160),
    ]

    incidents = [
        Incident("I0", (0.8, 4.7), "medical", 5.0, 12),
        Incident("I1", (6.0, 5.2), "fire", 4.5, 15),
        Incident("I2", (7.4, 7.4), "drone", 2.0, 12),
        Incident("I3", (5.8, 0.7), "medical", 3.5, 10),
    ]

    dispatch = dispatch_lexicographic(resources, incidents)

    nodes = [base.point for base in candidates]
    initial_nodes = [candidates.index(base) for base in selected]
    requests = [3, 5, 7, 6, 4, 2, 5, 7, 1, 4]
    online_cost, _ = greedy_k_server(nodes, initial_nodes, requests)
    offline_cost = offline_k_server_opt(nodes, initial_nodes, requests)

    return {
        "selected_bases": [base.name for base in placement.selected],
        "k_median_objective": round(placement.objective, 3),
        "dispatch": [
            {
                "resource": pair.resource.name,
                "incident": pair.incident.name,
                "eta_min": round(pair.eta_min, 2),
                "distance_km": round(pair.distance_km, 2),
                "secondary_cost": round(pair.cost, 2),
            }
            for pair in dispatch.pairs
        ],
        "unserved": [incident.name for incident in dispatch.unserved_incidents],
        "online_k_server_cost": round(online_cost, 3),
        "offline_k_server_opt": round(offline_cost, 3),
        "empirical_ratio": round(online_cost / offline_cost, 3),
    }


if __name__ == "__main__":
    print(json.dumps(run_demo(), indent=2))
