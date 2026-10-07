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
