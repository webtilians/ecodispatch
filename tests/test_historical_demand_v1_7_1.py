import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/build_historical_demand_v1_7_1.py"
PROTOCOL = ROOT / "data/historical-demand-v1.7.1/protocol.json"

spec = importlib.util.spec_from_file_location("historical_demand_v171", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class HistoricalDemandReplayCohortTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.protocol = json.loads(PROTOCOL.read_text(encoding="utf-8"))
        cls.data = builder.build()

    def test_design_identity_and_scope(self):
        p = self.protocol
        self.assertEqual(p["version"], "1.7.1")
        self.assertFalse(p["confirmatory"])
        self.assertEqual(p["cohort"]["years"], [2006, 2023])
        self.assertEqual(p["cohort"]["candidate_parts"], 1467)
        self.assertEqual(p["service_minutes"], [45, 90, 180])
        self.assertEqual(p["harm_k"], [10, 60, 120])
        self.assertEqual(p["policies"]["lambdas"], [0, .2, .35, .5, 1])
        self.assertEqual(p["out_of_scope"]["version"], "1.7.2")

    def test_spatially_complete_candidate_cohort(self):
        c = self.data["counts"]
        self.assertEqual(c["candidate_parts"], 1467)
        self.assertEqual(len(c["by_year"]), 18)
        for year, row in c["by_year"].items():
            self.assertGreater(row["candidate_parts"], 0)
            self.assertEqual(
                row["candidate_parts"],
                row["primary_events"] + row["excluded_detection_time_precision"],
                year,
            )

    def test_primary_events_are_observed_and_deterministically_ordered(self):
        events = self.data["events"]
        keys = [(x["detected_at"], x["incident_id"]) for x in events]
        self.assertEqual(keys, sorted(keys))
        self.assertEqual(len({x["incident_id"] for x in events}), len(events))
        for x in events:
            self.assertTrue(2006 <= x["source_year"] <= 2023)
            self.assertEqual(x["detection_time_flag"], "valid")
            self.assertTrue(0 <= x["arrival_min"] < 1440)
            self.assertIsInstance(x["latitude"], (int, float))
            self.assertIsInstance(x["longitude"], (int, float))

    def test_no_policy_or_operational_calibration_leaks_into_cohort(self):
        text = json.dumps(self.data)
        self.assertNotIn("lambda", text)
        self.assertNotIn("service_minutes", text)
        self.assertNotIn("first_arrival", text)
        self.assertNotIn("controlled_at", text)
        self.assertNotIn("extinguished_at", text)
        self.assertFalse(self.data["provenance"]["dispatch_executed"])
        self.assertFalse(self.data["provenance"]["imputation"])

    def test_calendar_accounting(self):
        c = self.data["counts"]
        self.assertEqual(c["calendar_days"], 6574)
        self.assertEqual(c["active_fire_days"] + c["zero_fire_days"], 6574)
        self.assertEqual(sum(self.data["active_day_event_counts"].values()), c["primary_events"])

    def test_builder_is_deterministic(self):
        first = builder.canonical(builder.build())
        second = builder.canonical(builder.build())
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
