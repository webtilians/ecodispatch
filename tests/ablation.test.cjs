const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ctx=globalThis;ctx.window=ctx;
for(const file of ['simulation.js','ablation-core.js'])vm.runInThisContext(fs.readFileSync('web/'+file,'utf8'));
const E=ctx.EcoDispatchEngine,A=ctx.EcoDispatchAblation;
const data=JSON.parse(fs.readFileSync('web/data/current.json','utf8')),setup=E.setup(data),seed='ecodispatch-mc-06';
const clean=x=>JSON.parse(JSON.stringify(x));
const before=JSON.stringify(setup),r=A.scenario(data,setup,seed,0);
assert.deepEqual(clean(r),clean(A.scenario(data,setup,seed,0)));
assert.equal(JSON.stringify(setup),before,'No cross-policy resource mutation');
assert.notDeepEqual(clean(r),clean(A.scenario(data,setup,seed,1)));
// Independent v0.6 oracle, extracted from its historical revision without edits.
const oldSource=cp.execFileSync('git',['show','f6ded9d45e0919a2095984f8e52ba91ba00cfb7a:web/simulation.js'],{encoding:'utf8'});
const old={};old.window=old;vm.createContext(old);
vm.runInContext(oldSource.replace('window.EcoDispatchResearch=', 'window.oracle={simulateDay,generateDay,hashString,mulberry32};window.EcoDispatchResearch='),old);
for(let i=0;i<5;i++){
  const row=A.scenario(data,setup,seed,i),O=old.oracle;
  const events=O.generateDay(data,setup.demand,120,O.mulberry32(O.hashString(row.scenarioSeed)));
  for(const [policy,lambda,actual] of [['eco',.35,row.policies.find(p=>p.lambda===.35)],['greedy',0,row.greedy]]){
    const expected=O.simulateDay(setup.demand,setup.resources,events,policy,lambda);
    for(const k of A.metrics)assert.equal(actual[k],expected[k],k+' v0.6 regression');
  }
}
// Paired CI uses variance of differences, not independent-group variance.
const fixture=[10,20,30].map((v,i)=>({greedy:{served:v},policies:A.lambdas.map(lambda=>({lambda,served:v+(lambda===0?0:i+1)}))}));
const s=A.summarize(fixture).find(p=>p.lambda===.1).differences.zero.served;
assert.equal(s.mean,2);assert.equal(s.sd,1);assert.ok(Math.abs(s.ciLow-(2-1.96/Math.sqrt(3)))<1e-12);
assert.equal(A.summarize(fixture)[0].differences.zero.served.ciLow,0);
assert.equal(A.dominates({served:10,meanEta:2,distance:4},{served:9,meanEta:3,distance:5}),true);
assert.equal(A.dominates({served:10,meanEta:4,distance:4},{served:9,meanEta:3,distance:5}),false);
assert.equal(A.dominates({served:10,meanEta:2,distance:4},{served:10,meanEta:2,distance:4}),false);
const emptySetup={...setup,resources:setup.resources.map(r=>({...r,capabilities:[]}))};
const empty=A.scenario(data,emptySetup,seed,0);assert.equal(empty.greedy.meanEta,null);
assert.equal(A.summarize([empty])[0].differences.zero.meanEta.n,0);
assert.equal(A.summarize([empty])[0].pareto,null);
const n=Number(process.env.ABLATION_N||500),rows=[];
console.time('paired sweep');for(let i=0;i<n;i++)rows.push(A.scenario(data,setup,seed,i));console.timeEnd('paired sweep');
const result=A.finish(data,seed,rows);
assert.equal(result.rows.length,n);assert.equal(result.summary.length,8);
for(const p of result.summary)for(const k of A.metrics){assert.equal(p.absolute[k].n,n);assert.ok(Number.isFinite(p.absolute[k].mean));}
const csv=A.csv(result);assert.equal(csv.split('\r\n').length,1+n*8*5+8*3*5);
assert.equal(csv.split('\r\n')[0].split(',').length,15);
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/ablation-'+n+'.json',JSON.stringify(result));fs.writeFileSync('work/ablation-'+n+'.csv',csv);
console.table(result.summary.map(p=>({lambda:p.id,coverage:p.absolute.served.mean,eta:p.absolute.meanEta.mean,distance:p.absolute.distance.mean,pareto:p.pareto})));
// Validate every literal HTML ID reference and translation in the full site.
const html=fs.readFileSync('web/index.html','utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
const scripts=fs.readdirSync('web').filter(p=>p.endsWith('.js')).map(p=>fs.readFileSync('web/'+p,'utf8')).join('\n');
for(const m of scripts.matchAll(/(?:getElementById\(|\$\()['"]([^'"]+)['"]\)/g))assert.ok(ids.includes(m[1]),'Missing ID '+m[1]);
const i18n=fs.readFileSync('web/i18n.js','utf8');
const translations=vm.runInNewContext(i18n.slice(i18n.indexOf('const D=')+8,i18n.indexOf('  const requested')).replace(/;\s*$/,'').replace(/^/, '(')+')');
assert.deepEqual(Object.keys(translations.es).sort(),Object.keys(translations.en).sort());
const keys=[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g),...scripts.matchAll(/I18N.t\(['"]([^'"]+)['"]/g)].map(m=>m[1]);
for(const m of fs.readFileSync('web/ablation.js','utf8').matchAll(/\bt\('([^']+)'\)/g))keys.push('ab.'+m[1]);
for(const key of keys.filter(k=>!k.endsWith('.')))for(const lang of ['es','en'])assert.ok(translations[lang][key],'Missing '+lang+' '+key);
for(const file of fs.readdirSync('web').filter(p=>p.endsWith('.js')))cp.execFileSync(process.execPath,['--check','web/'+file]);
console.log('PASS: paired CI, Pareto, determinism, v0.6 regression, missing metrics, exports, syntax, IDs and ES/EN');
