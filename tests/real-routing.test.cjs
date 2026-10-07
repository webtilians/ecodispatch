const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
globalThis.window=globalThis;
for(const file of ['simulation.js','ablation-core.js','real-routing-core.js'])vm.runInThisContext(fs.readFileSync('web/'+file,'utf8'));

const E=globalThis.EcoDispatchEngine,R=globalThis.EcoDispatchRealRouting;
const config=JSON.parse(fs.readFileSync('web/data/current.json','utf8'));
const routing=JSON.parse(fs.readFileSync('web/data/routing-v1.0.json','utf8'));

assert.equal(routing.version,'1.0');
assert.equal(routing.dataset,'malaga-real-routing-v1');
assert.equal(routing.points.length,20);
assert.equal(routing.durations_s.length,20);
assert.equal(routing.distances_m.length,20);

let asymmetric=false;
for(let i=0;i<20;i++){
  assert.equal(routing.durations_s[i].length,20);
  assert.equal(routing.distances_m[i].length,20);
  assert.equal(routing.durations_s[i][i],0);
  assert.equal(routing.distances_m[i][i],0);
  for(let j=0;j<20;j++){
    assert.ok(Number.isFinite(routing.durations_s[i][j])&&routing.durations_s[i][j]>=0);
    assert.ok(Number.isFinite(routing.distances_m[i][j])&&routing.distances_m[i][j]>=0);
    if(Math.abs(routing.durations_s[i][j]-routing.durations_s[j][i])>1e-6)asymmetric=true;
  }
}
assert.equal(asymmetric,true,'Road matrix should retain directed/asymmetric routing');

const setup=R.setup(config,routing);
assert.deepEqual(setup.demand.map(x=>x.nodeId),['D0','D1','D2','D3','D4','D6','D7','D9','D10','D11']);
assert.deepEqual(setup.excluded.map(x=>x.id),['D5','D8']);
assert.deepEqual(setup.placement.bases,['B2','B3','B4']);
assert.ok(Math.abs(setup.placement.objective-1028.9025)<1e-6);

// Ground movement must be read directly from OSRM matrix.
const idx=setup.idx;
const brigade=setup.resources.find(x=>x.kind==='brigade');
const road=R.movement(brigade,'B2','D2',routing,idx);
assert.equal(road.mode,'road');
assert.equal(road.eta,routing.durations_s[idx.B2][idx.D2]/60);
assert.equal(road.distance,routing.distances_m[idx.B2][idx.D2]/1000);

// Drone must not be forced onto roads.
const drone=setup.resources.find(x=>x.kind==='drone');
const air=R.movement(drone,drone.nodeId,'D2',routing,idx);
assert.equal(air.mode,'air');
assert.ok(air.distance>0&&air.eta>0);

// v1.0 strict capability roles are explicit and deterministic.
assert.deepEqual(setup.resources.find(x=>x.kind==='brigade').capabilities,['fire']);
assert.deepEqual(setup.resources.find(x=>x.kind==='ambulance').capabilities,['medical']);
assert.deepEqual(setup.resources.find(x=>x.kind==='drone').capabilities,['drone']);
assert.deepEqual(setup.resources.find(x=>x.kind==='utility').capabilities,['medical','drone']);

const seed='ci-real-routing';
const a=R.scenario(config,routing,setup,seed,0,{harmK:10});
const b=R.scenario(config,routing,setup,seed,0,{harmK:10});
assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
assert.equal(a.scenarioSeed,'ci-real-routing|day|0');

const rows=Array.from({length:20},(_,i)=>R.scenario(config,routing,setup,seed,i,{harmK:10}));
const result=R.finish(config,routing,setup,seed,rows,{harmK:10,bootstrapB:50});
assert.equal(result.version,'1.0');
assert.equal(result.benchmark,'real-routing-exploratory');
assert.equal(result.rows.length,20);
assert.equal(result.summary.length,7);
assert.deepEqual(result.dataset.placement.bases,['B2','B3','B4']);
for(const p of result.summary){
  for(const k of R.METRICS){
    assert.ok(Number.isFinite(p.absolute[k].mean),p.id+' '+k);
    assert.ok(Number.isFinite(p.versusZero[k].mean),p.id+' delta '+k);
  }
}
const zero=result.summary.find(x=>x.id==='0');
for(const k of R.METRICS)assert.equal(zero.versusZero[k].mean,0);

const csv=R.csv(result);
assert.ok(csv.includes('"eta-greedy"'));
assert.ok(csv.includes('"distance-greedy"'));
assert.ok(csv.includes('"co2Kg"'));

// Dataset provenance must remain visible.
assert.equal(routing.source.network_data,'OpenStreetMap');
assert.equal(routing.source.osm_license,'ODbL');
assert.ok(routing.source.osm_attribution.includes('OpenStreetMap'));

console.log('PASS: v1.0 real-routing matrix, snap gate, directed routes, placement, movement modes, determinism, summaries and exports');