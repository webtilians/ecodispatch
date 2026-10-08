# Peligro espacial v1.3 / Spatial hazard v1.3

**real-routing + real fire-hazard spatial benchmark**. Exploratory integration,
not confirmation, operational risk prediction, or evidence of real-world efficacy.
v0.x, v1.0, v1.1.1 and the v1.2 provincial layer remain frozen and separate.

## Official source and acquisition

- Publisher: Agencia Estatal de Meteorología (AEMET).
- [Public download](https://www.aemet.es/es/api-eltiempo/incendios/download),
  [product interpretation](https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda),
  [reuse terms](https://www.aemet.es/es/nota_legal).
- The public endpoint returned a tar+gzip bundle without credentials. No AEMET
  download blockage was encountered. EFFIS/Copernicus was investigated as fallback
  ([official instructions](https://forest-fire.emergency.copernicus.eu/downloads-instructions));
  it was unnecessary. A rendered WMS image would not be treated as raw FWI values.
- Download completed **2026-10-08 15:40:05 UTC**. The frozen original archive is
  [`data/spatial-hazard-v1.3/aemet-20261007.tar.gz`](../data/spatial-hazard-v1.3/aemet-20261007.tar.gz).
  Original GeoTIFF and QML legend bytes are retained inside it. SHA-256 identities
  for archive, raster, legend and routing input are in the versioned node dataset.
- Selected member: `down_20261007_peligro_p_D01.tif` (Peninsula/Balearics).
  Model timestamp **2026-10-07 12:00:00 UTC**, valid **2026-10-08 12:00:00 UTC**,
  a 24-hour forecast. Date selection is the client acquisition date, not a search
  for more spatial variation. Model and validity timestamps come from raster tags,
  whose `time_unit` specifies UTC; they are not inferred from file mtime.
- The URL is a rolling latest-model endpoint, not a guaranteed historical archive.
  Exact reproduction uses the committed bytes offline. A later download MUST become
  a new dataset/version, never silently replace this snapshot. No uptime guarantee
  is inferred from a successful retrieval. Neither web rendering nor CI needs AEMET.
- Attribution: **Fuente: AEMET / Source: AEMET**. AEMET's product authorizes use and
  reproduction with attribution. Preserve source, acquisition/validity dates and
  transformations; do not imply AEMET endorsement. No unsupported CC license is assigned.

## Variable and geospatial transformations

The variable is **Danger level / Peligro**, not continuous FWI, incident frequency,
expected loss, or a calibrated probability. The model combines weather and other
inputs (vegetation/land use/soil moisture). We retain its classes exactly.

| Original class | AEMET label | English | Exploratory fire weight |
|---:|---|---|---:|
| 1 | Muy bajo | Very low | 1 |
| 2 | Bajo | Low | 2 |
| 3 | Moderado | Moderate | 3 |
| 4 | Alto | High | 4 |
| 5 | Muy alto | Very high | 5 |
| 6 | Extremo | Extreme | 6 |

Labels come from the matching QML palette, verified against raster `ESCALA`.
Code 0 is marked transparent/NaN by that legend; 255 is not a six-level class.
Both are rejected (not imputed as zero hazard). The GeoTIFF has no declared NoData.

- CRS **EPSG:4326 (WGS84)**; one float32 band, **1541 × 922** pixels.
- Actual affine grid: x origin −10.205°, y origin 44.215°, x step +0.01°,
  y step −0.01°, no rotation (full floating precision saved in JSON).
- AEMET nominal resolution: **1 km**. A 0.01° cell around Málaga is about
  0.89 km east–west × 1.11 km north–south; it is not exactly a 1 km square
  in this geographic CRS, nor evidence of sub-kilometre forecast accuracy.
- Inputs are the routing dataset's original `input_lon,input_lat`, not OSRM-snapped
  road coordinates. The snap gate remains ≤500 m; D5/D8 remain excluded.
  Fire hazard pertains to the demand site; road travel ends at its frozen snapped
  waypoint. This residual discrepancy is inherited and not modeled as off-road travel.
- Reprojection EPSG:4326 → EPSG:4326 is identity, explicitly x=longitude,
  y=latitude. Inverse affine followed by floor chooses the containing pixel;
  there is no interpolation, resampling, smoothing, clipping or extrapolation.
- Bounds and valid classes are checked before use. Per-node coordinates,
  raster row/column, original class and weight are stored. Ten nodes are in bounds;
  **D7 and D11 have class 2; the other eight have class 1**.

No normalization is mathematically required, so **weight = original class**.
Using ordered class codes in an additive potential is an explicit, uncalibrated
ordinal surrogate: class 2 is NOT twice the real danger of class 1. Equal gaps and
ratios have no physical validation. No class is converted into a fire probability.

## Isolated exploratory protocol

`web/spatial-hazard-core.js` reuses frozen routing/movement/event generation but
isolates the new exposure and policy simulator. Only the fire term changes:

`potential = Σ_node [0.40 × AEMET_class × best_fire_ETA +
0.35 × synthetic_weight × best_medical_ETA +
0.25 × synthetic_weight × best_drone_ETA]`.

Those fixed type coefficients are synthetic workload assumptions, not AEMET-derived
probabilities. Recon is named `drone` in the engine. Event locations for ALL types
continue to be sampled with historical synthetic weights. Thus no hazard classes
become occurrence probabilities. Severity, demand sites, fleet and emission factors
remain synthetic; roads are OSRM/OSM, while drone movement is direct geodesic flight.

Initial placement is fixed at the historical synthetic routing placement B2/B3/B4
for every policy. The new weights replace the fire component of future-coverage
exposure only. This avoids changing placement and potential simultaneously.

- Fresh seed family `ecodispatch-spatial-hazard-13-exploratory-20261008|day|index`,
  index 0–999, 120 sequential incidents/day; all policies share each day's events.
- λ=0 vs 0.2, 0.35, 0.5, 1, plus ETA-greedy and distance-greedy.
- K=10 synthetic unserved penalty; unchanged deadlines 90/120/30 minutes.
- Same 24-hour forecast snapshot across synthetic replicates, not 1,000 real days.
- Coverage, mean ETA, P95, km, CO₂, severity-delay and totalHarm; paired differences
  and 500-replicate paired bootstrap intervals. P95 uses the inherited lower order
  statistic `floor(.95*(n-1))`, then averages per-day values, not pooled percentiles.
- No hypothesis confirmation, tuning selection, efficacy claim or reused holdout.

**Structural limitation:** only one resource can serve fire under the original
strict capabilities. The new fire potential changes absolute exposure but cannot
alter fire assignments. For non-fire moves that fire term is constant and cancels.
Results therefore coincide with a synthetic-weight control on the SAME NEW seeds.
Lambda differences in aggregate results come from synthetic medical/recon terms.
All fire-only policy differences are zero. Fire-only metrics replay the fire
subsequence, which is equivalent because only the dedicated brigade moves for fire
and there are no service times, queues or shared fire-capable resources.

The report makes this null effect explicit rather than changing the fleet to
produce improvements. A later study would need a separately specified multi-brigade
fleet or fire-specific placement experiment, more dates, and appropriate validation.

## Reproduction and checks

From the repository root, Python 3.12 and Node 22:

```sh
python -m pip install -r requirements-spatial.txt
python scripts/build_spatial_hazard.py
node scripts/run_spatial_benchmark.cjs
python -m unittest discover -s tests
node --test tests/*.test.cjs
npm ci
npx playwright install chromium
npm run test:e2e
```

Outputs: [node dataset](../web/data/spatial-hazard-v1.3.json),
[summary with intervals](../web/data/spatial-benchmark-v1.3.json),
[all paired rows](../results/spatial-hazard-v1.3-rows.json),
[readable report](../results/spatial-hazard-v1.3-report.md).
CI rebuilds both artifacts offline and checks exact diffs, verifies historical
files/configuration, geospatial integrity, weights and dataset identities, then
runs all Node/Python/Playwright suites. Pages deployment depends on that full CI
and only runs on master, never a pull request.

## Resumen español

v1.3 muestrea diez nodos elegibles sobre el GeoTIFF oficial archivado y conserva
las clases sin normalizarlas. Sustituye solo el término de peligro futuro de
incendios; medical/recon, incidentes y colocación siguen siendo sintéticos.
Se publican resultados agregados y solo-incendios con semillas nuevas. La única
brigada impide diferencias entre políticas para incendios: esta versión valida
la integración reproducible, no una mejora operativa. Fuente, fecha y limitaciones
están visibles en ES/EN. Las capas y resultados históricos siguen intactos.
