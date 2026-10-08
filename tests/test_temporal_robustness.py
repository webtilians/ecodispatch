import json
import math
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
P=json.loads((ROOT/"data/temporal-robustness-v1.6/protocol.json").read_text(encoding="utf-8"))
R=json.loads((ROOT/"web/data/temporal-robustness-v1.6.json").read_text(encoding="utf-8"))

class TemporalRobustnessV16Tests(unittest.TestCase):
    def test_protocol_fixed_grid(self):
        self.assertEqual(P["version"],"1.6")
        self.assertFalse(P["confirmatory"])
        self.assertEqual(P["service_minutes"],[45,90,180])
        self.assertEqual(P["harm_k"],[10,60,120])
        self.assertEqual(R["design_commit"],"494e07b0a72da72669d05527c29c32404e391390")
        self.assertEqual(len(R["conditions"]),18)
        for severity in (2,2.5,3,4,4.999):
            self.assertGreaterEqual(60*severity*severity,120*severity)

    def test_condition_integrity(self):
        seen=set()
        for c in R["conditions"]:
            key=(c["snapshotId"],c["regime"],c["serviceMinutes"])
            self.assertNotIn(key,seen)
            seen.add(key)
            self.assertIn(c["regime"],("low","high"))
            self.assertIn(c["serviceMinutes"],(45,90,180))
            self.assertEqual(set(c["harm"]),{"10","60","120"})
            for k in ("10","60","120"):
                for policy in ("0","0.2","0.35","0.5","1","eta-greedy","distance-greedy"):
                    h=c["harm"][k][policy]
                    self.assertTrue(math.isfinite(h["absolute"]["mean"]))
                    self.assertTrue(math.isfinite(h["versusZero"]["mean"]))
            for policy in ("0","0.2","0.35","0.5","1","eta-greedy","distance-greedy"):
                op=c["operational"][policy]
                self.assertGreaterEqual(op["coverage"]["mean"],0)
                self.assertLessEqual(op["coverage"]["mean"],1)

    def test_prefixed_robustness_labels(self):
        expected={
            "10":{"0.2":(12,6,0,2),"1":(0,1,17,0)},
            "60":{"0.2":(12,6,0,2),"1":(0,0,18,0)},
            "120":{"0.2":(11,7,0,2),"1":(0,1,17,0)},
        }
        for k,policies in expected.items():
            for policy,(neg,inc,pos,groups) in policies.items():
                x=R["robustness"][k][policy]
                self.assertEqual((x["negativeCells"],x["inconclusiveCells"],x["positiveCells"],x["serviceRobustNegativeGroups"]),(neg,inc,pos,groups))
                self.assertEqual(x["negativeCells"]+x["inconclusiveCells"]+x["positiveCells"],18)
        self.assertFalse(R["robustness"]["60"]["0.2"]["globalServiceRobustNegative"])

if __name__=="__main__":
    unittest.main()
