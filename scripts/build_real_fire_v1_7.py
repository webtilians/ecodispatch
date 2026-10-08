"""Offline, deterministic EGIF extraction. Standard library only; never writes raw/."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/real-fire-v1.7'
ZIP = 'raw/egif/egif_malaga_1968_2026_consulta.zip'
VERSION = '1.7.0'
BASE_COMMIT = 'edfbd8ce7cbff8000aae8bc4326df48113eca35a'
ARRIVALS = ('llegadapmt', 'llegadapmae', 'llegadapbh', 'llegadapac')
TIMES = {'detected_at': 'deteccion', 'controlled_at': 'controlado',
         'extinguished_at': 'extinguido', **{k: k for k in ARRIVALS}}
BOUNDS = {'south': 36.2, 'north': 37.5, 'west': -5.7, 'east': -3.7}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def dumps(value, pretty=False):
    return json.dumps(value, ensure_ascii=False, allow_nan=False,
                      indent=2 if pretty else None,
                      separators=None if pretty else (',', ':')) + '\n'


def text(element, path):
    value = element.findtext(path)
    return value.strip() if value and value.strip() else None


def observed(element):
    """Retain nested/repeated observed source fields without guessing types or codes."""
    if element is None:
        return None
    if not len(element):
        return element.text.strip() if element.text and element.text.strip() else None
    result = {}
    for child in element:
        if child.tag not in result:
            result[child.tag] = []
        result[child.tag].append(observed(child))
    return {key: values[0] if len(values) == 1 else values for key, values in result.items()}


def timestamp(value):
    if value is None:
        return None, 'missing'
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', value):
        return None, 'invalid_format_or_offset'
    try:
        result = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        return None, 'impossible_datetime'
    if not 1968 <= result.year <= 2026:
        return None, 'outside_source_query_years'
    # Do not roll dates or invent a time. Explicit midnight is retained but its
    # precision is unknown; conservative interval summaries exclude it.
    return result, 'midnight_precision_unknown' if result.time().isoformat() == '00:00:00' else 'valid'


def number(value):
    if value is None or not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)', value):
        return None
    result = float(value)
    return result if math.isfinite(result) else None


def coordinates(lat_raw, lon_raw):
    lat, lon = number(lat_raw), number(lon_raw)
    if lat_raw is None or lon_raw is None:
        return None, None, 'missing_pair'
    if lat is None or lon is None:
        return None, None, 'non_numeric'
    if not (BOUNDS['south'] <= lat <= BOUNDS['north'] and BOUNDS['west'] <= lon <= BOUNDS['east']):
        return None, None, 'outside_malaga_screening_rectangle'
    return lat, lon, 'valid_rectangle_only'


def row(element):
    get = lambda path: text(element, path)
    r = {'incident_id': 'egif:' + get('idpif'), 'idpif': get('idpif'),
         'numeroparte': get('numeroparte'), 'source_year': get('pif_comun/anio'),
         'timezone': 'unknown/local-naive', 'municipality_code': get('pif_localizacion/idmunicipio'),
         'municipality_name': None, 'province_code': get('pif_localizacion/idprovincia'),
         'municipality_status': 'unresolved_official_dictionary_unavailable',
         'cause_code': get('pif_causa/idcausa'),
         'cause_certainty_code': get('pif_causa/idcertidumbrecausa'),
         'cause_actor_code': get('pif_causa/idcausante')}
    r['source_times'] = {key: get('pif_tiempos/' + source) for key, source in TIMES.items()}
    parsed = {key: timestamp(value) for key, value in r['source_times'].items()}
    r['timestamp_flags'] = {key: status for key, (_, status) in parsed.items()}
    for key, (value, _) in parsed.items():
        r[key] = value.isoformat() if value is not None else None
    r['interval_flags'] = {}
    start, start_status = parsed['detected_at']

    def interval(end_key):
        end, end_status = parsed[end_key]
        if start_status != 'valid' or end_status != 'valid':
            return None, 'endpoint_not_unambiguous'
        if end < start:
            return None, 'before_detection'
        return (end - start).total_seconds() / 60, 'valid'

    for key, end in [('detection_to_control_min', 'controlled_at'),
                     ('detection_to_extinguished_min', 'extinguished_at')]:
        r[key], r['interval_flags'][key] = interval(end)
    control, extinction = parsed['controlled_at'][0], parsed['extinguished_at'][0]
    if control is not None and extinction is not None and control > extinction:
        for key in ('detection_to_control_min', 'detection_to_extinguished_min'):
            r[key] = None
            r['interval_flags'][key] = 'control_after_extinction'
    valid_arrivals = []
    for key in ARRIVALS:
        minutes, reason = interval(key)
        value = parsed[key][0]
        if minutes is not None and extinction is not None and value > extinction:
            minutes, reason = None, 'arrival_after_extinction'
        r['interval_flags'][key] = reason
        if minutes is not None:
            valid_arrivals.append((value, key, minutes))
    first = min(valid_arrivals) if valid_arrivals else None
    r['first_arrival_at'] = first[0].isoformat() if first else None
    r['first_arrival_field'] = first[1] if first else None
    r['detection_to_first_arrival_min'] = first[2] if first else None
    r['interval_flags']['detection_to_first_arrival_min'] = 'valid' if first else 'no_valid_observed_arrival'
    r['coordinates_raw'] = {key: get('pif_localizacion/' + key)
                            for key in ('latitud', 'longitud', 'x', 'y', 'iddatum', 'huso')}
    r['latitude'], r['longitude'], r['coordinate_flag'] = coordinates(
        r['coordinates_raw']['latitud'], r['coordinates_raw']['longitud'])
    r['projected_x'] = number(r['coordinates_raw']['x'])
    r['projected_y'] = number(r['coordinates_raw']['y'])
    r['datum_code'] = r['coordinates_raw']['iddatum']
    r['zone'] = r['coordinates_raw']['huso']
    r['projection_status'] = 'original_only_no_datum_mapping_or_transformation'
    r['burned_area'] = {}
    r['burned_area_flags'] = {}
    for key in ('superficiearboladatotal', 'superficienoarboladatotal',
                'superficienoarboladaagricola', 'superficienoarboladaotras'):
        value = get('pif_perdidas/' + key)
        numeric = number(value)
        status = 'missing' if value is None else ('valid' if numeric is not None and numeric >= 0 else 'invalid')
        r['burned_area'][key] = numeric if status == 'valid' else None
        r['burned_area_flags'][key] = status
    r['burned_area_source'] = observed(element.find('pif_perdidas'))
    r['resources_observed'] = observed(element.find('pif_medios'))
    r['location_observed'] = observed(element.find('pif_localizacion'))
    return r


def summary(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return {'n': 0, 'min': None, 'median': None, 'p90': None, 'p95': None, 'max': None, 'mean': None}
    return {'n': len(values), 'min': values[0], 'median': statistics.median(values),
            'p90': values[math.ceil(.9 * len(values)) - 1],
            'p95': values[math.ceil(.95 * len(values)) - 1], 'max': values[-1],
            'mean': round(statistics.mean(values), 6)}


def overlap(rows):
    events = Counter()
    included = zero = 0
    for r in rows:
        duration = r['detection_to_extinguished_min']
        if duration is None:
            continue
        included += 1
        if duration == 0:
            zero += 1
            continue
        events[datetime.fromisoformat(r['detected_at'])] += 1
        events[datetime.fromisoformat(r['extinguished_at'])] -= 1
    active = peak = 0
    previous = None
    exposure = Counter()
    for time, change in sorted(events.items()):
        if previous is not None:
            exposure[active] += (time - previous).total_seconds() / 60
        active += change
        peak = max(peak, active)
        previous = time
    total = sum(exposure.values())
    return {'label': 'fire-active overlap; not brigade occupancy', 'interval': '[detection, extinction)',
            'included_intervals': included, 'excluded_intervals': len(rows) - included,
            'zero_length_intervals': zero, 'max_simultaneous': peak,
            'window_start': min(events).isoformat() if events else None,
            'window_end': max(events).isoformat() if events else None,
            'window_minutes': total, 'minutes_by_active_count': dict(sorted(exposure.items())),
            'fraction_window_with_two_or_more': sum(v for k, v in exposure.items() if k >= 2) / total if total else None,
            'time_weighted_mean': sum(k * v for k, v in exposure.items()) / total if total else None}


def build():
    manifest = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
    entry = next(x for x in manifest if x['file'] == ZIP)
    archive = (SOURCE / ZIP).read_bytes()
    if digest(archive) != entry['sha256']:
        raise ValueError('Source ZIP SHA-256 differs from frozen manifest')
    with zipfile.ZipFile(SOURCE / ZIP) as z:
        members = [name for name in z.namelist() if name.lower().endswith('.xml')]
        if len(members) != 1:
            raise ValueError('Expected exactly one XML member')
        xml = z.read(members[0])
    rows = [row(e) for e in ET.fromstring(xml).findall('Pif')]
    if len(rows) != 7496 or len({r['incident_id'] for r in rows}) != 7496:
        raise ValueError('Unexpected incident count or duplicate identity')
    provenance = {'builder_version': VERSION, 'builder_sha256': digest(Path(__file__).read_bytes().replace(b'\r\n', b'\n')),
                  'source_base_commit': BASE_COMMIT, 'source': entry, 'xml_member': members[0],
                  'xml_sha256': digest(xml), 'imputation': False, 'rediam_join': False,
                  'rules': 'docs/real-fire-v1.7.md', 'timezone': 'unknown/local-naive',
                  'coordinate_screening_bounds': BOUNDS, 'quantile_method': 'nearest rank',
                  'midnight_policy': 'retain timestamp; exclude from intervals and hour histogram; date bins retained'}
    dates = [datetime.fromisoformat(r['detected_at']) for r in rows if r['detected_at']]
    hours = [datetime.fromisoformat(r['detected_at']).hour for r in rows if r['timestamp_flags']['detected_at'] == 'valid']
    def hist(values, keys):
        counts = Counter(values)
        return {str(k): counts[k] for k in keys}
    fields = list(TIMES) + ['latitude', 'longitude', 'municipality_name', 'municipality_code',
                            'cause_code', 'cause_certainty_code', 'cause_actor_code', 'projected_x', 'projected_y',
                            'datum_code', 'zone', 'first_arrival_at', 'detection_to_control_min',
                            'detection_to_extinguished_min', 'detection_to_first_arrival_min']
    audit = {'provenance': provenance, 'total_parts': len(rows),
             'year_range': [min(d.year for d in dates), max(d.year for d in dates)],
             'timestamp_status_counts': {key: dict(sorted(Counter(r['timestamp_flags'][key] for r in rows).items())) for key in TIMES},
             'valid_calendar_timestamps': {key: sum(r[key] is not None for r in rows) for key in TIMES},
             'valid_coordinates': sum(r['latitude'] is not None for r in rows),
             'coordinate_status_counts': dict(Counter(r['coordinate_flag'] for r in rows)),
             'valid_first_arrival': sum(r['first_arrival_at'] is not None for r in rows),
             'by_year': hist((d.year for d in dates), range(1968, 2024)),
             'by_month': hist((d.month for d in dates), range(1, 13)),
             'by_hour': hist(hours, range(24)),
             'by_day_of_week_monday_zero': hist((d.weekday() for d in dates), range(7)),
             'hour_histogram_n': len(hours), 'date_histogram_n': len(dates),
             'summaries_minutes': {key: summary(r[key] for r in rows) for key in fields if key.endswith('_min')},
             'fire_active_overlap': overlap(rows),
             'missingness': {key: {'null': sum(r[key] is None for r in rows), 'total': len(rows)} for key in fields},
             'interval_reason_counts': {key: dict(sorted(Counter(r['interval_flags'][key] for r in rows).items())) for key in rows[0]['interval_flags']},
             'geographic_coverage': {'screening_only_not_province_polygon': True,
                 'latitude_range': [min(r['latitude'] for r in rows if r['latitude'] is not None), max(r['latitude'] for r in rows if r['latitude'] is not None)],
                 'longitude_range': [min(r['longitude'] for r in rows if r['longitude'] is not None), max(r['longitude'] for r in rows if r['longitude'] is not None)],
                 'by_year': {str(y): {'parts': sum(r['source_year'] == str(y) for r in rows),
                                     'coordinates': sum(r['source_year'] == str(y) and r['latitude'] is not None for r in rows)} for y in range(1968, 2024)},
                 'municipality_codes_raw': dict(sorted(Counter(r['municipality_code'] for r in rows).items()))}}
    # Counts of nested areas and resources are source-path based, including repeats.
    for section in ('burned_area', 'resources_observed'):
        paths = defaultdict(list)
        def walk(value, path, acc):
            if isinstance(value, dict):
                for key, item in value.items():
                    walk(item, path + '/' + key, acc)
            elif isinstance(value, list):
                for item in value:
                    walk(item, path, acc)
            else:
                acc[path].append(value)
        per_row = []
        for r in rows:
            acc = defaultdict(list)
            walk(r[section], section, acc)
            per_row.append(acc)
            for path in acc:
                paths[path] = None
        for path in sorted(paths):
            audit['missingness'][path] = {'null': sum(not any(v is not None for v in acc.get(path, [])) for acc in per_row), 'total': len(rows)}
    return rows, audit


def artifacts():
    rows, audit = build()
    report = '# EGIF Málaga v1.7 — reproducible audit\n\n'
    report += 'Descriptive archive only. No parameter tuning or dispatch integration.\n\n'
    report += f"Parts: {len(rows)}. Years: {audit['year_range']}. Valid coordinates: {audit['valid_coordinates']}. Valid first arrival: {audit['valid_first_arrival']}.\n\n"
    report += 'Full audit below includes distributions, exclusions, missingness, provenance and fire-active overlap (not brigade occupancy). All durations are minutes. Midnight ambiguity excludes intervals; it is not repaired.\n\n```json\n' + dumps(audit, True) + '```\n'
    return {'web/data/real-fire-incidents-v1.7.json': dumps({'provenance': audit['provenance'], 'incidents': rows}),
            'web/data/real-fire-summary-v1.7.json': dumps(audit, True),
            'results/real-fire-v1.7-audit.md': report}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for path, content in artifacts().items():
        target = ROOT / path
        if args.check:
            if not target.exists() or target.read_bytes() != content.encode('utf-8'):
                raise SystemExit('Rebuild differs: ' + path)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode('utf-8'))
        print(path)


if __name__ == '__main__':
    main()
