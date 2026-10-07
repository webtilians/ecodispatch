/* v0.8 paired ablation: same days for every policy; no stress selection. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const lambdas=Object.freeze([0,.1,.2,.35,.5,1,2]);
  const metrics=Object.freeze(['served','meanEta','p95Eta','distance','severityDelay','totalHarm']);
  const paretoMetrics=Object.freeze(['served','meanEta','distance']);

  function scenario(data,setup,seed,index,options={}){
    const scenarioSeed=seed+'|normal|day|'+index;
    const harmK=Number.isFinite(options.harmK)?options.harmK:(data.research?.unserved_penalty_k??10);
    const events=E.generateDay(
      data,setup.demand,data.research?.day_incidents||120,
      E.mulberry32(E.hashString(scenarioSeed))
    );
    const run=(policy,lambda)=>{
      const result=E.simulateDay(setup.demand,setup.resources,events,policy,lambda,{harmK});
      if(!result.served){result.meanEta=null;result.p95Eta=null;}
      return Object.fromEntries(metrics.map(k=>[k,result[k]]));
    };
    const distanceGreedy=run('greedy',0);
    const etaGreedy=run('eta-greedy',0);
    return {
      index,scenarioSeed,harmK,
      // Legacy alias retained for v0.6/v0.7 export compatibility.
      greedy:distanceGreedy,
      distanceGreedy,etaGreedy,
      policies:lambdas.map(lambda=>({lambda,...run('eco',lambda)}))
    };
  }

  function stats(values){
    const valid=values.filter(Number.isFinite);
    return valid.length
      ? {...E.describe(valid),missing:values.length-valid.length}
      : {n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
  }

  function bootstrapCI(values,seed,B=500){
    const valid=values.filter(Number.isFinite);
    if(!valid.length)return {b:B,n:0,ciLow:null,ciHigh:null};
    if(valid.every(v=>v===valid[0]))return {b:B,n:valid.length,ciLow:valid[0],ciHigh:valid[0]};
    const rng=E.mulberry32(E.hashString(seed));
    const means=[];
    for(let b=0;b<B;b++){
      let sum=0;
      for(let i=0;i<valid.length;i++)sum+=valid[Math.floor(rng()*valid.length)];
      means.push(sum/valid.length);
    }
    means.sort((a,b)=>a-b);
    return {
      b:B,n:valid.length,
      ciLow:quantile(means,.025),
      ciHigh:quantile(means,.975)
    };
  }

  function quantile(sorted,p){
    if(!sorted.length)return null;
    const pos=(sorted.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);
    if(lo===hi)return sorted[lo];
    return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
  }

  function dominates(a,b){
    if(!paretoMetrics.every(k=>Number.isFinite(a[k])&&Number.isFinite(b[k])))return false;
    const x=[-a.served,a.meanEta,a.distance],y=[-b.served,b.meanEta,b.distance];
    return x.every((v,i)=>v<=y[i])&&x.some((v,i)=>v<y[i]);
  }

  function policies(){
    return [
      ...lambdas.map(lambda=>({id:String(lambda),lambda,kind:'eco'})),
      {id:'eta-greedy',lambda:null,kind:'eta-greedy'},
      {id:'distance-greedy',lambda:null,kind:'distance-greedy'}
    ];
  }

  function valueFor(row,p){
    if(p.kind==='eta-greedy')return row.etaGreedy;
    if(p.kind==='distance-greedy')return row.distanceGreedy||row.greedy;
    return row.policies.find(x=>x.lambda===p.lambda);
  }

  function referenceFor(row,ref){
    if(ref==='zero')return row.policies.find(x=>x.lambda===0);
    if(ref==='etaGreedy')return row.etaGreedy;
    if(ref==='distanceGreedy')return row.distanceGreedy||row.greedy;
    throw new Error('Unknown reference '+ref);
  }

  function bootstrapPareto(rows,policyDefs,seed,B=500){
    const counts=Object.fromEntries(policyDefs.map(p=>[p.id,0]));
    const rng=E.mulberry32(E.hashString(seed+'|pareto-bootstrap'));
    for(let b=0;b<B;b++){
      const sampled=Array.from({length:rows.length},()=>rows[Math.floor(rng()*rows.length)]);
      const means=policyDefs.map(p=>{
        const values=sampled.map(r=>valueFor(r,p));
        const mean=k=>{
          const valid=values.map(v=>v[k]).filter(Number.isFinite);
          return valid.length?valid.reduce((a,x)=>a+x,0)/valid.length:null;
        };
        return {id:p.id,served:mean('served'),meanEta:mean('meanEta'),distance:mean('distance')};
      });
      for(const p of means){
        if(paretoMetrics.every(k=>Number.isFinite(p[k]))&&!means.some(q=>q!==p&&dominates(q,p)))counts[p.id]++;
      }
    }
    return Object.fromEntries(policyDefs.map(p=>[p.id,counts[p.id]/B]));
  }

  function summarize(rows,seed='ecodispatch',bootstrapB=500){
    const defs=policies();
    const result=defs.map(p=>{
      const values=rows.map(r=>valueFor(r,p));
      const absolute=Object.fromEntries(metrics.map(k=>[k,stats(values.map(v=>v[k]))]));
      const differences=Object.fromEntries(
        ['zero','etaGreedy','distanceGreedy'].map(ref=>[
          ref,
          Object.fromEntries(metrics.map(k=>{
            const diffs=values.map((v,i)=>{
              const baseline=referenceFor(rows[i],ref);
              return Number.isFinite(v[k])&&Number.isFinite(baseline[k])?v[k]-baseline[k]:null;
            });
            const normal=stats(diffs);
            const bootstrap=bootstrapCI(diffs,seed+'|'+p.id+'|'+ref+'|'+k,bootstrapB);
            return [k,{...normal,bootstrap}];
          }))
        ])
      );
      return {...p,absolute,differences};
    });

    const means=p=>Object.fromEntries(metrics.map(k=>[k,p.absolute[k].mean]));
    const descriptive=result.map(p=>({
      ...p,
      pareto:paretoMetrics.every(k=>Number.isFinite(p.absolute[k].mean))
        ? !result.some(q=>q!==p&&dominates(means(q),means(p)))
        : null
    }));
    const probabilities=bootstrapPareto(rows,defs,seed,bootstrapB);
    return descriptive.map(p=>({...p,paretoProbability:probabilities[p.id]}));
  }

  function finish(data,seed,rows,options={}){
    const harmK=Number.isFinite(options.harmK)?options.harmK:(data.research?.unserved_penalty_k??10);
    const bootstrapB=Number.isInteger(options.bootstrapB)?options.bootstrapB:(data.research?.bootstrap_replicates??500);
    return {
      version:'0.8',modelVersion:'0.8',profile:'normal',seed,n:rows.length,
      lambdas:[...lambdas],harmK,bootstrapReplicates:bootstrapB,
      incidentsPerDay:data.research?.day_incidents||120,generatedAt:new Date().toISOString(),
      protocol:{
        seedPattern:'base|normal|day|index',indexStart:0,
        primaryReference:'EcoDispatch lambda=0',
        baselines:['eta-greedy','distance-greedy'],
        normalCI:'paired mean +/- 1.96 * sample SD / sqrt(n); pointwise, unadjusted',
        bootstrapCI:'paired percentile bootstrap of daily differences',
        pareto:'maximize mean served; minimize mean ETA and mean distance; descriptive mean front plus paired-bootstrap P(non-dominated)',
        p95:'mean of within-day sorted ETA[floor(0.95*(served-1))], v0.6 convention',
        severityDelay:'sum(severity * ETA) over served incidents only',
        totalHarm:'sum_served(severity * ETA) + harmK * sum_unserved(severity^2)',
        harmSensitivity:'harmK is explicit and user-selectable; default 10, suggested sensitivity 5/10/20',
        zeroServed:'ETA and P95 null; omit undefined pairs and report effective n',
        selection:'none'
      },
      config:JSON.parse(JSON.stringify(data)),
      rows,
      summary:summarize(rows,seed,bootstrapB)
    };
  }

  function csv(result){
    const columns=[
      'record','version','baseSeed','profile','n','harmK','bootstrapReplicates',
      'index','scenarioSeed','policy','reference','metric','value',
      'normalCiLow','normalCiHigh','bootstrapCiLow','bootstrapCiHigh',
      'effectiveN','pareto','paretoProbability'
    ];
    const lines=[columns];
    const add=(...fields)=>lines.push(['',result.version,result.seed,result.profile,result.n,result.harmK,result.bootstrapReplicates,...fields]);

    for(const row of result.rows){
      const entries=[
        ...row.policies.map(p=>[String(p.lambda),p]),
        ['eta-greedy',row.etaGreedy],
        ['distance-greedy',row.distanceGreedy||row.greedy]
      ];
      for(const [policy,v] of entries){
        for(const k of metrics){
          add(row.index,row.scenarioSeed,policy,'',k,v[k],'','','','','','','');
          lines.at(-1)[0]='scenario';
        }
      }
    }

    for(const p of result.summary){
      for(const [ref,values] of [['absolute',p.absolute],...Object.entries(p.differences)]){
        for(const k of metrics){
          const s=values[k],boot=s.bootstrap||{};
          add('','',p.id,ref,k,s.mean,s.ciLow,s.ciHigh,boot.ciLow,boot.ciHigh,s.n,p.pareto,p.paretoProbability);
          lines.at(-1)[0]='summary';
        }
      }
    }

    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return lines.map(row=>row.map(quote).join(',')).join('\r\n');
  }

  globalThis.EcoDispatchAblation={
    lambdas,metrics,paretoMetrics,scenario,summarize,finish,dominates,
    bootstrapCI,bootstrapPareto,csv
  };
})();