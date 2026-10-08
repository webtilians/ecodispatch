const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
globalThis.window=globalThis;
for(const file of ['simulation.js','ablation-core.js','real-routing-core.js','real-routing-holdout-core.js']){
  vm.runInThisContext(fs.readFileSync('web/'+file,'utf8'));
}

const E=globalThis.EcoDispatchEngine;
const R=globalThis.EcoDispatchRealRouting;
const H=globalThis.EcoDispatchRealRoutingHoldout;
const config=JSON.parse(fs.readFileSync('web/data/current.json','utf8'));
const routing=JSON.parse(fs.readFileSync('web/data/routing-v1.0.json','utf8'));

assert.equal(H.protocol.preregCommit,'691a85c96afa497fc8c2f42386d1d12c00a4ff5a');
assert.equal(H.protocol.seed,'ecodispatch-real-routing-holdout-11');
assert.equal(H.protocol.n,1000);
assert.equal(H.protocol.harmK,10);
assert.deepEqual([...H.protocol.primaryLambdas],[.2,.35,.5,1]);
assert.equal(H.protocol.routingDataset,'malaga-real-routing-v1');
assert.equal(H.protocol.routingBlobSha,'4fbfaf903988f896fd3c6e49099141a6dd810c75');
assert.deepEqual([...H.protocol.placementBases],['B2','B3','B4']);
assert.deepEqual([...H.protocol.excludedDemand],['D5','D8']);

const prereg=fs.readFileSync('docs/real-routing-holdout-v1.1-preregistered.md','utf8');
for(const literal of [
  'ecodispatch-real-routing-holdout-11|day|index',
  '1000','K=10','0.2, 0.35, 0.5, 1','Holm','B2,B3,B4','malaga-real-routing-v1'
]) assert.ok(prereg.includes(literal),literal);

const setup=H.validateDomain(config,routing);
assert.deepEqual(setup.demand.map(x=>x.nodeId),[...H.protocol.eligibleDemand]);
assert.deepEqual(setup.excluded.map(x=>x.id),[...H.protocol.excludedDemand]);
assert.deepEqual(setup.placement.bases,[...H.protocol.placementBases]);

const holm=H.holm([
  {id:'a',rawP:.001},{id:'b',rawP:.01},{id:'c',rawP:.03},{id:'d',rawP:.2}
]);
const hp=Object.fromEntries(holm.map(x=>[x.id,x.holmP]));
assert.ok(Math.abs(hp.a-.004)<1e-12);
assert.ok(Math.abs(hp.b-.03)<1e-12);
assert.ok(Math.abs(hp.c-.06)<1e-12);
assert.ok(Math.abs(hp.d-.2)<1e-12);

const tiny=H.twoSidedNormalP(-101.46846905813187,470.1961630488496,1000);
assert.ok(tiny>0&&tiny<1e-8);

const metric=(harm,served=100)=>({
  served,meanEta:40,p95Eta:90,distance:1700,co2Kg:300,severityDelay:15000,totalHarm:harm
});
const rows=Array.from({length:30},(_,i)=>({
  index:i,scenarioSeed:'ci-real-routing-holdout-unit|day|'+i,
  policies:R.LAMBDAS.map(lambda=>({
    lambda,...metric(H.protocol.primaryLambdas.includes(lambda)?90:100,lambda===0?100:101)
  })),
  etaGreedy:metric(101,99),
  distanceGreedy:metric(102,102)
}));

const analysis=H.analyze(rows,'ci-real-routing-holdout-unit');
assert.equal(analysis.confirmed,true);
assert.equal(analysis.primary.length,4);
assert.equal(analysis.baselines.length,2);
for(const p of analysis.primary){
  assert.equal(p.harm.mean,-10);
  assert.equal(p.harm.bootstrap.ciHigh,-10);
  assert.equal(p.holmP,0);
  assert.equal(p.pass,true);
}

const result=H.finish(config,routing,rows,'ci-real-routing-holdout-unit');
assert.equal(result.version,'1.1');
assert.equal(result.benchmark,'real-routing-holdout-confirmatory');
assert.equal(result.protocol.seed,'ci-real-routing-holdout-unit');
assert.equal(result.dataset.id,'malaga-real-routing-v1');
assert.deepEqual(result.dataset.placement.bases,['B2','B3','B4']);
assert.equal(result.preregistration.frozenBeforeResults,true);
assert.ok(H.csv(result).includes('"primary"'));
assert.ok(H.csv(result).includes('"baseline"'));

// The generator itself is exercised only with a CI seed.
const ciSeed='ci-real-routing-holdout-scenario';
const row=R.scenario(config,routing,setup,ciSeed,0,{harmK:10});
assert.equal(row.scenarioSeed,ciSeed+'|day|0');
assert.ok(!row.scenarioSeed.includes(H.protocol.seed));

// v1.1.1 freezes the actual user-exported result without rerunning it.
const frozen=JSON.parse(fs.readFileSync('web/data/real-routing-holdout-v1.1.1-frozen.json','utf8'));
assert.equal(frozen.sourceArtifact.sha256,'1b63e5a5c5cd14752a6e79871f7be971c642b09e7d45b88c3953f93428454112');
assert.equal(frozen.sourceArtifact.bytes,2558536);
assert.equal(frozen.analysis.confirmed,true);
assert.deepEqual(frozen.analysis.passingLambdas,[.2,.35,.5,1]);
assert.equal(frozen.analysis.primary[0].harm.mean,-29.841341685721012);
assert.equal(frozen.analysis.primary[3].harm.mean,-83.45652611740732);
assert.equal(frozen.analysis.primary[3].holmP,3.254300186856912e-8);

const cfg=config.research.real_routing_holdout;
assert.equal(cfg.status,'confirmed_frozen');
assert.equal(cfg.seed,H.protocol.seed);
assert.equal(cfg.routing_blob_sha,H.protocol.routingBlobSha);
assert.deepEqual(cfg.primary_lambdas,[.2,.35,.5,1]);

console.log('PASS: v1.1.1 frozen real-routing result, protocol, dataset identity, Holm, confirmation rule, baselines and CI seed isolation');
