"""Read-only verification of original payloads and optional ZIP containers."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
for item in manifest:
    if 'storage_file' in item:
        storage = root / item['storage_file']
        assert storage.stat().st_size == item['storage_size_bytes'], storage
        with storage.open('rb') as handle:
            assert hashlib.file_digest(handle, 'sha256').hexdigest() == item['storage_sha256'], storage
        with zipfile.ZipFile(storage) as archive:
            payload = archive.read(item['archive_member'])
    else:
        payload = (root / item['file']).read_bytes()
    assert len(payload) == item['size_bytes'], item['file']
    assert hashlib.sha256(payload).hexdigest() == item['sha256'], item['file']
print(f'OK: {len(manifest)} original payloads verified, including archive members.')
