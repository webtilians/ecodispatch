# v1.7 step 1 — observed EGIF incidents, Málaga

This layer extracts and validates records, without calibrating or connecting them to dispatch. Poisson generation, service times, v1.6 experiments and simulator code are unchanged. The archive contains **7,496 parts, 1968–2023**, despite the export query ending in 2026. It is not a complete or stationary estimate of future fire probability.

## Reproduce offline

```sh
python scripts/build_real_fire_v1_7.py
python scripts/build_real_fire_v1_7.py --check
python -m unittest discover -s tests
npm ci
npx playwright install chromium
npm run test:e2e
```

The standard-library builder verifies the ZIP against the frozen manifest before reading its sole XML member. It selects direct `Pif` records, excluding the embedded schema, and preserves XML row order. No network, randomness, run date, host timezone, imputation or raw-file writes are used. Builder version and normalized source SHA-256 identify the exact transformation without a self-referential generated-commit hash; the source base commit is recorded separately. The commit containing the builder and outputs supplies Git history.

## Outputs and schema

- `web/data/real-fire-incidents-v1.7.json`: one object per part, explicit JSON nulls, original IDs, codes, normalized timestamps, raw timestamps, coordinates, areas and nested observed resources. This roughly 25 MB download is **never fetched by the dashboard**.
- `web/data/real-fire-summary-v1.7.json`: small static aggregate loaded by the ES/EN panel; all denominators, distributions, flags, missingness and provenance.
- `results/real-fire-v1.7-audit.md`: generated audit containing the complete aggregate.

`incident_id` is `egif:` plus original `idpif`; `numeroparte` remains a string. Both original identifiers are retained. `source_year` comes from `pif_comun/anio`. Municipality and cause fields retain original source codes, including municipality `0`; no official municipality/cause dictionary is present. `municipality_name` is always null. No inference from similarly named RDF places or incompatible code systems is made.

Source `pif_tiempos/deteccion`, `controlado`, `extinguido` map to `detected_at`, `controlled_at`, `extinguished_at`. Arrival field names are unchanged. All inputs also appear in `source_times`, with per-field `timestamp_flags`. Calendar-valid source timestamps may remain present even when contradictory intervals are excluded; timestamp validity and interval validity are different concepts.

`coordinates_raw` preserves latitud, longitud, x, y, iddatum, huso. X/Y numeric copies and original datum/zone codes are retained **without transformation**; no EPSG or datum label is inferred. `location_observed` preserves other original localization fields. `burned_area` copies the four `pif_perdidas` area fields as nonnegative numbers; invalid/missing values are null with flags. The complete nested losses/area block is retained as `burned_area_source`. Categories are not summed because their overlap is not established here. Values keep original source units/field meanings; no conversion or REDIAM area substitution is performed. `resources_observed` retains all nested `pif_medios` counts and relations, including repeated entries, with source names and strings; absent blocks are null and explicit zero is preserved. These describe recorded mobilization, not fleet availability.

## Conservative validation

Only exact `YYYY-MM-DDTHH:MM:SS` strings and real calendar dates within the source query years 1968–2026 pass parsing. Offsets and other formats fail explicitly rather than being silently stripped. All timestamps remain **unknown/local-naive**, with no UTC conversion or daylight-saving correction. Date-only values are never promoted to midnight.

Explicit `00:00:00` is preserved and flagged `midnight_precision_unknown`. Without evidence distinguishing real midnight from a date-only placeholder, these endpoints are excluded from interval calculations and detection-hour histograms. Their dates remain in month/year/weekday counts. This deliberately sacrifices some genuine midnight observations; it is not a claim that midnight is impossible. The large arrival-midnight concentration makes precision uncertainty material.

Durations require two unambiguous parsed endpoints and nonnegative elapsed time. A control timestamp after extinction excludes both control and extinction duration summaries for that part. Source timestamps are retained for audit. Each arrival must be on or after detection and no later than parsed extinction when available. The earliest qualifying arrival is selected from the four observed fields, with lexical source-field ordering to resolve ties. Earlier invalid/ambiguous arrivals are excluded, so this is the **earliest valid observed arrival**, not necessarily the actual first response. Zero intervals are allowed when explicitly recorded. Positive outliers are retained, visible in maxima, without trimming, winsorization or calibration. A positive interval can still reflect source error; calendar/order validation cannot certify truth.

Coordinates must form a finite numeric pair within **36.2–37.5 N, −5.7–−3.7 E**. This deliberately broad Málaga screening rectangle lies inside mainland Spain. It rejects obvious location errors but is not a provincial polygon test, surveyed accuracy check or proof of incident location. Out-of-bounds pairs become null together; originals and reasons remain. Coverage is reported by year and raw municipality code; geographical missingness is substantial and uneven.

## Audit interpretation

The audit distinguishes calendar-valid timestamps from interval-qualified observations and lists all exclusion reasons. Missingness counts JSON nulls; unresolved municipality codes are additionally indicated by status, not silently cleaned. Resource missingness is per incident/source path; repeated entries do not multiply the denominator. Quantiles use nearest rank; medians use the standard midpoint of central values. Means, medians, p90/p95 and maxima are descriptive minutes, not fitted model parameters.

Month/year/weekday histograms use calendar-valid detection dates; hour counts omit ambiguous midnight. Each bin is an observed **count**, not `P(fire | hour, month, zone)` and not a probability calibrated to exposure or reporting completeness. Changes across decades can reflect reporting and measurement changes.

Concurrency uses qualified `[detection, extinction)` intervals. Endpoints at the same time are grouped; zero-length intervals contribute no active time. The sweep reports peak overlap, minutes at each active count, and a time-weighted mean over the continuous earliest-start/latest-end archive window (including quiet periods). Missing/invalid intervals are excluded. These are **fire-active overlaps, not brigade occupancy**, and may undercount missing events or overstate overlap due to long source durations. No resource availability is inferred.

Detection is neither ignition nor emergency call time. Extinction is not brigade release. Detection→arrival is neither road ETA nor pure travel time. No operational efficacy, optimized dispatch, fleet staffing or causal inference follows from these observations. No future simulation parameters are tuned in this branch.

## Provenance and separate REDIAM scope

Publisher: **MITECO, EGIF**, Málaga query archived on 2026-10-08. Source of truth: `data/real-fire-v1.7/raw/egif/egif_malaga_1968_2026_consulta.zip`, SHA-256 `5cad25f4d26d328f179ea3bd7aecc58b0fd314ec214ec2b346257a566b8d1d3a`. The manifest source URL, query, retrieval information, license statement and transport caveat are copied verbatim into each artifact's provenance. The original download's TLS chain was not validated; the local hash proves consistency with the archived bytes, not publisher authentication.

The XML-specific license was not located; the archived MITECO legal notice permits reuse with attribution and metadata retention. **Do not apply the RDF dataset's CC BY license to this XML.** See `data/real-fire-v1.7/README.md` and the manifest for evidence.

REDIAM originals remain separate. There is no measured, validated matching rule or demonstrated shared stable incident ID in this extraction, so no spatial/temporal join, enrichment or false-match claim is made. REDIAM perimeters and area records are not ignition points and their differing coverage does not validate EGIF event identity.

## Regression boundary

Tests freeze SHA-256 for all original raw files and all pre-existing v1.6-named artifacts plus the simulator and temporal model sources. CI rebuilds all historical experiments, runs Python and model tests and exercises both languages, responsive layout, failed-load isolation and summary-only fetching in Playwright. The validation workflow also runs on this feature branch so it can pass before the PR is opened. Deployment remains restricted to master.
