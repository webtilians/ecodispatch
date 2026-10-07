const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ctx=globalThis;ctx.window=ctx;
for(const file of ['simulation.js','ablation-core.js'])vm.runInThisContext(fs.readFileSync('web/'+file,'utf8'));
const E=ctx.EcoDispatchEngine,A=ctx.EcoDispatchAblation;
const data=JSON.parse(fs.readFileSync('web/data/current.json','utf8')),setup=E.setup(data),seed='ecodispatch-mc-06';
const clean=x=>JSON.parse(JSON.stringify(x));

const before=JSON.stringify(setup),r=A.scenario(data,setup,seed,0,{harmK:10});
assert.deepEqual(clean(r),clean(A.scenario(data,setup,seed,0,{harmK:10})));
assert.equal(JSON.stringify(setup),before,'No cross-policy resource mutation');
assert.notDeepEqual(clean(r),clean(A.scenario(data,setup,seed,1,{harmK:10})));
assert.ok(r.etaGreedy&&r.distanceGreedy,'Both greedy baselines are present');
assert.ok(A.metrics.includes('totalHarm'),'v0.8 total harm metric is present');

// Historical v0.6 regression for metrics that existed in v0.6.
const oldSource=cp.execFileSync('git',['show','f6ded9d45e0919a2095984f8e52ba91ba00cfb7a:web/simulation.js'],{encoding:'utf8'});
const old={};old.window=old;vm.createContext(old);
vm.runInContext(oldSource.replace('window.EcoDispatchResearch=', 'window.oracle={simulateDay,generateDay,hashString,mulberry32};window.EcoDispatchResearch='),old);
const legacyMetrics=['served','meanEta','p95Eta','distance','severityDelay'];
for(let i=0;i<5;i++){
  const row=A.scenario(data,setup,seed,i,{harmK:10}),O=old.oracle;
  const events=O.generateDay(data,setup.demand,120,O.mulberry32(O.hashString(row.scenarioSeed)));
  for(const [policy,lambda,actual] of [['eco',.35,row.policies.find(p=>p.lambda===.35)],['greedy',0,row.distanceGreedy]]){
    const expected=O.simulateDay(setup.demand,setup.resources,events,policy,lambda);
    for(const k of legacyMetrics)assert.equal(actual[k],expected[k],k+' v0.6 regression');
  }
}

// ETA-greedy must differ from distance-greedy when speed and distance disagree.
const resources=[
  {name:'slow-near',point:[0,.019],capabilities:['medical'],speed_kmh:1,co2_g_per_km:100},
  {name:'fast-far',point:[0,.01],capabilities:['medical'],speed_kmh:100,co2_g_per_km:100}
];
const event={name:'case',point:[0,.02],type:'medical',severity:3,deadline_min:60};
const dg=E.simulateDay([],resources,[event],'greedy',0,{harmK:10});
const eg=E.simulateDay([],resources,[event],'eta-greedy',0,{harmK:10});
assert.ok(dg.distance<eg.distance,'distance-greedy chooses shorter path');
assert.ok(eg.meanEta<dg.meanEta,'ETA-greedy chooses faster response');

// Total harm explicitly penalizes unserved incidents.
const missed=E.simulateDay([],[{point:[0,0],capabilities:[],speed_kmh:60}],[{...event,severity:5}],'greedy',0,{harmK:10});
assert.equal(missed.served,0);
assert.equal(missed.totalHarm,250);

// Paired normal and bootstrap CIs use paired daily differences.
const baseMetric=v=>({served:v,meanEta:2,p95Eta:3,distance:4,severityDelay:5,totalHarm:6});
const fixture=[10,20,30].map((v,i)=>{
  const zero=baseMetric(v);
  return {
    greedy:baseMetric(v),distanceGreedy:baseMetric(v),etaGreedy:baseMetric(v),
    policies:A.lambdas.map(lambda=>({lambda,...baseMetric(v+(lambda===.1?i+1:0))}))
  };
});
const summary=A.summarize(fixture,'fixture',100);
const s=summary.find(p=>p.lambda===.1).differences.zero.served;
assert.equal(s.mean,2);assert.equal(s.sd,1);
assert.ok(Math.abs(s.ciLow-(2-1.96/Math.sqrt(3)))<1e-12);
assert.ok(Number.isFinite(s.bootstrap.ciLow)&&Number.isFinite(s.bootstrap.ciHigh));
assert.deepEqual(
  A.summarize(fixture,'fixture',100).map(p=>p.paretoProbability),
  summary.map(p=>p.paretoProbability),
  'bootstrap Pareto is deterministic'
);
for(const p of summary)assert.ok(p.paretoProbability>=0&&p.paretoProbability<=1);

