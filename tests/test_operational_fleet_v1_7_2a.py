import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from ecodispatch.multiresource import (  # noqa: E402
    OperationalIncident,
    OperationalResource,
    Requirement,
    dispatch_atomic_bundle,
    resources_from_exact_assets,
)


class OperationalFleetV172aTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT / "data" / "operational-replay-v1.7.2a" / "infoca-2026-malaga-fleet.json"
        cls.payload = json.loads(path.read_text(encoding="utf-8"))

    def test_only_exact_catalogued_local_or_regional_units_instantiate_by_default(self):
        resources = resources_from_exact_assets(self.payload)
        self.assertEqual(len(resources), 4)
        self.assertEqual(
            {r.resource_id for r in resources},
            {
                "MA-HTER-COLMENAR-01",
                "MA-HTER-RONDA-01",
                "MA-HTER-SIERRA-NIEVES-01",
                "MA-HTEGC-CARTAMA-01",
            },
        )
        self.assertTrue(all(pool["capacity"] is None for pool in self.payload["unresolved_ground_pools"]))

    def test_external_national_support_requires_explicit_opt_in(self):
        resources = resources_from_exact_assets(self.payload, include_external_support=True)
        self.assertEqual(len(resources), 5)
        cl415 = next(r for r in resources if r.resource_id == "MA-AA-CL415T-AIRPORT-01")
        self.assertEqual(cl415.operational_scope, "national_external_support")

    def test_multicapability_resource_cannot_fill_two_slots(self):
        resources = (
            OperationalResource("H1", "B1", frozenset({"transport", "water"})),
        )
        incident = OperationalIncident(
            "F1",
            10,
            (Requirement("transport"), Requirement("water")),
        )
        result, after = dispatch_atomic_bundle(
            resources,
            incident,
            travel_time=lambda _r, _i: 5,
            service_time=lambda _r, _i, _c: 45,
        )
        self.assertFalse(result.complete)
        self.assertEqual(result.assignments, ())
        self.assertEqual(after, resources)

    def test_bundle_occupies_independent_resources(self):
        resources = (
            OperationalResource("G1", "B1", frozenset({"ground"})),
            OperationalResource("A1", "B2", frozenset({"air_water"})),
        )
        incident = OperationalIncident(
            "F1",
            60,
            (Requirement("ground"), Requirement("air_water")),
        )
        result, after = dispatch_atomic_bundle(
            resources,
            incident,
            travel_time=lambda r, _i: 10 if r.resource_id == "G1" else 4,
            service_time=lambda r, _i, _c: 90 if r.resource_id == "G1" else 45,
        )
        self.assertTrue(result.complete)
        by_id = {a.resource_id: a for a in result.assignments}
        self.assertEqual(by_id["G1"].release_min, 160)
        self.assertEqual(by_id["A1"].release_min, 109)
        state = {r.resource_id: r for r in after}
        self.assertEqual(state["G1"].available_at_min, 160)
        self.assertEqual(state["A1"].available_at_min, 109)

    def test_second_incident_waits_for_busy_resource(self):
        resources = (
            OperationalResource("A1", "B1", frozenset({"air_water"})),
        )
        first = OperationalIncident("F1", 0, (Requirement("air_water"),))
        result1, after1 = dispatch_atomic_bundle(
            resources,
            first,
            travel_time=lambda _r, _i: 10,
            service_time=lambda _r, _i, _c: 50,
        )
        self.assertTrue(result1.complete)
        self.assertEqual(after1[0].available_at_min, 60)

        second = OperationalIncident("F2", 30, (Requirement("air_water"),))
        result2, after2 = dispatch_atomic_bundle(
            after1,
            second,
            travel_time=lambda _r, _i: 5,
            service_time=lambda _r, _i, _c: 20,
        )
        self.assertTrue(result2.complete)
        self.assertEqual(result2.assignments[0].dispatch_min, 60)
        self.assertEqual(result2.assignments[0].arrival_min, 65)
        self.assertEqual(result2.queue_wait_min, 35)
        self.assertEqual(after2[0].available_at_min, 85)


if __name__ == "__main__":
    unittest.main()
