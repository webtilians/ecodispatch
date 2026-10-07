# EcoDispatch

EcoDispatch is a research prototype for allocating scarce mobile resources
(ambulances, wildfire brigades, drones, rescue teams, inspection crews, etc.)
using a hierarchical optimization architecture inspired by recent results in
metric **k-median**, **maximum matching**, and **k-server**.

## Current architecture (v0.9.1)

1. **Pre-positioning** — risk-weighted metric k-median chooses where resources
   should wait before incidents are known.
2. **Simultaneous crisis dispatch** — EcoDispatch uses one canonical
   lexicographic objective: **maximize total severity covered → maximize number
   of incidents served → minimize secondary response cost**.
3. **Sequential online dispatch** — an experimental risk-aware potential policy
   trades immediate response cost against degradation of future risk coverage.
4. **Benchmarking** — small exact matching/k-server oracles, Monte Carlo
   validation, and the paired lambda ablation are used to measure behavior.

The exact small-instance algorithms are validation oracles. OpenAI results
#125, #120 and #110 motivate the placement, matching and online layers
respectively, but EcoDispatch's severity priority, weighted objectives and
current online potential policy are application-level extensions and do not
inherit those papers' guarantees.

## Run the demo

```bash
python examples/demo.py
```

## Run tests

```bash
python -m unittest discover -s tests
```

See [`docs/math_spec.md`](docs/math_spec.md) for the mathematical formulation
and research notes.

## Status

Research prototype. Not intended for operational emergency dispatch without
domain validation, calibrated risk models, real travel-time data, safety
constraints, and human oversight.


## Visual dashboard

The repository includes a static research dashboard in `web/`.

When GitHub Pages is enabled with **GitHub Actions** as the source, it is designed
to publish at:

https://webtilians.github.io/ecodispatch/

The dashboard shows:

- current synthetic placement and dispatch geometry;
- coverage, k-median objective and selected bases;
- online movement versus the exact offline k-server optimum;
- an evolution log with screenshot slots for each milestone.

### Add a milestone screenshot

1. Put the image in `web/assets/screenshots/`.
2. Add the version entry to `web/data/timeline.json`.
3. Set its `screenshot` field, for example:

```json
"screenshot": "./assets/screenshots/v0.2-wildfire-simulation.png"
```

The Pages workflow redeploys automatically after changes under `web/`.


## Live simulator

The public dashboard now includes a reproducible browser simulation.

- Choose a seed and 4–10 incidents.
- Run, pause or step through incidents.
- Switch the map between EcoDispatch, greedy and offline views.
- Compare served incidents, secondary cost and movement distance live.
- The offline policy is solved exactly by dynamic programming for the generated
  finite sequence and is used only as a lower-bound benchmark.

The current simulator is deliberately synthetic and sequential. Its assumptions
are shown on the page so future versions can replace Euclidean distance,
instant resource availability and single-incident arrival with real road graphs,
service durations and simultaneous emergency batches.


## v0.3 real geography

The browser simulator now renders on a real OpenStreetMap view of Málaga /
Montes de Málaga.

- Candidate bases and demand nodes are projected onto real geographic coordinates.
- Risk-weighted k-median is recomputed using haversine distance in kilometres.
- Live resource movement is drawn directly on the map.
- Las Contadoras is shown as an official geographic reference point.
- Emergency events and candidate/selected bases remain synthetic and are
  explicitly labelled as such.

Road routing is **not** implemented yet. v0.3 uses geodesic distance and resource
speed. The next research step is a road/track graph so ETA follows real routes
instead of straight-line distance.


## v0.4 — demo visual robusta y en español

La web pública deja de depender de Leaflet/OpenStreetMap para su visualización
principal. El simulador usa ahora un mapa táctico SVG local, por lo que funciona
incluso cuando los CDN o las teselas externas no cargan.

Cambios principales:

- interfaz completa en español;
- mapa táctico local sobre coordenadas reales de Málaga, marcado como esquema no cartográfico;
- recursos con identidad visual (brigada, ambulancia, dron y unidad móvil);
- rutas, incidente activo y siguiente incidente visibles en el mapa;
- explicación textual de cada decisión de EcoDispatch;
- comparación visual EcoDispatch vs greedy vs óptimo offline;
- misma reproducibilidad por semilla y mismo benchmark exacto offline para secuencias pequeñas.

Las bases e incidentes siguen siendo sintéticos y la v0.4 todavía calcula ETA
con distancia geodésica. El siguiente paso matemático/geoespacial será introducir
rutas reales de carretera/pista sin volver a hacer de un servicio externo una
dependencia crítica de la demo.


## v0.5 — three-experiment research suite + ES/EN

The public site now separates efficiency into three reproducible experiments:

1. **Pre-positioning** — exact risk-weighted k-median is compared with the average
   objective across all possible 3-base deployments.
2. **Simultaneous crisis** — a small exact lexicographic matching oracle maximizes
   feasible coverage first, then minimizes secondary cost, and is compared with
   a severity-ordered nearest-resource greedy baseline.
3. **Full operating day** — 120 sequential incidents compare greedy dispatch
   against a risk-aware online potential policy that penalizes decisions that
   degrade future coverage.

The interface is fully bilingual (Spanish / English). The language can be chosen
from the header and is persisted locally; `?lang=en` is suitable for sharing the
English version directly.

Stress mode deliberately searches for hard allocation/coverage cases and labels
them as stress tests. Those results are not presented as average-case performance.

The site also states explicitly that EcoDispatch is an independent prototype
inspired by public OpenAI mathematics results and is not affiliated with or
endorsed by OpenAI.


## v0.6 — scientific validation

