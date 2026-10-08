# Temporal Fire Robustness v1.6 — fixed exploratory design

This design is committed **before any v1.6 robustness outcomes are generated**.
It is not preregistered confirmation and it does not modify historical v1.5
results.

## Question

The v1.5 exploratory signal around small positive lambda was observed under one
modeled service time (90 min) and one historical harm penalty (K=10). v1.6 asks:

> Does the qualitative direction survive reasonable, outcome-independent
> sensitivity changes in brigade occupancy and in the scoring of unserved fires?

The experiment does **not** tune service time or K to maximize EcoDispatch.

## Frozen inherited model

v1.6 inherits without changing:

- the three archived v1.4 AEMET spatial snapshots;
- low/high v1.5 arrival regimes;
- three modeled brigades at B2/B3/B4;
- 24 h horizon;
- 120 min response deadline;
- uniform event locations over the ten routing-eligible demand nodes;
- severity U[2,5);
- OSM/OSRM road movement;
- v1.5 queue discipline and temporal future-coverage potential;
- lambda set {0,.2,.35,.5,1}, ETA-greedy and distance-greedy.

AEMET classes remain ordinal hazard weights, not incident probabilities.

## Service-time sensitivity fixed before outcomes

Service time is varied over exactly:

- **45 min** — half the v1.5 modeled value;
- **90 min** — the v1.5 baseline;
- **180 min** — double the v1.5 modeled value.

These values are deliberately mechanical half/baseline/double sensitivity
points. They are not empirical estimates of wildfire suppression duration.

The same synthetic event stream is used across all three service-time conditions
for a given snapshot/load/day.

## Harm sensitivity fixed before outcomes

For every realized dispatch trajectory we report:

`H_K = sum_served severity*response_delay + K*sum_unserved severity^2`

for exactly:

- **K=10** — historical EcoDispatch reporting value;
- **K=60** — logical dominance-safe threshold under the current model;
- **K=120** — twice that threshold.

Why K=60? The response deadline is 120 min and allowed severity is s>=2. We want
the unserved penalty not to be smaller than the maximum served severity-delay at
the deadline:

`K*s^2 >= s*120`

so

`K >= 120/s`.

The worst case is the minimum severity s=2, giving K>=60.

This does **not** make K=60 a real-world loss estimate. It only removes the
specific scoring pathology where an unserved low-severity event can be assigned
less synthetic harm than a late-but-served event. K never enters the dispatch
score, so changing K changes evaluation only, not decisions.

## Paired design

For each of:

- 3 fixed AEMET snapshots;
- 2 fixed load regimes;
- 3 fixed service times;

run 1,000 paired synthetic days with a fresh v1.6 seed family. The identical
event stream is supplied to every policy and every service-time condition.
For each realized trajectory, evaluate K={10,60,120}.

Paired percentile-bootstrap intervals use 500 resamples versus lambda=0.

## Descriptive robustness labels

A cell is one snapshot × load × service time × K.

For a lambda:

- **negative cell**: mean paired DeltaH < 0 and bootstrap 95% upper bound < 0;
- **positive cell**: mean paired DeltaH > 0 and bootstrap 95% lower bound > 0;
- otherwise: **inconclusive**.

For a fixed snapshot × load × K, a lambda is **service-robust negative** only if
all three service times are negative cells.

At a fixed K, **global service robustness** requires service-robust negative
behavior in all six snapshot × load combinations.

These are descriptive labels, not hypothesis-test confirmation. There is no
Holm correction, no familywise PASS rule and no declaration of a globally
optimal lambda.

## Outcomes

Primary robustness display:

- paired DeltaH and bootstrap interval;
- negative / inconclusive / positive cell counts;
- service-robust counts by K.

Operational context remains visible:

- coverage;
- unserved count;
- mean/P95 response delay;
- queue wait;
- distance and approximate CO2;
- utilization and all-busy arrivals.

## Claim boundary

Real/frozen layers:
- OSM/OSRM road matrix;
- archived official AEMET danger rasters.

Modeled/synthetic:
- fleet and stations;
- arrivals and incident locations;
- severity;
- all three service-time scenarios;
- emissions;
- every K-based harm function.

v1.6 can test internal robustness of the simulator. It cannot estimate real
Málaga wildfire performance or validate a real emergency-dispatch policy.
