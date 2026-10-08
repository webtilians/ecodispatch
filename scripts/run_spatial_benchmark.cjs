/* Deterministic exploratory artifact: fresh seeds, no holdout reuse or efficacy test. */
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','spatial-hazard-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const C=read('web/data/current.json'),R=read('web/data/routing-v1.0.json'),H=read('web/data/spatial-hazard-v1.3.json');
const S=EcoDispatchSpatialHazard,base=EcoDispatchRealRouting,state=S.setup(C,R,H);
if(hash('web/data/routing-v1.0.json')!==H.routing.sha256)throw Error('Routing bytes changed');
const seed='ecodispatch-spatial-hazard-13-exploratory-20261008',n=1000;
const rows=Array.from({length:n},(_,i)=>S.scenario(C,R,state,seed,i));
const summary=S.summarize(rows,seed,500);
// Fire-only metrics replay the fire subsequence: strict capabilities isolate it from other events.
const fireRows=Array.from({length:n},(_,i)=>{
  const events=S.generateDay(state.demand,120,EcoDispatchEngine.mulberry32(EcoDispatchEngine.hashString(seed+'|day|'+i))).filter(e=>e.type==='fire');
  const run=(policy,lambda)=>S.simulate(state.demand,state.resources,events,R,state.idx,policy,lambda);
  return {index:i,incidentCount:events.length,policies:S.LAMBDAS.map(lambda=>({lambda,...run('eco',lambda)})),etaGreedy:run('eta-greedy',0),distanceGreedy:run('distance-greedy',0)};
});
const fireSummary=S.summarize(fireRows,seed+'|fire-only',500);
const syntheticState=base.setup(C,R);
const controlRows=Array.from({length:n},(_,i)=>base.scenario(C,R,syntheticState,seed,i));
const sameOutcomes=JSON.stringify(rows)===JSON.stringify(controlRows);
const result={version:'1.3',benchmark:'real-routing + real fire-hazard spatial benchmark',confirmatory:false,
  seed,seedPattern:seed+'|day|index',n,incidentsPerDay:120,harmK:10,bootstrapB:500,
  dataset:{hazard:H.dataset,hazard_sha256:hash('web/data/spatial-hazard-v1.3.json'),routing:R.dataset,routing_sha256:H.routing.sha256},
  model:{fire:'Exposure uses raw AEMET ordinal classes 1..6; no normalization or probability calibration',
    medical_recon:'Original synthetic risk_weight; recon is engine type drone',
    event_sampling:'Original synthetic risk_weight for ALL event types; hazard classes never define incident probabilities',
    placement:'Original synthetic placement B2/B3/B4, fixed across policies; isolates exposure change',
    resources:'Original strict capabilities: one fire brigade, no alternative eligible fire responder',
    time:'One fixed 24-hour forecast snapshot reused across synthetic days; no temporal forecast validation',
    limitations:'Instant availability; synthetic incident timing/severity; no real-world efficacy claim; ordinal spacing is an uncalibrated modeling convention'},
  diagnostics:{sameOutcomesAsSyntheticControl:sameOutcomes,
    syntheticExposure: S.exposure(state.demand.map(d=>({...d,hazard_weight:d.risk_weight})),state.resources,state.resources.map(r=>r.nodeId),R,state.idx),
    spatialExposure: S.exposure(state.demand,state.resources,state.resources.map(r=>r.nodeId),R,state.idx)},
  summary,fireSummary,meanFireIncidents:fireRows.reduce((s,r)=>s+r.incidentCount,0)/n};
const out='web/data/spatial-benchmark-v1.3.json';
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('results/spatial-hazard-v1.3-rows.json',JSON.stringify({seed,rows,fireRows})+'\n');
const table=(summ,den)=>['| Policy | Coverage % | ETA min | P95 min | km | CO2 kg | totalHarm | Δ harm vs λ=0 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',...summ.map(p=>`| ${p.id} | ${(100*p.absolute.served.mean/den).toFixed(3)} | ${['meanEta','p95Eta','distance','co2Kg','totalHarm'].map(k=>p.absolute[k].mean.toFixed(3)).join(' | ')} | ${p.versusZero.totalHarm.mean.toFixed(3)} |`)].join('\n');
fs.writeFileSync('results/spatial-hazard-v1.3-report.md',`# v1.3 exploratory results\n\n${result.benchmark}. Not confirmatory and not evidence of real-world efficacy.\n\nSeed: \`${seed}\`; 1,000 paired synthetic days × 120 incidents; K=10; 500 paired bootstrap replicates.\n\n## All types\n\n${table(summary,120)}\n\n## Fire only\n\n${table(fireSummary,result.meanFireIncidents)}\n\nCoverage is served/incident count (aggregate); ETA and P95 are means of per-day served-event metrics, not a pooled percentile. Zero-served days are omitted for ETA/P95 and counted by the JSON missing field. Paired CIs and every metric delta are in the static JSON. totalHarm is synthetic severity × delay plus 10 × severity² for unserved events, not lives or observed damage.\n\nThe spatial exposure changes from ${result.diagnostics.syntheticExposure} to ${result.diagnostics.spatialExposure}. All policy outcomes equal the synthetic-weight control on the SAME NEW seeds: ${sameOutcomes}. A single fire-capable brigade makes fire assignment invariant to lambda and the ordinal fire weights; medical/recon potential differences are unchanged. Fire-only policy differences are therefore structurally zero. Aggregate differences between lambdas arise from medical/recon synthetic weights. This benchmark validates integration, not fire-dispatch benefit. No fleet changes were made to manufacture an effect.\n\nHistorical v1.1.1 holdout was neither reused nor used as confirmation. Source and transformations: [methodology](../docs/spatial-hazard-v1.3.md).\n`);
console.log(JSON.stringify({n,sameOutcomes,diagnostics:result.diagnostics,summary:summary.map(p=>({id:p.id,harm:p.absolute.totalHarm.mean}))}));
