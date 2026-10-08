# EcoDispatch v1.2 — Real fire-weather hazard calibration

v1.2 adds the first **official hazard data** to EcoDispatch while keeping a
strict boundary between what is real and what remains synthetic.

The new dataset is:

`web/data/aemet-malaga-fwi-2025.json`

It is generated reproducibly by:

`scripts/fetch_aemet_fire_risk.py`

The public dashboard reads the static versioned JSON and makes no request to
AEMET at runtime.

## 1. Official source

Publisher: **AEMET — Agencia Estatal de Meteorología**

Source page:

https://www.aemet.es/es/datos_abiertos/estadisticas/riesgo_incendios

2025 annual archive:

https://www.aemet.es/documentos/es/datos_abiertos/Estadisticas/IM_riesgo_incendios/eimri_estadistica_anual_2025.zip

AEMET describes this product as statistics of the meteorological forest-fire
danger index by province. The annual ZIP contains CSV files with:

- frequencies of days in the danger classes;
- basic monthly/annual statistics of the daily mean danger level.

AEMET authorizes reuse/reproduction with attribution. EcoDispatch therefore
shows **Fuente: AEMET** beside this layer.

## 2. Málaga 2025 values

The two source CSV files provide 11 Málaga rows in total.

The dashboard derives only transparent sums from the published classes:

```text
high_or_worse = Alto + Muy_Alto + Extremo
very_high_or_extreme = Muy_Alto + Extremo
```

No statistical model is fitted and no fire probability is inferred.

### Monthly high-or-worse frequency

| Month | High or worse | Extreme | Mean danger level |
|---|---:|---:|---:|
| Jan | 0.00% | 0.00% | 1.0 |
| Feb | 0.00% | 0.00% | 1.0 |
| Mar | 0.00% | 0.00% | 1.0 |
| Apr | 0.00% | 0.00% | 1.0 |
| May | 16.13% | 0.00% | 1.4 |
| Jun | 60.00% | 10.00% | 3.0 |
| Jul | 87.10% | 16.13% | 3.5 |
| Aug | 87.10% | 25.81% | 3.9 |
| Sep | 50.00% | 3.33% | 2.7 |
| Oct | 0.00% | 0.00% | 1.2 |
| Nov | 0.00% | 0.00% | 1.0 |
| Dec | 0.00% | 0.00% | 1.0 |

Annual published/derived summary:

- mean danger level: **1.8**;
- high-or-worse frequency: **25.21%**;
- very-high-or-extreme frequency: **17.54%**;
- extreme frequency: **4.66%**.

## 3. What becomes real in v1.2

v1.2 provides a real **temporal hazard calibration** for wildfire weather in
Málaga province.

It supports statements such as:

> the official 2025 fire-weather danger distribution was much more severe in
> June–September than in winter.

It does **not** support statements such as:

> node D4 had an 87.1% probability of a wildfire in August.

Those are different quantities.

## 4. What remains synthetic

The following are still synthetic:

- the within-province spatial distribution of risk across EcoDispatch demand
  nodes;
- incident occurrence and exact incident locations;
- incident severity;
- medical/recon incident processes;
- resource availability/service times;
- several emergency-response operational constraints.

For this reason v1.2 does **not** rerun the dispatch benchmark with AEMET values
copied into node weights. Doing that would create false spatial precision.

## 5. Layer separation

EcoDispatch now keeps three evidence layers separate:

1. historical synthetic benchmarks (v0.x);
2. real road-network mobility with synthetic risk (v1.0/v1.1);
3. real province-level fire-weather hazard calibration (v1.2).

A future version may combine the real routing layer with node/grid-level real
hazard/exposure data once a reproducible spatial source has been validated.

Potential next sources include EFFIS/Copernicus gridded fire-weather/fuel layers
and official Junta de Andalucía / REDIAM wildfire statistics, but they are not
silently incorporated into v1.2.

## 6. Claim boundary

v1.2 is a **data-grounding milestone**, not a new efficacy claim.

The confirmed v1.1.1 result remains a result inside a simulator with real
routing and synthetic risk/incidents. The AEMET layer is displayed separately
until spatial/incident calibration is strong enough to justify integration.
