import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "data" / "aemet-malaga-fwi-2025.json"
CURRENT = ROOT / "web" / "data" / "current.json"


class RealHazardV12Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(DATA.read_text(encoding="utf-8"))
        cls.current = json.loads(CURRENT.read_text(encoding="utf-8"))

    def test_official_scope_and_source(self):
        self.assertEqual(self.data["dataset"], "aemet-malaga-fire-weather-2025")
        self.assertEqual(self.data["scope"]["province"], "Málaga")
        self.assertEqual(self.data["scope"]["year"], 2025)
        self.assertEqual(self.data["scope"]["spatial_resolution"], "province")
        self.assertEqual(
            self.data["source"]["publisher"],
            "AEMET - Agencia Estatal de Meteorología",
        )

    def test_calendar_values(self):
        cal = self.data["hazard_calendar"]
        self.assertEqual(len(cal["months"]), 12)
        months = {m["month"]: m for m in cal["months"]}
        self.assertAlmostEqual(months["jul"]["high_or_worse_pct"], 87.10)
        self.assertAlmostEqual(months["aug"]["high_or_worse_pct"], 87.10)
        self.assertAlmostEqual(months["aug"]["extreme_pct"], 25.81)
        self.assertAlmostEqual(cal["annual"]["high_or_worse_pct"], 25.21)
        self.assertAlmostEqual(cal["annual"]["extreme_pct"], 4.66)

    def test_no_false_spatial_integration(self):
        hazard = self.current["research"]["real_hazard"]
        self.assertFalse(hazard["integrated_into_dispatch"])
        self.assertEqual(hazard["spatial_resolution"], "province")
        self.assertIn(
            "not node-level",
            self.data["scope"]["role"],
        )
        self.assertIn(
            "not incident probabilities",
            self.data["hazard_calendar"]["definition"]["warning"],
        )


if __name__ == "__main__":
    unittest.main()
