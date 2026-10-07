# EcoDispatch v1.0 — Real-routing benchmark

v1.0 is the first EcoDispatch benchmark that replaces straight-line ground
movement with a **versioned road-network travel-time matrix**.

It is deliberately **not** described as real-world emergency validation. Demand,
risk weights, incident types, deadlines and resource availability are still
synthetic. The part that is real in v1.0 is the mobility layer.

## 1. Routing source

A static 20 x 20 origin-destination table was generated on
`2026-10-07T22:07:45Z` using the OSRM Table service with the `driving`
profile.

OSRM documents the Table service as returning the duration and distance of the
fastest route between supplied coordinates; durations are seconds and distances
are metres. See:

- https://project-osrm.org/docs/v26.5.0/http
- https://project-osrm.org/docs/

The underlying road-network data is OpenStreetMap.

**Attribution:** © OpenStreetMap contributors. OpenStreetMap data is available
under the Open Database License (ODbL):

- https://www.openstreetmap.org/copyright

The public EcoDispatch dashboard does not query OSRM at runtime. The matrix is
stored at `web/data/routing-v1.0.json`. Rebuilding it requires one Table
request from `scripts/fetch_real_routing.py`.

The public OSRM server is a demo / best-effort service and is not treated as an
operational dependency.

## 2. Coordinates and snapping

The 8 candidate bases and 12 demand nodes are still the synthetic v0.x geometry
projected into the Málaga / Montes de Málaga bounding box. They are **not**
claimed to be real emergency stations or historical incident locations.

OSRM snaps these points to its routable driving network. v1.0 applies a frozen
quality rule:

```text
eligible demand node iff OSRM snap distance <= 500 m
```

Two demand nodes fail this rule and are excluded from the v1.0 benchmark:

- `D5`: ~1021 m snap distance;
- `D8`: ~778 m snap distance.

All 8 candidate bases are retained; the worst base snap is `B6` at ~473 m.

The complete matrix has 400 directed OD pairs. It is intentionally **not
symmetrized**: one-way roads and routing constraints can make A→B differ from
B→A.

## 3. Real-routing placement

The preventive placement layer now minimizes risk-weighted **road travel time**
over eligible demand nodes:

```text
min_{|S|=3} sum_j w_j min_{f in S} T_road(f,j)
```

where `w_j` is still the synthetic v0.x risk weight.

Exact enumeration of the 56 three-base combinations selects:

```text
B2 · B3 · B4
```

with a risk-weighted road-time objective of approximately `1028.9 weighted
minutes`.

This is a routing result over synthetic risk—not evidence that these are good
real emergency bases.

## 4. Sequential benchmark

The exploratory v1.0 day uses:

- 120 sequential synthetic incidents/day;
- incident locations sampled only from the 10 eligible demand nodes;
- the same synthetic risk weights and incident-type probabilities as v0.x;
- fixed synthetic deadlines:
  - medical: 90 min;
  - fire: 120 min;
  - drone/recon: 30 min;
- `K=10` total-harm penalty;
- paired policies on exactly the same incidents.

Policies:

```text
lambda in {0, 0.2, 0.35, 0.5, 1}
ETA-greedy
distance-greedy
```

This is **exploratory**. The v0.9 holdout is not reused as a confirmatory claim
for v1.0.

## 5. Movement modes

Ground units use the frozen OSRM road duration and route distance directly.
Configured synthetic speed fields are ignored for ground ETA in v1.0 because
OSRM already provides travel duration.

The drone uses direct geodesic flight at its configured synthetic speed because
forcing an aircraft onto a road matrix would be physically wrong.

For v1.0 the resource capability roles are intentionally stricter:

- brigade → fire;
- ambulance → medical;
- drone → recon/drone;
- utility → medical + recon/drone.

This capability model remains synthetic and is documented so v1.0 numbers are
not silently compared with the historical v0.x simulator.

## 6. Outcomes

The benchmark reports:

- incidents served;
- mean ETA;
- mean daily ETA P95;
- road/flight distance;
- approximate CO2 from configured synthetic per-km factors;
- severity-weighted served delay;
- total harm
  `H = sum_served(severity*ETA) + 10*sum_unserved(severity^2)`.

Paired normal and percentile-bootstrap intervals are computed versus
`lambda=0`.

## 7. What v1.0 does not establish

v1.0 does **not** include:

- real incident locations or frequencies;
- calibrated wildfire/medical risk;
- emergency-vehicle-specific road speeds;
- traffic;
- service/turnaround duration;
- road closures or emergency access permissions;
- simultaneous resource occupancy;
- real operational constraints.

AEMET publishes official forest-fire danger information based on numerical
weather prediction plus vegetation/land-use/soil-moisture variables, but that
dynamic hazard layer is not incorporated in v1.0. Risk therefore remains
explicitly synthetic rather than mixing an incomplete real hazard feed into the
benchmark.

The next evidence step should replace synthetic risk/demand with externally
grounded data under a separately documented protocol.