// Descriptive Pareto semantics remain unchanged.
assert.equal(A.dominates({served:10,meanEta:2,distance:4},{served:9,meanEta:3,distance:5}),true);
assert.equal(A.dominates({served:10,meanEta:4,distance:4},{served:9,meanEta:3,distance:5}),false);
assert.equal(A.dominates({served:10,meanEta:2,distance:4},{served:10,meanEta:2,distance:4}),false);

const emptySetup={...setup,resources:setup.resources.map(r=>({...r,capabilities:[]}))};
const empty=A.scenario(data,emptySetup,seed,0,{harmK:10});
assert.equal(empty.distanceGreedy.meanEta,null);
assert.equal(A.summarize([empty],seed,20)[0].differences.zero.meanEta.n,0);

const n=Number(process.env.ABLATION_N||100),rows=[];
console.time('paired sweep');
for(let i=0;i<n;i++)rows.push(A.scenario(data,setup,seed,i,{harmK:10}));
console.timeEnd('paired sweep');
const result=A.finish(data,seed,rows,{harmK:10,bootstrapB:100});
assert.equal(result.version,'0.8');
assert.equal(result.rows.length,n);
assert.equal(result.summary.length,9);
assert.equal(result.harmK,10);
for(const p of result.summary)for(const k of A.metrics){
  assert.equal(p.absolute[k].n,n);
  assert.ok(Number.isFinite(p.absolute[k].mean));
}
const csv=A.csv(result);
assert.ok(csv.includes('"eta-greedy"'));
assert.ok(csv.includes('"distance-greedy"'));
assert.ok(csv.split('\r\n')[0].includes('bootstrapCiLow'));
assert.ok(csv.split('\r\n')[0].includes('paretoProbability'));

fs.mkdirSync('work',{recursive:true});
fs.writeFileSync('work/ablation-'+n+'.json',JSON.stringify(result));
fs.writeFileSync('work/ablation-'+n+'.csv',csv);

// Validate literal HTML IDs, ES/EN translations and JS syntax.
const html=fs.readFileSync('web/index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size);
const scripts=fs.readdirSync('web').filter(p=>p.endsWith('.js')).map(p=>fs.readFileSync('web/'+p,'utf8')).join('\n');
for(const m of scripts.matchAll(/(?:getElementById\(|\$\()['"]([^'"]+)['"]\)/g))assert.ok(ids.includes(m[1]),'Missing ID '+m[1]);
const i18n=fs.readFileSync('web/i18n.js','utf8');
const translations=vm.runInNewContext(i18n.slice(i18n.indexOf('const D=')+8,i18n.indexOf('  const requested')).replace(/;\s*$/,'').replace(/^/, '(')+')');
assert.deepEqual(Object.keys(translations.es).sort(),Object.keys(translations.en).sort());
const keys=[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g),...scripts.matchAll(/I18N.t\(['"]([^'"]+)['"]/g)].map(m=>m[1]);
for(const m of fs.readFileSync('web/ablation.js','utf8').matchAll(/\bt\('([^']+)'\)/g))keys.push('ab.'+m[1]);
for(const key of keys.filter(k=>!k.endsWith('.')))for(const lang of ['es','en'])assert.ok(translations[lang][key],'Missing '+lang+' '+key);
for(const file of fs.readdirSync('web').filter(p=>p.endsWith('.js')))cp.execFileSync(process.execPath,['--check','web/'+file]);

console.table(result.summary.map(p=>({
  policy:p.id,
  coverage:p.absolute.served.mean,
  eta:p.absolute.meanEta.mean,
  harm:p.absolute.totalHarm.mean,
  pPareto:p.paretoProbability
})));
console.log('PASS: v0.8 baselines, harm, paired normal/bootstrap CI, Pareto probability, determinism, regression, exports, syntax, IDs and ES/EN');