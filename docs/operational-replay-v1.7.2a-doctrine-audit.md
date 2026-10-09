# v1.7.2a — INFOCA first-attack doctrine audit

This note records official operational evidence that supports the multi-resource
architecture. It does **not** freeze a universal 2026 first-attack bundle.

## Current evidence

### 2026 INFOCA workforce functions

Official source:
https://www.juntadeandalucia.es/organismos/transparencia/empleo-publico/entidades-instrumentales/ofertas-empleo/detalle/679417.html

The Agencia de Emergencias de Andalucía's 2026 wildfire-specialist role explicitly
includes travel to incidents with **automatic helicopter dispatch when applicable**.
This is direct current evidence that helitransported automatic dispatch remains part
of INFOCA operations in 2026.

The April 2026 public recruitment resolution also lists the same automatic-helicopter
dispatch function for operational staff:
https://www.juntadeandalucia.es/boja/2026/73/15

### Current Plan INFOCA definition of automatic dispatch

Official source:
https://www.juntadeandalucia.es/boja/2010/192/1

The Plan defines `Despacho Automático` as immediate mobilization, without requiring
additional authorization, of human and material resources to the incident within a
delimited area. It also defines an incipient Grade A fire as an incident expected to
be controlled with the Plan's automatic-dispatch resources.

This supports modeling automatic dispatch as a **set of resources**, not as a single
generic brigade.

### Recent aerial procurement: transport followed by water attack

Official 2024 Junta government file:
https://ws040.juntadeandalucia.es/webconsejos/cgobierno/transparencia/240514/documentos/24Acuerdo.pdf

The procurement describes light helicopters operating in their automatic-dispatch
area for first attack by transporting specialist groups, and also performing direct
attack through water and/or foam drops.

This is especially important for the state model: one helicopter can perform
**sequential capabilities** during one incident. Transporting a crew and later
performing water attack must not be represented as two simultaneous helicopters.

### Recent CEDEFO infrastructure description

Official Junta file:
https://ws040.juntadeandalucia.es/webconsejos/cgobierno/transparencia/240924/documentos/16Expediente.pdf

The CEDEFO description explicitly states that the facility must permit automatic
dispatch of a helicopter with a specialist crew aboard so departure is immediate
when a fire alert is received.

## Historical doctrine

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

The historical order is used only to show the long-standing multi-resource shape of
the system. It is not treated as a current 2026 dispatch matrix.

## Architecture implications

The current and historical official evidence supports four v1.7.2a decisions:

1. **One fire is not one resource.** Automatic first attack can mobilize multiple
   heterogeneous human/material resources.
2. **Availability must be tracked per unit.** Ground crews, vehicles and aircraft
   can all be occupied by the same incident and need independent release states.
3. **Capabilities can be sequential.** A transport/extinction helicopter may first
   deliver specialists and then switch to direct water attack. A later phase model
   should represent phases explicitly rather than double-counting that aircraft.
4. **Bundle composition is not universal.** The exact resources mobilized depend on
   incident state, dispatch area and operational judgment; v1.7.2a therefore does
   not manufacture one fixed "official" bundle for every historical fire.

## Why no fixed 2026 first-attack bundle is encoded yet

The 2026 evidence confirms automatic helicopter dispatch, and recent procurement
confirms combined transport/extinction missions. It does **not** provide a complete
current dispatch matrix saying exactly how many specialist groups, autobombas,
aircraft and other units every Málaga incident must receive by grade and zone.

Before an outcome-bearing operational replay, EcoDispatch still needs one of:

- a current INFOCA dispatch/first-attack matrix or instruction;
- incident-level mobilization records from which bundle composition can be measured;
- or a preregistered sensitivity design over plausible bundles, labelled modeled
  rather than operationally observed.

No lambda policy result may be conditioned on an invented "official" first-attack
bundle.
