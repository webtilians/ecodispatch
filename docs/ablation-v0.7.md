# v0.7 — Paired lambda ablation / Ablación pareada de lambda

## English

This experiment changes only the online policy coefficient lambda. The v0.6 simulator, crisis objective and Monte Carlo panel are preserved. Default grid: **0, 0.1, 0.2, 0.35, 0.5, 1, 2**. Default size: **500 days per policy**; 1000 is available. There are eight policies including Greedy, not eight independent samples.

### Reproducibility and pairing

The default base seed is `ecodispatch-mc-06`. Day i (zero-based) uses `base|normal|day|i`, hashed by the existing hashString and sampled with mulberry32. The 120 incidents are generated **once** and passed to every policy in the same order. Each policy resets its own positions from the same fixed fleet at the same exact k-median placement. Neither policies nor lambda consume random numbers. Normal generation never calls the stress search, filters days, retries for favorable results or tunes the grid. Increasing 500 to 1000 extends the same sequence; the first 500 remain identical. Changing the base seed defines a different experiment and must be disclosed.

### Policies and scale

For each feasible resource, Eco minimizes `severity*ETA + 0.0005*emissions_g + 0.05*distance_km + lambda*(exposure_after - exposure_before)`. Exposure is the sum over fixed demand nodes and incident types of `risk_weight * type_probability * nearest_capable_resource_ETA`. Type probabilities are medical .35, fire .4, reconnaissance .25. Lambda uses the original unnormalized v0.6 scale; it is not dimensionless or directly transferable to another map. Ties retain resource order. Greedy minimizes feasible distance; **lambda=0 is immediate-cost Eco, not Greedy**. No policy sees future incidents.

### Metrics and inference

All summaries weight each day equally:

| Field | Definition | Unit |
|---|---|---|
| served | Number served out of 120 | incidents/day (maximize) |
| meanEta | Arithmetic mean ETA among served incidents | minutes |
| p95Eta | Sorted served ETA at zero-based floor(.95*(served-1)), preserving v0.6 | minutes |
| distance | Sum of dispatch distances | km/day |
| severityDelay | Sum of severity*ETA among served incidents | severity-minutes/day |

The reported P95 is the **mean of daily P95s**, not a pooled incident percentile. Unserved incidents contribute no delay penalty. Lower delay may reflect a different served population and must be read with coverage. Zero-served days have undefined ETA/P95; exports use null and summaries omit undefined values/pairs, reporting effective n and missing counts. Other metrics remain zero. Zero-pair summaries are null.

For each metric and each reference (lambda=0 and Greedy), form the within-day difference `d_i = policy_i - reference_i`. Report mean(d), sample standard deviation with n-1 denominator and approximate pointwise 95% CI `mean(d) +/- 1.96*sd(d)/sqrt(n)`. These are Monte Carlo uncertainty intervals for the mean under this generator; not prediction intervals, real-world uncertainty, or confidence that a policy is optimal. Comparisons are correlated and **not adjusted for multiple testing**. Absolute mean intervals are also exported. v0.6's interpolation-based summary quantiles describe the distribution of daily outcomes; they are distinct from the within-day ETA P95 convention.

### Pareto and UI

A policy dominates another if its sample mean coverage is no lower, mean ETA no higher and mean distance no higher, with at least one strict inequality. All seven lambdas and Greedy participate. Exact ties are both non-dominated. This is a descriptive **three-dimensional** front based on unrounded means, not a statistical dominance test. Two switchable projections show coverage versus ETA or distance; green points remain members of the full 3D front. Every policy remains in the table. Selecting a point or row highlights it; switching the reference updates all paired differences and intervals. No utility or single best lambda is assumed.

The worker keeps the interface responsive. Cancellation discards an incomplete run; exports are enabled only for completed runs. JSON contains protocol, full configuration, seed, grid, all per-day per-policy metrics, summaries and both paired references. CSV contains `scenario` and `summary` records with stable English field names, full numerical precision, seed, profile, sample count, effective n, confidence bounds and front membership. Human-readable UI text is available in ES/EN. Configuration and formula details live in JSON and this document.

