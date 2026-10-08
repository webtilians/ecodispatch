const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','fire-dispatch-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),digest=x=>crypto.createHash('sha256').update(x).digest('hex'),sha=p=>digest(fs.readFileSync(p));
const H=read('web/data/fire-snapshots-v1.4.json'),R=read('web/data/routing-v1.0.json'),P=read('data/fire-dispatch-v1.4/protocol.json'),B=read('web/data/fire-benchmark-v1.4.json'),raw=read('results/fire-dispatch-v1.4-rows.json');
const F=EcoDispatchFireDispatch;
assert.equal(B.confirmatory,false);assert.equal(B.dataset.catalog_sha256,sha('web/data/fire-snapshots-v1.4.json'));
assert.equal(B.dataset.protocol_sha256,sha('data/fire-dispatch-v1.4/protocol.json'));
assert.equal(B.dataset.routing_sha256,sha('web/data/routing-v1.0.json'));
assert.equal(B.dataset.rows_sha256,sha('results/fire-dispatch-v1.4-rows.json'));
assert.deepEqual(P.lambdas,[0,.2,.35,.5,1]);
assert.deepEqual(B.snapshots.map(s=>s.id),H.selection.selected_ids);
const compact=p=>{const {dispatch,...metrics}=p;return {...metrics,dispatch_sha256:digest(JSON.stringify(dispatch))};};
let changed=false,hazardChanged=false;
for(const s of B.snapshots){
  const state=F.setup(P,R,H,s.id),first=F.scenario(state,0),archived=raw.snapshots.find(x=>x.snapshot===s.id).rows;
  assert.equal(state.resources.length,3);assert.ok(state.resources.every(r=>r.capabilities.length===1&&r.capabilities[0]==='fire'));
  assert.deepEqual(first,F.scenario(state,0));
  assert.ok(first.events.every(e=>e.type==='fire'&&state.demand.some(n=>n.id===e.nodeId)));
  assert.deepEqual(first.policies.map(compact),archived[0].policies);
  assert.deepEqual(compact(first.etaGreedy),archived[0].etaGreedy);assert.deepEqual(compact(first.distanceGreedy),archived[0].distanceGreedy);
  assert.equal(digest(JSON.stringify(first.events)),archived[0].events_sha256);
  assert.equal(archived.length,P.days);
  const modified={...state,demand:state.demand.map(n=>({...n,source_value:6,hazard_weight:6}))};
  assert.deepEqual(F.eventsFor(modified,first.scenarioSeed),first.events,'No hazard-derived event probabilities');
  const zero=F.simulate(state,first.events,'eco',0),zeroUniform=F.simulate(state,first.events,'eco',0,state.demand.map(()=>1));
  assert.deepEqual(zero,zeroUniform,'lambda zero cancels all hazard effects');
  const positions=state.resources.map(r=>r.nodeId),weights=state.demand.map(()=>1);
  const manual=state.demand.reduce((total,n)=>total+Math.min(...positions.map(pos=>R.durations_s[state.idx[pos]][state.idx[n.id]]/60)),0);
  assert.ok(Math.abs(F.exposure(state,positions,weights)-manual)<1e-8);
  assert.ok(Math.abs(F.exposure(state,positions,weights.map(()=>2))-2*manual)<1e-8);
  const witness=s.diagnostics.firstDivergence;
  if(witness){
    const replay=F.scenario(state,witness.day),alternative=replay.policies.find(p=>String(p.lambda)===witness.policy)||({ 'eta-greedy':replay.etaGreedy,'distance-greedy':replay.distanceGreedy})[witness.policy];
    assert.equal(replay.policies[0].dispatch[witness.eventIndex],witness.zero);
    assert.equal(alternative.dispatch[witness.eventIndex],witness.alternative);
    assert.notEqual(witness.zero,witness.alternative);changed=true;
  }
  hazardChanged ||= s.diagnostics.unitWeightControl.daysWithDifferentDispatch>0;
  for(const row of archived){
    for(const p of [...row.policies,row.etaGreedy,row.distanceGreedy,row.unitWeightControl]){
      for(const k of ['served','coverage','distance','co2Kg','totalHarm','severityDelay','cost','meanEta','p95Eta'])assert.ok(p[k]===null||Number.isFinite(p[k])&&p[k]>=0,k);
      assert.ok(p.coverage<=1);assert.equal(p.coverage,p.served/P.incidents_per_day);
      assert.ok(Math.abs(p.co2Kg-p.distance*.23)<1e-8);
    }
  }
  const summary=EcoDispatchRealRouting.summarize(archived,P.seed+'|'+s.id,P.bootstrap_replicates);
  assert.deepEqual(summary,s.summary,'All paired intervals reproduce from archived rows');
}
assert.ok(changed,'At least one actual selected snapshot changes fire dispatch');
assert.ok(hazardChanged,'Actual ordinal hazard affects dispatch compared with uniform classes');
const id=H.selection.selected_ids[0],state=F.setup(P,R,H,id);
for(const mutate of [h=>h.dataset='wrong',h=>h.routing.dataset='wrong',h=>h.candidates.find(s=>s.id===id).nodes.pop(),h=>h.candidates.find(s=>s.id===id).nodes[0].source_value=255,h=>h.candidates.find(s=>s.id===id).nodes[0].hazard_weight=-1,h=>h.candidates.find(s=>s.id===id).nodes[0].longitude+=1]){
  const bad=structuredClone(H);mutate(bad);assert.throws(()=>F.setup(P,R,bad,id));
}
assert.throws(()=>F.setup({...P,fleet:P.fleet.slice(0,1)},R,H,id));
assert.throws(()=>F.setup(P,R,H,'nonselected'));
// Unserved and no-event paths: no negative harm, no fake zero ETA.
const blocked={type:'fire',nodeId:'D0',severity:3,deadline_min:0};
const no=F.simulate(state,[blocked],'eco',0);assert.equal(no.served,0);assert.equal(no.totalHarm,90);assert.equal(no.meanEta,null);assert.equal(no.p95Eta,null);
assert.equal(F.simulate(state,[],'eco',0).coverage,null);
// A stationary selected brigade has zero road distance/ETA and deterministic choice.
const atNode={...state,resources:state.resources.map((r,i)=>({...r,nodeId:i===0?'D0':r.nodeId}))};
const served=F.simulate(atNode,[blocked],'eta-greedy');assert.equal(served.served,1);assert.equal(served.distance,0);assert.equal(served.dispatch[0],'F-01');
console.log('PASS: v1.4 multiple brigades, paired seeds, snapshot identities, actual dispatch/hazard divergence, all metrics and intervals');
