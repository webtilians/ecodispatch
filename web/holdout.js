(()=>{
  const $=id=>document.getElementById(id);
  const T=(key,vars={})=>I18N.t('ho.'+key,vars);
  const fmt=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';

  class HoldoutUI{
    constructor(config){
      this.config=config;this.worker=null;this.result=null;this.progress=null;this.error=false;
      $('ho-run').onclick=()=>this.run();
      $('ho-json').onclick=()=>this.download('json',JSON.stringify(this.result,null,2),'application/json');
      $('ho-csv').onclick=()=>this.download('csv',EcoDispatchHoldout.csv(this.result),'text/csv;charset=utf-8');
      window.addEventListener('languagechange',()=>this.render());
      this.renderProtocol();this.status();
    }
    renderProtocol(){
      const p=EcoDispatchHoldout.protocol;
      $('ho-seed').textContent=p.seed;
      $('ho-n').textContent=p.n;
      $('ho-k').textContent=p.harmK;
      $('ho-lambdas').textContent=p.primaryLambdas.join(' · ');
      $('ho-prereg-commit').textContent=p.preregCommit.slice(0,8);
    }
    run(){
      if(this.worker)return;
      this.error=false;this.result=null;this.progress={done:0,total:EcoDispatchHoldout.protocol.n};
      $('ho-results').hidden=true;$('ho-run').disabled=true;$('ho-json').disabled=true;$('ho-csv').disabled=true;this.status();
      try{
        this.worker=new Worker('./holdout-worker.js?v=0.9.0');
        this.worker.onmessage=({data})=>{
          if(data.type==='progress'){this.progress=data;this.status();}
          if(data.type==='complete'){this.result=data.result;this.stop();this.render();}
          if(data.type==='error')this.fail(data.message);
        };
        this.worker.onerror=e=>this.fail(e.message);
        this.worker.postMessage({config:this.config});
      }catch(e){this.fail(e.message);}
    }
    stop(){this.worker?.terminate();this.worker=null;$('ho-run').disabled=false;$('ho-json').disabled=!this.result;$('ho-csv').disabled=!this.result;}
    fail(message){console.error(message);this.error=true;this.stop();this.status();}
    status(){
      const text=this.error?T('error'):this.result?T('complete',{n:this.result.protocol.n}):this.progress?I18N.t('mc.progress',this.progress):T('ready');
      $('ho-status').textContent=text;
      if(this.progress){
        $('ho-progress-bar').style.width=(100*this.progress.done/this.progress.total).toFixed(1)+'%';
      }
    }
    render(){
      this.status();
      if(!this.result)return;
      $('ho-results').hidden=false;
      const a=this.result.analysis;
      const badge=$('ho-verdict');
      badge.textContent=a.confirmed?T('confirmed'):T('failed');
      badge.className='holdout-verdict '+(a.confirmed?'pass':'fail');
      $('ho-verdict-copy').textContent=a.confirmed
        ?T('confirmedCopy',{lambdas:a.passingLambdas.join(', ')})
        :T('failedCopy');

      const body=$('ho-table-body');body.replaceChildren();
      for(const p of a.primary){
        const tr=document.createElement('tr');
        const h=p.harm,b=h.bootstrap;
        const cells=[
          'λ = '+p.lambda,
          fmt(h.mean,2),
          '['+fmt(b.ciLow,2)+', '+fmt(b.ciHigh,2)+']',
          fmt(p.rawP,5),
          fmt(p.holmP,5),
          p.pass?T('pass'):T('fail'),
          fmt(p.secondary.served.mean,3),
          fmt(p.secondary.meanEta.mean,3),
          fmt(p.secondary.distance.mean,2)
        ];
        cells.forEach((v,i)=>{
          const cell=document.createElement(i===0?'th':'td');
          if(i===0)cell.scope='row';
          cell.textContent=v;
          if(i===5)cell.className=p.pass?'holdout-pass':'holdout-fail';
          tr.append(cell);
        });
        body.append(tr);
      }

      const sbody=$('ho-sensitivity-body');sbody.replaceChildren();
      for(const block of a.sensitivity){
        for(const p of block.policies){
          const tr=document.createElement('tr');
          [block.k,'λ = '+p.lambda,fmt(p.harm.mean,2),'['+fmt(p.harm.bootstrap.ciLow,2)+', '+fmt(p.harm.bootstrap.ciHigh,2)+']'].forEach(v=>{
            const td=document.createElement('td');td.textContent=v;tr.append(td);
          });
          sbody.append(tr);
        }
      }
    }
    download(ext,content,type){
      if(!this.result)return;
      const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement('a');a.href=url;a.download='ecodispatch-v0.9-holdout.'+ext;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  window.EcoDispatchHoldoutUI={init:config=>new HoldoutUI(config)};
})();