### Limits

Synthetic incidents on real geographical coordinates, geodesic distances, fixed speeds and fixed fleet/risk map. There are no service durations or simultaneous occupancy in the sequential day model; vehicles remain at the incident location. Only day-generation variability is estimated. ETA feasibility is checked against deadlines and resource capabilities. The study makes no operational effectiveness claim. Stress tests are separately labeled demonstrations and are excluded from inference. EcoDispatch is an independent prototype inspired by public OpenAI mathematics results, not affiliated with, funded by or endorsed by OpenAI; it does not implement or inherit all theoretical guarantees of those results.

### Run and verify

Open `?lang=en#ablation` (or `?lang=es#ablation`), retain the base seed and select 500 or 1000. Run, inspect every policy, switch reference and plot axis, and export JSON/CSV. The v0.6 panel remains at `#validation`.

From the repository root, with Node.js and Python available:

```text
node tests/ablation.test.cjs
python -m unittest discover -s tests
```

Set environment variable `ABLATION_N=1000` to verify the larger sweep. The Node test writes complete local results to `work/ablation-N.json` and `.csv` (ignored by Git), checks reproducibility, paired CI arithmetic, Pareto tradeoffs/ties, missing values, exports, ES/EN keys, IDs and syntax. It compares shared model outputs to historical v0.6 commit `f6ded9d45e0919a2095984f8e52ba91ba00cfb7a`; a full Git history is required. These commands do not publish or select outcomes.

## Español

La ablación cambia únicamente lambda en la política online. Conserva el simulador, la crisis y el panel Monte Carlo v0.6. Rejilla fija: **0, 0.1, 0.2, 0.35, 0.5, 1, 2**, con **500 jornadas por política** y opción 1000. Greedy es la octava política; las muestras entre políticas son pareadas.

La semilla predeterminada es `ecodispatch-mc-06`. La jornada i usa `base|normal|day|i`, desde cero, con hashString y mulberry32 originales. Sus 120 incidentes se generan una sola vez, en el mismo orden para todas las políticas. Cada política reinicia la misma flota en las mismas bases k-median. Ampliar a 1000 conserva las primeras 500 jornadas. No se buscan semillas favorables, no se filtran jornadas y no entra el buscador stress. Cambiar la semilla define otro experimento y debe declararse.

Eco minimiza `gravedad*ETA + 0.0005*emisiones_g + 0.05*distancia_km + lambda*(exposición_después - exposición_antes)`. La exposición suma `peso_riesgo * probabilidad_tipo * ETA_del_recurso_capaz_más_cercano`, sobre nodos y tipos; probabilidades: médica .35, incendio .4, reconocimiento .25. La escala de lambda es la de v0.6, sin normalización y no transferible directamente a otros mapas. Los empates conservan el orden de recursos. Greedy minimiza distancia factible: **lambda=0 no equivale a Greedy**. Ninguna política conoce el futuro.

Las jornadas pesan igual. Cobertura cuenta atendidos de 120; distancia suma kilómetros por jornada. ETA promedia atendidos; P95 usa el índice ordenado `floor(.95*(atendidos-1))` de v0.6. Se promedian los P95 diarios, no todos los incidentes juntos. Retraso ponderado suma gravedad por ETA, en gravedad-minutos/jornada, solo entre atendidos. Los no atendidos no penalizan el retraso: hay que interpretar esta métrica junto a cobertura. Cuando no hay atendidos, ETA/P95 son null y se omiten valores y pares indefinidos, informando n efectivo y ausencias; las otras métricas son cero.

Para cada métrica y referencia (lambda=0 y Greedy), `d_i = resultado_i - referencia_i`. El IC95 aproximado es `media(d) ± 1.96*desviación_muestral(d)/√n`, con denominador n-1 en la varianza. Es un intervalo puntual para la media, sin corrección de comparaciones múltiples; no es un intervalo de predicción ni una garantía de eficacia. Los cuantiles de resumen de jornadas usan la interpolación de v0.6 y son distintos del P95 de ETA dentro de cada jornada.

