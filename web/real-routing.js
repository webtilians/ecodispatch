(()=>{
  const NS='http://www.w3.org/2000/svg',$=id=>document.getElementById(id),T=(key,vars={})=>I18N.t('rr.'+key,vars);
  const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—';
  class RealRoutingUI{
    constructor(config,routing){
      this.config=config;this.routing=routing;this.setup=EcoDispatchRealRouting.setup(config,routing);this.worker=null;this.result=null;
      $('rr-run').onclick=()=>this.run();$('rr-json').onclick=()=>this.download('json',JSON.stringify(this.result,null,2),'application/json');
      $('rr-csv').onclick=()=>this.download('csv',EcoDispatchRealRouting.csv(this.result),'text/csv;charset=utf-8');
      window.addEventListener('languagechange',()=>this.renderStatic());
      this.renderStatic();
    }
    renderStatic(){
      $('rr-generated').textContent=new Date(this.routing.generated_at_utc).toLocaleString(I18N.lang==='es'?'es-ES':'en-US');
      $('rr-pairs').textContent=String(this.routing.points.length*this.routing.points.length);
      $('rr-eligible').textContent=this.setup.demand.length+'/'+this.config.demand.length;
      $('rr-bases').textContent=this.setup.placement.bases.join(' · ');
      $('rr-objective').textContent=fmt(this.setup.placement.objective,1)+' '+T('weightedMin');
      $('rr-excluded').textContent=this.setup.excluded.map(x=>x.id+' ('+Math.round(x.snapDistanceM)+' m)').join(' · ')||'—';
      this.drawMap();
    }
    drawMap(){
      const svg=$('rr-map');svg.replaceChildren();
      const pts=this.routing.points,b={south:this.config.geo.bounds.south,north:this.config.geo.bounds.north,west:this.config.geo.bounds.west,east:this.config.geo.bounds.east};
      const xy=p=>[55+(p.input_lon-b.west)/(b.east-b.west)*790,470-(p.input_lat-b.south)/(b.north-b.south)*420];
      const make=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;svg.append(n);return n;};
      make('rect',{x:0,y:0,width:900,height:520,fill:'#0b1115'});
      for(let i=0;i<=8;i++)make('line',{x1:55+i*790/8,y1:35,x2:55+i*790/8,y2:470,class:'map-grid'});
      for(let i=0;i<=6;i++)make('line',{x1:55,y1:35+i*435/6,x2:845,y2:35+i*435/6,class:'map-grid'});
      const selected=new Set(this.setup.placement.bases),excluded=new Set(this.setup.excluded.map(x=>x.id));
      pts.forEach(p=>{
        const [x,y]=xy(p);
        if(p.role==='candidate_base'){
          make('rect',{x:x-5,y:y-5,width:10,height:10,rx:2,class:selected.has(p.id)?'base-dot selected':'base-dot'});
          make('text',{x:x+9,y:y+4,class:selected.has(p.id)?'base-label selected':'base-label'},p.id);
        }else{
          make('circle',{cx:x,cy:y,r:excluded.has(p.id)?8:6,class:excluded.has(p.id)?'rr-node excluded':'rr-node'});
          make('text',{x:x+10,y:y+4,class:'base-label'},p.id);
          if(excluded.has(p.id)){make('line',{x1:x-6,y1:y-6,x2:x+6,y2:y+6,class:'rr-x'});make('line',{x1:x+6,y1:y-6,x2:x-6,y2:y+6,class:'rr-x'});}
        }
      });
    }
    run(){
      if(this.worker)return;
      this.result=null;$('rr-results').hidden=true;$('rr-run').disabled=true;$('rr-json').disabled=true;$('rr-csv').disabled=true;
      const n=Number($('rr-samples').value),seed=$('rr-seed').value.trim()||'ecodispatch-real-routing-10';
      $('rr-status').textContent=I18N.t('mc.progress',{done:0,total:n});$('rr-progress-bar').style.width='0%';
      try{
        this.worker=new Worker('./real-routing-worker.js?v=1.0.0');
        this.worker.onmessage=({data})=>{
          if(data.type==='progress'){$('rr-progress-bar').style.width=(100*data.done/data.total).toFixed(1)+'%';$('rr-status').textContent=I18N.t('mc.progress',data);}
          if(data.type==='complete'){this.result=data.result;this.stop();this.renderResults();}
          if(data.type==='error')this.fail(data.message);
        };
        this.worker.onerror=e=>this.fail(e.message);
        this.worker.postMessage({config:this.config,routing:this.routing,seed,n,harmK:10,bootstrapB:500});
      }catch(e){this.fail(e.message);}
    }
    stop(){this.worker?.terminate();this.worker=null;$('rr-run').disabled=false;$('rr-json').disabled=!this.result;$('rr-csv').disabled=!this.result;}
    fail(message){console.error(message);this.stop();$('rr-status').textContent=T('error');}
    renderResults(){
      $('rr-results').hidden=false;$('rr-status').textContent=T('complete',{n:this.result.n});
      const body=$('rr-table-body');body.replaceChildren();
      for(const p of this.result.summary){
        const tr=document.createElement('tr'),label=p.id==='eta-greedy'?'ETA-greedy':p.id==='distance-greedy'?'Distance-greedy':'λ = '+p.id;
        const h=p.versusZero.totalHarm;
        const vals=[
          label,fmt(p.absolute.served.mean,2),fmt(p.absolute.meanEta.mean,2),fmt(p.absolute.p95Eta.mean,2),
          fmt(p.absolute.distance.mean,1),fmt(p.absolute.co2Kg.mean,1),fmt(p.absolute.totalHarm.mean,1),
          (p.id==='0'?'—':fmt(h.mean,1)+' ['+fmt(h.bootstrap.ciLow,1)+', '+fmt(h.bootstrap.ciHigh,1)+']')
        ];
        vals.forEach((v,i)=>{const cell=document.createElement(i===0?'th':'td');if(i===0)cell.scope='row';cell.textContent=v;tr.append(cell);});
        body.append(tr);
      }
    }
    download(ext,content,type){
      if(!this.result)return;const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement('a');a.href=url;a.download='ecodispatch-v1.0-real-routing.'+ext;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  window.EcoDispatchRealRoutingUI={init:(config,routing)=>new RealRoutingUI(config,routing)};
})();