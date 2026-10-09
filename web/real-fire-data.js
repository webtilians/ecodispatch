/* v1.7 descriptive EGIF layer. No imports into dispatch or simulation. */
(()=>{
  const el=document.getElementById('real-fire-content');
  const copy={
    es:{nav:'Incendios reales',title:'v1.7 · Incendios reales de Málaga',loading:'Cargando archivo EGIF…',error:'No se pudo cargar EGIF; las otras capas siguen disponibles.',
      intro:'7.496 partes oficiales EGIF · 1968–2023 · extracción y validación, sin integración en dispatch.',parts:'Partes',coords:'Coordenadas plausibles',arrivals:'Primera llegada válida',
      boundary:'Detección no equivale a ignición ni llamada. Extinción no equivale a liberación de brigada. Detección→primera llegada observada no es ETA por carretera. Sin ajuste de Poisson ni tiempos de servicio.',
      quality:'Coordenadas validadas solo por rectángulo amplio de Málaga, no por límite provincial. Horas 00:00:00 conservadas y marcadas como ambiguas: excluidas de intervalos y del histograma horario. Fechas conservadas. Sin imputación ni etiquetas inventadas para códigos.',
      months:'Mes de detección',hours:'Hora de detección',days:'Día de detección',week:['L','M','X','J','V','S','D'],counts:'Recuentos observados, no probabilidades de incendio. La cobertura y la calidad cambian con los años.',
      measure:'Intervalo (min)',n:'n válido',median:'Mediana',p90:'P90',max:'Máximo',control:'Detección → control',extinction:'Detección → extinción',arrival:'Detección → primera llegada válida',
      overlap:'Solapamiento de incendios activos',overlapNote:'No mide ocupación de brigadas. Intervalos [detección, extinción); se excluyen intervalos inválidos o ambiguos.',peak:'Máximo simultáneo',included:'Intervalos incluidos',
      provenance:'Procedencia y límites',source:'MITECO / EGIF · XML original conservado en ZIP. REDIAM permanece separado, sin cruce de registros.',license:'Licencia XML específica no localizada; se conserva la referencia al aviso legal MITECO. No se atribuye CC BY del RDF. SHA-256 verifica la copia archivada; la descarga original no validó la cadena TLS.',
      summary:'Auditoría JSON',download:'Partes JSON (~25 MB)',docs:'Método y exclusiones',denom:'Observaciones',missing:'La ausencia de coordenadas y horas de llegada limita la representatividad. Solo se describe el archivo, no se estima la eficacia operativa.'},
    en:{nav:'Real fire records',title:'v1.7 · Real Málaga fire records',loading:'Loading EGIF archive…',error:'EGIF could not be loaded; other layers remain available.',
      intro:'7,496 official EGIF reports · 1968–2023 · extraction and validation, without dispatch integration.',parts:'Reports',coords:'Plausible coordinates',arrivals:'Valid first arrival',
      boundary:'Detection is not ignition or call time. Extinction is not brigade release. Detection→first observed arrival is not road ETA. No tuning of Poisson arrivals or service times.',
      quality:'Coordinates screened only against a broad Málaga rectangle, not the province boundary. Explicit 00:00:00 times are retained and flagged as ambiguous: excluded from intervals and hour histogram. Dates retained. No imputation or invented code labels.',
      months:'Detection month',hours:'Detection hour',days:'Detection weekday',week:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],counts:'Observed counts, not fire probabilities. Coverage and quality change over the years.',
      measure:'Interval (min)',n:'Valid n',median:'Median',p90:'P90',max:'Maximum',control:'Detection → control',extinction:'Detection → extinction',arrival:'Detection → first valid arrival',
      overlap:'Fire-active overlap',overlapNote:'Not brigade occupancy. Intervals [detection, extinction); invalid or ambiguous intervals excluded.',peak:'Peak simultaneous',included:'Included intervals',
      provenance:'Provenance and boundaries',source:'MITECO / EGIF · original XML preserved in ZIP. REDIAM remains separate, without record matching.',license:'Specific XML license not located; the MITECO legal-notice reference is retained. RDF CC BY is not attributed to XML. SHA-256 verifies the archived copy; the original download did not validate the TLS chain.',
      summary:'JSON audit',download:'Incident JSON (~25 MB)',docs:'Methods and exclusions',denom:'Observations',missing:'Missing coordinates and arrival times limit representativeness. This describes the archive and does not estimate operational efficacy.'}
  };
  let data=null,failed=false;
  const lang=()=>globalThis.I18N?.lang==='en'?'en':'es';
  function render(){
    const t=copy[lang()],fmt=x=>x===null?'—':Number(x).toLocaleString(lang(),{maximumFractionDigits:2});
    document.getElementById('rf-title').textContent=t.title;
    document.getElementById('rf-nav').textContent=t.nav;
    if(!data){el.textContent=failed?t.error:t.loading;return;}
    const histogram=(key,title,labels)=>{
      const entries=Object.entries(data[key]),max=Math.max(...entries.map(x=>x[1]),1);
      return `<div class="rf-hist"><h3>${title}</h3><p>${t.denom}: ${fmt(entries.reduce((a,x)=>a+x[1],0))}</p><div class="rf-bars">${entries.map(([k,v],i)=>`<div class="rf-bin"><span>${labels?labels[i]:k}</span><meter min="0" max="${max}" value="${v}" aria-label="${title} ${labels?labels[i]:k}: ${v}">${v}</meter><span>${fmt(v)}</span></div>`).join('')}</div></div>`;
    };
    const names={detection_to_control_min:t.control,detection_to_extinguished_min:t.extinction,detection_to_first_arrival_min:t.arrival};
    el.innerHTML=`<p>${t.intro}</p><div class="rf-metrics">${[[t.parts,data.total_parts],[t.coords,data.valid_coordinates],[t.arrivals,data.valid_first_arrival]].map(([k,v])=>`<div><strong>${fmt(v)}</strong><span>${k}</span></div>`).join('')}</div>
      <p class="rf-boundary">${t.boundary}</p><p>${t.quality}</p><p>${t.counts}</p>
      <div class="rf-histograms">${histogram('by_month',t.months)}${histogram('by_hour',t.hours)}${histogram('by_day_of_week_monday_zero',t.days,t.week)}</div>
      <div class="rf-table-wrap"><table id="rf-durations"><thead><tr>${[t.measure,t.n,t.median,t.p90,t.max].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${Object.entries(data.summaries_minutes).map(([k,v])=>`<tr><th>${names[k]}</th><td>${fmt(v.n)}</td><td>${fmt(v.median)}</td><td>${fmt(v.p90)}</td><td>${fmt(v.max)}</td></tr>`).join('')}</tbody></table></div>
      <h3>${t.overlap}</h3><p>${t.peak}: <strong>${data.fire_active_overlap.max_simultaneous}</strong> · ${t.included}: ${fmt(data.fire_active_overlap.included_intervals)}</p><p>${t.overlapNote}</p><p>${t.missing}</p>
      <h3>${t.provenance}</h3><p>${t.source}</p><p>${t.license}</p><p class="rf-hash">ZIP SHA-256: ${data.provenance.source.sha256}<br>Builder ${data.provenance.builder_version} · SHA-256: ${data.provenance.builder_sha256}</p>
      <p class="rf-links"><a href="./data/real-fire-summary-v1.7.json">${t.summary}</a> · <a href="./data/real-fire-incidents-v1.7.json" download>${t.download}</a> · <a href="https://github.com/webtilians/ecodispatch/blob/master/docs/real-fire-v1.7.md">${t.docs}</a></p>`;
  }
  window.addEventListener('languagechange',render);
  render();
  fetch('./data/real-fire-summary-v1.7.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(d=>{data=d;render();}).catch(()=>{failed=true;render();});
})();
