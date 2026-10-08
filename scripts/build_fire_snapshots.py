"""Offline v1.4 catalog. Selection never imports or reads policy outcomes."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import tarfile
import xml.etree.ElementTree as ET
from rasterio.io import MemoryFile
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'web/data/fire-snapshots-v1.4.json'
PROTOCOL = ROOT / 'data/fire-dispatch-v1.4/protocol.json'
MANIFEST = ROOT / 'data/fire-dispatch-v1.4/acquisitions.json'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def rank(candidate):
    d = candidate['diversity']
    return (-d['distinct_classes'], -d['range'], -d['mean_class'],
            candidate['source']['valid_time_utc'], candidate['source']['model_time_utc'],
            candidate['source']['raster_sha256'])

def sample(raw, legend, routing):
    labels = {int(e.attrib['value']): e.attrib['label']
              for e in ET.fromstring(legend).iter('paletteEntry')}
    if not all(v in labels for v in range(1, 7)):
        raise ValueError('Incomplete six-class legend')
    with MemoryFile(raw) as mem, mem.open() as raster:
        tags = raster.tags()
        if 'UTC' not in tags.get('time_unit', ''):
            raise ValueError('Missing explicit UTC time unit')
        model = datetime.fromisoformat(tags['model_time'])
        valid = datetime.fromisoformat(tags['valid_time'])
        if valid < model or 'peligro' not in tags.get('long_name', '').lower() and 'danger' not in tags.get('long_name', '').lower():
            raise ValueError('Invalid forecast timestamp or variable')
        nodes = []
        for p in routing['points']:
            if not p['id'].startswith('D') or p['snap_distance_m'] > 500:
                continue
            xs, ys = transform('EPSG:4326', raster.crs, [p['input_lon']], [p['input_lat']])
            row, col = raster.index(xs[0], ys[0])
            if not (0 <= row < raster.height and 0 <= col < raster.width):
                raise ValueError('Outside raster: ' + p['id'])
            value = float(next(raster.sample([(xs[0], ys[0])], masked=True))[0])
            if value not in range(1, 7):
                raise ValueError('Invalid danger class at ' + p['id'])
            nodes.append(dict(id=p['id'], longitude=p['input_lon'], latitude=p['input_lat'],
                              row=row, column=col, source_value=int(value), hazard_weight=int(value),
                              label_es=labels[int(value)]))
        if len(nodes) != 10:
            raise ValueError('Expected ten eligible nodes')
        return nodes, dict(crs=raster.crs.to_string(), transform=list(raster.transform)[:6],
                           width=raster.width, height=raster.height, nodata=raster.nodata), tags, (valid-model).total_seconds()/3600

def build():
    routing_path = ROOT / 'web/data/routing-v1.0.json'
    routing = read(routing_path)
    protocol = read(PROTOCOL)
    candidates, rejected, seen = [], [], set()
    for acquisition in read(MANIFEST):
        path = ROOT / acquisition['archive']
        if sha(path.read_bytes()) != acquisition['archive_sha256']:
            raise ValueError('Archive identity mismatch: ' + str(path))
        with tarfile.open(path) as archive:
            for member in sorted(archive.getnames()):
                if not re.fullmatch(r'down_\d{8}_peligro_p_D\d{2}\.tif', member):
                    continue
                raw = archive.extractfile(member).read()
                digest = sha(raw)
                if digest in seen:
                    continue
                seen.add(digest)
                try:
                    legend = archive.extractfile(member.replace('.tif', '.qml')).read()
                    nodes, raster, tags, lead = sample(raw, legend, routing)
                except (ValueError, KeyError) as exc:
                    rejected.append(dict(archive=acquisition['archive'], member=member, reason=str(exc)))
                    continue
                values = [n['source_value'] for n in nodes]
                candidates.append(dict(id=member[:-4]+'-'+digest[:12],
                    source={**acquisition, 'member': member, 'raster_sha256': digest,
                            'legend_sha256': sha(legend), 'model_time_utc': tags['model_time']+'Z',
                            'valid_time_utc': tags['valid_time']+'Z', 'lead_hours': lead, 'tags': tags},
                    raster=raster, nodes=nodes,
                    diversity=dict(distinct_classes=len(set(values)), range=max(values)-min(values),
                                   mean_class=sum(values)/len(values),
                                   histogram={str(v): values.count(v) for v in range(1, 7)})))
    candidates.sort(key=rank)
    selected = [c['id'] for c in candidates[:protocol['selection']['top']]]
    for c in candidates:
        if c['source']['member'] == protocol['selection']['reference_member'] and c['id'] not in selected:
            selected.append(c['id'])
    if not selected:
        raise ValueError('No eligible official snapshots; refusing synthetic fallback')
    return dict(dataset='aemet-fire-snapshots-v1.4', version='1.4', confirmatory=False,
                protocol_sha256=sha(PROTOCOL.read_bytes()), acquisitions_sha256=sha(MANIFEST.read_bytes()),
                routing=dict(dataset=routing['dataset'], sha256=sha(routing_path.read_bytes())),
                selection={**protocol['selection'], 'selected_ids': selected},
                sampling='Original WGS84 coordinates; containing pixel, no interpolation; ordinal classes 1..6, not probabilities',
                limitation='Forecast validities may share one model issue. No independent historical AEMET archive was obtained. No temporal generalization or operational efficacy.',
                candidates=candidates, rejected=rejected)

if __name__ == '__main__':
    data = build()
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps([(c['source']['valid_time_utc'], c['diversity'], c['id'] in data['selection']['selected_ids']) for c in data['candidates']], indent=2))
