const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
globalThis.window=globalThis;
for(const f of ['simulation.js','ablation-core.js','real-routing-core.js','spatial-hazard-core.js'])vm.runInThisContext(fs.readFileSync('web/'+f,'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const C=read('web/data/current.json'),R=read('web/data/routing-v1.0.json'),H=read('web/data/spatial-hazard-v1.3.json');
const S=EcoDispatchSpatialHazard,state=S.setup(C,R,H),result=read('web/data/spatial-benchmark-v1.3.json');
assert.equal(sha('web/data/routing-v1.0.json'),H.routing.sha256);
assert.equal(sha('web/data/spatial-hazard-v1.3.json'),result.dataset.hazard_sha256);
assert.equal(result.confirmatory,false);assert.equal(result.n,1000);
assert.equal(result.seed,'ecodispatch-spatial-hazard-13-exploratory-20261008');
assert.deepEqual(S.LAMBDAS,[0,.2,.35,.5,1]);
for(const mutation of [h=>h.dataset='other',h=>h.nodes.pop(),h=>h.nodes[0].hazard_weight=-1,h=>h.nodes[0].source_value=255,h=>h.nodes[0].longitude+=1]){
 const bad=structuredClone(H);mutation(bad);assert.throws(()=>S.setup(C,R,bad));
}
const events=S.generateDay(state.demand,120,EcoDispatchEngine.mulberry32(987));
assert.deepEqual(events,S.generateDay(state.demand.map(n=>({...n,hazard_weight:6})),120,EcoDispatchEngine.mulberry32(987)),'Hazard must not set incident probability');
const positions=state.resources.map(r=>r.nodeId),ones=state.demand.map(n=>({...n,hazard_weight:1}));
const exposure=S.exposure(ones,state.resources,positions,R,state.idx);
const brigade=state.resources.find(r=>r.capabilities.includes('fire'));
const expected=ones.reduce((s,n)=>s+.4*S.movement(brigade,brigade.nodeId,n.nodeId,R,state.idx).eta,0);
assert.ok(Math.abs(S.exposure(ones.map(n=>({...n,hazard_weight:2})),state.resources,positions,R,state.idx)-exposure-expected)<1e-8,'Only fire term changes');
const first=S.scenario(C,R,state,result.seed,0);
assert.deepEqual(first,S.scenario(C,R,state,result.seed,0));
assert.deepEqual(first,EcoDispatchRealRouting.scenario(C,R,EcoDispatchRealRouting.setup(C,R),result.seed,0));
const archived=read('results/spatial-hazard-v1.3-rows.json');assert.deepEqual(first,archived.rows[0]);
for(const row of archived.rows){
 for(const p of [...row.policies,row.etaGreedy,row.distanceGreedy])for(const k of S.METRICS)assert.ok(p[k]===null||Number.isFinite(p[k])&&p[k]>=0,k);
}
for(const row of archived.fireRows){
 for(const p of [...row.policies,row.etaGreedy,row.distanceGreedy])for(const k of S.METRICS)assert.equal(p[k],row.policies[0][k]);
}
assert.equal(result.diagnostics.sameOutcomesAsSyntheticControl,true);
assert.notEqual(result.diagnostics.spatialExposure,result.diagnostics.syntheticExposure);
console.log('PASS: v1.3 identity, non-negativity, fire-only integration, no probability conversion, fresh seeds and deterministic outcomes');
