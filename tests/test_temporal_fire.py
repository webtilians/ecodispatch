import json
import math
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
P=json.loads((ROOT/"data/temporal-fire-v1.5/protocol.json").read_text(encoding="utf-8"))
R=json.loads((ROOT/"web/data/temporal-fire-v1.5.json").read_text(encoding="utf-8"))

class TemporalFireV15Tests(unittest.TestCase):
    def test_fixed_design_identity(self):
        self.assertEqual(P["version"],"1.5")
        self.assertFalse(P["confirmatory"])
        self.assertEqual(P["service_minutes"],90)
        self.assertEqual(P["deadline_min"],120)
        self.assertEqual([(x["id"],x["events_per_24h"]) for x in P["arrival_process"]["regimes"]],[("low",12),("high",36)])
        self.assertEqual(R["design_commit"],"1b1a3836503384392565a06703b50d45c14dfd18")
        self.assertEqual(len(R["snapshots"]),6)

    def test_metric_invariants(self):
        for cell in R["snapshots"]:
            self.assertIn(cell["regime"],{"low","high"})
            self.assertEqual(len(cell["summary"]),7)
            for policy in cell["summary"]:
                a=policy["absolute"]
                for key in ("eventCount","served","unserved","coverage","distance","co2Kg","totalHarm","utilizationMean"):
                    self.assertTrue(math.isfinite(a[key]["mean"]), (cell["snapshotId"],policy["id"],key))
                self.assertGreaterEqual(a["coverage"]["mean"],0)
                self.assertLessEqual(a["coverage"]["mean"],1)
                free=sum(a[f"free{i}Share"]["mean"] for i in range(4))
                self.assertAlmostEqual(free,1.0,places=9)

    def test_load_really_creates_congestion(self):
        by={}
        for cell in R["snapshots"]:
            by[(cell["snapshotId"],cell["regime"])]=cell
        for sid in P["frozen_inputs"]["snapshot_ids"]:
            low=next(x for x in by[(sid,"low")]["summary"] if x["id"]=="0")["absolute"]
            high=next(x for x in by[(sid,"high")]["summary"] if x["id"]=="0")["absolute"]
            self.assertGreater(high["eventCount"]["mean"],low["eventCount"]["mean"])
            self.assertGreater(high["utilizationMean"]["mean"],low["utilizationMean"]["mean"])
            self.assertGreater(high["arrivalsAllBusy"]["mean"],low["arrivalsAllBusy"]["mean"])
            self.assertLess(high["coverage"]["mean"],low["coverage"]["mean"])

    def test_descriptive_lambda_pattern(self):
        p02=[];p1=[]
        for cell in R["snapshots"]:
            p02.append(next(x for x in cell["summary"] if x["id"]=="0.2")["versusZero"]["totalHarm"])
            p1.append(next(x for x in cell["summary"] if x["id"]=="1")["versusZero"]["totalHarm"])
        self.assertTrue(all(x["mean"]<0 for x in p02))
        self.assertEqual(sum(x["bootstrap"]["ciHigh"]<0 for x in p02),5)
        self.assertTrue(all(x["mean"]>0 and x["bootstrap"]["ciLow"]>0 for x in p1))

if __name__=="__main__":
    unittest.main()