El frente considera las siete lambdas y Greedy: maximiza cobertura media y minimiza ETA medio y distancia media. Dominar exige no empeorar ninguna y mejorar estrictamente al menos una. Empates exactos se conservan. Se usan medias sin redondear, sin pruebas de significación. El gráfico muestra dos proyecciones del frente tridimensional; verde identifica pertenencia al frente completo. La tabla conserva todas las políticas, permite resaltar filas y cambiar referencia. **No se declara un mejor lambda ni se inventa una función de utilidad**.

El barrido trabaja en segundo plano y permite cancelar; una ejecución incompleta no se exporta. JSON incluye configuración completa, protocolo, semilla, métricas por jornada y política, resúmenes e intervalos frente a ambas referencias. CSV incluye registros de escenarios y resúmenes, semilla, perfil, tamaño muestral, n efectivo, intervalos y pertenencia al frente; los nombres de campos permanecen en inglés para facilitar análisis reproducibles.

Modelo sintético con distancias geodésicas, velocidades fijas, flota y mapa fijos. No modela duración de servicio ni ocupación simultánea; el vehículo queda en el incidente. Solo se estima variabilidad del generador de jornadas. Los stress tests se mantienen separados. EcoDispatch es independiente, inspirado por resultados públicos de OpenAI, sin afiliación, financiación ni respaldo de OpenAI, y no hereda las garantías de esos resultados.

Para reproducir, abre `?lang=es#ablation`, conserva semilla y ejecuta 500/1000; cambia referencia y eje y exporta JSON/CSV. La validación anterior sigue en `#validation`. Los comandos anteriores verifican regresión v0.6, pareado, IC, Pareto, exportación, sintaxis, IDs y traducciones. `ABLATION_N=1000` activa la prueba ampliada; los resultados locales se escriben en `work/`.

## Reproducible reference run / Ejecución de referencia

Base seed / Semilla: `ecodispatch-mc-06`. Normal profile, all days included / Perfil normal, todas las jornadas incluidas. Executed / Ejecutado: 2026-10-07.

| λ / policy | Coverage 500 | ETA 500 (min) | km 500 | Front 500 | Coverage 1000 | ETA 1000 (min) | km 1000 | Front 1000 |
|---|---:|---:|---:|:---:|---:|---:|---:|:---:|
| 0 | 112.230 | 4.083 | 530.704 | — | 112.127 | 4.072 | 528.143 | — |
| 0.1 | 112.522 | 4.057 | 528.796 | — | 112.443 | 4.049 | 526.789 | ✓ |
| 0.2 | 112.854 | 4.047 | 528.535 | ✓ | 112.870 | 4.044 | 527.653 | ✓ |
| 0.35 | 113.050 | 4.065 | 530.294 | ✓ | 113.095 | 4.057 | 529.136 | ✓ |
| 0.5 | 113.412 | 4.077 | 532.578 | ✓ | 113.453 | 4.074 | 531.884 | ✓ |
| 1 | 113.752 | 4.149 | 540.169 | ✓ | 113.840 | 4.141 | 538.788 | ✓ |
| 2 | 114.034 | 4.261 | 549.460 | ✓ | 114.020 | 4.247 | 547.842 | ✓ |
| greedy | 112.128 | 4.186 | 515.015 | ✓ | 111.970 | 4.170 | 512.084 | ✓ |

At 500 days lambda 0.1 is dominated; at 1000 it is non-dominated. Front membership is sample-dependent and descriptive. This is not evidence of one universally best lambda. The first 500 raw rows are identical in both runs.

Con 500 jornadas lambda 0.1 está dominado; con 1000 no. La pertenencia al frente depende de la muestra y es descriptiva. No demuestra un mejor lambda universal. Las primeras 500 filas coinciden exactamente en ambas ejecuciones.
