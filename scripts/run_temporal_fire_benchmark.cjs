/* v1.5 offline temporal fire benchmark. Fixed protocol precedes outcome generation. */
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','temporal-fire-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=p=>digest(fs.readFileSync(p));
const P=read('data/temporal-fire-v1.5/protocol.json'),H=read('web/data/fire-snapshots-v1.4.json'),R=read('web/data/routing-v1.0.json');
const T=EcoDispatchTemporalFire;
const snapshots=[];
const compact=x=>{const {dispatch,...rest}=x;return rest;};
for(const snapshotId of P.frozen_inputs.snapshot_ids){
  const source=H.candidates.find(x=>x.id===snapshotId).source;
  for(const regime of P.arrival_process.regimes){
    const state=T.setup(P,R,H,snapshotId,regime.id),rows=[];
    const diagnostics={daysWithDifferentDispatchVsZero:Object.fromEntries(['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(k=>[k,0])),
      changedAssignmentsVsZero:Object.fromEntries(['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(k=>[k,0])),
      daysWithCoverageDifference:Object.fromEntries(['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(k=>[k,0])),firstDivergence:null};
    for(let i=0;i<P.simulation.days_per_snapshot_regime;i++){
      const row=T.scenario(state,i),zero=row.policies[0];
      const alts=[...row.policies.slice(1).map(x=>[String(x.lambda),x]),['eta-greedy',row.etaGreedy],['distance-greedy',row.distanceGreedy]];
      for(const [id,x] of alts){
        const changes=x.dispatch.reduce((s,v,j)=>s+Number(v!==zero.dispatch[j]),0);
        diagnostics.changedAssignmentsVsZero[id]+=changes;
        diagnostics.daysWithDifferentDispatchVsZero[id]+=Number(changes>0);
        diagnostics.daysWithCoverageDifference[id]+=Number(x.served!==zero.served);
        if(changes&&!diagnostics.firstDivergence){
          const j=x.dispatch.findIndex((v,k)=>v!==zero.dispatch[k]);
          diagnostics.firstDivergence={day:i,scenarioSeed:row.scenarioSeed,policy:id,eventIndex:j,event:row.events[j],zero:zero.dispatch[j],alternative:x.dispatch[j]};
        }
      }
      rows.push({index:i,scenarioSeed:row.scenarioSeed,eventCount:row.events.length,
        policies:row.policies.map(compact),etaGreedy:compact(row.etaGreedy),distanceGreedy:compact(row.distanceGreedy)});
    }
    const summary=T.summarize(rows,P.simulation.seed+'|'+snapshotId+'|'+regime.id,P.simulation.bootstrap_replicates);
    snapshots.push({snapshotId,regime:regime.id,source,hazard:H.candidates.find(x=>x.id===snapshotId).diversity,diagnostics,summary});
    console.log(snapshotId,regime.id,summary.map(x=>[x.id,x.absolute.coverage.mean,x.versusZero.totalHarm.mean]));
  }
}
const result={version:'1.5',benchmark:'Temporal Fire Operations',confirmatory:false,
  design_commit:'1b1a3836503384392565a06703b50d45c14dfd18',
  dataset:{hazard:H.dataset,hazard_catalog_sha256:hash('web/data/fire-snapshots-v1.4.json'),routing:R.dataset,routing_sha256:hash('web/data/routing-v1.0.json'),protocol_sha256:hash('data/temporal-fire-v1.5/protocol.json')},
  protocol:P,snapshots};
fs.writeFileSync('web/data/temporal-fire-v1.5.json',JSON.stringify(result,null,2)+'\n');
const report=['# Temporal Fire Operations v1.5 — exploratory results','',
  'Fixed design commit: `1b1a3836503384392565a06703b50d45c14dfd18`. No preregistration or efficacy claim.',
  '',`Real layers: frozen OSM/OSRM road routing + archived AEMET hazard. Synthetic/modelled: fleet, Poisson arrivals, locations, severity, 90-minute service, emissions and harm.`,''];
const csv=[['snapshot','valid_utc','load','policy','events_mean','coverage_pct','unserved_mean','response_min','p95_response_min','wait_min','p95_wait_min','km','co2_kg','utilization_pct','all_busy_arrivals','totalHarm','deltaH','bootstrap_low','bootstrap_high'].join(',')];
for(const s of snapshots){
  report.push(`## ${s.regime} load · valid ${s.source.valid_time_utc}`,'',
    '| Policy | events | coverage % | unserved | response min | P95 | wait | km | util % | all-busy arrivals | totalHarm | ΔH [bootstrap 95%] |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for(const p of s.summary){
    const a=p.absolute,d=p.versusZero.totalHarm;
    const vals=[a.eventCount.mean,100*a.coverage.mean,a.unserved.mean,a.meanResponseDelay.mean,a.p95ResponseDelay.mean,a.meanWait.mean,a.distance.mean,100*a.utilizationMean.mean,a.arrivalsAllBusy.mean,a.totalHarm.mean];
    report.push(`| ${p.id} | ${vals.map(v=>Number.isFinite(v)?v.toFixed(3):'—').join(' | ')} | ${d.mean.toFixed(3)} [${d.bootstrap.ciLow.toFixed(3)}, ${d.bootstrap.ciHigh.toFixed(3)}] |`);
    csv.push([s.snapshotId,s.source.valid_time_utc,s.regime,p.id,a.eventCount.mean,100*a.coverage.mean,a.unserved.mean,a.meanResponseDelay.mean,a.p95ResponseDelay.mean,a.meanWait.mean,a.p95Wait.mean,a.distance.mean,a.co2Kg.mean,100*a.utilizationMean.mean,a.arrivalsAllBusy.mean,a.totalHarm.mean,d.mean,d.bootstrap.ciLow,d.bootstrap.ciHigh].join(','));
  }
  report.push('',`Days with different dispatch vs λ=0: ${JSON.stringify(s.diagnostics.daysWithDifferentDispatchVsZero)}.`,
    `Days with coverage difference vs λ=0: ${JSON.stringify(s.diagnostics.daysWithCoverageDifference)}.`,'');
}
report.push('Coverage and harm are simulator quantities. Intervals are paired Monte Carlo uncertainty under fixed inputs only; they do not cover weather, fleet, service-time or demand uncertainty. No lambda is selected as optimal.','');
fs.writeFileSync('results/temporal-fire-v1.5-report.md',report.join('\n'));
fs.writeFileSync('web/data/temporal-fire-v1.5.csv',csv.join('\n')+'\n');