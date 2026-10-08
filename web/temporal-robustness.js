/* EcoDispatch v1.6 static robustness surface. */
(()=>{
  const $=id=>document.getElementById(id);
  const copy={
    es:{
      intro:'¿La señal de v1.5 sobrevive al cambiar ocupación y la penalización por no atender?',
      scope:'Diseño exploratorio fijado antes de resultados: servicio 45/90/180 min y K=10/60/120. Mismos eventos entre condiciones. K solo cambia evaluación; nunca decisiones.',
      k:'Penalización K',policy:'Política',negative:'Celdas favorables',inconclusive:'Inconclusas',positive:'Desfavorables',robust:'Grupos robustos a servicio',
      summary:'Resumen de robustez',detail:'18 celdas: 3 AEMET × 2 cargas × 3 tiempos de servicio',service:'Servicio',load:'Carga',valid:'Validez AEMET',
      delta:'ΔH vs λ=0 [bootstrap 95%]',class:'Lectura',coverage:'Cobertura',response:'Respuesta',wait:'Espera',util:'Utilización',
      low:'baja',high:'alta',neg:'favorable',inc:'inconclusa',pos:'desfavorable',
      finding:'Resultado principal',findingCopy:'λ=.2 no presenta ninguna celda claramente desfavorable para K=10/60/120, pero tampoco es globalmente robusta a los tres tiempos de servicio. La señal es parcial, no una confirmación.',
      k60:'Por qué K=60',k60copy:'Con deadline 120 min y severidad ≥2, K=60 es el umbral mínimo que evita que un incendio no atendido tenga menos daño sintético que uno atendido justo al límite solo por la forma de H. No es una estimación económica ni clínica.',
      boundary:'Límite',boundaryCopy:'Routing OSM/OSRM y peligro AEMET son capas reales congeladas. Flota, llegadas, localizaciones, severidad, servicio, emisiones y H siguen modelados.',
      methods:'Método v1.6',csv:'CSV completo',loading:'Cargando robustez v1.6…',error:'No se pudo cargar v1.6; las versiones históricas siguen disponibles.'
    },
    en:{
      intro:'Does the v1.5 signal survive changes in occupancy and the unserved-event penalty?',
      scope:'Exploratory design fixed before outcomes: 45/90/180 min service and K=10/60/120. Same events across conditions. K changes evaluation only; never dispatch decisions.',
      k:'Penalty K',policy:'Policy',negative:'Favorable cells',inconclusive:'Inconclusive',positive:'Unfavorable',robust:'Service-robust groups',
      summary:'Robustness summary',detail:'18 cells: 3 AEMET × 2 loads × 3 service times',service:'Service',load:'Load',valid:'AEMET valid time',
      delta:'ΔH vs λ=0 [bootstrap 95%]',class:'Reading',coverage:'Coverage',response:'Response',wait:'Wait',util:'Utilization',
      low:'low',high:'high',neg:'favorable',inc:'inconclusive',pos:'unfavorable',
      finding:'Main result',findingCopy:'λ=.2 has no clearly unfavorable cell under K=10/60/120, but it is not globally robust across all three service times. The signal is partial, not a confirmation.',
      k60:'Why K=60',k60copy:'With a 120 min deadline and severity ≥2, K=60 is the minimum threshold preventing an unserved fire from receiving less synthetic harm than a fire served exactly at the deadline solely because of H. It is not an economic or clinical estimate.',
      boundary:'Boundary',boundaryCopy:'OSM/OSRM routing and AEMET hazard are frozen real layers. Fleet, arrivals, locations, severity, service, emissions and H remain modeled.',
      methods:'v1.6 methods',csv:'Full CSV',loading:'Loading v1.6 robustness…',error:'v1.6 could not be loaded; historical versions remain available.'
    }
  };
  const lang=()=>globalThis.I18N?.lang==='en'?'en':'es',t=k=>copy[lang()][k]??k;
  let data=null,k='60',policy='0.2';

  function fmt(v,d=2){return Number.isFinite(v)?Number(v).toFixed(d):'—';}
  function pct(v,d=1){return Number.isFinite(v)?(100*v).toFixed(d)+'%':'—';}
  function policyLabel(id){return /^\d/.test(id)?'λ='+id:id;}
  function clsLabel(c){return c==='negative'?t('neg'):c==='positive'?t('pos'):t('inc');}
  function clsClass(c){return c==='negative'?'tr-good':c==='positive'?'tr-bad':'tr-neutral';}

  function applyCopy(){
    document.querySelectorAll('[data-tr]').forEach(el=>{const key=el.dataset.tr;if(copy[lang()][key])el.textContent=t(key);});
    if(data)render();
  }

  function init(){
    $('tr-k').innerHTML=data.protocol.harm_k.map(x=>'<option value="'+x+'">K='+x+'</option>').join('');
    $('tr-policy').innerHTML=['0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(x=>'<option value="'+x+'">'+policyLabel(x)+'</option>').join('');
    $('tr-k').value=k;$('tr-policy').value=policy;
    $('tr-k').disabled=$('tr-policy').disabled=false;
    $('tr-k').onchange=()=>{k=$('tr-k').value;render();};
    $('tr-policy').onchange=()=>{policy=$('tr-policy').value;render();};
  }

  function renderCards(){
    const x=data.robustness[k][policy];
    $('tr-neg').textContent=x.negativeCells+'/18';
    $('tr-inc').textContent=x.inconclusiveCells+'/18';
    $('tr-pos').textContent=x.positiveCells+'/18';
    $('tr-robust').textContent=x.serviceRobustNegativeGroups+'/6';
  }

  function renderSummary(){
    const ids=['0.2','0.35','0.5','1','eta-greedy','distance-greedy'];
    $('tr-summary').innerHTML='<thead><tr><th>'+t('policy')+'</th><th>'+t('negative')+'</th><th>'+t('inconclusive')+'</th><th>'+t('positive')+'</th><th>'+t('robust')+'</th></tr></thead><tbody>'+
      ids.map(id=>{
        const x=data.robustness[k][id];
        return '<tr data-policy="'+id+'"><td>'+policyLabel(id)+'</td><td>'+x.negativeCells+'/18</td><td>'+x.inconclusiveCells+'/18</td><td>'+x.positiveCells+'/18</td><td>'+x.serviceRobustNegativeGroups+'/6'+(x.globalServiceRobustNegative?' ✓':'')+'</td></tr>';
      }).join('')+'</tbody>';
  }

  function renderDetail(){
    const rows=data.conditions.map(c=>{
      const h=c.harm[k][policy].versusZero,op=c.operational[policy],classification=c.classifications[k][policy];
      return {c,h,op,classification};
    });
    $('tr-detail').innerHTML='<thead><tr><th>'+t('valid')+'</th><th>'+t('load')+'</th><th>'+t('service')+'</th><th>'+t('delta')+'</th><th>'+t('class')+'</th><th>'+t('coverage')+'</th><th>'+t('response')+'</th><th>'+t('wait')+'</th><th>'+t('util')+'</th></tr></thead><tbody>'+
      rows.map(({c,h,op,classification})=>'<tr class="'+clsClass(classification)+'"><td>'+c.source.valid_time_utc.slice(0,10)+'</td><td>'+t(c.regime)+'</td><td>'+c.serviceMinutes+' min</td><td>'+fmt(h.mean,2)+' ['+fmt(h.bootstrap.ciLow,2)+', '+fmt(h.bootstrap.ciHigh,2)+']</td><td>'+clsLabel(classification)+'</td><td>'+pct(op.coverage.mean,1)+'</td><td>'+fmt(op.meanResponseDelay.mean,1)+' min</td><td>'+fmt(op.meanWait.mean,1)+' min</td><td>'+pct(op.utilizationMean.mean,1)+'</td></tr>').join('')+
      '</tbody>';
  }

  function render(){
    $('tr-status').textContent='v1.6 · K='+k+' · '+policyLabel(policy);
    renderCards();renderSummary();renderDetail();
  }

  async function boot(){
    applyCopy();$('tr-status').textContent=t('loading');
    try{
      const r=await fetch('./data/temporal-robustness-v1.6.json?v=1.6',{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      data=await r.json();
      if(data.version!=='1.6'||data.confirmatory!==false||data.conditions.length!==18)throw Error('identity mismatch');
      init();render();
    }catch(e){console.error(e);$('tr-status').textContent=t('error');}
  }
  window.addEventListener('languagechange',applyCopy);
  boot();
})();