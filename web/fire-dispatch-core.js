/* Independent v1.4 fire-only experiment; historical engines remain frozen. */
(()=>{
  const E=globalThis.EcoDispatchEngine, R=globalThis.EcoDispatchRealRouting;
  const DATASET='aemet-fire-snapshots-v1.4', LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  function setup(protocol,routing,catalog,snapshotId){
    if(protocol.version!=='1.4'||catalog.dataset!==DATASET||routing.dataset!==catalog.routing.dataset)throw Error('Dataset identity mismatch');
    if(JSON.stringify(protocol.lambdas)!==JSON.stringify(LAMBDAS)||protocol.service_minutes!==0)throw Error('Unsupported protocol');
    if(!catalog.selection.selected_ids.includes(snapshotId))throw Error('Snapshot not selected');
    const snapshot=catalog.candidates.find(s=>s.id===snapshotId);
    if(!snapshot)throw Error('Missing snapshot');
    const idx=Object.fromEntries(routing.points.map((p,i)=>[p.id,i]));
    const eligible=routing.points.filter(p=>p.id.startsWith('D')&&p.snap_distance_m<=500);
    if(eligible.length!==10||JSON.stringify(eligible.map(p=>p.id))!==JSON.stringify(snapshot.nodes.map(n=>n.id)))throw Error('Eligible nodes mismatch');
    const demand=snapshot.nodes.map((n,i)=>{
      const p=eligible[i];
      if(n.longitude!==p.input_lon||n.latitude!==p.input_lat)throw Error('Coordinate mismatch');
      if(!Number.isInteger(n.source_value)||n.source_value<1||n.source_value>6||n.hazard_weight!==n.source_value)throw Error('Invalid ordinal class');
      return {...n,nodeId:n.id};
    });
    const resources=protocol.fleet.map(r=>{
      if(!(r.station in idx)||routing.points[idx[r.station]].snap_distance_m>500||JSON.stringify(r.capabilities)!=='["fire"]'||!Number.isFinite(r.co2_g_per_km)||r.co2_g_per_km<0)throw Error('Invalid experimental brigade');
      return {...r,nodeId:r.station,movementMode:'road',kind:'brigade'};
    });
    if(resources.length<2||new Set(resources.map(r=>r.name)).size!==resources.length)throw Error('Multiple unique brigades required');
    for(const matrix of [routing.durations_s,routing.distances_m]){
      if(matrix.length!==routing.points.length||matrix.some(row=>row.length!==matrix.length||row.some(v=>!Number.isFinite(v)||v<0)))throw Error('Invalid road matrix');
    }
    return {protocol,routing,snapshot,idx,demand,resources};
  }
  function eventsFor(state,seed){
    const rng=E.mulberry32(E.hashString(seed));
    return Array.from({length:state.protocol.incidents_per_day},(_,i)=>({
      name:'F'+String(i+1).padStart(3,'0'),type:'fire',
      nodeId:state.demand[Math.floor(rng()*state.demand.length)].nodeId,
      severity:2+3*rng(),deadline_min:state.protocol.deadline_min
    }));
  }
  function exposure(state,positions,weights=state.demand.map(n=>n.source_value)){
    let total=0;
    for(let d=0;d<state.demand.length;d++){
      const j=state.idx[state.demand[d].id];let best=Infinity;
      for(const pos of positions)best=Math.min(best,state.routing.durations_s[state.idx[pos]][j]/60);
      total+=weights[d]*best;
    }
    return total;
  }
  function simulate(state,events,policy,lambda=0,weights=state.demand.map(n=>n.source_value)){
    if(!['eco','eta-greedy','distance-greedy'].includes(policy)||!Number.isFinite(lambda)||lambda<0)throw Error('Invalid policy');
    if(weights.length!==state.demand.length||weights.some(w=>!Number.isInteger(w)||w<1||w>6))throw Error('Invalid control weights');
    const positions=state.resources.map(r=>r.nodeId),etas=[],dispatch=[];
    let served=0,distance=0,co2Kg=0,severityDelay=0,totalHarm=0,cost=0;
    for(const event of events){
      if(event.type!=='fire'||!state.demand.some(n=>n.id===event.nodeId)||!Number.isFinite(event.severity)||event.severity<0||!Number.isFinite(event.deadline_min)||event.deadline_min<0)throw Error('Invalid fire event');
      const current=policy==='eco'&&lambda>0?exposure(state,positions,weights):0;
      let best=null;
      state.resources.forEach((r,ri)=>{
        const ev=R.evaluate(r,positions[ri],event,state.routing,state.idx);if(!ev)return;
        let score=policy==='eta-greedy'?ev.eta:ev.distance;
        if(policy==='eco'){
          const next=positions.slice();next[ri]=event.nodeId;
          score=ev.cost+(lambda>0?lambda*(exposure(state,next,weights)-current):0);
        }
        // Strict comparison makes ties deterministic in the declared fleet order.
        if(!best||score<best.score)best={ri,score,ev};
      });
      if(!best){dispatch.push(null);totalHarm+=state.protocol.harm_k*event.severity**2;continue;}
      const {ri,ev}=best;positions[ri]=event.nodeId;dispatch.push(state.resources[ri].name);
      served++;distance+=ev.distance;co2Kg+=ev.emissionsG/1000;cost+=ev.cost;
      const delay=event.severity*ev.eta;severityDelay+=delay;totalHarm+=delay;etas.push(ev.eta);
    }
    etas.sort((a,b)=>a-b);
    return {served,coverage:events.length?served/events.length:null,cost,distance,co2Kg,severityDelay,totalHarm,
      meanEta:etas.length?etas.reduce((a,b)=>a+b,0)/etas.length:null,
      p95Eta:etas.length?etas[Math.floor(.95*(etas.length-1))]:null,dispatch};
  }
  function scenario(state,index){
    const scenarioSeed=state.protocol.seed+'|snapshot|'+state.snapshot.id+'|day|'+index;
    const events=eventsFor(state,scenarioSeed);
    return {index,scenarioSeed,events,
      policies:LAMBDAS.map(lambda=>({lambda,...simulate(state,events,'eco',lambda)})),
      etaGreedy:simulate(state,events,'eta-greedy'),distanceGreedy:simulate(state,events,'distance-greedy')};
  }
  globalThis.EcoDispatchFireDispatch={DATASET,LAMBDAS,setup,eventsFor,exposure,simulate,scenario};
})();
