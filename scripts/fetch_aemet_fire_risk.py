#!/usr/bin/env python3
"""Build EcoDispatch v1.2 AEMET Málaga fire-weather hazard dataset.

Source:
https://www.aemet.es/es/datos_abiertos/estadisticas/riesgo_incendios

The public website uses only the generated static JSON. No AEMET call is made
at runtime.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
import re
import unicodedata
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "web" / "data" / "aemet-malaga-fwi-2025.json"
URL = (
    "https://www.aemet.es/documentos/es/datos_abiertos/Estadisticas/"
    "IM_riesgo_incendios/eimri_estadistica_anual_2025.zip"
)
USER_AGENT = (
    "EcoDispatch-v1.2-research/1.0 "
    "(https://github.com/webtilians/ecodispatch)"
)


def norm(value: object) -> str:
    text = str(value or "").strip().upper()
    text = "".join(
        c for c in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(c)
    )
    return re.sub(r"\s+", " ", text)


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass
    raise UnicodeDecodeError("unknown", raw, 0, 1, "unsupported CSV encoding")


def parse_csv(raw: bytes) -> tuple[list[str], list[dict[str, str]], str]:
    text = decode_csv(raw)
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t,")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";"
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    headers = [h.strip() for h in (reader.fieldnames or [])]
    rows = []
    for row in reader:
        rows.append({
            str(k).strip(): (v.strip() if isinstance(v, str) else v)
            for k, v in row.items()
            if k is not None
        })
    return headers, rows, delimiter


def row_mentions_malaga(row: dict[str, str]) -> bool:
    return any(norm(v) == "MALAGA" for v in row.values())


def main() -> None:
    request = urllib.request.Request(
        URL,
        headers={"User-Agent": USER_AGENT, "Accept": "application/zip,*/*"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
        content_type = response.headers.get("Content-Type", "")

    archive = zipfile.ZipFile(io.BytesIO(payload))
    csv_names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
    if not csv_names:
        raise RuntimeError("AEMET archive contains no CSV files")

    datasets = {}
    total_matches = 0
    for name in csv_names:
        headers, rows, delimiter = parse_csv(archive.read(name))
        selected = [row for row in rows if row_mentions_malaga(row)]
        if not selected:
            continue
        total_matches += len(selected)
        datasets[pathlib.Path(name).name] = {
            "delimiter": delimiter,
            "headers": headers,
            "malaga_rows": selected,
            "all_row_count": len(rows),
        }

    if not datasets:
        raise RuntimeError(
            "No Málaga rows found in AEMET CSV files; inspect source format"
        )

    result = {
        "version": "1.2",
        "dataset": "aemet-malaga-fire-weather-2025",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "province": "Málaga",
            "year": 2025,
            "spatial_resolution": "province",
            "role": "real fire-weather hazard calibration layer; not node-level risk",
        },
        "source": {
            "publisher": "AEMET - Agencia Estatal de Meteorología",
            "title": "Estadística de índice meteorológico de riesgo de incendios",
            "landing_page": (
                "https://www.aemet.es/es/datos_abiertos/estadisticas/"
                "riesgo_incendios"
            ),
            "download_url": URL,
            "reuse_note": (
                "AEMET authorizes reuse and reproduction with attribution "
                "to AEMET as the author."
            ),
            "attribution": "Fuente: AEMET",
        },
        "archive": {
            "bytes": len(payload),
            "content_type": content_type,
            "files": archive.namelist(),
            "matched_rows": total_matches,
        },
        "datasets": datasets,
    }

    OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {OUTPUT.relative_to(ROOT)} with "
        f"{len(datasets)} CSV datasets / {total_matches} Málaga rows"
    )


if __name__ == "__main__":
    main()
