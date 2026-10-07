(()=> {
  const NS="http://www.w3.org/2000/svg";
  const TYPE_INFO={
    medical:{icon:"🩺",es:"Médica",en:"Medical"},
    fire:{icon:"🔥",es:"Incendio",en:"Fire"},
    drone:{icon:"🔭",es:"Reconocimiento",en:"Recon"}
  };
  const TYPE_PROBS={medical:.35,fire:.4,drone:.25};

  class ResearchSuite{
    constructor(data){
      this.data=data;
      this.seedInput=document.getElementById("research-seed");
      this.profileInput=document.getElementById("research-profile");
      this.geoCandidates=data.candidates.map(x=>({...x,geo:projectPoint(data,x.point)}));
      this.geoDemand=data.demand.map(x=>({...x,geo:projectPoint(data,x.point)}));
      this.results=null;
      document.getElementById("run-suite").addEventListener("click",()=>this.run());
      window.addEventListener("languagechange",()=>this.renderAll());
      this.run();
    }

    run(){
      const seed=this.seedInput.value.trim()||"open-research-05";
      const profile=this.profileInput.value;
      const placement=this.runPlacement();
      const resources=this.makeResources(placement.selected);
      const crisis=this.runCrisis(seed,profile,resources);
      const day=this.runDay(seed,profile,resources);
      this.results={seed,profile,placement,crisis,day};
      this.renderAll();
    }

    runPlacement(){
      const combos=combinations(this.geoCandidates,this.data.research?.placement_k||3);
      const scored=combos.map(set=>({set,objective:placementObjective(this.geoDemand,set)}));
      scored.sort((a,b)=>a.objective-b.objective);
      const best=scored[0];
      const avg=scored.reduce((s,x)=>s+x.objective,0)/scored.length;
      return{
        selected:best.set.map(x=>x.name),
        selectedNodes:best.set,
        objective:best.objective,
        averageObjective:avg,
        worstObjective:scored[scored.length-1].objective,
        improvement:(1-best.objective/avg)*100,
        combinations:scored.length
      };
    }

    makeResources(selected){
      const byName=Object.fromEntries(this.geoCandidates.map(x=>[x.name,x.geo]));
      const starts=[byName[selected[0]],byName[selected[0]],byName[selected[1]],byName[selected[2]]];
      return this.data.resources.map((r,i)=>({...r,point:[...starts[i]]}));
    }

    runCrisis(seed,profile,resources){
      const tries=profile==="stress"?220:1;
      let best=null;
      for(let attempt=0;attempt<tries;attempt++){
        const rng=mulberry32(hashString(seed+"|crisis|"+attempt));
        const events=generateCrisisBatch(this.data,this.geoDemand,this.data.research?.crisis_incidents||6,rng);
        const greedy=greedyBatch(resources,events);
        const eco=optimalBatch(resources,events);
        const severityGap=eco.severityCovered-greedy.severityCovered;
        const coverageGap=eco.served-greedy.served;
        const costGain=Math.abs(severityGap)<1e-9&&eco.served===greedy.served&&greedy.cost>0?(1-eco.cost/greedy.cost)*100:0;
        const score=severityGap*100+coverageGap*20+costGain;
        const candidate={events,greedy,eco,attempt,severityGap,coverageGap,costGain,score};
        if(!best||candidate.score>best.score)best=candidate;
        if(profile==="stress"&&(severityGap>=1||coverageGap>=1||costGain>=20)){best=candidate;break;}
      }
      return best;
    }

    runDay(seed,profile,resources){
      const tries=profile==="stress"?60:1;
      let best=null;
      for(let attempt=0;attempt<tries;attempt++){
        const rng=mulberry32(hashString(seed+"|day|"+attempt));
        const events=generateDay(this.data,this.geoDemand,this.data.research?.day_incidents||120,rng);
        const greedy=simulateDay(this.geoDemand,resources,events,"greedy",this.data.research?.online_lambda||.35);
        const eco=simulateDay(this.geoDemand,resources,events,"eco",this.data.research?.online_lambda||.35);
        const coverageGap=eco.served-greedy.served;
        const etaGain=greedy.meanEta>0?(1-eco.meanEta/greedy.meanEta)*100:0;
        const harmGain=greedy.severityDelay>0?(1-eco.severityDelay/greedy.severityDelay)*100:0;
        const score=coverageGap*100+Math.max(0,etaGain)+Math.max(0,harmGain)*.25;
        const candidate={events,greedy,eco,attempt,coverageGap,etaGain,harmGain,score};
        if(!best||candidate.score>best.score)best=candidate;
        if(profile==="stress"&&(coverageGap>=2||(coverageGap>=0&&etaGain>=7))){best=candidate;break;}
      }
      return best;
    }

    renderAll(){
      if(!this.results)return;
      const {seed,profile,placement,crisis,day}=this.results;
      document.getElementById("summary-placement").textContent="-"+placement.improvement.toFixed(1)+"%";
      document.getElementById("summary-crisis").textContent=(crisis.coverageGap>=0?"+":"")+crisis.coverageGap;
      document.getElementById("summary-day").textContent=(day.coverageGap>=0?"+":"")+day.coverageGap;
      document.getElementById("summary-seed").textContent=seed;

      this.renderPlacement(placement);
      this.renderCrisis(crisis,profile);
      this.renderDay(day,profile);
    }

    renderPlacement(r){
      document.getElementById("placement-improvement").textContent="-"+r.improvement.toFixed(1)+"%";
      document.getElementById("placement-opt").textContent=r.objective.toFixed(1);
      document.getElementById("placement-avg").textContent=r.averageObjective.toFixed(1);
      document.getElementById("placement-bases").textContent=r.selected.join(" · ");
      drawBaseMap(document.getElementById("placement-map"),this.data,this.geoDemand,this.geoCandidates,new Set(r.selected));
    }

    renderCrisis(r,profile){
      document.getElementById("crisis-stress-banner").hidden=profile!=="stress";
      document.getElementById("crisis-greedy-cover").textContent=r.greedy.served+"/"+r.events.length;
      document.getElementById("crisis-eco-cover").textContent=r.eco.served+"/"+r.events.length;
      document.getElementById("crisis-delta").textContent=r.coverageGap>0?"+"+r.coverageGap:I18N.t("dynamic.sameCoverage");
      document.getElementById("crisis-greedy-cost").textContent=r.greedy.cost.toFixed(1);
      document.getElementById("crisis-eco-cost").textContent=r.eco.cost.toFixed(1);
      document.getElementById("crisis-story").textContent=r.severityGap>1e-9
        ? I18N.t("dynamic.crisisStorySeverity",{delta:r.severityGap.toFixed(1),eco:r.eco.severityCovered.toFixed(1),greedy:r.greedy.severityCovered.toFixed(1)})
        : r.coverageGap>0
          ? I18N.t("dynamic.crisisStoryMore",{eco:r.eco.served,total:r.events.length,greedy:r.greedy.served})
          : I18N.t("dynamic.crisisStoryCost",{served:r.eco.served,pct:Math.max(0,r.costGain).toFixed(1)});
      drawCrisisMap(document.getElementById("crisis-map"),this.data,this.geoDemand,this.geoCandidates,this.makeResources(this.results.placement.selected),r);
      this.renderAssignments(r);
    }

    renderAssignments(r){
      const root=document.getElementById("crisis-assignments");
      root.innerHTML="";
      const gByIncident=Object.fromEntries(r.greedy.assignments.map(a=>[a.incidentIndex,a]));
      const eByIncident=Object.fromEntries(r.eco.assignments.map(a=>[a.incidentIndex,a]));
      r.events.forEach((event,i)=>{
        const row=document.createElement("div");
        row.className="assignment-row";
        const g=gByIncident[i],e=eByIncident[i],info=typeInfo(event.type);
        row.innerHTML=`
          <span class="assignment-event">${info.icon} ${event.name}</span>
          <span class="assignment-greedy">G: ${g?escapeHtml(resourceLabel(g.resource)):"—"}</span>
          <span class="assignment-eco">E: ${e?escapeHtml(resourceLabel(e.resource)):"—"}</span>`;
        root.appendChild(row);
      });
    }

    renderDay(r,profile){
      document.getElementById("day-stress-banner").hidden=profile!=="stress";
      document.getElementById("day-cover-delta").textContent=(r.coverageGap>=0?"+":"")+r.coverageGap;
      document.getElementById("day-eco-served").textContent=r.eco.served+"/"+r.events.length;
      document.getElementById("day-greedy-served").textContent=r.greedy.served+"/"+r.events.length;
      document.getElementById("day-eco-eta").textContent=I18N.t("dynamic.eta",{eta:r.eco.meanEta.toFixed(1)});
      document.getElementById("day-greedy-eta").textContent=I18N.t("dynamic.eta",{eta:r.greedy.meanEta.toFixed(1)});
      document.getElementById("day-story").textContent=r.coverageGap>0
        ? I18N.t("dynamic.dayMore",{n:r.coverageGap})
        : I18N.t("dynamic.daySame",{n:r.eco.served,pct:r.etaGain.toFixed(1)});

      renderRaceBars("day-coverage-bars",r.eco.served,r.greedy.served,r.events.length,v=>v.toFixed(0));
      renderRaceBars("day-eta-bars",r.eco.meanEta,r.greedy.meanEta,Math.max(r.eco.meanEta,r.greedy.meanEta),v=>v.toFixed(1)+" min",true);
      renderRaceBars("day-p95-bars",r.eco.p95Eta,r.greedy.p95Eta,Math.max(r.eco.p95Eta,r.greedy.p95Eta),v=>v.toFixed(1)+" min",true);
      renderRaceBars("day-distance-bars",r.eco.distance,r.greedy.distance,Math.max(r.eco.distance,r.greedy.distance),v=>v.toFixed(0)+" km",true);
    }
  }

  function placementObjective(demand,bases){
    return demand.reduce((sum,node)=>sum+node.risk_weight*Math.min(...bases.map(b=>haversineKm(node.geo,b.geo))),0);
  }

  function generateCrisisBatch(data,demand,count,rng){
    const pattern=["fire","fire","medical","medical","drone","fire","medical","drone"];
    const events=[];
    for(let i=0;i<count;i++){
      const source=weightedDemand(demand,rng);
      const type=pattern[(i+Math.floor(rng()*pattern.length))%pattern.length];
      events.push(makeEvent(data,source,type,rng,i,4.5,10.5));
    }
    return events;
  }

  function generateDay(data,demand,count,rng){
    const events=[];
    for(let i=0;i<count;i++){
      const source=weightedDemand(demand,rng);
      const x=rng();
      const type=x<TYPE_PROBS.medical?"medical":x<TYPE_PROBS.medical+TYPE_PROBS.fire?"fire":"drone";
      events.push(makeEvent(data,source,type,rng,i,6,14));
    }
    return events;
  }

  function makeEvent(data,source,type,rng,i,minDeadline,maxDeadline){
    const b=data.geo.bounds;
    return{
      name:"S"+String(i+1).padStart(2,"0"),source:source.name,type,
      point:[
        clamp(source.geo[0]+(rng()-.5)*.012,b.south,b.north),
        clamp(source.geo[1]+(rng()-.5)*.014,b.west,b.east)
      ],
      severity:2+rng()*3,
      deadline_min:minDeadline+rng()*(maxDeadline-minDeadline)
    };
  }

  function weightedDemand(demand,rng){
    const total=demand.reduce((s,x)=>s+x.risk_weight,0);
    let ticket=rng()*total;
    for(const node of demand){ticket-=node.risk_weight;if(ticket<=0)return node;}
    return demand[demand.length-1];
  }

  function evaluate(resource,from,event){
    if(!resource.capabilities.includes(event.type))return null;
    const distance=haversineKm(from,event.point);
    const eta=60*distance/(resource.speed_kmh||60);
    if(eta>event.deadline_min)return null;
    const emissions=(resource.co2_g_per_km||180)*distance;
    return{distance,eta,cost:event.severity*eta+.0005*emissions+.05*distance};
  }

  function greedyBatch(resources,events){
    const used=new Set(),assignments=[];
    const order=[...events.keys()].sort((a,b)=>events[b].severity-events[a].severity);
    for(const i of order){
      let best=null;
      resources.forEach((r,ri)=>{
        if(used.has(ri))return;
        const ev=evaluate(r,r.point,events[i]);
        if(ev&&(!best||ev.distance<best.eval.distance))best={ri,eval:ev};
      });
      if(best){
        used.add(best.ri);
        assignments.push({resourceIndex:best.ri,resource:resources[best.ri],incidentIndex:i,event:events[i],...best.eval});
      }
    }
    return summarizeAssignments(assignments);
  }

  function optimalBatch(resources,events){
    const memo=new Map();
    function solve(ri,mask){
      if(ri===resources.length)return{severityCovered:0,served:0,cost:0,assignments:[]};
      const key=ri+"|"+mask;if(memo.has(key))return memo.get(key);
      let best=solve(ri+1,mask);
      best={severityCovered:best.severityCovered,served:best.served,cost:best.cost,assignments:best.assignments.slice()};
      for(let i=0;i<events.length;i++){
        if(mask&(1<<i))continue;
        const ev=evaluate(resources[ri],resources[ri].point,events[i]);if(!ev)continue;
        const fut=solve(ri+1,mask|(1<<i));
        const cand={
          severityCovered:fut.severityCovered+events[i].severity,
          served:fut.served+1,
          cost:fut.cost+ev.cost,
          assignments:[{resourceIndex:ri,resource:resources[ri],incidentIndex:i,event:events[i],...ev},...fut.assignments]
        };
        if(isBetterCrisis(cand,best))best=cand;
      }
      memo.set(key,best);return best;
    }
    return solve(0,0);
  }

  function summarizeAssignments(assignments){
    return{
      assignments,
      severityCovered:assignments.reduce((s,x)=>s+x.event.severity,0),
      served:assignments.length,
      cost:assignments.reduce((s,x)=>s+x.cost,0),
      meanEta:assignments.length?assignments.reduce((s,x)=>s+x.eta,0)/assignments.length:0
    };
  }

  function isBetterCrisis(a,b){
    const eps=1e-9;
    if(a.severityCovered>b.severityCovered+eps)return true;
    if(a.severityCovered<b.severityCovered-eps)return false;
    if(a.served!==b.served)return a.served>b.served;
    return a.cost<b.cost-eps;
  }

  function simulateDay(demand,resources,events,policy,lambda){
    const positions=resources.map(r=>[...r.point]);
    const etas=[];let served=0,cost=0,distance=0,severityDelay=0;
    for(const event of events){
      const currentExposure=policy==="eco"?coverageExposure(demand,resources,positions):0;
      let best=null;
      resources.forEach((r,ri)=>{
        const ev=evaluate(r,positions[ri],event);if(!ev)return;
        let score=ev.distance;
        if(policy==="eco"){
          const next=positions.map(p=>[...p]);next[ri]=[...event.point];
          const delta=coverageExposure(demand,resources,next)-currentExposure;
          score=ev.cost+lambda*delta;
        }
        if(!best||score<best.score)best={ri,score,ev};
      });
      if(!best)continue;
      positions[best.ri]=[...event.point];
      served++;cost+=best.ev.cost;distance+=best.ev.distance;severityDelay+=event.severity*best.ev.eta;etas.push(best.ev.eta);
    }
    etas.sort((a,b)=>a-b);
    return{
      served,cost,distance,severityDelay,
      meanEta:etas.length?etas.reduce((a,b)=>a+b,0)/etas.length:0,
      p95Eta:etas.length?etas[Math.min(etas.length-1,Math.floor(.95*(etas.length-1)))]:0
    };
  }

  function coverageExposure(demand,resources,positions){
    let total=0;
    for(const node of demand){
      for(const [type,prob] of Object.entries(TYPE_PROBS)){
        let best=Infinity;
        resources.forEach((r,ri)=>{
          if(!r.capabilities.includes(type))return;
          const eta=60*haversineKm(positions[ri],node.geo)/(r.speed_kmh||60);
          if(eta<best)best=eta;
        });
        total+=node.risk_weight*prob*best;
      }
    }
    return total;
  }

  function renderRaceBars(id,eco,greedy,max,fmt){
    const root=document.getElementById(id);
    const scale=Math.max(max,1);
    root.innerHTML=`
      <div class="race-line"><span>Eco</span><div><i class="eco-fill" style="width:${eco/scale*100}%"></i></div><b>${fmt(eco)}</b></div>
      <div class="race-line"><span>Greedy</span><div><i class="greedy-fill" style="width:${greedy/scale*100}%"></i></div><b>${fmt(greedy)}</b></div>`;
  }

  function drawBaseMap(svg,data,demand,candidates,selected){drawTacticalBase(svg,data,demand);const xy=projector(data,900,520);
    candidates.forEach(b=>{const [x,y]=xy(b.geo);svg.append(el("rect",{x:x-5,y:y-5,width:10,height:10,rx:2,class:selected.has(b.name)?"base-dot selected":"base-dot"}));svg.append(textNode(x+9,y+4,b.name,selected.has(b.name)?"base-label selected":"base-label"));});
  }

  function drawCrisisMap(svg,data,demand,candidates,resources,result){
    drawTacticalBase(svg,data,demand);const xy=projector(data,900,520);
    resources.forEach(r=>{const [x,y]=xy(r.point);svg.append(el("circle",{cx:x,cy:y,r:11,fill:"#111",stroke:"#79f2b0","stroke-width":2}));svg.append(textNode(x+15,y+4,r.icon||"●","resource-label"));});
    result.events.forEach((e,i)=>{const [x,y]=xy(e.point),info=typeInfo(e.type);svg.append(el("circle",{cx:x,cy:y,r:12,class:"incident-ring static"}));svg.append(textNode(x+14,y+4,info.icon+" "+e.name,"incident-label"));});
    result.greedy.assignments.forEach(a=>{const [x1,y1]=xy(a.resource.point),[x2,y2]=xy(a.event.point);svg.append(el("line",{x1,y1,x2,y2,class:"crisis-route greedy-route"}));});
    result.eco.assignments.forEach(a=>{const [x1,y1]=xy(a.resource.point),[x2,y2]=xy(a.event.point);svg.append(el("line",{x1,y1,x2,y2,class:"crisis-route eco-route"}));});
  }

  function drawTacticalBase(svg,data,demand){
    svg.innerHTML="";svg.append(el("rect",{x:0,y:0,width:900,height:520,fill:"#0b1115"}));
    for(let i=0;i<=8;i++){const x=55+i*805/8;svg.append(el("line",{x1:x,y1:35,x2:x,y2:475,class:"map-grid"}));}
    for(let i=0;i<=6;i++){const y=35+i*440/6;svg.append(el("line",{x1:55,y1:y,x2:860,y2:y,class:"map-grid"}));}
    svg.append(el("path",{d:"M100 88 C250 42 465 58 650 105 C805 145 830 302 738 398 C560 455 300 438 126 350 C55 268 42 165 100 88 Z",class:"map-zone"}));
    const xy=projector(data,900,520);
    demand.forEach(n=>{const [x,y]=xy(n.geo);svg.append(el("circle",{cx:x,cy:y,r:5+n.risk_weight*2,class:"risk-zone"}));});
    svg.append(textNode(72,72,"Montes de Málaga","map-label"));
  }

  function projector(data,W,H){const b=data.geo.bounds,p={l:55,r:40,t:35,b:45};return point=>[
    p.l+(point[1]-b.west)/(b.east-b.west)*(W-p.l-p.r),
    H-p.b-(point[0]-b.south)/(b.north-b.south)*(H-p.t-p.b)
  ];}

  function combinations(items,k){const out=[];function walk(start,picked){if(picked.length===k){out.push(picked.slice());return;}for(let i=start;i<=items.length-(k-picked.length);i++){picked.push(items[i]);walk(i+1,picked);picked.pop();}}walk(0,[]);return out;}
  function projectPoint(data,point){const b=data.geo.bounds;return[b.south+(point[1]/8.5)*(b.north-b.south),b.west+(point[0]/8.2)*(b.east-b.west)];}
  function haversineKm(a,b){const R=6371.0088,la1=rad(a[0]),la2=rad(b[0]),dl=la2-la1,dg=rad(b[1]-a[1]);const h=Math.sin(dl/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
  function rad(v){return v*Math.PI/180;}
  function typeInfo(type){const x=TYPE_INFO[type]||{icon:"⚠",es:type,en:type};return{icon:x.icon,label:I18N.lang==="es"?x.es:x.en};}
  function resourceLabel(r){return I18N.lang==="es"?(r.label_es||r.label||r.name):(r.label_en||r.label||r.name);}
  function hashString(v){let h=2166136261>>>0;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function el(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
  function textNode(x,y,text,cls){const n=el("text",{x,y,class:cls});n.textContent=text;return n;}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}

  class MonteCarloValidation{
    constructor(data){
      this.data=data;
      this.seedInput=document.getElementById("mc-seed");
      this.samplesInput=document.getElementById("mc-samples");
      this.runButton=document.getElementById("mc-run");
      this.jsonButton=document.getElementById("mc-export-json");
      this.csvButton=document.getElementById("mc-export-csv");
      this.geoCandidates=data.candidates.map(x=>({...x,geo:projectPoint(data,x.point)}));
      this.geoDemand=data.demand.map(x=>({...x,geo:projectPoint(data,x.point)}));
      const combos=combinations(this.geoCandidates,data.research?.placement_k||3)
        .map(set=>({set,objective:placementObjective(this.geoDemand,set)}))
        .sort((a,b)=>a.objective-b.objective);
      const selected=combos[0].set.map(x=>x.name);
      const byName=Object.fromEntries(this.geoCandidates.map(x=>[x.name,x.geo]));
      const starts=[byName[selected[0]],byName[selected[0]],byName[selected[1]],byName[selected[2]]];
      this.resources=data.resources.map((r,i)=>({...r,point:[...starts[i]]}));
      this.result=null;
      this.running=false;
      this.runButton.addEventListener("click",()=>this.run());
      this.jsonButton.addEventListener("click",()=>this.exportJSON());
      this.csvButton.addEventListener("click",()=>this.exportCSV());
      window.addEventListener("languagechange",()=>this.render());
    }

    async run(){
      if(this.running)return;
      this.running=true;
      this.runButton.disabled=true;
      this.jsonButton.disabled=true;
      this.csvButton.disabled=true;
      const n=Number(this.samplesInput.value)||500;
      const seed=this.seedInput.value.trim()||"ecodispatch-mc-06";
      const rows=[];
      this.setProgress(0,n);

      for(let i=0;i<n;i++){
        const crisisRng=mulberry32(hashString(seed+"|normal|crisis|"+i));
        const crisisEvents=generateCrisisBatch(this.data,this.geoDemand,this.data.research?.crisis_incidents||6,crisisRng);
        const cg=greedyBatch(this.resources,crisisEvents);
        const ce=optimalBatch(this.resources,crisisEvents);

        const dayRng=mulberry32(hashString(seed+"|normal|day|"+i));
        const dayEvents=generateDay(this.data,this.geoDemand,this.data.research?.day_incidents||120,dayRng);
        const dg=simulateDay(this.geoDemand,this.resources,dayEvents,"greedy",this.data.research?.online_lambda||.35);
        const de=simulateDay(this.geoDemand,this.resources,dayEvents,"eco",this.data.research?.online_lambda||.35);

        rows.push({
          index:i,
          crisisSeverityDiff:ce.severityCovered-cg.severityCovered,
          crisisCoverageDiff:ce.served-cg.served,
          crisisEcoSeverity:ce.severityCovered,
          crisisGreedySeverity:cg.severityCovered,
          crisisEcoServed:ce.served,
          crisisGreedyServed:cg.served,
          dayCoverageDiff:de.served-dg.served,
          dayEtaDiff:de.meanEta-dg.meanEta,
          dayP95Diff:de.p95Eta-dg.p95Eta,
          dayDistanceDiff:de.distance-dg.distance,
          dayEcoServed:de.served,
          dayGreedyServed:dg.served
        });

        if(i%10===0||i===n-1){
          this.setProgress(i+1,n);
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }

      this.result={version:"0.6",seed,n,generatedAt:new Date().toISOString(),rows,summary:this.summarize(rows)};
      this.running=false;
      this.runButton.disabled=false;
      this.jsonButton.disabled=false;
      this.csvButton.disabled=false;
      this.render();
    }

    summarize(rows){
      const field=name=>rows.map(r=>r[name]);
      return{
        crisisSeverity:describe(field("crisisSeverityDiff")),
        crisisCoverage:describe(field("crisisCoverageDiff")),
        crisisSeverityWinRate:rows.filter(r=>r.crisisSeverityDiff>1e-9).length/rows.length,
        dayCoverage:describe(field("dayCoverageDiff")),
        dayEta:describe(field("dayEtaDiff")),
        dayP95:describe(field("dayP95Diff")),
        dayDistance:describe(field("dayDistanceDiff")),
        dayCoverageWinRate:rows.filter(r=>r.dayCoverageDiff>0).length/rows.length,
        dayCoverageLoseRate:rows.filter(r=>r.dayCoverageDiff<0).length/rows.length
      };
    }

    setProgress(done,total){
      const pct=total?100*done/total:0;
      document.getElementById("mc-progress-bar").style.width=pct.toFixed(1)+"%";
      document.getElementById("mc-progress-text").textContent=done===0?I18N.t("mc.ready"):I18N.t("mc.progress",{done,total});
    }

    render(){
      if(!this.result)return;
      const s=this.result.summary;
      setStat("mc-crisis-severity",signed(s.crisisSeverity.mean,2));
      setStat("mc-crisis-severity-ci",ciText(s.crisisSeverity));
      setStat("mc-crisis-cover",signed(s.crisisCoverage.mean,3));
      setStat("mc-crisis-cover-ci",ciText(s.crisisCoverage));
      setStat("mc-crisis-win",(100*s.crisisSeverityWinRate).toFixed(1)+"%");
      setStat("mc-crisis-quantiles",quantileText(s.crisisSeverity));
      drawHistogram(document.getElementById("mc-crisis-hist"),this.result.rows.map(r=>r.crisisSeverityDiff),0);

      setStat("mc-day-cover",signed(s.dayCoverage.mean,3));
      setStat("mc-day-cover-ci",ciText(s.dayCoverage));
      setStat("mc-day-eta",signed(s.dayEta.mean,3)+" min");
      setStat("mc-day-eta-ci",ciText(s.dayEta," min"));
      setStat("mc-day-p95",signed(s.dayP95.mean,3)+" min");
      setStat("mc-day-p95-ci",ciText(s.dayP95," min"));
      setStat("mc-day-distance",signed(s.dayDistance.mean,1)+" km");
      setStat("mc-day-distance-ci",ciText(s.dayDistance," km"));
      setStat("mc-day-win",(100*s.dayCoverageWinRate).toFixed(1)+"%");
      setStat("mc-day-lose",(100*s.dayCoverageLoseRate).toFixed(1)+"%");
      setStat("mc-day-quantiles",quantileText(s.dayCoverage));
      drawHistogram(document.getElementById("mc-day-hist"),this.result.rows.map(r=>r.dayCoverageDiff),0);
      document.getElementById("mc-progress-text").textContent=I18N.t("mc.complete",{n:this.result.n});
    }

    exportJSON(){
      if(!this.result)return;
      downloadBlob("ecodispatch-v0.6-"+this.result.seed+".json",JSON.stringify(this.result,null,2),"application/json");
    }

    exportCSV(){
      if(!this.result)return;
      const keys=Object.keys(this.result.rows[0]||{});
      const lines=[keys.join(","),...this.result.rows.map(r=>keys.map(k=>r[k]).join(","))];
      downloadBlob("ecodispatch-v0.6-"+this.result.seed+".csv",lines.join("\n"),"text/csv");
    }
  }

  function describe(values){
    const sorted=values.slice().sort((a,b)=>a-b);
    const n=sorted.length;
    const mean=n?sorted.reduce((a,b)=>a+b,0)/n:0;
    const variance=n>1?sorted.reduce((s,x)=>s+(x-mean)**2,0)/(n-1):0;
    const sd=Math.sqrt(variance);
    const half=1.96*sd/Math.sqrt(Math.max(n,1));
    return{n,mean,sd,ciLow:mean-half,ciHigh:mean+half,p5:quantile(sorted,.05),median:quantile(sorted,.5),p95:quantile(sorted,.95)};
  }

  function quantile(sorted,p){
    if(!sorted.length)return 0;
    const pos=(sorted.length-1)*p;
    const lo=Math.floor(pos),hi=Math.ceil(pos);
    if(lo===hi)return sorted[lo];
    return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
  }

  function signed(v,digits){return(v>0?"+":"")+v.toFixed(digits);}
  function ciText(s,suffix=""){return"95% CI ["+signed(s.ciLow,2)+", "+signed(s.ciHigh,2)+"]"+suffix;}
  function quantileText(s){return s.p5.toFixed(1)+" / "+s.median.toFixed(1)+" / "+s.p95.toFixed(1);}
  function setStat(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}

  function drawHistogram(root,values,zero){
    if(!root||!values.length)return;
    const min=Math.min(...values,zero),max=Math.max(...values,zero);
    const bins=17,span=max-min||1,counts=Array(bins).fill(0);
    values.forEach(v=>{let i=Math.floor((v-min)/span*bins);if(i>=bins)i=bins-1;if(i<0)i=0;counts[i]++;});
    const top=Math.max(...counts,1);
    root.innerHTML="";
    counts.forEach((c,i)=>{
      const bar=document.createElement("i");
      const center=min+(i+.5)*span/bins;
      bar.style.height=(100*c/top)+"%";
      bar.className=center<zero?"hist-neg":center>zero?"hist-pos":"hist-zero";
      bar.title=center.toFixed(2)+" · n="+c;
      root.appendChild(bar);
    });
  }

  function downloadBlob(name,text,type){
    const blob=new Blob([text],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  window.EcoDispatchResearch={init:data=>new ResearchSuite(data)};
  window.EcoDispatchMonteCarlo={init:data=>new MonteCarloValidation(data)};
})();