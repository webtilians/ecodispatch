import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import unittest
import rasterio
from rasterio.io import MemoryFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/build_spatial_hazard.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class SpatialHazardTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(builder.OUTPUT.read_text(encoding='utf-8'))

    def test_exact_offline_reproduction(self):
        self.assertEqual(json.loads(json.dumps(builder.build())), self.data)
        self.assertEqual(self.data['source']['archive_sha256'], hashlib.sha256(builder.ARCHIVE.read_bytes()).hexdigest())
        self.assertEqual(self.data['dataset'], 'aemet-malaga-spatial-hazard-v1.3')
        self.assertEqual(self.data['source']['valid_time_utc'], '2026-10-08T12:00:00Z')
        self.assertEqual(self.data['source']['model_time_utc'], '2026-10-07T12:00:00Z')

    def test_geospatial_integrity_and_source_values(self):
        with tarfile.open(builder.ARCHIVE) as archive:
            raw = archive.extractfile(builder.MEMBER).read()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), self.data['source']['raster_sha256'])
        with MemoryFile(raw) as mem, mem.open() as raster:
            self.assertEqual(raster.crs.to_epsg(), 4326)
            self.assertEqual((raster.width, raster.height), (1541, 922))
            for n in self.data['nodes']:
                row, col = raster.index(n['longitude'], n['latitude'])
                self.assertEqual((row, col), (n['row'], n['column']))
                self.assertTrue(0 <= row < raster.height and 0 <= col < raster.width)
                # Independent direct band read, not the builder's sample API.
                value = float(raster.read(1, window=rasterio.windows.Window(col,row,1,1))[0,0])
                self.assertEqual(value, n['source_value'])
                self.assertEqual(value, n['hazard_weight'])
                self.assertIn(value, range(1,7))
                west, north = raster.transform * (col,row)
                east, south = raster.transform * (col+1,row+1)
                self.assertTrue(west <= n['longitude'] < east)
                self.assertTrue(south < n['latitude'] <= north)
        self.assertEqual([n['id'] for n in self.data['nodes']], ['D0','D1','D2','D3','D4','D6','D7','D9','D10','D11'])
        self.assertEqual([n['id'] for n in self.data['nodes'] if n['source_value']==2], ['D7','D11'])

    def test_historical_datasets_engines_and_configuration_unchanged(self):
        base='17ce322'
        for rel in ['web/data/routing-v1.0.json','web/data/aemet-malaga-fwi-2025.json',
                    'web/data/holdout-v0.9.1-frozen.json','web/data/real-routing-holdout-v1.1.1-frozen.json',
                    'web/simulation.js','web/ablation-core.js','web/holdout-core.js',
                    'web/real-routing-core.js','web/real-routing-holdout-core.js','web/real-hazard.js']:
            old=subprocess.check_output(['git','show',base+':'+rel],cwd=ROOT)
            self.assertEqual((ROOT/rel).read_bytes().replace(b'\r\n',b'\n'),old,rel)
        old=json.loads(subprocess.check_output(['git','show',base+':web/data/current.json'],cwd=ROOT))
        new=json.loads((ROOT/'web/data/current.json').read_text(encoding='utf-8'))
        new.pop('version'); old.pop('version'); new['research'].pop('spatial_hazard'); new['research'].pop('fire_dispatch')
        self.assertEqual(new,old)

if __name__ == '__main__':
    unittest.main()
