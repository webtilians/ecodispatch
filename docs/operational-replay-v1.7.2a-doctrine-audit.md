# v1.7.2a — INFOCA first-attack doctrine audit

This note records official operational doctrine that supports the multi-resource
architecture. It does **not** freeze a 2026 first-attack bundle.

## Official evidence

### 1995 INFOCA operability order

Official source:
https://www.juntadeandalucia.es/boja/1995/98/28

For an incipient fire, the published first-attack procedure includes:

- intervention of mobile surveillance resources;
- automatic dispatch of helitransported specialist crews;
- dispatch of CEDEFO forest fire engines;
- activation of local support resources.

For the next attack level, the same order describes helitransported specialist
crews with the helicopter acting as an extinguisher after transport, teams of
forest fire engines, additional local resources, air tankers where catalogued,
heavy machinery readiness and a second specialist brigade.

### INFOCA technical operability manual

Official source:
https://www.juntadeandalucia.es/medioambiente/web/Bloques_Tematicos/Patrimonio_Natural._Uso_Y_Gestion/Montes/Incendios_Forestales/plan_infoca/Cap16_operatividad.pdf

The manual describes automatic dispatch from the corresponding CEDEFO area and
lists possible resources including:

- transport/extinction helicopter with an operations technician and specialist crew;
- specialist crew with ground vehicle;
- fire engine;
- mobile crew;
- aircraft and specialized brigades (BRICA/BRIF).

It also makes an important modeling point explicit: a transport/extinction
helicopter can first move personnel and then continue working as an extinction
aircraft.

## Architecture implications

These sources support three v1.7.2a decisions:

1. **One fire is not one resource.** First attack is naturally a bundle of
   heterogeneous units.
2. **Availability must be tracked per unit.** A fire can occupy ground crews,
   vehicles and aircraft at the same time, with different release times.
3. **Capabilities can be sequential.** A helicopter may transport a crew and
   later perform water attack. The current atomic-bundle oracle models
   simultaneous requirement slots only; a later phase model should represent
   sequential roles explicitly instead of double-counting one helicopter.

## Why no fixed first-attack bundle is encoded yet

The cited operability sources are official but old. The current 2026 catalogue
defines present-day resources, not the current dispatch matrix by incident
grade/zone.

Therefore v1.7.2a uses these documents as **structural evidence**, not as proof
that every 2026 Málaga incident must receive the same fixed bundle.

Before an outcome-bearing operational replay, EcoDispatch still needs one of:

- a current INFOCA dispatch/first-attack instruction;
- incident-level mobilization records from which bundle composition can be
  measured;
- or an explicit sensitivity design over plausible bundles, labelled modeled
  rather than operationally observed.

No lambda policy result may be conditioned on an invented "official" first-attack
bundle.
