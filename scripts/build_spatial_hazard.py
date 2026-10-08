"""Offline, deterministic v1.3 extraction. Never refresh the frozen input implicitly."""
from pathlib import Path
import hashlib
import json
import tarfile
import xml.etree.ElementTree as ET
from rasterio.io import MemoryFile
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'data/spatial-hazard-v1.3/aemet-20261007.tar.gz'
MEMBER = 'down_20261007_peligro_p_D01.tif'
OUTPUT = ROOT / 'web/data/spatial-hazard-v1.3.json'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def build():
    routing_bytes = (ROOT / 'web/data/routing-v1.0.json').read_bytes()
    routing = json.loads(routing_bytes)
    with tarfile.open(ARCHIVE) as archive:
        raw = archive.extractfile(MEMBER).read()
        qml = archive.extractfile(MEMBER.replace('.tif', '.qml')).read()
    labels = {int(e.attrib['value']): e.attrib['label']
              for e in ET.fromstring(qml).iter('paletteEntry')}
    with MemoryFile(raw) as mem, mem.open() as raster:
        tags = raster.tags()
        nodes = []
        for point in routing['points']:
            if not point['id'].startswith('D') or point['snap_distance_m'] > 500:
                continue
            lon, lat = point['input_lon'], point['input_lat']
            xs, ys = transform('EPSG:4326', raster.crs, [lon], [lat])
            x, y = xs[0], ys[0]
            row, col = raster.index(x, y)
            if not (0 <= row < raster.height and 0 <= col < raster.width):
                raise ValueError('Node outside raster: ' + point['id'])
            value = float(next(raster.sample([(x, y)], masked=True))[0])
            if value not in labels:
                raise ValueError('Invalid/non-land danger class: ' + repr(value))
            nodes.append(dict(id=point['id'], longitude=lon, latitude=lat,
                              raster_x=x, raster_y=y, row=row, column=col,
                              source_value=value, hazard_weight=value,
                              label_es=labels[value]))
        return dict(
            dataset='aemet-malaga-spatial-hazard-v1.3', version='1.3',
            source=dict(publisher='AEMET',
                        url='https://www.aemet.es/es/api-eltiempo/incendios/download',
                        documentation='https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda',
                        license_url='https://www.aemet.es/es/nota_legal',
                        reuse='© AEMET. Reproduction and use authorized with attribution to AEMET.',
                        retrieved_at_utc='2026-10-08T15:40:05Z',
                        retrieval_time_precision='second (local download completion; not model time)',
                        archive=str(ARCHIVE.relative_to(ROOT)).replace('\\', '/'),
                        archive_sha256=sha(ARCHIVE.read_bytes()), member=MEMBER,
                        raster_sha256=sha(raw), legend_sha256=sha(qml),
                        model_time_utc=tags['model_time']+'Z',
                        valid_time_utc=tags['valid_time']+'Z',
                        lead_hours=24, variable=tags['long_name'], tags=tags),
            raster=dict(crs=raster.crs.to_string(), width=raster.width,
                        height=raster.height, bands=raster.count, dtype=raster.dtypes[0],
                        transform=list(raster.transform)[:6], bounds=list(raster.bounds),
                        pixel_size_degrees=list(raster.res),
                        nominal_resolution='1 km (AEMET); geographic grid 0.01 degrees',
                        nodata=raster.nodata, rejected_codes=[0,255]),
            sampling=dict(input_crs='EPSG:4326', axis_order='x=longitude, y=latitude',
                          method='Containing pixel, floor inverse affine; no interpolation or resampling',
                          coordinates='Original demand coordinates, not road-snapped coordinates',
                          transformation='EPSG:4326 to EPSG:4326 identity',
                          normalization='None: hazard_weight = source_value; ordinal surrogate only',
                          classes=labels),
            routing=dict(dataset=routing['dataset'], sha256=sha(routing_bytes),
                         max_snap_m=500, excluded=['D5','D8']), nodes=nodes)

if __name__ == '__main__':
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(OUTPUT)
