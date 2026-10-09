/* EcoDispatch v1.7.1 — replay observed EGIF time/location on the frozen v1.6 policy family. */
(()=>{
  const E=globalThis.EcoDispatchEngine;
  const LAMBDAS=Object.freeze([0,.2,.35,.5,1]);
  const POLICY_DEFS=Object.freeze([
    ...LAMBDAS.map(lambda=>({id:String(lambda),kind:'eco',lambda})),
    {id:'eta-greedy',kind:'eta'},
    {id:'distance-greedy',kind:'distance'}
  ]);
  const OPS=Object.freeze([
    'eventCount','served','unserved','coverage',
    'meanResponseDelay','p95ResponseDelay','meanTravelEta','meanWait','p95Wait',
    'distance','co2Kg','arrivalsAllBusy','arrivalsAnyBusy','waitedServed',
    'maxQueue','utilizationMean','free0Share','free1Share','free2Share','free3Share'
  ]);
  const EPS=1e-9;

  const routeKey=(a,b)=>a+'>'+b;

  function severityFor(incidentId,seed){
    const rng=E.mulberry32(E.hashString(seed+'|'+incidentId));
    return 2+3*rng();
  }

  function dateRange(start,end){
    const out=[];
    let d=new Date(start+'T00:00:00Z'),last=new Date(end+'T00:00:00Z');
    while(d<=last){
      out.push(d.toISOString().slice(0,10));
      d=new Date(d.getTime()+86400000);
    }
    return out;
  }

  function observedDays(protocol,realFire,freeze){
    if(protocol.version!=='1.7.1')throw Error('Historical protocol mismatch');
    if(!Array.isArray(realFire?.incidents))throw Error('Missing real-fire incidents');
    const [startYear,endYear]=protocol.cohort.years;
    const candidates=realFire.incidents.filter(r=>{
      const y=Number(r.source_year);
      return y>=startYear&&y<=endYear;
    });
    if(candidates.length!==freeze.counts.candidate_parts)throw Error('Historical candidate count mismatch');

    const events=[],exclusions=[];
    for(const row of candidates){
      if(row.coordinate_flag!==protocol.cohort.required_coordinate_flag||
         !Number.isFinite(row.latitude)||!Number.isFinite(row.longitude))
        throw Error('Modern cohort coordinate invariant failed: '+row.incident_id);
      if(typeof row.detected_at!=='string')throw Error('Missing detection: '+row.incident_id);
      const year=Number(row.source_year);
      if(Number(row.detected_at.slice(0,4))!==year)throw Error('Detection/source-year mismatch');
      const flag=row.timestamp_flags?.detected_at;
      if(flag!==protocol.cohort.required_detection_flag){
        exclusions.push({incident_id:row.incident_id,detected_at:row.detected_at,source_flag:flag});
        continue;
      }
      const h=Number(row.detected_at.slice(11,13));
      const m=Number(row.detected_at.slice(14,16));
      const s=Number(row.detected_at.slice(17,19));
      const arrival=h*60+m+s/60;
      if(!Number.isFinite(arrival)||arrival<0||arrival>=1440)throw Error('Invalid arrival');
      events.push({
        incidentId:row.incident_id,
        date:row.detected_at.slice(0,10),
        year,
        detectedAt:row.detected_at,
        arrival_min:arrival,
        latitude:row.latitude,
        longitude:row.longitude,
        severity:severityFor(row.incident_id,protocol.severity.seed),
        deadline_min:protocol.deadline_min
      });
    }
    events.sort((a,b)=>a.detectedAt.localeCompare(b.detectedAt)||a.incidentId.localeCompare(b.incidentId));
    exclusions.sort((a,b)=>a.detected_at.localeCompare(b.detected_at)||a.incident_id.localeCompare(b.incident_id));
    if(events.length!==freeze.counts.primary_events)throw Error('Primary historical event count mismatch');
    if(JSON.stringify(exclusions)!==JSON.stringify(freeze.exclusions))throw Error('Historical exclusion set mismatch');

    const byDate=new Map();
    for(const e of events){
      if(!byDate.has(e.date))byDate.set(e.date,[]);
      byDate.get(e.date).push(e);
    }
    const days=dateRange(protocol.historical_days.calendar_start,protocol.historical_days.calendar_end).map(date=>{
      const xs=(byDate.get(date)||[]).map((e,index)=>({
        ...e,index,nodeId:e.incidentId,name:e.incidentId,type:'fire'
      }));
      return {date,year:Number(date.slice(0,4)),events:xs};
    });
    if(days.length!==freeze.counts.calendar_days)throw Error('Calendar day count mismatch');
    if(days.filter(d=>d.events.length).length!==freeze.counts.active_fire_days)throw Error('Active day count mismatch');
    return {events,days,exclusions};
  }

  function routeMaps(historicalRouting){
    const maps={
      baseToEvent:new Map(),
      eventToPotential:new Map(),
      eventToEvent:new Map()
    };
    const add=(map,rows)=>{
      for(const row of rows){
        if(!Array.isArray(row)||row.length!==4||!Number.isFinite(row[2])||!Number.isFinite(row[3]))throw Error('Bad sparse route row');
        map.set(routeKey(row[0],row[1]),{eta:row[2]/60,distance:row[3]/1000});
      }
    };
    add(maps.baseToEvent,historicalRouting.routes.base_to_event);
    add(maps.eventToPotential,historicalRouting.routes.event_to_potential);
    add(maps.eventToEvent,historicalRouting.routes.event_to_event_same_day);
    return maps;
  }

  function setup(protocol,temporalProtocol,staticRouting,historicalRouting,catalog,snapshotId,realFire,freeze){
    if(protocol.version!=='1.7.1'||temporalProtocol.version!=='1.5')throw Error('Version mismatch');
    if(JSON.stringify(protocol.policies.lambdas)!==JSON.stringify(LAMBDAS))throw Error('Lambda mismatch');
    if(JSON.stringify(protocol.service_minutes)!=='[45,90,180]')throw Error('Service sensitivity changed');
    if(historicalRouting.version!=='1.7.1'||historicalRouting.inputs.primary_events!==freeze.counts.primary_events)throw Error('Historical routing mismatch');
    const idx=Object.fromEntries(staticRouting.points.map((p,i)=>[p.id,i]));
    const potentialIds=staticRouting.points.filter(p=>p.role==='demand_node'&&p.snap_distance_m<=500).map(p=>p.id);
    if(potentialIds.length!==10||JSON.stringify(potentialIds)!==JSON.stringify(historicalRouting.inputs.potential_nodes))throw Error('Potential-node mismatch');
    const snapshot=catalog.candidates.find(x=>x.id===snapshotId);
    if(!snapshot||snapshot.nodes.length!==10)throw Error('Missing hazard context');
    if(JSON.stringify(snapshot.nodes.map(n=>n.id))!==JSON.stringify(potentialIds))throw Error('Hazard/potential order mismatch');
    const potential=snapshot.nodes.map(n=>{
      if(!Number.isInteger(n.source_value)||n.source_value<1||n.source_value>6||n.hazard_weight!==n.source_value)throw Error('Invalid AEMET class');
      return {nodeId:n.id,weight:n.source_value};
    });
    const resources=temporalProtocol.frozen_inputs.fleet.map(r=>({
      ...r,nodeId:r.station
    }));
    if(resources.length!==3||JSON.stringify(resources.map(r=>r.station))!=='["B2","B3","B4"]')throw Error('Fleet changed');
    const observed=observedDays(protocol,realFire,freeze);
    return {
      protocol,temporalProtocol,staticRouting,historicalRouting,catalog,snapshot,
      idx,potential,resources,observed,routes:routeMaps(historicalRouting)
    };
  }

  function staticMovement(state,fromId,toId){
    const i=state.idx[fromId],j=state.idx[toId];
    if(i===undefined||j===undefined)throw Error('Static route point missing: '+fromId+'>'+toId);
    const duration=state.staticRouting.durations_s[i][j],distance=state.staticRouting.distances_m[i][j];
    if(!Number.isFinite(duration)||!Number.isFinite(distance))throw Error('Static route invalid');
    return {eta:duration/60,distance:distance/1000};
  }

  function movementToEvent(state,fromId,eventId){
    const map=fromId.startsWith('B')?state.routes.baseToEvent:state.routes.eventToEvent;
    const found=map.get(routeKey(fromId,eventId));
    if(!found)throw Error('Historical route missing: '+fromId+'>'+eventId);
    return found;
  }

  function movementToPotential(state,fromId,nodeId){
    if(fromId.startsWith('B'))return staticMovement(state,fromId,nodeId);
    const found=state.routes.eventToPotential.get(routeKey(fromId,nodeId));
    if(!found)throw Error('Historical potential route missing: '+fromId+'>'+nodeId);
    return found;
  }

  function potential(state,resources,t){
    let total=0;
    for(const node of state.potential){
      let best=Infinity;
      for(const r of resources){
        const releaseDelay=Math.max(0,r.availableAt-t);
        const eta=movementToPotential(state,r.nodeId,node.nodeId).eta;
        best=Math.min(best,releaseDelay+eta);
      }
      total+=node.weight*best;
    }
    return total;
  }

  function candidate(state,resources,event,t,ri,policy,lambda,serviceMinutes){
    const r=resources[ri];
    if(r.availableAt>t+EPS)return null;
    const m=movementToEvent(state,r.nodeId,event.nodeId);
    const wait=Math.max(0,t-event.arrival_min);
    const responseDelay=wait+m.eta;
    if(responseDelay>event.deadline_min+EPS)return null;
    const emissionsG=r.co2_g_per_km*m.distance;
    let score=policy==='distance-greedy'?m.distance:responseDelay;
    if(policy==='eco'){
      const immediate=event.severity*responseDelay+.0005*emissionsG+.05*m.distance;
      let delta=0;
      if(lambda>0){
        const before=potential(state,resources,t);
        const next=resources.map(x=>({...x}));
        next[ri].availableAt=t+m.eta+serviceMinutes;
        next[ri].nodeId=event.nodeId;
        delta=potential(state,next,t)-before;
      }
      score=immediate+lambda*delta;
    }
    return {ri,score,eta:m.eta,distance:m.distance,emissionsG,wait,responseDelay};
  }

  function choose(state,resources,event,t,policy,lambda,serviceMinutes){
    let best=null;
    for(let ri=0;ri<resources.length;ri++){
      const c=candidate(state,resources,event,t,ri,policy,lambda,serviceMinutes);
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

  function simulate(state,events,policy,lambda=0,serviceMinutes=90){
    if(!['eco','eta-greedy','distance-greedy'].includes(policy))throw Error('Invalid policy');
    if(!state.protocol.service_minutes.includes(serviceMinutes))throw Error('Unfrozen service time');
    const resources=state.resources.map(r=>({...r,nodeId:r.station,availableAt:0,intervals:[]}));
    const queue=[],dispatch=Array(events.length).fill(null),response=[],travel=[],waits=[];
    let nextArrival=0,t=0,served=0,unserved=0,distance=0,co2G=0;
    let servedSeverityDelay=0,unservedSeveritySq=0;
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
          const e=queue[qi],best=choose(state,resources,e,t,policy,lambda,serviceMinutes);
          if(!best)continue;
          const r=resources[best.ri],release=t+best.eta+serviceMinutes;
          r.intervals.push([t,release]);r.availableAt=release;r.nodeId=e.nodeId;
          dispatch[e.index]=r.name;
          queue.splice(qi,1);
          served++;distance+=best.distance;co2G+=best.emissionsG;
          servedSeverityDelay+=e.severity*best.responseDelay;
          response.push(best.responseDelay);travel.push(best.eta);waits.push(best.wait);
          waitedServed+=Number(best.wait>EPS);
          progressed=true;break;
        }
      }

      for(let qi=queue.length-1;qi>=0;qi--){
        if(expireAt(queue[qi])<=t+EPS){
          const e=queue[qi];queue.splice(qi,1);unserved++;
          unservedSeveritySq+=e.severity*e.severity;
        }
      }
      maxQueue=Math.max(maxQueue,queue.length);
    }

    if(served+unserved!==events.length)throw Error('Unresolved incidents');
    for(const r of resources)for(let i=1;i<r.intervals.length;i++)if(r.intervals[i][0]<r.intervals[i-1][1]-EPS)throw Error('Brigade overlap');
    const horizon=1440;
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
      distance,co2Kg:co2G/1000,arrivalsAllBusy,arrivalsAnyBusy,waitedServed,maxQueue,
      utilizationMean:util.reduce((a,b)=>a+b,0)/util.length,
      free0Share:free[0],free1Share:free[1],free2Share:free[2],free3Share:free[3],
      servedSeverityDelay,unservedSeveritySq,dispatch
    };
  }

  function scenario(state,events,serviceMinutes){
    return Object.fromEntries(POLICY_DEFS.map(def=>[
      def.id,
      def.kind==='eco'
        ?simulate(state,events,'eco',def.lambda,serviceMinutes)
        :simulate(state,events,def.kind==='eta'?'eta-greedy':'distance-greedy',0,serviceMinutes)
    ]));
  }

  function totalHarm(result,k){return result.servedSeverityDelay+k*result.unservedSeveritySq;}

  globalThis.EcoDispatchHistoricalDemand={
    LAMBDAS,POLICY_DEFS,OPS,severityFor,observedDays,setup,
    movementToEvent,movementToPotential,potential,simulate,scenario,totalHarm
  };
})();