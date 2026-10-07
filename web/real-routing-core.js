/* EcoDispatch v1.0 — exploratory benchmark on a frozen OSM/OSRM routing matrix. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const A=globalThis.EcoDispatchAblation;
  const TYPE_PROBS=Object.freeze({medical:.35,fire:.4,drone:.25});
  const DEADLINES=Object.freeze({medical:90,fire:120,drone:30});
  const LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  const METRICS=Object.freeze(['served','meanEta','p95Eta','distance','co2Kg','severityDelay','totalHarm']);

  function indexRouting(routing){
    return Object.fromEntries(routing.points.map((p,i)=>[p.id,i]));
  }

  function demandSet(config,routing,maxSnapM=500){
    const idx=indexRouting(routing);
    return config.demand
      .filter(d=>routing.points[idx[d.name]]?.snap_distance_m<=maxSnapM)
      .map(d=>({...d,routingIndex:idx[d.name],nodeId:d.name}));
  }

  function excludedDemand(config,routing,maxSnapM=500){
    const idx=indexRouting(routing);
    return config.demand
      .filter(d=>routing.points[idx[d.name]]?.snap_distance_m>maxSnapM)
      .map(d=>({id:d.name,snapDistanceM:routing.points[idx[d.name]].snap_distance_m}));
  }

  function combinations(items,k){
    const out=[];
    function walk(start,picked){
      if(picked.length===k){out.push(picked.slice());return;}
      for(let i=start;i<=items.length-(k-picked.length);i++){
        picked.push(items[i]);walk(i+1,picked);picked.pop();
      }
    }
    walk(0,[]);return out;
  }

  function placement(config,routing,demand=demandSet(config,routing)){
    const idx=indexRouting(routing),k=config.research?.placement_k||3;
    const scored=combinations(config.candidates,k).map(set=>{
      const objective=demand.reduce((sum,node)=>{
        const minutes=Math.min(...set.map(base=>routing.durations_s[idx[base.name]][node.routingIndex]/60));
        return sum+node.risk_weight*minutes;
      },0);
      return{bases:set.map(x=>x.name),objective};
    }).sort((a,b)=>a.objective-b.objective);
    return{...scored[0],all:scored};
  }

  function strictCapabilities(resource){
    if(resource.kind==='brigade')return ['fire'];
    if(resource.kind==='ambulance')return ['medical'];
    if(resource.kind==='drone')return ['drone'];
    if(resource.kind==='utility')return ['medical','drone'];
    return [...resource.capabilities];
  }

  function setup(config,routing){
    const idx=indexRouting(routing),demand=demandSet(config,routing),place=placement(config,routing,demand);
    const starts=[place.bases[0],place.bases[0],place.bases[1],place.bases[2]];
    const resources=config.resources.map((r,i)=>({
      ...r,
      capabilities:strictCapabilities(r),
      nodeId:starts[i],
      movementMode:r.kind==='drone'?'air':'road'
    }));
    return{
      idx,demand,placement:place,resources,
      excluded:excludedDemand(config,routing)
    };
  }

  function radians(v){return v*Math.PI/180;}
  function haversineKm(a,b){
    const R=6371.0088,la1=radians(a[0]),la2=radians(b[0]),dl=la2-la1,dg=radians(b[1]-a[1]);
    const h=Math.sin(dl/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dg/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  function pointLatLon(routing,idx,nodeId){
    const p=routing.points[idx[nodeId]];
    return[p.input_lat,p.input_lon];
  }

  function movement(resource,fromId,toId,routing,idx){
    if(resource.movementMode==='air'){
      const distance=haversineKm(pointLatLon(routing,idx,fromId),pointLatLon(routing,idx,toId));
      return{distance,eta:60*distance/(resource.speed_kmh||80),mode:'air'};
    }
    const i=idx[fromId],j=idx[toId];
    return{
      distance:routing.distances_m[i][j]/1000,
      eta:routing.durations_s[i][j]/60,
      mode:'road'
    };
  }

  function evaluate(resource,fromId,event,routing,idx){
    if(!resource.capabilities.includes(event.type))return null;
    const m=movement(resource,fromId,event.nodeId,routing,idx);
    if(m.eta>event.deadline_min)return null;
    const emissions=(resource.co2_g_per_km||180)*m.distance;
    return{
      ...m,
      emissionsG:emissions,
      cost:event.severity*m.eta+.0005*emissions+.05*m.distance
    };
  }

  function weightedDemand(demand,rng){
    const total=demand.reduce((s,x)=>s+x.risk_weight,0);
    let ticket=rng()*total;
    for(const node of demand){ticket-=node.risk_weight;if(ticket<=0)return node;}
    return demand[demand.length-1];
  }

  function generateDay(demand,count,rng){
    const events=[];
    for(let i=0;i<count;i++){
      const source=weightedDemand(demand,rng),x=rng();
      const type=x<TYPE_PROBS.medical?'medical':x<TYPE_PROBS.medical+TYPE_PROBS.fire?'fire':'drone';
      events.push({
        name:'R'+String(i+1).padStart(3,'0'),
        nodeId:source.nodeId,
        source:source.name,
        type,
        severity:2+rng()*3,
        deadline_min:DEADLINES[type]
      });
    }
    return events;
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
        total+=node.risk_weight*prob*best;
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

  function stats(values){
    const valid=values.filter(Number.isFinite);
    return valid.length?{...E.describe(valid),missing:values.length-valid.length}:{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
  }

  function summarize(rows,seed,bootstrapB=500){
    const defs=[
      ...LAMBDAS.map(lambda=>({id:String(lambda),lambda,kind:'eco'})),
      {id:'eta-greedy',kind:'eta'},
      {id:'distance-greedy',kind:'distance'}
    ];
    const value=(row,p)=>p.kind==='eco'?row.policies.find(x=>x.lambda===p.lambda):p.kind==='eta'?row.etaGreedy:row.distanceGreedy;
    return defs.map(p=>{
      const vals=rows.map(r=>value(r,p)),zero=rows.map(r=>r.policies.find(x=>x.lambda===0));
      const absolute=Object.fromEntries(METRICS.map(k=>[k,stats(vals.map(v=>v[k]))]));
      const versusZero=Object.fromEntries(METRICS.map(k=>{
        const diffs=vals.map((v,i)=>Number.isFinite(v[k])&&Number.isFinite(zero[i][k])?v[k]-zero[i][k]:null);
        const normal=stats(diffs),bootstrap=A.bootstrapCI(diffs,seed+'|real-routing|'+p.id+'|'+k,bootstrapB);
        return[k,{...normal,bootstrap}];
      }));
      return{...p,absolute,versusZero};
    });
  }

  function finish(config,routing,setupState,seed,rows,{harmK=10,bootstrapB=500}={}){
    return{
      version:'1.0',
      benchmark:'real-routing-exploratory',
      seed,n:rows.length,harmK,bootstrapB,
      dataset:{
        id:routing.dataset,
        generatedAt:routing.generated_at_utc,
        routingProfile:routing.scope.routing_profile,
        source:routing.source,
        eligibleDemand:setupState.demand.map(x=>x.nodeId),
        excludedDemand:setupState.excluded,
        placement:{bases:setupState.placement.bases,objectiveRiskWeightedMinutes:setupState.placement.objective}
      },
      assumptions:{
        risk:'synthetic v0.x weights',
        incidents:'synthetic, sampled only on eligible demand nodes',
        roadMovement:'OSRM driving duration/distance matrix',
        droneMovement:'geodesic direct flight at configured drone speed',
        strictCapabilities:{brigade:['fire'],ambulance:['medical'],drone:['drone'],utility:['medical','drone']},
        deadlinesMinutes:DEADLINES,
        serviceDuration:'zero / instantaneous availability after each sequential incident',
        claimScope:'exploratory real-routing benchmark; not real-world efficacy'
      },
      lambdas:[...LAMBDAS],
      rows,
      summary:summarize(rows,seed,bootstrapB)
    };
  }

  function csv(result){
    const cols=['policy',...METRICS.flatMap(k=>[k,'delta_'+k,'bootstrap_low_'+k,'bootstrap_high_'+k])];
    const lines=[cols];
    for(const p of result.summary){
      const row=[p.id];
      for(const k of METRICS){
        row.push(p.absolute[k].mean,p.versusZero[k].mean,p.versusZero[k].bootstrap.ciLow,p.versusZero[k].bootstrap.ciHigh);
      }
      lines.push(row);
    }
    const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return lines.map(r=>r.map(q).join(',')).join('\r\n');
  }

  globalThis.EcoDispatchRealRouting={
    TYPE_PROBS,DEADLINES,LAMBDAS,METRICS,
    setup,placement,movement,evaluate,generateDay,simulate,scenario,summarize,finish,csv,
    demandSet,excludedDemand
  };
})();