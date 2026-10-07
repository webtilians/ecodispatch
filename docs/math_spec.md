# EcoDispatch — Mathematical specification (current through v0.7)

This document defines the **current canonical objectives** used by EcoDispatch.
Historical versions used a different crisis ordering; since v0.6 the crisis
objective is severity-first. The browser model, Python validation core, tests,
and this specification are intended to stay aligned.

## 1. Slow layer: risk-weighted k-median

Let `J` be demand/risk nodes, `F` candidate bases, and `k` the number of
positions that may be opened. Each demand node has weight `w_j`, interpreted as
expected event probability multiplied by expected harm.

We minimize

```text
min_{S subset F, |S| <= k} sum_j w_j min_{f in S} d(j,f)
```

Small instances are solved exactly by enumeration. OpenAI math result #125 is
relevant to the long-term scalable metric k-median layer; the current exact
enumeration is a validation oracle, not an implementation of that approximation
algorithm.

## 2. Fast layer: simultaneous crisis dispatch

For resources `R` and incidents `I`, an edge `(r, i)` is feasible only if
the resource has the required capability and can arrive before the incident
deadline.

Let `x_ri in {0,1}` indicate that resource `r` is assigned to incident `i`.
Each resource and incident may appear in at most one assignment.

EcoDispatch uses the following **lexicographic objective**:

### Tier 1 — maximize total severity covered

```text
maximize sum_{r,i} severity_i * x_ri
```

This prevents a cheaper solution from appearing better merely because it leaves
a more severe incident unserved.

### Tier 2 — maximize number of incidents served

Among solutions tied on total covered severity:

```text
maximize sum_{r,i} x_ri
```

### Tier 3 — minimize secondary response cost

Among solutions tied on tiers 1 and 2:

```text
minimize sum_{r,i} x_ri * (
  alpha * severity_i * ETA_ri
  + beta * CO2_ri
  + gamma * distance_ri
)
```

The current prototype uses `alpha=1`, `beta=0.0005`, and `gamma=0.05`.

OpenAI result #120 concerns maximum-cardinality matching and motivates the
matching layer. The **severity-first priority and weighted secondary objective
are EcoDispatch application-level extensions**; they should not be attributed
to result #120.

The Python function `dispatch_lexicographic` and the browser crisis optimizer
implement this same ordering on small instances.

## 3. Sequential online policy

For a feasible resource `r` responding to incident `i`, the current online
EcoDispatch policy evaluates

```text
score(r, i) =
  severity_i * ETA_ri
  + 0.0005 * emissions_g
  + 0.05 * distance_km
  + lambda * (exposure_after - exposure_before)
```

where exposure is the fixed risk-weighted expected ETA of the nearest capable
resource across demand nodes and incident types.

The policy does **not** know future incidents. `lambda=0` is immediate-cost
EcoDispatch and is not equivalent to nearest-distance Greedy.

v0.7 studies

```text
lambda in {0, 0.1, 0.2, 0.35, 0.5, 1, 2}
```

on paired normal-profile days. See `docs/ablation-v0.7.md`.

OpenAI result #110 motivates the online resource-movement problem, but the
current potential policy is an EcoDispatch experiment and does not inherit the
paper's theoretical competitive guarantee.

## 4. Small k-server benchmark

For pure finite k-server experiments, movement cost is

```text
C_T = sum_t d(q_{s_t}(t-1), request_t)
```

and the prototype can compute an exact offline optimum on small instances:

```text
rho_T = C_online / OPT_T
```

This remains a benchmark layer rather than the production dispatch policy.

## 5. Research mapping

- **OpenAI #125 metric k-median** → preventive placement inspiration.
- **OpenAI #120 maximum-cardinality matching** → simultaneous matching
  inspiration; EcoDispatch adds severity-first and weighted-cost priorities.
- **OpenAI #110 k-server** → online movement inspiration and benchmark;
  EcoDispatch's current online policy is not that released algorithm.

## 6. Current model limitations

The public experiments are synthetic. They use real Málaga coordinates but
geodesic travel distances, fixed resource speeds, a fixed fleet and risk map,
instant availability after service in the sequential model, and no calibrated
real-world emergency data.

Stress tests are demonstrations and are excluded from Monte Carlo inference.
The normal-profile validation and lambda ablation are reproducible synthetic
benchmarks, not evidence of real-world operational effectiveness.

## References

OpenAI public mathematics repository: https://github.com/openai/math
