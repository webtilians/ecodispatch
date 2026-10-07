/* Pure paired experiment. No stress search, selection, or policy-dependent RNG. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const lambdas=Object.freeze([0,.1,.2,.35,.5,1,2]);
  const metrics=Object.freeze(['served','meanEta','p95Eta','distance','severityDelay']);
  function scenario(data,setup,seed,index){
    const scenarioSeed=seed+'|normal|day|'+index;
    const events=E.generateDay(data,setup.demand,data.research?.day_incidents||120,E.mulberry32(E.hashString(scenarioSeed)));
    const run=(policy,lambda)=>{
      const result=E.simulateDay(setup.demand,setup.resources,events,policy,lambda);
      // ETA is undefined when no incident is served; never imply zero delay.
      if(!result.served){result.meanEta=null;result.p95Eta=null;}
      return Object.fromEntries(metrics.map(k=>[k,result[k]]));
    };
    return {index,scenarioSeed,greedy:run('greedy',0),policies:lambdas.map(lambda=>({lambda,...run('eco',lambda)}))};
  }
  function stats(values){
    const valid=values.filter(Number.isFinite);
    return valid.length?{...E.describe(valid),missing:values.length-valid.length}: {n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
  }
  function dominates(a,b){
    const keys=['served','meanEta','distance'];
    if(!keys.every(k=>Number.isFinite(a[k])&&Number.isFinite(b[k])))return false;
    const x=[-a.served,a.meanEta,a.distance],y=[-b.served,b.meanEta,b.distance];
    return x.every((v,i)=>v<=y[i])&&x.some((v,i)=>v<y[i]);
  }
  function summarize(rows){
    const policies=[...lambdas.map(lambda=>({id:String(lambda),lambda})),{id:'greedy',lambda:null}];
    const result=policies.map(p=>{
      const values=rows.map(r=>p.id==='greedy'?r.greedy:r.policies.find(x=>x.lambda===p.lambda));
      const absolute=Object.fromEntries(metrics.map(k=>[k,stats(values.map(v=>v[k]))]));
      const differences=Object.fromEntries(['zero','greedy'].map(ref=>[ref,Object.fromEntries(metrics.map(k=>[k,stats(values.map((v,i)=>{
        const b=ref==='zero'?rows[i].policies.find(x=>x.lambda===0):rows[i].greedy;
        return Number.isFinite(v[k])&&Number.isFinite(b[k])?v[k]-b[k]:null;
      }))]))]));
      return {...p,absolute,differences};
    });
    const means=p=>Object.fromEntries(metrics.map(k=>[k,p.absolute[k].mean]));
    return result.map(p=>({...p,pareto:['served','meanEta','distance'].every(k=>Number.isFinite(p.absolute[k].mean))
      ? !result.some(q=>q!==p&&dominates(means(q),means(p))) : null}));
  }
  function finish(data,seed,rows){
    return {version:'0.7',modelVersion:'0.6',profile:'normal',seed,n:rows.length,lambdas:[...lambdas],
      incidentsPerDay:data.research?.day_incidents||120,generatedAt:new Date().toISOString(),
      protocol:{seedPattern:'base|normal|day|index',indexStart:0,ci:'paired mean +/- 1.96 * sample SD / sqrt(n); pointwise, unadjusted',
        pareto:'maximize mean served; minimize mean ETA and mean distance; all lambdas and Greedy; descriptive',
        p95:'mean of within-day sorted ETA[floor(0.95*(served-1))], v0.6 convention',
        severityDelay:'sum(severity * ETA) over served incidents only; severity-minutes/day',
        zeroServed:'ETA and P95 null; omit undefined pairs and report effective n',selection:'none'},
      config:JSON.parse(JSON.stringify(data)),rows,summary:summarize(rows)};
  }
  function csv(result){
    const columns=['record','version','baseSeed','profile','n','index','scenarioSeed','policy','reference','metric','value','ciLow','ciHigh','effectiveN','pareto'];
    const lines=[columns];
    const add=(...fields)=>lines.push(['',result.version,result.seed,result.profile,result.n,...fields]);
    for(const row of result.rows){
      for(const [policy,v] of [...row.policies.map(p=>[String(p.lambda),p]),['greedy',row.greedy]]){
        for(const k of metrics){add(row.index,row.scenarioSeed,policy,'',k,v[k],'','','','');lines.at(-1)[0]='scenario';}
      }
    }
    for(const p of result.summary){
      for(const [ref,values] of [['absolute',p.absolute],...Object.entries(p.differences)]){
        for(const k of metrics){const s=values[k];add('','',p.id,ref,k,s.mean,s.ciLow,s.ciHigh,s.n,p.pareto);lines.at(-1)[0]='summary';}
      }
    }
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return lines.map(row=>row.map(quote).join(',')).join('\r\n');
  }
  globalThis.EcoDispatchAblation={lambdas,metrics,scenario,summarize,finish,dominates,csv};
})();
