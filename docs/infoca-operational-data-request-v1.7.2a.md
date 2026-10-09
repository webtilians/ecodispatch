# v1.7.2a — INFOCA operational-data request and acceptance contract

This document is fixed before receiving any non-public operational dataset. Its
purpose is to prevent post-hoc reinterpretation of whatever fields become
available.

## Requested scope

Preferred scope:

- organization: Plan INFOCA / Agencia de Emergencias de Andalucía;
- geography: Málaga province;
- period: 2015–2025;
- format: reusable CSV, JSON or equivalent tabular export;
- granularity: one row per resource × intervention, or event logs that can be
  transformed deterministically to that granularity.

If the preferred period is unavailable, any electronically available period is
useful provided the covered dates and extraction rules are supplied.

No personal data about workers or crews is requested.

## Preferred fields

### Intervention identity

- anonymized intervention / incident identifier;
- incident date;
- incident municipality or coordinate if releasable;
- incident classification / grade where available.

### Resource identity

- stable anonymized resource identifier;
- resource class/type;
- home/base or assigned operational center;
- ownership or organization where relevant;
- optional shift/availability status if recorded.

### Operational timestamps

Preferred raw milestones, without imputation:

- alert / activation;
- dispatch order;
- departure / salida;
- arrival at incident;
- withdrawal / retirada;
- arrival at base;
- available-again / operative-again.

For aerial resources, the priority fields are the fleet-tracking milestones
corresponding to:

- salida a incendio;
- llegada a incendio;
- retirada del incendio;
- en base.

### Data semantics

Please include, if available:

- timezone and daylight-saving convention;
- timestamp precision;
- definition of each status/milestone;
- reason codes for cancellation/diversion;
- source system / extraction date;
- missing-value conventions;
- data dictionary.

## Explicitly acceptable partial responses

If full resource-level logs cannot be released, the following remain useful:

1. anonymized resource-level records without precise coordinates;
2. records limited to one resource class (for example aerial resources);
3. records limited to a shorter time interval;
4. incident-level lists of mobilized resource classes and counts;
5. distributions or aggregates of arrival, withdrawal and return-to-base times,
   provided numerator/denominator and inclusion criteria are documented.

A denial of one field should not be treated as a denial of the remaining
non-personal operational fields.

## Pre-fixed derived quantities

No timestamp is allowed to change meaning after outcomes are inspected.

When both endpoints exist and pass validation:

- activation-to-arrival =
  `arrival_at_incident - activation`;
- departure-to-arrival =
  `arrival_at_incident - departure`;
- on-incident occupancy =
  `withdrawal - arrival_at_incident`;
- post-withdrawal turnaround =
  `available_again - withdrawal`;
- total resource occupancy =
  `available_again - activation`.

If `available_again` is absent but `en_base` is present, en-base duration may
be reported separately as an **observed return-to-base proxy**. It must not be
silently relabelled as true availability.

Detection-to-extinction, detection-to-control and fire duration are **not**
resource service durations.

## Validation rules

Before any calibration:

1. preserve source rows unchanged;
2. create a separate deterministic normalized table;
3. never impute missing operational timestamps in the primary analysis;
4. flag negative/out-of-order intervals rather than silently repairing them;
5. report timestamp completeness by year and resource class;
6. report duplicated identifiers and duplicate event rows;
7. report the number of resources and incidents represented;
8. preserve explicit midnight timestamps and distinguish known precision from
   unknown precision where metadata permits;
9. freeze a hash of raw received bytes and normalized output before policy
   outcomes.

## Minimum evidence gates

### Service-time calibration gate

A resource class can receive an empirical service/occupancy distribution only if
the semantic meaning of both interval endpoints is documented and completeness is
reported.

### Fleet-availability calibration gate

Historical availability can be calibrated only if the data distinguish resources
that were actually active/available from resources merely listed in a yearly
catalogue.

### Multi-resource demand gate

A current or historical incident can inform bundle composition only if mobilized
resources or resource-class counts are represented. The model must not infer a
universal bundle from a single large-fire report.

## Proposed public-information request text

> Solicito, preferentemente en formato reutilizable CSV/JSON, los registros
> históricos asociados a las intervenciones del dispositivo INFOCA en la
> provincia de Málaga, incluyendo para cada recurso un identificador anonimizado,
> tipo de recurso, base o centro de adscripción, identificador anonimizado de la
> intervención y los hitos temporales disponibles: activación o despacho, salida,
> llegada al incendio, retirada del incendio y regreso a base o momento en que el
> recurso vuelve a constar como disponible/operativo.
>
> Para medios aéreos solicito específicamente, si constan en los sistemas de
> seguimiento de flotas, los hitos equivalentes a «Salida a incendio», «Llegada
> a incendio», «Retirada del incendio» y «En Base».
>
> Asimismo, si están disponibles, solicito la relación de clases y cantidades de
> recursos movilizados por intervención y la base de adscripción de dichos
> recursos.
>
> No se solicitan nombres ni datos personales de trabajadores, tripulaciones o
> terceros. Resultaría suficiente un identificador técnico anonimizado que permita
> relacionar los distintos hitos del mismo recurso y de la misma intervención.
>
> El periodo preferente es 2015–2025 y la provincia de Málaga. Subsidiariamente,
> solicito cualquier periodo o subconjunto de clases de recurso para el que estos
> datos se encuentren disponibles electrónicamente.
>
> Se solicita también, si existe, el diccionario de datos o definición de los
> estados y marcas temporales, incluida la zona horaria, precisión y convención
> utilizada para valores ausentes o cancelaciones.

## Claim boundary

Receiving a dataset does not itself validate EcoDispatch. The dataset first enters
an evidence audit and freeze. Calibration and policy outcomes belong to a later
stage only after the corresponding evidence gates above are satisfied.
