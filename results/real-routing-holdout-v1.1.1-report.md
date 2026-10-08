# EcoDispatch v1.1.1 — Frozen real-routing holdout result

**Status: CONFIRMED inside the frozen real-routing simulator**

v1.1.1 is a reporting/freeze patch only. No scenarios were rerun and no model,
routing, lambda, seed, K, bootstrap or decision rule changed.

## Provenance

- Preregistration commit: `691a85c96afa497fc8c2f42386d1d12c00a4ff5a`
- Raw export: `ecodispatch-v1.1-real-routing-holdout.json`
- Raw SHA-256: `1b63e5a5c5cd14752a6e79871f7be971c642b09e7d45b88c3953f93428454112`
- Raw bytes: `2,558,536`
- Generated: `2026-10-08T08:49:14.774Z`
- Routing dataset: `malaga-real-routing-v1`
- Routing Git blob: `4fbfaf903988f896fd3c6e49099141a6dd810c75`
- 1000 paired days, K=10
- Primary lambdas: 0.2, 0.35, 0.5, 1 versus lambda=0
- Multiplicity: Holm across the four primary total-harm tests

## Primary result

| lambda | mean ΔH | bootstrap 95% CI | Holm p | result |
|---:|---:|---:|---:|:---|
| 0.2 | -29.84 | [-45.03, -16.69] | 1.54e-5 | PASS |
| 0.35 | -54.14 | [-73.10, -34.79] | 2.95e-7 | PASS |
| 0.5 | -73.24 | [-96.85, -50.63] | 6.75e-9 | PASS |
| 1 | -83.46 | [-112.84, -55.61] | 3.25e-8 | PASS |

All four preregistered lambdas satisfy the frozen rule. The preregistered family
hypothesis is therefore **CONFIRMED inside the frozen real-routing simulator**.

## Secondary interpretation

Relative to lambda=0:

- lambda=0.2: +0.146 incidents/day, -0.069 min mean ETA, approximately neutral P95, -1.89 km/day, -0.70 kg CO2/day.
- lambda=0.35: +0.279 incidents/day, -0.134 min mean ETA, +0.173 min P95, +1.98 km/day, -0.65 kg CO2/day.
- lambda=0.5: +0.367 incidents/day, -0.175 min mean ETA, +0.289 min P95, +4.77 km/day, -0.52 kg CO2/day.
- lambda=1: +0.595 incidents/day, -0.182 min mean ETA, +0.411 min P95, -7.36 km/day, -1.49 kg CO2/day.

Distance-greedy serves more incidents and travels much less, but its mean total
harm is +100.14 versus lambda=0, illustrating that minimizing route distance is
not equivalent to minimizing the system-level harm objective.

## Scope

Risk weights and incidents remain synthetic. This result validates replication
under a frozen real road-network travel-time layer; it is not evidence of
real-world emergency-response effectiveness.
