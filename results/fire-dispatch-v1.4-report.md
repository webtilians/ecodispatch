# Fire Dispatch v1.4 — exploratory results

No preregistration, confirmation or operational efficacy claim. Real: frozen OSM/OSRM road matrix and official AEMET danger rasters. Synthetic: three brigades/stations, incidents, severity, emissions and zero service times.

Forecast validities may share one model issue. No independent historical AEMET archive was obtained. No temporal generalization or operational efficacy.

The October 8 and 11 snapshots have identical node-class vectors: only two distinct selected spatial profiles. Different snapshot seed streams cause sampling differences between their results; those are not hazard differences.

Each snapshot: 1,000 paired synthetic replicate days × 120 fire-only events. Three brigades start at B2/B3/B4 every replicate. See [methods](../docs/fire-dispatch-v1.4.md) and the [selection rule](../docs/fire-dispatch-v1.4-selection.md).

## Valid 2026-10-09T12:00:00Z · lead 48 h

| Policy | Coverage % | ETA min | P95 min | km | CO₂ kg | totalHarm | Δ harm vs λ=0 [paired bootstrap 95%] |
|---|---:|---:|---:|---:|---:|---:|---|
| 0 | 100.000 | 41.638 | 87.700 | 1585.650 | 364.699 | 17468.790 | 0.000 [0.000, 0.000] |
| 0.2 | 100.000 | 41.570 | 88.883 | 1578.120 | 362.968 | 17402.897 | -65.893 [-113.015, -12.316] |
| 0.35 | 100.000 | 41.785 | 94.744 | 1609.788 | 370.251 | 17424.048 | -44.742 [-116.840, 35.873] |
| 0.5 | 100.000 | 42.533 | 99.671 | 1640.162 | 377.237 | 17711.829 | 243.040 [159.172, 325.643] |
| 1 | 100.000 | 46.670 | 103.071 | 1846.352 | 424.661 | 19422.867 | 1954.078 [1863.894, 2050.394] |
| eta-greedy | 100.000 | 41.747 | 88.131 | 1596.944 | 367.297 | 17513.553 | 44.764 [28.923, 60.687] |
| distance-greedy | 100.000 | 43.011 | 91.938 | 1143.321 | 262.964 | 18059.472 | 590.683 [505.732, 680.167] |

Days with different dispatch vs λ=0: {"1":1000,"0.2":999,"0.35":1000,"0.5":1000,"eta-greedy":495,"distance-greedy":1000}.

Spatial vs uniform-class-1 control at λ=.35 (same events): 1000 / 1000 days differ; mean synthetic harm difference 79.507. This is a sensitivity diagnostic, not evidence that hazard predicts incidents.

## Valid 2026-10-08T12:00:00Z · lead 24 h

| Policy | Coverage % | ETA min | P95 min | km | CO₂ kg | totalHarm | Δ harm vs λ=0 [paired bootstrap 95%] |
|---|---:|---:|---:|---:|---:|---:|---|
| 0 | 100.000 | 41.450 | 87.727 | 1580.594 | 363.537 | 17393.111 | 0.000 [0.000, 0.000] |
| 0.2 | 100.000 | 41.496 | 88.217 | 1560.810 | 358.986 | 17400.292 | 7.181 [-35.477, 50.320] |
| 0.35 | 100.000 | 41.689 | 91.020 | 1525.284 | 350.815 | 17447.264 | 54.153 [-4.506, 113.488] |
| 0.5 | 100.000 | 41.827 | 94.511 | 1495.265 | 343.911 | 17446.274 | 53.163 [-12.399, 117.325] |
| 1 | 100.000 | 43.513 | 101.524 | 1507.745 | 346.781 | 18081.600 | 688.490 [595.265, 774.547] |
| eta-greedy | 100.000 | 41.551 | 88.192 | 1591.298 | 365.998 | 17436.443 | 43.333 [27.328, 58.599] |
| distance-greedy | 100.000 | 42.954 | 91.840 | 1142.493 | 262.773 | 18006.319 | 613.208 [536.419, 695.746] |

Days with different dispatch vs λ=0: {"1":1000,"0.2":965,"0.35":1000,"0.5":1000,"eta-greedy":482,"distance-greedy":1000}.

Spatial vs uniform-class-1 control at λ=.35 (same events): 998 / 1000 days differ; mean synthetic harm difference 184.845. This is a sensitivity diagnostic, not evidence that hazard predicts incidents.

## Valid 2026-10-11T12:00:00Z · lead 96 h

| Policy | Coverage % | ETA min | P95 min | km | CO₂ kg | totalHarm | Δ harm vs λ=0 [paired bootstrap 95%] |
|---|---:|---:|---:|---:|---:|---:|---|
| 0 | 100.000 | 41.645 | 87.979 | 1585.217 | 364.600 | 17490.178 | 0.000 [0.000, 0.000] |
| 0.2 | 100.000 | 41.609 | 88.480 | 1562.494 | 359.374 | 17470.553 | -19.625 [-58.086, 26.762] |
| 0.35 | 100.000 | 41.689 | 90.967 | 1527.114 | 351.236 | 17450.813 | -39.365 [-94.100, 22.083] |
| 0.5 | 100.000 | 41.926 | 94.742 | 1499.055 | 344.783 | 17499.143 | 8.965 [-58.175, 75.911] |
| 1 | 100.000 | 43.720 | 101.745 | 1511.808 | 347.716 | 18161.921 | 671.743 [586.739, 767.997] |
| eta-greedy | 100.000 | 41.742 | 88.570 | 1596.409 | 367.174 | 17530.874 | 40.697 [23.531, 58.696] |
| distance-greedy | 100.000 | 43.055 | 91.838 | 1144.279 | 263.184 | 18077.266 | 587.088 [507.873, 678.230] |

Days with different dispatch vs λ=0: {"1":1000,"0.2":965,"0.35":1000,"0.5":1000,"eta-greedy":475,"distance-greedy":1000}.

Spatial vs uniform-class-1 control at λ=.35 (same events): 1000 / 1000 days differ; mean synthetic harm difference 91.936. This is a sensitivity diagnostic, not evidence that hazard predicts incidents.

Coverage = served / 120. ETA and P95 are means of per-day served-event values; P95 uses floor(.95*(n-1)), not pooled events. Missing ETA/P95 values remain null and are counted. totalHarm = severity × ETA for served events + 10 × severity² for unserved events. The unserved penalty can be smaller than a long served delay; harm is an arbitrary surrogate and must be read jointly with coverage. Travel excludes return to station; brigades remain at the last event node and are immediately available. Kilometres and CO₂ are per-day totals, not observed emissions.

Intervals resample paired synthetic days (500 replicates) separately per snapshot. They quantify Monte Carlo uncertainty under this model, not weather sampling, historical generalization, or multiplicity-adjusted confirmation. Lower harm need not mean higher coverage or better performance under other metrics. No best lambda is selected.
