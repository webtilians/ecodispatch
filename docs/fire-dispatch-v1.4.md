# Fire Dispatch v1.4 — exploratory, isolated fire experiment

## Scope / alcance

v1.3 successfully sampled real AEMET hazard but had only one fire-capable resource.
v1.4 fixes that structural experiment limitation with **three modeled brigades**.
It does not turn the prototype into an operational dispatch system, validate hazard
as a predictor of incident occurrence, or confirm a preferred lambda.
This is **not preregistered or confirmatory**. The early design/selection commits
are an audit trail for outcome-independent selection, not a statistical registration.

| Component | Status |
|---|---|
| Road times and distances | Frozen OSM/OSRM driving matrix `routing-v1.0.json`; not live traffic or emergency-vehicle travel |
| Fire danger | Official archived AEMET GeoTIFF danger classes, original 1..6 |
| Demand sites | Existing modeled sites on real Málaga coordinates; D5/D8 excluded by >500 m snap gate |
| Fleet/stations | Experimental F-01/B2, F-02/B3, F-03/B4, not official station/resource inventory |
| Incident occurrence | Synthetic uniform selection over the ten eligible nodes, independent of hazard |
| Severity | Synthetic uniform [2,5) |
| Service/occupancy | Explicitly zero; sequential events, immediate reuse; no simultaneous occupancy, queue or clock |
| Movement after service | Stay at the served node; no return journey or return-to-station cost |
| CO₂ | Synthetic 230 g/km for every brigade, not measured fleet emissions |

The modeled three-base fleet is fixed before results, inherited from the earlier
real-routing placement B2/B3/B4. No new placement optimization or fleet-size search
was performed. All resources have exactly one capability: fire. Station coordinates
are the routing points' original input coordinates; travel uses frozen road-snapped
matrix endpoints. Residual off-road access is unmodeled. No drone/geodesic movement
enters this experiment.

## Official data, acquisition and date selection

