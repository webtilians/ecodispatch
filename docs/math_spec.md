# EcoDispatch v0.1 — Mathematical specification

## 1. Slow layer: risk-weighted k-median

Let `J` be demand/risk nodes, `F` candidate bases, and `k` the number of
positions that may be opened. Each demand node has weight `w_j`, interpreted as
expected event probability multiplied by expected harm.

We minimize

```text
min_{S subset F, |S| <= k} sum_j w_j min_{f in S} d(j,f)
```

For v0.1, small instances are solved exactly by enumeration. The long-term
solver target is the deterministic `(1 + 2/e + epsilon)` approximation proved
in OpenAI math result #125 for metric k-median.

## 2. Fast layer: feasible dispatch

For resources `R` and incidents `I`, an edge `(r, i)` is feasible only if the
resource has the required capability and can arrive before the deadline.

Primary objective:

```text
maximize sum_{r,i} x_ri
```

subject to one incident per resource and one resource per incident.

Among maximum-cardinality assignments, EcoDispatch minimizes

```text
sum_{r,i} x_ri * (
  alpha * severity_i * ETA_ri
  + beta * CO2_ri
  + gamma * distance_ri
)
```

This is intentionally lexicographic: coverage first, harm/cost second.
OpenAI result #120 is relevant to the first step (maximum-cardinality
matching), not by itself to the weighted secondary objective.

## 3. Online movement benchmark

For pure sequential k-server experiments, the movement cost is

```text
C_T = sum_t d(q_{s_t}(t-1), request_t)
```

The prototype computes the exact offline optimum on small finite instances and
reports an empirical competitive ratio:

```text
rho_T = C_online / OPT_T
```

OpenAI result #110 proves an `O(log^2(k+1))` randomized k-server guarantee on
arbitrary metrics. Its released uniform construction is currently better
viewed as a theoretical benchmark for EcoDispatch than as a production
emergency-response implementation.

## 4. Research mapping

- **#125 metric k-median** -> preventive resource placement.
- **#120 maximum cardinality matching** -> maximum simultaneous feasible coverage.
- **#110 k-server** -> online movement benchmark and future policy layer.

## 5. Next experiment: wildfire response

Use real or simulated wildfire data with:

- grid cells / ignition locations as demand nodes;
- risk weight = ignition probability × ecological/human loss;
- candidate bases = ranger stations, water points, drone bases;
- resources = brigades, tankers, drones;
- incidents = ignition events;
- metric = road/track travel time for vehicles and flight-time metric for drones.

Evaluate mean ETA, p95 ETA, fraction served within deadline, severity-weighted
response delay, distance, emissions, and online/offline movement ratio.

## References

OpenAI public mathematics repository: https://github.com/openai/math
