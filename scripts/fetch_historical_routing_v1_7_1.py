#!/usr/bin/env python3
"""Acquire and freeze the sparse OSRM routing layer required by v1.7.1.

This script does not execute any EcoDispatch policy. It only maps the already
frozen historical-demand cohort onto current OSM/OSRM driving routes.
"""
from __future__ import annotations

from collections import defaultdict
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import statistics
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ROUTING_V10 = ROOT / "web/data/routing-v1.0.json"
COHORT_BUILDER = ROOT / "scripts/build_historical_demand_v1_7_1.py"
COHORT_FREEZE = ROOT / "data/historical-demand-v1.7.1/cohort-freeze.json"
PROTOCOL = ROOT / "data/historical-demand-v1.7.1/protocol.json"
OUTPUT = ROOT / "data/historical-demand-v1.7.1/routing.json"
FREEZE_OUTPUT = ROOT / "data/historical-demand-v1.7.1/routing-freeze.json"
REPORT = ROOT / "results/historical-routing-v1.7.1-audit.md"

OSRM_BASE = "https://router.project-osrm.org"
USER_AGENT = "EcoDispatch-v1.7.1-research/1.0 (https://github.com/webtilians/ecodispatch)"
CHUNK_LIMIT = 70
REQUEST_PAUSE_S = 0.15


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def dump(value, pretty=False) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"


def load_cohort_builder():
    spec = importlib.util.spec_from_file_location("historical_demand_v171", COHORT_BUILDER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def day_chunks(events, limit=CHUNK_LIMIT):
    by_day = defaultdict(list)
    for event in events:
        by_day[event["date"]].append(event)
    result, current = [], []
    for day in sorted(by_day):
        group = by_day[day]
        if current and len(current) + len(group) > limit:
            result.append(current)
            current = []
        current.extend(group)
    if current:
        result.append(current)
    if any(len(group) > limit for group in result):
        raise ValueError("day chunk exceeds limit")
    return result


def table(points, sources=None, destinations=None, retries=5):
    coords = ";".join(f"{p['longitude']:.12f},{p['latitude']:.12f}" for p in points)
    query = {"annotations": "duration,distance"}
    if sources is not None:
        query["sources"] = ";".join(str(x) for x in sources)
    if destinations is not None:
        query["destinations"] = ";".join(str(x) for x in destinations)
    url = f"{OSRM_BASE}/table/v1/driving/{coords}?{urllib.parse.urlencode(query)}"

    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=90) as response:
                raw = json.load(response)
            if raw.get("code") != "Ok":
                raise RuntimeError(f"OSRM {raw.get('code')}: {raw.get('message')}")
            time.sleep(REQUEST_PAUSE_S)
            return raw
        except Exception as exc:
            last = exc
            if attempt + 1 >= retries:
                break
            time.sleep(1.5 * (2 ** attempt))
    raise RuntimeError(f"OSRM request failed after {retries} attempts: {last}")


def finite_route(duration, distance, label):
    if not all(isinstance(x, (int, float)) and math.isfinite(x) and x >= 0
               for x in (duration, distance)):
        raise ValueError(f"Missing/invalid route: {label}")
    return [round(float(duration), 6), round(float(distance), 3)]


def quantiles(values):
    values = sorted(values)
    if not values:
        return {"n": 0, "min": None, "median": None, "p95": None, "max": None, "mean": None}
    return {
        "n": len(values),
        "min": values[0],
        "median": statistics.median(values),
        "p95": values[math.ceil(.95 * len(values)) - 1],
        "max": values[-1],
        "mean": round(statistics.mean(values), 3),
    }


