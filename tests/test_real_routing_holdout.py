import hashlib
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
CURRENT = ROOT / "web" / "data" / "current.json"
ROUTING = ROOT / "web" / "data" / "routing-v1.0.json"
PREREG = ROOT / "docs" / "real-routing-holdout-v1.1-preregistered.md"
WORKER = ROOT / "web" / "real-routing-holdout-worker.js"


def git_blob_sha(path: pathlib.Path) -> str:
    data = path.read_bytes()
    payload = f"blob {len(data)}\0".encode() + data
    return hashlib.sha1(payload).hexdigest()


class RealRoutingHoldoutProtocolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = json.loads(CURRENT.read_text(encoding="utf-8"))
        cls.routing = json.loads(ROUTING.read_text(encoding="utf-8"))
        cls.holdout = cls.current["research"]["real_routing_holdout"]

    def test_preregistered_unrun_protocol(self):
        self.assertGreaterEqual(int(self.current["version"].split(".")[0]), 1)
        self.assertEqual(self.holdout["status"], "confirmed_frozen")
        self.assertEqual(self.holdout["seed"], "ecodispatch-real-routing-holdout-11")
        self.assertEqual(self.holdout["n"], 1000)
        self.assertEqual(self.holdout["harm_k"], 10)
        self.assertEqual(self.holdout["primary_lambdas"], [0.2, 0.35, 0.5, 1])
        self.assertEqual(self.holdout["selected_bases"], ["B2", "B3", "B4"])
        self.assertEqual(self.holdout["excluded_demand"], ["D5", "D8"])
        self.assertTrue(self.holdout["frozen_result"]["confirmed"])
        self.assertEqual(
            self.holdout["frozen_result"]["raw_sha256"],
            "1b63e5a5c5cd14752a6e79871f7be971c642b09e7d45b88c3953f93428454112",
        )

    def test_frozen_routing_blob_identity(self):
        self.assertEqual(self.routing["dataset"], "malaga-real-routing-v1")
        self.assertEqual(git_blob_sha(ROUTING), self.holdout["routing_blob_sha"])
        self.assertEqual(
            self.holdout["routing_blob_sha"],
            "4fbfaf903988f896fd3c6e49099141a6dd810c75",
        )

    def test_preregistration_contains_frozen_rules(self):
        text = PREREG.read_text(encoding="utf-8")
        for literal in (
            "ecodispatch-real-routing-holdout-11|day|index",
            "1000",
            "K=10",
            "lambda in {0.2, 0.35, 0.5, 1}",
            "Holm",
            "B2,B3,B4",
            "malaga-real-routing-v1",
        ):
            self.assertIn(literal, text)

    def test_worker_ci_seed_gate(self):
        text = WORKER.read_text(encoding="utf-8")
        self.assertIn("ci-real-routing-holdout-", text)
        self.assertIn("testMode", text)
        self.assertIn("Real-routing holdout seed is frozen", text)


if __name__ == "__main__":
    unittest.main()
