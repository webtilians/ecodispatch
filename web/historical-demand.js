/* EcoDispatch v1.7.1 static Historical Demand Replay dashboard. */
(()=>{
  const $=id=>document.getElementById(id);
  const copy={
    es:{
      nav:'Replay histórico',
      intro:'¿Sobrevive la señal de v1.6 cuando sustituimos Poisson + nodos sintéticos por hora y coordenada observadas de incendios EGIF 2006–2023?',
      scope:'1.464 incendios históricos · 6.574 días calendario · 45/90/180 min de servicio. Solo tiempo y posición son históricos; flota, severidad, servicio, deadline, emisiones, H y los contextos AEMET siguen modelados.',
      k:'Penalización K',policy:'Política',csv:'CSV',full:'JSON completo',
      favorable:'Celdas favorables',inconclusive:'Inconclusas',unfavorable:'Desfavorables',robust:'Contextos robustos a servicio',
      finding:'Resultado principal',findingCopy:'La señal positiva de v1.6 no sobrevive al replay histórico: para K=60 todos los λ>0 son desfavorables en 9/9 celdas frente a λ=0.',
      density:'Régimen histórico',densityCopy:'984 de 1.194 días activos tienen un solo incendio; solo 210 tienen más de uno y el máximo observado es 5. Preservar cobertura futura tiene muchas menos oportunidades de compensar un desvío inmediato.',
      boundary:'Límite del resultado',boundaryCopy:'Esto valida demanda espacio-temporal observada, no operaciones reales. Los tiempos de servicio siguen siendo sensibilidad de v1.6 y la calibración operativa se aplaza a v1.7.2.',
      routing:'Acceso por carretera',routingCopy:'OSRM usa una red moderna congelada y aproxima cada incendio al punto conducible más cercano. La distancia de snap se conserva; no reconstruye las carreteras históricas.',
      summary:'Resumen por política',detail:'9 celdas: 3 contextos AEMET × 3 tiempos de servicio',
      valid:'Contexto AEMET',service:'Servicio',delta:'ΔH vs λ=0 [bootstrap 95%]',class:'Lectura',coverage:'Cobertura',response:'Respuesta',unserved:'No atendidos',changed:'Días con asignación distinta',
      neg:'favorable',inc:'inconclusa',pos:'desfavorable',
      methods:'Diseño fijo v1.7.1',report:'Informe de resultados',
      loading:'Cargando replay histórico v1.7.1…',error:'No se pudo cargar v1.7.1; el resto del laboratorio sigue disponible.'
    },
    en:{
      nav:'Historical replay',
      intro:'Does the v1.6 signal survive when Poisson arrivals + synthetic nodes are replaced by observed 2006–2023 EGIF fire time and coordinates?',
      scope:'1,464 historical fires · 6,574 calendar days · 45/90/180 min service. Only time and location are historical; fleet, severity, service, deadline, emissions, H and AEMET contexts remain modeled.',
      k:'Penalty K',policy:'Policy',csv:'CSV',full:'Full JSON',
      favorable:'Favorable cells',inconclusive:'Inconclusive',unfavorable:'Unfavorable',robust:'Service-robust contexts',
      finding:'Main result',findingCopy:'The positive v1.6 signal does not survive historical replay: at K=60 every λ>0 is unfavorable in 9/9 cells versus λ=0.',
      density:'Historical regime',densityCopy:'984 of 1,194 active days contain a single fire; only 210 contain more than one and the observed maximum is 5. Preserving future coverage has far fewer opportunities to repay an immediate detour.',
      boundary:'Result boundary',boundaryCopy:'This validates observed spatiotemporal demand, not real operations. Service time remains the v1.6 sensitivity and operational calibration is deferred to v1.7.2.',
      routing:'Road access',routingCopy:'OSRM uses a frozen modern network and maps each wildfire to the nearest routable point. Snap distance is retained; historical roads are not reconstructed.',
      summary:'Policy summary',detail:'9 cells: 3 AEMET contexts × 3 service times',
      valid:'AEMET context',service:'Service',delta:'ΔH vs λ=0 [95% bootstrap]',class:'Reading',coverage:'Coverage',response:'Response',unserved:'Unserved',changed:'Days with different dispatch',
      neg:'favorable',inc:'inconclusive',pos:'unfavorable',
      methods:'Fixed v1.7.1 design',report:'Results report',
      loading:'Loading historical replay v1.7.1…',error:'v1.7.1 could not be loaded; the rest of the lab remains available.'
    }
  };
  const lang=()=>globalThis.I18N?.lang==='en'?'en':'es',t=k=>copy[lang()][k]??k;
  let data=null,k='60',policy='0.2';
  const ids=['0.2','0.35','0.5','1','eta-greedy','distance-greedy'];

  function fmt(v,d=2){return Number.isFinite(v)?Number(v).toFixed(d):'—';}
  function pct(v,d=1){return Number.isFinite(v)?(100*v).toFixed(d)+'%':'—';}
  function policyLabel(id){return /^\d/.test(id)?'λ='+id:id;}
  function clsLabel(c){return c==='negative'?t('neg'):c==='positive'?t('pos'):t('inc');}
  function clsClass(c){return c==='negative'?'tr-good':c==='positive'?'tr-bad':'tr-neutral';}

  function applyCopy(){
    document.querySelectorAll('[data-hr]').forEach(el=>{const key=el.dataset.hr;if(copy[lang()][key])el.textContent=t(key);});
    const nav=$('hr-nav');if(nav)nav.textContent=t('nav');
    if(data)render();
  }

  function init(){
    $('hr-k').innerHTML=['10','60','120'].map(x=>'<option value="'+x+'">K='+x+'</option>').join('');
    $('hr-policy').innerHTML=ids.map(x=>'<option value="'+x+'">'+policyLabel(x)+'</option>').join('');
    $('hr-k').value=k;$('hr-policy').value=policy;
    $('hr-k').disabled=$('hr-policy').disabled=false;
    $('hr-k').onchange=()=>{k=$('hr-k').value;render();};
    $('hr-policy').onchange=()=>{policy=$('hr-policy').value;render();};
  }

  function renderCards(){
    const x=data.robustness[k][policy];
    $('hr-neg').textContent=x.negativeCells+'/9';
    $('hr-inc').textContent=x.inconclusiveCells+'/9';
    $('hr-pos').textContent=x.positiveCells+'/9';
    $('hr-robust').textContent=x.serviceRobustNegativeContexts+'/3';
  }

  function renderSummary(){
    $('hr-summary').innerHTML='<thead><tr><th>'+t('policy')+'</th><th>'+t('favorable')+'</th><th>'+t('inconclusive')+'</th><th>'+t('unfavorable')+'</th><th>'+t('robust')+'</th></tr></thead><tbody>'+
      ids.map(id=>{
        const x=data.robustness[k][id];
        return '<tr data-policy="'+id+'"><td>'+policyLabel(id)+'</td><td>'+x.negativeCells+'/9</td><td>'+x.inconclusiveCells+'/9</td><td>'+x.positiveCells+'/9</td><td>'+x.serviceRobustNegativeContexts+'/3'+(x.globalServiceRobustNegative?' ✓':'')+'</td></tr>';
      }).join('')+'</tbody>';
  }

  function renderDetail(){
    $('hr-detail').innerHTML='<thead><tr><th>'+t('valid')+'</th><th>'+t('service')+'</th><th>'+t('delta')+'</th><th>'+t('class')+'</th><th>'+t('coverage')+'</th><th>'+t('response')+'</th><th>'+t('unserved')+'</th><th>'+t('changed')+'</th></tr></thead><tbody>'+
      data.conditions.map(c=>{
        const h=c.harm[k][policy].versusZero,o=c.operational[policy].eventWeighted,classification=c.classifications[k][policy];
        return '<tr class="'+clsClass(classification)+'"><td>'+c.source.valid_time_utc.slice(0,10)+'</td><td>'+c.serviceMinutes+' min</td><td>'+fmt(h.mean,3)+' ['+fmt(h.bootstrap.ciLow,3)+', '+fmt(h.bootstrap.ciHigh,3)+']</td><td>'+clsLabel(classification)+'</td><td>'+pct(o.coverage,2)+'</td><td>'+fmt(o.meanResponseDelay,2)+' min</td><td>'+o.unserved+'</td><td>'+c.operational[policy].decisionDifferentActiveDays+'</td></tr>';
      }).join('')+'</tbody>';
  }

  function render(){
    $('hr-status').textContent='v1.7.1 · K='+k+' · '+policyLabel(policy);
    const first=data.conditions[0],d=first.demand,s=data.routingAudit.event_snap_distance_m;
    $('hr-demand').textContent=data.cohort.primary_events.toLocaleString(lang());
    $('hr-days').textContent=data.cohort.active_fire_days.toLocaleString(lang());
    $('hr-multi').textContent=d.multiEventDays.toLocaleString(lang());
    $('hr-snap').textContent=fmt(s.median,1)+' m';
    $('hr-snap-note').textContent='P95 '+fmt(s.p95,1)+' m · max '+fmt(s.max,1)+' m';
    renderCards();renderSummary();renderDetail();
  }

  async function boot(){
    applyCopy();$('hr-status').textContent=t('loading');
    try{
      const r=await fetch('./data/historical-demand-v1.7.1-summary.json?v=1.7.1',{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      data=await r.json();
      if(data.version!=='1.7.1'||data.confirmatory!==false||data.conditions.length!==9)throw Error('identity mismatch');
      init();render();
    }catch(e){console.error(e);$('hr-status').textContent=t('error');}
  }
  window.addEventListener('languagechange',applyCopy);
  boot();
})();