def acquire():
    protocol = json.loads(PROTOCOL.read_text(encoding="utf-8"))
    cohort_freeze = json.loads(COHORT_FREEZE.read_text(encoding="utf-8"))
    cohort = load_cohort_builder().build()
    routing_bytes = ROUTING_V10.read_bytes()
    routing = json.loads(routing_bytes)

    if cohort["counts"]["primary_events"] != cohort_freeze["counts"]["primary_events"]:
        raise ValueError("Cohort differs from pre-outcome freeze")
    if protocol["routing_extension"]["status"] != "must be frozen before any policy outcomes are generated":
        raise ValueError("Routing protocol status changed")

    points = {p["id"]: p for p in routing["points"]}
    base_ids = ["B2", "B3", "B4"]
    potential_ids = [
        p["id"] for p in routing["points"]
        if p["role"] == "demand_node" and p["snap_distance_m"] <= 500
    ]
    if len(potential_ids) != 10:
        raise ValueError(f"Expected ten inherited potential nodes, got {len(potential_ids)}")

    def inherited(pid):
        p = points[pid]
        return {
            "id": pid,
            "latitude": p["input_lat"],
            "longitude": p["input_lon"],
        }

    bases = [inherited(pid) for pid in base_ids]
    potential = [inherited(pid) for pid in potential_ids]
    events = [
        {
            "id": e["incident_id"],
            "date": e["date"],
            "latitude": e["latitude"],
            "longitude": e["longitude"],
        }
        for e in cohort["events"]
    ]

    snaps = {}

    def register_snap(pid, input_point, waypoint):
        location = waypoint.get("location")
        distance = waypoint.get("distance")
        if (not isinstance(location, list) or len(location) != 2
                or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in location)
                or not isinstance(distance, (int, float)) or not math.isfinite(distance)
                or distance < 0):
            raise ValueError(f"Invalid OSRM snap for {pid}")
        observed = {
            "input_lat": input_point["latitude"],
            "input_lon": input_point["longitude"],
            "snapped_lat": location[1],
            "snapped_lon": location[0],
            "snap_distance_m": round(float(distance), 3),
        }
        prior = snaps.get(pid)
        if prior is not None:
            if (abs(prior["snapped_lat"] - observed["snapped_lat"]) > 1e-7
                    or abs(prior["snapped_lon"] - observed["snapped_lon"]) > 1e-7
                    or abs(prior["snap_distance_m"] - observed["snap_distance_m"]) > 0.05):
                raise ValueError(f"Inconsistent OSRM snap during acquisition: {pid}")
        else:
            snaps[pid] = observed

    base_to_event = []
    for batch in chunks(events, CHUNK_LIMIT):
        request_points = bases + batch
        raw = table(
            request_points,
            sources=list(range(len(bases))),
            destinations=list(range(len(bases), len(request_points))),
        )
        if len(raw["sources"]) != len(bases) or len(raw["destinations"]) != len(batch):
            raise ValueError("Unexpected base-to-event OSRM shape")
        for i, base in enumerate(bases):
            register_snap(base["id"], base, raw["sources"][i])
        for j, event in enumerate(batch):
            register_snap(event["id"], event, raw["destinations"][j])
            for i, base in enumerate(bases):
                duration = raw["durations"][i][j]
                distance = raw["distances"][i][j]
                d, m = finite_route(duration, distance, f"{base['id']}->{event['id']}")
                base_to_event.append([base["id"], event["id"], d, m])

    event_to_potential = []
    for batch in chunks(events, CHUNK_LIMIT):
        request_points = batch + potential
        n = len(batch)
        raw = table(
            request_points,
            sources=list(range(n)),
            destinations=list(range(n, n + len(potential))),
        )
        if len(raw["sources"]) != n or len(raw["destinations"]) != len(potential):
            raise ValueError("Unexpected event-to-potential OSRM shape")
        for i, event in enumerate(batch):
            register_snap(event["id"], event, raw["sources"][i])
        for j, node in enumerate(potential):
            register_snap(node["id"], node, raw["destinations"][j])
        for i, event in enumerate(batch):
            for j, node in enumerate(potential):
                duration = raw["durations"][i][j]
                distance = raw["distances"][i][j]
                d, m = finite_route(duration, distance, f"{event['id']}->{node['id']}")
                event_to_potential.append([event["id"], node["id"], d, m])

    event_to_event = []
    for batch in day_chunks(events):
        raw = table(batch)
        n = len(batch)
        if (len(raw["sources"]) != n or len(raw["destinations"]) != n
                or len(raw["durations"]) != n or len(raw["distances"]) != n):
            raise ValueError("Unexpected same-day OSRM shape")
        for i, event in enumerate(batch):
            register_snap(event["id"], event, raw["sources"][i])
        for i, source in enumerate(batch):
            for j, dest in enumerate(batch):
                if i == j or source["date"] != dest["date"]:
                    continue
                duration = raw["durations"][i][j]
                distance = raw["distances"][i][j]
                d, m = finite_route(duration, distance, f"{source['id']}->{dest['id']}")
                event_to_event.append([source["id"], dest["id"], d, m])

    expected = {
        "base_to_event": len(base_ids) * len(events),
        "event_to_potential": len(events) * len(potential_ids),
        "event_to_event_same_day": sum(
            n * (n - 1) for n in cohort["active_day_event_counts"].values()
        ),
    }
    actual = {
        "base_to_event": len(base_to_event),
        "event_to_potential": len(event_to_potential),
        "event_to_event_same_day": len(event_to_event),
    }
    if actual != expected:
        raise ValueError(f"Route count mismatch: {actual} != {expected}")

    event_snap = [snaps[e["id"]]["snap_distance_m"] for e in events]
    generated_at = dt.datetime.now(dt.timezone.utc).isoformat()
    data = {
        "version": "1.7.1",
        "dataset": "malaga-egif-historical-routing-v1.7.1",
        "generated_at_utc": generated_at,
        "scope": {
            "road_network": "current frozen OSM/OSRM at acquisition time; not historical road reconstruction",
            "event_coordinates": "observed EGIF primary cohort",
            "wildfire_snap_semantics": "route to nearest OSRM-routable point; snap distance retained as diagnostic",
            "runtime_network_calls": False,
        },
        "source": {
            "routing_engine": "OSRM",
            "endpoint_host": "router.project-osrm.org",
            "service": "table/v1/driving",
            "annotations": ["duration", "distance"],
            "network_data": "OpenStreetMap",
            "osm_attribution": "© OpenStreetMap contributors",
            "osm_license": "ODbL",
        },
        "inputs": {
            "routing_v1_0_sha256": sha256(routing_bytes),
            "cohort_freeze_sha256": sha256(COHORT_FREEZE.read_bytes()),
            "protocol_sha256": sha256(PROTOCOL.read_bytes()),
            "primary_events": len(events),
            "bases": base_ids,
            "potential_nodes": potential_ids,
        },
        "units": {"duration": "seconds", "distance": "meters", "snap_distance": "meters"},
        "snaps": snaps,
        "routes": {
            "base_to_event": base_to_event,
            "event_to_potential": event_to_potential,
            "event_to_event_same_day": event_to_event,
        },
        "audit": {
            "route_counts": actual,
            "expected_route_counts": expected,
            "unique_snap_points": len(snaps),
            "event_snap_distance_m": quantiles(event_snap),
            "event_snap_over_500m": sum(x > 500 for x in event_snap),
            "event_snap_over_2000m": sum(x > 2000 for x in event_snap),
            "event_snap_over_5000m": sum(x > 5000 for x in event_snap),
        },
    }
    raw = dump(data, pretty=False).encode("utf-8")
    freeze = {
        "version": "1.7.1",
        "status": "frozen_before_dispatch_outcomes",
        "routing_sha256": sha256(raw),
        "routing_bytes": len(raw),
        "generated_at_utc": generated_at,
        "route_counts": actual,
        "primary_events": len(events),
        "note": "Generated and frozen before any v1.7.1 policy runner existed. Re-fetching OSRM later is not expected to reproduce the same network; benchmark execution uses this static artifact only.",
    }
    return data, freeze


