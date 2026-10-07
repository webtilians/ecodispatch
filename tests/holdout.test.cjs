const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
globalThis.window=globalThis;
for(const file of ['simulation.js','ablation-core.js','holdout-core.js'])vm.runInThisContext(fs.readFileSync('web/'+file,'utf8'));
const E=globalThis.EcoDispatchEngine,A=globalThis.EcoDispatchAblation,H=globalThis.EcoDispatchHoldout;
const data=JSON.parse(fs.readFileSync('web/data/current.json','utf8'));

// Frozen preregistration constants.
assert.equal(H.protocol.seed,'ecodispatch-holdout-09');
assert.equal(H.protocol.n,1000);
assert.equal(H.protocol.harmK,10);
assert.deepEqual([...H.protocol.primaryLambdas],[.2,.35,.5,1]);
assert.equal(H.protocol.preregCommit,'017cda8cf011a89794d987ad65658249df60b2f9');
const prereg=fs.readFileSync('docs/holdout-v0.9-preregistered.md','utf8');
for(const literal of ['ecodispatch-holdout-09','1000','0.2, 0.35, 0.5, 1','K = 10','Holm'])assert.ok(prereg.includes(literal),literal);

// Stable far-tail p-values must remain finite and non-zero.
const tiny=H.twoSidedNormalP(-82.64920494554723,310.1901866949698,1000);
assert.ok(tiny>0&&tiny<1e-16);
assert.ok(Math.abs(tiny-3.5832461760302455e-17)/3.5832461760302455e-17<1e-5);

// Holm step-down monotonic adjusted p-values.
const holm=H.holm([
  {id:'a',rawP:.001},{id:'b',rawP:.01},{id:'c',rawP:.03},{id:'d',rawP:.2}
]);
const hp=Object.fromEntries(holm.map(x=>[x.id,x.holmP]));
assert.ok(Math.abs(hp.a-.004)<1e-12);
assert.ok(Math.abs(hp.b-.03)<1e-12);
assert.ok(Math.abs(hp.c-.06)<1e-12);
assert.ok(Math.abs(hp.d-.2)<1e-12);

// Synthetic confirmatory fixture: every primary lambda is better than zero by a fixed amount.
const metric=(harm,served=100)=>({served,meanEta:4,p95Eta:8,distance:500,severityDelay:1500,totalHarm:harm});
const rows=Array.from({length:30},(_,i)=>({
  index:i,scenarioSeed:'ci-holdout-unit|normal|day|'+i,harmK:10,
  greedy:metric(100),distanceGreedy:metric(100),etaGreedy:metric(100),
  policies:A.lambdas.map(lambda=>({lambda,...metric(H.protocol.primaryLambdas.includes(lambda)?90:100,lambda===0?100:101)}))
}));
const analysis=H.analyze(rows,'ci-holdout-unit');
assert.equal(analysis.confirmed,true);
assert.equal(analysis.primary.length,4);
for(const p of analysis.primary){
  assert.equal(p.harm.mean,-10);
  assert.equal(p.harm.bootstrap.ciHigh,-10);
  assert.equal(p.holmP,0);
  assert.equal(p.pass,true);
}
const result=H.finish(data,rows,'ci-holdout-unit');
assert.equal(result.version,'0.9.1');
assert.equal(result.protocol.seed,'ci-holdout-unit');
assert.equal(result.preregistration.frozenBeforeResults,true);
assert.ok(H.csv(result).includes('"primary"'));

// Technical scenarios use a CI seed, never the real holdout family.
const setup=E.setup(data);
const row=A.scenario(data,setup,'ci-holdout-unit',0,{harmK:10});
assert.equal(row.scenarioSeed,'ci-holdout-unit|normal|day|0');
assert.ok(!row.scenarioSeed.includes(H.protocol.seed));

// K sensitivity changes only the outcome calculation.
const v={severityDelay:100,totalHarm:200};
assert.equal(H.harmAtK(v,5),150);
assert.equal(H.harmAtK(v,20),300);

// Frozen official result matches the user-exported canonical summary.
const frozen=JSON.parse(fs.readFileSync('web/data/holdout-v0.9.1-frozen.json','utf8'));
assert.equal(frozen.sourceArtifact.sha256,'38b912b0941e4ab8edb9c9da9c7e12d4da4d4c0f3f8b4d82fe911573b3132985');
assert.equal(frozen.sourceArtifact.bytes,2868071);
assert.equal(frozen.analysis.confirmed,true);
assert.deepEqual(frozen.analysis.passingLambdas,[.2,.35,.5,1]);
assert.ok(frozen.analysis.primary.every(x=>x.rawP>0&&x.holmP>0&&x.pass));

// Dynamic holdout translations exist in both languages.
const i18n=fs.readFileSync('web/i18n.js','utf8');
const translations=vm.runInNewContext(i18n.slice(i18n.indexOf('const D=')+8,i18n.indexOf('  const requested')).replace(/;\s*$/,'').replace(/^/, '(')+')');
const dynamic=['ho.ready','ho.frozenLoaded','ho.complete','ho.error','ho.confirmed','ho.failed','ho.confirmedCopy','ho.failedCopy','ho.pass','ho.fail'];
for(const key of dynamic)for(const lang of ['es','en'])assert.ok(translations[lang][key],lang+' '+key);

console.log('PASS: v0.9.1 stable p-values, frozen result, preregistration, Holm correction, confirmation rule, sensitivity, isolated CI seed and translations');