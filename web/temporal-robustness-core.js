/* EcoDispatch v1.6 — robustness wrapper around the frozen v1.5 temporal engine. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const A=globalThis.EcoDispatchAblation;
  const T=globalThis.EcoDispatchTemporalFire;
  const LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  const POLICY_DEFS=Object.freeze([
    ...LAMBDAS.map(lambda=>({id:String(lambda),kind:'eco',lambda})),
    {id:'eta-greedy',kind:'eta'},
    {id:'distance-greedy',kind:'distance'}
  ]);
  const OPS=Object.freeze([
    'eventCount','served','unserved','coverage','meanResponseDelay','p95ResponseDelay',
    'meanTravelEta','meanWait','p95Wait','distance','co2Kg','arrivalsAllBusy',
    'arrivalsAnyBusy','waitedServed','maxQueue','utilizationMean',
    'free0Share','free1Share','free2Share','free3Share'
  ]);

  function variantState(baseState,serviceMinutes){
    if(!Number.isFinite(serviceMinutes)||serviceMinutes<=0)throw Error('Invalid service time');
    return {...baseState,protocol:{...baseState.protocol,service_minutes:serviceMinutes}};
  }

  function harmComponents(events,sim,baseK=10){
    if(!Array.isArray(sim.dispatch)||sim.dispatch.length!==events.length)throw Error('Dispatch/event mismatch');
    let unservedSeveritySq=0;
    for(let i=0;i<events.length;i++)if(sim.dispatch[i]===null)unservedSeveritySq+=events[i].severity**2;
    const servedSeverityDelay=sim.totalHarm-baseK*unservedSeveritySq;
    if(servedSeverityDelay<-1e-8)throw Error('Invalid harm decomposition');
    return {servedSeverityDelay:Math.max(0,servedSeverityDelay),unservedSeveritySq};
  }

  function simulatePolicy(state,events,def){
    const sim=def.kind==='eco'
      ?T.simulate(state,events,'eco',def.lambda)
      :T.simulate(state,events,def.kind==='eta'?'eta-greedy':'distance-greedy');
    const harm=harmComponents(events,sim,state.protocol.harm.k_unserved);
    const {dispatch,...operational}=sim;
    return {...operational,...harm};
  }

  function scenario(baseState,events,serviceMinutes){
    const state=variantState(baseState,serviceMinutes);
    return Object.fromEntries(POLICY_DEFS.map(def=>[def.id,simulatePolicy(state,events,def)]));
  }

  function stats(values){
    const valid=values.filter(Number.isFinite);
    return valid.length?{...E.describe(valid),missing:values.length-valid.length}:{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
  }

  function totalHarm(result,k){
    return result.servedSeverityDelay+k*result.unservedSeveritySq;
  }

  function summarizeOperational(rows){
    return Object.fromEntries(POLICY_DEFS.map(def=>[
      def.id,
      Object.fromEntries(OPS.map(metric=>[metric,stats(rows.map(r=>r.policies[def.id][metric]))]))
    ]));
  }

  function summarizeHarm(rows,kValues,seed,bootstrapB){
    const zero=rows.map(r=>r.policies['0']);
    return Object.fromEntries(kValues.map(k=>{
      const byPolicy=Object.fromEntries(POLICY_DEFS.map(def=>{
        const vals=rows.map(r=>totalHarm(r.policies[def.id],k));
        const z=zero.map(x=>totalHarm(x,k));
        const diffs=vals.map((v,i)=>v-z[i]);
        const absolute=stats(vals),paired=stats(diffs);
        paired.bootstrap=A.bootstrapCI(diffs,seed+'|K|'+k+'|policy|'+def.id,bootstrapB);
        return [def.id,{absolute,versusZero:paired}];
      }));
      return [String(k),byPolicy];
    }));
  }

  function classify(delta){
    if(delta.mean<0&&delta.bootstrap.ciHigh<0)return 'negative';
    if(delta.mean>0&&delta.bootstrap.ciLow>0)return 'positive';
    return 'inconclusive';
  }

  globalThis.EcoDispatchTemporalRobustness={
    LAMBDAS,POLICY_DEFS,OPS,variantState,harmComponents,scenario,
    stats,totalHarm,summarizeOperational,summarizeHarm,classify
  };
})();