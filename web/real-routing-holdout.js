(()=>{
  const $=id=>document.getElementById(id);
  const T=(key,vars={})=>I18N.t('rh.'+key,vars);
  const fmt=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
  const fmtP=v=>!Number.isFinite(v)?'—':(v!==0&&Math.abs(v)<1e-4?v.toExponential(2):v.toFixed(5));

  class RealRoutingHoldoutUI{
    constructor(config,routing){
      this.config=config;this.routing=routing;this.worker=null;this.result=null;this.progress=null;this.error=false;this.frozen=false;
      $('rh-run').onclick=()=>this.run();
      $('rh-json').onclick=()=>this.download('json',JSON.stringify(this.result,null,2),'application/json');
      $('rh-csv').onclick=()=>this.download('csv',this.frozen?this.frozenCsv():EcoDispatchRealRoutingHoldout.csv(this.result),'text/csv;charset=utf-8');
      window.addEventListener('languagechange',()=>{this.renderProtocol();this.status();});
      this.renderProtocol();this.status();this.loadFrozen();
    }

    renderProtocol(){
      const p=EcoDispatchRealRoutingHoldout.protocol;
      $('rh-seed').textContent=p.seed;
      $('rh-n').textContent=p.n;
      $('rh-k').textContent=p.harmK;
      $('rh-lambdas').textContent=p.primaryLambdas.join(' · ');
      $('rh-prereg-commit').textContent=p.preregCommit.slice(0,8);
      $('rh-dataset').textContent=p.routingDataset;
      $('rh-bases').textContent=p.placementBases.join(' · ');
    }

    async loadFrozen(){
      try{
        const response=await fetch('./data/real-routing-holdout-v1.1.1-frozen.json?v=1.1.1');
        if(!response.ok)throw new Error('Frozen v1.1.1 result unavailable');
        if(this.worker)return;
        this.result=await response.json();this.frozen=true;
        $('rh-json').disabled=false;$('rh-csv').disabled=false;
        this.render();
      }catch(error){console.warn(error);}
    }

    run(){
      if(this.worker)return;
      this.error=false;this.frozen=false;this.result=null;this.progress={done:0,total:EcoDispatchRealRoutingHoldout.protocol.n};
      $('rh-results').hidden=true;$('rh-run').disabled=true;$('rh-json').disabled=true;$('rh-csv').disabled=true;this.status();
      try{
        this.worker=new Worker('./real-routing-holdout-worker.js?v=1.1.1');
        this.worker.onmessage=({data})=>{
          if(data.type==='progress'){this.progress=data;this.status();}
          if(data.type==='complete'){this.result=data.result;this.stop();this.render();}
          if(data.type==='error')this.fail(data.message);
        };
        this.worker.onerror=e=>this.fail(e.message);
        this.worker.postMessage({config:this.config,routing:this.routing});
      }catch(error){this.fail(error.message);}
    }

    stop(){
      this.worker?.terminate();this.worker=null;
      $('rh-run').disabled=false;$('rh-json').disabled=!this.result;$('rh-csv').disabled=!this.result;
    }

    fail(message){console.error(message);this.error=true;this.stop();this.status();}

    status(){
      $('rh-status').textContent=this.error?T('error'):this.result
        ?(this.frozen?T('frozenLoaded'):T('complete',{n:this.result.protocol.n}))
        :this.progress?I18N.t('mc.progress',this.progress)
        :T('ready');
      if(this.progress)$('rh-progress-bar').style.width=(100*this.progress.done/this.progress.total).toFixed(1)+'%';
    }

    render(){
      this.status();if(!this.result)return;
      $('rh-results').hidden=false;
      const a=this.result.analysis,badge=$('rh-verdict');
      badge.textContent=a.confirmed?T('confirmed'):T('failed');
      badge.className='holdout-verdict '+(a.confirmed?'pass':'fail');
      $('rh-verdict-copy').textContent=a.confirmed
        ?T('confirmedCopy',{lambdas:a.passingLambdas.join(', ')})
        :T('failedCopy');

      const body=$('rh-table-body');body.replaceChildren();
      for(const p of a.primary){
        const tr=document.createElement('tr'),h=p.harm;
        const cells=[
          'λ = '+p.lambda,
          fmt(h.mean,2),
          '['+fmt(h.bootstrap.ciLow,2)+', '+fmt(h.bootstrap.ciHigh,2)+']',
          fmtP(p.rawP),fmtP(p.holmP),p.pass?T('pass'):T('fail'),
          fmt(p.secondary.served.mean,3),
          fmt(p.secondary.meanEta.mean,3),
          fmt(p.secondary.p95Eta.mean,3),
          fmt(p.secondary.distance.mean,2),
          fmt(p.secondary.co2Kg.mean,2)
        ];
        cells.forEach((v,i)=>{
          const cell=document.createElement(i===0?'th':'td');if(i===0)cell.scope='row';
          cell.textContent=v;if(i===5)cell.className=p.pass?'holdout-pass':'holdout-fail';tr.append(cell);
        });
        body.append(tr);
      }

      const bbody=$('rh-baseline-body');bbody.replaceChildren();
      for(const base of a.baselines){
        const tr=document.createElement('tr');
        const vals=[
          base.id,
          fmt(base.versusZero.served.mean,3),
          fmt(base.versusZero.meanEta.mean,3),
          fmt(base.versusZero.p95Eta.mean,3),
          fmt(base.versusZero.distance.mean,2),
          fmt(base.versusZero.co2Kg.mean,2),
          fmt(base.versusZero.totalHarm.mean,2)
        ];
        vals.forEach((v,i)=>{const cell=document.createElement(i===0?'th':'td');if(i===0)cell.scope='row';cell.textContent=v;tr.append(cell);});
        bbody.append(tr);
      }
    }

    frozenCsv(){
      const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
      const lines=[['policy','deltaH','bootstrapLow','bootstrapHigh','rawP','holmP','pass','deltaServed','deltaMeanEta','deltaP95Eta','deltaDistance','deltaCo2Kg']];
      for(const p of this.result.analysis.primary){
        lines.push([
          'lambda='+p.lambda,p.harm.mean,p.harm.bootstrap.ciLow,p.harm.bootstrap.ciHigh,p.rawP,p.holmP,p.pass,
          p.secondary.served.mean,p.secondary.meanEta.mean,p.secondary.p95Eta.mean,p.secondary.distance.mean,p.secondary.co2Kg.mean
        ]);
      }
      for(const b of this.result.analysis.baselines){
        lines.push([b.id,b.versusZero.totalHarm.mean,'','','','','',b.versusZero.served.mean,b.versusZero.meanEta.mean,b.versusZero.p95Eta.mean,b.versusZero.distance.mean,b.versusZero.co2Kg.mean]);
      }
      return lines.map(row=>row.map(q).join(',')).join('\r\n');
    }

    download(ext,content,type){
      if(!this.result)return;
      const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement('a');a.href=url;a.download=(this.frozen?'ecodispatch-v1.1.1-real-routing-holdout-frozen':'ecodispatch-v1.1-real-routing-holdout')+'.'+ext;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }

  window.EcoDispatchRealRoutingHoldoutUI={
    init:(config,routing)=>new RealRoutingHoldoutUI(config,routing)
  };
})();