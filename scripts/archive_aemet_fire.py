"""Explicit acquisition only; does not refresh a frozen catalog or benchmark.

Run once before locking an experiment. Later captures require a new experiment
manifest/version. Raw bytes are content-addressed and never overwritten.
"""
import argparse
from datetime import datetime, timezone
import io
import json
import tarfile
import urllib.request
from build_fire_snapshots import ROOT, MANIFEST, sha, read

URL = 'https://www.aemet.es/es/api-eltiempo/incendios/download'

def acquire():
    with urllib.request.urlopen(URL, timeout=60) as response:
        raw = response.read()
        final_url = response.url
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        if not any('_peligro_p_' in n and n.endswith('.tif') for n in archive.getnames()):
            raise ValueError('No Peninsula danger GeoTIFF in response')
    digest = sha(raw)
    manifest = read(MANIFEST)
    if any(a['archive_sha256'] == digest for a in manifest):
        print('Already archived; no new model or invented acquisition date: ' + digest)
        return
    path = ROOT / ('data/fire-dispatch-v1.4/aemet-'+digest+'.tar.gz')
    if not path.exists():
        path.write_bytes(raw)
    manifest.append(dict(publisher='AEMET', url=URL, final_url=final_url,
                         retrieved_at_utc=datetime.now(timezone.utc).isoformat(),
                         archive=path.relative_to(ROOT).as_posix(), archive_sha256=digest))
    MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8', newline='\n')
    print('Archived official bytes: ' + str(path))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--acquire', action='store_true', required=True)
    parser.parse_args()
    if (ROOT / 'data/fire-dispatch-v1.4/selection-lock.json').exists():
        raise SystemExit('v1.4 selection is locked. Use a new manifest/version for future acquisitions.')
    acquire()
