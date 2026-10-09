import hashlib
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTING = ROOT / "data/historical-demand-v1.7.1/routing.json"
FREEZE = ROOT / "data/historical-demand-v1.7.1/routing-freeze.json"


class HistoricalRoutingV171Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = ROUTING.read_bytes()
        cls.data = json.loads(cls.raw)
        cls.freeze = json.loads(FREEZE.read_text(encoding="utf-8"))

    def test_frozen_hash_and_pre_outcome_status(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), self.freeze["routing_sha256"])
        self.assertEqual(self.freeze["status"], "frozen_before_dispatch_outcomes")
        self.assertEqual(self.freeze["primary_events"], 1464)

    def test_sparse_graph_is_complete_for_declared_contract(self):
        expected = {
            "base_to_event": 4392,
            "event_to_potential": 14640,
            "event_to_event_same_day": 682,
        }
        self.assertEqual(self.data["audit"]["route_counts"], expected)
        self.assertEqual(self.data["audit"]["expected_route_counts"], expected)
        for name, count in expected.items():
            self.assertEqual(len(self.data["routes"][name]), count)

    def test_routes_and_snaps_are_finite_nonnegative(self):
        for rows in self.data["routes"].values():
            for source, target, duration, distance in rows:
                self.assertTrue(source)
                self.assertTrue(target)
                self.assertGreaterEqual(duration, 0)
                self.assertGreaterEqual(distance, 0)
        self.assertEqual(self.data["audit"]["unique_snap_points"], 1477)
        self.assertEqual(len(self.data["snaps"]), 1477)
        for snap in self.data["snaps"].values():
            self.assertGreaterEqual(snap["snap_distance_m"], 0)

    def test_claim_boundary(self):
        self.assertFalse(self.data["scope"]["runtime_network_calls"])
        self.assertIn("not historical road reconstruction", self.data["scope"]["road_network"])
        self.assertEqual(self.data["source"]["network_data"], "OpenStreetMap")
        self.assertEqual(self.data["source"]["routing_engine"], "OSRM")


if __name__ == "__main__":
    unittest.main()
