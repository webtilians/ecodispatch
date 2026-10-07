(()=>{
  const $=id=>document.getElementById(id),t=key=>I18N.t('ab.'+key);
  const fmt=v=>Number.isFinite(v)?v.toFixed(3):'—';
  const metricLabel=k=>t(k);
  const policyLabel=id=>id==='eta-greedy'?t('etaGreedy'):id==='distance-greedy'?t('distanceGreedy'):'λ = '+id;

  class AblationUI{
    constructor(config){
      this.config=config;this.result=null;this.worker=null;this.selected='0.35';this.progress=null;this.error=false;
      $('ab-run').onclick=()=>this.run();
      $('ab-cancel').onclick=()=>this.cancel();
      ['ab-reference','ab-axis'].forEach(id=>$(id).onchange=()=>this.render());
      $('ab-json').onclick=()=>this.download('json',JSON.stringify(this.result,null,2),'application/json');
      $('ab-csv').onclick=()=>this.download('csv',EcoDispatchAblation.csv(this.result),'text/csv;charset=utf-8');
      window.addEventListener('languagechange',()=>{this.status();this.render();});
      this.busy(false);
    }
    busy(value){
      ['ab-run','ab-seed','ab-samples','ab-harm-k'].forEach(id=>$(id).disabled=value);
      $('ab-cancel').disabled=!value;
      ['ab-json','ab-csv'].forEach(id=>$(id).disabled=value||!this.result);
    }
    run(){
      if(this.worker)return;
      this.result=null;this.error=false;this.progress={done:0,total:Number($('ab-samples').value)};
      $('ab-results').hidden=true;this.busy(true);this.status();
      try{
        this.worker=new Worker('./ablation-worker.js?v=0.8.0');
        this.worker.onmessage=({data})=>{
          if(data.type==='progress'){this.progress=data;this.status();}
          if(data.type==='complete'){this.result=data.result;this.stop();this.status();this.render();}
          if(data.type==='error')this.fail(data.message);
        };
        this.worker.onerror=error=>this.fail(error.message);
        this.worker.postMessage({
          config:this.config,
          seed:$('ab-seed').value.trim()||'ecodispatch-mc-06',
          n:this.progress.total,
          harmK:Number($('ab-harm-k').value),
          bootstrapB:this.config.research?.bootstrap_replicates||500
        });
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
      [t('policy'),...metrics.map(metricLabel),t('paretoProbability')].forEach(label=>{
        const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);
      });
      const body=table.createTBody();
      for(const p of this.result.summary){
        const tr=body.insertRow();if(p.id===this.selected)tr.className='ab-selected';
        const th=document.createElement('th');th.scope='row';tr.append(th);
        const button=document.createElement('button');button.className='button';button.textContent=policyLabel(p.id);
        button.setAttribute('aria-pressed',String(p.id===this.selected));button.onclick=()=>this.choose(p.id);th.append(button);
        for(const k of metrics){
          const s=p.differences[ref][k],cell=tr.insertCell();
          const mean=document.createElement('strong');mean.textContent=fmt(p.absolute[k].mean);cell.append(mean);
          const normal=document.createElement('small');
          normal.textContent='Δ '+fmt(s.mean)+' · N ['+fmt(s.ciLow)+', '+fmt(s.ciHigh)+']';cell.append(normal);
          const boot=document.createElement('small');
          boot.textContent='B ['+fmt(s.bootstrap?.ciLow)+', '+fmt(s.bootstrap?.ciHigh)+']';cell.append(boot);
          if(s.n!==this.result.n){const count=document.createElement('small');count.textContent='n = '+s.n;cell.append(count);}
        }
        const pareto=tr.insertCell();
        pareto.innerHTML='<strong>'+((p.paretoProbability||0)*100).toFixed(1)+'%</strong><small>'+(p.pareto?t('front'):t('dominated'))+'</small>';
      }
      const selected=this.result.summary.find(p=>p.id===this.selected);
      $('ab-detail').textContent=policyLabel(selected.id)+' · '+metrics.map(k=>metricLabel(k)+': '+fmt(selected.absolute[k].mean)).join(' · ')
        +' · P('+t('front')+'): '+((selected.paretoProbability||0)*100).toFixed(1)+'%';
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
        const cx=x(p.absolute[xKey].mean),cy=y(p.absolute[yKey].mean),label=policyLabel(p.id),prob=p.paretoProbability||0;
        const fill=prob>=.75?'#79f2b0':prob>=.25?'#ffb56b':'#82909a';
        const dot=make('circle',{
          cx,cy,r:p.id===this.selected?10:7,fill,
          stroke:p.id===this.selected?'#ffffff':'#18252f','stroke-width':3,
          tabindex:0,role:'button',
          'aria-label':label+' · '+t('paretoProbability')+' '+(prob*100).toFixed(1)+'%'
        });
        const title=document.createElementNS(NS,'title');
        title.textContent=label+' · '+t('paretoProbability')+': '+(prob*100).toFixed(1)+'% · '
          +EcoDispatchAblation.metrics.map(k=>metricLabel(k)+': '+fmt(p.absolute[k].mean)).join(' · ');
        dot.append(title);
        dot.onclick=()=>this.choose(p.id);dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.choose(p.id);}};
        const labelLeft=p.id==='0.2';
        make('text',{x:cx+(labelLeft?-13:13),y:cy-10,'text-anchor':labelLeft?'end':'start',fill:'#dce7ed','font-size':13},label);
      }
      $('ab-front').textContent=t('probabilitySummary')+': '+this.result.summary
        .filter(p=>p.id!=='eta-greedy'&&p.id!=='distance-greedy')
        .sort((a,b)=>b.paretoProbability-a.paretoProbability)
        .map(p=>policyLabel(p.id)+' '+(p.paretoProbability*100).toFixed(0)+'%').join(' · ');
    }
    download(ext,content,type){
      if(!this.result)return;
      const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement('a');a.href=url;a.download='ecodispatch-v0.8-'+this.result.n+'.'+ext;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  window.EcoDispatchAblationUI={init:config=>new AblationUI(config)};
})();