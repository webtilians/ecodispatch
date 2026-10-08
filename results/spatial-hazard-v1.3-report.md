# v1.3 exploratory results

real-routing + real fire-hazard spatial benchmark. Not confirmatory and not evidence of real-world efficacy.

Seed: `ecodispatch-spatial-hazard-13-exploratory-20261008`; 1,000 paired synthetic days × 120 incidents; K=10; 500 paired bootstrap replicates.

## All types

| Policy | Coverage % | ETA min | P95 min | km | CO2 kg | totalHarm | Δ harm vs λ=0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 96.928 | 39.118 | 89.762 | 1736.261 | 316.060 | 16401.360 | 0.000 |
| 0.2 | 97.042 | 39.056 | 89.776 | 1733.700 | 315.177 | 16374.918 | -26.441 |
| 0.35 | 97.177 | 38.975 | 89.924 | 1735.947 | 314.739 | 16341.135 | -60.225 |
| 0.5 | 97.262 | 38.905 | 90.042 | 1734.943 | 314.298 | 16308.258 | -93.101 |
| 1 | 97.448 | 38.942 | 90.147 | 1725.239 | 314.006 | 16319.023 | -82.336 |
| eta-greedy | 96.907 | 39.115 | 89.755 | 1737.256 | 316.301 | 16399.991 | -1.368 |
| distance-greedy | 97.873 | 39.303 | 90.143 | 1619.315 | 299.516 | 16491.521 | 90.161 |

## Fire only

| Policy | Coverage % | ETA min | P95 min | km | CO2 kg | totalHarm | Δ harm vs λ=0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| 0.2 | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| 0.35 | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| 0.5 | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| 1 | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| eta-greedy | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |
| distance-greedy | 98.885 | 57.735 | 99.795 | 927.754 | 213.383 | 9601.722 | 0.000 |

Coverage is served/incident count (aggregate); ETA and P95 are means of per-day served-event metrics, not a pooled percentile. Zero-served days are omitted for ETA/P95 and counted by the JSON missing field. Paired CIs and every metric delta are in the static JSON. totalHarm is synthetic severity × delay plus 10 × severity² for unserved events, not lives or observed damage.

The spatial exposure changes from 1493.2859238983153 to 944.566923898315. All policy outcomes equal the synthetic-weight control on the SAME NEW seeds: true. A single fire-capable brigade makes fire assignment invariant to lambda and the ordinal fire weights; medical/recon potential differences are unchanged. Fire-only policy differences are therefore structurally zero. Aggregate differences between lambdas arise from medical/recon synthetic weights. This benchmark validates integration, not fire-dispatch benefit. No fleet changes were made to manufacture an effect.

Historical v1.1.1 holdout was neither reused nor used as confirmation. Source and transformations: [methodology](../docs/spatial-hazard-v1.3.md).
