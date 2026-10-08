# Temporal Fire Operations v1.5

**Exploratory fixed-design temporal fire experiment. Not preregistered,
confirmatory, or evidence of operational efficacy.**

The design was fixed before outcomes in commit
`1b1a3836503384392565a06703b50d45c14dfd18`. The machine-readable protocol is
`data/temporal-fire-v1.5/protocol.json`.

## Why v1.5 exists

v1.3 proved that official AEMET spatial hazard could be sampled reproducibly but
one fire-capable resource made fire decisions invariant. v1.4 introduced three
brigades and showed that hazard-aware potential can change fire assignments, but
service time was zero: every brigade could be reused immediately after each event.

v1.5 adds the missing operational state: a clock, non-zero occupancy and a queue.

## Fixed temporal model

Each replicate covers 1,440 minutes. Arrivals are a synthetic homogeneous Poisson
process with two load regimes fixed before policy outcomes:

| Load | Expected fires / 24 h | Mean inter-arrival |
|---|---:|---:|
| low | 12 | 120 min |
| high | 36 | 40 min |

Incident locations are uniform across the ten routing-eligible nodes and are
independent of AEMET hazard. Severity is U[2,5). The response deadline is
120 minutes.

Every served event occupies its brigade for:

`road travel ETA + 90 minutes service`.

The 90-minute service is synthetic and fixed for the entire study. Brigades stay
at the served node after release. There is no return-to-station journey.

## Queue

Occupied brigades are not eligible. Incidents wait in a queue.

At arrivals, brigade releases and incident deadlines, the simulator scans queued
incidents in arrival order and dispatches the oldest incident for which at least
one currently free brigade can still arrive before the 120-minute deadline. It
continues until no feasible queued incident remains.

Response delay is:

`queue wait + road ETA`.

An incident not dispatched before its deadline is unserved.

## Temporal future-coverage potential

For state time t:

`Phi(t) = sum_j hazard_j * min_r [remaining_busy_time_r + roadETA(release_position_r,j)]`.

Thus a busy brigade still contributes to future coverage, but only after its
remaining occupancy. For a candidate assignment, the selected brigade's future
release becomes:

`dispatch time + travel ETA + 90 min`

at the incident node.

The EcoDispatch score remains:

`severity * response_delay + .0005 * emissions_g + .05 * km + lambda * (Phi_after - Phi_before)`.

AEMET classes are preserved as ordinal weights 1..6 and are never interpreted as
fire probabilities.

## Frozen real vs modeled layers

Real/frozen:
- OSM/OSRM road duration and distance matrix;
- three archived AEMET spatial danger forecasts already selected in v1.4.

Modeled/synthetic:
- three brigades and B2/B3/B4 station assignment;
- arrival rate and incident locations;
- severity;
- 90-minute service duration;
- emissions;
- total-harm objective.

The AEMET snapshots still come from one model issue and provide only two distinct
ten-node class profiles. They do not establish weather generalization.

## Results

Each AEMET snapshot × load regime has 1,000 paired replicate days and seven
policies. Bootstrap intervals use 500 paired resamples versus lambda=0.

A key change from v1.4 is genuine congestion. Under the high-load cells the
baseline averages roughly 36 incidents/day, about 74% coverage, around 18.5
minutes mean queue wait, ~22 arrivals/day while all three brigades are busy, and
about 80% mean brigade utilization.

### Descriptive lambda pattern

For lambda=.2, the mean total-harm difference versus lambda=0 is negative in all
six fixed snapshot/load cells. Five paired bootstrap 95% intervals are entirely
below zero; the low-load October 9 cell crosses zero.

For lambda=1, mean total harm is higher in all six cells and all six paired
bootstrap intervals are entirely above zero.

This is a descriptive pattern, not a selected optimum. The study has multiple
conditions and policies, no multiplicity-adjusted confirmatory rule, synthetic
demand/service, and little independent weather diversity.

### High-load examples

- valid Oct 9: lambda=.2 ΔH = -26.79, bootstrap [-47.01, -7.59];
- valid Oct 8: lambda=.2 ΔH = -25.65, bootstrap [-42.75, -11.88];
- valid Oct 11: lambda=.2 ΔH = -20.40, bootstrap [-35.18, -6.99].

The changes are small relative to the absolute harm scale and can trade tiny
coverage changes against response time, distance and future availability.

## Interpretation

v1.5 demonstrates that the future-coverage term operates in a model where choices
can leave brigades unavailable for later incidents. It does **not** show that the
AEMET-weighted policy is optimal or useful in real emergency operations.

The next scientific bottlenecks are no longer merely implementation details:
real incident arrival/location calibration, empirical service-time distributions,
real station/fleet availability and independent historical hazard periods would
all be needed before an operational claim.

Full outputs:

- `web/data/temporal-fire-v1.5.json`
- `web/data/temporal-fire-v1.5.csv`
- `results/temporal-fire-v1.5-report.md`
- `docs/temporal-fire-v1.5-design.md`
