#!/usr/bin/env python3
"""Build the frozen v1.7.1 historical-demand cohort. No dispatch policy is run."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web/data/real-fire-incidents-v1.7.json"
SUMMARY = ROOT / "web/data/real-fire-summary-v1.7.json"
PROTOCOL = ROOT / "data/historical-demand-v1.7.1/protocol.json"
OUTPUT = ROOT / "data/historical-demand-v1.7.1/cohort.json"
REPORT = ROOT / "results/historical-demand-v1.7.1-cohort.md"
VERSION = "1.7.1"
START_YEAR = 2006
END_YEAR = 2023
EXPECTED_CANDIDATES = 1467


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value, pretty: bool = True) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
        sort_keys=False,
    ) + "\n"


def build() -> dict:
    protocol_bytes = PROTOCOL.read_bytes()
    source_bytes = SOURCE.read_bytes()
    summary_bytes = SUMMARY.read_bytes()

    protocol = json.loads(protocol_bytes)
    source = json.loads(source_bytes)
    summary = json.loads(summary_bytes)

    if protocol.get("version") != VERSION:
        raise ValueError("Protocol version mismatch")
    if protocol["cohort"]["years"] != [START_YEAR, END_YEAR]:
        raise ValueError("Cohort year range differs from frozen protocol")

    by_year_audit = summary["geographic_coverage"]["by_year"]
    audit_candidates = 0
    for year in range(START_YEAR, END_YEAR + 1):
        row = by_year_audit[str(year)]
        if row["parts"] != row["coordinates"]:
            raise ValueError(f"Spatial coverage is not complete in {year}")
        audit_candidates += row["parts"]
    if audit_candidates != EXPECTED_CANDIDATES:
        raise ValueError(
            f"Unexpected audited candidate count: {audit_candidates} != {EXPECTED_CANDIDATES}"
        )

    incidents = source["incidents"]
    candidate = [
        r for r in incidents
        if START_YEAR <= int(r["source_year"]) <= END_YEAR
    ]
    if len(candidate) != EXPECTED_CANDIDATES:
        raise ValueError(
            f"Unexpected source candidate count: {len(candidate)} != {EXPECTED_CANDIDATES}"
        )

    events = []
    exclusions = []
    year_candidate = Counter()
    year_primary = Counter()

    for row in candidate:
        year = int(row["source_year"])
        year_candidate[year] += 1

        lat = row.get("latitude")
        lon = row.get("longitude")
        if row.get("coordinate_flag") != protocol["cohort"]["required_coordinate_flag"]:
            raise ValueError(f"Unexpected coordinate flag in modern cohort: {row['incident_id']}")
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon)):
            raise ValueError(f"Missing/non-finite coordinate in modern cohort: {row['incident_id']}")

        detected = row.get("detected_at")
        if detected is None:
            raise ValueError(f"Missing parsed detection timestamp: {row['incident_id']}")
        stamp = datetime.fromisoformat(detected)
        if stamp.year != year:
            raise ValueError(
                f"source_year/detected_at year mismatch for {row['incident_id']}: "
                f"{year} vs {stamp.year}"
            )

        flag = row["timestamp_flags"]["detected_at"]
        if flag != protocol["cohort"]["required_detection_flag"]:
            exclusions.append({
                "incident_id": row["incident_id"],
                "source_year": year,
                "detected_at": detected,
                "reason": "detection_time_precision",
                "source_flag": flag,
            })
            continue

        arrival_min = stamp.hour * 60 + stamp.minute + stamp.second / 60
        if not 0 <= arrival_min < 1440:
            raise ValueError(f"Invalid arrival minute: {row['incident_id']}")

        events.append({
            "incident_id": row["incident_id"],
            "source_year": year,
            "date": stamp.date().isoformat(),
            "detected_at": detected,
            "arrival_min": arrival_min,
            "latitude": lat,
            "longitude": lon,
            "detection_time_flag": flag,
        })
        year_primary[year] += 1

    events.sort(key=lambda x: (x["detected_at"], x["incident_id"]))
    exclusions.sort(key=lambda x: (x["detected_at"], x["incident_id"]))

    ids = [x["incident_id"] for x in events]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate incident_id in primary cohort")

    active_counts = Counter(x["date"] for x in events)
    calendar_start = date.fromisoformat(protocol["historical_days"]["calendar_start"])
    calendar_end = date.fromisoformat(protocol["historical_days"]["calendar_end"])
    calendar_days = (calendar_end - calendar_start).days + 1

    result = {
        "version": VERSION,
        "dataset": "malaga-egif-historical-demand-replay-v1.7.1",
        "status": "frozen_demand_only_no_policy_outcomes",
        "provenance": {
            "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "source_sha256": digest_bytes(source_bytes),
            "source_audit": str(SUMMARY.relative_to(ROOT)).replace("\\", "/"),
            "source_audit_sha256": digest_bytes(summary_bytes),
            "protocol": str(PROTOCOL.relative_to(ROOT)).replace("\\", "/"),
            "protocol_sha256": digest_bytes(protocol_bytes),
            "builder": str(Path(__file__).resolve().relative_to(ROOT)).replace("\\", "/"),
            "builder_sha256": digest_bytes(Path(__file__).read_bytes().replace(b"\r\n", b"\n")),
            "imputation": False,
            "dispatch_executed": False,
        },
        "selection": {
            "years": [START_YEAR, END_YEAR],
            "required_coordinate_flag": protocol["cohort"]["required_coordinate_flag"],
            "required_detection_flag": protocol["cohort"]["required_detection_flag"],
            "timezone": protocol["cohort"]["timezone"],
            "midnight_policy": protocol["cohort"]["midnight_policy"],
            "event_order": protocol["cohort"]["event_order"],
        },
        "counts": {
            "candidate_parts": len(candidate),
            "primary_events": len(events),
            "excluded_detection_time_precision": len(exclusions),
            "active_fire_days": len(active_counts),
            "calendar_days": calendar_days,
            "zero_fire_days": calendar_days - len(active_counts),
            "by_year": {
                str(year): {
                    "candidate_parts": year_candidate[year],
                    "primary_events": year_primary[year],
                    "excluded_detection_time_precision":
                        year_candidate[year] - year_primary[year],
                }
                for year in range(START_YEAR, END_YEAR + 1)
            },
        },
        "active_day_event_counts": dict(sorted(active_counts.items())),
        "events": events,
        "exclusions": exclusions,
    }
    return result


def render_report(data: dict) -> str:
    c = data["counts"]
    lines = [
        "# Historical Demand Replay v1.7.1 — frozen cohort",
        "",
        "Demand-only artifact. No EcoDispatch policy has been run.",
        "",
        f"- candidate EGIF parts, 2006–2023: **{c['candidate_parts']}**",
        f"- primary replay events: **{c['primary_events']}**",
        f"- time-precision exclusions: **{c['excluded_detection_time_precision']}**",
        f"- active fire days: **{c['active_fire_days']}**",
        f"- calendar days: **{c['calendar_days']}**",
        f"- zero-fire days: **{c['zero_fire_days']}**",
        "",
        "Coordinates and detection times are observed EGIF fields after the frozen v1.7 validation rules.",
        "Timezone remains unknown/local-naive. No routing, severity, service calibration or dispatch outcome is included.",
        "",
        "## By year",
        "",
        "| year | candidate parts | primary events | time exclusions |",
        "|---:|---:|---:|---:|",
    ]
    for year, row in data["counts"]["by_year"].items():
        lines.append(
            f"| {year} | {row['candidate_parts']} | {row['primary_events']} | "
            f"{row['excluded_detection_time_precision']} |"
        )
    lines.append("")
    return "\n".join(lines) + "\n"


def artifacts() -> dict[str, str]:
    data = build()
    return {
        str(OUTPUT.relative_to(ROOT)).replace("\\", "/"): canonical(data),
        str(REPORT.relative_to(ROOT)).replace("\\", "/"): render_report(data),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    for rel, content in artifacts().items():
        target = ROOT / rel
        if args.check:
            if not target.exists() or target.read_bytes() != content.encode("utf-8"):
                raise SystemExit("Rebuild differs: " + rel)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode("utf-8"))
        print(rel)


if __name__ == "__main__":
    main()
