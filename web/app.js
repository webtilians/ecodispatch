const currentUrl="./data/current.json";
const timelineUrl="./data/timeline.json";

Promise.all([
  fetch(currentUrl).then(r=>{if(!r.ok)throw new Error("No se pudieron cargar los datos del experimento");return r.json();}),
  fetch(timelineUrl).then(r=>{if(!r.ok)throw new Error("No se pudo cargar el historial");return r.json();})
]).then(([data,timeline])=>{
  renderTimeline(timeline);
  window.ecoSimulator=window.EcoDispatchSimulator.init(data);
}).catch(error=>{
  console.error(error);
  const map=document.getElementById("scenario-map");
  if(map) map.innerHTML='<text x="450" y="280" text-anchor="middle" fill="#92a0aa">No se pudieron cargar los datos del simulador</text>';
});

function renderTimeline(items){
  const root=document.getElementById("timeline");
  root.innerHTML="";
  items.forEach(item=>{
    const wrapper=document.createElement("article");
    wrapper.className="timeline-item";
    const image=item.screenshot
      ? `<div class="screenshot"><img src="${escapeAttr(item.screenshot)}" alt="Captura de ${escapeAttr(item.title)}"></div>`
      : '<div class="screenshot">Captura pendiente<br>web/assets/screenshots/</div>';
    wrapper.innerHTML=`
      <div class="timeline-meta"><strong>${escapeHtml(item.version)}</strong><span>${escapeHtml(item.date)}</span></div>
      <div class="timeline-card">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <div class="timeline-tags">${item.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
        ${image}
      </div>`;
    root.appendChild(wrapper);
  });
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
function escapeAttr(value){return escapeHtml(value);}
