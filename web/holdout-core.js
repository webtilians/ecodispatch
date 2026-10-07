/* v0.9 confirmatory holdout. Protocol frozen in docs/holdout-v0.9-preregistered.md. */
(()=>{
  const A=globalThis.EcoDispatchAblation;
  const E=globalThis.EcoDispatchEngine;

  const protocol=Object.freeze({
    preregCommit:'017cda8cf011a89794d987ad65658249df60b2f9',
    seed:'ecodispatch-holdout-09',
    seedPattern:'ecodispatch-holdout-09|normal|day|index',
    n:1000,
    incidentsPerDay:120,
    harmK:10,
    bootstrapB:500,
    alpha:.05,
    primaryLambdas:Object.freeze([.2,.35,.5,1]),
    sensitivityK:Object.freeze([5,20]),
    referenceLambda:0
  });

  function erfc(x){
    // Stable complementary-error-function approximation (Numerical Recipes).
    // Unlike 2*(1-Phi(z)), this does not lose tiny tail probabilities to
    // catastrophic cancellation for the z-scores observed in the holdout.
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

  function policy(row,lambda){return row.policies.find(p=>p.lambda===lambda);}
  function unservedSeveritySq(v,k=10){
    return Number.isFinite(v.totalHarm)&&Number.isFinite(v.severityDelay)
      ?(v.totalHarm-v.severityDelay)/k:null;
  }
  function harmAtK(v,k){
    const u=unservedSeveritySq(v,protocol.harmK);
    return Number.isFinite(u)?v.severityDelay+k*u:null;
  }

  function diffValues(rows,lambda,metric,k=protocol.harmK){
    return rows.map(row=>{
      const p=policy(row,lambda),z=policy(row,0);
      if(metric==='totalHarm'&&k!==protocol.harmK){
        const pv=harmAtK(p,k),zv=harmAtK(z,k);
        return Number.isFinite(pv)&&Number.isFinite(zv)?pv-zv:null;
      }
      return Number.isFinite(p?.[metric])&&Number.isFinite(z?.[metric])?p[metric]-z[metric]:null;
    });
  }

  function pairedSummary(values,seed,label,B=protocol.bootstrapB){
    const valid=values.filter(Number.isFinite);
    const normal=valid.length?{...E.describe(valid),missing:values.length-valid.length}:{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
    const bootstrap=A.bootstrapCI(values,seed+'|holdout|'+label,B);
    return {...normal,bootstrap};
  }

  function analyze(rows,seed=protocol.seed){
    const uncorrected=protocol.primaryLambdas.map(lambda=>{
      const harm=pairedSummary(diffValues(rows,lambda,'totalHarm'),seed,'lambda-'+lambda+'|H');
      return {
        id:String(lambda),lambda,harm,
        rawP:twoSidedNormalP(harm.mean,harm.sd,harm.n)
      };
    });
    const corrected=holm(uncorrected,protocol.alpha);

    const primary=corrected.map(item=>{
      const secondary=Object.fromEntries(['served','meanEta','p95Eta','distance','severityDelay'].map(metric=>[
        metric,pairedSummary(diffValues(rows,item.lambda,metric),seed,'lambda-'+item.lambda+'|'+metric)
      ]));
      const pass=item.harm.mean<0&&item.harm.bootstrap.ciHigh<0&&item.holmReject;
      return {...item,secondary,pass};
    });

    const sensitivity=protocol.sensitivityK.map(k=>({
      k,
      policies:protocol.primaryLambdas.map(lambda=>({
        lambda,
        harm:pairedSummary(diffValues(rows,lambda,'totalHarm',k),seed,'sensitivity-K'+k+'|lambda-'+lambda)
      }))
    }));

    return {
      primary,
      confirmed:primary.some(x=>x.pass),
      passingLambdas:primary.filter(x=>x.pass).map(x=>x.lambda),
      sensitivity
    };
  }

  function finish(data,rows,seed=protocol.seed){
    const analysis=analyze(rows,seed);
    return {
      version:'0.9.1',
      modelVersion:'0.8-frozen',
      profile:'normal',
      confirmatory:true,
      preregistration:{
        path:'docs/holdout-v0.9-preregistered.md',
        commit:protocol.preregCommit,
        frozenBeforeResults:true
      },
      protocol:{
        seed,
        seedPattern:seed+'|normal|day|index',
        n:rows.length,
        incidentsPerDay:data.research?.day_incidents||120,
        harmK:protocol.harmK,
        bootstrapReplicates:protocol.bootstrapB,
        primaryLambdas:[...protocol.primaryLambdas],
        referenceLambda:0,
        alpha:protocol.alpha,
        multiplicity:'Holm correction across four primary total-harm comparisons',
        confirmationRule:'At least one preregistered lambda: mean DeltaH < 0; paired bootstrap 95% CI upper < 0; Holm-adjusted two-sided normal p < 0.05',
        selection:'none',
        historicalDevelopmentSeedExcluded:'ecodispatch-mc-06'
      },
      generatedAt:new Date().toISOString(),
      analysis,
      rows
    };
  }

  function csv(result){
    const lines=[['record','version','seed','lambda','metric','meanDiff','normalCiLow','normalCiHigh','bootstrapCiLow','bootstrapCiHigh','rawP','holmP','pass','K']];
    for(const p of result.analysis.primary){
      const add=(metric,s,k='')=>lines.push(['primary',result.version,result.protocol.seed,p.lambda,metric,s.mean,s.ciLow,s.ciHigh,s.bootstrap.ciLow,s.bootstrap.ciHigh,p.rawP,p.holmP,p.pass,k]);
      add('totalHarm',p.harm,result.protocol.harmK);
      for(const [metric,s] of Object.entries(p.secondary))add(metric,s);
    }
    for(const block of result.analysis.sensitivity){
      for(const p of block.policies){
        const s=p.harm;
        lines.push(['sensitivity',result.version,result.protocol.seed,p.lambda,'totalHarm',s.mean,s.ciLow,s.ciHigh,s.bootstrap.ciLow,s.bootstrap.ciHigh,'','','',block.k]);
      }
    }
    const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return lines.map(r=>r.map(q).join(',')).join('\r\n');
  }

  globalThis.EcoDispatchHoldout={protocol,erfc,twoSidedNormalP,holm,analyze,finish,csv,harmAtK};
})();