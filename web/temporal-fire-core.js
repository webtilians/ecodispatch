/* EcoDispatch v1.5 — exploratory temporal fire operations. Historical engines remain frozen. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const A=globalThis.EcoDispatchAblation;
  const DATASET='aemet-fire-snapshots-v1.4';
  const LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  const METRICS=Object.freeze([
    'eventCount','served','unserved','coverage',
    'meanResponseDelay','p95ResponseDelay','meanTravelEta','meanWait','p95Wait',
    'distance','co2Kg','totalHarm','arrivalsAllBusy','arrivalsAnyBusy','waitedServed',
    'maxQueue','utilizationMean','utilF01','utilF02','utilF03',
    'free0Share','free1Share','free2Share','free3Share'
  ]);
  const EPS=1e-9;

  function setup(protocol,routing,catalog,snapshotId,regimeId){
    if(protocol.version!=='1.5'||protocol.confirmatory!==false||catalog.dataset!==DATASET)throw Error('Protocol/dataset mismatch');
    if(routing.dataset!==catalog.routing.dataset)throw Error('Routing identity mismatch');
    if(JSON.stringify(protocol.policies.lambdas)!==JSON.stringify(LAMBDAS))throw Error('Lambda mismatch');
    if(protocol.service_minutes<=0||protocol.deadline_min<=0||protocol.horizon_minutes<=0)throw Error('Temporal protocol invalid');
    if(!protocol.frozen_inputs.snapshot_ids.includes(snapshotId))throw Error('Snapshot not frozen');
    const snapshot=catalog.candidates.find(x=>x.id===snapshotId);if(!snapshot)throw Error('Missing snapshot');
    const regime=protocol.arrival_process.regimes.find(x=>x.id===regimeId);if(!regime)throw Error('Missing load regime');
    const idx=Object.fromEntries(routing.points.map((p,i)=>[p.id,i]));
    const eligible=routing.points.filter(p=>p.id.startsWith('D')&&p.snap_distance_m<=500);
    if(eligible.length!==10||JSON.stringify(eligible.map(p=>p.id))!==JSON.stringify(snapshot.nodes.map(n=>n.id)))throw Error('Eligible nodes mismatch');
    const demand=snapshot.nodes.map((n,i)=>{
      const p=eligible[i];
      if(n.longitude!==p.input_lon||n.latitude!==p.input_lat)throw Error('Coordinate mismatch');
      if(!Number.isInteger(n.source_value)||n.source_value<1||n.source_value>6||n.hazard_weight!==n.source_value)throw Error('Invalid AEMET class');
      return {...n,nodeId:n.id};
    });
    const resources=protocol.frozen_inputs.fleet.map(r=>{
      if(!(r.station in idx)||JSON.stringify(r.capabilities)!=='["fire"]'||!Number.isFinite(r.co2_g_per_km)||r.co2_g_per_km<0)throw Error('Invalid modeled brigade');
      return {...r,nodeId:r.station};
    });
    if(resources.length!==3||new Set(resources.map(r=>r.name)).size!==3)throw Error('Exactly three unique brigades required');
    for(const matrix of [routing.durations_s,routing.distances_m]){
      if(matrix.length!==routing.points.length||matrix.some(row=>row.length!==matrix.length||row.some(v=>!Number.isFinite(v)||v<0)))throw Error('Invalid road matrix');
    }
    return {protocol,routing,catalog,snapshot,regime,idx,demand,resources};
  }

  function movement(state,fromId,toId){
    const i=state.idx[fromId],j=state.idx[toId];
    return {eta:state.routing.durations_s[i][j]/60,distance:state.routing.distances_m[i][j]/1000};
  }

  function eventsFor(state,scenarioSeed){
    const rng=E.mulberry32(E.hashString(scenarioSeed));
    const rate=state.regime.events_per_24h/state.protocol.horizon_minutes;
    const events=[];let t=0,i=0;
    while(true){
      const u=Math.min(1-EPS,Math.max(EPS,rng()));
      t+=-Math.log(1-u)/rate;
      if(t>=state.protocol.horizon_minutes)break;
      const node=state.demand[Math.min(state.demand.length-1,Math.floor(rng()*state.demand.length))];
      events.push({
        index:i,name:'T'+String(i+1).padStart(3,'0'),type:'fire',nodeId:node.id,
        arrival_min:t,severity:2+3*rng(),deadline_min:state.protocol.deadline_min
      });i++;
    }
    return events;
  }

  function potential(state,resources,t){
    let total=0;
    for(const node of state.demand){
      let best=Infinity;
      for(const r of resources){
        const releaseDelay=Math.max(0,r.availableAt-t);
        const eta=movement(state,r.nodeId,node.id).eta;
        best=Math.min(best,releaseDelay+eta);
      }
      total+=node.source_value*best;
    }
    return total;
  }

  function candidate(state,resources,event,t,ri,policy,lambda){
    const r=resources[ri];
    if(r.availableAt>t+EPS)return null;
    const m=movement(state,r.nodeId,event.nodeId);
    const wait=Math.max(0,t-event.arrival_min);
    const responseDelay=wait+m.eta;
    if(responseDelay>event.deadline_min+EPS)return null;
    const emissionsG=r.co2_g_per_km*m.distance;
    let score=policy==='distance-greedy'?m.distance:responseDelay;
    let phiBefore=null,phiAfter=null;
    if(policy==='eco'){
      const immediate=event.severity*responseDelay+.0005*emissionsG+.05*m.distance;
      if(lambda>0){
        phiBefore=potential(state,resources,t);
        const next=resources.map(x=>({...x}));
        next[ri].availableAt=t+m.eta+state.protocol.service_minutes;
        next[ri].nodeId=event.nodeId;
        phiAfter=potential(state,next,t);
      }
      score=immediate+(lambda>0?lambda*(phiAfter-phiBefore):0);
    }
    return {ri,score,eta:m.eta,distance:m.distance,emissionsG,wait,responseDelay,phiBefore,phiAfter};
  }

  function choose(state,resources,event,t,policy,lambda){
    let best=null;
    for(let ri=0;ri<resources.length;ri++){
      const c=candidate(state,resources,event,t,ri,policy,lambda);
      if(c&&(!best||c.score<best.score-EPS))best=c;
    }
    return best;
  }

  function percentile(sorted,p){
    if(!sorted.length)return null;
    return sorted[Math.min(sorted.length-1,Math.floor(p*(sorted.length-1)))];
  }

  function freeStateShares(resources,horizon){
    const points=new Set([0,horizon]);
    const clipped=resources.flatMap(r=>r.intervals.map(([a,b])=>[Math.max(0,Math.min(horizon,a)),Math.max(0,Math.min(horizon,b))]));
    for(const [a,b] of clipped){points.add(a);points.add(b);}
    const xs=[...points].sort((a,b)=>a-b),dur=[0,0,0,0];
    for(let i=0;i<xs.length-1;i++){
      const a=xs[i],b=xs[i+1];if(b<=a)continue;
      const mid=(a+b)/2;
      const busy=clipped.reduce((s,[x,y])=>s+Number(mid>=x-EPS&&mid<y-EPS),0);
      dur[resources.length-busy]+=b-a;
    }
    return dur.map(x=>x/horizon);
  }

  function simulate(state,events,policy,lambda=0,options={}){
    if(!['eco','eta-greedy','distance-greedy'].includes(policy))throw Error('Invalid policy');
    const resources=state.resources.map(r=>({...r,nodeId:r.station,availableAt:0,intervals:[]}));
    const queue=[],dispatch=Array(events.length).fill(null),response=[],travel=[],waits=[],trace=options.trace?[]:null;
    let nextArrival=0,t=0,served=0,unserved=0,distance=0,co2G=0,totalHarm=0;
    let arrivalsAllBusy=0,arrivalsAnyBusy=0,waitedServed=0,maxQueue=0;
    const expireAt=e=>e.arrival_min+e.deadline_min;

    while(nextArrival<events.length||queue.length){
      let nextTime;
      if(queue.length===0){
        nextTime=nextArrival<events.length?events[nextArrival].arrival_min:Infinity;
      }else{
        const arrival=nextArrival<events.length?events[nextArrival].arrival_min:Infinity;
        const release=Math.min(...resources.map(r=>r.availableAt>t+EPS?r.availableAt:Infinity));
        const expiry=Math.min(...queue.map(expireAt));
        nextTime=Math.min(arrival,release,expiry);
      }
      if(!Number.isFinite(nextTime))break;
      if(nextTime<t-EPS)throw Error('Non-monotone simulation clock');
      t=nextTime;

      while(nextArrival<events.length&&events[nextArrival].arrival_min<=t+EPS){
        const e=events[nextArrival++];
        const busy=resources.filter(r=>r.availableAt>e.arrival_min+EPS).length;
        arrivalsAllBusy+=Number(busy===resources.length);
        arrivalsAnyBusy+=Number(busy>0);
        queue.push(e);maxQueue=Math.max(maxQueue,queue.length);
      }

      let progressed=true;
      while(progressed){
        progressed=false;
        if(!resources.some(r=>r.availableAt<=t+EPS))break;
        for(let qi=0;qi<queue.length;qi++){
          const e=queue[qi],best=choose(state,resources,e,t,policy,lambda);
          if(!best)continue;
          const r=resources[best.ri];
          const release=t+best.eta+state.protocol.service_minutes;
          if(release<r.availableAt-EPS)throw Error('Availability regression');
          const priorAvailableAt=r.availableAt;
          r.intervals.push([t,release]);r.availableAt=release;r.nodeId=e.nodeId;
          dispatch[e.index]=r.name;
          if(trace)trace.push({eventIndex:e.index,event:e.name,brigade:r.name,arrival:e.arrival_min,dispatchTime:t,travelEta:best.eta,wait:best.wait,responseDelay:best.responseDelay,priorAvailableAt,releaseTime:release,nodeId:e.nodeId});
          queue.splice(qi,1);
          served++;distance+=best.distance;co2G+=best.emissionsG;
          totalHarm+=e.severity*best.responseDelay;
          response.push(best.responseDelay);travel.push(best.eta);waits.push(best.wait);
          waitedServed+=Number(best.wait>EPS);
          progressed=true;break;
        }
      }

      for(let qi=queue.length-1;qi>=0;qi--){
        if(expireAt(queue[qi])<=t+EPS){
          const e=queue[qi];queue.splice(qi,1);unserved++;
          totalHarm+=state.protocol.harm.k_unserved*e.severity*e.severity;
        }
      }
      maxQueue=Math.max(maxQueue,queue.length);
    }

    if(served+unserved!==events.length)throw Error('Unresolved incidents');
    for(const r of resources){
      for(let i=1;i<r.intervals.length;i++)if(r.intervals[i][0]<r.intervals[i-1][1]-EPS)throw Error('Brigade overlap');
    }
    const horizon=state.protocol.horizon_minutes;
    const util=resources.map(r=>r.intervals.reduce((s,[a,b])=>s+Math.max(0,Math.min(horizon,b)-Math.max(0,a)),0)/horizon);
    const free=freeStateShares(resources,horizon);
    response.sort((a,b)=>a-b);travel.sort((a,b)=>a-b);waits.sort((a,b)=>a-b);
    return {
      eventCount:events.length,served,unserved,coverage:events.length?served/events.length:1,
      meanResponseDelay:response.length?response.reduce((a,b)=>a+b,0)/response.length:null,
      p95ResponseDelay:percentile(response,.95),
      meanTravelEta:travel.length?travel.reduce((a,b)=>a+b,0)/travel.length:null,
      meanWait:waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:null,
      p95Wait:percentile(waits,.95),
      distance,co2Kg:co2G/1000,totalHarm,arrivalsAllBusy,arrivalsAnyBusy,waitedServed,maxQueue,
      utilizationMean:util.reduce((a,b)=>a+b,0)/util.length,
      utilF01:util[0],utilF02:util[1],utilF03:util[2],
      free0Share:free[0],free1Share:free[1],free2Share:free[2],free3Share:free[3],
      dispatch,...(trace?{trace}:{})
    };
  }

  function scenario(state,index){
    const seed=state.protocol.simulation.seed+'|snapshot|'+state.snapshot.id+'|load|'+state.regime.id+'|day|'+index;
    const events=eventsFor(state,seed);
    const run=(policy,lambda=0)=>simulate(state,events,policy,lambda);
    return {index,scenarioSeed:seed,events,
      policies:LAMBDAS.map(lambda=>({lambda,...run('eco',lambda)})),
      etaGreedy:run('eta-greedy'),distanceGreedy:run('distance-greedy')};
  }

  function stats(values){
    const valid=values.filter(Number.isFinite);
    return valid.length?{...E.describe(valid),missing:values.length-valid.length}:{n:0,missing:values.length,mean:null,sd:null,ciLow:null,ciHigh:null};
  }

  function summarize(rows,seed,bootstrapB){
    const defs=[...LAMBDAS.map(lambda=>({id:String(lambda),lambda,kind:'eco'})),{id:'eta-greedy',kind:'eta'},{id:'distance-greedy',kind:'distance'}];
    const value=(row,p)=>p.kind==='eco'?row.policies.find(x=>x.lambda===p.lambda):p.kind==='eta'?row.etaGreedy:row.distanceGreedy;
    return defs.map(p=>{
      const vals=rows.map(r=>value(r,p)),zero=rows.map(r=>r.policies[0]);
      const absolute=Object.fromEntries(METRICS.map(k=>[k,stats(vals.map(v=>v[k]))]));
      const versusZero=Object.fromEntries(METRICS.map(k=>{
        const diffs=vals.map((v,i)=>Number.isFinite(v[k])&&Number.isFinite(zero[i][k])?v[k]-zero[i][k]:null);
        return [k,{...stats(diffs),bootstrap:A.bootstrapCI(diffs,seed+'|'+p.id+'|'+k,bootstrapB)}];
      }));
      return {...p,absolute,versusZero};
    });
  }

  globalThis.EcoDispatchTemporalFire={DATASET,LAMBDAS,METRICS,setup,movement,eventsFor,potential,simulate,scenario,summarize};
})();