const currentUrl="./data/current.json?v=1.2.1";
const timelineUrl="./data/timeline.json?v=1.2.1";
const routingUrl="./data/routing-v1.0.json?v=1.2.1";
const hazardUrl="./data/aemet-malaga-fwi-2025.json?v=1.2.1";
let timelineData=[];

const fetchJson=(url,label)=>fetch(url,{cache:"no-store"}).then(r=>{
  if(!r.ok)throw new Error(label+" HTTP "+r.status);
  return r.json();
});

const corePromise=Promise.all([
  fetchJson(currentUrl,"current.json"),
  fetchJson(timelineUrl,"timeline.json"),
  fetchJson(routingUrl,"routing-v1.0.json")
]).then(([data,timeline,routing])=>{
  timelineData=timeline;
  setupExperimentTabs();
  renderTimeline();
  window.ecoLab=window.EcoDispatchResearch.init(data);
  window.ecoRealRouting=window.EcoDispatchRealRoutingUI.init(data,routing);
  window.ecoRealRoutingHoldout=window.EcoDispatchRealRoutingHoldoutUI.init(data,routing);
  window.ecoAblation=window.EcoDispatchAblationUI.init(data);
  window.ecoHoldout=window.EcoDispatchHoldoutUI.init(data);
  window.ecoMonteCarlo=window.EcoDispatchMonteCarlo.init(data);
}).catch(error=>{
  console.error("EcoDispatch core data failed:",error);
  document.querySelectorAll("svg:not(#hz-chart)").forEach(svg=>{
    svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#92a0aa">Data unavailable</text>';
  });
});

const hazardPromise=fetchJson(hazardUrl,"aemet-malaga-fwi-2025.json")
  .then(hazard=>{
    window.ecoRealHazard=window.EcoDispatchRealHazardUI.init(hazard);
  })
  .catch(error=>{
    console.warn("EcoDispatch AEMET layer unavailable:",error);
    const svg=document.getElementById("hz-chart");
    if(svg)svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#92a0aa">'+
      (I18N.lang==="es"?"Datos AEMET no disponibles":"AEMET data unavailable")+'</text>';
    const generated=document.getElementById("hz-generated");
    if(generated)generated.textContent=I18N.lang==="es"?"No disponible":"Unavailable";
  });

Promise.allSettled([corePromise,hazardPromise]);

window.addEventListener("languagechange",()=>renderTimeline());

function setupExperimentTabs(){
  document.querySelectorAll(".experiment-tab").forEach(button=>{
    button.addEventListener("click",()=>{
      const target=button.dataset.experiment;
      document.querySelectorAll(".experiment-tab").forEach(x=>x.classList.toggle("active",x===button));
      document.querySelectorAll(".experiment-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===target));
    });
  });
}

function renderTimeline(){
  const root=document.getElementById("timeline");if(!root)return;
  root.innerHTML="";
  timelineData.forEach(item=>{
    const lang=I18N.lang;
    const title=item["title_"+lang]||item.title||item.title_es||item.title_en||"";
    const description=item["description_"+lang]||item.description||item.description_es||item.description_en||"";
    const wrapper=document.createElement("article");wrapper.className="timeline-item";
    const image=item.screenshot
      ? `<div class="screenshot"><img src="${escapeAttr(item.screenshot)}" alt="${escapeAttr(title)}"></div>`
      : `<div class="screenshot">${escapeHtml(I18N.t("dynamic.timelineShot"))}</div>`;
    wrapper.innerHTML=`
      <div class="timeline-meta"><strong>${escapeHtml(item.version)}</strong><span>${escapeHtml(item.date)}</span></div>
      <div class="timeline-card"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><div class="timeline-tags">${(item["tags_"+lang]||item.tags||[]).map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div>${image}</div>`;
    root.appendChild(wrapper);
  });
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
function escapeAttr(v){return escapeHtml(v);}
