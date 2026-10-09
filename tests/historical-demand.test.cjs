const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
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
const X=EcoDispatchHistoricalDemand;

assert.equal(hash('data/historical-demand-v1.7.1/routing.json'),RF.routing_sha256);
assert.equal(HR.audit.route_counts.base_to_event,4392);
assert.equal(HR.audit.route_counts.event_to_potential,14640);
assert.equal(HR.audit.route_counts.event_to_event_same_day,682);
assert.equal(HR.inputs.primary_events,1464);
assert.equal(HR.inputs.potential_nodes.length,10);

const state=X.setup(P,V15,R,HR,HAZ,P.frozen_inputs.hazard_snapshot_ids[0],REAL,F);
assert.equal(state.observed.events.length,1464);
assert.equal(state.observed.days.length,6574);
assert.equal(state.observed.days.filter(d=>d.events.length).length,1194);
assert.equal(state.observed.days.filter(d=>d.events.length>1).length,210);
assert.equal(Math.max(...state.observed.days.map(d=>d.events.length)),5);
assert.deepEqual(state.observed.exclusions,F.exclusions);

const first=state.observed.events[0];
assert.equal(first.severity,X.severityFor(first.incidentId,P.severity.seed));
assert(first.severity>=2&&first.severity<5);
for(const base of ['B2','B3','B4']){
  const m=X.movementToEvent(state,base,first.incidentId);
  assert(m.eta>=0&&m.distance>=0);
}
for(const node of state.potential){
  const m=X.movementToPotential(state,first.incidentId,node.nodeId);
  assert(m.eta>=0&&m.distance>=0);
}

const zero=state.observed.days.find(d=>d.events.length===0);
const z=X.simulate(state,zero.events,'eco',.2,90);
assert.equal(z.eventCount,0);assert.equal(z.served,0);assert.equal(z.unserved,0);
assert.equal(z.coverage,1);assert.equal(z.free3Share,1);assert.equal(z.utilizationMean,0);
assert.deepEqual(z.dispatch,[]);

const multi=state.observed.days.find(d=>d.events.length>=2);
assert(multi);
for(const service of P.service_minutes){
  const one=X.scenario(state,multi.events,service);
  const two=X.scenario(state,multi.events,service);
  assert.deepEqual(one,two);
  for(const def of X.POLICY_DEFS){
    const sim=one[def.id];
    assert.equal(sim.served+sim.unserved,multi.events.length);
    assert.equal(sim.dispatch.length,multi.events.length);
    assert(sim.coverage>=0&&sim.coverage<=1);
    assert(sim.distance>=0&&sim.co2Kg>=0);
    assert(sim.servedSeverityDelay>=0&&sim.unservedSeveritySq>=0);
  }
}

const state2=X.setup(P,V15,R,HR,HAZ,P.frozen_inputs.hazard_snapshot_ids[1],REAL,F);
assert.deepEqual(state.observed.days,state2.observed.days);
assert.equal(state.resources.length,3);
assert.deepEqual(state.resources.map(x=>x.station),['B2','B3','B4']);
console.log('historical demand v1.7.1 core invariants passed');
