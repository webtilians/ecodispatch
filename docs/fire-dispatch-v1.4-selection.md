# v1.4 selection rule, fixed before policy comparison

Exploratory design record, **not a preregistration or confirmatory protocol**.
The machine-readable rule and fleet are in
[`protocol.json`](../data/fire-dispatch-v1.4/protocol.json).

Candidate pool: every Peninsula/Balearics danger raster actually present in the
v1.3 archived official AEMET bundle, plus any official bundle acquired and recorded
in the v1.4 acquisition manifest before selection is locked. Accept only candidates
with UTC model/validity tags, a matching legend and valid original classes 1..6
at all ten routing-eligible demand nodes. Record rejected members and reasons.
Deduplicate identical raster hashes; never manufacture dates or classes.

Rank by number of distinct classes descending, range descending, mean class
descending, validity ascending, model time ascending, then raster hash ascending.
Keep the first three, and retain the v1.3 reference raster as an additional
continuity control if absent. Publish the complete candidate ranking and exclusions.
No dispatch result, lambda, outcome, favorable seed or improvement enters this rule.
If fewer candidates exist, keep only those available. Selection cannot promise
large spatial gradients. Multiple forecast lead times from one model issue are
not independent historical weather observations.

Fleet fixed in advance: three identical modeled road brigades at B2/B3/B4, the
existing real-routing experiment's bases. No station optimization on v1.4 outcomes.
Each snapshot receives 1,000 fresh synthetic replicate days, 120 sequential fire
incidents per day, uniform eligible node sampling, severity U[2,5), 120-minute
deadline, zero service time and immediate reuse. Every policy receives exactly
the same events for each snapshot/day, with reset initial fleet. No future events
are available to the dispatch policy. No confirmation or operational claims.
