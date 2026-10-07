(()=>{
  const $=id=>document.getElementById(id),t=key=>I18N.t('ab.'+key);
  const fmt=v=>Number.isFinite(v)?v.toFixed(3):'—';
  const metricLabel=k=>t(k);
  class AblationUI{
    constructor(config){
      this.config=config;this.result=null;this.worker=null;this.selected='0.35';this.progress=null;this.error=false;
      $('ab-run').onclick=()=>this.run();
      $('ab-cancel').onclick=()=>this.cancel();
      ['ab-reference','ab-axis'].forEach(id=>$(id).onchange=()=>this.render());
      $('ab-json').onclick=()=>this.download('json',JSON.stringify(this.result,null,2),'application/json');
      $('ab-csv').onclick=()=>this.download('csv',EcoDispatchAblation.csv(this.result),'text/csv;charset=utf-8');
      window.addEventListener('languagechange',()=>{this.status();this.render();});
    }
    busy(value){
      ['ab-run','ab-seed','ab-samples'].forEach(id=>$(id).disabled=value);
      $('ab-cancel').disabled=!value;
      ['ab-json','ab-csv'].forEach(id=>$(id).disabled=value||!this.result);
    }
    run(){
      if(this.worker)return;
      this.result=null;this.error=false;this.progress={done:0,total:Number($('ab-samples').value)};
      $('ab-results').hidden=true;this.busy(true);this.status();
      try{
        this.worker=new Worker('./ablation-worker.js');
        this.worker.onmessage=({data})=>{
          if(data.type==='progress'){this.progress=data;this.status();}
          if(data.type==='complete'){
            this.result=data.result;this.stop();this.status();this.render();
          }
          if(data.type==='error')this.fail(data.message);
        };
        this.worker.onerror=error=>this.fail(error.message);
        this.worker.postMessage({config:this.config,seed:$('ab-seed').value.trim()||'ecodispatch-mc-06',n:this.progress.total});
      }catch(error){this.fail(error.message);}
    }
    stop(){this.worker?.terminate();this.worker=null;this.busy(false);}
    cancel(){this.stop();this.progress=null;this.status();}
    fail(message){console.error(message);this.error=true;this.stop();this.status();}
    status(){
      $('ab-status').textContent=this.error?t('error'):this.result
        ? I18N.t('ab.complete',{n:this.result.n,seed:this.result.seed})
        :this.progress?I18N.t('mc.progress',this.progress):t('ready');
    }
    choose(id){this.selected=id;this.render();}
    render(){
      if(!this.result)return;
      $('ab-results').hidden=false;
      const ref=$('ab-reference').value,metrics=EcoDispatchAblation.metrics;
      const table=$('ab-table');table.replaceChildren();
      const caption=document.createElement('caption');caption.textContent=t('tableHelp');table.append(caption);
      const head=table.createTHead().insertRow();
      [t('policy'),...metrics.map(metricLabel),'Pareto'].forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);});
      const body=table.createTBody();
      for(const p of this.result.summary){
        const tr=body.insertRow();if(p.id===this.selected)tr.className='ab-selected';
        const th=document.createElement('th');th.scope='row';tr.append(th);
        const button=document.createElement('button');button.className='button';button.textContent=p.id==='greedy'?'Greedy':'λ = '+p.id;
        button.setAttribute('aria-pressed',String(p.id===this.selected));button.onclick=()=>this.choose(p.id);th.append(button);
        for(const k of metrics){
          const s=p.differences[ref][k],cell=tr.insertCell();
          const mean=document.createElement('strong');mean.textContent=fmt(p.absolute[k].mean);cell.append(mean);
          const delta=document.createElement('small');delta.textContent='Δ '+fmt(s.mean)+' ['+fmt(s.ciLow)+', '+fmt(s.ciHigh)+']';cell.append(delta);
          if(s.n!==this.result.n){const count=document.createElement('small');count.textContent='n = '+s.n;cell.append(count);}
        }
        tr.insertCell().textContent=p.pareto===null?'—':p.pareto?t('front'):t('dominated');
      }
      const selected=this.result.summary.find(p=>p.id===this.selected);
      $('ab-detail').textContent=(selected.id==='greedy'?'Greedy':'λ = '+selected.id)+' · '+metrics.map(k=>metricLabel(k)+': '+fmt(selected.absolute[k].mean)).join(' · ');
      this.chart();
    }
    chart(){
      const svg=$('ab-chart');svg.replaceChildren();
      const NS='http://www.w3.org/2000/svg',make=(tag,attrs,text)=>{
        const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;svg.append(el);return el;
      };
      const xKey=$('ab-axis').value,yKey='served';
      const rows=this.result.summary.filter(p=>Number.isFinite(p.absolute[xKey].mean)&&Number.isFinite(p.absolute[yKey].mean));
      if(!rows.length)return;
      const range=k=>{const vals=rows.map(p=>p.absolute[k].mean);let lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo)*.15||.1;return[lo-pad,hi+pad];};
      const [xl,xh]=range(xKey),[yl,yh]=range(yKey);
      const x=v=>90+(v-xl)/(xh-xl)*650,y=v=>345-(v-yl)/(yh-yl)*285;
      make('title',{},t('chartTitle'));
      for(let i=0;i<=4;i++){
        const xv=xl+(xh-xl)*i/4,yv=yl+(yh-yl)*i/4;
        make('line',{x1:90,x2:740,y1:y(yv),y2:y(yv),stroke:'#293742'});
        make('text',{x:80,y:y(yv)+5,'text-anchor':'end',fill:'#b3c1ca'},yv.toFixed(2));
        make('text',{x:x(xv),y:372,'text-anchor':'middle',fill:'#b3c1ca'},xv.toFixed(2));
      }
      make('text',{x:415,y:410,'text-anchor':'middle',fill:'#dce7ed'},metricLabel(xKey)+' ↓');
      make('text',{x:90,y:25,fill:'#dce7ed'},metricLabel(yKey)+' ↑');
      for(const p of rows){
        const cx=x(p.absolute[xKey].mean),cy=y(p.absolute[yKey].mean),label=p.id==='greedy'?'Greedy':'λ '+p.id;
        const dot=make('circle',{cx,cy,r:p.id===this.selected?10:7,fill:p.pareto?'#79f2b0':'#9badbe',stroke:p.id===this.selected?'#ffffff':'#18252f','stroke-width':3,tabindex:0,role:'button','aria-label':label+' · '+(p.pareto?t('front'):t('dominated'))});
        const title=document.createElementNS(NS,'title');title.textContent=label+' · '+EcoDispatchAblation.metrics.map(k=>metricLabel(k)+': '+fmt(p.absolute[k].mean)).join(' · ');dot.append(title);
        dot.onclick=()=>this.choose(p.id);dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.choose(p.id);}};
        make('text',{x:cx+13,y:cy-10,fill:'#dce7ed','font-size':13},label);
      }
      $('ab-front').textContent=t('front')+': '+this.result.summary.filter(p=>p.pareto).map(p=>p.id==='greedy'?'Greedy':'λ '+p.id).join(' · ');
    }
    download(ext,content,type){
      if(!this.result)return;
      const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement('a');a.href=url;a.download='ecodispatch-v0.7-'+this.result.n+'.'+ext;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  window.EcoDispatchAblationUI={init:config=>new AblationUI(config)};
})();
