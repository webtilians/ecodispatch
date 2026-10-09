/* EcoDispatch v1.7.1 Historical Demand Replay. Inputs were frozen before this runner existed. */
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','historical-demand-core.js'])
  vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'),{filename:f});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const P=read('data/historical-demand-v1.7.1/protocol.json');
const F=read('data/historical-demand-v1.7.1/cohort-freeze.json');
const RF=read('data/historical-demand-v1.7.1/routing-freeze.json');
const HR=read('data/historical-demand-v1.7.1/routing.json');
const V15=read('data/temporal-fire-v1.5/protocol.json');
const R=read('web/data/routing-v1.0.json');
const HAZ=read('web/data/fire-snapshots-v1.4.json');
const REAL=read('web/data/real-fire-incidents-v1.7.json');
const X=EcoDispatchHistoricalDemand,A=EcoDispatchAblation,E=EcoDispatchEngine;

if(P.status!=='exploratory_design_fixed_before_policy_outcomes')throw Error('Design status changed');
if(RF.status!=='frozen_before_dispatch_outcomes')throw Error('Routing was not frozen pre-outcome');
if(hash('data/historical-demand-v1.7.1/routing.json')!==RF.routing_sha256)throw Error('Frozen historical routing hash mismatch');
if(hash('data/historical-demand-v1.7.1/cohort-freeze.json')!==HR.inputs.cohort_freeze_sha256)throw Error('Cohort freeze hash mismatch');
if(hash('web/data/routing-v1.0.json')!==HR.inputs.routing_v1_0_sha256)throw Error('v1.0 routing hash mismatch');

