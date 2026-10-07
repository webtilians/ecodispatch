# EcoDispatch v0.8 — Robustness methodology

v0.8 strengthens the paired lambda-ablation study without changing the normal
day generator or selecting favorable scenarios.

## 1. Primary comparison and baselines

The main scientific comparison is **EcoDispatch lambda versus EcoDispatch
lambda=0** on the same generated day. This isolates the future-coverage term:

```text
score(r,i) =
  immediate_cost(r,i)
  + lambda * (exposure_after - exposure_before)
```

Two external baselines are also reported:

- **ETA-greedy**: choose the feasible resource with minimum ETA.
- **Distance-greedy**: choose the feasible resource with minimum geodesic distance.

Distance-greedy is retained for historical continuity. Because resources have
different speeds, ETA-greedy is the stronger simple reactive baseline.

All policies receive the exact same incidents, start at the same k-median bases,
and reset the same fleet before every day.

## 2. Total harm including unserved incidents

ETA and severity-weighted delay are conditional on incidents that are served.
v0.8 therefore adds an explicit total-harm outcome:

```text
H =
  sum_served severity_i * ETA_i
  + K * sum_unserved severity_i^2
```

The default is `K=10`. The public UI also exposes `K=5` and `K=20` for
sensitivity analysis.

The quadratic severity term is an application-level modeling choice: it makes
missing a high-severity incident more costly than missing a low-severity one.
It is **not** claimed to be a calibrated real-world loss function. K changes
only the reported outcome metric, not the dispatch decisions.

## 3. Paired confidence intervals

For each day i and metric M:

```text
d_i = M_i(policy) - M_i(reference)
```

The existing normal-approximation interval is preserved:

```text
mean(d) +/- 1.96 * sample_sd(d) / sqrt(n)
```

v0.8 adds a paired percentile bootstrap check. Whole daily paired differences
are resampled with replacement, the mean difference is recomputed, and the
2.5% / 97.5% quantiles form the bootstrap interval.

Bootstrap resampling is deterministic for a given base seed, policy, reference
and metric. The default is 500 bootstrap replicates.

Neither interval is corrected for multiple comparisons.

## 4. Bootstrap probability of Pareto non-dominance

The descriptive three-objective front remains:

- maximize mean incidents served;
- minimize mean ETA;
- minimize mean distance.

For each bootstrap replicate, complete days are resampled with replacement,
policy means are recomputed, and the Pareto front is reconstructed.

For policy p:

```text
P_non_dominated(p) =
  (# bootstrap fronts containing p) / B
```

This is a stability measure for the sample-defined front. It is **not** a
posterior probability that a policy is truly optimal, and it does not define a
single winning lambda.

## 5. Paired protocol

Default policies:

```text
lambda in {0, 0.1, 0.2, 0.35, 0.5, 1, 2}
ETA-greedy
distance-greedy
```

Default study:

```text
500 normal-profile days
120 sequential incidents/day
500 bootstrap replicates
K = 10
```

Optional UI runs include 1000 days and K in {5,10,20}.

Scenario seed:

```text
base_seed | normal | day | index
```

No stress-test search or favorable-seed filtering is used in the ablation study.

## 6. Browser integration test

CI now launches the actual static site in Chromium with Playwright. It checks:

- the English page boots without critical console/page errors;
- ES/EN switching works;
- the ablation Web Worker completes a short paired run;
- the v0.6 Monte Carlo control can complete a short run;
- results become visible in the DOM.

This complements Node/Python model tests; it does not validate visual aesthetics.

## 7. Limitations

The model remains synthetic: geodesic distances, fixed speeds, no service
duration or simultaneous occupancy in the sequential day model, fixed fleet
and risk map, and no calibrated real-world harm function.

The stress-test demos remain separate from this normal-profile inference.

EcoDispatch is an independent prototype inspired by public OpenAI mathematics
results. The application-level objectives and current online policy do not
inherit theoretical guarantees from those results.
