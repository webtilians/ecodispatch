import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from ecodispatch import (  # noqa: E402
    CandidateBase,
    DemandNode,
    Incident,
    Resource,
    dispatch_lexicographic,
    offline_k_server_opt,
    weighted_k_median_exact,
)


class EcoDispatchCoreTests(unittest.TestCase):
    def test_weighted_k_median_prefers_risk_mass(self):
        candidates = [CandidateBase("A", (0, 0)), CandidateBase("B", (10, 0))]
        demand = [
            DemandNode("low", (0, 0), 1),
            DemandNode("high", (10, 0), 10),
        ]
        result = weighted_k_median_exact(demand, candidates, 1)
        self.assertEqual([base.name for base in result.selected], ["B"])

    def test_dispatch_preserves_coverage_with_capability_conflict(self):
        resources = [
            Resource("R0", (0, 0), frozenset({"medical"}), speed_kmh=60),
            Resource("R1", (10, 0), frozenset({"medical", "fire"}), speed_kmh=60),
        ]
        incidents = [
            Incident("medical", (1, 0), "medical", severity=1, deadline_min=20),
            Incident("fire", (9, 0), "fire", severity=1, deadline_min=20),
        ]
        result = dispatch_lexicographic(resources, incidents)
        self.assertEqual(len(result.pairs), 2)
        mapping = {p.resource.name: p.incident.name for p in result.pairs}
        self.assertEqual(mapping["R1"], "fire")

    def test_dispatch_prioritizes_severity_before_secondary_cost(self):
        resources = [
            Resource("R0", (0, 0), frozenset({"medical"}), speed_kmh=60),
        ]
        incidents = [
            Incident(
                "low-near",
                (0.1, 0),
                "medical",
                severity=1,
                deadline_min=60,
            ),
            Incident(
                "high-far",
                (5, 0),
                "medical",
                severity=10,
                deadline_min=60,
            ),
        ]

        result = dispatch_lexicographic(resources, incidents)

        self.assertEqual(len(result.pairs), 1)
        self.assertEqual(result.pairs[0].incident.name, "high-far")

    def test_dispatch_minimizes_cost_after_severity_and_count_tie(self):
        resources = [
            Resource("near", (0, 0), frozenset({"medical"}), speed_kmh=60),
            Resource("far", (10, 0), frozenset({"medical"}), speed_kmh=60),
        ]
        incidents = [
            Incident("case", (1, 0), "medical", severity=5, deadline_min=60),
        ]

        result = dispatch_lexicographic(resources, incidents)

        self.assertEqual(len(result.pairs), 1)
        self.assertEqual(result.pairs[0].resource.name, "near")

    def test_offline_k_server_zero_when_requests_already_covered(self):
        nodes = [(0, 0), (1, 0)]
        cost = offline_k_server_opt(nodes, [0, 1], [0, 1, 0, 1])
        self.assertEqual(cost, 0.0)


if __name__ == "__main__":
    unittest.main()