const stats=values=>{
  const valid=values.filter(Number.isFinite);
  return valid.length?{...E.describe(valid),missing:values.length-valid.length}:{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
};
const classify=d=>d.mean<0&&d.bootstrap.ciHigh<0?'negative':d.mean>0&&d.bootstrap.ciLow>0?'positive':'inconclusive';
const operational=x=>Object.fromEntries(X.OPS.map(k=>[k,x[k]]));

function eventWeighted(results){
  const total=k=>results.reduce((s,x)=>s+(Number.isFinite(x[k])?x[k]:0),0);
  const events=total('eventCount'),served=total('served');
  const weighted=(metric,weight='served')=>{
    let num=0,den=0;
    for(const x of results){
      if(Number.isFinite(x[metric])&&Number.isFinite(x[weight])&&x[weight]>0){
        num+=x[metric]*x[weight];den+=x[weight];
      }
    }
    return den?num/den:null;
  };
  return {
    eventCount:events,served,unserved:total('unserved'),coverage:events?served/events:1,
    meanResponseDelay:weighted('meanResponseDelay'),
    meanTravelEta:weighted('meanTravelEta'),
    meanWait:weighted('meanWait'),
    distance:total('distance'),co2Kg:total('co2Kg'),
    arrivalsAllBusy:total('arrivalsAllBusy'),arrivalsAnyBusy:total('arrivalsAnyBusy'),
    waitedServed:total('waitedServed'),maxQueue:Math.max(0,...results.map(x=>x.maxQueue||0))
  };
}

function summarizeOperational(rows){
  const active=rows.filter(r=>r.eventCount>0);
  return Object.fromEntries(X.POLICY_DEFS.map(def=>{
    const all=rows.map(r=>r.policies[def.id]),act=active.map(r=>r.policies[def.id]);
    return [def.id,{
      calendar:Object.fromEntries(X.OPS.map(k=>[k,stats(all.map(v=>v[k]))])),
      active:Object.fromEntries(X.OPS.map(k=>[k,stats(act.map(v=>v[k]))])),
      eventWeighted:eventWeighted(all),
      decisionDifferentActiveDays:active.filter(r=>JSON.stringify(r.policies[def.id].dispatch)!==JSON.stringify(r.policies['0'].dispatch)).length,
      activeDays:active.length
    }];
  }));
}

function summarizeYears(rows){
  const out={};
  for(let year=P.cohort.years[0];year<=P.cohort.years[1];year++){
    const ys=rows.filter(r=>r.year===year);
    out[String(year)]=Object.fromEntries(X.POLICY_DEFS.map(def=>[
      def.id,eventWeighted(ys.map(r=>r.policies[def.id]))
    ]));
  }
  return out;
}

function summarizeHarm(rows,seed){
  const active=rows.filter(r=>r.eventCount>0);
  return Object.fromEntries(P.harm_k.map(k=>{
    const byPolicy=Object.fromEntries(X.POLICY_DEFS.map(def=>{
      const values=rows.map(r=>X.totalHarm(r.policies[def.id],k));
      const zero=rows.map(r=>X.totalHarm(r.policies['0'],k));
      const diffs=values.map((v,i)=>v-zero[i]);
      const activeVals=active.map(r=>X.totalHarm(r.policies[def.id],k));
      const activeZero=active.map(r=>X.totalHarm(r.policies['0'],k));
      const activeDiffs=activeVals.map((v,i)=>v-activeZero[i]);
      const paired={...stats(diffs),bootstrap:A.bootstrapCI(diffs,seed+'|K|'+k+'|policy|'+def.id,P.aggregation.bootstrap_replicates)};
      return [def.id,{
        calendar:stats(values),active:stats(activeVals),
        versusZero:paired,versusZeroActive:stats(activeDiffs),
        total:values.reduce((a,b)=>a+b,0)
      }];
    }));
    return [String(k),byPolicy];
  }));
}

function yearlyHarm(rows){
  const out={};
  for(let year=P.cohort.years[0];year<=P.cohort.years[1];year++){
    const ys=rows.filter(r=>r.year===year);
    out[String(year)]=Object.fromEntries(P.harm_k.map(k=>[
      String(k),
      Object.fromEntries(X.POLICY_DEFS.map(def=>[
        def.id,ys.reduce((s,r)=>s+X.totalHarm(r.policies[def.id],k),0)
      ]))
    ]));
  }
  return out;
}

const conditions=[];
for(const snapshotId of P.frozen_inputs.hazard_snapshot_ids){
  const state=X.setup(P,V15,R,HR,HAZ,snapshotId,REAL,F);
  for(const serviceMinutes of P.service_minutes){
    const rows=state.observed.days.map(day=>({
      date:day.date,year:day.year,eventCount:day.events.length,
      policies:X.scenario(state,day.events,serviceMinutes)
    }));
    const seed='ecodispatch-historical-replay-171|snapshot|'+snapshotId+'|service|'+serviceMinutes;
    const operationalSummary=summarizeOperational(rows);
    const harm=summarizeHarm(rows,seed);
    const classifications=Object.fromEntries(P.harm_k.map(k=>[
      String(k),
      Object.fromEntries(X.POLICY_DEFS.filter(d=>d.id!=='0').map(def=>[
        def.id,classify(harm[String(k)][def.id].versusZero)
      ]))
    ]));
    conditions.push({
      snapshotId,serviceMinutes,
      source:state.snapshot.source,hazard:state.snapshot.diversity,
      demand:{
        calendarDays:rows.length,
        activeDays:rows.filter(r=>r.eventCount>0).length,
        events:rows.reduce((s,r)=>s+r.eventCount,0),
        multiEventDays:rows.filter(r=>r.eventCount>1).length,
        maxEventsPerDay:Math.max(...rows.map(r=>r.eventCount))
      },
      operational:operationalSummary,
      harm,classifications,
      yearly:summarizeYears(rows),
      yearlyHarm:yearlyHarm(rows)
    });
    console.log(JSON.stringify({
      snapshot:snapshotId,service:serviceMinutes,
      k60:X.POLICY_DEFS.map(def=>[
        def.id,
        harm['60'][def.id].versusZero.mean,
        def.id==='0'?'reference':classifications['60'][def.id],
        operationalSummary[def.id].decisionDifferentActiveDays
      ])
    }));
  }
}

const policyIds=X.POLICY_DEFS.filter(d=>d.id!=='0').map(d=>d.id);
const robustness={};
for(const k of P.harm_k){
  const kk=String(k);robustness[kk]={};
  for(const id of policyIds){
    const cells=conditions.map(c=>c.classifications[kk][id]);
    const groups=P.frozen_inputs.hazard_snapshot_ids.map(snapshotId=>{
      const cs=conditions.filter(c=>c.snapshotId===snapshotId).sort((a,b)=>a.serviceMinutes-b.serviceMinutes);
      const labels=cs.map(c=>c.classifications[kk][id]);
      return {
        snapshotId,classes:labels,
        serviceRobustNegative:labels.every(x=>x==='negative'),
        serviceRobustPositive:labels.every(x=>x==='positive')
      };
    });
    robustness[kk][id]={
      negativeCells:cells.filter(x=>x==='negative').length,
      positiveCells:cells.filter(x=>x==='positive').length,
      inconclusiveCells:cells.filter(x=>x==='inconclusive').length,
      totalCells:cells.length,
      serviceRobustNegativeContexts:groups.filter(x=>x.serviceRobustNegative).length,
      serviceRobustPositiveContexts:groups.filter(x=>x.serviceRobustPositive).length,
      totalHazardContexts:groups.length,
      globalServiceRobustNegative:groups.every(x=>x.serviceRobustNegative),
      globalServiceRobustPositive:groups.every(x=>x.serviceRobustPositive),
      groups
    };
  }
}

const result={
  version:'1.7.1',benchmark:'Historical Demand Replay',confirmatory:false,
  designBaseCommit:P.design_base_commit,
  frozenAt:{
    cohortManifestSha256:hash('data/historical-demand-v1.7.1/cohort-freeze.json'),
    routingSha256:RF.routing_sha256,
    routingGeneratedAtUtc:RF.generated_at_utc
  },
  cohort:F.counts,
  assumptions:{
    observed:['EGIF detection calendar time','EGIF latitude/longitude'],
    modeled:['three-brigade fleet','severity U[2,5)','45/90/180 min service','120 min deadline','emissions','harm K'],
    hazard:'three frozen 2026 AEMET snapshots crossed as policy contexts; not historical weather',
    road:'frozen modern OSM/OSRM access to historical coordinates; not historical road reconstruction',
    serviceCalibration:'deferred to v1.7.2'
  },
  protocol:P,
  routingAudit:HR.audit,
  conditions,robustness
};
fs.writeFileSync('web/data/historical-demand-v1.7.1.json',JSON.stringify(result,null,2)+'\n');

const compact={
  version:result.version,benchmark:result.benchmark,confirmatory:false,
  frozenAt:result.frozenAt,cohort:result.cohort,assumptions:result.assumptions,
  routingAudit:result.routingAudit,robustness:result.robustness,
  conditions:conditions.map(c=>({
    snapshotId:c.snapshotId,serviceMinutes:c.serviceMinutes,source:c.source,hazard:c.hazard,demand:c.demand,
    operational:Object.fromEntries(X.POLICY_DEFS.map(def=>[def.id,{
      eventWeighted:c.operational[def.id].eventWeighted,
      decisionDifferentActiveDays:c.operational[def.id].decisionDifferentActiveDays,
      activeDays:c.operational[def.id].activeDays
    }])),
    harm:Object.fromEntries(P.harm_k.map(k=>[
      String(k),
      Object.fromEntries(X.POLICY_DEFS.map(def=>[
        def.id,{versusZero:c.harm[String(k)][def.id].versusZero,total:c.harm[String(k)][def.id].total}
      ]))
    ])),
    classifications:c.classifications
  }))
};
fs.writeFileSync('web/data/historical-demand-v1.7.1-summary.json',JSON.stringify(compact,null,2)+'\n');

const report=[
  '# Historical Demand Replay v1.7.1 — exploratory results','',
  'Design, cohort and sparse routing were frozen before this runner and before any v1.7.1 policy outcome.','',
  `Observed demand: ${F.counts.primary_events} EGIF events across ${F.counts.active_fire_days} active fire days / ${F.counts.calendar_days} calendar days (2006–2023). Three ambiguous-midnight detections are excluded by the pre-outcome rule.`,'',
  'Only incident time/location are historical. Fleet, severity, service duration, deadline, emissions, harm and AEMET policy contexts remain modeled. The AEMET snapshots are 2026 contexts, not historical weather.','',
  '## Robustness summary · K=60','',
  '| Policy | favorable cells | inconclusive | unfavorable cells | service-robust favorable contexts / 3 | global service-robust favorable |',
  '|---|---:|---:|---:|---:|---|'
];
for(const id of policyIds){
  const x=robustness['60'][id];
  report.push(`| ${id.match(/^\d/)?'λ='+id:id} | ${x.negativeCells}/9 | ${x.inconclusiveCells}/9 | ${x.positiveCells}/9 | ${x.serviceRobustNegativeContexts}/3 | ${x.globalServiceRobustNegative?'yes':'no'} |`);
}
report.push('','## K=60 cell details','',
  '| AEMET valid UTC | service min | policy | ΔH vs λ=0 [95% paired bootstrap] | event-weighted coverage | event-weighted response min | km | different active-day dispatches |',
  '|---|---:|---|---|---:|---:|---:|---:|');
for(const c of conditions){
  for(const id of policyIds){
    const h=c.harm['60'][id].versusZero,o=c.operational[id];
    const ci=`${h.mean.toFixed(3)} [${h.bootstrap.ciLow.toFixed(3)}, ${h.bootstrap.ciHigh.toFixed(3)}]`;
    report.push(`| ${c.source.valid_time_utc} | ${c.serviceMinutes} | ${id.match(/^\d/)?'λ='+id:id} | ${ci} | ${o.eventWeighted.coverage.toFixed(6)} | ${o.eventWeighted.meanResponseDelay===null?'NA':o.eventWeighted.meanResponseDelay.toFixed(3)} | ${o.eventWeighted.distance.toFixed(3)} | ${o.decisionDifferentActiveDays} |`);
  }
}
report.push('',
  'Paired bootstrap resamples calendar-day harm differences; zero-fire days remain part of the calendar exposure. Operational summaries separately report calendar-day, active-day and event-weighted views.','',
  'No best lambda is selected. A lower synthetic H_K is not an operational efficacy claim. Service-time calibration remains out of scope for v1.7.1.','');
fs.writeFileSync('results/historical-demand-v1.7.1-report.md',report.join('\n'));

const csv=[['snapshot','valid_utc','service_min','K','policy','classification','deltaH','bootstrap_low','bootstrap_high','event_count','coverage','response_min','wait_min','km','co2_kg','unserved','different_active_day_dispatches'].join(',')];
for(const c of conditions)for(const k of P.harm_k)for(const def of X.POLICY_DEFS){
  const h=c.harm[String(k)][def.id],o=c.operational[def.id].eventWeighted;
  csv.push([
    c.snapshotId,c.source.valid_time_utc,c.serviceMinutes,k,def.id,
    def.id==='0'?'reference':c.classifications[String(k)][def.id],
    h.versusZero.mean,h.versusZero.bootstrap.ciLow,h.versusZero.bootstrap.ciHigh,
    o.eventCount,o.coverage,o.meanResponseDelay,o.meanWait,o.distance,o.co2Kg,o.unserved,
    c.operational[def.id].decisionDifferentActiveDays
  ].join(','));
}
fs.writeFileSync('web/data/historical-demand-v1.7.1.csv',csv.join('\n')+'\n');
