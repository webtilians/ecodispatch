import importlib.util
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/build_real_fire_v1_7.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class RealFireTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows, cls.audit = b.build()

    def test_count_identity_and_coverage(self):
        self.assertEqual(len(self.rows), 7496)
        self.assertEqual(len({r['incident_id'] for r in self.rows}), 7496)
        self.assertEqual(self.audit['year_range'], [1968, 2023])
        self.assertTrue(all(r['province_code'] == '29' for r in self.rows))
        for key in ('by_month', 'by_year', 'by_day_of_week_monday_zero'):
            self.assertEqual(sum(self.audit[key].values()), 7496)
        self.assertEqual(sum(self.audit['by_hour'].values()), self.audit['hour_histogram_n'])

    def test_rebuild_is_deterministic_and_versioned(self):
        first = b.artifacts()
        self.assertEqual(first, b.artifacts())
        for path, content in first.items():
            self.assertEqual((ROOT / path).read_bytes(), content.encode('utf-8'), path)
        self.assertLess((ROOT / 'web/data/real-fire-summary-v1.7.json').stat().st_size, 50000)

    def test_nulls_and_explicit_zero(self):
        r = self.rows[0]
        self.assertIsNone(r['controlled_at'])
        self.assertIsNone(r['latitude'])
        self.assertIsNone(r['municipality_name'])
        self.assertEqual(r['burned_area']['superficiearboladatotal'], 0)
        self.assertIsNone(r['burned_area']['superficienoarboladaotras'])
        self.assertEqual(r['municipality_code'], '0')
        self.assertEqual(b.observed(ET.fromstring('<x><y/><y>0</y></x>')), {'y': [None, '0']})

    def test_strict_datetimes(self):
        for value in (None, '', '2020-02-30T12:00:00', '2020-01-01', '2020-01-01T24:00:00',
                      '2020-01-01T12:00:00Z', '2020-1-1T12:00:00', '0001-01-01T12:00:00'):
            self.assertIsNone(b.timestamp(value)[0])
        value, flag = b.timestamp('2020-01-01T00:00:00')
        self.assertEqual(value.hour, 0)
        self.assertEqual(flag, 'midnight_precision_unknown')

    def test_intervals_and_earliest_arrival(self):
        for r in self.rows:
            for key, end in [('detection_to_control_min', 'controlled_at'),
                             ('detection_to_extinguished_min', 'extinguished_at'),
                             ('detection_to_first_arrival_min', 'first_arrival_at')]:
                if r[key] is not None:
                    self.assertGreaterEqual(r[key], 0)
                    self.assertLessEqual(r['detected_at'], r[end])
                    start_dt, _ = b.timestamp(r['detected_at'])
                    end_dt, _ = b.timestamp(r[end])
                    self.assertEqual(r[key], (end_dt - start_dt).total_seconds() / 60)
            if r['first_arrival_at']:
                values = [r[k] for k in b.ARRIVALS if r['interval_flags'][k] == 'valid']
                self.assertEqual(r['first_arrival_at'], min(values))
                if r['extinguished_at']:
                    self.assertLessEqual(r['first_arrival_at'], r['extinguished_at'])
            if r['detection_to_control_min'] is not None and r['extinguished_at']:
                self.assertLessEqual(r['controlled_at'], r['extinguished_at'])

    def test_synthetic_bad_order_and_midnight(self):
        def record(times):
            return b.row(ET.fromstring('<Pif><idpif>1</idpif><numeroparte>2</numeroparte><pif_tiempos>' + times + '</pif_tiempos></Pif>'))
        r = record('<deteccion>2020-01-01T12:00:00</deteccion><controlado>2020-01-01T11:00:00</controlado><llegadapmt>2020-01-01T11:30:00</llegadapmt>')
        self.assertIsNone(r['detection_to_control_min'])
        self.assertEqual(r['interval_flags']['detection_to_control_min'], 'before_detection')
        self.assertIsNone(r['first_arrival_at'])
        r = record('<deteccion>2020-01-01T12:00:00</deteccion><extinguido>2020-01-01T13:00:00</extinguido><controlado>2020-01-01T14:00:00</controlado><llegadapmt>2020-01-02T00:00:00</llegadapmt><llegadapmae>2020-01-01T14:00:00</llegadapmae>')
        self.assertIsNone(r['detection_to_extinguished_min'])
        self.assertIsNone(r['first_arrival_at'])
        self.assertEqual(r['interval_flags']['llegadapmae'], 'arrival_after_extinction')

    def test_coordinate_bounds(self):
        for pair in [('NaN', '-4'), ('Infinity', '-4'), ('0', '0'), ('40', '-4'), (None, '-4')]:
            self.assertIsNone(b.coordinates(*pair)[0])
        self.assertEqual(b.coordinates('36.8', '-4.3')[:2], (36.8, -4.3))
        for r in self.rows:
            self.assertEqual(r['latitude'] is None, r['longitude'] is None)
            if r['latitude'] is not None:
                self.assertTrue(36.2 <= r['latitude'] <= 37.5)
                self.assertTrue(-5.7 <= r['longitude'] <= -3.7)

    def test_overlap_half_open(self):
        rows = [{'detected_at': '2020-01-01T10:00:00', 'extinguished_at': '2020-01-01T11:00:00', 'detection_to_extinguished_min': 60},
                {'detected_at': '2020-01-01T11:00:00', 'extinguished_at': '2020-01-01T12:00:00', 'detection_to_extinguished_min': 60}]
        self.assertEqual(b.overlap(rows)['max_simultaneous'], 1)
        self.assertEqual(b.overlap(rows)['minutes_by_active_count'], {1: 120})

    def test_frozen_originals_and_v16_bytes(self):
        frozen = json.loads((ROOT / 'data/real-fire-v1.7/derived-regression-sha256.json').read_text())
        for path, sha in frozen['files'].items():
            self.assertEqual(b.digest((ROOT / path).read_bytes()), sha, path)


if __name__ == '__main__':
    unittest.main()
