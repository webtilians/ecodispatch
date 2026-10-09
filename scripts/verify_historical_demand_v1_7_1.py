#!/usr/bin/env python3
"""Verify the v1.7.1 demand-only cohort against the pre-outcome freeze manifest."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/build_historical_demand_v1_7_1.py"
FREEZE = ROOT / "data/historical-demand-v1.7.1/cohort-freeze.json"

spec = importlib.util.spec_from_file_location("historical_demand_v171", BUILDER)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    freeze = json.loads(FREEZE.read_text(encoding="utf-8"))
    artifacts = builder.artifacts()
    for rel, expected in freeze["artifacts"].items():
        if rel not in artifacts:
            raise SystemExit("Frozen artifact missing from builder: " + rel)
        raw = artifacts[rel].encode("utf-8")
        actual_hash = sha256(raw)
        if len(raw) != expected["bytes"]:
            raise SystemExit(
                f"Frozen artifact size differs for {rel}: {len(raw)} != {expected['bytes']}"
            )
        if actual_hash != expected["sha256"]:
            raise SystemExit(
                f"Frozen artifact SHA-256 differs for {rel}: {actual_hash} != {expected['sha256']}"
            )

    data = builder.build()
    if data["counts"] != {
        **freeze["counts"],
        "by_year": data["counts"]["by_year"],
    }:
        for key, value in freeze["counts"].items():
            if data["counts"][key] != value:
                raise SystemExit(
                    f"Frozen count differs for {key}: {data['counts'][key]} != {value}"
                )

    observed = [
        {
            "incident_id": x["incident_id"],
            "detected_at": x["detected_at"],
            "source_flag": x["source_flag"],
        }
        for x in data["exclusions"]
    ]
    if observed != freeze["exclusions"]:
        raise SystemExit("Frozen exclusion set differs")

    print("v1.7.1 historical-demand freeze verified")
    print(f"primary_events={data['counts']['primary_events']}")
    print(f"active_fire_days={data['counts']['active_fire_days']}")


if __name__ == "__main__":
    main()
