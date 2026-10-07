/* EcoDispatch v1.1 — preregistered holdout on frozen v1.0 real-routing domain. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const A=globalThis.EcoDispatchAblation;
  const R=globalThis.EcoDispatchRealRouting;

  const protocol=Object.freeze({
    preregCommit:'691a85c96afa497fc8c2f42386d1d12c00a4ff5a',
    seed:'ecodispatch-real-routing-holdout-11',
    seedPattern:'ecodispatch-real-routing-holdout-11|day|index',
    historicalExploratorySeed:'ecodispatch-real-routing-10',
    n:1000,
    incidentsPerDay:120,
    harmK:10,
    bootstrapB:500,
    alpha:.05,
    primaryLambdas:Object.freeze([.2,.35,.5,1]),
    referenceLambda:0,
    routingDataset:'malaga-real-routing-v1',
    routingBlobSha:'4fbfaf903988f896fd3c6e49099141a6dd810c75',
    routingGeneratedAt:'2026-10-07T22:07:45.400761+00:00',
    maxSnapM:500,
    eligibleDemand:Object.freeze(['D0','D1','D2','D3','D4','D6','D7','D9','D10','D11']),
    excludedDemand:Object.freeze(['D5','D8']),
    placementBases:Object.freeze(['B2','B3','B4']),
    deadlines:Object.freeze({medical:90,fire:120,drone:30})
  });

  const secondaryMetrics=Object.freeze(['served','meanEta','p95Eta','distance','co2Kg','severityDelay']);

  function erfc(x){
    const z=Math.abs(x),t=1/(1+.5*z);
    const ans=t*Math.exp(
      -z*z-1.26551223+
      t*(1.00002368+
      t*(.37409196+
      t*(.09678418+
      t*(-.18628806+
      t*(.27886807+
      t*(-1.13520398+
      t*(1.48851587+
      t*(-.82215223+
      t*.17087277))))))))
    );
    return x>=0?ans:2-ans;
  }

  function twoSidedNormalP(mean,sd,n){
    if(!Number.isFinite(mean)||!Number.isFinite(sd)||!n)return null;
    if(sd===0)return mean===0?1:0;
    const z=Math.abs(mean)/(sd/Math.sqrt(n));
    return Math.max(0,Math.min(1,erfc(z/Math.SQRT2)));
  }

  function holm(entries,alpha=.05){
    const sorted=entries.map(x=>({...x})).sort((a,b)=>a.rawP-b.rawP);
    let running=0;
    sorted.forEach((x,i)=>{
      const adjusted=Math.min(1,(sorted.length-i)*x.rawP);
      running=Math.max(running,adjusted);
      x.holmP=running;
      x.holmReject=running<alpha;
    });
    const byId=Object.fromEntries(sorted.map(x=>[x.id,x]));
    return entries.map(x=>({...x,holmP:byId[x.id].holmP,holmReject:byId[x.id].holmReject}));
  }

  function validateDomain(config,routing){
    if(routing.dataset!==protocol.routingDataset)throw new Error('Routing dataset identity mismatch');
    if(routing.generated_at_utc!==protocol.routingGeneratedAt)throw new Error('Routing dataset timestamp mismatch');
    const setup=R.setup(config,routing);
    const eligible=setup.demand.map(x=>x.nodeId);
    const excluded=setup.excluded.map(x=>x.id);
    if(JSON.stringify(eligible)!==JSON.stringify(protocol.eligibleDemand))throw new Error('Eligible demand set mismatch');
    if(JSON.stringify(excluded)!==JSON.stringify(protocol.excludedDemand))throw new Error('Excluded demand set mismatch');
    if(JSON.stringify(setup.placement.bases)!==JSON.stringify(protocol.placementBases))throw new Error('Placement mismatch');
    if(JSON.stringify(R.DEADLINES)!==JSON.stringify(protocol.deadlines))throw new Error('Deadline model mismatch');
    return setup;
  }

  function policy(row,lambda){return row.policies.find(p=>p.lambda===lambda);}

  function pairedSummary(values,seed,label,B=protocol.bootstrapB){
    const valid=values.filter(Number.isFinite);
    const normal=valid.length
      ?{...E.describe(valid),missing:values.length-valid.length}
      :{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
    const bootstrap=A.bootstrapCI(values,seed+'|real-routing-holdout|'+label,B);
    return {...normal,bootstrap};
  }

  function diffs(rows,lambda,metric){
    return rows.map(row=>{
      const p=policy(row,lambda),z=policy(row,0);
      return Number.isFinite(p?.[metric])&&Number.isFinite(z?.[metric])?p[metric]-z[metric]:null;
    });
  }

  function analyze(rows,seed=protocol.seed){
    const raw=protocol.primaryLambdas.map(lambda=>{
      const harm=pairedSummary(diffs(rows,lambda,'totalHarm'),seed,'lambda-'+lambda+'|totalHarm');
      return{id:String(lambda),lambda,harm,rawP:twoSidedNormalP(harm.mean,harm.sd,harm.n)};
    });
    const corrected=holm(raw,protocol.alpha);

    const primary=corrected.map(item=>{
      const secondary=Object.fromEntries(secondaryMetrics.map(metric=>[
        metric,pairedSummary(diffs(rows,item.lambda,metric),seed,'lambda-'+item.lambda+'|'+metric)
      ]));
      const pass=item.harm.mean<0&&item.harm.bootstrap.ciHigh<0&&item.holmReject;
      return{...item,secondary,pass};
    });

    const baseline=(kind)=>{
      const values=rows.map(row=>kind==='eta'?row.etaGreedy:row.distanceGreedy);
      const zero=rows.map(row=>policy(row,0));
      return{
        id:kind==='eta'?'eta-greedy':'distance-greedy',
        absolute:Object.fromEntries(R.METRICS.map(metric=>[
          metric,
          (()=>{const xs=values.map(v=>v[metric]).filter(Number.isFinite);return xs.length?E.describe(xs):{n:0,mean:null,sd:null,ciLow:null,ciHigh:null};})()
        ])),
        versusZero:Object.fromEntries(R.METRICS.map(metric=>{
          const d=values.map((v,i)=>Number.isFinite(v[metric])&&Number.isFinite(zero[i][metric])?v[metric]-zero[i][metric]:null);
          return[metric,pairedSummary(d,seed,(kind==='eta'?'eta':'distance')+'|'+metric)];
        }))
      };
    };

    return{
      primary,
      confirmed:primary.some(x=>x.pass),
      passingLambdas:primary.filter(x=>x.pass).map(x=>x.lambda),
      baselines:[baseline('eta'),baseline('distance')]
    };
  }

  function finish(config,routing,rows,seed=protocol.seed){
    const setup=validateDomain(config,routing);
    const analysis=analyze(rows,seed);
    return{
      version:'1.1',
      benchmark:'real-routing-holdout-confirmatory',
      confirmatory:true,
      preregistration:{
        path:'docs/real-routing-holdout-v1.1-preregistered.md',
        commit:protocol.preregCommit,
        frozenBeforeResults:true
      },
      protocol:{
        seed,
        seedPattern:seed+'|day|index',
        n:rows.length,
        incidentsPerDay:protocol.incidentsPerDay,
        harmK:protocol.harmK,
        bootstrapReplicates:protocol.bootstrapB,
        primaryLambdas:[...protocol.primaryLambdas],
        referenceLambda:0,
        alpha:protocol.alpha,
        multiplicity:'Holm correction across four primary total-harm comparisons',
        confirmationRule:'At least one preregistered lambda: mean DeltaH < 0; paired bootstrap 95% CI upper < 0; Holm-adjusted two-sided paired normal p < 0.05',
        selection:'none',
        historicalExploratorySeedExcluded:protocol.historicalExploratorySeed
      },
      dataset:{
        id:routing.dataset,
        gitBlobSha:protocol.routingBlobSha,
        generatedAt:routing.generated_at_utc,
        maxSnapM:protocol.maxSnapM,
        eligibleDemand:setup.demand.map(x=>x.nodeId),
        excludedDemand:setup.excluded,
        placement:{bases:setup.placement.bases,objectiveRiskWeightedMinutes:setup.placement.objective},
        routingProfile:routing.scope.routing_profile,
        source:routing.source
      },
      assumptions:{
        risk:'synthetic v0.x weights',
        incidents:'synthetic, sampled only on frozen eligible demand nodes',
        roadMovement:'frozen OSRM driving duration/distance matrix',
        droneMovement:'geodesic direct flight at configured drone speed',
        serviceDuration:'zero / instantaneous availability after each sequential incident',
        claimScope:'confirmatory inside frozen real-routing simulator; not real-world efficacy'
      },
      generatedAt:new Date().toISOString(),
      analysis,
      rows
    };
  }

  function csv(result){
    const lines=[[
      'record','version','seed','lambda','metric','meanDiff','normalCiLow','normalCiHigh',
      'bootstrapCiLow','bootstrapCiHigh','rawP','holmP','pass'
    ]];
    for(const p of result.analysis.primary){
      const add=(metric,s)=>lines.push([
        'primary',result.version,result.protocol.seed,p.lambda,metric,s.mean,s.ciLow,s.ciHigh,
        s.bootstrap.ciLow,s.bootstrap.ciHigh,p.rawP,p.holmP,p.pass
      ]);
      add('totalHarm',p.harm);
      for(const [metric,s] of Object.entries(p.secondary))add(metric,s);
    }
    for(const base of result.analysis.baselines){
      for(const [metric,s] of Object.entries(base.versusZero)){
        lines.push([
          'baseline',result.version,result.protocol.seed,base.id,metric,s.mean,s.ciLow,s.ciHigh,
          s.bootstrap.ciLow,s.bootstrap.ciHigh,'','',''
        ]);
      }
    }
    const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return lines.map(r=>r.map(q).join(',')).join('\r\n');
  }

  globalThis.EcoDispatchRealRoutingHoldout={
    protocol,secondaryMetrics,erfc,twoSidedNormalP,holm,validateDomain,
    pairedSummary,diffs,analyze,finish,csv
  };
})();