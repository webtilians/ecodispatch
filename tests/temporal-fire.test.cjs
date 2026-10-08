const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','temporal-fire-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const P=JSON.parse(fs.readFileSync('data/temporal-fire-v1.5/protocol.json','utf8'));
const H=JSON.parse(fs.readFileSync('web/data/fire-snapshots-v1.4.json','utf8'));
const R=JSON.parse(fs.readFileSync('web/data/routing-v1.0.json','utf8'));
const O=JSON.parse(fs.readFileSync('web/data/temporal-fire-v1.5.json','utf8'));
const T=EcoDispatchTemporalFire;

assert.equal(P.version,'1.5');
assert.equal(P.status,'exploratory_design_fixed_before_outcomes');
assert.equal(P.service_minutes,90);
assert.deepEqual(P.arrival_process.regimes.map(x=>[x.id,x.events_per_24h]),[['low',12],['high',36]]);
assert.equal(P.queue.occupied_resources_eligible,false);
assert.equal(O.design_commit,'1b1a3836503384392565a06703b50d45c14dfd18');
assert.equal(O.snapshots.length,6);

const snap=P.frozen_inputs.snapshot_ids[0];
const low=T.setup(P,R,H,snap,'low'),high=T.setup(P,R,H,snap,'high');
const seed=P.simulation.seed+'|test-determinism';
const a=T.eventsFor(low,seed),b=T.eventsFor(low,seed);
assert.deepEqual(a,b);
for(let i=0;i<a.length;i++){
  assert.ok(a[i].arrival_min>=0&&a[i].arrival_min<P.horizon_minutes);
  if(i)assert.ok(a[i].arrival_min>a[i-1].arrival_min);
}
let lowN=0,highN=0;
for(let i=0;i<100;i++){
  lowN+=T.eventsFor(low,seed+'|low|'+i).length;
  highN+=T.eventsFor(high,seed+'|high|'+i).length;
}
assert.ok(highN>2*lowN,'high regime should materially exceed low event count');

const events=T.eventsFor(high,seed+'|trace');
const sim=T.simulate(high,events,'eco',.2,{trace:true});
assert.equal(sim.served+sim.unserved,events.length);
assert.equal(sim.trace.length,sim.served);
const byBrigade={};
for(const x of sim.trace){
  assert.ok(x.dispatchTime+1e-9>=x.arrival);
  assert.ok(x.dispatchTime+1e-9>=x.priorAvailableAt,'occupied brigade dispatched early');
  assert.ok(Math.abs(x.responseDelay-((x.dispatchTime-x.arrival)+x.travelEta))<1e-8);
  assert.ok(x.responseDelay<=P.deadline_min+1e-8);
  assert.ok(Math.abs(x.releaseTime-(x.dispatchTime+x.travelEta+P.service_minutes))<1e-8);
  (byBrigade[x.brigade]??=[]).push(x);
}
for(const rows of Object.values(byBrigade)){
  rows.sort((x,y)=>x.dispatchTime-y.dispatchTime);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].dispatchTime+1e-9>=rows[i-1].releaseTime,'brigade intervals overlap');
}
for(const k of ['coverage','distance','co2Kg','totalHarm','utilizationMean','free0Share','free1Share','free2Share','free3Share'])assert.ok(Number.isFinite(sim[k]));
assert.ok(Math.abs(sim.free0Share+sim.free1Share+sim.free2Share+sim.free3Share-1)<1e-9);

const lambda02=[],lambda1=[];
for(const s of O.snapshots){
  assert.equal(s.summary.length,7);
  const p02=s.summary.find(x=>x.id==='0.2'),p1=s.summary.find(x=>x.id==='1');
  lambda02.push(p02.versusZero.totalHarm);
  lambda1.push(p1.versusZero.totalHarm);
}
assert.ok(lambda02.every(x=>x.mean<0),'lambda=.2 point estimates should match frozen exploratory output');
assert.equal(lambda02.filter(x=>x.bootstrap.ciHigh<0).length,5);
assert.ok(lambda1.every(x=>x.mean>0&&x.bootstrap.ciLow>0),'lambda=1 should be worse in all six fixed cells');

console.log('PASS: v1.5 temporal arrivals, busy-resource eligibility, schedule invariants, fixed results and load regimes');
