(() => {
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
      this.seedInput = document.getElementById("sim-seed");
      this.countInput = document.getElementById("sim-count");
      this.speedInput = document.getElementById("sim-speed");
      this.events = [];
      this.cursor = 0;
      this.offlinePlan = [];
      this.strategies = {};
      this.lastDecisions = {eco: null, greedy: null, offline: null};
      this.leaflet = null;
      this.dynamicLayer = null;

      this.geoCandidates = data.candidates.map(x => ({...x, geo: projectPoint(data, x.point)}));
      this.geoDemand = data.demand.map(x => ({...x, geo: projectPoint(data, x.point)}));

      const placement = computePlacement(this.geoDemand, this.geoCandidates, 3);
      this.data.placement = {
        selected_bases: placement.selected,
        objective: placement.objective,
        metric: "risk-weighted geodesic km"
      };

      const baseByName = Object.fromEntries(this.geoCandidates.map(x => [x.name, x.geo]));
      const selected = placement.selected;
      const startPoints = [
        baseByName[selected[0]],
        baseByName[selected[0]],
        baseByName[selected[1]],
        baseByName[selected[2]]
      ];

      this.resources = data.resources.map((resource, index) => ({
        ...resource,
        point: [...startPoints[index]]
      }));

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
          this.renderMap();
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

      this.events = generateIncidents(this.data, this.geoDemand, count, random);
      this.offlinePlan = exactOfflinePlan(this.resources, this.events);
      this.resetState();
      this.setupMap();
      this.renderAll();
    }

    reset() {
      this.stopTimer();
      this.resetState();
      this.renderAll();
    }

    resetState() {
      this.cursor = 0;
      this.strategies = {
        eco: createStrategyState(this.resources),
        greedy: createStrategyState(this.resources),
        offline: createStrategyState(this.resources)
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
      const ecoAction = chooseEco(this.resources, this.strategies.eco.positions, event);
      const greedyAction = chooseGreedy(this.resources, this.strategies.greedy.positions, event);
      const offlineAction = this.offlinePlan[this.cursor];

      this.lastDecisions = {
        eco: applyAction(this.resources, this.strategies.eco, event, ecoAction, this.cursor),
        greedy: applyAction(this.resources, this.strategies.greedy, event, greedyAction, this.cursor),
        offline: applyAction(this.resources, this.strategies.offline, event, offlineAction, this.cursor)
      };

      this.cursor += 1;
      this.renderAll();

      if (this.cursor >= this.events.length) this.stopTimer();
    }

    renderAll() {
      this.renderScores();
      this.renderEvent();
      this.renderQueue();
      this.renderMap();
      this.renderBenchmark();
      this.renderTopMetrics();
    }

    renderTopMetrics() {
      const eco = this.strategies.eco;
      const offline = this.strategies.offline;
      document.getElementById("metric-coverage").textContent = `${eco.served}/${this.cursor}`;

      const comparable = this.cursor > 0 && eco.served === offline.served && offline.cost > 0;
      document.getElementById("metric-ratio").textContent =
        comparable ? (eco.cost / offline.cost).toFixed(3) : "—";

      document.getElementById("metric-kmedian").textContent =
        this.data.placement.objective.toFixed(2);

      document.getElementById("metric-bases").textContent =
        this.data.placement.selected_bases.join(" · ");
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
          "Press Run or Step. Events are synthetic, but their coordinates are placed over the real Málaga map.";
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
          decision && decision.resource
            ? `${decision.resource} · ${decision.eta.toFixed(2)} min`
            : "unserved";
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
          <span>
            <strong>${escapeHtml(event.name)}</strong>
            <small>${escapeHtml(event.type)} · sev ${event.severity.toFixed(1)}</small>
          </span>
          <span class="queue-deadline">${event.deadline_min.toFixed(0)}m</span>
        `;
        root.appendChild(item);
      });
    }

    setupMap() {
      const root = document.getElementById("scenario-map");

      if (!window.L) {
        root.innerHTML =
          '<div class="map-fallback">Interactive map library unavailable. The simulation logic still works, but the geographic view could not load.</div>';
        return;
      }

      if (this.leaflet) this.leaflet.remove();

      const center = this.data.geo.center;
      this.leaflet = L.map(root, {
        zoomControl: true,
        attributionControl: true
      }).setView(center, this.data.geo.zoom || 12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(this.leaflet);

      const staticLayer = L.layerGroup().addTo(this.leaflet);
      this.dynamicLayer = L.layerGroup().addTo(this.leaflet);

      this.geoDemand.forEach(node => {
        L.circleMarker(node.geo, {
          radius: 4 + node.risk_weight * 1.15,
          color: "#82909a",
          weight: 1,
          fillColor: "#82909a",
          fillOpacity: 0.15,
          opacity: 0.55
        }).bindTooltip(`${node.name} · risk ${node.risk_weight}`).addTo(staticLayer);
      });

      const selected = new Set(this.data.placement.selected_bases);
      this.geoCandidates.forEach(base => {
        L.circleMarker(base.geo, {
          radius: selected.has(base.name) ? 8 : 5,
          color: selected.has(base.name) ? "#79f2b0" : "#60717c",
          weight: selected.has(base.name) ? 2 : 1,
          fillColor: selected.has(base.name) ? "#79f2b0" : "#0d1115",
          fillOpacity: selected.has(base.name) ? 0.82 : 0.45
        }).bindTooltip(
          selected.has(base.name)
            ? `${base.name} · selected synthetic base`
            : `${base.name} · candidate synthetic base`
        ).addTo(staticLayer);
      });

      if (this.data.geo.anchor) {
        L.circleMarker(this.data.geo.anchor.point, {
          radius: 7,
          color: "#ffb56b",
          weight: 2,
          fillColor: "#ffb56b",
          fillOpacity: 0.85
        }).bindTooltip(
          `${this.data.geo.anchor.name} · official geographic reference`
        ).addTo(staticLayer);
      }

      const bounds = this.data.geo.bounds;
      const geographicBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
      );
      this.leaflet.fitBounds(geographicBounds, {padding: [18, 18]});
    }

    renderMap() {
      if (!this.leaflet || !this.dynamicLayer) return;

      this.dynamicLayer.clearLayers();
      const state = this.strategies[this.view];
      const color = strategyColor(this.view);

      state.history.forEach((move, index) => {
        if (!move.resource) return;
        L.polyline([move.from, move.to], {
          color,
          weight: 2,
          opacity: 0.2 + 0.6 * ((index + 1) / Math.max(state.history.length, 1)),
          dashArray: "5 7"
        }).addTo(this.dynamicLayer);
      });

      if (this.cursor < this.events.length) {
        const event = this.events[this.cursor];
        L.circleMarker(event.point, {
          radius: 10,
          color: "#ffd2d2",
          weight: 2,
          fillColor: "#ff7474",
          fillOpacity: 0.95
        }).bindTooltip(
          `Next: ${event.name} · ${event.type}`,
          {permanent: true, direction: "top", offset: [0, -8]}
        ).addTo(this.dynamicLayer);
      }

      if (this.cursor > 0) {
        const event = this.events[this.cursor - 1];
        L.circleMarker(event.point, {
          radius: 6,
          color: "#a75d5d",
          weight: 1,
          fillColor: "#6a3333",
          fillOpacity: 0.85
        }).bindTooltip(`Last: ${event.name}`).addTo(this.dynamicLayer);
      }

      state.positions.forEach((point, index) => {
        L.circleMarker(point, {
          radius: 9,
          color: "#08100d",
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        }).bindTooltip(
          `${this.resources[index].name} · ${STRATEGY_LABELS[this.view]}`,
          {permanent: true, direction: "right", offset: [9, 0]}
        ).addTo(this.dynamicLayer);
      });

      document.getElementById("sim-progress").textContent =
        this.cursor >= this.events.length
          ? `Finished · ${this.events.length} incidents`
          : `Event ${this.cursor + 1} of ${this.events.length}`;
    }

    renderBenchmark() {
      const states = this.strategies;
      const values = ["eco", "greedy", "offline"].map(k => states[k].cost);
      const max = Math.max(...values, 1);

      for (const key of ["eco", "greedy", "offline"]) {
        document.getElementById(`bar-${key}-value`).textContent = states[key].cost.toFixed(2);
        document.getElementById(`bar-${key}`).style.width =
          `${(states[key].cost / max) * 100}%`;
      }

      const eco = states.eco;
      const greedy = states.greedy;
      const offline = states.offline;
      const headline = document.getElementById("benchmark-headline");
      const copy = document.getElementById("benchmark-copy");

      if (this.cursor === 0) {
        headline.textContent = "Run a scenario to compare policies.";
        copy.textContent =
          "All three policies start from the same k-median-selected synthetic bases on the real Málaga map.";
        return;
      }

      if (eco.served !== offline.served) {
        headline.textContent =
          `Coverage gap: EcoDispatch ${eco.served}, offline ${offline.served}.`;
        copy.textContent =
          "Cost ratios are not treated as equivalent when one policy serves fewer incidents.";
      } else if (offline.cost > 0) {
        const ratio = eco.cost / offline.cost;
        const vsGreedy = greedy.cost > 0 ? (1 - eco.cost / greedy.cost) * 100 : 0;

        headline.textContent =
          `EcoDispatch is ${ratio.toFixed(3)}× the exact offline cost so far.`;

        copy.textContent = vsGreedy >= 0
          ? `Against greedy, EcoDispatch has reduced secondary cost by ${vsGreedy.toFixed(1)}% on the processed prefix.`
          : `On this prefix, greedy is ${Math.abs(vsGreedy).toFixed(1)}% cheaper; the simulator reports that result rather than hiding it.`;
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

  function computePlacement(demand, candidates, k) {
    const subsets = combinations(candidates, k);
    let best = {selected: [], objective: Infinity};

    for (const subset of subsets) {
      let total = 0;
      for (const node of demand) {
        let nearest = Infinity;
        for (const base of subset) {
          nearest = Math.min(nearest, haversineKm(node.geo, base.geo));
        }
        total += node.risk_weight * nearest;
      }
      if (total < best.objective) {
        best = {
          selected: subset.map(x => x.name),
          objective: total
        };
      }
    }

    return best;
  }

  function combinations(items, k) {
    const result = [];
    function walk(start, picked) {
      if (picked.length === k) {
        result.push(picked.slice());
        return;
      }
      for (let i = start; i <= items.length - (k - picked.length); i++) {
        picked.push(items[i]);
        walk(i + 1, picked);
        picked.pop();
      }
    }
    walk(0, []);
    return result;
  }

  function generateIncidents(data, demand, count, random) {
    const weights = demand.map(x => x.risk_weight);
    const total = weights.reduce((a, b) => a + b, 0);
    const types = ["medical", "fire", "drone"];
    const bounds = data.geo.bounds;
    const events = [];

    for (let i = 0; i < count; i++) {
      let ticket = random() * total;
      let source = demand[0];

      for (let j = 0; j < demand.length; j++) {
        ticket -= weights[j];
        if (ticket <= 0) {
          source = demand[j];
          break;
        }
      }

      const latJitter = (random() - 0.5) * 0.012;
      const lngJitter = (random() - 0.5) * 0.014;
      const type = types[Math.floor(random() * types.length)];

      events.push({
        name: `S${String(i + 1).padStart(2, "0")}`,
        source: source.name,
        point: [
          clamp(source.geo[0] + latJitter, bounds.south, bounds.north),
          clamp(source.geo[1] + lngJitter, bounds.west, bounds.east)
        ],
        type,
        severity: 2 + random() * 3,
        deadline_min: 5.5 + random() * 8.5
      });
    }

    return events;
  }

  function chooseEco(resources, positions, event) {
    let best = null;

    resources.forEach((resource, index) => {
      const result = evaluate(resource, positions[index], event);
      if (!result.feasible) return;

      if (!best || result.cost < best.cost) {
        best = {index, ...result};
      }
    });

    return best ? best.index : null;
  }

  function chooseGreedy(resources, positions, event) {
    let best = null;

    resources.forEach((resource, index) => {
      const result = evaluate(resource, positions[index], event);
      if (!result.feasible) return;

      if (!best || result.distance < best.distance) {
        best = {index, ...result};
      }
    });

    return best ? best.index : null;
  }

  function applyAction(resources, state, event, resourceIndex, eventIndex) {
    if (resourceIndex === null || resourceIndex === undefined) {
      state.unserved += 1;
      state.history.push({
        eventIndex,
        resource: null,
        event: event.name
      });
      return {resource: null, eta: NaN};
    }

    const resource = resources[resourceIndex];
    const from = [...state.positions[resourceIndex]];
    const result = evaluate(resource, from, event);

    if (!result.feasible) {
      state.unserved += 1;
      state.history.push({
        eventIndex,
        resource: null,
        event: event.name
      });
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

    return {
      resource: resource.name,
      eta: result.eta
    };
  }

  function evaluate(resource, from, event) {
    if (!resource.capabilities.includes(event.type)) {
      return {feasible: false};
    }

    const distance = haversineKm(from, event.point);
    const speed = resource.speed_kmh || 60;
    const eta = 60 * distance / speed;

    if (eta > event.deadline_min) {
      return {feasible: false, distance, eta};
    }

    const emissions = (resource.co2_g_per_km || 180) * distance;
    const cost =
      event.severity * eta +
      0.0005 * emissions +
      0.05 * distance;

    return {
      feasible: true,
      distance,
      eta,
      cost
    };
  }

  function exactOfflinePlan(resources, events) {
    const memo = new Map();
    const choice = new Map();
    const initial = resources.map(() => -1);

    function pointFor(resourceIndex, code) {
      return code < 0
        ? resources[resourceIndex].point
        : events[code].point;
    }

    function solve(t, positions) {
      if (t === events.length) {
        return {served: 0, cost: 0};
      }

      const key = t + "|" + positions.join(",");
      if (memo.has(key)) return memo.get(key);

      const skipFuture = solve(t + 1, positions);
      let best = {
        served: skipFuture.served,
        cost: skipFuture.cost
      };
      let bestAction = null;

      for (let r = 0; r < resources.length; r++) {
        const result = evaluate(
          resources[r],
          pointFor(r, positions[r]),
          events[t]
        );

        if (!result.feasible) continue;

        const next = positions.slice();
        next[r] = t;

        const future = solve(t + 1, next);
        const candidate = {
          served: future.served + 1,
          cost: future.cost + result.cost
        };

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

      if (action !== null && action !== undefined) {
        positions[action] = t;
      }
    }

    return plan;
  }

  function isBetter(a, b) {
    return (
      a.served > b.served ||
      (a.served === b.served && a.cost < b.cost - 1e-9)
    );
  }

  function projectPoint(data, point) {
    const bounds = data.geo.bounds;
    const xMax = 8.2;
    const yMax = 8.5;

    const lat =
      bounds.south +
      (point[1] / yMax) * (bounds.north - bounds.south);

    const lng =
      bounds.west +
      (point[0] / xMax) * (bounds.east - bounds.west);

    return [lat, lng];
  }

  function haversineKm(a, b) {
    const R = 6371.0088;
    const lat1 = degToRad(a[0]);
    const lat2 = degToRad(b[0]);
    const dLat = lat2 - lat1;
    const dLng = degToRad(b[1] - a[1]);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function degToRad(value) {
    return value * Math.PI / 180;
  }

  function strategyColor(key) {
    return key === "eco"
      ? "#79f2b0"
      : key === "greedy"
        ? "#79b8ff"
        : "#ffb56b";
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
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch]);
  }

  window.EcoDispatchSimulator = {
    init(data) {
      return new LiveSimulator(data);
    }
  };
})();
