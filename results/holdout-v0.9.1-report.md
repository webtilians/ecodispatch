# EcoDispatch v0.9.1 — Frozen holdout result

**Status: CONFIRMED inside the frozen synthetic simulator**

This result is the canonical compact record of the v0.9 preregistered holdout.
No scenarios were rerun for v0.9.1.

## Provenance

- Preregistration commit: `017cda8cf011a89794d987ad65658249df60b2f9`
- Raw result file: `ecodispatch-v0.9-holdout.json`
- Raw result SHA-256: `38b912b0941e4ab8edb9c9da9c7e12d4da4d4c0f3f8b4d82fe911573b3132985`
- Raw bytes: `2,868,071`
- Raw generation time: `2026-10-07T21:29:46.627Z`
- Holdout days: `1000`
- K: `10`
- Primary lambdas: `0.2, 0.35, 0.5, 1`
- Reference: `lambda=0`
- Multiplicity: Holm across four primary total-harm tests

The raw v0.9 JSON stored p-values as zero because its normal-CDF subtraction
underflowed numerically. v0.9.1 does **not** change any scenario, mean, SD,
bootstrap interval or decision. It only recomputes the two-sided normal-tail
p-values from the frozen `mean/sd/n` using a stable complementary-error-function
tail calculation.

## Confirmatory result

| λ | mean ΔH | bootstrap 95% CI | raw p | Holm p | result |
|---:|---:|---:|---:|---:|:---|
| 0.2 | -82.65 | [-100.79, -65.14] | 3.58e-17 | 3.58e-17 | PASS |
| 0.35 | -93.91 | [-116.20, -75.40] | 9.03e-19 | 1.81e-18 | PASS |
| 0.5 | -109.42 | [-132.17, -88.40] | 3.34e-23 | 1.00e-22 | PASS |
| 1 | -134.39 | [-156.37, -112.91] | 1.27e-31 | 5.07e-31 | PASS |

All four preregistered lambdas satisfy the frozen rule: mean ΔH < 0, bootstrap
95% CI entirely below zero, and Holm-adjusted p < 0.05. Therefore the
preregistered family hypothesis is **CONFIRMED within this synthetic model**.

## Secondary interpretation

Relative to λ=0:

- λ=0.2: +0.644 incidents/day, -0.024 min mean ETA, -1.27 km/day.
- λ=0.35: +0.853 incidents/day, approximately neutral mean ETA, +1.58 km/day.
- λ=0.5: +1.046 incidents/day, +0.012 min mean ETA, +3.15 km/day.
- λ=1: +1.399 incidents/day, +0.068 min mean ETA, +7.75 km/day.

These outcomes were preregistered as secondary and do not redefine the
confirmation rule.

## Scope

This is a confirmation **inside the frozen synthetic simulator**, not proof of
real-world emergency-response efficacy. The next major evidence step should use
real travel-time/routing and externally grounded demand/risk data rather than
more tuning on the same synthetic generator.
