(() => {
  const NS = "http://www.w3.org/2000/svg";
  const STRATEGY_LABELS = {
    eco: "EcoDispatch",
    greedy: "Greedy",
    offline: "Offline optimum"
  };

  class LiveSimulator {
    constructor(data) {
      this.data = data;
      this.timer = null;
      this.view = "eco";
      this.svg = document.getElementById("scenario-map");
      this.seedInput = document.getElementById("sim-seed");
      this.countInput = document.getElementById("sim-count");
      this.speedInput = document.getElementById("sim-speed");
      this.events = [];
      this.cursor = 0;
      this.offlinePlan = [];
      this.strategies = {};
      this.map = null;
      this.bind();
      this.generate();
    }

    bind() {
      document.getElementById("sim-generate").addEventListener("click", () => this.generate());
      document.getElementById("sim-play").addEventListener("click", () => this.toggleRun());
      document.getElementById("sim-step").addEventListener("click", () => this.step());
      document.getElementById("sim-reset").addEventListener("click", () => this.reset());

      document.querySelectorAll(".strategy-tab").forEach(button => {
        button.addEventListener("click", () => {
          this.view = button.dataset.view;
          document.querySelectorAll(".strategy-tab").forEach(x => x.classList.toggle("active", x === button));
          document.getElementById("map-strategy-title").textContent = STRATEGY_LABELS[this.view] + " view";
          this.renderMap(true);
        });
      });

      this.speedInput.addEventListener("change", () => {
        if (this.timer) {
          this.stopTimer();
          this.startTimer();
        }
      });
    }

    generate() {
      this.stopTimer();
      const count = clampInt(Number(this.countInput.value), 4, 10, 8);
      this.countInput.value = String(count);
      const seed = this.seedInput.value.trim() || "ecodispatch";
      const random = mulberry32(hashString(seed));
      this.events = generateIncidents(this.data, count, random);
      this.offlinePlan = exactOfflinePlan(this.data.resources, this.events);
      this.resetState();
      this.setupMap();
      this.renderAll();
    }

    reset() {
      this.stopTimer();
      this.resetState();
      this.setupMap();
      this.renderAll();
    }

    resetState() {
      this.cursor = 0;
      this.strategies = {
        eco: createStrategyState(this.data.resources),
        greedy: createStrategyState(this.data.resources),
        offline: createStrategyState(this.data.resources)
      };
      this.lastDecisions = {eco: null, greedy: null, offline: null};
      document.getElementById("sim-play").textContent = "Run";
    }

    toggleRun() {
      if (this.timer) {
        this.stopTimer();
      } else if (this.cursor < this.events.length) {
        this.startTimer();
      }
    }

    startTimer() {
      document.getElementById("sim-play").textContent = "Pause";
      this.step();
      if (this.cursor >= this.events.length) return;
      const delay = clampInt(Number(this.speedInput.value), 250, 2500, 850);
      this.timer = setInterval(() => this.step(), delay);
    }

    stopTimer() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      const play = document.getElementById("sim-play");
      if (play) play.textContent = this.cursor >= this.events.length ? "Finished" : "Run";
    }

    step() {
      if (this.cursor >= this.events.length) {
        this.stopTimer();
        return;
      }

      const event = this.events[this.cursor];
      const ecoAction = chooseEco(this.data.resources, this.strategies.eco.positions, event);
      const greedyAction = chooseGreedy(this.data.resources, this.strategies.greedy.positions, event);
      const offlineAction = this.offlinePlan[this.cursor];

      this.lastDecisions = {
        eco: applyAction(this.data.resources, this.strategies.eco, event, ecoAction, this.cursor),
        greedy: applyAction(this.data.resources, this.strategies.greedy, event, greedyAction, this.cursor),
        offline: applyAction(this.data.resources, this.strategies.offline, event, offlineAction, this.cursor)
      };

      this.cursor += 1;
      this.renderAll();

      if (this.cursor >= this.events.length) this.stopTimer();
    }

    renderAll() {
      this.renderScores();
      this.renderEvent();
      this.renderQueue();
      this.renderMap(false);
      this.renderBenchmark();
      this.renderTopMetrics();
    }

    renderTopMetrics() {
      const eco = this.strategies.eco;
      const offline = this.strategies.offline;
      document.getElementById("metric-coverage").textContent = `${eco.served}/${this.cursor}`;
      const comparable = this.cursor > 0 && eco.served === offline.served && offline.cost > 0;
      document.getElementById("metric-ratio").textContent = comparable ? (eco.cost / offline.cost).toFixed(3) : "—";
      document.getElementById("metric-kmedian").textContent = this.data.placement.objective.toFixed(2);
      document.getElementById("metric-bases").textContent = this.data.placement.selected_bases.join(" · ");
    }

    renderScores() {
      for (const key of ["eco", "greedy", "offline"]) {
        const state = this.strategies[key];
        document.getElementById(`${key}-served`).textContent = `${state.served}/${this.cursor}`;
        document.getElementById(`${key}-cost`).textContent = state.cost.toFixed(2);
        document.getElementById(`${key}-distance`).textContent = state.distance.toFixed(2);
      }
    }

    renderEvent() {
      if (this.cursor === 0) {
        document.getElementById("event-name").textContent = "Waiting to run";
        document.getElementById("event-type").textContent = "—";
        document.getElementById("event-detail").textContent =
          "Press Run or Step. The sequence is already generated and the offline optimum has solved the whole finite future.";
        for (const key of ["eco", "greedy", "offline"]) {
          document.getElementById(`decision-${key}`).textContent = "—";
        }
        return;
      }

      const event = this.events[this.cursor - 1];
      document.getElementById("event-name").textContent = event.name;
      document.getElementById("event-type").textContent = event.type;
      document.getElementById("event-detail").innerHTML =
        `Severity <strong>${event.severity.toFixed(1)}</strong> · deadline <strong>${event.deadline_min.toFixed(1)} min</strong> · risk source <strong>${escapeHtml(event.source)}</strong>`;

      for (const key of ["eco", "greedy", "offline"]) {
        const decision = this.lastDecisions[key];
        document.getElementById(`decision-${key}`).textContent =
          decision && decision.resource ? `${decision.resource} · ${decision.eta.toFixed(2)} min` : "unserved";
      }
    }

    renderQueue() {
      const root = document.getElementById("event-queue");
      root.innerHTML = "";
      document.getElementById("queue-count").textContent = `${this.events.length} events`;
      this.events.forEach((event, index) => {
        const item = document.createElement("div");
        item.className = "queue-item";
        if (index < this.cursor) item.classList.add("done");
        if (index === this.cursor) item.classList.add("next");
        item.innerHTML = `
          <span class="queue-index">${String(index + 1).padStart(2, "0")}</span>
          <span><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.type)} · sev ${event.severity.toFixed(1)}</small></span>
          <span class="queue-deadline">${event.deadline_min.toFixed(0)}m</span>
        `;
        root.appendChild(item);
      });
    }

    setupMap() {
      this.svg.innerHTML = "";
      const width = 820, height = 560, pad = 58;
      const points = [
        ...this.data.candidates.map(x => x.point),
        ...this.data.demand.map(x => x.point),
        ...this.events.map(x => x.point)
      ];
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const sx = x => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad * 2);
      const sy = y => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad * 2);
      this.map = {sx, sy};

      for (let i = 0; i <= 8; i++) {
        addLine(this.svg, pad + i * (width - pad * 2) / 8, pad, pad + i * (width - pad * 2) / 8, height - pad, "#172027", 1);
      }
      for (let i = 0; i <= 6; i++) {
        addLine(this.svg, pad, pad + i * (height - pad * 2) / 6, width - pad, pad + i * (height - pad * 2) / 6, "#172027", 1);
      }

      this.data.demand.forEach(node => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", sx(node.point[0]));
        c.setAttribute("cy", sy(node.point[1]));
        c.setAttribute("r", 5 + node.risk_weight * 1.45);
        c.setAttribute("fill", "#82909a");
        c.setAttribute("opacity", ".18");
        c.setAttribute("stroke", "#82909a");
        c.setAttribute("stroke-width", "1");
        this.svg.appendChild(c);
      });

      const selected = new Set(this.data.placement.selected_bases);
      this.data.candidates.forEach(base => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", sx(base.point[0]));
        c.setAttribute("cy", sy(base.point[1]));
        c.setAttribute("r", selected.has(base.name) ? "9" : "5");
        c.setAttribute("fill", selected.has(base.name) ? "#79f2b0" : "#0d1115");
        c.setAttribute("stroke", selected.has(base.name) ? "#79f2b0" : "#60717c");
        c.setAttribute("stroke-width", selected.has(base.name) ? "2" : "1.2");
        this.svg.appendChild(c);
      });

      this.trailLayer = document.createElementNS(NS, "g");
      this.incidentLayer = document.createElementNS(NS, "g");
      this.resourceLayer = document.createElementNS(NS, "g");
      this.svg.append(this.trailLayer, this.incidentLayer, this.resourceLayer);
    }

    renderMap(force) {
      if (!this.map) return;
      const state = this.strategies[this.view];
      const {sx, sy} = this.map;

      this.trailLayer.innerHTML = "";
      state.history.forEach((move, idx) => {
        if (!move.resource) return;
        const alpha = 0.18 + 0.52 * ((idx + 1) / Math.max(state.history.length, 1));
        const line = addLine(this.trailLayer, sx(move.from[0]), sy(move.from[1]), sx(move.to[0]), sy(move.to[1]), strategyColor(this.view), 2);
        line.setAttribute("opacity", alpha.toFixed(2));
        line.setAttribute("stroke-dasharray", "5 6");
      });

      this.incidentLayer.innerHTML = "";
      if (this.cursor < this.events.length) {
        drawIncident(this.incidentLayer, this.events[this.cursor], sx, sy, true);
      }
      if (this.cursor > 0) {
        drawIncident(this.incidentLayer, this.events[this.cursor - 1], sx, sy, false);
      }

      if (force || this.resourceLayer.childElementCount !== state.positions.length) {
        this.resourceLayer.innerHTML = "";
        state.positions.forEach((point, index) => {
          const g = document.createElementNS(NS, "g");
          g.classList.add("resource-marker");
          g.dataset.resource = String(index);
          const c = document.createElementNS(NS, "circle");
          c.setAttribute("r", "10");
          c.setAttribute("fill", strategyColor(this.view));
          c.setAttribute("stroke", "#08100d");
          c.setAttribute("stroke-width", "2");
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", "14");
          t.setAttribute("y", "4");
          t.setAttribute("fill", "#f4f7f8");
          t.setAttribute("font-size", "11");
          t.setAttribute("font-weight", "700");
          t.textContent = this.data.resources[index].name;
          g.append(c, t);
          this.resourceLayer.appendChild(g);
        });
      }

      [...this.resourceLayer.children].forEach((g, index) => {
        const point = state.positions[index];
        g.style.transform = `translate(${sx(point[0])}px, ${sy(point[1])}px)`;
        const circle = g.querySelector("circle");
        circle.setAttribute("fill", strategyColor(this.view));
      });

      document.getElementById("sim-progress").textContent =
        this.cursor >= this.events.length ? `Finished · ${this.events.length} incidents` :
        `Event ${this.cursor + 1} of ${this.events.length}`;
    }

    renderBenchmark() {
      const states = this.strategies;
      const values = ["eco", "greedy", "offline"].map(k => states[k].cost);
      const max = Math.max(...values, 1);
      for (const key of ["eco", "greedy", "offline"]) {
        document.getElementById(`bar-${key}-value`).textContent = states[key].cost.toFixed(2);
        document.getElementById(`bar-${key}`).style.width = `${(states[key].cost / max) * 100}%`;
      }

      const eco = states.eco;
      const greedy = states.greedy;
      const offline = states.offline;
      const headline = document.getElementById("benchmark-headline");
      const copy = document.getElementById("benchmark-copy");

      if (this.cursor === 0) {
        headline.textContent = "Run a scenario to compare policies.";
        copy.textContent = "All three policies start from exactly the same resource positions.";
        return;
      }

      if (eco.served !== offline.served) {
        headline.textContent = `Coverage gap: EcoDispatch ${eco.served}, offline ${offline.served}.`;
        copy.textContent = "Cost ratios are not shown as equivalent when one policy serves fewer incidents.";
      } else if (offline.cost > 0) {
        const ratio = eco.cost / offline.cost;
        const vsGreedy = greedy.cost > 0 ? (1 - eco.cost / greedy.cost) * 100 : 0;
        headline.textContent = `EcoDispatch is ${ratio.toFixed(3)}× the exact offline cost so far.`;
        copy.textContent = vsGreedy >= 0
          ? `Against greedy, EcoDispatch has reduced secondary cost by ${vsGreedy.toFixed(1)}% on the processed prefix.`
          : `On this prefix, greedy is ${Math.abs(vsGreedy).toFixed(1)}% cheaper; this is useful evidence, not hidden.`;
      }
    }
  }

  function createStrategyState(resources) {
    return {
      positions: resources.map(r => [...r.point]),
      served: 0,
      unserved: 0,
      cost: 0,
      distance: 0,
      severityDelay: 0,
      history: []
    };
  }

  function generateIncidents(data, count, random) {
    const weights = data.demand.map(x => x.risk_weight);
    const total = weights.reduce((a, b) => a + b, 0);
    const types = ["medical", "fire", "drone"];
    const events = [];

    for (let i = 0; i < count; i++) {
      let ticket = random() * total;
      let source = data.demand[0];
      for (let j = 0; j < data.demand.length; j++) {
        ticket -= weights[j];
        if (ticket <= 0) { source = data.demand[j]; break; }
      }

      const jitterX = (random() - 0.5) * 1.2;
      const jitterY = (random() - 0.5) * 1.2;
      const type = types[Math.floor(random() * types.length)];
      const severity = 2 + random() * 3;
      const deadline = 5.5 + random() * 8.5;

      events.push({
        name: `S${String(i + 1).padStart(2, "0")}`,
        source: source.name,
        point: [
          clamp(source.point[0] + jitterX, -0.2, 8.7),
          clamp(source.point[1] + jitterY, -0.2, 9.0)
        ],
        type,
        severity,
        deadline_min: deadline
      });
    }
    return events;
  }

  function chooseEco(resources, positions, event) {
    let best = null;
    resources.forEach((resource, index) => {
      const evalResult = evaluate(resource, positions[index], event);
      if (!evalResult.feasible) return;
      if (!best || evalResult.cost < best.cost) best = {index, ...evalResult};
    });
    return best ? best.index : null;
  }

  function chooseGreedy(resources, positions, event) {
    let best = null;
    resources.forEach((resource, index) => {
      const evalResult = evaluate(resource, positions[index], event);
      if (!evalResult.feasible) return;
      if (!best || evalResult.distance < best.distance) best = {index, ...evalResult};
    });
    return best ? best.index : null;
  }

  function applyAction(resources, state, event, resourceIndex, eventIndex) {
    if (resourceIndex === null || resourceIndex === undefined) {
      state.unserved += 1;
      state.history.push({eventIndex, resource: null, event: event.name});
      return {resource: null, eta: NaN};
    }

    const resource = resources[resourceIndex];
    const from = [...state.positions[resourceIndex]];
    const result = evaluate(resource, from, event);
    if (!result.feasible) {
      state.unserved += 1;
      state.history.push({eventIndex, resource: null, event: event.name});
      return {resource: null, eta: NaN};
    }

    state.positions[resourceIndex] = [...event.point];
    state.served += 1;
    state.cost += result.cost;
    state.distance += result.distance;
    state.severityDelay += event.severity * result.eta;
    state.history.push({
      eventIndex,
      event: event.name,
      resource: resource.name,
      from,
      to: [...event.point],
      eta: result.eta,
      distance: result.distance,
      cost: result.cost
    });

    return {resource: resource.name, eta: result.eta};
  }

  function evaluate(resource, from, event) {
    if (!resource.capabilities.includes(event.type)) return {feasible: false};
    const distance = euclidean(from, event.point);
    const speed = resource.speed_kmh || 60;
    const eta = 60 * distance / speed;
    if (eta > event.deadline_min) return {feasible: false, distance, eta};
    const emissions = (resource.co2_g_per_km || 180) * distance;
    const cost = event.severity * eta + 0.0005 * emissions + 0.05 * distance;
    return {feasible: true, distance, eta, cost};
  }

  function exactOfflinePlan(resources, events) {
    const memo = new Map();
    const choice = new Map();
    const initial = resources.map(() => -1);

    function pointFor(resourceIndex, code) {
      return code < 0 ? resources[resourceIndex].point : events[code].point;
    }

    function solve(t, positions) {
      if (t === events.length) return {served: 0, cost: 0};
      const key = t + "|" + positions.join(",");
      if (memo.has(key)) return memo.get(key);

      let bestFuture = solve(t + 1, positions);
      let best = {served: bestFuture.served, cost: bestFuture.cost};
      let bestAction = null;

      for (let r = 0; r < resources.length; r++) {
        const evaluation = evaluate(resources[r], pointFor(r, positions[r]), events[t]);
        if (!evaluation.feasible) continue;
        const next = positions.slice();
        next[r] = t;
        const future = solve(t + 1, next);
        const candidate = {served: future.served + 1, cost: future.cost + evaluation.cost};
        if (isBetter(candidate, best)) {
          best = candidate;
          bestAction = r;
        }
      }

      memo.set(key, best);
      choice.set(key, bestAction);
      return best;
    }

    solve(0, initial);
    const plan = [];
    let positions = initial.slice();
    for (let t = 0; t < events.length; t++) {
      const key = t + "|" + positions.join(",");
      const action = choice.get(key);
      plan.push(action === undefined ? null : action);
      if (action !== null && action !== undefined) positions[action] = t;
    }
    return plan;
  }

  function isBetter(a, b) {
    return a.served > b.served || (a.served === b.served && a.cost < b.cost - 1e-9);
  }

  function drawIncident(layer, incident, sx, sy, isNext) {
    const g = document.createElementNS(NS, "g");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", sx(incident.point[0]));
    c.setAttribute("cy", sy(incident.point[1]));
    c.setAttribute("r", isNext ? "10" : "7");
    c.setAttribute("fill", isNext ? "#ff7474" : "#6a3333");
    c.setAttribute("stroke", isNext ? "#ffd2d2" : "#a75d5d");
    c.setAttribute("stroke-width", isNext ? "2" : "1");
    if (isNext) c.classList.add("pulse-incident");
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", sx(incident.point[0]) + 13);
    t.setAttribute("y", sy(incident.point[1]) - 10);
    t.setAttribute("fill", isNext ? "#ffb6b6" : "#875d5d");
    t.setAttribute("font-size", "11");
    t.textContent = incident.name;
    g.append(c, t);
    layer.appendChild(g);
  }

  function addLine(parent, x1, y1, x2, y2, stroke, width) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", width);
    parent.appendChild(line);
    return line;
  }

  function strategyColor(key) {
    return key === "eco" ? "#79f2b0" : key === "greedy" ? "#79b8ff" : "#ffb56b";
  }

  function euclidean(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function hashString(value) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampInt(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[ch]);
  }

  window.EcoDispatchSimulator = {
    init(data) {
      return new LiveSimulator(data);
    }
  };
})();
