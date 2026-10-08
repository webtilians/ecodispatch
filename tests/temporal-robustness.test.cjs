const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','temporal-fire-core.js','temporal-robustness-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const P16=JSON.parse(fs.readFileSync('data/temporal-robustness-v1.6/protocol.json','utf8'));
const P15=JSON.parse(fs.readFileSync('data/temporal-fire-v1.5/protocol.json','utf8'));
const H=JSON.parse(fs.readFileSync('web/data/fire-snapshots-v1.4.json','utf8'));
const R=JSON.parse(fs.readFileSync('web/data/routing-v1.0.json','utf8'));
const O=JSON.parse(fs.readFileSync('web/data/temporal-robustness-v1.6.json','utf8'));
const T=EcoDispatchTemporalFire,U=EcoDispatchTemporalRobustness;

assert.equal(P16.version,'1.6');
assert.equal(P16.status,'exploratory_robustness_design_fixed_before_outcomes');
assert.deepEqual(P16.service_minutes,[45,90,180]);
assert.deepEqual(P16.harm_k,[10,60,120]);
assert.equal(O.design_commit,'494e07b0a72da72669d05527c29c32404e391390');
assert.equal(O.conditions.length,18);
assert.equal(120/2,60);
for(const s of [2,2.5,3,4,4.999])assert.ok(60*s*s>=120*s-1e-9);

const base=T.setup(P15,R,H,P16.frozen_inputs.snapshot_ids[0],'high');
const seed=P16.simulation.seed+'|unit|same-events';
const events=T.eventsFor(base,seed);
const a=U.scenario(base,events,45),b=U.scenario(base,events,180);
assert.equal(a['0'].eventCount,b['0'].eventCount);
assert.ok(events.length>0);
for(const service of P16.service_minutes){
  const rows=U.scenario(base,events,service);
  for(const id of ['0','0.2','0.35','0.5','1','eta-greedy','distance-greedy']){
    const x=rows[id];
    assert.equal(x.served+x.unserved,x.eventCount);
    assert.ok(x.servedSeverityDelay>=0&&x.unservedSeveritySq>=0);
    assert.ok(Math.abs(U.totalHarm(x,10)-x.totalHarm)<1e-7);
    assert.ok(U.totalHarm(x,120)>=U.totalHarm(x,60)-1e-9);
  }
}

for(const k of ['10','60','120']){
  const p02=O.robustness[k]['0.2'],p1=O.robustness[k]['1'];
  assert.equal(p02.negativeCells+p02.inconclusiveCells+p02.positiveCells,18);
  assert.equal(p02.positiveCells,0);
  assert.equal(p02.serviceRobustNegativeGroups,2);
  assert.equal(p02.globalServiceRobustNegative,false);
  assert.equal(p1.negativeCells,0);
}
assert.deepEqual(
  [O.robustness['60']['0.2'].negativeCells,O.robustness['60']['0.2'].inconclusiveCells,O.robustness['60']['0.2'].positiveCells],
  [12,6,0]
);
assert.deepEqual(
  [O.robustness['60']['1'].negativeCells,O.robustness['60']['1'].inconclusiveCells,O.robustness['60']['1'].positiveCells],
  [0,0,18]
);

console.log('PASS: v1.6 fixed sensitivity grid, harm threshold, shared events, decomposition and robustness labels');
