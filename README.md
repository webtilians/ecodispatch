# EcoDispatch

EcoDispatch is a research prototype for allocating scarce mobile resources
(ambulances, wildfire brigades, drones, rescue teams, inspection crews, etc.)
using a hierarchical optimization architecture inspired by recent results in
metric **k-median**, **maximum matching**, and **k-server**.

## v0.1 architecture

1. **Pre-positioning** — risk-weighted metric k-median chooses where resources
   should wait before incidents are known.
2. **Dispatch** — maximum feasible coverage is optimized first; among all
   maximum-cardinality assignments, EcoDispatch minimizes a secondary cost
   combining severity-weighted ETA, emissions, and travel distance.
3. **Online benchmark** — a small-instance k-server benchmark compares an online
   policy against the exact offline optimum.

The current implementation intentionally uses transparent exact algorithms on
small instances. The modules are designed so that they can later be replaced by
scalable implementations of the new theoretical algorithms.

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
