/* EcoDispatch v1.6 robustness benchmark. Design commit predates this runner and all outcomes. */
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','temporal-fire-core.js','temporal-robustness-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=p=>digest(fs.readFileSync(p));
const V16=read('data/temporal-robustness-v1.6/protocol.json');
const V15=read('data/temporal-fire-v1.5/protocol.json');
const H=read('web/data/fire-snapshots-v1.4.json');
const R=read('web/data/routing-v1.0.json');
const T=EcoDispatchTemporalFire, U=EcoDispatchTemporalRobustness;

if(V16.version!=='1.6'||V16.base_version!=='1.5'||V16.confirmatory!==false)throw Error('Bad v1.6 protocol identity');
if(JSON.stringify(V16.policies.lambdas)!==JSON.stringify(U.LAMBDAS))throw Error('Policy set mismatch');
if(V15.service_minutes!==90||V15.harm.k_unserved!==10||V15.deadline_min!==120)throw Error('v1.5 baseline changed');

const conditions=[];
for(const snapshotId of V16.frozen_inputs.snapshot_ids){
  for(const regimeId of V16.frozen_inputs.load_regimes){
    const base=T.setup(V15,R,H,snapshotId,regimeId);
    const eventRows=[];
    for(let day=0;day<V16.simulation.days_per_snapshot_load;day++){
      const scenarioSeed=V16.simulation.seed+'|snapshot|'+snapshotId+'|load|'+regimeId+'|day|'+day;
      eventRows.push({day,scenarioSeed,events:T.eventsFor(base,scenarioSeed)});
    }

    for(const serviceMinutes of V16.service_minutes){
      const rows=eventRows.map(x=>({day:x.day,scenarioSeed:x.scenarioSeed,
        policies:U.scenario(base,x.events,serviceMinutes)}));
      const seed=V16.simulation.seed+'|snapshot|'+snapshotId+'|load|'+regimeId+'|service|'+serviceMinutes;
      const operational=U.summarizeOperational(rows);
      const harm=U.summarizeHarm(rows,V16.harm_k,seed,V16.simulation.bootstrap_replicates);
      conditions.push({
        snapshotId,regime:regimeId,serviceMinutes,
        source:base.snapshot.source,hazard:base.snapshot.diversity,
        operational,harm,
        classifications:Object.fromEntries(V16.harm_k.map(k=>[
          String(k),
          Object.fromEntries(U.POLICY_DEFS.filter(p=>p.id!=='0').map(p=>[
            p.id,U.classify(harm[String(k)][p.id].versusZero)
          ]))
        ]))
      });
      console.log(JSON.stringify({
        snapshot:snapshotId,load:regimeId,service:serviceMinutes,
        k60:U.POLICY_DEFS.map(p=>[p.id,harm['60'][p.id].versusZero.mean,U.classify(harm['60'][p.id].versusZero)])
      }));
    }
  }
}

const policyIds=U.POLICY_DEFS.filter(p=>p.id!=='0').map(p=>p.id);
const robustness={};
for(const k of V16.harm_k){
  const kk=String(k);robustness[kk]={};
  for(const id of policyIds){
    const cells=conditions.map(c=>c.classifications[kk][id]);
    const grouped=[];
    for(const snapshotId of V16.frozen_inputs.snapshot_ids)for(const regime of V16.frozen_inputs.load_regimes){
      const three=conditions.filter(c=>c.snapshotId===snapshotId&&c.regime===regime)
        .sort((a,b)=>a.serviceMinutes-b.serviceMinutes)
        .map(c=>c.classifications[kk][id]);
      grouped.push({snapshotId,regime,classes:three,serviceRobustNegative:three.every(x=>x==='negative'),serviceRobustPositive:three.every(x=>x==='positive')});
    }
    robustness[kk][id]={
      negativeCells:cells.filter(x=>x==='negative').length,
      positiveCells:cells.filter(x=>x==='positive').length,
      inconclusiveCells:cells.filter(x=>x==='inconclusive').length,
      totalCells:cells.length,
      serviceRobustNegativeGroups:grouped.filter(x=>x.serviceRobustNegative).length,
      serviceRobustPositiveGroups:grouped.filter(x=>x.serviceRobustPositive).length,
      totalSnapshotLoadGroups:grouped.length,
      globalServiceRobustNegative:grouped.every(x=>x.serviceRobustNegative),
      globalServiceRobustPositive:grouped.every(x=>x.serviceRobustPositive),
      groups:grouped
    };
  }
}