v0.6 addresses two problems found while auditing v0.5.

### Crisis objective

The simultaneous-crisis optimizer no longer treats an unserved severe incident
as cost-free. Its exact lexicographic objective is now:

1. maximize total severity covered;
2. maximize number of incidents served;
3. minimize secondary response cost among solutions tied on (1) and (2).

This prevents a lower-cost solution from looking better merely because it drops
a more severe incident.

### Canonical objective alignment

The browser crisis optimizer, `src/ecodispatch/core.py`, Python tests and
`docs/math_spec.md` use the same severity → cardinality → secondary-cost
ordering. Historical v0.5 text describes the older experiment and should not be
read as the current objective.

### Monte Carlo validation

The public dashboard now includes a normal-profile Monte Carlo benchmark with
500 scenarios by default and an optional 1000-scenario run. Stress-test search
is explicitly excluded from this aggregate validation.

For crisis and full-day experiments the browser reports means, empirical
P5/P50/P95 values, win/loss frequencies, and 95% confidence intervals for mean
differences (normal approximation). Raw per-scenario results can be exported as
JSON or CSV.

This remains a synthetic research benchmark, not evidence of real-world
emergency-response performance.

## v0.7 — Paired lambda ablation / Ablación pareada de lambda

The web now compares λ = 0, 0.1, 0.2, 0.35, 0.5, 1, 2 and Greedy on identical normal-profile days (500 by default, 1000 optional). It reports coverage, mean ETA, mean daily P95, distance and severity-weighted delay, with paired 95% CIs against λ=0 and Greedy, a descriptive three-objective Pareto front, interactive ES/EN views and full JSON/CSV exports. No single best lambda is assumed. The v0.6 Monte Carlo remains available.

La web compara las mismas jornadas para siete lambdas y Greedy, sin selección favorable. Incluye cinco métricas, IC95 pareados, frente de Pareto descriptivo, interfaz ES/EN y exportación completa, conservando Monte Carlo v0.6.

[Methodology / Metodología](docs/ablation-v0.7.md) · [English study](https://webtilians.github.io/ecodispatch/?lang=en#ablation) · [Estudio en español](https://webtilians.github.io/ecodispatch/?lang=es#ablation)


## v0.8 — robustness checks

v0.8 makes `lambda=0` the primary ablation reference, so the effect of the
future-coverage term is isolated from the rest of the EcoDispatch immediate-cost
policy.

It adds:

- **ETA-greedy** alongside the historical distance-greedy baseline;
- total harm
  `H = sum_served(severity*ETA) + K*sum_unserved(severity^2)`, with
  `K=10` by default and 5/10/20 sensitivity options;
- paired percentile-bootstrap 95% confidence intervals alongside the existing
  paired normal-approximation intervals;
- bootstrap probability of membership in the descriptive coverage/ETA/distance
  Pareto front;
- Playwright/Chromium CI that boots the real site, exercises language switching,
  runs the ablation Web Worker and starts a short Monte Carlo validation.

No single lambda is declared best without an explicit utility function.

[Methodology / Metodología v0.8](docs/ablation-v0.8.md) ·
[English study](https://webtilians.github.io/ecodispatch/?lang=en#ablation) ·
[Estudio en español](https://webtilians.github.io/ecodispatch/?lang=es#ablation)


## v0.9 — preregistered holdout

v0.9 separates exploration from confirmation. The confirmatory protocol was
committed **before holdout results** in
[`docs/holdout-v0.9-preregistered.md`](docs/holdout-v0.9-preregistered.md)
(commit `017cda8cf011a89794d987ad65658249df60b2f9`).

Frozen primary analysis:

- new seed family: `ecodispatch-holdout-09|normal|day|index`;
- 1000 paired normal-profile days;
- `K=10`;
- primary lambdas `{0.2, 0.35, 0.5, 1}` versus `lambda=0`;
- primary outcome: paired total-harm difference;
- confirmation requires mean ΔH < 0, paired bootstrap 95% CI entirely below
  zero, and a Holm-adjusted two-sided normal-approximation p-value < 0.05;
- K=5/20 and other metrics remain secondary/exploratory.

The public holdout UI exposes no editable primary parameters. Re-running it is
deterministic; it cannot create a different seed draw.


## v0.9.1 — frozen result and stable tiny p-values

v0.9.1 is a conservative reporting patch. It does **not** change the model,
holdout seed family, preregistered hypothesis, scenarios, bootstrap samples or
decision rule.

The real v0.9 holdout result is frozen in compact canonical form at:

- `results/holdout-v0.9.1-summary.json`
- `results/holdout-v0.9.1-report.md`

The original exported raw JSON had:

- SHA-256: `38b912b0941e4ab8edb9c9da9c7e12d4da4d4c0f3f8b4d82fe911573b3132985`
- size: `2,868,071` bytes
- generated at: `2026-10-07T21:29:46.627Z`

The v0.9 implementation displayed extremely small normal-approximation p-values
as zero because it evaluated `2*(1-Phi(z))`, which loses precision in the far
tail. v0.9.1 uses a stable complementary-error-function tail calculation.
Frozen means, SDs and n produce:

- λ=0.2: raw/ Holm p ≈ `3.58e-17`;
- λ=0.35: raw p ≈ `9.03e-19`, Holm p ≈ `1.81e-18`;
- λ=0.5: raw p ≈ `3.34e-23`, Holm p ≈ `1.00e-22`;
- λ=1: raw p ≈ `1.27e-31`, Holm p ≈ `5.07e-31`.

The PASS/CONFIRMED conclusion is unchanged. The public Holdout section now
loads this frozen result by default rather than requiring another simulation.
