import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTING = ROOT / "web" / "data" / "routing-v1.0.json"


class RealRoutingDatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(ROUTING.read_text(encoding="utf-8"))

    def test_matrix_shape_nonnegative_and_zero_diagonal(self):
        n = len(self.data["points"])
        self.assertEqual(n, 20)
        for name in ("durations_s", "distances_m"):
            matrix = self.data[name]
            self.assertEqual(len(matrix), n)
            for i, row in enumerate(matrix):
                self.assertEqual(len(row), n)
                self.assertEqual(row[i], 0)
                self.assertTrue(all(value is not None and value >= 0 for value in row))

    def test_matrix_retains_directionality(self):
        m = self.data["durations_s"]
        self.assertTrue(any(abs(m[i][j] - m[j][i]) > 1e-6
                            for i in range(len(m))
                            for j in range(i + 1, len(m))))

    def test_snap_quality_gate_inputs(self):
        points = {p["id"]: p for p in self.data["points"]}
        excluded = sorted(
            p["id"] for p in self.data["points"]
            if p["role"] == "demand_node" and p["snap_distance_m"] > 500
        )
        self.assertEqual(excluded, ["D5", "D8"])
        self.assertLessEqual(points["B6"]["snap_distance_m"], 500)

    def test_provenance(self):
        self.assertEqual(self.data["source"]["network_data"], "OpenStreetMap")
        self.assertEqual(self.data["source"]["osm_license"], "ODbL")
        self.assertEqual(self.data["source"]["routing_engine"], "OSRM")


if __name__ == "__main__":
    unittest.main()
