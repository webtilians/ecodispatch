# Historical Demand Replay v1.7.1

**Exploratory historical-demand replay. Not operational validation.**

v1.7.1 changes one major layer of the v1.6 temporal experiment: synthetic
Poisson arrival times and synthetic demand-node locations are replaced by
observed Málaga EGIF detection timestamps and coordinates. The service model is
not calibrated here; that remains explicitly deferred to v1.7.2.

The fixed pre-outcome design is in
[`historical-demand-replay-v1.7.1-design.md`](historical-demand-replay-v1.7.1-design.md).

## Frozen cohort

The source is the v1.7 EGIF extraction. The cohort rule was fixed before replay
outcomes.

- years: **2006–2023**;
- candidate EGIF parts: **1,467**;
- reason for the 2006 boundary: every EGIF part has a screened coordinate in
  every year from 2006 through 2023, while 2005 has 116 coordinates for 120
  parts;
- primary replay events: **1,464**;
- excluded: three detections recorded exactly at 00:00:00 and already flagged
  by v1.7 as `midnight_precision_unknown`;
- active fire days: **1,194**;
- total calendar days: **6,574**;
- zero-fire days: **5,380**.

No timestamp, timezone or coordinate is imputed. Source timestamps remain
unknown/local-naive.

The demand freeze was produced in CI before any v1.7.1 dispatch runner existed.
Its exact artifact hashes and the three excluded incident IDs are recorded in
`data/historical-demand-v1.7.1/cohort-freeze.json`.

## Frozen road access

The original v1.0 matrix contains only the old base and demand nodes, so using it
alone would require snapping historical fires onto D1…D10 and would destroy the
spatial replay.

Before policy outcomes, a new sparse OSRM/OSM routing layer was acquired and
frozen:

- B2/B3/B4 → every historical event: **4,392** directed routes;
- event → each of the ten inherited potential nodes: **14,640** routes;
- event → event within the same historical day: **682** directed routes.

Total sparse routes: **19,714**.

Frozen routing SHA-256:

`026144ac508b7834c1f0ee9e6bb66277ac0b6f799bc44c532cef6c14c29ec640`

Road snapping is retained as a diagnostic rather than used as a retrospective
exclusion rule. Across the 1,464 replay events:

- median snap distance: **72.6 m**;
- P95: **605.6 m**;
- maximum: **5,101.7 m**;
- 96 events exceed 500 m;
- 13 exceed 2 km;
- one exceeds 5 km.

These are wildfire coordinates, so off-road distance is expected to matter.
The route means road access to the nearest routable point, not travel to the
exact fire front. The network is a frozen modern OSM/OSRM representation, not a
reconstruction of roads as they existed in 2006–2023.

## What stays fixed from v1.6

The replay deliberately does **not** calibrate everything at once.

Still modeled:

- three identical modeled fire brigades F-01/F-02/F-03 at B2/B3/B4;
- severity U[2,5), deterministically assigned per incident ID;
- response deadline: 120 min;
- service-time sensitivity: 45 / 90 / 180 min;
- emissions coefficient;
- synthetic harm evaluation K = 10 / 60 / 120;
- lambda = 0 / .2 / .35 / .5 / 1, ETA-greedy and distance-greedy.

The same historical incidents and the same modeled severity are supplied to
every policy, service time and hazard context.

The three frozen AEMET rasters are crossed with each historical day only as
**policy contexts**. They are 2026 forecasts and are not relabeled as historical
weather.

## Historical demand regime

The observed demand is radically sparser than the v1.5/v1.6 synthetic load
regimes.

Of 1,194 active days:

- **984** contain exactly one replay fire;
- **210** contain more than one;
- the maximum is **5 fires in a day**.

This matters because the future-coverage term can only repay an immediate
detour when later demand makes preserved spatial coverage useful.

## Main result

At the v1.6 structural reference K=60:

- λ=.2: **0/9 favorable, 0/9 inconclusive, 9/9 unfavorable**;
- λ=.35: **0/9 favorable, 0/9 inconclusive, 9/9 unfavorable**;
- λ=.5: **0/9 favorable, 0/9 inconclusive, 9/9 unfavorable**;
- λ=1: **0/9 favorable, 0/9 inconclusive, 9/9 unfavorable**;
- ETA-greedy: **9/9 inconclusive**, effectively matching λ=0;
- distance-greedy: **9/9 unfavorable**.

The same all-unfavorable pattern for λ>0 holds at K=10.

At K=120 the larger penalty on unserved incidents changes the trade-off:

- λ=.2/.35/.5: 6/9 unfavorable and 3/9 inconclusive;
- λ=1: 9/9 inconclusive;
- no positive-lambda policy has a favorable cell.

So the v1.6 small-positive-lambda signal **does not survive** the historical
demand substitution.

### Example: 90-minute service, October 8 AEMET context

| policy | coverage | mean response | unserved | km | ΔH60 vs λ=0 |
|---|---:|---:|---:|---:|---:|
| λ=0 | 87.23% | 62.21 min | 187 | 76,989.6 | reference |
| λ=.2 | 87.23% | 63.01 min | 187 | 77,072.6 | +0.502 |
| λ=.35 | 87.23% | 63.23 min | 187 | 77,322.4 | +0.642 |
| λ=.5 | 87.23% | 63.29 min | 187 | 77,363.7 | +0.687 |
| λ=1 | 87.43% | 64.39 min | 184 | 77,317.4 | +0.882 |
| ETA-greedy | 87.23% | 62.21 min | 187 | 77,003.3 | ~0 |
| distance-greedy | 87.43% | 65.65 min | 184 | 75,200.9 | +2.041 |

For λ=.2, 76 active days receive a different assignment from λ=0, yet coverage
and unserved count are identical in this cell; the difference is mainly a
longer immediate response path. λ=1 saves three additional incidents, but the
response-time cost still dominates H60. At K=120 that coverage trade-off becomes
statistically inconclusive rather than favorable.

## Interpretation

v1.6 showed that a small future-coverage term could improve synthetic harm in a
highly active modeled system. v1.7.1 shows that this effect is **regime
dependent**.

With historical EGIF demand, most active days contain a single fire and queue
wait is almost zero. Preserving future coverage therefore has few chances to
pay back an immediate detour. The λ=0 immediate-cost policy becomes almost
indistinguishable from ETA-greedy, while positive λ spends response time to
protect capacity that usually is not needed again soon enough.

This is a stronger scientific result than selecting a favorable lambda: it
identifies a boundary condition of the mechanism.

It does **not** prove that future-coverage optimization is useless in real
operations. EGIF is a wildfire incident archive, not the complete stream of all
INFOCA dispatch activity, and the three-brigade fleet and service times remain
modeled. A denser operational incident stream or different resource-release
process could change the result.

## Reproduce offline

No network access is required for the replay itself:

```sh
python scripts/verify_historical_demand_v1_7_1.py
python -m unittest tests.test_historical_routing_v1_7_1
node tests/historical-demand.test.cjs
node scripts/run_historical_demand_v1_7_1.cjs
```

Generated outputs:

- `web/data/historical-demand-v1.7.1.json` — full result, including annual
  aggregates;
- `web/data/historical-demand-v1.7.1-summary.json` — compact dashboard payload;
- `web/data/historical-demand-v1.7.1.csv` — one row per
  context × service × K × policy;
- `results/historical-demand-v1.7.1-report.md` — generated result table.

## v1.7.2 boundary

The next step, if suitable data can be obtained, is **operational service
calibration**: empirical resource arrival/release/service distributions and
historical fleet availability.

v1.7.1 must remain frozen when that work begins. Real demand and real service
times are separate evidence layers.
