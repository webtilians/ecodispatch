/* Independent static layer: no live provider calls and no historical benchmark mutation. */
(()=>{
  const $=id=>document.getElementById(id);
  const words={
    es:{title:'Peligro espacial v1.3',intro:'Málaga / Montes de Málaga · GeoTIFF oficial AEMET · resolución nominal 1 km (rejilla 0,01°). Instantánea fija; no es un mapa de peligro en directo.',
      valid:'Válido',model:'Modelo',download:'Descarga',node:'Nodo',coords:'Latitud / longitud',pixel:'Fila / columna',value:'Clase original / peso',level:'Nivel',
      levels:['','Muy bajo','Bajo','Moderado','Alto','Muy alto','Extremo'],
      note:'Pesos ordinales 1–6, sin normalización. No son probabilidades de incendio. Ocho nodos tienen clase 1 y D7/D11 clase 2. Medical/recon conservan pesos sintéticos; también siguen siendo sintéticos los incidentes y la colocación inicial.',
      scope:'Exploratorio · 1.000 semillas nuevas × 120 incidentes · sin reutilizar el holdout v1.1.1. No demuestra eficacia real.',
      result:'La flota solo tiene una brigada de incendios: el peligro cambia la exposición, pero no las decisiones. Los resultados coinciden con el control de pesos sintéticos sobre las mismas semillas nuevas. Las diferencias agregadas entre λ proceden de medical/recon.',
      all:'Todos los tipos',fire:'Solo incendios',policy:'Política',coverage:'Cobertura %',eta:'ETA min',p95:'P95 min',harm:'Daño sintético',delta:'Δ daño frente a λ=0',
      methods:'Fuente, método y reproducción',json:'Datos por nodo',results:'Resultados e intervalos',
      metricNote:'Cobertura agregada; ETA y P95 promediados por día entre servicios atendidos. Daño sintético = severidad × demora + 10 × severidad² por incidente no atendido. CO₂ estimado con factores sintéticos. No equivale a daños observados.',
      error:'No se pudo cargar la capa espacial. El resto del dashboard sigue disponible.'},
    en:{title:'Spatial hazard v1.3',intro:'Málaga / Montes de Málaga · official AEMET GeoTIFF · nominal 1 km resolution (0.01° grid). Frozen snapshot; not a live danger map.',
      valid:'Valid',model:'Model',download:'Retrieved',node:'Node',coords:'Latitude / longitude',pixel:'Row / column',value:'Source class / weight',level:'Level',
      levels:['','Very low','Low','Moderate','High','Very high','Extreme'],
      note:'Ordinal weights 1–6, with no normalization. These are not fire probabilities. Eight nodes have class 1 and D7/D11 class 2. Medical/recon retain synthetic weights; incidents and initial placement also remain synthetic.',
      scope:'Exploratory · 1,000 fresh seeds × 120 incidents · no v1.1.1 holdout reuse. No evidence of real-world efficacy.',
      result:'The fleet has only one fire brigade: hazard changes exposure but not dispatch decisions. Outcomes equal the synthetic-weight control on the same fresh seeds. Aggregate differences between λ values come from medical/recon.',
      all:'All types',fire:'Fire only',policy:'Policy',coverage:'Coverage %',eta:'ETA min',p95:'P95 min',harm:'Synthetic harm',delta:'Δ harm vs λ=0',
      methods:'Source, methodology and reproduction',json:'Node dataset',results:'Results and intervals',
      metricNote:'Aggregate coverage; ETA and P95 averaged per day over served events. Synthetic harm = severity × delay + 10 × severity² per unserved event. CO₂ estimated with synthetic factors. Not observed damage.',
      error:'Spatial layer unavailable. The rest of the dashboard remains available.'}
  };
  let hazard,result,failed=false;
  function table(id,headers,rows){
    const table=$(id);table.replaceChildren();
    const thead=document.createElement('thead'),hr=document.createElement('tr');
    headers.forEach(t=>{const th=document.createElement('th');th.scope='col';th.textContent=t;hr.append(th);});
    thead.append(hr);table.append(thead);
    const body=document.createElement('tbody');
    rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td);});body.append(tr);});
    table.append(body);
  }
  function render(){
    const w=words[I18N.lang]||words.en;
    for(const key of ['title','intro','note','scope','result','all','fire','methods','json','results','metricNote'])$('sh-'+key).textContent=w[key];
    $('sh-nav').textContent=w.title;
    $('sh-status').textContent=failed?w.error:'';
    if(!hazard||!result)return;
    $('sh-source').textContent=`© AEMET · ${w.valid}: ${hazard.source.valid_time_utc} · ${w.model}: ${hazard.source.model_time_utc} · ${w.download}: ${hazard.source.retrieved_at_utc}`;
    table('sh-nodes',[w.node,w.level,w.value,w.coords,w.pixel],hazard.nodes.map(n=>[n.id,w.levels[n.source_value],`${n.source_value} / ${n.hazard_weight}`,`${n.latitude.toFixed(7)} / ${n.longitude.toFixed(7)}`,`${n.row} / ${n.column}`]));
    const heads=[w.policy,w.coverage,w.eta,w.p95,'km','CO₂ kg',w.harm,w.delta];
    const row=(p,count)=>[p.kind==='eco'?'λ='+p.id:p.id,(100*p.absolute.served.mean/count).toFixed(3),...['meanEta','p95Eta','distance','co2Kg','totalHarm'].map(k=>p.absolute[k].mean?.toFixed(3)??'—'),p.versusZero.totalHarm.mean.toFixed(3)];
    table('sh-benchmark',heads,result.summary.map(p=>row(p,120)));
    table('sh-fire-benchmark',heads,result.fireSummary.map(p=>row(p,result.meanFireIncidents)));
  }
  window.addEventListener('languagechange',render);
  render();
  Promise.all(['./data/spatial-hazard-v1.3.json','./data/spatial-benchmark-v1.3.json'].map(async path=>{
    const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Spatial data HTTP '+r.status);return r.json();
  })).then(([h,r])=>{
    if(h.dataset!=='aemet-malaga-spatial-hazard-v1.3'||r.dataset.hazard!==h.dataset||h.nodes.length!==10)throw Error('Spatial dataset identity mismatch');
    hazard=h;result=r;render();
  }).catch(()=>{failed=true;render();});
})();
