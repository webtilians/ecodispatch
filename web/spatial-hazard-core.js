/* v1.3 isolated engine. Ordinal fire weights enter exposure only; events remain synthetic. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const TYPE_PROBS=Object.freeze({medical:.35,fire:.4,drone:.25});
  const DEADLINES=Object.freeze({medical:90,fire:120,drone:30});
  const LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  const METRICS=Object.freeze(['served','meanEta','p95Eta','distance','co2Kg','severityDelay','totalHarm']);

  const R=globalThis.EcoDispatchRealRouting;
  const {placement,movement,evaluate,generateDay,summarize,csv,demandSet,excludedDemand}=R;

  const DATASET='aemet-malaga-spatial-hazard-v1.3';
  function setup(config,routing,hazard){
    if(hazard.dataset!==DATASET||routing.dataset!==hazard.routing.dataset)throw new Error('Dataset identity mismatch');
    const state=globalThis.EcoDispatchRealRouting.setup(config,routing);
    if(JSON.stringify(state.demand.map(d=>d.nodeId))!==JSON.stringify(hazard.nodes.map(d=>d.id)))throw new Error('Eligible nodes mismatch');
    state.demand=state.demand.map((d,i)=>{
      const h=hazard.nodes[i],p=routing.points[d.routingIndex];
      if(h.longitude!==p.input_lon||h.latitude!==p.input_lat)throw new Error('Coordinate identity mismatch');
      if(!Number.isInteger(h.source_value)||h.source_value<1||h.source_value>6||h.hazard_weight!==h.source_value)throw new Error('Invalid ordinal hazard weight');
      return {...d,hazard_weight:h.hazard_weight};
    });
    return state;
  }

  function exposure(demand,resources,positions,routing,idx){
    let total=0;
    for(const node of demand){
      for(const [type,prob] of Object.entries(TYPE_PROBS)){
        let best=Infinity;
        resources.forEach((r,ri)=>{
          if(!r.capabilities.includes(type))return;
          const eta=movement(r,positions[ri],node.nodeId,routing,idx).eta;
          if(eta<best)best=eta;
        });
        total+=(type==='fire'?node.hazard_weight:node.risk_weight)*prob*best;
      }
    }
    return total;
  }

  function simulate(demand,resources,events,routing,idx,policy,lambda,{harmK=10}={}){
    const positions=resources.map(r=>r.nodeId);
    const etas=[];let served=0,cost=0,distance=0,co2G=0,severityDelay=0,totalHarm=0;
    for(const event of events){
      const currentExposure=policy==='eco'?exposure(demand,resources,positions,routing,idx):0;
      let best=null;
      resources.forEach((r,ri)=>{
        const ev=evaluate(r,positions[ri],event,routing,idx);if(!ev)return;
        let score=ev.distance;
        if(policy==='eta-greedy')score=ev.eta;
        if(policy==='eco'){
          const next=positions.slice();next[ri]=event.nodeId;
          const delta=exposure(demand,resources,next,routing,idx)-currentExposure;
          score=ev.cost+lambda*delta;
        }
        if(!best||score<best.score)best={ri,score,ev};
      });
      if(!best){totalHarm+=harmK*event.severity*event.severity;continue;}
      positions[best.ri]=event.nodeId;
      const delay=event.severity*best.ev.eta;
      served++;cost+=best.ev.cost;distance+=best.ev.distance;co2G+=best.ev.emissionsG;
      severityDelay+=delay;totalHarm+=delay;etas.push(best.ev.eta);
    }
    etas.sort((a,b)=>a-b);
    return{
      served,cost,distance,co2Kg:co2G/1000,severityDelay,totalHarm,
      meanEta:etas.length?etas.reduce((a,b)=>a+b,0)/etas.length:null,
      p95Eta:etas.length?etas[Math.min(etas.length-1,Math.floor(.95*(etas.length-1)))]:null
    };
  }

  function scenario(config,routing,setupState,seed,index,{harmK=10}={}){
    const scenarioSeed=seed+'|day|'+index;
    const events=generateDay(setupState.demand,config.research?.day_incidents||120,E.mulberry32(E.hashString(scenarioSeed)));
    const run=(policy,lambda)=>simulate(setupState.demand,setupState.resources,events,routing,setupState.idx,policy,lambda,{harmK});
    return{
      index,scenarioSeed,
      policies:LAMBDAS.map(lambda=>({lambda,...run('eco',lambda)})),
      etaGreedy:run('eta-greedy',0),
      distanceGreedy:run('distance-greedy',0)
    };
  }

  globalThis.EcoDispatchSpatialHazard={
    TYPE_PROBS,DEADLINES,LAMBDAS,METRICS,
    setup,placement,movement,evaluate,generateDay,simulate,scenario,summarize,csv,exposure,DATASET,
    demandSet,excludedDemand
  };
})();