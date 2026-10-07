(()=>{
  const NS="http://www.w3.org/2000/svg";
  const LABELS={eco:"EcoDispatch",greedy:"Greedy",offline:"Óptimo offline"};
  const TYPE_INFO={
    medical:{label:"Asistencia médica",icon:"🩺"},
    fire:{label:"Incendio",icon:"🔥"},
    drone:{label:"Reconocimiento",icon:"🔭"}
  };

  class LiveSimulator{
    constructor(data){
      this.data=data;
      this.timer=null;
      this.view="eco";
      this.seedInput=document.getElementById("sim-seed");
      this.countInput=document.getElementById("sim-count");
      this.speedInput=document.getElementById("sim-speed");
      this.svg=document.getElementById("scenario-map");
      this.events=[];
      this.cursor=0;
      this.offlinePlan=[];
      this.strategies={};
      this.lastDecisions={eco:null,greedy:null,offline:null};
      this.lastEcoAnalysis=null;

      this.geoCandidates=data.candidates.map(x=>({...x,geo:projectPoint(data,x.point)}));
      this.geoDemand=data.demand.map(x=>({...x,geo:projectPoint(data,x.point)}));

      const placement=computePlacement(this.geoDemand,this.geoCandidates,3);
      this.data.placement={
        selected_bases:placement.selected,
        objective:placement.objective,
        metric:"riesgo × distancia geodésica"
      };

      const baseByName=Object.fromEntries(this.geoCandidates.map(x=>[x.name,x.geo]));
      const s=placement.selected;
      const starts=[baseByName[s[0]],baseByName[s[0]],baseByName[s[1]],baseByName[s[2]]];
      this.resources=data.resources.map((r,i)=>({...r,point:[...starts[i]]}));

      this.bind();
      this.generate();
    }

    bind(){
      document.getElementById("sim-generate").addEventListener("click",()=>this.generate());
      document.getElementById("sim-play").addEventListener("click",()=>this.toggleRun());
      document.getElementById("sim-step").addEventListener("click",()=>this.step());
      document.getElementById("sim-reset").addEventListener("click",()=>this.reset());

      document.querySelectorAll(".strategy-tab").forEach(button=>{
        button.addEventListener("click",()=>{
          this.view=button.dataset.view;
          document.querySelectorAll(".strategy-tab").forEach(x=>x.classList.toggle("active",x===button));
          document.getElementById("map-strategy-title").textContent="Vista "+LABELS[this.view];
          this.renderMap();
        });
      });

      this.speedInput.addEventListener("change",()=>{
        if(this.timer){this.stopTimer();this.startTimer();}
      });
    }

    generate(){
      this.stopTimer();
      const count=clampInt(Number(this.countInput.value),4,10,8);
      this.countInput.value=String(count);
      const seed=this.seedInput.value.trim()||"malaga-v04";
      const random=mulberry32(hashString(seed));
      this.events=generateIncidents(this.data,this.geoDemand,count,random);
      this.offlinePlan=exactOfflinePlan(this.resources,this.events);
      this.resetState();
      this.renderAll();
    }

    reset(){
      this.stopTimer();
      this.resetState();
      this.renderAll();
    }

    resetState(){
      this.cursor=0;
      this.strategies={
        eco:createStrategyState(this.resources),
        greedy:createStrategyState(this.resources),
        offline:createStrategyState(this.resources)
      };
      this.lastDecisions={eco:null,greedy:null,offline:null};
      this.lastEcoAnalysis=null;
      document.getElementById("sim-play").textContent="▶ Ejecutar";
    }

    toggleRun(){
      if(this.timer){this.stopTimer();return;}
      if(this.cursor<this.events.length)this.startTimer();
    }

    startTimer(){
      document.getElementById("sim-play").textContent="⏸ Pausa";
      this.step();
      if(this.cursor>=this.events.length)return;
      const delay=clampInt(Number(this.speedInput.value),250,2500,900);
      this.timer=setInterval(()=>this.step(),delay);
    }

    stopTimer(){
      if(this.timer)clearInterval(this.timer);
      this.timer=null;
      const play=document.getElementById("sim-play");
      if(play)play.textContent=this.cursor>=this.events.length?"✓ Finalizado":"▶ Ejecutar";
    }

    step(){
      if(this.cursor>=this.events.length){this.stopTimer();return;}

      const event=this.events[this.cursor];
      const ecoAnalysis=chooseEcoDetailed(this.resources,this.strategies.eco.positions,event);
      const greedyAction=chooseGreedy(this.resources,this.strategies.greedy.positions,event);
      const offlineAction=this.offlinePlan[this.cursor];

      this.lastEcoAnalysis=ecoAnalysis;
      this.lastDecisions={
        eco:applyAction(this.resources,this.strategies.eco,event,ecoAnalysis.action,this.cursor),
        greedy:applyAction(this.resources,this.strategies.greedy,event,greedyAction,this.cursor),
        offline:applyAction(this.resources,this.strategies.offline,event,offlineAction,this.cursor)
      };

      this.cursor+=1;
      this.renderAll();
      if(this.cursor>=this.events.length)this.stopTimer();
    }

    renderAll(){
      this.renderTopMetrics();
      this.renderScene();
      this.renderMap();
      this.renderEvent();
      this.renderQueue();
      this.renderScores();
      this.renderBenchmark();
    }

    renderTopMetrics(){
      const eco=this.strategies.eco;
      const offline=this.strategies.offline;
      document.getElementById("metric-coverage").textContent=`${eco.served}/${this.cursor}`;
      const comparable=this.cursor>0&&eco.served===offline.served&&offline.cost>0;
      document.getElementById("metric-ratio").textContent=comparable?(eco.cost/offline.cost).toFixed(3):"—";
      document.getElementById("metric-kmedian").textContent=this.data.placement.objective.toFixed(1);
      document.getElementById("metric-bases").textContent=this.data.placement.selected_bases.join(" · ");
    }

    renderScene(){
      const badge=document.getElementById("scene-badge");
      const title=document.getElementById("scene-title");
      const copy=document.getElementById("scene-copy");
      const bar=document.getElementById("scene-progress-bar");
      const progress=document.getElementById("sim-progress");
      const total=this.events.length;

      bar.style.width=`${total?this.cursor/total*100:0}%`;
      progress.textContent=`${this.cursor} / ${total}`;

      badge.className="scene-badge";
      if(this.cursor===0){
        badge.classList.add("ready");
        badge.textContent="PREPARADO";
        title.textContent="Escenario generado y listo";
        copy.textContent="Misma semilla, mismos incidentes. Pulsa «Ejecutar» para empezar.";
      }else if(this.cursor>=total){
        badge.classList.add("done");
        badge.textContent="FINALIZADO";
        title.textContent=`Simulación completada: ${total} incidentes`;
        copy.textContent=this.summarySentence();
      }else{
        badge.classList.add("live");
        badge.textContent="EN CURSO";
        const last=this.events[this.cursor-1];
        title.textContent=`${last.name}: ${typeInfo(last.type).label}`;
        copy.textContent=this.decisionComparisonSentence();
      }
    }

    renderMap(){
      const svg=this.svg;
      svg.innerHTML="";
      const W=900,H=560,pad={l:52,r:38,t:42,b:54};
      const bounds=this.data.geo.bounds;
      const xy=point=>[
        pad.l+(point[1]-bounds.west)/(bounds.east-bounds.west)*(W-pad.l-pad.r),
        H-pad.b-(point[0]-bounds.south)/(bounds.north-bounds.south)*(H-pad.t-pad.b)
      ];

      const defs=el("defs");
      const grad=el("linearGradient",{id:"bgGrad",x1:"0",y1:"0",x2:"0",y2:"1"});
      grad.append(el("stop",{offset:"0%","stop-color":"#0d1715"}),el("stop",{offset:"100%","stop-color":"#0b1116"}));
      defs.append(grad);
      svg.append(defs);
      svg.append(el("rect",{x:0,y:0,width:W,height:H,fill:"url(#bgGrad)"}));

      for(let i=0;i<=8;i++){
        const x=pad.l+i*(W-pad.l-pad.r)/8;
        svg.append(el("line",{x1:x,y1:pad.t,x2:x,y2:H-pad.b,class:"map-grid"}));
      }
      for(let i=0;i<=6;i++){
        const y=pad.t+i*(H-pad.t-pad.b)/6;
        svg.append(el("line",{x1:pad.l,y1:y,x2:W-pad.r,y2:y,class:"map-grid"}));
      }

      svg.append(el("path",{d:"M80 120 C210 70 330 165 455 108 S700 55 835 135",class:"map-contour"}));
      svg.append(el("path",{d:"M45 205 C180 150 315 245 470 175 S715 125 865 215",class:"map-contour"}));
      svg.append(el("path",{d:"M70 315 C190 250 350 350 485 292 S710 240 850 328",class:"map-contour"}));
      svg.append(el("rect",{x:0,y:475,width:900,height:85,class:"map-city-band"}));
      svg.append(textNode(735,520,"Málaga / costa", "map-label"));
      svg.append(textNode(74,87,"Montes de Málaga", "map-label"));

      const zone=el("path",{d:"M115 90 C245 45 455 54 650 112 C790 155 825 310 735 410 C565 468 305 452 135 365 C55 275 42 165 115 90 Z",class:"map-zone"});
      svg.insertBefore(zone,svg.children[2]||null);

      this.geoDemand.forEach(node=>{
        const [x,y]=xy(node.geo);
        svg.append(el("circle",{cx:x,cy:y,r:5+node.risk_weight*2.1,class:"risk-zone"}));
      });

      const selected=new Set(this.data.placement.selected_bases);
      this.geoCandidates.forEach(base=>{
        const [x,y]=xy(base.geo);
        svg.append(el("rect",{x:x-5,y:y-5,width:10,height:10,rx:2,class:selected.has(base.name)?"base-dot selected":"base-dot"}));
        const label=textNode(x+9,y+4,base.name,selected.has(base.name)?"base-label selected":"base-label");
        svg.append(label);
      });

      if(this.data.geo.anchor){
        const [x,y]=xy(this.data.geo.anchor.point);
        svg.append(el("circle",{cx:x,cy:y,r:6,class:"anchor-dot"}));
        svg.append(textNode(x+10,y-7,"Las Contadoras","base-label selected"));
      }

      const state=this.strategies[this.view];
      const color=strategyColor(this.view);
      state.history.forEach((move,index)=>{
        if(!move.resource)return;
        const [x1,y1]=xy(move.from),[x2,y2]=xy(move.to);
        const path=el("line",{x1,y1,x2,y2,stroke:color,class:index===state.history.length-1?"route-current":"route-history"});
        svg.append(path);
      });

      if(this.cursor>0){
        const incident=this.events[this.cursor-1];
        const [x,y]=xy(incident.point);
        svg.append(el("circle",{cx:x,cy:y,r:18,class:"incident-ring"}));
        svg.append(el("circle",{cx:x,cy:y,r:6,fill:"#ff6f6f"}));
        svg.append(textNode(x+13,y-16,`${typeInfo(incident.type).icon} ${incident.name}`,"incident-label"));
      }
      if(this.cursor<this.events.length){
        const next=this.events[this.cursor];
        const [x,y]=xy(next.point);
        svg.append(el("circle",{cx:x,cy:y,r:10,class:"incident-next"}));
        svg.append(textNode(x+12,y+4,`siguiente · ${next.name}`,"base-label"));
      }

      state.positions.forEach((point,index)=>{
        const [x,y]=xy(point);
        const resource=this.resources[index];
        const g=el("g",{class:"resource-node"});
        g.append(el("circle",{cx:x,cy:y,r:15,fill:color}));
        const icon=textNode(x,y+1,resource.icon||"●","resource-emoji");
        g.append(icon);
        g.append(textNode(x+20,y-2,resource.label||resource.name,"resource-label"));
        g.append(textNode(x+20,y+11,resource.name,"resource-sub"));
        svg.append(g);
      });

      for(let i=0;i<=4;i++){
        const lat=bounds.south+i*(bounds.north-bounds.south)/4;
        const [,y]=xy([lat,bounds.west]);
        svg.append(textNode(6,y+4,lat.toFixed(3)+"°","resource-sub"));
      }
      for(let i=0;i<=4;i++){
        const lon=bounds.west+i*(bounds.east-bounds.west)/4;
        const [x]=xy([bounds.south,lon]);
        const t=textNode(x,H-15,Math.abs(lon).toFixed(3)+"° O","resource-sub");
        t.setAttribute("text-anchor","middle");svg.append(t);
      }
    }

    renderEvent(){
      const name=document.getElementById("event-name");
      const type=document.getElementById("event-type");
      const icon=document.getElementById("event-icon");
      const detail=document.getElementById("event-detail");
      const severityFill=document.getElementById("severity-fill");
      const severityValue=document.getElementById("severity-value");
      const storyTitle=document.getElementById("decision-story-title");
      const storyCopy=document.getElementById("decision-story-copy");

      if(this.cursor===0){
        name.textContent="Sin incidente activo";
        type.textContent="—";icon.textContent="◎";detail.textContent="El escenario está preparado. Ejecuta la simulación para empezar.";
        severityFill.style.width="0%";severityValue.textContent="—";
        storyTitle.textContent="Todavía no hay decisión.";
        storyCopy.textContent="Aquí aparecerá qué recurso envía EcoDispatch, su ETA y por qué fue elegido.";
        ["eco","greedy","offline"].forEach(k=>document.getElementById(`decision-${k}`).textContent="—");
        return;
      }

      const event=this.events[this.cursor-1];
      const info=typeInfo(event.type);
      name.textContent=`${event.name} · ${info.label}`;
      type.textContent=info.label;
      icon.textContent=info.icon;
      severityFill.style.width=`${clamp(event.severity/5*100,0,100)}%`;
      severityValue.textContent=event.severity.toFixed(1)+"/5";
      detail.innerHTML=`Origen de riesgo <strong>${escapeHtml(event.source)}</strong> · límite de respuesta <strong>${event.deadline_min.toFixed(1)} min</strong>.`;

      for(const key of ["eco","greedy","offline"]){
        const d=this.lastDecisions[key];
        document.getElementById(`decision-${key}`).textContent=d&&d.resource
          ? `${d.icon} ${d.resource} · ${d.eta.toFixed(1)} min`
          :"No atendido";
      }

      const eco=this.lastDecisions.eco;
      if(!eco||!eco.resource){
        storyTitle.textContent="EcoDispatch no encuentra un recurso factible.";
        storyCopy.textContent=`Ningún recurso compatible llega antes del límite de ${event.deadline_min.toFixed(1)} minutos.`;
      }else{
        storyTitle.textContent=`${eco.icon} Envía ${eco.label} · ETA ${eco.eta.toFixed(1)} min`;
        const feasible=this.lastEcoAnalysis?this.lastEcoAnalysis.candidates.filter(x=>x.feasible):[];
        const greedy=this.lastDecisions.greedy;
        let sentence=`Entre ${feasible.length} recurso${feasible.length===1?"":"s"} factible${feasible.length===1?"":"s"}, minimiza el coste secundario (gravedad × ETA + distancia + emisiones).`;
        if(greedy&&greedy.resource&&greedy.resource!==eco.resource){
          sentence+=` Greedy habría enviado ${greedy.label}; aquí las estrategias toman caminos distintos.`;
        }
        storyCopy.textContent=sentence;
      }
    }

    renderQueue(){
      const root=document.getElementById("event-queue");
      root.innerHTML="";
      document.getElementById("queue-count").textContent=`${this.events.length} eventos`;
      this.events.forEach((event,index)=>{
        const info=typeInfo(event.type);
        const item=document.createElement("div");
        item.className="queue-item";
        if(index<this.cursor)item.classList.add("done");
        if(index===this.cursor)item.classList.add("next");
        item.innerHTML=`
          <span class="queue-index">${String(index+1).padStart(2,"0")}</span>
          <span class="queue-icon">${info.icon}</span>
          <span><strong>${escapeHtml(event.name)} · ${escapeHtml(info.label)}</strong><small>gravedad ${event.severity.toFixed(1)} · zona ${escapeHtml(event.source)}</small></span>
          <span class="queue-deadline">${event.deadline_min.toFixed(0)} min</span>`;
        root.appendChild(item);
      });
    }

    renderScores(){
      for(const key of ["eco","greedy","offline"]){
        const state=this.strategies[key];
        document.getElementById(`${key}-served`).textContent=`${state.served}/${this.cursor}`;
        document.getElementById(`${key}-cost`).textContent=state.cost.toFixed(2);
        document.getElementById(`${key}-distance`).textContent=state.distance.toFixed(2)+" km";
      }
      document.querySelectorAll(".strategy-card").forEach(x=>x.classList.remove("is-best"));
      if(this.cursor>0){
        const ranked=["eco","greedy","offline"].map(k=>({k,...this.strategies[k]}))
          .sort((a,b)=>b.served-a.served||a.cost-b.cost);
        const card=document.querySelector(`.strategy-card[data-strategy="${ranked[0].k}"]`);
        if(card)card.classList.add("is-best");
      }
    }

    renderBenchmark(){
      const s=this.strategies;
      const max=Math.max(s.eco.cost,s.greedy.cost,s.offline.cost,1);
      for(const key of ["eco","greedy","offline"]){
        document.getElementById(`bar-${key}-value`).textContent=s[key].cost.toFixed(2);
        document.getElementById(`bar-${key}`).style.width=`${s[key].cost/max*100}%`;
      }

      const headline=document.getElementById("benchmark-headline");
      const copy=document.getElementById("benchmark-copy");
      const vg=document.getElementById("verdict-greedy");
      const vo=document.getElementById("verdict-offline");
      const vc=document.getElementById("verdict-coverage");

      if(this.cursor===0){
        headline.textContent="Todavía no hay resultados.";
        copy.textContent="Las tres políticas parten exactamente de las mismas posiciones iniciales.";
        vg.textContent=vo.textContent=vc.textContent="—";return;
      }

      headline.textContent=this.cursor>=this.events.length?"Resultado final del escenario":"Resultado del prefijo procesado";
      vc.textContent=`${s.eco.served}/${this.cursor} Eco · ${s.greedy.served}/${this.cursor} Greedy`;

      if(s.greedy.cost>0&&s.eco.served===s.greedy.served){
        const pct=(1-s.eco.cost/s.greedy.cost)*100;
        vg.textContent=Math.abs(pct)<.05?"≈ igual":pct>0?`${pct.toFixed(1)}% mejor`:`${Math.abs(pct).toFixed(1)}% peor`;
      }else vg.textContent="cobertura distinta";

      if(s.offline.cost>0&&s.eco.served===s.offline.served){
        vo.textContent=(s.eco.cost/s.offline.cost).toFixed(3)+"×";
      }else vo.textContent="cobertura distinta";

      if(s.eco.served!==s.offline.served){
        copy.textContent="No comparamos costes como equivalentes porque la cobertura entre EcoDispatch y el óptimo es distinta.";
      }else if(s.offline.cost>0){
        const ratio=s.eco.cost/s.offline.cost;
        copy.textContent=`EcoDispatch, sin conocer el futuro, está en ${ratio.toFixed(3)}× el coste del óptimo offline para los incidentes procesados.`;
      }
    }

    summarySentence(){
      const e=this.strategies.eco,g=this.strategies.greedy,o=this.strategies.offline;
      if(e.served===g.served&&g.cost>0){
        const pct=(1-e.cost/g.cost)*100;
        return pct>=0?`EcoDispatch termina con ${pct.toFixed(1)}% menos coste que greedy en este escenario.`:`Greedy termina con ${Math.abs(pct).toFixed(1)}% menos coste que EcoDispatch en este escenario.`;
      }
      return `EcoDispatch atiende ${e.served} de ${this.events.length}; el óptimo offline atiende ${o.served}.`;
    }

    decisionComparisonSentence(){
      const e=this.lastDecisions.eco,g=this.lastDecisions.greedy;
      if(e&&g&&e.resource&&g.resource&&e.resource!==g.resource)return `EcoDispatch y greedy han elegido recursos distintos: ${e.label} frente a ${g.label}.`;
      if(e&&e.resource)return `EcoDispatch envía ${e.label} con una ETA de ${e.eta.toFixed(1)} min.`;
      return "EcoDispatch no ha encontrado un recurso compatible dentro del plazo.";
    }
  }

  function createStrategyState(resources){
    return{positions:resources.map(r=>[...r.point]),served:0,unserved:0,cost:0,distance:0,severityDelay:0,history:[]};
  }

  function computePlacement(demand,candidates,k){
    let best={selected:[],objective:Infinity};
    for(const subset of combinations(candidates,k)){
      let total=0;
      for(const node of demand){
        let nearest=Infinity;
        for(const base of subset)nearest=Math.min(nearest,haversineKm(node.geo,base.geo));
        total+=node.risk_weight*nearest;
      }
      if(total<best.objective)best={selected:subset.map(x=>x.name),objective:total};
    }
    return best;
  }

  function combinations(items,k){
    const result=[];
    function walk(start,picked){
      if(picked.length===k){result.push(picked.slice());return;}
      for(let i=start;i<=items.length-(k-picked.length);i++){picked.push(items[i]);walk(i+1,picked);picked.pop();}
    }
    walk(0,[]);return result;
  }

  function generateIncidents(data,demand,count,random){
    const weights=demand.map(x=>x.risk_weight),total=weights.reduce((a,b)=>a+b,0);
    const types=["medical","fire","drone"],bounds=data.geo.bounds,events=[];
    for(let i=0;i<count;i++){
      let ticket=random()*total,source=demand[0];
      for(let j=0;j<demand.length;j++){ticket-=weights[j];if(ticket<=0){source=demand[j];break;}}
      const type=types[Math.floor(random()*types.length)];
      events.push({
        name:`S${String(i+1).padStart(2,"0")}`,source:source.name,type,
        point:[
          clamp(source.geo[0]+(random()-.5)*.012,bounds.south,bounds.north),
          clamp(source.geo[1]+(random()-.5)*.014,bounds.west,bounds.east)
        ],
        severity:2+random()*3,
        deadline_min:6+random()*8
      });
    }
    return events;
  }

  function chooseEcoDetailed(resources,positions,event){
    const candidates=resources.map((resource,index)=>({index,resource,...evaluate(resource,positions[index],event)}));
    const feasible=candidates.filter(x=>x.feasible).sort((a,b)=>a.cost-b.cost);
    return{action:feasible.length?feasible[0].index:null,candidates};
  }

  function chooseGreedy(resources,positions,event){
    let best=null;
    resources.forEach((resource,index)=>{
      const result=evaluate(resource,positions[index],event);
      if(!result.feasible)return;
      if(!best||result.distance<best.distance)best={index,...result};
    });
    return best?best.index:null;
  }

  function applyAction(resources,state,event,resourceIndex,eventIndex){
    if(resourceIndex===null||resourceIndex===undefined){
      state.unserved+=1;state.history.push({eventIndex,resource:null,event:event.name});return{resource:null,eta:NaN};
    }
    const resource=resources[resourceIndex],from=[...state.positions[resourceIndex]],result=evaluate(resource,from,event);
    if(!result.feasible){
      state.unserved+=1;state.history.push({eventIndex,resource:null,event:event.name});return{resource:null,eta:NaN};
    }
    state.positions[resourceIndex]=[...event.point];
    state.served+=1;state.cost+=result.cost;state.distance+=result.distance;state.severityDelay+=event.severity*result.eta;
    state.history.push({eventIndex,event:event.name,resource:resource.name,from,to:[...event.point],eta:result.eta,distance:result.distance,cost:result.cost});
    return{resource:resource.name,label:resource.label||resource.name,icon:resource.icon||"●",eta:result.eta,distance:result.distance,cost:result.cost};
  }

  function evaluate(resource,from,event){
    if(!resource.capabilities.includes(event.type))return{feasible:false};
    const distance=haversineKm(from,event.point),speed=resource.speed_kmh||60,eta=60*distance/speed;
    if(eta>event.deadline_min)return{feasible:false,distance,eta};
    const emissions=(resource.co2_g_per_km||180)*distance;
    const cost=event.severity*eta+.0005*emissions+.05*distance;
    return{feasible:true,distance,eta,cost};
  }

  function exactOfflinePlan(resources,events){
    const memo=new Map(),choice=new Map(),initial=resources.map(()=>-1);
    const pointFor=(r,code)=>code<0?resources[r].point:events[code].point;
    function solve(t,positions){
      if(t===events.length)return{served:0,cost:0};
      const key=t+"|"+positions.join(",");if(memo.has(key))return memo.get(key);
      const skip=solve(t+1,positions);let best={served:skip.served,cost:skip.cost},bestAction=null;
      for(let r=0;r<resources.length;r++){
        const result=evaluate(resources[r],pointFor(r,positions[r]),events[t]);if(!result.feasible)continue;
        const next=positions.slice();next[r]=t;const future=solve(t+1,next);
        const candidate={served:future.served+1,cost:future.cost+result.cost};
        if(isBetter(candidate,best)){best=candidate;bestAction=r;}
      }
      memo.set(key,best);choice.set(key,bestAction);return best;
    }
    solve(0,initial);
    const plan=[];let positions=initial.slice();
    for(let t=0;t<events.length;t++){
      const key=t+"|"+positions.join(","),action=choice.get(key);
      plan.push(action===undefined?null:action);if(action!==null&&action!==undefined)positions[action]=t;
    }
    return plan;
  }

  function isBetter(a,b){return a.served>b.served||(a.served===b.served&&a.cost<b.cost-1e-9);}

  function projectPoint(data,point){
    const b=data.geo.bounds,xMax=8.2,yMax=8.5;
    return[
      b.south+(point[1]/yMax)*(b.north-b.south),
      b.west+(point[0]/xMax)*(b.east-b.west)
    ];
  }

  function haversineKm(a,b){
    const R=6371.0088,lat1=rad(a[0]),lat2=rad(b[0]),dLat=lat2-lat1,dLng=rad(b[1]-a[1]);
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  function typeInfo(type){return TYPE_INFO[type]||{label:type,icon:"⚠"};}
  function strategyColor(key){return key==="eco"?"#79f2b0":key==="greedy"?"#79b8ff":"#ffb56b";}
  function rad(v){return v*Math.PI/180;}
  function hashString(v){let h=2166136261>>>0;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function clampInt(v,min,max,fallback){return Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):fallback;}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
  function el(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
  function textNode(x,y,text,cls){const n=el("text",{x,y,class:cls});n.textContent=text;return n;}

  window.EcoDispatchSimulator={init:data=>new LiveSimulator(data)};
})();