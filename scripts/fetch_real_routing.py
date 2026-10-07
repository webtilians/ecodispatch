#!/usr/bin/env python3
"""Build EcoDispatch v1.0 static road-routing matrix from OSRM + OSM data.

One table request, intended for reproducible research-data generation only.
The public site does not call OSRM at runtime.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CURRENT = ROOT / "web" / "data" / "current.json"
OUTPUT = ROOT / "web" / "data" / "routing-v1.0.json"

OSRM_BASE = "https://router.project-osrm.org"
USER_AGENT = "EcoDispatch-v1.0-research/1.0 (https://github.com/webtilians/ecodispatch)"


def project_point(data: dict, point: list[float]) -> tuple[float, float]:
    bounds = data["geo"]["bounds"]
    x, y = point
    lat = bounds["south"] + (y / 8.5) * (bounds["north"] - bounds["south"])
    lon = bounds["west"] + (x / 8.2) * (bounds["east"] - bounds["west"])
    return lat, lon


def validate_matrix(name: str, matrix: list[list[float | None]], n: int) -> None:
    if len(matrix) != n or any(len(row) != n for row in matrix):
        raise ValueError(f"{name}: expected {n}x{n} matrix")
    for i, row in enumerate(matrix):
        for j, value in enumerate(row):
            if value is None:
                raise ValueError(f"{name}[{i}][{j}] is null")
            if value < 0:
                raise ValueError(f"{name}[{i}][{j}] is negative")
        if abs(row[i]) > 1e-6:
            raise ValueError(f"{name}[{i}][{i}] must be zero")


def main() -> None:
    data = json.loads(CURRENT.read_text(encoding="utf-8"))
    points = []
    for role, rows in (("candidate_base", data["candidates"]), ("demand_node", data["demand"])):
        for row in rows:
            lat, lon = project_point(data, row["point"])
            points.append({
                "id": row["name"],
                "role": role,
                "input_lat": round(lat, 7),
                "input_lon": round(lon, 7),
            })

    coordinates = ";".join(f'{p["input_lon"]},{p["input_lat"]}' for p in points)
    path = f"/table/v1/driving/{coordinates}"
    query = urllib.parse.urlencode({"annotations": "duration,distance"})
    url = f"{OSRM_BASE}{path}?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = json.load(response)

    if raw.get("code") != "Ok":
        raise RuntimeError(f"OSRM returned {raw.get('code')}: {raw.get('message')}")

    n = len(points)
    durations = raw["durations"]
    distances = raw["distances"]
    validate_matrix("durations_s", durations, n)
    validate_matrix("distances_m", distances, n)

    sources = raw.get("sources") or []
    destinations = raw.get("destinations") or []
    if len(sources) != n or len(destinations) != n:
        raise ValueError("OSRM did not return all snapped waypoints")

    for i, point in enumerate(points):
        snapped = sources[i]["location"]
        point["snapped_lon"] = snapped[0]
        point["snapped_lat"] = snapped[1]
        point["snap_distance_m"] = sources[i].get("distance")

    result = {
        "version": "1.0",
        "dataset": "malaga-real-routing-v1",
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "scope": {
            "area": "Málaga / Montes de Málaga, Spain",
            "routing_profile": "OSRM driving",
            "point_semantics": "synthetic candidate bases and synthetic demand nodes projected onto real coordinates",
            "risk_semantics": "synthetic v0.x risk weights; no real incident-risk claims",
        },
        "source": {
            "routing_engine": "OSRM",
            "endpoint_host": "router.project-osrm.org",
            "service": "table/v1/driving",
            "annotations": ["duration", "distance"],
            "network_data": "OpenStreetMap",
            "osm_attribution": "© OpenStreetMap contributors",
            "osm_license": "ODbL",
            "osm_copyright_url": "https://www.openstreetmap.org/copyright",
            "osrm_docs": "https://project-osrm.org/docs/v26.5.0/http",
            "osrm_demo_policy_note": "Static one-request research dataset. Public site does not query demo server at runtime.",
        },
        "units": {
            "durations": "seconds",
            "distances": "meters",
        },
        "points": points,
        "durations_s": durations,
        "distances_m": distances,
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {n} points and {n*n} OD pairs")


if __name__ == "__main__":
    main()