Source: [AEMET download](https://www.aemet.es/es/api-eltiempo/incendios/download),
[product interpretation](https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda).
The product page documents georeferenced GeoTIFFs and the latest daily model issue.
No reproducible independent historical danger-raster archive was obtained during
this implementation. We do not infer missing dates from a rolling URL or rename
forecast validities as historical observations.

The existing official bundle `data/spatial-hazard-v1.3/aemet-20261007.tar.gz` contains
eight Peninsula/Balearics rasters D00..D07. Its original download completed
2026-10-08T15:40:05Z. A fresh endpoint request in this session returned the exact same
archive SHA-256 `a0816b24fcfe981163d2f00706c411124ef89b67dde42e9ec45cf061ec09983c`.
The archive is reused in place; it is neither copied nor changed. Identical bytes
are not counted as a new snapshot or a new model issue.

1. Design and fleet fixed in commit `616330d`, before extraction/policy comparisons.
2. Enumerate every actual Peninsula danger raster in the acquisition manifest.
3. Verify matching legend, explicit UTC timestamps, valid original classes 1..6
   at all ten nodes; report any exclusions. Deduplicate identical raster SHA hashes.
4. Rank by distinct classes descending, range descending, mean class descending,
   valid timestamp ascending, model timestamp ascending, raster SHA ascending.
5. Select the top three plus the v1.3 reference if absent. Here the reference is
   already selected. Complete ranking and values are published, including unselected
   candidates. No policy output is loaded by this pipeline.
6. Lock catalog/selected IDs in `selection-lock.json`, commit `d77ec7c`, before
   implementing or comparing the v1.4 dispatch policies.

| Rank | Valid UTC (12:00) | Lead hours | Classes 1 / 2 | Selected |
|---:|---|---:|---|---|
| 1 | 2026-10-09 | 48 | 4 / 6 | yes |
| 2 | 2026-10-08 | 24 | 8 / 2 | yes; v1.3 reference |
| 3 | 2026-10-11 | 96 | 8 / 2 | yes |
| 4 | 2026-10-12 | 120 | 8 / 2 | no |
| 5 | 2026-10-13 | 144 | 8 / 2 | no |
| 6 | 2026-10-14 | 168 | 8 / 2 | no |
| 7 | 2026-10-10 | 72 | 9 / 1 | no |
| 8 | 2026-10-07 | 0 | 10 / 0 | no |

All timestamps come from raster tags, not filenames or acquisition dates. Every
candidate shares model time **2026-10-07T12:00:00Z**. October 9 and 11 are future
forecast validities at the time of development, not observations. Selected October
8 and 11 have the **same ten-node class vector**; there are only two distinct
selected profiles. Separate snapshot seed streams mean their numeric results differ
by Monte Carlo sampling, not by hazard at these nodes. Replicates and forecast lead
times must not be pooled as independent weather days or evidence of generalization.
Selection by diversity does not make this a representative sample of fire seasons.

### Sampling and identities

`scripts/build_fire_snapshots.py` deterministically reads the committed archive
offline. It uses original `input_lon,input_lat`, EPSG:4326 x/y axis order, transforms
to the raster CRS, and samples the containing pixel (floor inverse affine), with no
interpolation, smoothing, normalization, clipping or imputation. Code 0, 255, masked,
out-of-bounds and any noninteger class outside 1..6 are rejected. Each node retains
coordinates, row/column, original class, identical hazard weight and source label.
CRS, affine transform, dimensions, tags, model/validity/lead times and SHA-256 hashes
for archive, raster, legend, routing, protocol and catalog are stored. A matching
six-class QML legend is required. Grid is 0.01°, nominal ~1 km, not a guarantee of
sub-kilometre hazard accuracy.

Classes are ordinal categories, **not calibrated fire probabilities**. Taking class
codes as additive weights assumes equal gaps and numerical ratios as a modeling
convention; class 2 does not mean twice the real fire probability or loss of class 1.
Source: AEMET. Reproduction/use with attribution; no implied AEMET endorsement.

## Fire-only dispatch mathematics

For brigade positions `p`, future-coverage potential is:

`Phi(p) = sum_node original_AEMET_class(node) * min_brigade road_ETA(p_brigade, node)`.

For each arriving event, every fire brigade with road ETA <=120 minutes is feasible.
After a hypothetical move of brigade r to the incident node:

`immediate_cost = severity * ETA + 0.0005 * emissions_g + 0.05 * distance_km`

`score_r(lambda) = immediate_cost_r + lambda * (Phi(p_after_r) - Phi(p_before))`.

Select the feasible brigade with smallest score. Ties retain declared fleet order
F-01, F-02, F-03. A negative delta/score is allowed; reported harm/distance/emissions
remain nonnegative. No look-ahead at subsequent synthetic events is used. Unlike
v1.3, three brigades make the fire exposure delta depend on the selected resource.

Policies: lambda = 0, .2, .35, .5, 1, plus feasible ETA-greedy and distance-greedy.
Lambda=0 keeps the same immediate cost and removes only potential. Greedy baselines
retain the same feasibility gate, fleet, reset locations, event stream and tie rule.
This is a fire-only potential with no medical/recon mixture coefficient, so lambda
does not have the same scale/meaning as in earlier mixed-type experiments.

## Paired benchmark and interpretation

Seed family: `ecodispatch-fire-dispatch-14-exploratory-20261008|snapshot|ID|day|index`,
index 0..999, 120 fire events each. Snapshot ID includes the member and raster hash.
Every snapshot/day generates **one** event array and gives it unchanged to all seven
policies and the uniform-class-1 sensitivity control. Every run resets all brigades.
No historical holdout seed family is reused and no favorable event seeds are selected.
"Day" means a synthetic sequence of 120 incidents, not a clock-constrained 24 hours;
in particular, service duration, shift length and realistic daily incident frequency
are not represented.

Report separately per snapshot:

- coverage = served/120; mean ETA and P95 on served events;
- P95 = sorted ETA at floor(.95*(n-1)), averaged over daily P95s, not a pooled quantile;
- daily kilometres, synthetic CO₂ kg, severity-delay and totalHarm;
- totalHarm = sum served severity × ETA + 10 × sum unserved severity²;
- paired differences vs lambda=0, normal and 500-replicate paired bootstrap intervals;
- dispatch hashes, first divergence witness, days/assignments that differ;
- identical-event control with every hazard class set to 1 at lambda=.35, clearly
  a synthetic diagnostic, never labeled an official alternative snapshot.

All-zero-served ETA/P95 are null with explicit missing counts, not invented zeros.
The unserved penalty can be smaller than a long served delay, making harm an arbitrary
surrogate that must be interpreted together with coverage. Intervals describe
simulation uncertainty under fixed inputs; they exclude hazard/fleet uncertainty,
are not multiplicity-corrected, and cannot confirm performance or causal benefits.

Current results remove the structural null: all three snapshots produce different
fire decisions between lambda policies. Actual hazard also changes decisions versus
the uniform-class-1 control. **Decision sensitivity is not an improvement claim.**
Coverage is 100% throughout this modeled benchmark. Lambda=1 worsens synthetic harm
in all three snapshots; smaller lambdas show mixed small changes and different
ETA/P95/distance tradeoffs. The October 9 lambda=.2 descriptive interval excludes
zero, but this does not confirm a winner or generalize across weather dates.
At lambda=.35, spatial weighting increases mean harm versus the uniform-class-1
control in all three snapshots. This is reported, not hidden or used to tune selection.

Full values: [results report](../results/fire-dispatch-v1.4-report.md),
[summary JSON](../web/data/fire-benchmark-v1.4.json),
[summary CSV](../web/data/fire-benchmark-v1.4.csv),
[paired per-day metrics and dispatch/event hashes](../results/fire-dispatch-v1.4-rows.json).
Full event/dispatch sequences regenerate exactly from the protocol and seed.

## Reproduction, website and deployment

Python 3.12, Node 22 in CI:

```sh
python -m pip install -r requirements-spatial.txt
python scripts/build_fire_snapshots.py
node scripts/run_fire_benchmark.cjs
python -m unittest discover -s tests
node --test tests/*.test.cjs
npm ci
npx playwright install chromium
npm run test:e2e
```

On Windows Node versions that do not expand test globs, enumerate the seven
`tests/*.test.cjs` files or use the explicit commands in `.github/workflows/pages.yml`.
No network calls are needed for extraction/benchmark after dependency installation.
CI rebuilds both v1.3 and v1.4 artifacts and rejects differences, checks Node/Python
regressions and geospatial identities, then runs the complete Playwright suite.
Pages deploy depends on **all validation passing** and runs only on master.

The isolated `#fire-dispatch` section loads catalog, results and road data, verifies
catalog/routing hashes, and provides ES/EN labels, snapshot selector, WGS84 schematic
node/station map, original classes, fleet assumptions, metrics, paired intervals and
selected-snapshot JSON/CSV downloads. Failures leave historical sections available.
Historical engines and data/results through v1.3 stay byte-identical. `current.json`
only advances version and adds a separate `research.fire_dispatch` entry.

For future acquisitions, `scripts/archive_aemet_fire.py --acquire` illustrates
content-addressed archival, source URL, acquisition time and SHA identities. It
refuses to alter the locked v1.4 experiment. Create a new version/manifest and
selection record before extending the candidate pool; never silently refresh
v1.4 or overwrite the v1.3 archive. There is no invented high-gradient fallback.

## Resumen español

Tres brigadas experimentales permiten que lambda cambie las decisiones de incendio.
Se usan tres GeoTIFF oficiales archivados, seleccionados por diversidad antes de
comparar políticas. Comparten una salida del modelo y solo dos perfiles de clases
entre los diez nodos: no sustituyen una muestra histórica independiente. La flota,
incidentes, severidad, CO₂ y servicio nulo son modelados; routing y peligro espacial
son reales. Hay diferencias de decisiones, pero no una mejora uniforme de daño,
ETA, P95 o distancia. La versión sigue siendo exploratoria, sin preregistro,
confirmación ni afirmación de eficacia operativa. Las versiones previas permanecen
intactas. El siguiente límite científico es la escasa diversidad temporal/espacial
y la simplificación de disponibilidad y carga de trabajo.
