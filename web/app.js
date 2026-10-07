const currentUrl = "./data/current.json";
const timelineUrl = "./data/timeline.json";

Promise.all([
  fetch(currentUrl).then(r => {
    if (!r.ok) throw new Error("Could not load current experiment");
    return r.json();
  }),
  fetch(timelineUrl).then(r => {
    if (!r.ok) throw new Error("Could not load timeline");
    return r.json();
  })
]).then(([data, timeline]) => {
  renderMetrics(data);
  renderScenario(data);
  renderDispatch(data);
  renderBenchmark(data);
  renderTimeline(timeline);
}).catch(error => {
  console.error(error);
  const map = document.getElementById("scenario-map");
  map.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#92a0aa">Dashboard data unavailable</text>';
});

function renderMetrics(data) {
  const served = data.dispatch.length;
  const total = data.incidents.length;
  document.getElementById("metric-coverage").textContent = `${served}/${total}`;
  document.getElementById("metric-ratio").textContent = data.benchmark.empirical_ratio.toFixed(3);
  document.getElementById("metric-kmedian").textContent = data.placement.objective.toFixed(2);
  document.getElementById("metric-bases").textContent = data.placement.selected_bases.join(" · ");
}

function renderScenario(data) {
  const svg = document.getElementById("scenario-map");
  const NS = "http://www.w3.org/2000/svg";
  const width = 820, height = 560, pad = 58;

  const points = [
    ...data.candidates.map(x => x.point),
    ...data.demand.map(x => x.point),
    ...data.incidents.map(x => x.point)
  ];
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = x => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad * 2);
  const sy = y => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad * 2);

  for (let i = 0; i <= 8; i++) {
    const line = document.createElementNS(NS, "line");
    const x = pad + i * (width - pad * 2) / 8;
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", pad); line.setAttribute("y2", height - pad);
    line.setAttribute("stroke", "#172027"); line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }
  for (let i = 0; i <= 6; i++) {
    const line = document.createElementNS(NS, "line");
    const y = pad + i * (height - pad * 2) / 6;
    line.setAttribute("x1", pad); line.setAttribute("x2", width - pad);
    line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("stroke", "#172027"); line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }

  const resources = Object.fromEntries(data.resources.map(r => [r.name, r]));
  const incidents = Object.fromEntries(data.incidents.map(i => [i.name, i]));

  data.dispatch.forEach(pair => {
    const resource = resources[pair.resource];
    const incident = incidents[pair.incident];
    const path = document.createElementNS(NS, "line");
    path.setAttribute("x1", sx(resource.point[0]));
    path.setAttribute("y1", sy(resource.point[1]));
    path.setAttribute("x2", sx(incident.point[0]));
    path.setAttribute("y2", sy(incident.point[1]));
    path.setAttribute("stroke", "#79b8ff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "7 7");
    path.setAttribute("opacity", ".72");
    svg.appendChild(path);
  });

  data.demand.forEach(node => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", sx(node.point[0]));
    c.setAttribute("cy", sy(node.point[1]));
    c.setAttribute("r", 5 + node.risk_weight * 1.45);
    c.setAttribute("fill", "#82909a");
    c.setAttribute("opacity", ".22");
    c.setAttribute("stroke", "#82909a");
    c.setAttribute("stroke-width", "1");
    svg.appendChild(c);
  });

  const selected = new Set(data.placement.selected_bases);
  data.candidates.forEach(base => {
    const g = document.createElementNS(NS, "g");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", sx(base.point[0]));
    c.setAttribute("cy", sy(base.point[1]));
    c.setAttribute("r", selected.has(base.name) ? "10" : "6");
    c.setAttribute("fill", selected.has(base.name) ? "#79f2b0" : "#0d1115");
    c.setAttribute("stroke", selected.has(base.name) ? "#79f2b0" : "#60717c");
    c.setAttribute("stroke-width", selected.has(base.name) ? "2" : "1.5");
    g.appendChild(c);

    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", sx(base.point[0]) + 12);
    t.setAttribute("y", sy(base.point[1]) + 4);
    t.setAttribute("fill", selected.has(base.name) ? "#dfffea" : "#71818b");
    t.setAttribute("font-size", "11");
    t.textContent = base.name;
    g.appendChild(t);
    svg.appendChild(g);
  });

  data.incidents.forEach(incident => {
    const g = document.createElementNS(NS, "g");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", sx(incident.point[0]));
    c.setAttribute("cy", sy(incident.point[1]));
    c.setAttribute("r", "7");
    c.setAttribute("fill", "#ff7474");
    c.setAttribute("stroke", "#ffd2d2");
    c.setAttribute("stroke-width", "1.4");
    g.appendChild(c);

    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", sx(incident.point[0]) + 11);
    t.setAttribute("y", sy(incident.point[1]) - 9);
    t.setAttribute("fill", "#ffb6b6");
    t.setAttribute("font-size", "11");
    t.textContent = incident.name;
    g.appendChild(t);
    svg.appendChild(g);
  });
}

function renderDispatch(data) {
  const root = document.getElementById("dispatch-list");
  root.innerHTML = "";
  data.dispatch.forEach(pair => {
    const item = document.createElement("div");
    item.className = "dispatch-item";
    item.innerHTML = `
      <div class="resource-badge">${escapeHtml(pair.resource)}</div>
      <div>
        <strong>${escapeHtml(pair.resource)} → ${escapeHtml(pair.incident)}</strong>
        <small>${pair.distance_km.toFixed(2)} km · cost ${pair.secondary_cost.toFixed(2)}</small>
      </div>
      <div class="eta">
        <strong>${pair.eta_min.toFixed(2)} min</strong>
        <small>ETA</small>
      </div>
    `;
    root.appendChild(item);
  });
}

function renderBenchmark(data) {
  const online = data.benchmark.online_cost;
  const offline = data.benchmark.offline_optimum;
  const max = Math.max(online, offline, 1);
  document.getElementById("online-value").textContent = online.toFixed(3);
  document.getElementById("offline-value").textContent = offline.toFixed(3);
  document.getElementById("online-bar").style.width = `${(online / max) * 100}%`;
  document.getElementById("offline-bar").style.width = `${(offline / max) * 100}%`;

  const extra = (data.benchmark.empirical_ratio - 1) * 100;
  document.getElementById("benchmark-copy").textContent =
    `Current nearest-server baseline travels ${extra.toFixed(1)}% more than the offline optimum on this request sequence. This is the gap future online policies should reduce.`;
}

function renderTimeline(items) {
  const root = document.getElementById("timeline");
  root.innerHTML = "";
  items.forEach(item => {
    const wrapper = document.createElement("article");
    wrapper.className = "timeline-item";

    const image = item.screenshot
      ? `<div class="screenshot"><img src="${escapeAttr(item.screenshot)}" alt="${escapeAttr(item.title)} screenshot"></div>`
      : '<div class="screenshot">Screenshot slot<br>web/assets/screenshots/</div>';

    wrapper.innerHTML = `
      <div class="timeline-meta">
        <strong>${escapeHtml(item.version)}</strong>
        <span>${escapeHtml(item.date)}</span>
      </div>
      <div class="timeline-card">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <div class="timeline-tags">
            ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        ${image}
      </div>
    `;
    root.appendChild(wrapper);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[ch]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
