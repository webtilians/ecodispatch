# EcoDispatch v1.1 — Pre-registered real-routing holdout

**Status:** FROZEN BEFORE HOLDOUT RESULTS  
**Date:** 2026-10-08  
**Purpose:** independently test whether the v1.0 exploratory finding survives
on a new seed family while keeping the real-routing domain frozen.

This file defines the confirmatory v1.1 analysis. It must not be edited in
response to holdout results. Any later deviation must be documented as
exploratory.

## Frozen routing/data domain

- Routing dataset: `malaga-real-routing-v1`.
- Routing source: frozen OSRM driving matrix over OpenStreetMap.
- Routing file: `web/data/routing-v1.0.json`.
- Snap quality rule: demand node eligible iff `snap_distance_m <= 500`.
- Eligible demand nodes remain the v1.0 set:
  `D0,D1,D2,D3,D4,D6,D7,D9,D10,D11`.
- Excluded demand nodes remain:
  `D5,D8`.
- Preventive placement remains:
  `B2,B3,B4`.
- Ground movement uses frozen OSRM duration/distance.
- Drone movement uses direct geodesic flight.
- Capability roles and synthetic deadlines remain exactly those documented in
  `docs/real-routing-v1.0.md`.

No routing dataset, snap threshold, bases, capability roles or deadlines may be
changed in response to v1.1 holdout results.

## Frozen holdout generator

- Seed family:
  `ecodispatch-real-routing-holdout-11|day|index`.
- Historical exploratory seed `ecodispatch-real-routing-10` is excluded.
- Number of days: **1000**.
- Incidents per day: **120**.
- Every policy receives the exact same incidents for a given day.
- Profile/domain: **real-routing exploratory generator frozen at v1.0**.
- No favorable-seed search or stress-test selection.

Risk weights, incidents and deadlines remain synthetic. v1.1 therefore tests
replication **inside the frozen real-routing simulator**, not real-world
emergency efficacy.

## Frozen primary policy family

Primary lambdas:

```text
lambda in {0.2, 0.35, 0.5, 1}
```

Each is compared with **EcoDispatch lambda=0**.

`ETA-greedy` and `distance-greedy` are reported descriptively only and are
not part of the confirmatory family.

## Frozen primary outcome

Primary outcome:

```text
H =
  sum_served severity_i * ETA_i
  + 10 * sum_unserved severity_i^2
```

Thus `K=10` is frozen.

For each primary lambda:

```text
d_i(lambda) = H_i(lambda) - H_i(lambda=0)
```

Negative differences favor the future-coverage policy.

## Frozen confirmation rule

A lambda is **individually replicated** only if all of the following hold:

1. mean paired `Delta H < 0`;
2. paired percentile-bootstrap 95% CI upper bound for `Delta H` is < 0;
3. the two-sided paired normal-approximation p-value remains significant after
   **Holm correction across the four primary lambdas** at family-wise
   `alpha=0.05`.

The v1.0 exploratory family claim — that at least one preregistered moderate
future-coverage lambda reduces total harm versus the identical policy with
`lambda=0` — is considered **CONFIRMED** if at least one of the four
pre-registered lambdas satisfies all three criteria.

Otherwise v1.1 is **FAIL TO CONFIRM**.

No lambda may be called globally optimal from this holdout.

## Secondary outcomes

The following are reported for interpretation but cannot redefine confirmation:

- incidents served;
- mean ETA;
- mean daily P95 ETA;
- distance;
- approximate CO2;
- served severity-delay;
- ETA-greedy and distance-greedy comparisons.

No post-hoc secondary metric may rescue a failed primary total-harm result.

## Multiplicity

For the four primary `Delta H` tests:

- raw two-sided paired normal-approximation p-values are computed from the
  daily paired differences;
- Holm step-down correction is applied across exactly the four primary lambdas;
- pointwise normal and bootstrap intervals are retained for transparency.

## CI / implementation isolation

Automated tests and CI must **never** execute the real holdout seed family.
They may exercise the real worker only with seeds beginning:

```text
ci-real-routing-holdout-
```

The first execution of
`ecodispatch-real-routing-holdout-11|day|index`
is reserved for the user after deployment.

## Interpretation

A positive v1.1 result would replicate the future-coverage effect under a frozen
real road-network travel-time model and a new independent seed family.

It would still not establish real-world operational effectiveness because risk,
incident occurrence, service duration and several emergency-response constraints
remain synthetic.

EcoDispatch is independent and is not affiliated with or endorsed by OpenAI.
