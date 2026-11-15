/* Earth Analogs – guided mission experience */
(function () {
  const { sites: CURATED, targets: TARGETS, generated } = window.TW_DATA;
  const { KEYS, CLIMATE_KEYS, PROFILES } = TW;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // one stroke icon per mission profile (no emoji as icons)
  const PROFILE_SVG = {
    balanced: '<path d="M12 4v16M7 20h10M4 8h16"/><path d="M6 8l-3 6h6zM18 8l-3 6h6z"/>',
    habitat: '<path d="M3 19h18"/><path d="M5 19v-5a7 7 0 0 1 14 0v5"/><path d="M10 19v-4h4v4"/>',
    isru: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    mobility: '<rect x="4" y="8" width="16" height="6" rx="1.5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M12 8V5h4"/>',
    astrobio: '<circle cx="12" cy="12" r="8"/><circle cx="10" cy="10" r="2"/><circle cx="15" cy="14.5" r="1.3"/>',
    caves: '<path d="M3 20c1-8 4-13 9-13s8 5 9 13"/><path d="M8 20c.5-4 2-7 4-7s3.5 3 4 7"/>',
    power: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  };
  const icon = id => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PROFILE_SVG[id]}</svg>`;
  const CODE_T = { moon_shackleton: "SHK", moon_malapert: "MLP", moon_tranquillitatis_pit: "TRQ", mars_jezero: "JEZ", mars_gale: "GAL",
    mars_arcadia: "ARC", mars_deuteronilus: "DTN", mars_arsia_caves: "ARS", mars_meridiani: "MER" };
  const CODE_P = { balanced: "GEN", habitat: "HAB", isru: "ISR", mobility: "MOV", astrobio: "BIO", caves: "CAV", power: "POL" };
  // per-viewer conveniences only (crew name, flight count); the page works without them
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ea." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("ea." + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const TEX = { Earth: "assets/earth.jpg", Moon: "assets/moon.jpg", Mars: "assets/mars.jpg" };
  const POWER_PARAMS = "T2M,T2M_RANGE,T2M_MIN,T2M_MAX,PRECTOTCORR,RH2M,PS,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_UV_INDEX,WS10M";
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const LST_YEAR = 2023;
  const GEO_KIND = { basalt: "mapped", salts: "mapped", sediment: "mapped", ice: "measured", regolith: "measured" };

  const state = {
    lang: (navigator.language || "es").startsWith("es") ? "es" : "en",
    stage: "intro", body: "Moon", targetId: null, profile: null,
    mode: "match", tab: "verdict", selectedId: null, scan: null, scanBusy: false,
    crew: Object.assign({ name: "", role: "cmd" }, store.get("crew", {})), code: null,
  };
  const crewName = () => state.crew.name.trim() || T().crew.anon;
  const roleLabel = () => (T().crew.roles[state.crew.role] || T().crew.roles.cmd)[0];
  const missionCode = () => `EA-${CODE_T[state.targetId] || "XXX"}-${CODE_P[state.profile] || "GEN"}-${String(store.get("flights", 0) + 1).padStart(2, "0")}`;
  CURATED.forEach(s => (s.fp = TW.fingerprint(s)));
  // names follow the language: proper names stay, English descriptors are translated (js/i18n-data.js)
  [...CURATED, ...TARGETS].forEach(x => (x.name_en = x.name));
  function applyNames() { [...CURATED, ...TARGETS].forEach(x => (x.name = (state.lang === "es" && I18N_DATA.name.es[x.id]) || x.name_en)); }
  applyNames();

  const T = () => I18N[state.lang];
  const FL = k => I18N_FEATURES[state.lang][k];
  const PL = id => I18N_PROFILES[state.lang][id];
  // text that lives in the data files, in the viewer's language (see js/i18n-data.js)
  const CTRY = c => (state.lang === "es" && I18N_DATA.country.es[c]) || c;
  const NOTE = s => (state.lang === "es" && I18N_DATA.note.es[s.id]) || s.note;
  const PROV = txt => (state.lang === "es" ? I18N_DATA.prov.es.reduce((t, [re, rep]) => t.replace(re, rep), txt) : txt);
  const dec = (v, d) => (v == null ? "" : v.toLocaleString(state.lang === "es" ? "es-EC" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const target = () => TARGETS.find(t => t.id === state.targetId);
  const short = n => n.split(" (")[0];
  const allSites = () => (state.scan ? CURATED.concat(state.scan) : CURATED);
  const isMobile = () => innerWidth <= 820;

  // ---------- color ----------
  const STOPS = ["#27325e", "#2f6fd0", "#25b0a6", "#9fdc5a", "#ffd166"];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function scoreColor(score, lo = 30, hi = 75) {
    const t = TW.clamp((score - lo) / (hi - lo)) * (STOPS.length - 1);
    const i = Math.min(Math.floor(t), STOPS.length - 2), f = t - i;
    const a = hex(STOPS[i]), b = hex(STOPS[i + 1]);
    return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`;
  }
  const matchColor = v => (v >= 0.8 ? "var(--good)" : v >= 0.55 ? "var(--warn)" : "var(--bad)");

  // ---------- scoring ----------
  const weights = () => TW.profileWeights(state.profile || "balanced");
  function rank(mode = state.mode, sites = allSites()) {
    const t = target(), w = weights();
    return sites.map(s => {
      const c = TW.compare(s.fp, t, w);
      let value = c.score;
      if (mode === "untapped") value = c.score * (1 - 0.75 * (s.usage ?? 0));
      if (mode === "ready") value = c.score * (0.6 + 0.4 * (s.access ?? 0.5));
      return { site: s, ...c, value };
    }).sort((a, b) => b.value - a.value);
  }

  // ---------- globe ----------
  const gEl = $("#globe");
  const globe = Globe()(gEl)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl(TEX.Earth)
    .showAtmosphere(true).atmosphereColor("#7aa2ff").atmosphereAltitude(0.16)
    .pointsMerge(false).pointsTransitionDuration(900)
    .pointLat("lat").pointLng("lng").pointAltitude("alt").pointRadius("r").pointColor("color").pointLabel("label")
    .htmlLat("lat").htmlLng("lng").htmlAltitude("alt").htmlElement(d => d.el)
    .ringLat("lat").ringLng("lng").ringColor(() => t => `rgba(255,155,71,${1 - t})`).ringMaxRadius(4).ringPropagationSpeed(2.5).ringRepeatPeriod(1100)
    .arcStartLat("a0").arcStartLng("o0").arcEndLat("a1").arcEndLng("o1").arcColor(() => ["#36c2b4", "#ff9b47"]).arcStroke(0.6)
    .arcDashLength(0.4).arcDashGap(0.2).arcDashAnimateTime(2200).arcAltitudeAutoScale(0.4)
    .onPointClick(p => p.onClick && p.onClick())
    .onPointHover(p => { gEl.style.cursor = p ? "pointer" : ""; })
    .onGlobeClick(({ lat, lng }) => {
      if ((state.stage === "verdict" && state.tab === "scan") || state.stage === "earth") scanPoint(lat, lng);
      else if (state.stage === "verdict" && state.tab === "map") heatClick(lat, lng);
    });
  const ctl = globe.controls();
  ctl.autoRotate = true; ctl.autoRotateSpeed = 0.35; ctl.enableDamping = true;
  let currentTex = "Earth";
  document.body.dataset.world = "Earth";
  // the colours follow the world on screen: the globe's halo and the space around it
  const HALO = { Earth: ["#7aa2ff", 0.16], Moon: ["#c9d3f5", 0.1], Mars: ["#ff9a6b", 0.14] };
  function setTexture(body) {
    document.body.dataset.world = body;
    if (currentTex !== body) { globe.globeImageUrl(TEX[body]).atmosphereColor(HALO[body][0]).atmosphereAltitude(HALO[body][1]); currentTex = body; }
  }

  function layoutGlobe() {
    let left = 0, height = innerHeight;
    if (isMobile()) height = state.stage === "intro" ? innerHeight : innerHeight * 0.44;
    else if (state.stage === "intro") left = innerWidth * 0.36;
    else if (state.stage !== "launch") left = 450;
    gEl.style.left = left + "px";
    globe.width(innerWidth - left).height(height);
  }
  addEventListener("resize", layoutGlobe);

  function labelEl(text, cls = "") { const d = document.createElement("div"); d.className = "scene-label " + cls; d.textContent = text; return d; }
  function landerEl() {
    const d = document.createElement("div");
    d.innerHTML = $("#ship").outerHTML.replace('id="ship"', "").replace('class="ship"', 'class="lander"');
    return d.firstElementChild;
  }
  function clearLayers() { globe.pointsData([]).htmlElementsData([]).ringsData([]).arcsData([]); }

  function showTargetsOnGlobe() {
    setTexture(state.body);
    const list = TARGETS.filter(t => t.body === state.body);
    globe.pointsData(list.map(t => ({ lat: t.lat, lng: t.lon, alt: 0.02, r: t.id === state.targetId ? 1.1 : 0.7, color: t.id === state.targetId ? "#ff9b47" : "#ffd9b8",
      label: `<b>${esc(t.name)}</b>`, onClick: () => pickTarget(t.id) })));
    // label only the chosen site (polar sites sit too close together to label all of them)
    const shown = state.targetId ? list.filter(t => t.id === state.targetId) : list.filter((t, i, a) => !a.slice(0, i).some(o => Math.abs(o.lat - t.lat) < 6));
    globe.htmlElementsData(shown.map(t => ({ lat: t.lat, lng: t.lon, alt: 0.03, el: labelEl(short(t.name), t.id === state.targetId ? "win" : "") })));
    globe.ringsData(state.targetId ? [{ lat: target().lat, lng: target().lon }] : []).arcsData([]);
  }

  function showEarthResults(results, focus) {
    setTexture("Earth");
    const lo = Math.min(...results.map(r => r.score)), hi = Math.max(...results.map(r => r.score));
    const win = results[0].site;
    globe.pointsData(results.map(r => {
      const s = r.site, on = s.id === state.selectedId;
      return { lat: s.lat, lng: s.lon, alt: 0.01 + 0.28 * TW.clamp((r.score - lo) / (hi - lo || 1)) ** 1.5, r: on ? 0.75 : 0.42,
        color: on ? "#ff9b47" : scoreColor(r.score, lo, hi), label: `<b>${esc(s.name)}</b><br>${T().twinScore}: ${dec(r.score, 1)}`,
        onClick: () => selectSite(s.id) };
    }));
    const sel = allSites().find(s => s.id === state.selectedId) || win;
    globe.htmlElementsData([{ lat: sel.lat, lng: sel.lon, alt: 0.02, el: landerEl() }, { lat: sel.lat, lng: sel.lon, alt: 0.02, el: labelEl(sel.name.split(" – ")[0], "win") }]);
    globe.ringsData([{ lat: sel.lat, lng: sel.lon }]).arcsData([]);
    if (focus) globe.pointOfView({ lat: sel.lat, lng: sel.lon, altitude: 1.6 }, 1600);
  }

  // ---------- chrome ----------
  function renderChrome() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i]").forEach(el => (el.textContent = T()[el.dataset.i]));
    document.querySelectorAll("#lang button").forEach(b => b.classList.toggle("on", b.dataset.l === state.lang));
    const idx = { intro: -1, earth: -1, crew: 0, dest: 1, mission: 2, brief: 2, launch: 3, verdict: 4 }[state.stage];
    $("#soundBtn span").textContent = SFX.on ? T().soundOn : T().soundOff;
    $("#soundBtn").setAttribute("aria-pressed", String(SFX.on));
    $("#guideX").setAttribute("aria-label", T().guideHide);
    $("#guideSound").hidden = SFX.on; $("#guideSound").textContent = T().soundAsk;
    $("#homeBtn").title = state.lang === "es" ? "Inicio" : "Home";
    $("#progress").innerHTML = T().steps.map((s, i) => `<li class="${i === idx ? "on" : i < idx ? "done" : ""}"><i>${i < idx ? "✓" : i + 1}</i><span>${s}</span></li>`).join("");
    document.body.dataset.stage = state.stage;
  }
  function guideStage(stage) {
    const G = T().guide;
    if (stage === "verdict") {
      const s = allSites().find(x => x.id === state.selectedId);
      if (s) Guide.say(G.verdict(crewName(), s.name.split(" – ")[0]));
      return;
    }
    const line = { intro: G.intro, earth: G.earth, crew: G.crew, dest: G.dest(crewName()), mission: G.mission, brief: G.brief }[stage];
    if (line) Guide.say(line);
  }
  function go(stage) {
    state.stage = stage; renderChrome(); layoutGlobe(); renderPanel();
    guideStage(stage);
    $("#hint").hidden = true;
  }

  // ---------- panel per stage ----------
  function patchOpts() { return { name: crewName(), code: state.stage === "crew" ? "EA" : state.code || missionCode(), body: state.stage === "crew" ? null : target()?.body }; }
  function renderPanel() {
    const p = $("#panel");
    if (state.stage === "crew") {
      const C = T().crew;
      p.innerHTML = `<div class="p-body">
        <h2 class="p-title">${C.title}</h2><p class="p-sub">${C.lead}</p>
        <div class="patch-wrap"><canvas class="patch" id="patch" role="img" aria-label="${esc(C.title)}"></canvas></div>
        <div class="field"><label for="crewName">${C.name}</label>
          <input type="text" id="crewName" maxlength="24" autocomplete="nickname" spellcheck="false" placeholder="${esc(C.placeholder)}" value="${esc(state.crew.name)}"></div>
        <fieldset class="field"><legend>${C.role}</legend><div class="roles">
          ${Object.entries(C.roles).map(([id, [label, desc]]) => `<label class="role"><input type="radio" name="role" value="${id}" ${state.crew.role === id ? "checked" : ""}><span><b>${label}</b><small>${desc}</small></span></label>`).join("")}
        </div></fieldset>
        <p class="privacy">${C.privacy}</p>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big" id="crewGo">${C.go}</button></div>`;
      const paint = () => Patch.paint($("#patch"), patchOpts());
      requestAnimationFrame(paint);
      $("#crewName").oninput = e => { state.crew.name = e.target.value; paint(); };
      p.querySelectorAll('input[name="role"]').forEach(r => (r.onchange = () => { state.crew.role = r.value; }));
      $("#backBtn").onclick = goHome;
      $("#crewGo").onclick = () => {
        store.set("crew", state.crew);
        SFX.go();
        go("dest"); ctl.autoRotate = false; showTargetsOnGlobe(); globe.pointOfView({ lat: -20, lng: 20, altitude: 2.4 }, 1200);
      };
    }
    if (state.stage === "brief") {
      const t = target(), B = T().brief;
      const facts = (state.lang === "es" && I18N_TARGET_FACTS.es[t.id]) || t.facts || [];
      p.innerHTML = `<div class="p-body brief">
        <p class="brief-code">${state.code}</p>
        <div class="brief-head"><canvas class="patch" id="patch" role="img" aria-label="${esc(state.code)}"></canvas>
          <div><h2 class="p-title">${B.title}</h2><p class="p-sub">${esc(B.hello(crewName(), roleLabel()))}</p></div></div>
        <div class="sec">${B.why}: ${esc(short(t.name))}</div>
        <ul class="facts">${facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="sec">${B.rehearse}</div>
        <p>${I18N_PROFILE_WHY[state.lang][state.profile]}</p>
        <p class="objective">${B.objective(PL(state.profile), esc(short(t.name)))}</p>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big" id="acceptBtn">${B.accept}</button></div>`;
      requestAnimationFrame(() => Patch.paint($("#patch"), patchOpts()));
      $("#backBtn").onclick = () => go("mission");
      $("#acceptBtn").onclick = () => { store.set("flights", store.get("flights", 0) + 1); launch(); };
    }
    if (state.stage === "dest") {
      const list = TARGETS.filter(t => t.body === state.body);
      p.innerHTML = `<div class="p-body">
        <h2 class="p-title">${T().chooseBody}</h2>
        <div class="bodies">${["Moon", "Mars"].map(b => `<button class="body-btn ${b === state.body ? "on" : ""}" data-b="${b}"><span class="orb ${b}"></span>${b === "Moon" ? T().moon : T().mars}</button>`).join("")}</div>
        <p class="p-sub">${T().chooseSite}</p>
        <div class="sites">${list.map(t => `<button class="site-btn ${t.id === state.targetId ? "on" : ""}" data-id="${t.id}"><b>${esc(short(t.name))}</b><span>${esc(I18N_TARGET_TAG[state.lang][t.id])}</span></button>`).join("")}</div>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn" id="nextBtn" ${state.targetId ? "" : "disabled"}>${T().next}</button></div>`;
      p.querySelectorAll(".body-btn").forEach(b => (b.onclick = () => { state.body = b.dataset.b; state.targetId = null; showTargetsOnGlobe(); globe.pointOfView({ lat: 0, lng: 0, altitude: 2.4 }, 1000); renderPanel(); }));
      p.querySelectorAll(".site-btn").forEach(b => (b.onclick = () => pickTarget(b.dataset.id)));
      $("#backBtn").onclick = goHome;
      $("#nextBtn").onclick = () => go("mission");
    }
    if (state.stage === "mission") {
      const t = target();
      p.innerHTML = `<div class="p-body">
        <div class="chosen"><span class="orb ${t.body}" style="width:22px;height:22px;border-radius:50%;display:inline-block"></span><span><b>${esc(short(t.name))}</b> · ${t.body === "Moon" ? T().moon : T().mars}</span></div>
        <h2 class="p-title" style="margin-bottom:14px">${T().chooseMission}</h2>
        <div class="missions">${Object.keys(PROFILES).map(id => `<button class="mission ${id === state.profile ? "on" : ""}" data-id="${id}">${icon(id)}<b>${PL(id)}</b><span>${I18N_PROFILE_DESC[state.lang][id]}</span></button>`).join("")}</div>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big" id="launchBtn" ${state.profile ? "" : "disabled"}>${T().launch}</button></div>`;
      p.querySelectorAll(".mission").forEach(b => (b.onclick = () => {
        state.profile = b.dataset.id; renderPanel();
        Guide.say(`${PL(b.dataset.id)}. ${I18N_PROFILE_WHY[state.lang][b.dataset.id].split(". ")[0]}.`.replace("..", "."));
      }));
      $("#backBtn").onclick = () => go("dest");
      $("#launchBtn").onclick = () => { state.code = missionCode(); go("brief"); };
    }
    if (state.stage === "verdict") renderVerdictPanel();
    if (state.stage === "earth") renderEarthPanel();
  }

  function pickTarget(id) {
    const t = TARGETS.find(x => x.id === id);
    state.targetId = id; state.body = t.body; ctl.autoRotate = false;
    showTargetsOnGlobe();
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 70 : t.lat, lng: t.lon, altitude: 1.5 }, 1200);
    if (state.stage === "dest") { renderPanel(); Guide.say(T().guide.targets[id]); }
  }
  function goHome() {
    history.replaceState(null, "", location.pathname);
    clearLayers(); setTexture("Earth"); ctl.autoRotate = true;
    globe.pointOfView({ lat: 10, lng: -40, altitude: 2.3 }, 1000);
    go("intro");
  }

  // ---------- the journey: GO/NO-GO poll, countdown, cruise, re-entry, touchdown ----------
  let run = null; // the journey in progress; skipping resolves every wait at once
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = (v, d = 0) => v.toLocaleString(state.lang === "es" ? "es-EC" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sfx = f => { if (run && !run.skipped) f(); };
  function pause(ms) {
    if (!run || run.skipped) return Promise.resolve();
    if (reduced()) ms = Math.min(ms, 150);
    return new Promise(res => { const id = setTimeout(res, ms); run.waits.push(() => { clearTimeout(id); res(); }); });
  }
  function track(anim) {
    if (run) { run.anims.push(anim); if (run.skipped) anim.finish(); }
    // backup in case the browser stops animating a hidden tab
    const backup = setTimeout(() => { try { anim.finish(); } catch { /* cancelled */ } }, (anim.effect?.getTiming().duration || 0) + 400);
    return anim.finished.catch(() => {}).finally(() => clearTimeout(backup));
  }
  function tween(ms, fn) {
    if (reduced()) ms = Math.min(ms, 300);
    if (!run || run.skipped) { fn(1); return Promise.resolve(); }
    return new Promise(res => {
      const t0 = performance.now();
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(backup); fn(1); res(); };
      const backup = setTimeout(finish, ms + 400); // browsers pause animation frames in hidden tabs
      run.waits.push(finish);
      const step = now => { if (done) return; const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(step); else finish(); };
      requestAnimationFrame(step);
    });
  }
  function skipJourney() {
    if (!run || run.skipped) return;
    run.skipped = true;
    Guide.hush();
    run.waits.splice(0).forEach(f => f());
    run.anims.forEach(a => { try { a.finish(); } catch { /* already finished */ } });
    run.onSkip();
  }
  async function typeLine(html, cls = "") {
    const body = $("#termBody");
    body.querySelectorAll(".cur").forEach(e => e.classList.remove("cur"));
    const line = document.createElement("div"); line.className = "cur " + cls; body.appendChild(line);
    const text = html.replace(/<[^>]+>/g, "");
    if (run && !run.skipped && !reduced()) {
      for (let i = 1; i <= text.length && !run.skipped; i += 3) { line.textContent = "> " + text.slice(0, i); await sleep(12); }
    }
    line.innerHTML = "> " + html;
    body.scrollTop = body.scrollHeight;
    await pause(240);
  }
  function globeCenter() { const r = gEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height, innerHeight) / 2 }; }
  function flyShip(from, to, rot, scale, ms) {
    return track($("#ship").animate([
      { transform: `translate(${from.x - 32}px, ${from.y - 32}px) rotate(${rot}deg) scale(${scale[0]})`, opacity: 1 },
      { transform: `translate(${to.x - 32}px, ${to.y - 32}px) rotate(${rot}deg) scale(${scale[1]})`, opacity: 1 },
    ], { duration: reduced() ? 1 : ms, easing: "cubic-bezier(.55,.05,.35,1)", fill: "forwards" }));
  }

  // live data links: the verdict uses the stored dataset, these feed the live scan
  function ping(url) {
    const ac = new AbortController(), id = setTimeout(() => ac.abort(), 5000);
    return fetch(url, { signal: ac.signal }).then(r => r.ok).catch(() => false).finally(() => clearTimeout(id));
  }
  async function pollSystems(site) {
    const P = T().poll;
    const checks = [
      [P.catalog(CURATED.length), Promise.resolve(true)],
      [P.target, Promise.resolve(true)],
      [P.power, ping(`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=RE&longitude=${site.lon}&latitude=${site.lat}&format=JSON`)],
      [P.dem, ping(`https://api.open-meteo.com/v1/elevation?latitude=${site.lat}&longitude=${site.lon}`)],
      [P.pc, ping("https://planetarycomputer.microsoft.com/api/stac/v1/collections/alos-palsar-mosaic")],
      [P.macro, ping(`https://macrostrat.org/api/v2/geologic_units/map?lat=${site.lat}&lng=${site.lon}`)],
    ];
    await typeLine(`<span class="k">${P.title}</span>`);
    const box = document.createElement("div"); box.className = "poll";
    $("#termBody").appendChild(box);
    for (const [label, check] of checks) {
      const name = document.createElement("span"), status = document.createElement("span");
      name.textContent = label; status.textContent = P.wait;
      box.append(name, status);
      $("#termBody").scrollTop = $("#termBody").scrollHeight;
      const ok = await Promise.race([check, run.skipP.then(() => true)]);
      status.textContent = ok ? P.go : P.cache;
      status.className = ok ? "go" : "cache";
      sfx(() => SFX.go());
      await pause(220);
    }
    await typeLine(`<span class="ok">${P.all}</span>`);
  }

  async function countdown() {
    const el = $("#countdown");
    el.hidden = false;
    for (const n of [3, 2, 1]) {
      if (run.skipped) break;
      el.innerHTML = `<b>${n}</b>`; sfx(() => SFX.tick());
      await pause(900);
    }
    if (!run.skipped) { el.innerHTML = `<b class="lift">${T().lift}</b>`; sfx(() => { SFX.tick(true); SFX.liftoff(); }); await pause(800); }
    el.hidden = true; el.innerHTML = "";
  }

  function warp(on) {
    const w = $("#warp");
    if (on && !w.children.length) w.innerHTML = Array.from({ length: 48 }, (_, i) => `<i style="--a:${((i * 137.5) % 360).toFixed(1)}deg;animation-delay:${((i * 0.37) % 1.1).toFixed(2)}s"></i>`).join("");
    w.classList.toggle("on", on && !reduced());
  }
  function hud(show, o = {}) {
    $("#hud").hidden = !show;
    if (!show) return;
    if (o.phase != null) $("#hudPhase").textContent = o.phase;
    if (o.crew != null) $("#hudCrew").textContent = o.crew;
    if (o.labels) o.labels.forEach((l, i) => ($(`#hudL${i + 1}`).textContent = l));
    if (o.values) o.values.forEach((v, i) => ($(`#hudV${i + 1}`).textContent = v));
    if (o.k != null) $("#hudBar").style.transform = `scaleX(${o.k})`;
    if (o.note != null) $("#hudNote").textContent = o.note;
  }

  // what is seen through the window is real: NASA EPIC's latest whole-Earth photo and the ISS right now
  async function fetchEpic(lon) {
    try {
      const list = await (await fetch("https://epic.gsfc.nasa.gov/api/natural")).json();
      if (!list.length) return null;
      const off = x => Math.abs(((x - lon + 540) % 360) - 180);
      const best = list.reduce((a, b) => (off(b.centroid_coordinates.lon) < off(a.centroid_coordinates.lon) ? b : a));
      const src = `https://epic.gsfc.nasa.gov/archive/natural/${best.date.slice(0, 10).replaceAll("-", "/")}/jpg/${best.image}.jpg`;
      await new Promise((res, rej) => { const im = new Image(); im.onload = res; im.onerror = rej; im.src = src; });
      return { src, date: new Date(best.date.replace(" ", "T") + "Z") };
    } catch { return null; }
  }
  async function fetchIss() {
    try {
      const j = await (await fetch("https://api.wheretheiss.at/v1/satellites/25544")).json();
      return { lat: j.latitude, lon: j.longitude, alt: j.altitude, vel: j.velocity };
    } catch { return null; }
  }
  const fmtDate = d => d.toLocaleDateString(state.lang === "es" ? "es-EC" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const coord = (lat, lon) => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : state.lang === "es" ? "O" : "W"}`;
  // journey lines queue up so Vega never cuts herself off; settle() waits for her when the voice is on
  const say = text => { if (!run?.skipped) Guide.say(text, { queue: true }); };
  const settle = () => (SFX.on && run && !run.skipped ? within(Guide.idle(), 25000) : Promise.resolve());
  const within = (p, ms) => Promise.race([p, sleep(ms).then(() => null), run.skipP.then(() => null)]);

  async function hatchClose(text, ms) {
    const h = $("#hatch");
    $("#hatchText").textContent = text;
    h.classList.add("on"); void h.offsetWidth; h.classList.add("closed");
    sfx(() => SFX.hatch());
    await pause(ms);
  }
  async function hatchOpen() {
    $("#hatch").classList.remove("closed");
    await pause(700);
    $("#hatch").classList.remove("on");
  }
  function showOutside(site) {
    const ph = ((window.TW_WIKI || {})[site.id] || {}).photo, O = T().outside;
    $("#outside img")?.remove();
    const img = new Image();
    img.src = ph ? ph.src : `assets/views/earth/${site.id}.jpg`; img.alt = site.name;
    $("#outside").prepend(img);
    $("#outTitle").textContent = O.title(site.name.split(" – ")[0]);
    $("#outCap").textContent = ph ? O.photo(ph.author, ph.license) : O.sat;
    $("#outGo").textContent = O.go;
    $("#outside").hidden = false;
  }
  function waitButton(btn, ms) {
    return new Promise(res => { const done = how => { btn.onclick = null; res(how); }; btn.onclick = () => done("click"); pause(ms).then(() => done("time")); });
  }
  function endJourney() {
    $("#touchdown").hidden = true; hud(false); $("#terminal").hidden = true; $("#skipBtn").hidden = true; $("#countdown").hidden = true;
    $("#outside").hidden = true; $("#windowPhoto").classList.remove("on"); $("#windowPhoto").hidden = true;
    $("#hatch").className = "hatch"; $("#cockpit").classList.remove("on");
    warp(false); SFX.humStop(); $("#plasma").classList.remove("on"); $("#flash").classList.remove("on");
    $("#ship").getAnimations().forEach(a => a.cancel());
  }

  async function launch() {
    const t = target(), w = weights();
    const now = name => new Proxy({}, { get: (_, k) => T()[name][k] }); // follows a language switch mid-flight
    const G = now("guide"), H = now("hud"), L = now("log");
    state.mode = "match"; state.tab = "verdict"; state.scan = null;
    state.code = state.code || missionCode();
    const results = rank("match", CURATED), win = results[0].site, siteShort = win.name.split(" – ")[0];
    state.selectedId = win.id;
    let onSkip; const skipP = new Promise(r => (onSkip = r));
    run = { skipped: false, waits: [], anims: [], onSkip, skipP };
    const live = { epic: fetchEpic(win.lon), iss: fetchIss() }; // fetched now, shown later
    const moon = t.body === "Moon";
    const D0 = moon ? Astro.moonKm() : Astro.marsKm(), PATH = moon ? D0 : Astro.HOHMANN_KM;
    const V0 = moon ? 1.5 : 2.6, V1 = moon ? 11 : 11.6, DAYS = moon ? 3 : 259; // km/s relative to Earth; Hohmann v-infinity at Mars ≈ 2.6

    // 0. boarding: the hatch closes and we are inside the cabin, on the pad
    $("#skipBtn").textContent = T().skip; $("#skipBtn").hidden = false;
    say(G.boarding);
    await hatchClose(T().hatch.closing, 1700);
    go("launch");
    $("#cockpit").classList.add("on");
    ctl.autoRotate = false;
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 75 : t.lat, lng: t.lon, altitude: 1.2 }, 0);
    $("#termBody").innerHTML = ""; $("#termCode").textContent = state.code; $("#terminal").hidden = false;
    await hatchOpen();

    // 1. on the pad: crew, destination profile, then a GO/NO-GO poll of the live data links
    say(G.poll);
    await typeLine(`<span class="k">${L.target(esc(short(t.name)))}</span>`);
    await typeLine(L.crew(esc(crewName()), esc(roleLabel())));
    const prov = t.prov || {};
    for (const k of ["relief", "ice", "light"]) if (prov[k]?.kind === "measured") await typeLine(esc(PROV(prov[k].text)));
    await typeLine(L.profile(PL(state.profile)));
    await pollSystems(win);
    await settle();
    await countdown();

    // 2. lift-off and cruise back to Earth: today's real distance, time compressed (said on the HUD)
    say(G.liftoff);
    const ship = $("#ship");
    await flyShip(globeCenter(), { x: innerWidth + 80, y: -80 }, 45, [0.6, 1.4], 1300);
    $("#flash").classList.add("on");
    await pause(350);
    clearLayers(); setTexture("Earth");
    globe.pointOfView({ lat: win.lat, lng: win.lon - 70, altitude: 7 }, 0);
    $("#flash").classList.remove("on");
    warp(true); sfx(() => SFX.humStart());
    hud(true, { phase: H.cruise(t.body), crew: `${crewName()}, ${roleLabel()}`, labels: [H.dist, H.speed, H.travelled, H.time], note: moon ? H.noteMoon : H.noteMars, k: 0 });
    say(moon ? G.cruiseMoon(nf(D0)) : G.cruiseMars(nf(D0 / 1e6, 1)));
    const CRUISE = SFX.on ? 16000 : 12000; // longer when Vega speaks, so the view matches her words
    globe.pointOfView({ lat: win.lat, lng: win.lon - 25, altitude: 2.6 }, reduced() || run.skipped ? 0 : CRUISE);
    await Promise.all([
      tween(CRUISE, k => hud(true, { k, values: [
        `${nf(D0 * (1 - k))} km`, `${nf((V0 + (V1 - V0) * k * k) * 3600)} km/h`, `${nf(PATH * k)} km`, H.day(Math.max(1, Math.round(1 + (DAYS - 1) * k))),
      ] })),
      (async () => {
        await typeLine(L.power(CURATED.length));
        await typeLine(L.dem(CURATED.length));
        await typeLine(L.terrain);
        await typeLine(L.compare(KEYS.filter(k => w[k] > 0).length, CURATED.length));
        showEarthResults(results, false);
        globe.htmlElementsData([]).ringsData([]);
        await typeLine(`<span class="ok">${L.best(esc(win.name), dec(results[0].score, 1))}</span>`);
      })(),
      (async () => { // the real Earth through the window
        await pause(4800);
        await settle();
        const epic = await within(live.epic, 1500);
        if (!epic || run.skipped) return;
        const wp = $("#windowPhoto");
        wp.querySelector("img")?.remove();
        const img = new Image(); img.src = epic.src; img.alt = T().epic(fmtDate(epic.date)); wp.prepend(img);
        $("#epicCap").textContent = T().epic(fmtDate(epic.date));
        wp.hidden = false; void wp.offsetWidth; wp.classList.add("on");
        say(G.epic(fmtDate(epic.date)));
        await pause(5600);
        await settle();
        wp.classList.remove("on"); await pause(900); wp.hidden = true;
      })(),
    ]);

    // 3. the International Space Station, where it is right now
    warp(false); SFX.humStop();
    const iss = await within(live.iss, 1500);
    if (iss && !run.skipped) {
      globe.pointsData([]).ringsData([{ lat: iss.lat, lng: iss.lon }])
        .htmlElementsData([{ lat: iss.lat, lng: iss.lon, alt: iss.alt / 6371, el: labelEl("ISS", "win") }]);
      globe.pointOfView({ lat: iss.lat, lng: iss.lon, altitude: 2 }, reduced() ? 0 : 1600);
      const where = (await within(placeName(+iss.lat.toFixed(1), +iss.lon.toFixed(1)), 1200)) || coord(iss.lat, iss.lon);
      say(G.iss(nf(iss.alt), nf(Math.round(iss.vel / 100) * 100), where));
      await pause(5200);
      await settle();
    }

    // 4. re-entry over the best twin
    sfx(() => SFX.reentry(4)); say(G.reentry);
    const ENTRY = 4600;
    if (!run.skipped) $("#plasma").classList.add("on");
    globe.pointsData([]).htmlElementsData([]).ringsData([]); // score towers would fill the screen this close
    hud(true, { phase: H.entry(siteShort), labels: [H.alt, H.speed, H.phase, ""], note: "", k: 0 });
    globe.pointOfView({ lat: win.lat, lng: win.lon, altitude: 0.5 }, reduced() || run.skipped ? 0 : ENTRY);
    await Promise.all([
      flyShip({ x: -80, y: -80 }, globeCenter(), 135, [1.4, 0.35], ENTRY),
      tween(ENTRY, k => {
        if (k > 0.55) $("#plasma").classList.remove("on");
        const ph = k < 0.3 ? 0 : k < 0.65 ? 1 : k < 0.97 ? 2 : 3;
        hud(true, { k, values: [`${nf(120 * (1 - k) ** 1.6, 1)} km`, `${nf(V1 * 3600 * (1 - k) ** 2)} km/h`, H.phases[ph], ""] });
      }),
    ]);
    $("#plasma").classList.remove("on");

    // 5. touchdown
    track(ship.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }));
    globe.pointsData([]).arcsData([]).ringsData([{ lat: win.lat, lng: win.lon }])
      .htmlElementsData([{ lat: win.lat, lng: win.lon, alt: 0.02, el: landerEl() }, { lat: win.lat, lng: win.lon, alt: 0.02, el: labelEl(siteShort, "win") }]);
    const td = $("#touchdown");
    td.innerHTML = `<h2>${esc(T().touchdown.title(siteShort))}</h2><p>${esc(T().touchdown.sub(crewName()))}</p>`;
    hud(false); $("#terminal").hidden = true;
    td.hidden = false; sfx(() => SFX.touchdown());
    say(G.touchdown(siteShort));
    await pause(2400);
    await settle();
    td.hidden = true;

    // 6. open the hatch: the first look outside is a real photograph of the site
    await hatchClose(T().hatch.opening, 1100);
    $("#cockpit").classList.remove("on");
    showOutside(win);
    await hatchOpen();
    say(G.outside(siteShort));
    if ((await waitButton($("#outGo"), 8000)) === "time") await settle();

    // 7. debrief
    endJourney();
    run = null;
    go("verdict");
    showEarthResults(results, true);
    writeHash();
  }

  // ---------- outbound journey: from a place on Earth to its Moon or Mars twin ----------
  const joinList = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${state.lang === "es" ? "y" : "and"} ${xs[xs.length - 1]}`);
  async function outbound(site, t) {
    const now = name => new Proxy({}, { get: (_, k) => T()[name][k] });
    const G = now("guide"), H = now("hud"), L = now("log");
    if (state.peek) unpeek(false);
    const tName = short(t.name);
    let sName = site.name.split(" – ")[0];
    const match = TW.compare(site.fp, t, TW.profileWeights("balanced"));
    state.targetId = t.id; state.body = t.body; state.profile = null; state.code = missionCode();
    let onSkip; const skipP = new Promise(r => (onSkip = r));
    run = { skipped: false, waits: [], anims: [], onSkip, skipP };
    if (site.scanned) { // a clicked point: "your place", with the region's name when the lookup answers
      const where = await within(placeName(+site.lat.toFixed(1), +site.lon.toFixed(1)), 1500);
      sName = where ? `${G.yourPlace} (${where})` : G.yourPlace;
    }
    const moon = t.body === "Moon";
    const D0 = moon ? Astro.moonKm() : Astro.marsKm(), PATH = moon ? D0 : Astro.HOHMANN_KM;
    const V0 = 11, V1 = moon ? 1.5 : 2.6, DAYS = moon ? 3 : 259; // km/s relative to Earth, leaving at escape speed

    // boarding at the scanned place
    $("#skipBtn").textContent = T().skip; $("#skipBtn").hidden = false;
    say(G.boarding);
    await hatchClose(T().hatch.closing, 1700);
    go("launch");
    $("#cockpit").classList.add("on");
    clearLayers(); setTexture("Earth"); ctl.autoRotate = false;
    globe.htmlElementsData([{ lat: site.lat, lng: site.lon, alt: 0.02, el: labelEl(sName, "win") }]).ringsData([{ lat: site.lat, lng: site.lon }]);
    globe.pointOfView({ lat: site.lat, lng: site.lon, altitude: 1.2 }, 0);
    $("#termBody").innerHTML = ""; $("#termCode").textContent = state.code; $("#terminal").hidden = false;
    await hatchOpen();
    say(G.poll);
    await typeLine(`<span class="k">${L.from(esc(sName))}</span>`);
    await typeLine(L.to(esc(tName), Math.round(match.score)));
    await typeLine(L.crew(esc(crewName()), esc(roleLabel())));
    await pollSystems(site);
    await settle();
    await countdown();

    // lift-off from Earth and cruise to the twin
    say(G.liftoffOut(tName));
    const ship = $("#ship");
    await flyShip(globeCenter(), { x: innerWidth + 80, y: -80 }, 45, [0.6, 1.4], 1300);
    $("#flash").classList.add("on"); await pause(350);
    clearLayers(); setTexture(t.body);
    globe.pointOfView({ lat: t.lat, lng: t.lon - 70, altitude: 7 }, 0);
    $("#flash").classList.remove("on");
    warp(true); sfx(() => SFX.humStart());
    hud(true, { phase: H.outbound(t.body), crew: `${crewName()}, ${roleLabel()}`, labels: [H.distTarget, H.speed, H.travelled, H.time], note: moon ? H.noteMoon : H.noteMars, k: 0 });
    say(moon ? G.cruiseOutMoon(nf(D0)) : G.cruiseOutMars(nf(D0 / 1e6, 1)));
    const CRUISE = SFX.on ? 13000 : 9000;
    globe.pointOfView({ lat: t.lat, lng: t.lon - 20, altitude: 2.4 }, reduced() || run.skipped ? 0 : CRUISE);
    await tween(CRUISE, k => hud(true, { k, values: [
      `${nf(D0 * (1 - k))} km`, `${nf((V0 + (V1 - V0) * Math.sqrt(k)) * 3600)} km/h`, `${nf(PATH * k)} km`, H.day(Math.max(1, Math.round(1 + (DAYS - 1) * k))),
    ] }));

    // landing on the twin: powered descent on the Moon, entry and parachutes on Mars
    warp(false); SFX.humStop();
    const ENTRY = 4200, phases = H.landPhases[t.body];
    if (!moon && !run.skipped) { $("#plasma").classList.add("on"); sfx(() => SFX.reentry(4)); }
    hud(true, { phase: H.landing(tName), labels: [H.alt, H.speed, H.phase, ""], note: "", k: 0 });
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 78 : t.lat, lng: t.lon, altitude: 0.6 }, reduced() || run.skipped ? 0 : ENTRY);
    await Promise.all([
      flyShip({ x: innerWidth + 80, y: -80 }, globeCenter(), 225, [1.4, 0.35], ENTRY),
      tween(ENTRY, k => {
        if (k > 0.55) $("#plasma").classList.remove("on");
        const ph = k < 0.3 ? 0 : k < 0.65 ? 1 : k < 0.97 ? 2 : 3;
        hud(true, { k, values: [`${nf(100 * (1 - k) ** 1.6, 1)} km`, `${nf(V1 * 3600 * (1 - k) ** 2)} km/h`, phases[ph], ""] });
      }),
    ]);
    $("#plasma").classList.remove("on");
    track(ship.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }));
    globe.htmlElementsData([{ lat: t.lat, lng: t.lon, alt: 0.02, el: landerEl() }, { lat: t.lat, lng: t.lon, alt: 0.02, el: labelEl(tName, "win") }])
      .ringsData([{ lat: t.lat, lng: t.lon }]);
    hud(false); $("#terminal").hidden = true;
    const td = $("#touchdown");
    td.innerHTML = `<h2>${esc(T().arrival(tName))}</h2>`;
    td.hidden = false; sfx(() => SFX.touchdown());
    const shared = KEYS.filter(k => match.per[k] != null && t[k] >= 0.3 && match.per[k] >= 0.75)
      .sort((a, b) => match.per[b] - match.per[a]).slice(0, 3).map(k => FL(k).charAt(0).toLowerCase() + FL(k).slice(1));
    say(G.arrive(tName, sName, joinList(shared)));
    await pause(3800);
    await settle();
    td.hidden = true;

    // the hatch opens on the orbital view of the twin
    await hatchClose(T().hatch.opening, 1100);
    $("#cockpit").classList.remove("on");
    $("#outside img")?.remove();
    const img = new Image(); img.src = `assets/views/target/${t.id}.jpg`; img.alt = t.name;
    $("#outside").prepend(img);
    $("#outTitle").textContent = T().outside.title(tName);
    $("#outCap").textContent = T().outside.orbital(t.body);
    $("#outGo").textContent = T().outside.plan;
    $("#outside").hidden = false;
    await hatchOpen();
    if ((await waitButton($("#outGo"), 9000)) === "time") await settle();

    // next: pick the mission to rehearse at this destination
    endJourney(); run = null;
    state.scan = null;
    go("mission");
    showTargetsOnGlobe();
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 70 : t.lat, lng: t.lon, altitude: 1.5 }, 1000);
    Guide.say(T().guide.next(tName));
  }

  // ---------- verdict + tabs ----------
  function selectSite(id) {
    state.selectedId = id; state.tab = "verdict";
    renderVerdictPanel();
    showEarthResults(rank(), true);
  }

  function earthDetail(k, s) {
    const pw = s.power || {}, es = state.lang === "es";
    const clim = TW.climateFromPower(pw, s.elev);
    switch (k) {
      case "aridity": return pw.precip == null ? "" : `${dec((pw.precip * 365), 0)} mm/${es ? "año" : "yr"} · HR ${dec(pw.rh, 0)}% · NASA POWER`;
      case "cold": return pw.t2m == null ? "" : `${es ? "T media" : "Mean T"} ${dec(pw.t2m, 1)} °C · NASA POWER`;
      case "swing": return pw.t2m_range == null ? "" : `Δ ${es ? "diaria" : "daily"} ${dec(pw.t2m_range, 1)} °C · NASA POWER`;
      case "thin_air": return clim._ps == null ? "" : `${dec(clim._ps, 1)} kPa · ${Math.round(s.elev ?? 0)} m · NASA POWER + DEM`;
      case "radiation": return pw.sw == null ? "" : `${dec(pw.sw, 1)} kWh/m²/d · UV ${dec(pw.uv, 1)} · NASA POWER`;
      case "light": return pw.sw_min == null ? "" : `${es ? "mes oscuro/brillante" : "dark/bright month"} ${dec((pw.sw_min / pw.sw_max), 2)} · NASA POWER`;
      case "relief": return s.relief_m == null ? "" : `${Math.round(s.relief_m)} m ${es ? "en 15 km" : "within 15 km"} · Copernicus DEM`;
      case "barren": if (s.ndvi != null) return `NDVI ${dec(s.ndvi, 2)} · MODIS MOD13Q1 (ORNL DAAC)`; break;
    }
    const g = s.geo || {}, pct = v => `${Math.round(v * 100)}%`;
    if (s.geo_kind?.[k]) switch (k) {
      case "basalt": case "salts": {
        const m = g.macrostrat;
        return `${es ? "Mapa geológico" : "Geologic map"}: “${m.unit}” · ${es ? "puntaje medio" : "mean score"} ${dec(m[k], 2)} ${es ? "en" : "over"} ${m[`${k}_n`]} ${es ? "puntos en 15 km" : "points within 15 km"} · Macrostrat`;
      }
      case "sediment": {
        const m = g.macrostrat, w = g.gsw;
        return `${es ? "Mapa geológico" : "Geologic map"}: “${m.unit}” · Macrostrat` + (w ? ` · ${es ? "agua alguna vez desde 1984 en" : "water seen since 1984 on"} ${pct(w.ever_wet)} ${es ? "del área" : "of the area"} (JRC GSW)` : "");
      }
      case "ice": {
        const t = g.lst, wc = g.worldcover;
        return `${es ? "T superficial media" : "Mean surface T"} ${dec(t.lst_mean_c, 1)} °C · MODIS MOD11A2 ${LST_YEAR}` + (wc && wc.snow_ice > 0 ? ` · ${es ? "hielo/nieve permanente" : "permanent snow/ice"} ${pct(wc.snow_ice)} (ESA WorldCover)` : "");
      }
      case "regolith": return `${es ? "Radar banda L" : "L-band radar"} HV ${dec(g.palsar.hv_db, 1)} dB (${es ? "oscuro = fino y suelto" : "dark = fine and loose"}) · ALOS PALSAR (JAXA)`;
    }
    return s.scanned ? (es ? "sin datos: requiere campo" : "no data: needs fieldwork") : (es ? "estimado de literatura geológica" : "estimate from geologic literature");
  }
  function targetDetail(k, t) {
    const p = t.prov?.[k];
    return p ? PROV(p.text) : (state.lang === "es" ? "literatura de la misión" : "mission literature");
  }

  function ring(score) {
    const r = 38, c = 2 * Math.PI * r, p = TW.clamp(score / 100);
    return `<svg class="ring" viewBox="0 0 92 92"><circle class="bg" cx="46" cy="46" r="${r}" fill="none" stroke-width="8"/>
      <circle cx="46" cy="46" r="${r}" fill="none" stroke="${scoreColor(score)}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 46 46)"/>
      <text x="46" y="50" text-anchor="middle" font-size="24">${score.toFixed(0)}</text><text class="lbl" x="46" y="66" text-anchor="middle" font-size="9">/ 100</text></svg>`;
  }

  const helpOpen = new Set(); // tabs whose "?" help box the user has opened
  function renderVerdictPanel() {
    const p = $("#panel"), t = target();
    const tabs = ["verdict", "top", "camp", "map", "evidence", "scan"];
    p.innerHTML = `<nav class="tabs">${tabs.map(k => `<button data-tab="${k}" class="${k === state.tab ? "on" : ""}">${T().tabs[k]}</button>`).join("")}</nav>
      <div class="p-body" id="tabBody"></div>
      <div class="p-foot"><button class="btn ghost" id="newBtn">${T().newMission}</button><button class="btn ghost" id="cardBtn">${T().card}</button><button class="btn" id="certBtn">${T().cert.btn}</button></div>`;
    p.querySelectorAll(".tabs button").forEach(b => (b.onclick = () => {
      const prev = state.tab;
      state.tab = b.dataset.tab; renderVerdictPanel();
      Guide.say(T().guide.tabs[state.tab]);
      $("#hint").hidden = state.tab !== "scan";
      if (state.peek) unpeek(false);
      if (["camp", "map"].includes(prev) && prev !== state.tab) showEarthResults(rank(), true);
    }));
    $("#hint").textContent = state.lang === "es" ? "Haz clic en cualquier punto del globo" : "Click any point on the globe";
    $("#newBtn").onclick = () => { state.profile = null; state.scan = null; clearLayers(); go("dest"); pickTarget(state.targetId); };
    const results = rank();
    $("#cardBtn").onclick = () => exportCard(results.find(r => r.site.id === state.selectedId) || results[0]);
    $("#certBtn").onclick = () => exportCertificate(results.find(r => r.site.id === state.selectedId) || results[0]);
    ({ verdict: tabVerdict, top: tabTop, camp: tabCamp, map: tabMap, evidence: tabEvidence, scan: tabScan })[state.tab](results, t);
    const tab = state.tab;
    $("#tabBody").insertAdjacentHTML("afterbegin",
      `<details class="about" ${helpOpen.has(tab) ? "open" : ""}><summary>${T().helpQ}</summary><p>${T().help[tab]}</p></details>`);
    $("#tabBody .about").addEventListener("toggle", e => (e.target.open ? helpOpen.add(tab) : helpOpen.delete(tab)));
  }

  function tabVerdict(results, t) {
    const r = results.find(x => x.site.id === state.selectedId) || results[0];
    const s = r.site, w = weights(), pos = results.indexOf(r) + 1;
    const isWin = pos === 1;
    const usage = s.scanned ? "" : s.usage <= 0.2 ? `<span class="badge new">${T().newCandidate}</span>` : s.usage >= 0.6 ? `<span class="badge est">${T().established}</span>` : "";
    const scored = KEYS.filter(k => r.per[k] != null && w[k] > 0);
    const reasons = scored.filter(k => t[k] >= 0.3 && r.per[k] >= 0.7).sort((a, b) => w[b] * r.per[b] - w[a] * r.per[a]).slice(0, 3);
    const gaps = scored.filter(k => r.per[k] < 0.6).sort((a, b) => w[b] * (1 - r.per[b]) - w[a] * (1 - r.per[a])).slice(0, 2);
    const lead = isWin ? (state.crew.name.trim() ? T().verdictLeadNamed(esc(crewName()), PL(state.profile), esc(short(t.name))) : T().verdictLead(PL(state.profile), esc(short(t.name))))
      : `#${pos} ${T().of} ${results.length} · ${esc(short(t.name))} · ${PL(state.profile)}`;
    $("#tabBody").innerHTML = `
      <p class="lead">${lead}</p>
      <div class="winner">${ring(r.score)}<div><h2>${esc(s.name)}</h2><div class="country">${esc(CTRY(s.country))} ${usage}</div></div></div>
      ${s.scanned ? "" : `<button class="btn place-btn" id="placeBtn">${T().place.btn}</button>`}
      <div class="sec">${T().why}</div>
      <ul class="reasons">${reasons.map(k => `<li><span><b>${FL(k)}</b><small>${esc(earthDetail(k, s))}</small><small>${t.body === "Moon" ? T().moon : T().mars}: ${esc(targetDetail(k, t))}</small></span><span class="pct">${Math.round(r.per[k] * 100)} %</span></li>`).join("") || "<li>—</li>"}</ul>
      <div class="sec">${T().cannot}</div>
      <ul class="reasons bad">${gaps.map(k => `<li><span><b>${FL(k)}</b><small>${esc(earthDetail(k, s))}</small></span><span class="pct">${Math.round(r.per[k] * 100)} %</span></li>`).join("") || "<li>—</li>"}</ul>
      <div class="sec">${PROCESSES.text[state.lang].title}</div>
      ${processesHtml(s, t)}
      <div class="sec">${T().viz.title}</div>
      ${profileChart(s.fp, t, r.per, w, s.name.split(" – ")[0])}
      ${s.note ? `<p class="note">${esc(NOTE(s))}</p>` : ""}
      ${reverseHtml(s)}
      <div class="sec">${T().dataUsed}</div>
      <div class="chips">${["NASA POWER", "Copernicus DEM", ...new Set(Object.values(t.prov || {}).filter(p => p.kind === "measured").map(p => p.text.split(":")[0]))].map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>`;
    bindTips($("#tabBody"));
    bindReverse();
    const pb = $("#placeBtn"); if (pb) pb.onclick = () => openPlace(s, t);
  }

  // ---------- processes, not only places ----------
  // Which of the seven processes act at an Earth site, read from measured data.
  function earthProcesses(s) {
    const fp = s.fp || {}, pw = s.power || {}, g = s.geo || {}, E = PROCESSES.text[state.lang].ev;
    const out = {};
    if (pw.ws10m != null && pw.ws10m >= 3.5 && (fp.barren ?? 0) >= 0.6 && (fp.aridity ?? 0) >= 0.5) out.wind = ["now", E.wind(dec(pw.ws10m, 1))];
    // temporary water (floods, playas that fill and dry) away from the sea: sediment being laid down today
    const temp = (g.gsw?.ever_wet ?? 0) - (g.gsw?.mostly_wet ?? 0);
    if (temp >= 0.02 && (g.worldcover?.water ?? 0) < 0.02) out.water = ["now", E.waterNow(`${Math.round(temp * 100)} %`)];
    else if ((fp.sediment ?? 0) >= 0.6) out.water = ["old", E.waterOld];
    if ((fp.salts ?? 0) >= 0.5 && (fp.aridity ?? 0) >= 0.6 && pw.precip != null) out.evap = ["now", E.evap(dec(pw.precip * 365, 0))];
    if ((fp.ice ?? 0) >= 0.5) out.ice = ["now", g.lst ? E.ice(dec(g.lst.lst_mean_c, 1)) : E.iceLit];
    if ((fp.basalt ?? 0) >= 0.6) out.volcanic = PROCESSES.activeVolcano.includes(s.id) ? ["now", E.volcanicNow] : ["old", E.volcanicOld];
    if ((fp.swing ?? 0) >= 0.6 && pw.t2m_range != null) out.thermal = ["now", E.thermal(dec(pw.t2m_range, 1))];
    if ((fp.impact ?? 0) >= 0.6) out.impact = ["old", E.impact];
    return out;
  }
  // processes an Earth site shares with a destination, with what each pairing teaches
  function processesHtml(s, t) {
    const X = PROCESSES.text[state.lang], L = PROCESSES.label[state.lang], tName = short(t.name).split(" – ")[0];
    const here = earthProcesses(s), there = PROCESSES.target[t.id] || {};
    const shared = PROCESSES.order.filter(k => here[k] && there[k])
      .sort((a, b) => (here[b][0] === "now" && there[b][0] === "old") - (here[a][0] === "now" && there[a][0] === "old"));
    if (!shared.length) return `<p class="help">${X.none}</p>`;
    return `<ul class="procs">${shared.map(k => {
      const [eWhen, eTxt] = here[k], [tWhen, tEs, tEn] = there[k];
      return `<li><b>${L[k]}</b>
        <div class="proc-row"><span class="ptag earth ${eWhen}">${X.earthTag[eWhen]}</span><span>${esc(eTxt)}</span></div>
        <div class="proc-row"><span class="ptag dest ${t.body} ${tWhen}">${esc(X.targetTag[tWhen](tName))}</span><span>${esc(state.lang === "es" ? tEs : tEn)}</span></div>
        <p class="proc-lesson">${X.lesson[`${eWhen}-${tWhen}`]}</p></li>`;
    }).join("")}</ul>`;
  }

  // ---------- twin profile: one dumbbell per characteristic ----------
  // Earth (circle) and destination (diamond) on the same 0–1 scale: the gap between them is the difference.
  function profileChart(earthFp, t, per, w, earthLabel) {
    const V = T().viz, base = Math.min(...KEYS.map(k => w[k] ?? 1));
    const rows = KEYS.map(k => ({ k, e: earthFp[k], d: t[k], m: per[k], key: (w[k] ?? 1) > base }));
    const byMatch = (a, b) => (b.m ?? -1) - (a.m ?? -1);
    const measured = rows.filter(r => r.m != null), close = measured.filter(r => r.m >= 0.8).length;
    const world = t.body === "Moon" ? T().moon : T().mars;
    const row = r => {
      const lbl = FL(r.k);
      if (r.m == null) return `<div class="dumb-row nodata"><span class="dumb-label">${lbl}</span><span class="dumb-track"><em>${V.nodata}</em></span><span class="dumb-v"></span></div>`;
      const lo = Math.min(r.e, r.d) * 100, hi = Math.max(r.e, r.d) * 100;
      const tip = V.tip(lbl, dec(r.e, 2), world, dec(r.d, 2), Math.round(r.m * 100));
      const same = Math.abs(r.e - r.d) < 0.03 ? " same" : ""; // equal values: nudge the marks apart so both stay visible
      return `<div class="dumb-row${same}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span class="dumb-label">${lbl}</span>
        <span class="dumb-track"><i class="dumb-gap" style="left:${lo}%;width:${hi - lo}%"></i><i class="mk earth" style="left:${r.e * 100}%"></i><i class="mk dest ${t.body}" style="left:${r.d * 100}%"></i></span>
        <span class="dumb-v">${Math.round(r.m * 100)} %</span></div>`;
    };
    const keyRows = rows.filter(r => r.key).sort(byMatch), other = rows.filter(r => !r.key).sort(byMatch);
    const body = keyRows.length && other.length
      ? `<div class="dumb-group">${V.key}</div>${keyRows.map(row).join("")}<div class="dumb-group">${V.other}</div>${other.map(row).join("")}`
      : rows.sort(byMatch).map(row).join("");
    return `<figure class="dumb">
      <figcaption><span class="dumb-sum">${V.summary(close, measured.length)}</span>
        <span class="dumb-legend"><span><i class="mk earth"></i>${esc(earthLabel)}</span><span><i class="mk dest ${t.body}"></i>${esc(short(t.name))}</span></span></figcaption>
      <div class="dumb-scale" aria-hidden="true"><span></span><span class="dumb-ticks"><span>0</span><span>${dec(0.5, 1)}</span><span>1</span></span><span>${V.match}</span></div>
      ${body}
    </figure>`;
  }
  function bindTips(root) {
    let tip = $("#vizTip");
    if (!tip) { tip = document.createElement("div"); tip.id = "vizTip"; tip.className = "viz-tip"; tip.hidden = true; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    const show = (r, x, y) => {
      tip.textContent = r.dataset.tip; tip.hidden = false;
      tip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - tip.offsetWidth - 8))}px`;
      tip.style.top = `${Math.min(y + 16, innerHeight - tip.offsetHeight - 8)}px`;
    };
    root.querySelectorAll(".dumb-row[data-tip]").forEach(r => {
      r.onpointermove = e => show(r, e.clientX, e.clientY);
      r.onpointerleave = () => (tip.hidden = true);
      r.onfocus = () => { const b = r.getBoundingClientRect(); show(r, b.left + 120, b.bottom - 10); };
      r.onblur = () => (tip.hidden = true);
    });
  }

  // "Compare": an Earth place against one Moon or Mars site, with the numbers
  function openCompare(site, id) {
    const t = TARGETS.find(x => x.id === id), V = T().viz, P = T().place;
    const w = TW.profileWeights("balanced"), c = TW.compare(site.fp, t, w);
    const sName = site.scanned ? T().guide.yourPlace.replace(/^./, ch => ch.toUpperCase()) : site.name.split(" – ")[0];
    const world = t.body === "Moon" ? T().moon : T().mars;
    const facts = (state.lang === "es" && I18N_TARGET_FACTS.es[t.id]) || t.facts || [];
    let m = $("#cmpModal");
    if (!m) { m = document.createElement("div"); m.id = "cmpModal"; m.className = "modal"; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="cmpTitle">
      <header class="modal-head"><div><small>${T().reverse.title}</small><h2 id="cmpTitle">${V.versus(esc(sName), esc(short(t.name)))}</h2><span class="help">${world}</span></div>
        <button class="modal-x" id="cmpClose" aria-label="${P.close}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
      <div class="modal-body">
        <div class="winner">${ring(c.score)}<p class="lead">${V.lead}</p></div>
        ${profileChart(site.fp, t, c.per, w, sName)}
        <div class="sec">${PROCESSES.text[state.lang].title}</div>
        ${processesHtml(site, t)}
        <div class="sec">${T().brief.why}</div>
        <ul class="facts">${facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        <button class="btn" id="cmpGlobe">${V.onGlobe(esc(short(t.name)))}</button>
      </div></div>`;
    m.hidden = false;
    document.body.classList.add("modal-open");
    bindTips(m);
    const close = () => { m.hidden = true; document.body.classList.remove("modal-open"); $("#vizTip").hidden = true; };
    $("#cmpClose").onclick = close;
    m.onclick = e => { if (e.target === m) close(); };
    $("#cmpGlobe").onclick = () => { close(); peek(id); };
    $("#cmpClose").focus();
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && $("#cmpModal") && !$("#cmpModal").hidden) $("#cmpClose").click(); });

  function tabTop(results) {
    const lo = Math.min(...results.map(r => r.score)), hi = Math.max(...results.map(r => r.score));
    $("#tabBody").innerHTML = `
      <div class="seg">${["match", "untapped", "ready"].map(m => `<button data-m="${m}" class="${m === state.mode ? "on" : ""}">${T().modes[m]}</button>`).join("")}</div>
      <p class="help">${T().modeHelp[state.mode]}</p>
      <ol class="rank">${results.slice(0, 10).map(r => {
        const s = r.site, b = s.scanned ? "" : s.usage <= 0.2 ? `<span class="badge new">${T().newCandidate}</span>` : "";
        return `<li data-id="${s.id}" class="${s.id === state.selectedId ? "on" : ""}"><div><b>${esc(s.name)}${b}</b><small>${esc(CTRY(s.country))}</small>
          <div class="bar"><i style="width:${TW.clamp(r.value / 80) * 100}%;background:${scoreColor(r.score, lo, hi)}"></i></div></div><span class="v">${r.value.toFixed(0)}</span></li>`;
      }).join("")}</ol>
      <button class="btn ghost" id="csvBtn" style="margin-top:10px">${T().csv}</button>`;
    document.querySelectorAll(".seg button").forEach(b => (b.onclick = () => {
      state.mode = b.dataset.m; const res = rank(); state.selectedId = res[0].site.id;
      renderVerdictPanel(); showEarthResults(res, true); writeHash();
    }));
    document.querySelectorAll(".rank li").forEach(li => (li.onclick = () => selectSite(li.dataset.id)));
    $("#csvBtn").onclick = () => exportCSV(results);
  }

  function campaign() {
    const pool = rank("match", CURATED);
    return { camp: TW.buildCampaign(pool, target(), weights(), 3), single: pool[0] };
  }
  function drawCampaignArcs(camp) {
    const s = camp.chosen.map(c => c.site);
    globe.arcsData(s.map((a, i) => { const b = s[(i + 1) % s.length]; return { a0: a.lat, o0: a.lon, a1: b.lat, o1: b.lon }; }));
    globe.ringsData(s.map(x => ({ lat: x.lat, lng: x.lon })));
    globe.htmlElementsData(s.map((x, i) => ({ lat: x.lat, lng: x.lon, alt: 0.02, el: labelEl(`${i + 1}. ${x.name.split(" – ")[0]}`, "win") })));
    const lat = s.reduce((a, x) => a + x.lat, 0) / s.length, lng = s.reduce((a, x) => a + x.lon, 0) / s.length;
    globe.pointOfView({ lat, lng, altitude: 2.6 }, 1500);
  }
  function tabCamp(_, t) {
    const { camp, single } = campaign(), w = weights();
    const tot = KEYS.reduce((a, k) => a + w[k], 0);
    const singleCov = 100 * KEYS.reduce((a, k) => a + w[k] * (single.per[k] ?? 0), 0) / tot;
    const roles = new Map(camp.chosen.map(c => [c, []]));
    KEYS.forEach(k => { const o = camp.owner[k]; if (o.site && w[k] > 0 && o.value >= 0.7 && t[k] >= 0.3) roles.get(o.site).push(k); });
    $("#tabBody").innerHTML = `<h2 class="p-title">${T().campTitle}</h2>
      <p class="p-sub">${T().campLead(camp.coverage.toFixed(0), singleCov.toFixed(0))}</p>
      <div class="camp">${camp.chosen.map((c, i) => `<div><b>${i + 1}. ${esc(c.site.name)}</b><small>${esc(CTRY(c.site.country))} · ${c.score.toFixed(0)}/100</small>
        <small>${T().covers}: ${roles.get(c).map(k => FL(k)).join(", ") || "—"}</small></div>`).join("")}</div>
      <div class="covbars">${KEYS.filter(k => w[k] > 0).map(k => { const v = camp.owner[k].value; return `<div class="row"><span>${FL(k)}</span><div class="track"><i style="width:${v * 100}%;background:${matchColor(v)}"></i></div><span>${Math.round(v * 100)}</span></div>`; }).join("")}</div>
      <p class="foot-note">${T().beyond}</p>`;
    drawCampaignArcs(camp);
  }

  function tabEvidence(results, t) {
    const r = results.find(x => x.site.id === state.selectedId) || results[0], s = r.site;
    const kindOf = k => t.prov?.[k]?.kind || "literature";
    const earthKind = k => s.geo_kind?.[k] || (CLIMATE_KEYS.includes(k) || k === "relief" || (k === "barren" && s.ndvi != null) ? "measured" : "literature");
    $("#tabBody").innerHTML = `<h2 class="p-title">${T().evTitle}</h2>
      <div class="sec">${T().evTarget}: ${esc(short(t.name))}</div>
      <table class="ev">${KEYS.map(k => `<tr><td>${FL(k)}</td><td><span class="badge ${kindOf(k)}">${T().kinds[kindOf(k)]}</span><div class="src">${esc(targetDetail(k, t))}</div></td><td class="v">${dec(t[k], 2)}</td></tr>`).join("")}</table>
      <div class="sec">${T().evEarth}: ${esc(s.name)}</div>
      <table class="ev">${KEYS.map(k => `<tr><td>${FL(k)}</td><td><span class="badge ${earthKind(k)}">${T().kinds[earthKind(k)]}</span><div class="src">${esc(earthDetail(k, s))}</div></td><td class="v">${s.fp[k] == null ? "?" : dec(s.fp[k], 2)}</td></tr>`).join("")}</table>
      <p class="foot-note">${T().beyond}<br>Dataset: ${esc(generated)}</p>`;
  }

  function tabScan(results) {
    const sc = state.scan;
    let box = "";
    if (state.scanBusy) box = `<div class="scanbox busy">${T().scanning}</div>`;
    else if (sc) {
      const r = results.find(x => x.site.id === sc.id);
      const pos = rank("match", CURATED.concat(sc)).findIndex(x => x.site.id === sc.id) + 1;
      box = `<div class="scanbox"><b>${sc.lat.toFixed(3)}°, ${sc.lon.toFixed(3)}°</b> · ${Math.round(sc.elev ?? 0)} m<br>${T().scanResult(r.score.toFixed(1), pos, CURATED.length + 1)}
        <p class="help" style="margin-top:8px">${T().scanAxes}</p><button class="btn" id="seeScan">${T().tabs.verdict}</button>${reverseHtml(sc)}</div>`;
    }
    $("#tabBody").innerHTML = `<h2 class="p-title">${T().scanTitle}</h2><p class="p-sub">${T().scanHelp}</p>${box}`;
    const b = $("#seeScan"); if (b) b.onclick = () => selectSite(sc.id);
    bindReverse();
  }

  // ---------- live scan ----------
  async function fetchPower(lat, lon) {
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${POWER_PARAMS}&community=RE&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`;
    const raw = await (await fetch(url)).json();
    const p = raw.properties.parameter, fill = raw.header?.fill_value ?? -999;
    const ann = k => (p[k] && p[k].ANN !== fill ? p[k].ANN : null);
    const sw = MONTHS.map(m => p.ALLSKY_SFC_SW_DWN[m]).filter(v => v !== fill);
    return { t2m: ann("T2M"), t2m_range: ann("T2M_RANGE"), t2m_min: ann("T2M_MIN"), t2m_max: ann("T2M_MAX"), precip: ann("PRECTOTCORR"), rh: ann("RH2M"),
      ps: ann("PS"), sw: ann("ALLSKY_SFC_SW_DWN"), sw_min: Math.min(...sw), sw_max: Math.max(...sw), uv: ann("ALLSKY_SFC_UV_INDEX"), ws10m: ann("WS10M"), grid_elev: raw.geometry.coordinates[2] };
  }
  async function fetchReliefWindow(lat, lon) {
    // 5×5 grid over ±15 km plus the centre point (coarser than the offline 2 km grid, same P95–P5 metric)
    const pts = [[lat, lon]];
    const kx = 111.2 * Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) pts.push([lat + (i * 7.5) / 111.2, lon + (j * 7.5) / kx]);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p => p[0].toFixed(4)).join(",")}&longitude=${pts.map(p => p[1].toFixed(4)).join(",")}`;
    const all = (await (await fetch(url)).json()).elevation;
    const e = all.slice(1).sort((a, b) => a - b);
    const q = f => e[Math.round(f * (e.length - 1))];
    return { center: all[0], relief_m: q(0.95) - q(0.05) };
  }
  async function scanPoint(lat, lng) {
    if (state.scanBusy) return;
    state.scanBusy = true; renderPanel();
    globe.ringsData([{ lat, lng }]);
    try {
      const [power, rel, ndvi, geo] = await Promise.all([fetchPower(lat, lng), fetchReliefWindow(lat, lng), fetchNdvi(lat, lng), fetchGeology(lat, lng)]);
      if (power.t2m == null) throw new Error("no data");
      const s = { id: "scan", name: state.lang === "es" ? "Punto escaneado" : "Scanned point", country: `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`, lat, lon: lng,
        scanned: true, usage: 0, access: null, power, elev: rel.center, relief_m: rel.relief_m, relief: TW.clamp(rel.relief_m / 1500) };
      KEYS.forEach(k => { if (!CLIMATE_KEYS.includes(k) && k !== "relief") s[k] = null; });
      if (ndvi != null) { s.ndvi = ndvi; s.barren = TW.clamp((0.5 - ndvi) / 0.4); }
      s.geo = geo; s.geo_kind = {};
      Object.entries(TW.geoAxes(geo, rel.relief_m)).forEach(([k, v]) => { s[k] = v; s.geo_kind[k] = GEO_KIND[k]; });
      s.fp = TW.fingerprint(s);
      state.scan = s; state.selectedId = "scan";
      Guide.say(T().guide.scanDone(short(reverseTwins(s)[0].t.name)));
    } catch (e) {
      state.scan = null;
    }
    state.scanBusy = false;
    renderPanel();
    if (state.stage === "earth") showEarthMode(false); else showEarthResults(rank(), false);
  }

  async function fetchNdvi(lat, lon) {
    // MODIS Terra MOD13Q1 NDVI (250 m) from the ORNL DAAC web service: January + July 2023 composites, 2 km window
    try {
      const vals = [];
      await Promise.all(["A2023017", "A2023193"].map(async d => {
        const js = await (await fetch(`https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&band=250m_16_days_NDVI&startDate=${d}&endDate=${d}&kmAboveBelow=1&kmLeftRight=1`, { headers: { Accept: "application/json" } })).json();
        js.subset.forEach(sub => sub.data.forEach(v => { if (v > -2000) vals.push(v * 0.0001); }));
      }));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    } catch { return null; }
  }

  // ---------- live terrain measurements (same method as pipeline/geology.py) ----------
  const PC = "https://planetarycomputer.microsoft.com/api";
  const RX = {
    basaltStrong: /basalt|basanit|tholeiit|picrit|mafic|komatiit|gabbro|diabase|dolerit/, basaltWeak: /lava|scoria|cinder|tephra|volcanic|pyroclast|tuff|ignimbrit|andesit/,
    salt: /evaporit|halite|gypsum|anhydrit|salt|salar|playa|sabkha|nitrate|borate|trona/,
    sedStrong: /lacustrin|\blake|fluvi|alluvi|delta|river|stream|channel|floodplain|playa|terrace|outwash|glaciofluv/, sedWeak: /sediment|sand|silt|clay|mud|conglomerat|gravel|unconsolidated/,
  };
  const SCALE_ORDER = { large: 0, medium: 1, small: 2, tiny: 3 };
  // map scales that can resolve each axis in a 15 km window (see pipeline/geology.py)
  const AXIS_SCALES = { basalt: ["large", "medium", "small"], salts: ["large", "medium"], sediment: ["large", "medium"] };
  const postJson = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };

  async function macroPoint(lat, lon) {
    const js = await (await fetch(`https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}`)).json();
    const units = (js.success?.data || []).sort((a, b) => (SCALE_ORDER[a.scale] ?? 4) - (SCALE_ORDER[b.scale] ?? 4));
    for (const u of units) {
      const text = ["name", "lith", "descrip"].map(k => u[k] || "").join(" ").toLowerCase();
      if (text.trim().length < 4) continue;
      return { unit: (u.name || u.lith || "").slice(0, 80), scale: u.scale, basalt: RX.basaltStrong.test(text) ? 1 : RX.basaltWeak.test(text) ? 0.5 : 0,
        salts: RX.salt.test(text) ? 1 : 0, sediment: RX.sedStrong.test(text) ? 1 : RX.sedWeak.test(text) ? 0.4 : 0 };
    }
    return null;
  }
  async function fetchGeology(lat, lon) {
    const km = 15, dlat = km / 111.2, kx = 111.2 * Math.max(Math.cos((lat * Math.PI) / 180), 0.05), dlon = km / kx;
    const bbox = [lon - dlon, Math.max(lat - dlat, -89.9), lon + dlon, Math.min(lat + dlat, 89.9)];
    const feat = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]] } };
    const search = async (collection, datetime, limit = 100) => (await postJson(`${PC}/stac/v1/search`, { collections: [collection], bbox, limit, ...(datetime ? { datetime } : {}) })).features;
    const stats = async (collection, id, asset, extra = "") => {
      const js = await postJson(`${PC}/data/v1/item/statistics?collection=${collection}&item=${encodeURIComponent(id)}&assets=${asset}${extra}`, feat);
      const band = Object.values(js.properties?.statistics || js)[0];
      return band && band.valid_pixels ? band : null;
    };
    const categorical = async (collection, asset) => {
      const counts = {};
      for (const b of await Promise.all((await search(collection)).map(it => stats(collection, it.id, asset, "&categorical=true").catch(() => null))))
        if (b) b.histogram[0].forEach((n, i) => { const v = b.histogram[1][i]; counts[v] = (counts[v] || 0) + n; });
      return counts;
    };
    const safe = p => p.catch(() => null);
    const step = km / 2, pts = [];
    for (const i of [0, -1, 1]) for (const j of [0, -1, 1]) pts.push([lat + (i * step) / 111.2, lon + (j * step) / kx]);
    const [macro, wc, gsw, palsar, lst] = await Promise.all([
      safe((async () => {
        const res = await Promise.all(pts.map(p => macroPoint(...p).catch(() => null))), ok = res.filter(Boolean);
        if (!ok.length) return null;
        const out = { n: ok.length, unit: (res[0] || ok[0]).unit };
        Object.entries(AXIS_SCALES).forEach(([k, scales]) => {
          const use = ok.filter(r => scales.includes(r.scale)).map(r => r[k]);
          if (use.length) { out[k] = use.reduce((a, b) => a + b, 0) / use.length; out[`${k}_n`] = use.length; }
        });
        return out;
      })()),
      safe((async () => {
        const c = await categorical("esa-worldcover", "map"), tot = Object.values(c).reduce((a, b) => a + b, 0);
        return tot ? { snow_ice: (c[70] || 0) / tot, bare: (c[60] || 0) / tot, water: (c[80] || 0) / tot } : null;
      })()),
      safe((async () => {
        const c = await categorical("jrc-gsw", "occurrence");
        let tot = 0, wet = 0;
        Object.entries(c).forEach(([v, n]) => { if (+v <= 100) { tot += n; if (+v > 0) wet += n; } });
        return tot ? { ever_wet: wet / tot } : null;
      })()),
      safe((async () => {
        for (const year of ["2020", "2019", "2021"]) { // 2021 has gaps (e.g. the Atacama)
          let num = 0, den = 0;
          for (const b of await Promise.all((await search("alos-palsar-mosaic", `${year}-01-01/${year}-12-31`)).map(it => stats("alos-palsar-mosaic", it.id, "HV").catch(() => null))))
            if (b && b.median >= 10) { num += (20 * Math.log10(b.median) - 83) * b.valid_pixels; den += b.valid_pixels; }
          if (den) return { hv_db: num / den, year: +year };
        }
        return null;
      })()),
      safe((async () => {
        // live scan: 4 seasonal composites (the catalog uses all 12 months)
        const items = (await search("modis-11A2-061", `${LST_YEAR}-01-01/${LST_YEAR}-12-31`, 500)).filter(it => it.id.startsWith("MOD11A2"));
        const byDate = {};
        items.forEach(it => (byDate[it.properties.start_datetime.slice(0, 10)] ||= []).push(it));
        const months = {};
        Object.keys(byDate).sort().forEach(d => { if (!months[d.slice(0, 7)]) months[d.slice(0, 7)] = d; });
        const picks = ["01", "04", "07", "10"].map(m => months[`${LST_YEAR}-${m}`]).filter(Boolean);
        const vals = await Promise.all(picks.flatMap(d => ["LST_Day_1km", "LST_Night_1km"].map(async asset => {
          let num = 0, den = 0;
          for (const it of byDate[d]) { const b = await stats("modis-11A2-061", it.id, asset).catch(() => null); if (b && b.mean) { num += b.mean * b.valid_pixels; den += b.valid_pixels; } }
          return den ? (num / den) * 0.02 - 273.15 : null;
        })));
        const ok = vals.filter(v => v != null);
        return ok.length ? { lst_mean_c: ok.reduce((a, b) => a + b, 0) / ok.length } : null;
      })()),
    ]);
    return { macrostrat: macro, worldcover: wc, gsw, palsar, lst };
  }

  // ---------- reverse twin: which Moon/Mars site does this Earth place resemble? ----------
  function reverseTwins(site) {
    const w = TW.profileWeights("balanced");
    return TARGETS.map(t => ({ t, ...TW.compare(site.fp, t, w) })).sort((a, b) => b.score - a.score);
  }
  function reverseHtml(site) {
    state.revSite = site;
    const list = reverseTwins(site).slice(0, 3);
    return `<div class="sec">${T().reverse.title}</div><p class="help">${T().reverse.lead}</p>
      <ul class="twins">${list.map((r, i) => `<li><span class="orb ${r.t.body}"></span><span><b>${esc(short(r.t.name))}</b><small>${r.t.body === "Moon" ? T().moon : T().mars}</small>
        <span class="bar"><i style="width:${r.score}%;background:${i === 0 ? "var(--target)" : "var(--accent)"}"></i></span></span>
        <span class="v">${r.score.toFixed(0)}</span><button class="mini-btn" data-cmp="${r.t.id}">${T().reverse.see}</button></li>`).join("")}</ul>`;
  }
  function bindReverse() { document.querySelectorAll("[data-cmp]").forEach(b => (b.onclick = () => openCompare(state.revSite, b.dataset.cmp))); }

  function peek(id) {
    const t = TARGETS.find(x => x.id === id);
    state.peek = id;
    globe.arcsData([]);
    setTexture(t.body);
    globe.pointsData([{ lat: t.lat, lng: t.lon, alt: 0.02, r: 1.1, color: "#ff9b47", label: esc(t.name) }]);
    globe.htmlElementsData([{ lat: t.lat, lng: t.lon, alt: 0.03, el: labelEl(short(t.name), "win") }]);
    globe.ringsData([{ lat: t.lat, lng: t.lon }]);
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 70 : t.lat, lng: t.lon, altitude: 1.5 }, 1400);
    let bar = $("#peekBar");
    if (!bar) { bar = document.createElement("div"); bar.id = "peekBar"; bar.className = "peekbar"; document.body.appendChild(bar); }
    bar.innerHTML = `<span>${T().reverse.viewing(esc(short(t.name)))}</span><button class="btn" id="unpeek">${T().reverse.backEarth}</button>`;
    bar.hidden = false;
    $("#unpeek").onclick = () => unpeek(true);
  }
  function unpeek(redraw) {
    state.peek = null;
    const bar = $("#peekBar"); if (bar) bar.hidden = true;
    if (!redraw) return;
    if (state.stage === "earth") showEarthMode(true);
    else if (state.tab === "map") drawHeatmap();
    else if (state.tab === "camp") renderVerdictPanel();
    else showEarthResults(rank(), true);
  }

  // ---------- "start from Earth" mode ----------
  function showEarthMode(focus) {
    setTexture("Earth");
    const sc = state.scan;
    globe.arcsData([]);
    globe.pointsData(CURATED.map(s => ({ lat: s.lat, lng: s.lon, alt: 0.02, r: 0.45, color: "#36c2b4", label: `<b>${esc(s.name)}</b>`,
      onClick: () => { state.scan = s; renderEarthPanel(); showEarthMode(true); } })));
    globe.htmlElementsData(sc ? [{ lat: sc.lat, lng: sc.lon, alt: 0.02, el: labelEl(sc.name.split(" – ")[0], "win") }] : []);
    globe.ringsData(sc ? [{ lat: sc.lat, lng: sc.lon }] : []);
    if (focus) globe.pointOfView(sc ? { lat: sc.lat, lng: sc.lon, altitude: 1.6 } : { lat: 0, lng: -70, altitude: 2.2 }, 1200);
  }
  function renderEarthPanel() {
    const sc = state.scan, E = T().earth;
    let body = `<p class="help">${E.pick}</p>`;
    const best = sc ? reverseTwins(sc)[0] : null;
    if (state.scanBusy) body = `<div class="scanbox busy">${T().scanning}</div>`;
    else if (sc) {
      body = `<div class="scanbox"><b>${esc(sc.name)}</b><br><small class="help">${esc(CTRY(sc.country))}${sc.elev != null ? ` · ${Math.round(sc.elev)} m` : ""}</small>
        ${sc.scanned ? "" : `<button class="btn place-btn" id="placeBtn">${T().place.btn}</button>`}
        ${reverseHtml(sc)}
        <div class="sec">${T().viz.title}</div>
        ${profileChart(sc.fp, best.t, best.per, TW.profileWeights("balanced"), sc.scanned ? T().guide.yourPlace.replace(/^./, ch => ch.toUpperCase()) : sc.name.split(" – ")[0])}</div>`;
      setTimeout(() => bindTips($("#panel")), 0);
    }
    $("#panel").innerHTML = `<div class="p-body"><h2 class="p-title">${E.title}</h2><p class="p-sub">${E.help}</p>${body}</div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button>${best && !state.scanBusy
        ? `<button class="btn big" id="travelBtn">${E.travel(esc(short(best.t.name)))}</button>`
        : `<button class="btn" id="toMission">${E.toMission}</button>`}</div>`;
    $("#backBtn").onclick = goHome;
    const tb = $("#travelBtn"); if (tb) tb.onclick = () => outbound(sc, best.t);
    const pb = $("#placeBtn"); if (pb && sc) pb.onclick = () => openPlace(sc, reverseTwins(sc)[0].t);
    if ($("#toMission")) $("#toMission").onclick = () => {
      const t = sc ? reverseTwins(sc)[0].t : TARGETS[0];
      if (state.peek) unpeek(false);
      state.scan = null; go("dest"); pickTarget(t.id);
    };
    bindReverse();
  }

  // ---------- global heat map (NASA POWER on a 3° land grid) ----------
  let gridCache = null;
  function gridCells() {
    if (gridCache) return gridCache;
    const G = window.TW_GRID;
    if (!G) return null;
    gridCache = G.rows.map(r => {
      const pw = {}; G.cols.forEach((c, i) => (pw[c] = r[i]));
      return { lat: pw.lat, lon: pw.lon, fp: TW.climateFromPower(pw, null), power: pw };
    });
    return gridCache;
  }
  function gridScores() {
    const cells = gridCells(); if (!cells) return null;
    const t = target(), w = weights(), wc = {};
    KEYS.forEach(k => (wc[k] = CLIMATE_KEYS.includes(k) ? w[k] : 0));
    return cells.map(c => ({ ...c, score: TW.compare(c.fp, t, wc).score }));
  }
  function distKm(a, b) {
    const r = Math.PI / 180, x = Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r);
    return 6371 * Math.acos(Math.min(1, Math.max(-1, x)));
  }
  function hotspots(scored, n = 5) {
    const out = [];
    for (const c of scored.slice().sort((a, b) => b.score - a.score)) {
      if (CURATED.some(s => distKm(c, s) < 700)) continue; // already catalogued nearby
      if (out.some(o => distKm(c, o) < 900)) continue;     // keep the list geographically diverse
      out.push(c);
      if (out.length >= n) break;
    }
    return out;
  }
  let heatScored = null, earthImg = null;
  function loadEarthImage() {
    if (earthImg) return Promise.resolve(earthImg);
    return new Promise(res => { const im = new Image(); im.onload = () => res((earthImg = im)); im.src = TEX.Earth; });
  }
  async function drawHeatmap() {
    // the heat map is painted INTO the globe texture (one image) instead of thousands of 3D objects
    const scored = gridScores(); if (!scored) return null;
    heatScored = scored;
    const lo = Math.min(...scored.map(c => c.score)), hi = Math.max(...scored.map(c => c.score));
    const W = 2048, H = 1024, step = window.TW_GRID.step || 2.5;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    g.drawImage(await loadEarthImage(), 0, 0, W, H);
    g.fillStyle = "rgba(3,6,13,0.45)"; g.fillRect(0, 0, W, H);
    const cw = (step / 360) * W, ch = (step / 180) * H;
    for (const c of scored) {
      const t = TW.clamp((c.score - lo) / (hi - lo || 1));
      g.globalAlpha = 0.35 + 0.55 * t;
      g.fillStyle = scoreColor(c.score, lo + (hi - lo) * 0.25, hi);
      g.fillRect(((c.lon + 180) / 360) * W - cw / 2, ((90 - c.lat) / 180) * H - ch / 2, cw + 0.5, ch + 0.5);
    }
    g.globalAlpha = 1;
    globe.globeImageUrl(cv.toDataURL("image/jpeg", 0.88)); currentTex = "heat";
    globe.pointsData(CURATED.map(s => ({ lat: s.lat, lng: s.lon, alt: 0.02, r: 0.3, color: "#ffffff", label: esc(s.name), onClick: () => selectSite(s.id) })));
    globe.ringsData([]).arcsData([]).htmlElementsData([]);
    return scored;
  }
  function heatClick(lat, lng) {
    // merged hexes are not individually clickable: scan the nearest grid cell instead
    if (!heatScored) return;
    const c = heatScored.reduce((b, x) => (distKm({ lat, lon: lng }, x) < distKm({ lat, lon: lng }, b) ? x : b));
    state.tab = "scan"; renderVerdictPanel(); setTexture("Earth"); scanPoint(c.lat, c.lon);
  }
  function tabMap() {
    const M = T().map;
    if (!window.TW_GRID) { $("#tabBody").innerHTML = `<p class="help">${M.missing}</p>`; return; }
    const scored = gridScores();
    drawHeatmap();
    const hs = hotspots(scored);
    $("#tabBody").innerHTML = `<h2 class="p-title">${M.title}</h2><p class="p-sub">${M.lead(scored.length, window.TW_GRID.step)}</p>
      <div class="legend-bar"><span>${Math.round(Math.min(...scored.map(c => c.score)))}</span><i style="background:linear-gradient(90deg,${STOPS.join(",")})"></i><span>${Math.round(Math.max(...scored.map(c => c.score)))}</span></div>
      <p class="help">${M.climateOnly}</p>
      <div class="sec">${M.hotspots}</div>
      <ol class="rank" id="hotList">${hs.map((c, i) => `<li data-i="${i}"><div><b id="hs${i}">${c.lat.toFixed(1)}°, ${c.lon.toFixed(1)}°</b><small>${c.power.t2m.toFixed(1)} °C · ${(c.power.precip * 365).toFixed(0)} mm/${state.lang === "es" ? "año" : "yr"} · ${c.power.ps.toFixed(0)} kPa</small></div><span class="v">${c.score.toFixed(0)}</span></li>`).join("")}</ol>`;
    document.querySelectorAll("#hotList li").forEach(li => (li.onclick = () => { const c = hs[+li.dataset.i]; globe.pointOfView({ lat: c.lat, lng: c.lon, altitude: 1.3 }, 1200); globe.ringsData([{ lat: c.lat, lng: c.lon }]); }));
    globe.pointOfView({ lat: hs[0]?.lat ?? 0, lng: hs[0]?.lon ?? 0, altitude: 2.4 }, 1400);
    hs.forEach((c, i) => placeName(c.lat, c.lon).then(n => { const el = $("#hs" + i); if (el && n) el.textContent = `${n} (${c.lat.toFixed(1)}°, ${c.lon.toFixed(1)}°)`; }));
  }
  const placeCache = {};
  async function placeName(lat, lon) {
    const k = `${lat},${lon},${state.lang}`;
    if (k in placeCache) return placeCache[k];
    try {
      const j = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${state.lang}`)).json();
      return (placeCache[k] = [j.principalSubdivision, j.countryName].filter(Boolean).join(", ") || null);
    } catch { return null; }
  }

  // ---------- "Get to know the place": photo + Wikipedia + same-scale satellite comparison ----------
  const VIEW_KM = 40;
  function viewSource(site) {
    return site.lat < -60 ? "NASA GIBS · MODIS Terra (250 m)" : "NASA GIBS · Landsat WELD (30 m)";
  }
  function targetSource(t) {
    return t.body === "Moon" ? "NASA Moon Trek · LRO WAC (~100 m)" : "NASA Mars Trek · Viking MDIM 2.1 (232 m)";
  }
  function openPlace(site, t) {
    const P = T().place, w = (window.TW_WIKI || {})[site.id] || {};
    const txt = (state.lang === "es" && w.es) ? w.es : w.en;
    const ph = w.photo;
    const world = t.body === "Moon" ? T().moon : T().mars;
    let m = $("#placeModal");
    if (!m) { m = document.createElement("div"); m.id = "placeModal"; m.className = "modal"; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(P.title)}">
      <header class="modal-head"><div><small>${P.title}</small><h2>${esc(site.name)}</h2><span class="help">${esc(CTRY(site.country))}</span></div>
        <button class="modal-x" id="placeClose" aria-label="${P.close}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
      <div class="modal-body">
        <div class="place-top">
          ${ph ? `<figure class="photo"><img src="${esc(ph.src)}" alt="${esc(site.name)}" loading="lazy">
            <figcaption>${P.photo}: ${esc(ph.author)} · ${esc(ph.license)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>`
            : `<p class="help">${P.noPhoto}</p>`}
          <div class="wiki">${txt ? `<p>${esc(txt.extract)}</p><a href="${esc(txt.url)}" target="_blank" rel="noopener">${P.read}</a><small>${P.textCredit}${state.lang === "es" && !w.es ? ". Este lugar no tiene artículo en español: el resumen está en inglés." : ""}</small>` : `<p class="help">${P.noText}</p>`}
            ${site.note ? `<p class="note">${esc(NOTE(site))}</p>` : ""}</div>
        </div>
        <div class="sec">${P.compare(esc(site.name.split(" – ")[0]), esc(short(t.name)))}</div>
        <div class="cmp" id="cmp" style="--pos:50%">
          <img src="assets/views/target/${t.id}.jpg" alt="${esc(t.name)}">
          <img class="cmp-earth" src="assets/views/earth/${site.id}.jpg" alt="${esc(site.name)}">
          <span class="cmp-line"></span>
          <span class="cmp-tag left">${P.earth}</span><span class="cmp-tag right">${world}</span>
          <span class="cmp-scale"><i></i>10 km</span>
          <input type="range" min="0" max="100" value="50" id="cmpRange" aria-label="${esc(P.compare(site.name, t.name))}">
        </div>
        <div class="cmp-src"><span>${P.earth}: ${viewSource(site)}</span><span>${world}: ${targetSource(t)}</span></div>
        <p class="help">${P.compareHelp}</p>
      </div></div>`;
    m.hidden = false;
    document.body.classList.add("modal-open");
    const cmp = $("#cmp");
    $("#cmpRange").oninput = e => cmp.style.setProperty("--pos", e.target.value + "%");
    $("#placeClose").onclick = closePlace;
    m.onclick = e => { if (e.target === m) closePlace(); };
  }
  function closePlace() {
    const m = $("#placeModal"); if (m) m.hidden = true;
    document.body.classList.remove("modal-open");
  }
  addEventListener("keydown", e => { if (e.key === "Escape") closePlace(); });

  // ---------- exports ----------
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCSV(results) {
    const head = ["rank", "site", "country", "lat", "lon", "twin_score", "rank_value", "usage", ...KEYS];
    const rows = results.map((r, i) => [i + 1, r.site.name, r.site.country, r.site.lat, r.site.lon, r.score.toFixed(2), r.value.toFixed(2), r.site.usage ?? "", ...KEYS.map(k => r.site.fp[k] == null ? "" : r.site.fp[k].toFixed(3))]);
    download(`earth-analogs_${state.targetId}_${state.profile}_${state.mode}.csv`, [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  }
  function exportCard(r) {
    const s = r.site, t = target();
    const md = `# Earth Analogs – ${s.name}
**${T().twinScore}:** ${dec(r.score, 1)}/100 · ${short(t.name)} (${t.body}) · ${PL(state.profile)}
**${CTRY(s.country)}** · ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)} · ${s.elev == null ? "" : Math.round(s.elev) + " m"}

| Axis | Earth | Earth data | Target | Target data | Match |
|---|---|---|---|---|---|
${KEYS.map(k => `| ${FL(k)} | ${s.fp[k] == null ? "?" : dec(s.fp[k], 2)} | ${earthDetail(k, s)} | ${dec(t[k], 2)} | ${targetDetail(k, t)} | ${r.per[k] == null ? "?" : Math.round(r.per[k] * 100) + "%"} |`).join("\n")}

${NOTE(s) || ""}

${T().beyond}

_Earth Analogs · NASA Space Apps 2026 · ${new Date().toISOString().slice(0, 10)}_
`;
    download(`earth-analogs_${s.id}_${t.id}.md`, md, "text/markdown");
  }

  function downloadBlob(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function exportCertificate(r) {
    const s = r.site, t = target(), C = T().cert;
    const code = state.code || missionCode();
    const blob = await Patch.certificate({
      title: C.title, name: crewName(), role: roleLabel(),
      patch: { name: crewName(), code, body: t.body },
      statement: C.statement(PL(state.profile), short(t.name)),
      rows: [[C.code, code], [C.target, `${short(t.name)}, ${t.body === "Moon" ? T().moon : T().mars}`], [C.mission, PL(state.profile)],
        [C.twin, `${s.name}, ${CTRY(s.country)}`], [C.score, `${dec(r.score, 1)} / 100`], [C.date, new Date().toLocaleDateString(state.lang)]],
      footer: C.footer,
    });
    downloadBlob(`earth-analogs_${code}.png`, blob);
  }

  // ---------- deep links ----------
  function writeHash() { history.replaceState(null, "", `#t=${state.targetId}&p=${state.profile}&m=${state.mode}`); }
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const t = TARGETS.find(x => x.id === h.get("t"));
    if (!t || !PROFILES[h.get("p")]) return false;
    state.targetId = t.id; state.body = t.body; state.profile = h.get("p");
    if (["match", "untapped", "ready"].includes(h.get("m"))) state.mode = h.get("m");
    return true;
  }

  // ---------- boot ----------
  $("#startBtn").onclick = () => go("crew");
  $("#guideSound").onclick = () => { SFX.set(true); renderChrome(); SFX.go(); Guide.repeat(); };
  $("#soundBtn").onclick = () => { SFX.set(!SFX.on); renderChrome(); SFX.go(); if (SFX.on) Guide.repeat(); else Guide.hush(); };
  $("#skipBtn").onclick = skipJourney;
  addEventListener("keydown", e => { if (e.key === "Escape" && run) skipJourney(); });
  $("#homeBtn").onclick = goHome;
  $("#earthBtn").onclick = () => { state.scan = null; state.targetId = null; ctl.autoRotate = false; go("earth"); showEarthMode(true); };
  document.querySelectorAll("#lang button").forEach(b => (b.onclick = () => {
    state.lang = b.dataset.l; applyNames(); renderChrome(); renderPanel(); if (!run) guideStage(state.stage);
    if (state.stage === "verdict" && state.tab !== "camp") showEarthResults(rank(), false);
  }));

  Guide.init({ voiceOn: () => SFX.on, lang: () => state.lang });
  Guide.show(true);
  renderChrome(); layoutGlobe();
  globe.pointOfView({ lat: 10, lng: -40, altitude: 2.3 }, 0);
  if (!location.hash) setTimeout(() => state.stage === "intro" && Guide.say(T().guide.intro), 900);
  if (readHash()) {
    state.selectedId = rank()[0].site.id; ctl.autoRotate = false;
    go("verdict"); showEarthResults(rank(), true);
  }
  window.TWApp = { state, scanPoint, globe }; // handle for debugging / demos
})();