const result={
  version:'1.6',benchmark:'Temporal Fire Robustness Surface',confirmatory:false,
  design_commit:'494e07b0a72da72669d05527c29c32404e391390',
  protocol:V16,
  dataset:{
    routing:R.dataset,routing_sha256:hash('web/data/routing-v1.0.json'),
    hazard:H.dataset,hazard_catalog_sha256:hash('web/data/fire-snapshots-v1.4.json'),
    temporal_protocol_sha256:hash('data/temporal-fire-v1.5/protocol.json'),
    robustness_protocol_sha256:hash('data/temporal-robustness-v1.6/protocol.json')
  },
  conditions,robustness
};
fs.writeFileSync('web/data/temporal-robustness-v1.6.json',JSON.stringify(result,null,2)+'\n');

const report=['# Temporal Fire Robustness v1.6 — exploratory results','',
  'Design fixed before outcomes in commit `494e07b0a72da72669d05527c29c32404e391390`.',
  'No preregistration, multiplicity-adjusted confirmation, calibrated loss function or operational efficacy claim.','',
  'Service sensitivity: 45 / 90 / 180 min. Harm sensitivity: K=10 / 60 / 120.',''];

for(const k of V16.harm_k){
  report.push('## Robustness summary · K='+k,'',
    '| Policy | negative cells | inconclusive | positive cells | service-robust negative groups / 6 | global service-robust negative |',
    '|---|---:|---:|---:|---:|---|');
  for(const id of policyIds){
    const x=robustness[String(k)][id];
    report.push(`| ${id.match(/^\d/)?'λ='+id:id} | ${x.negativeCells}/18 | ${x.inconclusiveCells}/18 | ${x.positiveCells}/18 | ${x.serviceRobustNegativeGroups}/6 | ${x.globalServiceRobustNegative?'yes':'no'} |`);
  }
  report.push('');
}

report.push('## Cell-level total-harm differences','','Each row is paired against λ=0 under identical synthetic events.','',
  '| valid UTC | load | service min | K | λ=.2 ΔH [95% bootstrap] | λ=.35 | λ=.5 | λ=1 |',
  '|---|---|---:|---:|---|---|---|---|');
for(const c of conditions){
  for(const k of V16.harm_k){
    const cell=id=>{const d=c.harm[String(k)][id].versusZero;return `${d.mean.toFixed(2)} [${d.bootstrap.ciLow.toFixed(2)}, ${d.bootstrap.ciHigh.toFixed(2)}]`;};
    report.push(`| ${c.source.valid_time_utc} | ${c.regime} | ${c.serviceMinutes} | ${k} | ${cell('0.2')} | ${cell('0.35')} | ${cell('0.5')} | ${cell('1')} |`);
  }
}
report.push('','K changes evaluation only; it never enters the dispatch decision. Service time changes occupancy, queueing and therefore dispatch state. AEMET classes remain ordinal weights, not incident probabilities.','',
  'All robustness labels are descriptive. The three archived AEMET forecasts come from one model issue and only two distinct node-class profiles. Demand, fleet, service times, severity, emissions and harm remain modeled.','');
fs.writeFileSync('results/temporal-robustness-v1.6-report.md',report.join('\n'));

const csv=[['snapshot','valid_utc','load','service_min','K','policy','classification','deltaH','bootstrap_low','bootstrap_high','coverage','unserved','response_min','p95_response_min','wait_min','km','co2_kg','utilization','all_busy_arrivals'].join(',')];
for(const c of conditions)for(const k of V16.harm_k)for(const def of U.POLICY_DEFS){
  const h=c.harm[String(k)][def.id],op=c.operational[def.id];
  csv.push([c.snapshotId,c.source.valid_time_utc,c.regime,c.serviceMinutes,k,def.id,
    def.id==='0'?'reference':c.classifications[String(k)][def.id],
    h.versusZero.mean,h.versusZero.bootstrap.ciLow,h.versusZero.bootstrap.ciHigh,
    op.coverage.mean,op.unserved.mean,op.meanResponseDelay.mean,op.p95ResponseDelay.mean,
    op.meanWait.mean,op.distance.mean,op.co2Kg.mean,op.utilizationMean.mean,op.arrivalsAllBusy.mean].join(','));
}
fs.writeFileSync('web/data/temporal-robustness-v1.6.csv',csv.join('\n')+'\n');
