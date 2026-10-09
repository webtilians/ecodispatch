# v1.7.1 — Historical Demand Replay: fixed exploratory design

This design is committed **before any v1.7.1 policy outcome is generated**.
It is not a preregistration or an operational validation. Historical EcoDispatch
artifacts through v1.7 step 1 remain unchanged.

## Question

Does the EcoDispatch policy behavior observed under the synthetic v1.5/v1.6
Poisson demand process persist when incident **time and location are replayed from
observed wildfire records**?

The intended change is deliberately narrow:

[
	ext{synthetic Poisson arrival + synthetic node}
longrightarrow
	ext{observed EGIF detection time + observed coordinate}
]

The v1.6 service-time sensitivity, fleet, policy family, response deadline,
modeled severity distribution and harm sensitivities remain fixed.

## Frozen historical cohort

Source: the reproducible EGIF extraction from v1.7 step 1,
`web/data/real-fire-incidents-v1.7.json`.

The primary modern cohort is fixed to **2006–2023 inclusive**. The v1.7 audit
shows that every EGIF part has a screened latitude/longitude pair in every one of
those years:

- 2005: 116 coordinates / 120 parts;
- 2006: 80 / 80;
- every year 2006…2023: coordinates = parts.

The 2006–2023 candidate cohort therefore contains **1,467 parts across 18
calendar years**. The cut is based only on source-data completeness and is fixed
before policy outcomes.

Primary replay events must satisfy:

1. source year in 2006…2023;
2. `coordinate_flag == "valid_rectangle_only"`;
3. finite latitude and longitude;
4. `timestamp_flags.detected_at == "valid"`;
5. the parsed detection calendar year must agree with `source_year`.

No coordinate, date or time is imputed. Explicit midnight detections flagged
`midnight_precision_unknown` are excluded from the primary replay and retained
in the cohort audit with their original source value.

The source timestamps remain **unknown/local-naive**. We do not invent UTC,
timezone or daylight-saving corrections.

## Historical day construction

Every source detection date defines one historical calendar day. Event arrival
time within the day is:

[
t_i = 60h_i + m_i + s_i/60
]

in minutes after local-naive midnight.

Events are ordered by `detected_at`, with lexical `incident_id` as a
deterministic tie-break. The fleet is reset at the start of each calendar day,
exactly as v1.6 reset it for each synthetic replicate.

Calendar aggregates span every day from 2006-01-01 through 2023-12-31, including
zero-fire days. Results will also be reported on active-fire days and by year so
that calendar exposure and conditional operational behavior are not conflated.

## What remains modeled

v1.7.1 is **real demand**, not a fully real operations reconstruction.

The following are intentionally inherited rather than recalibrated:

- three modeled fire brigades F-01/F-02/F-03 at B2/B3/B4;
- 120-minute response deadline;
- severity (U[2,5));
- service times 45 / 90 / 180 minutes;
- emissions coefficients;
- synthetic harm function and K = 10 / 60 / 120;
- lambda = 0 / .2 / .35 / .5 / 1 plus ETA- and distance-greedy.

Severity is assigned deterministically from a fixed v1.7.1 seed and
`incident_id`. Thus the same observed incident has exactly the same modeled
severity under every policy, hazard context and service-time condition.

Service-time calibration is explicitly deferred to **v1.7.2**.

## Hazard context is not historical weather

The three already-frozen AEMET v1.4 snapshots are crossed with each historical
day as **policy contexts only**.

They are not relabeled as 2006–2023 weather, are not matched to historical
dates, and do not estimate historical fire probability. This preserves the v1.6
coverage-potential mechanism while isolating the demand substitution.

The ten v1.4/v1.5 potential nodes and their ordinal AEMET classes remain
unchanged.

## Routing extension that must be frozen before outcomes

The old `routing-v1.0.json` matrix cannot route a brigade from an arbitrary
historical fire coordinate. Snapping each real fire to D1…D10 would destroy the
spatial replay and is therefore forbidden.

Before running policies, v1.7.1 must freeze a static sparse OSRM/OSM routing
extension containing the directed edges actually required by the temporal model:

1. B2, B3 and B4 to every primary replay event;
2. every primary replay event to each of the ten frozen potential nodes;
3. every directed event-to-event pair within the same historical calendar day.

The third set is sufficient because the fleet resets every day and a brigade can
only arrive at a later dispatch from a fire already served that day.

OSRM input coordinates, snapped coordinates, duration, distance and snap
distance must be retained. Missing routes are never imputed.

Wildfire coordinates can legitimately lie away from a drivable road, so
snap-distance is a diagnostic rather than an automatic exclusion criterion in
the primary replay. The resulting road ETA means road access to the nearest
routable point, not travel to the exact fire front.

The road network is a frozen modern OSM/OSRM representation. v1.7.1 does **not**
claim to reconstruct the road network as it existed in 2006–2023.

No network call is allowed during benchmark execution.

## Paired experiment

For every historical calendar day, each of the three frozen hazard contexts and
each service time in {45, 90, 180}, run:

- EcoDispatch lambda = 0, .2, .35, .5, 1;
- ETA-greedy;
- distance-greedy.

Within a condition every policy receives the identical observed event stream and
the identical deterministic modeled severity per incident.

K = 10 / 60 / 120 changes evaluation only and does not trigger a different
dispatch run.

The main comparison remains paired against lambda=0. The existing descriptive
v1.6 bootstrap rule is retained with 500 paired resamples.

## Metrics

Retain the temporal v1.6 operational metrics: served/unserved, coverage,
response delay, P95 response delay, travel ETA, wait, P95 wait, km, modeled CO2,
all-busy arrivals, queue diagnostics, utilization and free-brigade state shares.
Report synthetic totalHarm separately for each K.

Add aggregation by:

- calendar day;
- active-fire day;
- year;
- event-weighted totals/means where mathematically appropriate.

No single metric is allowed to silently replace coverage or response-time
reporting.

## Claim boundary

If EcoDispatch remains favorable, the defensible statement is:

> The modeled policy advantage persists when synthetic fire arrival times and
> locations are replaced by observed 2006–2023 Málaga EGIF demand, under the
> frozen v1.6 fleet, policy, service-time and hazard-context assumptions.

It is **not** evidence that the simulated brigade fleet matches INFOCA, that the
AEMET contexts describe historical weather, that service duration is calibrated,
or that the policy would improve real emergency outcomes.

Those operational calibration questions belong to v1.7.2 or later.
