/* Offline, outcome-independent catalog lock; per-snapshot paired fire experiment. */
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','fire-dispatch-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const hash=p=>digest(fs.readFileSync(p));
const H=read('web/data/fire-snapshots-v1.4.json'),R=read('web/data/routing-v1.0.json'),P=read('data/fire-dispatch-v1.4/protocol.json'),L=read('data/fire-dispatch-v1.4/selection-lock.json');
if(hash('web/data/fire-snapshots-v1.4.json')!==L.catalog_sha256||hash('web/data/routing-v1.0.json')!==H.routing.sha256||hash('data/fire-dispatch-v1.4/protocol.json')!==H.protocol_sha256)throw Error('Frozen dataset/protocol identity mismatch');
const F=EcoDispatchFireDispatch,allRows=[],snapshots=[];
const compact=p=>{const {dispatch,...metrics}=p;return {...metrics,dispatch_sha256:digest(JSON.stringify(dispatch))};};
for(const id of H.selection.selected_ids){
  const state=F.setup(P,R,H,id),rows=[];
  const diagnostics={daysWithDifferentDispatchVsZero:Object.fromEntries(['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(k=>[k,0])),
    changedAssignmentsVsZero:Object.fromEntries(['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(k=>[k,0])),
    unitWeightControl:{lambda:.35,daysWithDifferentDispatch:0,changedAssignments:0,totalHarmDeltaMean:0},firstDivergence:null};
  for(let i=0;i<P.days;i++){
    const row=F.scenario(state,i),zero=row.policies[0];
    const alternatives=[...row.policies.slice(1).map(p=>[String(p.lambda),p]),['eta-greedy',row.etaGreedy],['distance-greedy',row.distanceGreedy]];
    for(const [policy,p] of alternatives){
      const changes=p.dispatch.reduce((s,x,j)=>s+Number(x!==zero.dispatch[j]),0);
      diagnostics.changedAssignmentsVsZero[policy]+=changes;
      if(changes)diagnostics.daysWithDifferentDispatchVsZero[policy]++;
      if(changes&&!diagnostics.firstDivergence){
        const eventIndex=p.dispatch.findIndex((x,j)=>x!==zero.dispatch[j]);
        diagnostics.firstDivergence={day:i,scenarioSeed:row.scenarioSeed,policy,eventIndex,event:row.events[eventIndex],zero:zero.dispatch[eventIndex],alternative:p.dispatch[eventIndex]};
      }
    }
    // Same events and fleet: isolates actual ordinal hazard from uniform class 1.
    const control=F.simulate(state,row.events,'eco',.35,state.demand.map(()=>1));
    const spatial=row.policies.find(p=>p.lambda===.35);
    const changes=spatial.dispatch.reduce((s,x,j)=>s+Number(x!==control.dispatch[j]),0);
    diagnostics.unitWeightControl.daysWithDifferentDispatch+=Number(changes>0);
    diagnostics.unitWeightControl.changedAssignments+=changes;
    diagnostics.unitWeightControl.totalHarmDeltaMean+=(spatial.totalHarm-control.totalHarm)/P.days;
    rows.push({index:i,scenarioSeed:row.scenarioSeed,events_sha256:digest(JSON.stringify(row.events)),
      policies:row.policies.map(compact),etaGreedy:compact(row.etaGreedy),distanceGreedy:compact(row.distanceGreedy),unitWeightControl:compact(control)});
  }
  const summary=EcoDispatchRealRouting.summarize(rows,P.seed+'|'+id,P.bootstrap_replicates);
  snapshots.push({id,source:state.snapshot.source,diversity:state.snapshot.diversity,diagnostics,summary});
  allRows.push({snapshot:id,rows});
  console.log(JSON.stringify({snapshot:id,diagnostics,harm:summary.map(p=>[p.id,p.absolute.totalHarm.mean])}));
}
const rowsPath='results/fire-dispatch-v1.4-rows.json';
fs.writeFileSync(rowsPath,JSON.stringify({version:'1.4',seed:P.seed,snapshots:allRows})+'\n');
const result={version:'1.4',benchmark:'Fire Dispatch Experiment',confirmatory:false,
  dataset:{hazard:H.dataset,catalog_sha256:L.catalog_sha256,routing:R.dataset,routing_sha256:H.routing.sha256,protocol_sha256:H.protocol_sha256,rows_sha256:hash(rowsPath)},
  protocol:P,limitations:H.limitation,snapshots};
fs.writeFileSync('web/data/fire-benchmark-v1.4.json',JSON.stringify(result,null,2)+'\n');
const columns=['snapshot','valid_time_utc','model_time_utc','lead_hours','policy','coverage_pct','mean_eta_min','p95_eta_min','km','co2_kg','totalHarm','delta_harm_vs_zero','paired_bootstrap_low','paired_bootstrap_high'];
const csv=[columns.join(',')];
let report='# Fire Dispatch v1.4 — exploratory results\n\nNo preregistration, confirmation or operational efficacy claim. Real: frozen OSM/OSRM road matrix and official AEMET danger rasters. Synthetic: three brigades/stations, incidents, severity, emissions and zero service times.\n\n'+H.limitation+'\n\nThe October 8 and 11 snapshots have identical node-class vectors: only two distinct selected spatial profiles. Different snapshot seed streams cause sampling differences between their results; those are not hazard differences.\n\nEach snapshot: 1,000 paired synthetic replicate days × 120 fire-only events. Three brigades start at B2/B3/B4 every replicate. See [methods](../docs/fire-dispatch-v1.4.md) and the [selection rule](../docs/fire-dispatch-v1.4-selection.md).\n';
for(const s of snapshots){
  report+=`\n## Valid ${s.source.valid_time_utc} · lead ${s.source.lead_hours} h\n\n| Policy | Coverage % | ETA min | P95 min | km | CO₂ kg | totalHarm | Δ harm vs λ=0 [paired bootstrap 95%] |\n|---|---:|---:|---:|---:|---:|---:|---|\n`;
  for(const p of s.summary){
    const values=[100*p.absolute.served.mean/P.incidents_per_day,...['meanEta','p95Eta','distance','co2Kg','totalHarm'].map(k=>p.absolute[k].mean)];
    const d=p.versusZero.totalHarm;
    report+=`| ${p.id} | ${values.map(x=>x===null?'—':x.toFixed(3)).join(' | ')} | ${d.mean.toFixed(3)} [${d.bootstrap.ciLow.toFixed(3)}, ${d.bootstrap.ciHigh.toFixed(3)}] |\n`;
    csv.push([s.id,s.source.valid_time_utc,s.source.model_time_utc,s.source.lead_hours,p.id,...values,d.mean,d.bootstrap.ciLow,d.bootstrap.ciHigh].join(','));
  }
  report+=`\nDays with different dispatch vs λ=0: ${JSON.stringify(s.diagnostics.daysWithDifferentDispatchVsZero)}.\n\nSpatial vs uniform-class-1 control at λ=.35 (same events): ${s.diagnostics.unitWeightControl.daysWithDifferentDispatch} / ${P.days} days differ; mean synthetic harm difference ${s.diagnostics.unitWeightControl.totalHarmDeltaMean.toFixed(3)}. This is a sensitivity diagnostic, not evidence that hazard predicts incidents.\n`;
  if(!s.diagnostics.firstDivergence)report+='\nNo policy dispatch divergence was observed. This is a documented null result; no effect was manufactured.\n';
}
report+='\nCoverage = served / 120. ETA and P95 are means of per-day served-event values; P95 uses floor(.95*(n-1)), not pooled events. Missing ETA/P95 values remain null and are counted. totalHarm = severity × ETA for served events + 10 × severity² for unserved events. The unserved penalty can be smaller than a long served delay; harm is an arbitrary surrogate and must be read jointly with coverage. Travel excludes return to station; brigades remain at the last event node and are immediately available. Kilometres and CO₂ are per-day totals, not observed emissions.\n\nIntervals resample paired synthetic days (500 replicates) separately per snapshot. They quantify Monte Carlo uncertainty under this model, not weather sampling, historical generalization, or multiplicity-adjusted confirmation. Lower harm need not mean higher coverage or better performance under other metrics. No best lambda is selected.\n';
fs.writeFileSync('results/fire-dispatch-v1.4-report.md',report);
fs.writeFileSync('web/data/fire-benchmark-v1.4.csv',csv.join('\n')+'\n');