def report(data, freeze):
    a = data["audit"]
    s = a["event_snap_distance_m"]
    return "\n".join([
        "# Historical routing v1.7.1 — acquisition audit",
        "",
        "Routing-only artifact. No EcoDispatch policy outcome is generated here.",
        "",
        f"- primary events: **{data['inputs']['primary_events']}**",
        f"- base → event routes: **{a['route_counts']['base_to_event']}**",
        f"- event → potential routes: **{a['route_counts']['event_to_potential']}**",
        f"- directed same-day event → event routes: **{a['route_counts']['event_to_event_same_day']}**",
        f"- unique snapped points: **{a['unique_snap_points']}**",
        f"- event snap distance median / p95 / max: **{s['median']:.1f} / {s['p95']:.1f} / {s['max']:.1f} m**",
        f"- event snaps >500 m / >2 km / >5 km: **{a['event_snap_over_500m']} / {a['event_snap_over_2000m']} / {a['event_snap_over_5000m']}**",
        "",
        "OSRM snaps wildfire coordinates to the nearest routable driving point. The snap distance is retained and is not interpreted as observed response travel.",
        "This is a modern frozen OSM/OSRM network, not a reconstruction of roads in 2006–2023.",
        "",
        f"Frozen routing SHA-256: `{freeze['routing_sha256']}`.",
    ]) + "\n"


def validate(data, freeze):
    routes = data["routes"]
    audit = data["audit"]
    if audit["route_counts"] != audit["expected_route_counts"]:
        raise ValueError("Route counts do not match expected sparse graph")
    for key, rows in routes.items():
        for row in rows:
            if len(row) != 4:
                raise ValueError(f"Bad route row in {key}")
            if not all(isinstance(x, (int, float)) and math.isfinite(x) and x >= 0 for x in row[2:]):
                raise ValueError(f"Bad route values in {key}")
    raw = dump(data, pretty=False).encode("utf-8")
    if sha256(raw) != freeze["routing_sha256"] or len(raw) != freeze["routing_bytes"]:
        raise ValueError("Routing freeze hash/size mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(OUTPUT.relative_to(ROOT)))
    args = parser.parse_args()

    data, freeze = acquire()
    validate(data, freeze)

    out = ROOT / args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dump(data, pretty=False), encoding="utf-8")
    FREEZE_OUTPUT.write_text(dump(freeze, pretty=True), encoding="utf-8")
    REPORT.write_text(report(data, freeze), encoding="utf-8")

    print(out.relative_to(ROOT))
    print(FREEZE_OUTPUT.relative_to(ROOT))
    print(REPORT.relative_to(ROOT))
    print(json.dumps(data["audit"], indent=2))


if __name__ == "__main__":
    main()
