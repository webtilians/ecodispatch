# Temporal Fire Operations v1.5 — fixed exploratory design

This design is fixed **before v1.5 policy outcomes are generated**. It is not a
preregistration or confirmatory protocol. Historical EcoDispatch artifacts through
v1.4 remain unchanged.

## Question

Does preserving future spatial fire coverage change outcomes once brigades can be
busy at the same time?

v1.4 had three brigades but zero service time and sequential immediate reuse. v1.5
adds an explicit 24-hour clock, stochastic arrivals, non-zero service time and brigade
availability.

## Frozen real layers

- road movement: existing frozen OSM/OSRM matrix `routing-v1.0.json`;
- fire hazard: the three already-selected official AEMET rasters from v1.4;
- ten demand nodes and the <=500 m routing snap gate are inherited unchanged.

AEMET class codes remain ordinal danger classes 1..6. They are **not probabilities**.

## Experimental fleet

Three modeled fire brigades, not an official Málaga operational inventory:

- F-01 at B2;
- F-02 at B3;
- F-03 at B4.

All use the frozen road matrix and modeled 230 g CO2/km.

## Temporal process fixed before outcomes

Each replicate spans 1,440 minutes. Fire arrivals follow a homogeneous Poisson
process implemented with exponential inter-arrival times. Locations are sampled
uniformly over the ten eligible nodes and therefore remain independent of AEMET.

Two load regimes are fixed before comparison:

| regime | expected fires / 24 h | mean inter-arrival |
|---|---:|---:|
| low | 12 | 120 min |
| high | 36 | 40 min |

Severity is U[2,5). Every incident has a 120-minute response deadline. Service time
is fixed at **90 minutes**, synthetic and identical for all incidents. A brigade
becomes busy at dispatch and becomes available after road travel plus 90 minutes
of service; it remains at the served incident node.

These load and service parameters are not tuned after seeing lambda performance.

## Queue and feasibility

Occupied brigades are never eligible for dispatch. Incidents can wait.

At every arrival, brigade release or queued-incident deadline, the simulator:

1. updates which brigades are free;
2. expires queued incidents whose 120-minute deadline has passed;
3. scans the queue in arrival order and dispatches the oldest incident for which at
   least one **currently free** brigade can still arrive before its deadline;
4. repeats until no queued incident has a feasible free brigade.

Response delay is queue wait + road ETA. A queued incident that is not dispatched
before its deadline is unserved.

## Coverage potential

At dispatch time t:

`Phi(t) = sum_node hazard(node) * min_r [max(0, available_at_r - t) + roadETA(release_position_r,node)]`

A busy brigade's release position is the incident it is currently serving. For a
candidate assignment, the selected brigade's hypothetical release time becomes
dispatch time + travel ETA + 90 minutes and its release position becomes the new
incident node.

The policy score is:

`severity * response_delay + 0.0005 * emissions_g + 0.05 * distance_km + lambda * (Phi_after - Phi_before)`

with lambda in {0, .2, .35, .5, 1}; ETA-greedy and distance-greedy are descriptive
baselines.

## Paired study

For each of the three frozen AEMET snapshots and both fixed load regimes:

- 1,000 synthetic replicate days;
- identical event stream supplied to every policy within a replicate;
- fresh v1.5 seed family only;
- 500 paired bootstrap replicates versus lambda=0.

Metrics include coverage, unserved count, wait, response delay, travel ETA, P95
response delay, km, CO2, totalHarm, brigade utilization, concurrency and free-brigade
state shares.

No lambda is selected as optimal and no historical holdout seed is reused.

## Claim boundary

Real: frozen road-network movement and archived AEMET spatial hazard.

Synthetic/modelled: stations/fleet, arrival process, incident location process,
severity, service time, emissions and the harm function.

v1.5 can reveal behavior of the temporal model. It cannot establish emergency
response efficacy or estimate real Málaga wildfire demand.
