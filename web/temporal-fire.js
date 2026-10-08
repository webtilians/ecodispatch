/* Static v1.5 temporal fire results. No runtime simulation or external API calls. */
(()=>{
  const $=id=>document.getElementById(id);
  const words={
    es:{
      intro:'Incendios con reloj, brigadas ocupadas, cola explícita y 90 minutos de servicio modelado.',
      scope:'Real: routing OSM/OSRM congelado y peligro espacial AEMET archivado. Sintético: flota, llegadas Poisson, localización uniforme de incendios, severidad, servicio, emisiones y función de daño. Exploratorio; sin preregistro ni eficacia operativa demostrada.',
      snapshot:'Predicción AEMET',load:'Carga temporal',policy:'Política para ocupación',
      low:'Baja · 12 incendios/24 h esperados',high:'Alta · 36 incendios/24 h esperados',
      events:'Eventos/día',coverage:'Cobertura',unserved:'No atendidos',response:'Respuesta media',p95:'P95 respuesta',wait:'Espera media',km:'km/día',util:'Utilización',busy:'Llegadas con 3 brigadas ocupadas',harm:'Daño sintético',delta:'ΔH vs λ=0 [bootstrap 95%]',
      occupancy:'Tiempo con brigadas libres',free0:'0 libres',free1:'1 libre',free2:'2 libres',free3:'3 libres',
      queue:'Cola y concurrencia',queueCopy:'Un incidente puede esperar hasta su límite de 120 min. Una brigada ocupada no es elegible. La disponibilidad vuelve tras viaje + 90 min de servicio. La respuesta incluye espera + viaje.',
      finding:'Lectura descriptiva',findingCopy:'λ=.2 reduce el daño sintético en la mayoría de combinaciones fijadas; λ=1 lo empeora en las seis. No se declara un λ óptimo: son seis condiciones exploratorias, con demanda y servicio modelados.',
      diagnostics:'Días con decisiones distintas frente a λ=0',coverageDiff:'Días con cobertura distinta',
      source:'Fuente AEMET',methods:'Método v1.5',json:'Exportar selección JSON',csv:'Exportar selección CSV',
      loading:'Cargando v1.5…',error:'No se pudo cargar Temporal Fire v1.5. Las secciones históricas siguen disponibles.'
    },
    en:{
      intro:'Fire incidents with a clock, busy brigades, an explicit queue and modeled 90-minute service.',
      scope:'Real: frozen OSM/OSRM routing and archived AEMET spatial hazard. Synthetic: fleet, Poisson arrivals, uniform fire locations, severity, service, emissions and harm. Exploratory; no preregistration or demonstrated operational efficacy.',
      snapshot:'AEMET forecast',load:'Temporal load',policy:'Policy for occupancy',
      low:'Low · 12 expected fires/24 h',high:'High · 36 expected fires/24 h',
      events:'Events/day',coverage:'Coverage',unserved:'Unserved',response:'Mean response',p95:'P95 response',wait:'Mean wait',km:'km/day',util:'Utilization',busy:'Arrivals with all 3 brigades busy',harm:'Synthetic harm',delta:'ΔH vs λ=0 [bootstrap 95%]',
      occupancy:'Time by free-brigade count',free0:'0 free',free1:'1 free',free2:'2 free',free3:'3 free',
      queue:'Queue and concurrency',queueCopy:'An incident may wait until its 120-minute deadline. A busy brigade is not eligible. Availability returns after travel + 90 minutes of service. Response includes wait + travel.',
      finding:'Descriptive reading',findingCopy:'λ=.2 lowers synthetic harm in most fixed combinations; λ=1 worsens it in all six. No lambda is declared optimal: these are six exploratory conditions with modeled demand and service.',
      diagnostics:'Days with different decisions vs λ=0',coverageDiff:'Days with different coverage',
      source:'AEMET source',methods:'v1.5 methods',json:'Export selected JSON',csv:'Export selected CSV',
      loading:'Loading v1.5…',error:'Temporal Fire v1.5 could not be loaded. Historical sections remain available.'
    }
  };
  const lang=()=>I18N?.lang==='en'?'en':'es',w=k=>words[lang()][k]??k;
  let data=null,selectedSnapshot=null,selectedLoad='low',selectedPolicy='0';

  function fmt(v,d=2){return Number.isFinite(v)?Number(v).toFixed(d):'—';}
  function pct(v,d=1){return Number.isFinite(v)?(100*v).toFixed(d)+'%':'—';}
  function combo(){
    return data?.snapshots.find(x=>x.snapshotId===selectedSnapshot&&x.regime===selectedLoad)||null;
  }
  function policyRow(c,id=selectedPolicy){return c?.summary.find(x=>x.id===id)||null;}

  function applyWords(){
    document.querySelectorAll('[data-tf]').forEach(el=>{const k=el.dataset.tf;if(words[lang()][k])el.textContent=w(k);});
    if(data)render();
  }

  function initSelectors(){
    const snaps=[...new Map(data.snapshots.map(x=>[x.snapshotId,x])).values()];
    const ss=$('tf-snapshot'),ls=$('tf-load'),ps=$('tf-policy');
    ss.innerHTML=snaps.map(x=>'<option value="'+x.snapshotId+'">'+x.source.valid_time_utc.replace('T12:00:00Z','')+' · lead '+x.source.lead_hours+' h</option>').join('');
    ls.innerHTML=['low','high'].map(x=>'<option value="'+x+'">'+w(x)+'</option>').join('');
    ps.innerHTML=['0','0.2','0.35','0.5','1','eta-greedy','distance-greedy'].map(x=>'<option value="'+x+'">'+(x.match(/^\d/)?'λ='+x:x)+'</option>').join('');
    selectedSnapshot=snaps[0].snapshotId;ss.value=selectedSnapshot;ls.value=selectedLoad;ps.value=selectedPolicy;
    ss.disabled=ls.disabled=ps.disabled=false;
    ss.onchange=()=>{selectedSnapshot=ss.value;render();};
    ls.onchange=()=>{selectedLoad=ls.value;render();};
    ps.onchange=()=>{selectedPolicy=ps.value;renderOccupancy();renderCards();};
    $('tf-json').disabled=$('tf-csv').disabled=false;
    $('tf-json').onclick=()=>download('json',JSON.stringify(exportObject(),null,2),'application/json');
    $('tf-csv').onclick=()=>download('csv',exportCsv(),'text/csv;charset=utf-8');
  }

  function renderCards(){
    const c=combo(),p=policyRow(c);if(!c||!p)return;
    const a=p.absolute;
    $('tf-events').textContent=fmt(a.eventCount.mean,1);
    $('tf-coverage').textContent=pct(a.coverage.mean,1);
    $('tf-unserved').textContent=fmt(a.unserved.mean,2);
    $('tf-response').textContent=fmt(a.meanResponseDelay.mean,1)+' min';
    $('tf-wait').textContent=fmt(a.meanWait.mean,1)+' min';
    $('tf-util').textContent=pct(a.utilizationMean.mean,1);
  }

  function renderTable(){
    const c=combo();if(!c)return;
    const head=['policy','coverage','unserved','response','p95','wait','km','util','busy','harm','delta'];
    $('tf-results').innerHTML='<thead><tr>'+head.map(k=>'<th>'+w(k)+'</th>').join('')+'</tr></thead><tbody>'+
      c.summary.map(p=>{
        const a=p.absolute,d=p.versusZero.totalHarm,ci=d.bootstrap;
        return '<tr data-policy="'+p.id+'"><td>'+(p.id.match(/^\d/)?'λ='+p.id:p.id)+'</td>'+
          '<td>'+pct(a.coverage.mean,2)+'</td><td>'+fmt(a.unserved.mean,3)+'</td>'+
          '<td>'+fmt(a.meanResponseDelay.mean,2)+'</td><td>'+fmt(a.p95ResponseDelay.mean,2)+'</td>'+
          '<td>'+fmt(a.meanWait.mean,2)+'</td><td>'+fmt(a.distance.mean,1)+'</td>'+
          '<td>'+pct(a.utilizationMean.mean,1)+'</td><td>'+fmt(a.arrivalsAllBusy.mean,2)+'</td>'+
          '<td>'+fmt(a.totalHarm.mean,1)+'</td><td>'+fmt(d.mean,1)+' ['+fmt(ci.ciLow,1)+', '+fmt(ci.ciHigh,1)+']</td></tr>';
      }).join('')+'</tbody>';
    $('tf-diagnostics').textContent=w('diagnostics')+': '+JSON.stringify(c.diagnostics.daysWithDifferentDispatchVsZero)+' · '+w('coverageDiff')+': '+JSON.stringify(c.diagnostics.daysWithCoverageDifference);
  }

  function renderOccupancy(){
    const c=combo(),p=policyRow(c);if(!c||!p)return;
    const a=p.absolute,vals=[
      ['free0',a.free0Share.mean],['free1',a.free1Share.mean],['free2',a.free2Share.mean],['free3',a.free3Share.mean]
    ];
    $('tf-occupancy').innerHTML=vals.map(([k,v])=>'<div class="tf-occ-row"><span>'+w(k)+'</span><div><i style="width:'+Math.max(0,Math.min(100,100*v))+'%"></i></div><strong>'+pct(v,1)+'</strong></div>').join('');
    $('tf-policy-label').textContent=selectedPolicy.match(/^\d/)?'λ='+selectedPolicy:selectedPolicy;
  }

  function renderSource(){
    const c=combo();if(!c)return;
    $('tf-source').textContent='AEMET · '+c.source.valid_time_utc+' · lead '+c.source.lead_hours+' h · '+(c.hazard?.histogram?'classes '+JSON.stringify(c.hazard.histogram):'');
  }

  function render(){
    if(!data)return;
    $('tf-status').textContent='v1.5 · '+(selectedLoad==='high'?w('high'):w('low'));
    renderCards();renderTable();renderOccupancy();renderSource();
  }

  function exportObject(){
    const c=combo();
    return {version:data.version,benchmark:data.benchmark,confirmatory:false,protocol:data.protocol,dataset:data.dataset,selection:{snapshotId:selectedSnapshot,regime:selectedLoad},result:c};
  }
  function exportCsv(){
    const c=combo(),cols=['snapshot','load','policy','coverage','unserved','mean_response','p95_response','mean_wait','distance_km','co2_kg','utilization','all_busy_arrivals','totalHarm','deltaH','bootstrap_low','bootstrap_high'];
    const rows=[cols];
    for(const p of c.summary){
      const a=p.absolute,d=p.versusZero.totalHarm;
      rows.push([c.snapshotId,c.regime,p.id,a.coverage.mean,a.unserved.mean,a.meanResponseDelay.mean,a.p95ResponseDelay.mean,a.meanWait.mean,a.distance.mean,a.co2Kg.mean,a.utilizationMean.mean,a.arrivalsAllBusy.mean,a.totalHarm.mean,d.mean,d.bootstrap.ciLow,d.bootstrap.ciHigh]);
    }
    const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    return rows.map(r=>r.map(q).join(',')).join('\r\n');
  }
  function download(ext,content,type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ecodispatch-v1.5-temporal-fire-'+selectedSnapshot+'-'+selectedLoad+'.'+ext;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function boot(){
    applyWords();$('tf-status').textContent=w('loading');
    try{
      const r=await fetch('./data/temporal-fire-v1.5.json?v=1.5',{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      data=await r.json();
      if(data.version!=='1.5'||data.confirmatory!==false||data.snapshots.length!==6)throw Error('v1.5 identity mismatch');
      initSelectors();render();
    }catch(e){console.error(e);$('tf-status').textContent=w('error');}
  }
  window.addEventListener('languagechange',applyWords);
  boot();
})();