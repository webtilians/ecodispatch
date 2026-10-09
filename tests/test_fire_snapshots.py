import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import unittest
from rasterio.io import MemoryFile
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('fire_builder', ROOT / 'scripts/build_fire_snapshots.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class FireSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = builder.read(builder.OUTPUT)

    def test_reproduction_selection_and_lock(self):
        self.assertEqual(builder.build(), self.data)
        lock = builder.read(ROOT / 'data/fire-dispatch-v1.4/selection-lock.json')
        self.assertEqual(builder.sha(builder.OUTPUT.read_bytes()), lock['catalog_sha256'])
        self.assertEqual(self.data['selection']['selected_ids'], lock['selected_ids'])
        self.assertEqual(builder.sha(builder.PROTOCOL.read_bytes()), self.data['protocol_sha256'])
        ordered = sorted(self.data['candidates'], key=builder.rank)
        self.assertEqual(ordered, self.data['candidates'])
        selected = [c['id'] for c in ordered[:3]]
        reference = next(c for c in ordered if c['source']['member'] == self.data['selection']['reference_member'])
        if reference['id'] not in selected:
            selected.append(reference['id'])
        self.assertEqual(selected, self.data['selection']['selected_ids'])
        # Selection source must be independent of policy outcomes.
        code = (ROOT/'scripts/build_fire_snapshots.py').read_text(encoding='utf-8')
        self.assertNotIn('fire-benchmark', code)
        self.assertEqual(len(ordered), 8)
        self.assertEqual(len({c['source']['model_time_utc'] for c in ordered}), 1)

    def test_every_candidate_against_official_raster(self):
        for candidate in self.data['candidates']:
            source=candidate['source']
            path=ROOT/source['archive']
            self.assertEqual(builder.sha(path.read_bytes()), source['archive_sha256'])
            with tarfile.open(path) as archive:
                raw=archive.extractfile(source['member']).read()
                legend=archive.extractfile(source['member'].replace('.tif','.qml')).read()
            self.assertEqual(builder.sha(raw), source['raster_sha256'])
            self.assertEqual(builder.sha(legend), source['legend_sha256'])
            with MemoryFile(raw) as mem, mem.open() as raster:
                self.assertEqual(raster.tags()['valid_time']+'Z',source['valid_time_utc'])
                self.assertEqual(raster.crs.to_epsg(),4326)
                for node in candidate['nodes']:
                    row,col=raster.index(node['longitude'],node['latitude'])
                    value=float(raster.read(1,window=Window(col,row,1,1))[0,0])
                    self.assertEqual((row,col),(node['row'],node['column']))
                    self.assertEqual(value,node['source_value'])
                    self.assertEqual(value,node['hazard_weight'])
                    self.assertIn(value,range(1,7))
            values=[n['source_value'] for n in candidate['nodes']]
            self.assertEqual(len(values),10)
            self.assertEqual(candidate['diversity']['distinct_classes'],len(set(values)))
            self.assertEqual(candidate['diversity']['range'],max(values)-min(values))
            self.assertEqual(candidate['diversity']['mean_class'],sum(values)/10)
        profiles={tuple(n['source_value'] for n in c['nodes']) for c in self.data['candidates']}
        self.assertGreater(len(profiles),1)

    def test_historical_files_and_configuration_unchanged(self):
        base='9a60b8f'
        # Every preexisting data/result artifact and every engine remain byte-identical.
        tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=ROOT,text=True).splitlines()
        for rel in tracked:
            if (rel.startswith(('data/','results/','src/')) or rel.startswith('web/data/') and rel not in ['web/data/current.json','web/data/timeline.json'] or rel.endswith('-core.js') or rel in ['web/simulation.js','web/spatial-hazard.js']):
                original=subprocess.check_output(['git','show',base+':'+rel],cwd=ROOT)
                self.assertEqual((ROOT/rel).read_bytes(),original,rel)
        original=json.loads(subprocess.check_output(['git','show',base+':web/data/current.json'],cwd=ROOT))
        current=builder.read(ROOT/'web/data/current.json')
        current.pop('version');original.pop('version');current['research'].pop('fire_dispatch'); current['research'].pop('temporal_fire'); current['research'].pop('temporal_robustness'); current['research'].pop('real_fire_data'); current['research'].pop('historical_demand_replay')
        self.assertEqual(current,original)
        old_timeline=json.loads(subprocess.check_output(['git','show',base+':web/data/timeline.json'],cwd=ROOT))
        self.assertEqual(builder.read(ROOT/'web/data/timeline.json')[5:],old_timeline)

if __name__ == '__main__':
    unittest.main()
