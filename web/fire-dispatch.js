/* Static, independently loaded v1.4 section. No live hazard or simulation requests. */
(()=>{
  const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
  const words={
    es:{intro:'Experimento exploratorio de incendios · tres brigadas modeladas · diez nodos elegibles de Málaga.',
      scope:'Real: routing vial OSM/OSRM y rásteres espaciales oficiales AEMET. Sintético: flota, estaciones, incidentes uniformes, severidad, CO₂ y tiempos de servicio nulos. Sin eficacia operativa demostrada; sin preregistro ni confirmación.',
      limit:'Tres fechas de validez de una misma salida del modelo del 7 de octubre, no tres días históricos independientes. No se obtuvo un archivo histórico independiente. El gradiente disponible sigue siendo bajo: clases 1–2. Las predicciones futuras no son observaciones. El 8 y el 11 comparten clases en los diez nodos: solo hay dos perfiles espaciales seleccionados.',
      selection:'Selección previa a resultados: más clases distintas, mayor rango y mayor clase media; desempate por fecha. Se conservan los tres primeros rásteres y la referencia v1.3 si falta. Todos los candidatos están en el JSON del catálogo.',
      snapshot:'Predicción archivada',valid:'Validez UTC',model:'Modelo UTC',lead:'Horizonte',hours:'h',
      fleet:'Flota experimental',fleetNote:'F-01 en B2 · F-02 en B3 · F-03 en B4. Tres brigadas idénticas, capacidad fire, 230 g CO₂/km modelados. Se reinician en cada réplica; después permanecen en el último nodo atendido. Sin colas, simultaneidad ni retorno a estación.',
      map:'Nodos y estaciones modeladas',mapNote:'Mapa esquemático en coordenadas WGS84; círculos = nodos, cuadrados = estaciones experimentales. No representa trazados de carretera ni un mapa de peligro en directo.',
      levels:['','Muy bajo','Bajo','Moderado','Alto','Muy alto','Extremo'],node:'Nodo',level:'Nivel',original:'Clase original',coords:'Latitud / longitud',
      results:'Resultados por predicción',policy:'Política',coverage:'Cobertura %',harm:'Daño sintético',delta:'Δ daño vs λ=0 [IC pareado 95%]',
      metrics:'1.000 réplicas sintéticas × 120 incendios por predicción; eventos idénticos entre políticas dentro de cada réplica. ETA y P95 son medias de valores diarios entre atendidos; km y CO₂ son totales medios por réplica. Daño = severidad × ETA + 10 × severidad² por no atendido. El daño no equivale a pérdidas reales y debe leerse junto con cobertura. IC bootstrap descriptivos, no confirmatorios.',
      diagnostic:'Días con decisiones distintas frente a λ=0',control:'Control clase uniforme 1: días distintos con λ=0,35',
      methods:'Método y limitaciones',catalog:'Catálogo y selección',json:'Exportar predicción JSON',csv:'Exportar predicción CSV',
      error:'No se pudo cargar Fire Dispatch v1.4. Las versiones históricas siguen disponibles.',loading:'Cargando experimento…'},
    en:{intro:'Exploratory fire dispatch experiment · three modeled brigades · ten eligible Málaga nodes.',
      scope:'Real: OSM/OSRM road routing and official AEMET spatial rasters. Synthetic: fleet, stations, uniform incidents, severity, CO₂ and zero service times. No demonstrated operational efficacy; no preregistration or confirmation.',
      limit:'Three validity dates from the same October 7 model issue, not three independent historical days. No independent historical archive was obtained. Available spatial gradients remain low: classes 1–2. Future forecasts are not observations. October 8 and 11 share the same ten-node classes: only two selected spatial profiles.',
      selection:'Selection before results: more distinct classes, wider range, then higher mean class; date breaks ties. Retain the top three rasters plus the v1.3 reference if absent. All candidates are in the catalog JSON.',
      snapshot:'Archived forecast',valid:'Valid UTC',model:'Model UTC',lead:'Lead',hours:'h',
      fleet:'Experimental fleet',fleetNote:'F-01 at B2 · F-02 at B3 · F-03 at B4. Three identical fire-capable brigades, modeled 230 g CO₂/km. Reset each replicate, then stay at their last served node. No queues, simultaneous occupancy or return to station.',
      map:'Nodes and modeled stations',mapNote:'Schematic WGS84 coordinate map; circles = nodes, squares = experimental stations. Not road geometry or a live danger map.',
      levels:['','Very low','Low','Moderate','High','Very high','Extreme'],node:'Node',level:'Level',original:'Original class',coords:'Latitude / longitude',
      results:'Results by forecast',policy:'Policy',coverage:'Coverage %',harm:'Synthetic harm',delta:'Δ harm vs λ=0 [paired 95% CI]',
      metrics:'1,000 synthetic replicates × 120 fires per forecast; identical events across policies within each replicate. ETA and P95 are means of daily served-event values; km and CO₂ are mean totals per replicate. Harm = severity × ETA + 10 × severity² for unserved events. Harm is not observed loss and must be read alongside coverage. Descriptive bootstrap CIs, not confirmation.',
      diagnostic:'Days with different decisions versus λ=0',control:'Uniform class 1 control: different days at λ=0.35',
      methods:'Methods and limitations',catalog:'Catalog and selection',json:'Export forecast JSON',csv:'Export forecast CSV',
      error:'Fire Dispatch v1.4 could not be loaded. Historical versions remain available.',loading:'Loading experiment…'}
  };
  const colors=['','#69ba68','#b4cf55','#f4d35e','#ee9852','#e66454','#be4270'];
  let catalog,result,routing,selected,failed=false;
  const w=()=>words[I18N.lang]||words.en;
  function table(id,heads,rows){
    const t=$('fd-'+id);t.replaceChildren();const head=t.createTHead(),hr=head.insertRow();
    heads.forEach(value=>{const cell=document.createElement('th');cell.scope='col';cell.textContent=value;hr.append(cell);});
    const body=t.createTBody();rows.forEach(row=>{const tr=body.insertRow();row.forEach(value=>tr.insertCell().textContent=value);});
  }
  function svg(tag,attrs,text){
    const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    if(text!==undefined)el.textContent=text;return el;
  }
  function draw(snapshot){
    const map=$('fd-map');map.replaceChildren();map.setAttribute('aria-label',w().map);
    map.append(svg('title',{},w().map),svg('desc',{},w().mapNote));
    const stations=result.protocol.fleet.map(f=>({...routing.points.find(p=>p.id===f.station),fleet:f.name}));
    const points=[...snapshot.nodes.map(n=>({lon:n.longitude,lat:n.latitude})),...stations.map(p=>({lon:p.input_lon,lat:p.input_lat}))];
    const west=Math.min(...points.map(p=>p.lon))-.007,east=Math.max(...points.map(p=>p.lon))+.007;
    const south=Math.min(...points.map(p=>p.lat))-.007,north=Math.max(...points.map(p=>p.lat))+.007;
    const x=lon=>50+(lon-west)/(east-west)*630,y=lat=>370-(lat-south)/(north-south)*320;
    for(let i=0;i<5;i++){
      const lon=west+(east-west)*i/4,lat=south+(north-south)*i/4;
      map.append(svg('line',{x1:x(lon),y1:50,x2:x(lon),y2:370,class:'fd-grid'}),svg('text',{x:x(lon),y:401,'text-anchor':'middle',class:'fd-axis'},lon.toFixed(3)+'°'));
      map.append(svg('line',{x1:50,y1:y(lat),x2:680,y2:y(lat),class:'fd-grid'}),svg('text',{x:45,y:y(lat)+4,'text-anchor':'end',class:'fd-axis'},lat.toFixed(3)+'°'));
    }
    for(const n of snapshot.nodes){
      const group=svg('g',{'data-node':n.id});
      group.append(svg('title',{},`${n.id}: ${w().levels[n.source_value]} (${n.source_value})`),svg('circle',{cx:x(n.longitude),cy:y(n.latitude),r:10,fill:colors[n.source_value],stroke:'#182820','stroke-width':2}),svg('text',{x:x(n.longitude)+14,y:y(n.latitude)-12,class:'fd-label'},n.id+' · '+n.source_value));map.append(group);
    }
    for(const p of stations){
      const group=svg('g',{'data-station':p.id});
      group.append(svg('rect',{x:x(p.input_lon)-7,y:y(p.input_lat)-7,width:14,height:14,fill:'#68b9f0',stroke:'#17283a','stroke-width':2}),svg('text',{x:x(p.input_lon)+12,y:y(p.input_lat)+22,class:'fd-label'},p.id+' / '+p.fleet));map.append(group);
    }
    $('fd-legend').replaceChildren();
    for(let i=1;i<=6;i++){const el=document.createElement('span');el.textContent=i+' '+w().levels[i];el.style.borderColor=colors[i];$('fd-legend').append(el);}
  }
  function render(){
    const text=w();
    document.querySelectorAll('[data-fd]').forEach(el=>el.textContent=text[el.dataset.fd]);
    $('fd-status').textContent=failed?text.error:!result?text.loading:'';
    if(!result)return;
    const h=catalog.candidates.find(s=>s.id===selected),r=result.snapshots.find(s=>s.id===selected);
    $('fd-snapshot').replaceChildren();
    for(const id of catalog.selection.selected_ids){const s=catalog.candidates.find(c=>c.id===id),option=document.createElement('option');option.value=id;option.textContent=s.source.valid_time_utc+' · '+text.lead+' '+s.source.lead_hours+' h';option.selected=id===selected;$('fd-snapshot').append(option);}
    $('fd-source').textContent=`Fuente / Source: AEMET · ${text.valid}: ${h.source.valid_time_utc} · ${text.model}: ${h.source.model_time_utc} · ${text.lead}: ${h.source.lead_hours} h`;
    draw(h);
    table('nodes',[text.node,text.level,text.original,text.coords],h.nodes.map(n=>[n.id,text.levels[n.source_value],n.source_value,n.latitude.toFixed(7)+' / '+n.longitude.toFixed(7)]));
    const fmt=v=>v===null?'—':v.toFixed(3);
    table('results',[text.policy,text.coverage,'ETA min','P95 min','km','CO₂ kg',text.harm,text.delta],r.summary.map(p=>{
      const d=p.versusZero.totalHarm;return [p.kind==='eco'?'λ='+p.id:p.id,fmt(100*p.absolute.served.mean/result.protocol.incidents_per_day),...['meanEta','p95Eta','distance','co2Kg','totalHarm'].map(k=>fmt(p.absolute[k].mean)),`${fmt(d.mean)} [${fmt(d.bootstrap.ciLow)}, ${fmt(d.bootstrap.ciHigh)}]`];
    }));
    $('fd-diagnostics').textContent=text.diagnostic+': '+Object.entries(r.diagnostics.daysWithDifferentDispatchVsZero).map(([k,v])=>k+' → '+v+'/'+result.protocol.days).join(' · ')+'. '+text.control+': '+r.diagnostics.unitWeightControl.daysWithDifferentDispatch+'/'+result.protocol.days+'.';
    $('fd-json').disabled=false;$('fd-csv').disabled=false;$('fd-snapshot').disabled=false;
  }
  function download(type){
    const h=catalog.candidates.find(s=>s.id===selected),r=result.snapshots.find(s=>s.id===selected);
    let body;
    if(type==='json')body=JSON.stringify({version:'1.4',confirmatory:false,dataset:result.dataset,protocol:result.protocol,selection:catalog.selection,limitations:result.limitations,hazard:h,result:r},null,2);
    else{
      const rows=[['snapshot','valid_time_utc','model_time_utc','lead_hours','policy','coverage_pct','mean_eta_min','p95_eta_min','km','co2_kg','totalHarm','delta_harm_vs_zero','paired_bootstrap_low','paired_bootstrap_high']];
      for(const p of r.summary){const d=p.versusZero.totalHarm;rows.push([selected,h.source.valid_time_utc,h.source.model_time_utc,h.source.lead_hours,p.id,100*p.absolute.served.mean/result.protocol.incidents_per_day,...['meanEta','p95Eta','distance','co2Kg','totalHarm'].map(k=>p.absolute[k].mean),d.mean,d.bootstrap.ciLow,d.bootstrap.ciHigh]);}
      body=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
    }
    const url=URL.createObjectURL(new Blob([body],{type:type==='json'?'application/json':'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='fire-dispatch-v1.4-'+selected+'.'+type;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('fd-snapshot').addEventListener('change',()=>{selected=$('fd-snapshot').value;render();});
  $('fd-json').addEventListener('click',()=>download('json'));$('fd-csv').addEventListener('click',()=>download('csv'));
  window.addEventListener('languagechange',render);render();
  Promise.all(['fire-snapshots-v1.4.json','fire-benchmark-v1.4.json','routing-v1.0.json'].map(async name=>{
    const res=await fetch('./data/'+name,{cache:'no-store'});if(!res.ok)throw Error('Data unavailable');
    const raw=await res.arrayBuffer(),data=JSON.parse(new TextDecoder().decode(raw));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(x=>x.toString(16).padStart(2,'0')).join('');return {data,hash};
  })).then(([h,b,r])=>{
    if(h.data.dataset!=='aemet-fire-snapshots-v1.4'||b.data.confirmatory!==false||b.data.dataset.catalog_sha256!==h.hash||b.data.dataset.routing_sha256!==r.hash||JSON.stringify(h.data.selection.selected_ids)!==JSON.stringify(b.data.snapshots.map(s=>s.id)))throw Error('Dataset identity mismatch');
    catalog=h.data;result=b.data;routing=r.data;selected=catalog.selection.selected_ids[0];render();
  }).catch(()=>{failed=true;render();});
})();
