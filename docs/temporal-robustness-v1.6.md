# Temporal Fire Robustness v1.6

**Exploratory robustness study. Not preregistered confirmation and not evidence
of operational efficacy.**

The sensitivity grid was fixed before outcomes in commit
`494e07b0a72da72669d05527c29c32404e391390`.

## What changed from v1.5

Nothing in the historical v1.5 result was rewritten. v1.6 reuses the frozen
temporal model but evaluates a pre-fixed sensitivity surface:

- service time: 45 / 90 / 180 minutes;
- harm penalty K: 10 / 60 / 120;
- three archived AEMET snapshots;
- low/high arrival regimes;
- 1,000 paired days per snapshot/load/service condition;
- lambda = 0, .2, .35, .5, 1 plus ETA- and distance-greedy;
- 500 paired bootstrap resamples versus lambda=0.

The same event stream is reused across service times and policies. K affects
evaluation only and never the dispatch decision.

## Why K=60 is included

Historical EcoDispatch uses

`H_K = sum_served severity*response_delay + K*sum_unserved severity^2`.

Under the current fire model the deadline is 120 minutes and severity is at
least 2. To ensure an unserved event is not assigned less harm than an event
served at the deadline solely because of the formula, require

`K*s^2 >= s*120`.

The worst allowed severity is s=2, so K>=60. Therefore K=60 is a logical
dominance-safe threshold for this simulator. It is **not** an empirical estimate
of real wildfire loss. K=120 is a conservative doubled sensitivity point.

## Fixed descriptive rule

A snapshot × load × service × K cell is:

- favorable when mean paired DeltaH < 0 and the bootstrap 95% upper bound < 0;
- unfavorable when mean paired DeltaH > 0 and the bootstrap 95% lower bound > 0;
- inconclusive otherwise.

A snapshot × load × K group is service-robust favorable only when all three
service times are favorable. Global service robustness at a K would require all
six snapshot/load groups to satisfy that rule.

These labels are descriptive, not multiplicity-adjusted hypothesis tests.

## Results

### lambda=.2

The v1.5 signal does not disappear, but it is weaker than a universal robustness
claim.

| K | favorable cells | inconclusive | unfavorable | service-robust groups |
|---|---:|---:|---:|---:|
| 10 | 12/18 | 6/18 | 0/18 | 2/6 |
| 60 | 12/18 | 6/18 | 0/18 | 2/6 |
| 120 | 11/18 | 7/18 | 0/18 | 2/6 |

So lambda=.2 has **no clearly unfavorable cell at any K**, but it also fails the
pre-fixed global service-robustness criterion. The correct reading is a partial,
directionally stable signal rather than confirmation.

At K=60 the two snapshot/load groups robust across all 45/90/180-minute service
times are the low-load October 8 and low-load October 11 forecast conditions.
Other groups contain at least one inconclusive service-time cell.

### larger lambda

The robustness surface strongly rejects the idea that more future weighting is
automatically better.

At K=60:

- lambda=.35: 6 favorable, 9 inconclusive, 3 unfavorable cells;
- lambda=.5: 0 favorable, 6 inconclusive, 12 unfavorable;
- lambda=1: **0 favorable, 0 inconclusive, 18 unfavorable**.

Thus the qualitative v1.4/v1.5 pattern survives the wider sensitivity grid:
aggressive future weighting can systematically damage the current-response
objective.

### why service sensitivity matters

Service time changes the state itself, not merely reporting. Longer service
creates different busy intervals, queue states and future release positions.
The fact that some lambda=.2 intervals cross zero at 90 or 180 minutes means the
benefit is not invariant to the occupancy model.

This is scientifically useful: v1.6 narrows the claim instead of broadening it.

## What v1.6 supports

Within this simulator:

1. a small positive future-coverage term often improves synthetic harm relative
   to lambda=0;
2. that direction is not universal across service-time uncertainty;
3. lambda=1 is consistently too aggressive over the tested robustness surface;
4. changing K from the historical 10 to the dominance-safe 60 does not create a
   universal lambda=.2 result.

It does **not** identify a real-world optimal lambda.

## Remaining bottleneck

The dominant uncertainty has moved from code mechanics to domain calibration.
Further synthetic parameter sweeps will have diminishing scientific value
without real distributions for at least:

- wildfire incident arrival/location;
- brigade service duration;
- actual fleet/station availability;
- independent historical hazard periods.

A future confirmatory holdout should be considered only after those inputs are
better grounded, otherwise it would confirm behavior of a synthetic workload,
not emergency operations.

## Artifacts

- fixed design: `docs/temporal-robustness-v1.6-design.md`;
- protocol: `data/temporal-robustness-v1.6/protocol.json`;
- deterministic runner: `scripts/run_temporal_robustness_v1_6.cjs`;
- result: `web/data/temporal-robustness-v1.6.json`;
- CSV: `web/data/temporal-robustness-v1.6.csv`;
- report: `results/temporal-robustness-v1.6-report.md`.
