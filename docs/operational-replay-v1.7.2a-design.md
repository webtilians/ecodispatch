# v1.7.2a — INFOCA multi-resource operational substrate

This stage is deliberately **pre-outcome**. It changes the operational abstraction before any new comparison of λ policies is allowed.

## Why this stage exists

v1.7.1 replaced synthetic incident time/location with observed EGIF Málaga demand, but still represented each incident as one modeled brigade becoming unavailable for a single service duration.

INFOCA is a heterogeneous resource system. A single incident may consume several resource classes at the same time, and each unit can become available again at a different moment. v1.7.2a therefore changes the state model from:

`incident -> one brigade -> one release time`

to:

`incident -> resource bundle[] -> independent resource release times`.

## Evidence freeze

The structural reference is the official **INFOCA 2026 catalogue** and its approving BOJA order:

- Junta de Andalucía, Catálogo de medios 2026:
  https://www.juntadeandalucia.es/organismos/ema/areas/incendios-forestales/dispositivo-infoca/catalogo-medios.html
- BOJA 115, 17 June 2026, Order of 11 June 2026:
  https://www.juntadeandalucia.es/boja/2026/115/22
- CVE: 00339267.

This is a **2026 structural fleet reference**, not a claim about which assets existed or were available on any historical day from 2006–2023.

## Exact Málaga assets that can be instantiated

The public 2026 catalogue explicitly locates the following resources in Málaga:

| Base | Resource | Model class | Capacity |
|---|---|---|---:|
| Colmenar | HTER | light | 900 L |
| Ronda | HTER | semiheavy | 1,300 L |
| Sierra de Las Nieves | HTER | light | 900 L |
| Cártama | HTEGC | heavy | 2,500 L |
| Málaga airport | MITECO CL-415 T | amphibious aircraft | 5,500 L |

The four Junta helicopter resources (three HTER plus one HTEGC) have regional scope. The CL-415 T is external national support, remains labelled as such, and is excluded from the active Málaga fleet unless a scenario explicitly opts it in.

By default, v1.7.2a therefore instantiates four Málaga Junta helicopter units. The catalogued MITECO CL-415 T is preserved as an exact asset but is not assumed continuously available to Málaga.

## Known facilities with unresolved terrestrial capacity

The catalogue identifies Colmenar, Ronda, Sierra de Las Nieves and Cártama as relevant Málaga facilities/bases, but the public catalogue does **not** explicitly distribute the Andalusia-wide totals of specialist groups, BRICAs and firefighting vehicles among those Málaga bases.

Therefore v1.7.2a records terrestrial pools with `capacity: null`.

This is intentional. Unknown is not zero, and unknown is not permission to estimate.

The following shortcuts are forbidden:

- dividing 269 specialist groups by provinces or CEDEFOs;
- dividing 108 autobombas by provinces;
- assuming one BRICA unit per base from the Andalusia total;
- silently treating the national CL-415 as permanently assigned to Málaga.

## Multi-resource architecture

Each operational unit has:

- stable resource id;
- home/base id;
- capability set;
- current location;
- next available minute;
- evidence status.

Each incident has one or more requirement slots, for example:

- `ground_specialists × 1`;
- `ground_water_attack × 1`;
- `air_water_attack × 1`.

Architecture tests use an **atomic bundle** rule: a dispatch is considered complete only if every required slot can be assigned to a distinct resource. A resource with several capabilities may satisfy one slot, but cannot occupy two simultaneous slots for the same incident.

For every assigned resource:

`dispatch_time = max(incident_time, resource_available_time)`

`arrival_time = dispatch_time + travel_time(resource, incident)`

`release_time = arrival_time + service_duration(resource, incident)`.

Bundle diagnostics are kept distinct:

- `queue_wait = max(resource_dispatch_time) - incident_time`;
- `bundle_ready_time = max(resource_arrival_time)`;
- travel time remains a separate per-resource quantity.

Thus queueing never includes road/air travel time.

This is a state-machine invariant, not yet an INFOCA service-time calibration.

## Service time

The inherited 45 / 90 / 180 minute values remain only as architecture sensitivity values. v1.7.2a does not reinterpret them as empirical INFOCA durations.

The target data for a later calibrated stage are resource-level timestamps such as activation/departure, arrival, withdrawal and available-in-base.

## Outcome gate

v1.7.2a must **not** publish a new λ leaderboard.

The exact public assets are currently air-heavy because terrestrial unit allocation is unresolved. Running EcoDispatch policy outcomes on that substrate would answer the wrong operational question.

The next outcome-bearing replay is gated on enough evidence to instantiate terrestrial capacity without inventing it.

## What v1.7.2a can legitimately claim

It can claim that:

1. the repository now represents incidents as heterogeneous resource bundles;
2. each resource has independent availability/release state;
3. exact 2026 Málaga aerial assets are encoded from the official catalogue;
4. missing terrestrial allocation is represented explicitly as missing evidence;
5. no new policy result was generated from the incomplete substrate.

It cannot claim operational efficacy, historical fleet fidelity or calibrated INFOCA service duration.

## Exact operational-support assets

The same 2026 catalogue also provides two exact Málaga support facts that are
kept separate from suppression capacity:

- INFOCA has eight UMMT vehicles, **one per province**; v1.7.2a therefore records
  one Málaga UMMT for mobile meteorology/communications.
- During the high-risk campaign MITECO contributes one UMAP located in Málaga;
  it is recorded as seasonal external analysis/planning support.

Neither unit satisfies an extinction requirement slot by default. This avoids
artificially increasing suppression capacity while preserving the published
operational topology.
