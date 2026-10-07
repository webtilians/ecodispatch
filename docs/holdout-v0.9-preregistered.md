# EcoDispatch v0.9 — Pre-registered holdout protocol

**Status:** FROZEN BEFORE HOLDOUT RESULTS  
**Date:** 2026-10-07  
**Purpose:** confirm or fail to confirm the v0.8 exploratory finding that a moderate
future-coverage penalty improves total harm relative to the same EcoDispatch
policy with `lambda = 0`.

This file defines the primary v0.9 analysis. It must not be edited in response to
holdout results. Any later deviation must be documented as exploratory.

## Frozen data-generating protocol

- Profile: **normal only**; no stress-test search.
- Holdout seed family: `ecodispatch-holdout-09|normal|day|index`.
- Number of days: **1000**.
- Incidents per day: **120**.
- Every candidate policy receives the **same incidents on the same day**.
- Fleet, placement, risk map, capability rules and event generator are frozen at
  the v0.8 model unless a bug makes execution impossible.
- Historical development seed `ecodispatch-mc-06` is not used in the holdout.

## Frozen primary policy family

The confirmatory family is exactly:

```text
lambda in {0.2, 0.35, 0.5, 1}
```

Each policy is compared with **EcoDispatch lambda = 0**.

`ETA-greedy`, `distance-greedy`, `lambda=0.1` and `lambda=2` may be
reported descriptively but are not part of the primary confirmatory family.

## Frozen primary outcome

Primary outcome:

```text
H =
  sum_served severity_i * ETA_i
  + 10 * sum_unserved severity_i^2
```

Thus `K = 10` is confirmatory. `K = 5` and `K = 20` are sensitivity
analyses only and cannot rescue a failed K=10 confirmatory result.

For each primary lambda:

```text
d_i(lambda) = H_i(lambda) - H_i(lambda=0)
```

Negative differences favor the future-coverage policy.

## Frozen confirmation rule

A lambda is **individually replicated** only if all of the following hold:

1. mean paired `Delta H < 0`;
2. the pointwise paired percentile-bootstrap 95% CI for `Delta H` is entirely
   below zero;
3. the two-sided paired test for mean `Delta H = 0`, using the normal
   approximation from the paired daily differences, remains significant after
   **Holm correction across the four primary lambdas** at family-wise
   `alpha = 0.05`.

The v0.8 claim that "some moderate future-coverage penalty reduces total harm"
is considered **CONFIRMED** if at least one pre-registered primary lambda passes
all three conditions. Otherwise the confirmatory result is **FAIL TO CONFIRM**.

No lambda is called globally optimal from this holdout.

## Secondary outcomes

Coverage, mean ETA, daily P95 ETA, distance and served severity-delay are
reported for interpretation. They are not used to redefine success after seeing
results.

The following are exploratory/descriptive:

- Pareto-front membership;
- bootstrap probability of non-dominance;
- comparisons with ETA-greedy or distance-greedy;
- K=5 or K=20 sensitivity;
- choosing among primary lambdas after observing the holdout.

## Multiplicity

For the four primary `Delta H` comparisons, raw two-sided normal-approximation
p-values are corrected by the Holm step-down procedure. Pointwise normal and
bootstrap CIs are still displayed, but confirmatory PASS also requires the
Holm-adjusted p-value to be below 0.05.

## Interpretation

This holdout remains a synthetic-model replication. Confirmation would support
the claim **within this frozen simulator** that adding future-coverage
information improves the pre-defined harm outcome relative to the same policy
with `lambda=0`. It would not establish real-world emergency-response efficacy.

EcoDispatch is independent and is not affiliated with or endorsed by OpenAI.
