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
  function applyNames() {
    [...CURATED, ...TARGETS].forEach(x => (x.name = (state.lang === "es" && I18N_DATA.name.es[x.id]) || x.name_en));
    const sc = state.scan;
    if (sc?.scanned) sc.name = sc === state.origin ? T().guide.yourPlace.replace(/^./, c => c.toUpperCase()) : (state.lang === "es" ? "Punto escaneado" : "Scanned point");
  }
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
  let STOPS_C = null;
  const STOPS = () => (STOPS_C ||= [0, 1, 2, 3].map(i => getComputedStyle(document.documentElement).getPropertyValue(`--ramp-${i}`).trim()));
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function scoreColor(score, lo = 30, hi = 75) {
    if (!Number.isFinite(score)) return STOPS()[0];
    const st = STOPS(), t = TW.clamp((score - lo) / (hi - lo)) * (st.length - 1);
    const i = Math.min(Math.floor(t), st.length - 2), f = t - i;
    const a = hex(st[i]), b = hex(st[i + 1]);
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
    // back on Earth from anywhere: a "Viewing <Moon/Mars site>" bar no longer applies
    if (body === "Earth" && state.peek) { state.peek = null; const bar = $("#peekBar"); if (bar) bar.hidden = true; }
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
    globe.htmlElementsData([{ lat: sel.lat, lng: sel.lon, alt: 0.02, el: landerEl() }, { lat: sel.lat, lng: sel.lon, alt: 0.02, el: labelEl(sel.name.split(" – ")[0], "win below") }]);
    globe.ringsData([{ lat: sel.lat, lng: sel.lon }]).arcsData([]);
    if (focus) globe.pointOfView({ lat: sel.lat, lng: sel.lon, altitude: 1.6 }, 1600);
  }

  // ---------- chrome ----------
  function renderChrome() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i]").forEach(el => (el.textContent = T()[el.dataset.i]));
    document.querySelectorAll("[data-i-aria]").forEach(el => el.setAttribute("aria-label", T()[el.dataset.iAria]));
    document.querySelectorAll("#lang button").forEach(b => b.classList.toggle("on", b.dataset.l === state.lang));
    const idx = { intro: -1, earth: -1, crew: 0, dest: 1, mission: 2, brief: 2, launch: 3, verdict: 4 }[state.stage];
    $("#soundBtn span").textContent = SFX.on ? T().soundOn : T().soundOff;
    $("#soundBtn").setAttribute("aria-pressed", String(SFX.on));
    $("#soundBtn").setAttribute("aria-label", SFX.on ? T().soundOn : T().soundOff);
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
      const pos = state.origin ? rank().findIndex(x => x.site.id === state.origin.id) + 1 : 0;
      if (s) Guide.say(G.verdict(crewName(), s.name.split(" – ")[0]) + (pos ? " " + G.originRank(pos, allSites().length) : ""));
      if (!touring) setGuideActions([{ label: T().tour.start, run: startTour, cue: !tourSeen }]);
      return;
    }
    const line = { intro: G.intro, earth: G.earth, crew: G.crew, dest: G.dest(crewName()), mission: (state.crew.role === "geo" && state.body === "Moon" ? G.missionRole.geoMoon : G.missionRole[state.crew.role]) || G.mission, brief: G.brief }[stage];
    if (line) Guide.say(line);
  }
  function closeModals() {
    ["#placeModal", "#cmpModal", "#vizTip"].forEach(id => { const m = $(id); if (m) m.hidden = true; });
    document.body.classList.remove("modal-open");
  }
  function go(stage) {
    if (touring && stage !== "verdict") { touring = false; document.body.classList.remove("touring"); spot(null); }
    if (stage !== "verdict") setGuideActions([]);
    if (state.peek && !["verdict", "earth"].includes(stage)) unpeek(false);
    closeModals();
    state.stage = stage; renderChrome(); layoutGlobe(); renderPanel();
    guideStage(stage);
    $("#hint").hidden = true;
  }

  // ---------- panel per stage ----------
  const recFor = id => roleProfiles(state.crew.role).includes(id);
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
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big cue" id="crewGo">${C.go}</button></div>`;
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
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big cue" id="acceptBtn">${B.accept}</button></div>`;
      requestAnimationFrame(() => Patch.paint($("#patch"), patchOpts()));
      $("#backBtn").onclick = () => go("mission");
      $("#acceptBtn").onclick = () => { store.set("flights", store.get("flights", 0) + 1); launch(); };
    }
    if (state.stage === "dest") {
      const list = TARGETS.filter(t => t.body === state.body);
      p.innerHTML = `<div class="p-body">
        <h2 class="p-title">${T().chooseBody}</h2>
        <div class="bodies">${["Moon", "Mars"].map(b => `<button class="body-btn ${b === state.body ? "on" : ""}" aria-pressed="${b === state.body}" data-b="${b}"><span class="orb ${b}"></span>${b === "Moon" ? T().moon : T().mars}</button>`).join("")}</div>
        <p class="p-sub">${T().chooseSite}</p>
        <div class="sites">${list.map(t => `<button class="site-btn ${t.id === state.targetId ? "on" : ""}" aria-pressed="${t.id === state.targetId}" data-id="${t.id}"><b>${esc(short(t.name))}</b><span>${esc(I18N_TARGET_TAG[state.lang][t.id])}</span></button>`).join("")}</div>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn ${state.targetId ? "cue" : ""}" id="nextBtn" ${state.targetId ? "" : "disabled"}>${T().next}</button></div>`;
      p.querySelectorAll(".body-btn").forEach(b => (b.onclick = () => { state.body = b.dataset.b; state.targetId = null; showTargetsOnGlobe(); globe.pointOfView({ lat: 0, lng: 0, altitude: 2.4 }, 1000); renderPanel(); }));
      p.querySelectorAll(".site-btn").forEach(b => (b.onclick = () => pickTarget(b.dataset.id)));
      $("#backBtn").onclick = () => go("crew");
      $("#nextBtn").onclick = () => go("mission");
    }
    if (state.stage === "mission") {
      const t = target();
      p.innerHTML = `<div class="p-body">
        <div class="chosen"><span class="orb ${t.body}"></span><span><b>${esc(short(t.name))}</b>, ${t.body === "Moon" ? T().moon : T().mars}</span></div>
        <h2 class="p-title">${T().chooseMission}</h2>
        <p class="p-sub">${T().missionHint}</p>
        <div class="missions">${Object.keys(PROFILES).sort((a, b) => recFor(b) - recFor(a)).map(id => `<button class="mission ${id === state.profile ? "on" : ""} ${recFor(id) ? "is-rec" : ""}" aria-pressed="${id === state.profile}" data-id="${id}">${icon(id)}${recFor(id) ? `<em class="rec">${T().rec}</em>` : ""}<b>${PL(id)}</b><span>${I18N_PROFILE_DESC[state.lang][id]}</span></button>`).join("")}</div>
      </div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button><button class="btn big ${state.profile ? "cue" : ""}" id="launchBtn" ${state.profile ? "" : "disabled"}>${T().launch}</button></div>`;
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
    const tt = TARGETS.find(x => x.id === id); if (tt) document.body.dataset.dest = tt.body;
    const t = TARGETS.find(x => x.id === id);
    state.targetId = id; state.body = t.body; ctl.autoRotate = false;
    showTargetsOnGlobe();
    globe.pointOfView({ lat: Math.abs(t.lat) > 80 ? Math.sign(t.lat) * 70 : t.lat, lng: t.lon, altitude: 1.5 }, 1200);
    if (state.stage === "dest") { renderPanel(); Guide.say(T().guide.targets[id]); }
  }
  function goHome() {
    state.origin = null; state.scan = null;
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
      [P.target(target()?.body), Promise.resolve(true)],
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
  const coord = (lat, lon) => `${dec(Math.abs(lat), 1)}° ${lat >= 0 ? "N" : "S"}, ${dec(Math.abs(lon), 1)}° ${lon >= 0 ? "E" : state.lang === "es" ? "O" : "W"}`;
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
    { const tt = target(), rr = tt && rank().find(x => x.site.id === site.id); if (rr) $("#outCap").textContent = `${O.twinOf(short(tt.name), Math.round(rr.score))} ${$("#outCap").textContent}`; }
    $("#outGo").textContent = O.go;
    $("#outside").hidden = false; document.body.classList.add("outside-on");
  }
  function waitButton(btn, ms) {
    return new Promise(res => {
      const done = how => { btn.onclick = null; res(how); };
      btn.onclick = e => { e.stopPropagation(); done("click"); };
      if (btn.id === "outGo") $("#outside").onclick = () => { $("#outside").onclick = null; done("click"); }; // a tap anywhere on the photo continues
      if (ms) pause(ms).then(() => done("time"));
      else if (run) { if (run.skipped) done("skip"); else run.waits.push(() => done("skip")); }
    });
  }
  function endJourney() {
    $("#touchdown").hidden = true; hud(false); $("#terminal").hidden = true; $("#skipBtn").hidden = true; $("#countdown").hidden = true;
    $("#outside").hidden = true; document.body.classList.remove("outside-on"); $("#windowPhoto").classList.remove("on"); $("#windowPhoto").hidden = true;
    $("#hatch").className = "hatch"; $("#cockpit").classList.remove("on");
    warp(false); SFX.humStop(); $("#plasma").classList.remove("on"); $("#flash").classList.remove("on");
    $("#ship").getAnimations().forEach(a => a.cancel());
  }

  async function launch() {
    const t = target(), w = weights();
    const now = name => new Proxy({}, { get: (_, k) => T()[name][k] }); // follows a language switch mid-flight
    const G = now("guide"), H = now("hud"), L = now("log");
    state.mode = "match"; state.tab = "verdict"; state.scan = state.origin || null;
    state.code = state.code || missionCode();
    state.myProfile = state.profile;
    const results = rank("match", state.origin ? CURATED.concat(state.origin) : CURATED), win = results[0].site, siteShort = win.name.split(" – ")[0];
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
    if (!state.returning) await pollSystems(win); // coming back from the outbound trip: the links were already checked
    state.returning = false;
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
    $("#outGo").focus();
    await waitButton($("#outGo"));

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
    state.origin = site.scanned ? site : null; // a clicked place joins the ranking for the mission planned there
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
    $("#outside").hidden = false; document.body.classList.add("outside-on");
    await hatchOpen();
    say(G.outsidePlan);
    $("#outGo").focus();
    await waitButton($("#outGo"));

    // next: pick the mission to rehearse at this destination
    endJourney(); run = null;
    state.scan = state.origin; state.returning = true;
    applyNames();
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
      case "aridity": return pw.precip == null ? "" : `${dec((pw.precip * 365), 0)} mm/${es ? "año" : "yr"}; ${es ? "HR" : "RH"} ${dec(pw.rh, 0)}%; NASA POWER`;
      case "cold": return pw.t2m == null ? "" : `${es ? "T media" : "Mean T"} ${dec(pw.t2m, 1)} °C; NASA POWER`;
      case "swing": return pw.t2m_range == null ? "" : `Δ ${es ? "diaria" : "daily"} ${dec(pw.t2m_range, 1)} °C; NASA POWER`;
      case "thin_air": return clim._ps == null ? "" : `${dec(clim._ps, 1)} kPa; ${Math.round(s.elev ?? 0)} m; NASA POWER + DEM`;
      case "radiation": return pw.sw == null ? "" : `${dec(pw.sw, 1)} kWh/m²/d; UV ${dec(pw.uv, 1)}; NASA POWER`;
      case "light": return pw.sw_min == null ? "" : `${es ? "mes oscuro/brillante" : "dark/bright month"} ${dec((pw.sw_min / pw.sw_max), 2)}; NASA POWER`;
      case "relief": return s.relief_m == null ? "" : `${Math.round(s.relief_m)} m ${es ? "en 15 km" : "within 15 km"}; Copernicus DEM`;
      case "barren": if (s.ndvi != null) return `NDVI ${dec(s.ndvi, 2)}; MODIS MOD13Q1 (ORNL DAAC)`; break;
    }
    const g = s.geo || {}, pct = v => `${Math.round(v * 100)}%`;
    if (s.geo_kind?.[k]) switch (k) {
      case "basalt": case "salts": {
        const m = g.macrostrat;
        return `${es ? "Mapa geológico" : "Geologic map"}: “${m.unit}”; ${es ? "puntaje medio" : "mean score"} ${dec(m[k], 2)} ${es ? "en" : "over"} ${m[`${k}_n`]} ${es ? "puntos en 15 km" : "points within 15 km"}; Macrostrat`;
      }
      case "sediment": {
        const m = g.macrostrat, w = g.gsw;
        return `${es ? "Mapa geológico" : "Geologic map"}: “${m.unit}”; Macrostrat` + (w ? `; ${es ? "agua alguna vez desde 1984 en" : "water seen since 1984 on"} ${pct(w.ever_wet)} ${es ? "del área" : "of the area"} (JRC GSW)` : "");
      }
      case "ice": {
        const t = g.lst, wc = g.worldcover;
        return `${es ? "T superficial media" : "Mean surface T"} ${dec(t.lst_mean_c, 1)} °C; MODIS MOD11A2 ${LST_YEAR}` + (wc && wc.snow_ice > 0 ? `; ${es ? "hielo/nieve permanente" : "permanent snow/ice"} ${pct(wc.snow_ice)} (ESA WorldCover)` : "");
      }
      case "regolith": return `${es ? "Radar banda L" : "L-band radar"} HV ${dec(g.palsar.hv_db, 1)} dB (${es ? "oscuro = fino y suelto" : "dark = fine and loose"}); ALOS PALSAR (JAXA)`;
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
      <text x="46" y="52" text-anchor="middle" font-size="30">${score.toFixed(0)}</text><text class="lbl" x="46" y="68" text-anchor="middle" font-size="9">/ 100</text></svg>`;
  }

  const helpOpen = new Set(); // tabs whose "?" help box the user has opened
  function renderVerdictPanel() {
    const p = $("#panel"), t = target();
    const tabs = ["verdict", "top", "camp", "map", "evidence", "scan"];
    p.innerHTML = `<nav class="tabs" role="tablist">${tabs.map(k => `<button role="tab" aria-selected="${k === state.tab}" data-tab="${k}" class="${k === state.tab ? "on" : ""}">${T().tabs[k]}</button>`).join("")}</nav>
      <div class="p-body" id="tabBody"></div>
      <div class="p-foot"><button class="btn ghost" id="newBtn">${T().newMission}</button><button class="btn ${tourSeen ? "cue" : ""}" id="certBtn">${gamePassed() ? T().cert.btn : T().game.start}</button></div>`;
    p.querySelectorAll(".tabs button").forEach(b => (b.onclick = () => {
      const prev = state.tab;
      state.tab = b.dataset.tab; state.fromTop = false; renderVerdictPanel();
      if (!touring) Guide.say(T().guide.tabs[state.tab]);
      $("#hint").hidden = state.tab !== "scan";
      if (state.peek) unpeek(true);
      else if (["camp", "map"].includes(prev) && prev !== state.tab) showEarthResults(rank(), true);
    }));
    $("#hint").textContent = state.lang === "es" ? "Haz clic en cualquier punto del globo" : "Click any point on the globe";
    $("#newBtn").onclick = () => { state.profile = null; state.scan = null; state.origin = null; clearLayers(); go("dest"); pickTarget(state.targetId); };
    const results = rank();
    $("#certBtn").onclick = () => {
      const r = results.find(x => x.site.id === state.selectedId) || results[0];
      if (gamePassed()) exportCertificate(r, gamePassed()); else openGame(r);
    };
    ({ verdict: tabVerdict, top: tabTop, camp: tabCamp, map: tabMap, evidence: tabEvidence, scan: tabScan })[state.tab](results, t);
    const tab = state.tab;
    const lead = tab === "verdict" && $("#tabBody .lead");
    (lead || $("#tabBody")).insertAdjacentHTML(lead ? "afterend" : "afterbegin",
      `<div class="about-row"><details class="about" ${helpOpen.has(tab) ? "open" : ""}><summary>${T().helpQ}</summary><p>${T().help[tab]}</p></details><button class="mini-btn ${tourSeen ? "" : "cue"}" id="tourBtn">${touring ? T().tour.resumeBtn : T().tour.start}</button></div>`);
    $("#tourBtn").onclick = startTour;
    $("#tabBody .about").addEventListener("toggle", e => (e.target.open ? helpOpen.add(tab) : helpOpen.delete(tab)));
    if (touring && spotFn) setTimeout(() => { if (touring && spotFn) { const el = spotFn(); if (el) el.classList.add("tour-spot"); } }, 0);
    document.body.dataset.tab = tab;
    document.body.dataset.dest = t.body;
    document.querySelectorAll("#tabBody .rank li").forEach(li => {
      li.tabIndex = 0; li.setAttribute("role", "button");
      li.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); } };
    });
  }

  function tabVerdict(results, t) {
    const r = results.find(x => x.site.id === state.selectedId) || results[0];
    const s = r.site, w = weights(), pos = results.indexOf(r) + 1;
    const isWin = pos === 1, world = t.body === "Moon" ? T().moon : T().mars;
    const procHtml = processesHtml(s, t), procCount = (procHtml.match(/<li>/g) || []).length;
    const usage = s.scanned ? "" : s.usage <= 0.2 ? `<span class="badge new">${T().newCandidate}</span>` : s.usage >= 0.6 ? `<span class="badge est">${T().established}</span>` : "";
    const scored = KEYS.filter(k => r.per[k] != null && w[k] > 0);
    const reasons = scored.filter(k => t[k] >= 0.3 && r.per[k] >= 0.7).sort((a, b) => w[b] * r.per[b] - w[a] * r.per[a]).slice(0, 3);
    const gaps = scored.filter(k => r.per[k] < 0.6).sort((a, b) => w[b] * (1 - r.per[b]) - w[a] * (1 - r.per[a])).slice(0, 2);
    const lead = isWin ? (state.crew.name.trim() ? T().verdictLeadNamed(esc(crewName()), PL(state.profile), esc(short(t.name))) : T().verdictLead(PL(state.profile), esc(short(t.name))))
      : `#${pos} ${T().of} ${results.length} ${T().forT} <b class="dest">${esc(short(t.name))}</b>, ${PL(state.profile)}`;
    const [nm, rest] = s.name.split(" – ");
    // a site opened from the Top 10, or any site that is not the winner, keeps a way back
    const N = T().nav, best = results[0].site;
    const navBar = state.fromTop || !isWin
      ? `<div class="preview-bar"><span>${!isWin ? N.viewing(pos, results.length) : N.fromTop}</span><span class="bar-actions">${!isWin ? `<button class="btn" id="backBest">${N.backBest}</button>` : ""}${state.fromTop ? `<button class="btn ghost" id="backTop">${N.backTop}</button>` : ""}</span></div>` : "";
    const preview = navBar + (state.myProfile && state.profile !== state.myProfile
      ? `<div class="preview-bar"><span>${T().byMission.viewing(PL(state.profile))}</span><button class="btn" id="backMine">${T().byMission.back(PL(state.myProfile))}</button></div>` : "");
    $("#tabBody").innerHTML = `${preview}
      <div class="winner">${ring(r.score)}<div><h2>${esc(nm)}</h2><div class="country">${rest ? esc(rest) + ", " : ""}${esc(CTRY(s.country))} ${usage}${nasaBadge(s)}</div></div></div>
      <p class="lead">${lead}</p>
      ${s.scanned ? "" : `<button class="btn place-btn" id="placeBtn">${T().place.btn}</button>`}
      ${roleTip(r, t)}
      ${nasaNote(s)}
      <div class="sec">${T().why}</div>
      <div class="mchips">${reasons.map(k => mchip(k, r.per[k], "good", `${FL(k)}. ${earthDetail(k, s)}. ${world}: ${targetDetail(k, t)}`)).join("") || "<span class=\"help\">—</span>"}</div>
      <div class="sec">${T().cannot}</div>
      <div class="mchips">${gaps.map(k => mchip(k, r.per[k], "bad", `${FL(k)}. ${earthDetail(k, s)}. ${world}: ${targetDetail(k, t)}`)).join("") || "<span class=\"help\">—</span>"}</div>
      <p class="help tip-hint">${T().viz.hint}</p>
      ${byMissionHtml(t)}
      <div class="sec">${T().viz.title}</div>
      ${profileChart(s.fp, t, r.per, w, s.name.split(" – ")[0])}
      ${fold(`${PROCESSES.text[state.lang].title} (${procCount})`, procHtml, "fold-procs")}
      ${s.note ? `<p class="note">${esc(NOTE(s))}</p>` : ""}
      ${fold(T().viz.reverseFold, reverseHtml(s, false))}
      ${fold(T().viz.dataFold, `<div class="chips">${["NASA POWER", "Copernicus DEM", ...new Set(Object.values(t.prov || {}).filter(p => p.kind === "measured").map(p => PROV(p.text).split(":")[0]))].map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>`)}`;
    bindTips($("#tabBody"));
    bindRoleTip();
    bindByMission();
    const bb = $("#backBest"); if (bb) bb.onclick = () => { state.fromTop = false; selectSite(best.id); $("#tabBody").scrollTop = 0; };
    const bt = $("#backTop"); if (bt) bt.onclick = () => { state.fromTop = false; openTab("top"); };
    const bm = $("#backMine");
    if (bm) bm.onclick = () => {
      state.profile = state.myProfile; state.mode = "match";
      const res = rank(); state.selectedId = res[0].site.id;
      renderVerdictPanel(); showEarthResults(res, true); writeHash();
      $("#tabBody").scrollTop = 0;
      tell(T().byMission.backSaid(PL(state.profile)));
    };
    bindReverse();
    const pb = $("#placeBtn"); if (pb) pb.onclick = () => openPlace(s, t);
  }

  const ICON_OK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_NO = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
  function mchip(k, m, kind, tip) {
    return `<span class="mchip ${kind}" tabindex="0" data-tip="${esc(tip)}">${kind === "good" ? ICON_OK : ICON_NO}<span>${FL(k)}</span><b>${Math.round(m * 100)} %</b></span>`;
  }

  // ---------- final test: four questions built from the viewer's own analysis earn the certificate ----------
  const game = { passed: null, untimed: false }; // { key, score, of, rank } for the current mission and site
  const gameKey = () => `${state.targetId}|${state.profile}|${state.selectedId}`;
  const gamePassed = () => (game.passed && game.passed.key === gameKey() ? game.passed : null);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildQuestions(r, t) {
    const Q = T().game, s = r.site, w = weights();
    const sName = s.name.split(" – ")[0], tName = short(t.name).split(" – ")[0];
    const axes = KEYS.filter(k => r.per[k] != null && w[k] > 0 && Math.max(s.fp?.[k] ?? 1, t[k] ?? 1) >= 0.1);
    const byMatch = axes.slice().sort((a, b) => r.per[b] - r.per[a]);
    const qs = [];
    // 1. the strongest match
    const best = byMatch[0], weaker = byMatch.filter(k => r.per[k] <= r.per[best] - 0.2);
    if (best && weaker.length >= 2) qs.push({ q: Q.q1(esc(sName), esc(tName)), right: FL(best), wrong: shuffle(weaker).slice(0, 2).map(FL), why: Q.why1(FL(best), Math.round(r.per[best] * 100)) });
    // 2. what it cannot simulate
    const worst = byMatch[byMatch.length - 1], good = byMatch.filter(k => r.per[k] >= r.per[worst] + 0.3);
    if (worst && good.length >= 2) qs.push({ q: Q.q2(esc(sName), esc(tName)), right: FL(worst), wrong: shuffle(good).slice(0, 2).map(FL), why: Q.why2(FL(worst), Math.round(r.per[worst] * 100)) });
    // 3. a process to watch here, or what Earth can never rehearse
    const here = earthProcesses(s), there = PROCESSES.target[t.id] || {}, L = PROCESSES.label[state.lang];
    const shared = PROCESSES.order.filter(k => here[k] && there[k]), notShared = PROCESSES.order.filter(k => !(here[k] && there[k]));
    if (shared.length && notShared.length >= 2) {
      const k = shared.find(x => here[x][0] === "now" && there[x][0] === "old") || shared[0];
      qs.push({ q: Q.q3(esc(sName), esc(tName)), right: L[k], wrong: shuffle(notShared).slice(0, 2).map(x => L[x]), why: Q.why3(L[k], here[k][0] === "now") });
    } else {
      qs.push({ q: Q.q3b, right: Q.limitRight(t.body), wrong: Q.limitWrong, why: Q.why3b(t.body) });
    }
    // 4. the campaign partner
    const { camp } = campaign();
    const partner = camp.chosen.find(c => c.site.id !== s.id);
    const others = rank("match", CURATED).slice(4, 24).map(x => x.site).filter(x => x.id !== s.id && !camp.chosen.some(c => c.site.id === x.id));
    if (partner && others.length >= 2) {
      const nm = x => x.name.split(" – ")[0];
      qs.push({ q: Q.q4(esc(sName)), right: nm(partner.site), wrong: shuffle(others).slice(0, 2).map(nm), why: Q.why4(nm(partner.site), Math.round(camp.coverage)) });
    }
    return qs;
  }

  function openGame(r) {
    const t = target(), G = T().game, qs = buildQuestions(r, t), key = gameKey(), SECS = 20;
    let i = 0, score = 0, tick = null;
    opener = document.activeElement;
    let m = $("#gameModal");
    if (!m) { m = document.createElement("div"); m.id = "gameModal"; m.className = "modal"; document.body.appendChild(m); }
    m.hidden = false;
    document.body.classList.add("modal-open");
    const stop = () => { clearInterval(tick); tick = null; };
    const close = () => { stop(); m.hidden = true; document.body.classList.remove("modal-open"); if (state.stage === "verdict") renderVerdictPanel(); if (opener && opener.isConnected) opener.focus(); };
    const head = sub => `<header class="modal-head"><div><small>${G.title}</small><h2 id="gameTitle">${sub}</h2></div>
      <span class="game-pts">${G.points}: <b>${score}</b></span>
      <button class="modal-x" id="gameClose" aria-label="${T().place.close}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>`;
    const bindClose = () => { $("#gameClose").onclick = close; m.onclick = e => { if (e.target === m) close(); }; };

    const ask = () => {
      const q = qs[i], opts = shuffle([q.right, ...q.wrong]);
      m.innerHTML = `<div class="modal-card game" role="dialog" aria-modal="true" aria-labelledby="gameTitle">${head(G.round(i + 1, qs.length))}
        <div class="modal-body">
          <div class="game-meta"><span>${G.hint}</span>${game.untimed ? "" : `<span id="gameSecs">${G.secs(SECS)}</span>`}<button class="mini-btn" id="gameClock">${game.untimed ? G.timed : G.untimed}</button></div>
          ${game.untimed ? "" : `<div class="game-time"><i id="gameBar"></i></div>`}
          <p class="game-q">${q.q}</p>
          <div class="game-opts">${opts.map(o => `<button class="game-opt" data-right="${o === q.right}">${esc(o)}</button>`).join("")}</div>
          <p class="game-why" id="gameWhy" hidden></p>
          <button class="btn" id="gameNext" hidden>${i < qs.length - 1 ? G.next : G.result}</button>
        </div></div>`;
      bindClose();
      let left = SECS;
      const bar = $("#gameBar");
      if (bar) requestAnimationFrame(() => { bar.style.transition = `transform ${SECS}s linear`; bar.style.transform = "scaleX(0)"; });
      $("#gameClock").onclick = () => { stop(); game.untimed = !game.untimed; ask(); };
      const answer = btn => {
        stop();
        const ok = btn?.dataset.right === "true";
        if (ok) score++;
        m.querySelectorAll(".game-opt").forEach(b => { b.disabled = true; if (b.dataset.right === "true") b.classList.add("right"); });
        if (btn && !ok) btn.classList.add("wrong");
        if (bar) { bar.style.transition = "none"; bar.style.transform = getComputedStyle(bar).transform; }
        const clk = $("#gameClock"); if (clk) clk.hidden = true;
        $(".game-pts b").textContent = score;
        const lead = ok ? G.right : btn ? G.wrong : G.timeout;
        $("#gameWhy").textContent = `${lead} ${q.why}`; $("#gameWhy").hidden = false;
        $("#gameWhy").classList.toggle("ok", ok);
        Guide.say(`${lead} ${q.why}`);
        if (ok) SFX.go(); else SFX.beep(220);
        const next = $("#gameNext"); next.hidden = false; next.focus();
        next.onclick = () => { i++; if (i < qs.length) ask(); else finish(); };
      };
      m.querySelectorAll(".game-opt").forEach(b => (b.onclick = () => answer(b)));
      const gq = m.querySelector(".game-q"); gq.tabIndex = -1; gq.focus();
      if (!game.untimed) tick = setInterval(() => {
        left--;
        const el = $("#gameSecs"); if (el) el.textContent = G.secs(Math.max(left, 0));
        if (left <= 0) answer(null);
      }, 1000);
    };

    const finish = () => {
      const pass = score >= Math.min(3, qs.length), top = score === qs.length;
      const rankTxt = top ? G.rank.top : pass ? G.rank.ok : G.rank.retry;
      if (pass) game.passed = { key, score, of: qs.length, rank: rankTxt };
      m.innerHTML = `<div class="modal-card game" role="dialog" aria-modal="true" aria-labelledby="gameTitle">${head(rankTxt)}
        <div class="modal-body game-result">
          <p class="game-big">${score}<span>/${qs.length}</span></p>
          <p>${pass ? G.passMsg(esc(crewName())) : G.failMsg}</p>
          <div class="game-actions">${pass ? `<button class="btn big" id="gameCert">${T().cert.btn}</button>` : `<button class="btn big" id="gameRetry">${G.retry}</button>`}
            <button class="btn ghost" id="gameBack">${G.back}</button></div>
        </div></div>`;
      bindClose();
      if (pass) { SFX.touchdown(); Guide.say(G.passMsg(crewName())); $("#gameCert").onclick = () => exportCertificate(r, game.passed); $("#gameCert").focus(); }
      else { Guide.say(G.failMsg); $("#gameRetry").onclick = () => { score = 0; i = 0; ask(); }; $("#gameRetry").focus(); }
      $("#gameBack").onclick = close;
    };

    Guide.say(G.intro);
    ask();
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && $("#gameModal") && !$("#gameModal").hidden) $("#gameClose")?.click(); });

  // ---------- does the mission change the answer? the best site for each of the seven ----------
  function bestByMission(t) {
    const pool = state.origin ? CURATED.concat(state.origin) : CURATED;
    return Object.keys(PROFILES).map(p => {
      const w = TW.profileWeights(p);
      const best = pool.map(s => ({ s, ...TW.compare(s.fp, t, w) })).sort((a, b) => b.score - a.score)[0];
      return { p, site: best.s, score: best.score };
    });
  }
  function byMissionHtml(t) {
    const B = T().byMission, rows = bestByMission(t), n = new Set(rows.map(r => r.site.id)).size;
    const mine = state.myProfile || state.profile;
    const list = rows.map(r => `<button class="bym ${r.p === state.profile ? "on" : ""}" data-p="${r.p}">${icon(r.p)}
      <span class="bym-t"><small>${PL(r.p)}${r.p === mine ? ` (${B.mine})` : ""}</small>${n === 1 ? "" : `<b>${esc(r.site.name.split(" – ")[0])}</b>`}</span><span class="v">${Math.round(r.score)}</span></button>`).join("");
    return `<details class="fold fold-bym" ${state.myProfile && state.profile !== state.myProfile ? "open" : ""}><summary>${B.title(n)}</summary><p class="help">${n === 1 ? B.same(esc(rows[0].site.name.split(" – ")[0])) : B.hint}</p><div class="bym-list">${list}</div></details>`;
  }
  function bindByMission() {
    document.querySelectorAll("#tabBody .bym").forEach(b => (b.onclick = () => {
      if (b.dataset.p === state.profile) return;
      state.myProfile = state.myProfile || state.profile;
      state.profile = b.dataset.p; state.mode = "match";
      const res = rank(); state.selectedId = res[0].site.id;
      renderVerdictPanel(); showEarthResults(res, true); writeHash();
      $("#tabBody").scrollTop = 0;
      tell(T().byMission.switched(PL(state.profile), res[0].site.name.split(" – ")[0]));
    }));
  }

  // ---------- roles: each one is steered to the missions and numbers it cares about ----------
  const ROLE_PROFILES = { cmd: ["balanced"], geo: ["astrobio", "caves"], eng: ["habitat", "mobility"] };
  const roleProfiles = role => (role === "geo" && state.body === "Moon" ? ["isru", "caves"] : ROLE_PROFILES[role] || []);
  function roleTip(r, t) {
    const RT = T().roleTip, role = state.crew.role in ROLE_PROFILES ? state.crew.role : "cmd", s = r.site;
    const lower = x => x.charAt(0).toLowerCase() + x.slice(1);
    let txt;
    if (role === "geo") {
      const here = earthProcesses(s), there = PROCESSES.target[t.id] || {};
      const shared = PROCESSES.order.filter(k => here[k] && there[k]).map(k => lower(PROCESSES.label[state.lang][k].split(":")[0]));
      txt = RT.geo(shared.length, joinList(shared));
    } else if (role === "eng") {
      const pct = k => (r.per[k] == null ? "?" : Math.round(r.per[k] * 100));
      txt = RT.eng(pct("regolith"), pct("relief"), pct("swing"));
    } else {
      const { camp, single } = campaign(), w = weights(), tot = KEYS.reduce((a, k) => a + w[k], 0);
      const singleCov = 100 * KEYS.reduce((a, k) => a + w[k] * (single.per[k] ?? 0), 0) / tot;
      const acc = s.access == null ? null : s.access >= 0.7 ? "easy" : s.access >= 0.4 ? "mid" : "hard";
      txt = RT.cmd(Math.round(camp.coverage), Math.round(singleCov), acc ? RT.access[acc] : null);
    }
    return `<div class="role-tip"><b>${RT.title(roleLabel())}</b><p>${txt}</p><button class="mini-btn" id="roleTipBtn" data-role="${role}">${RT.btn[role]}</button></div>`;
  }
  function bindRoleTip() {
    const b = $("#roleTipBtn"); if (!b) return;
    b.onclick = () => {
      const role = b.dataset.role;
      if (role === "eng") state.mode = "ready";
      openTab(role === "cmd" ? "camp" : role === "geo" ? "evidence" : "top");
    };
  }

  // ---------- guided tour of the verdict panel ----------
  let touring = false, tourSeen = false; // until the tour is seen (or skipped) once this session, it is the step that glows
  function setGuideActions(list) {
    const box = $("#guideActions");
    box.innerHTML = "";
    list.forEach(a => {
      const b = document.createElement("button");
      b.className = "btn" + (a.ghost ? " ghost" : "") + (a.cue ? " cue" : ""); b.textContent = a.label; b.onclick = a.run;
      box.appendChild(b);
    });
    box.hidden = !list.length;
  }
  function spot(el) {
    document.querySelectorAll(".tour-spot").forEach(e => e.classList.remove("tour-spot"));
    if (el) { el.classList.add("tour-spot"); el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }); }
  }
  function openTab(tab) {
    const b = document.querySelector(`nav.tabs button[data-tab="${tab}"]`);
    if (b && state.tab !== tab) b.click();
  }
  let resumeTour = null, spotFn = null; // spotFn: what the current step points at, re-applied after the panel redraws
  const tell = text => Guide.say(touring ? `${text} ${T().tour.resume}` : text); // during the tour, every reply points back to it
  function startTour() {
    if (touring) { resumeTour?.(); return; }
    if (state.stage !== "verdict") return;
    touring = true;
    document.body.classList.add("touring");
    $("#guide").classList.remove("folded"); $("#guide").hidden = false;
    const S = () => T().tour.steps;
    const tabBtn = k => document.querySelector(`nav.tabs button[data-tab="${k}"]`);
    // first the place itself (which one, what it looks like, why it was chosen), then the rest of the panel
    // the site shown is always the current one: the viewer may switch mission or site mid-tour
    const now = () => { const res = rank(), cur = res.find(x => x.site.id === state.selectedId) || res[0]; return { cur, site: cur.site, sName: cur.site.name.split(" – ")[0] }; };
    const steps = [
      { text: () => { const n = now(); return S().winner(n.sName, Math.round(n.cur.score)); }, el: () => $("#tabBody .winner"), tab: "verdict" },
      { text: () => S().place(now().sName), el: () => null, tab: "verdict", enter: () => { const n = now(); if (!n.site.scanned) openPlace(n.site, target()); }, leave: () => closePlace() },
      { text: () => S().why, el: () => $("#tabBody .mchips"), tab: "verdict" },
      { text: () => S().chart, el: () => $("#tabBody .dumb"), tab: "verdict" },
      { text: () => S().procs, el: () => { const f = $("#tabBody .fold-procs"); if (f) f.open = true; return f; }, tab: "verdict" },
      { text: () => S().top, el: () => tabBtn("top"), tab: "top" },
      { text: () => S().camp, el: () => tabBtn("camp"), tab: "camp" },
      { text: () => S().map, el: () => tabBtn("map"), tab: "map" },
      { text: () => S().evidence, el: () => tabBtn("evidence"), tab: "evidence" },
      { text: () => S().scan, el: () => tabBtn("scan"), tab: "scan" },
      { text: () => S().foot, el: () => $("#panel .p-foot"), tab: "verdict" },
    ];
    let i = 0;
    const end = () => {
      prev?.leave?.(); prev = null; spotFn = null;
      touring = false; document.body.classList.remove("touring");
      spot(null); setGuideActions([]);
      openTab("verdict");
      store.set("tourDone", true);
      tourSeen = true;
      if (state.stage === "verdict") renderVerdictPanel();
      Guide.say(T().tour.end);
    };
    let prev = null;
    const show = () => {
      const st = steps[i];
      prev?.leave?.(); prev = st; spotFn = st.el;
      // whatever the viewer opened in the last step closes: a compare card, a tooltip, a view of the Moon or Mars
      ["#cmpModal", "#vizTip"].forEach(id => { const m = $(id); if (m) m.hidden = true; });
      if (!$("#placeModal") || $("#placeModal").hidden) document.body.classList.remove("modal-open");
      if (state.peek) unpeek(true);
      openTab(st.tab);
      st.enter?.();
      spot(st.el());
      Guide.say(st.text());
      const last = i === steps.length - 1;
      setGuideActions([
        { label: last ? T().tour.done : `${T().tour.next} (${i + 1}/${steps.length})`, cue: true, run: () => { if (last) end(); else { i++; show(); } } },
        { label: T().tour.skip, ghost: true, run: end },
      ]);
      $("#guideActions button").focus();
      const tb = $("#tourBtn"); if (tb) tb.textContent = T().tour.resumeBtn;
    };
    resumeTour = show;
    show();
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
        <div class="proc-tags"><span class="ptag earth ${eWhen}" tabindex="0" data-tip="${esc(eTxt)}">${X.earthTag[eWhen]}</span>
          <span class="ptag dest ${t.body} ${tWhen}" tabindex="0" data-tip="${esc(state.lang === "es" ? tEs : tEn)}">${esc(X.targetTag[tWhen](tName))}</span></div>
        <p class="proc-lesson">${X.lesson[`${eWhen}-${tWhen}`]}</p></li>`;
    }).join("")}</ul>`;
  }

  // ---------- twin profile: one dumbbell per characteristic ----------
  // Earth (circle) and destination (diamond) on the same 0–1 scale: the gap between them is the difference.
  function profileChart(earthFp, t, per, w, earthLabel) {
    const V = T().viz, base = Math.min(...KEYS.map(k => w[k] ?? 1));
    const rows = KEYS.map(k => ({ k, e: earthFp[k], d: t[k], m: per[k], key: (w[k] ?? 1) > base }));
    rows.forEach(r => (r.absent = r.m != null && Math.max(r.e ?? 0, r.d ?? 0) < 0.1)); // neither place has it: no evidence of a match
    const byMatch = (a, b) => (a.absent - b.absent) || (b.m ?? -1) - (a.m ?? -1);
    const measured = rows.filter(r => r.m != null && !r.absent), close = measured.filter(r => r.m >= 0.8).length;
    const world = t.body === "Moon" ? T().moon : T().mars;
    const row = r => {
      const lbl = FL(r.k);
      if (r.m == null) return `<div class="dumb-row nodata"><span class="dumb-label">${lbl}</span><span class="dumb-track"><em>${V.nodata}</em></span><span class="dumb-v"></span></div>`;
      const lo = Math.min(r.e, r.d) * 100, hi = Math.max(r.e, r.d) * 100;
      const tip = r.absent ? `${lbl}: ${V.absentTip}` : V.tip(lbl, dec(r.e, 2), world, dec(r.d, 2), Math.round(r.m * 100));
      const same = Math.abs(r.e - r.d) < 0.03 ? " same" : ""; // equal values: nudge the marks apart so both stay visible
      return `<div class="dumb-row${same}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span class="dumb-label">${lbl}</span>
        <span class="dumb-track"><i class="dumb-gap" style="left:${lo}%;width:${hi - lo}%"></i><i class="mk earth" style="left:${r.e * 100}%"></i><i class="mk dest ${t.body}" style="left:${r.d * 100}%"></i></span>
        <span class="dumb-v">${r.absent ? `<small>${V.absent}</small>` : `${Math.round(r.m * 100)} %`}</span></div>`;
    };
    const keyRows = rows.filter(r => r.key).sort(byMatch), other = rows.filter(r => !r.key).sort(byMatch);
    const more = list => `<details class="dumb-more"><summary>${V.more(list.length)}</summary>${list.map(row).join("")}</details>`;
    const sorted = rows.slice().sort(byMatch);
    const body = keyRows.length && other.length
      ? `<div class="dumb-group">${V.key}</div>${keyRows.map(row).join("")}${more(other)}`
      : sorted.slice(0, 6).map(row).join("") + (sorted.length > 6 ? more(sorted.slice(6)) : "");
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
    root.querySelectorAll("[data-tip]").forEach(r => {
      r.onpointermove = e => show(r, e.clientX, e.clientY);
      r.onpointerleave = () => (tip.hidden = true);
      r.onfocus = () => { const b = r.getBoundingClientRect(); show(r, b.left + 120, b.bottom - 10); };
      r.onblur = () => (tip.hidden = true);
    });
  }

  // "Compare": an Earth place against one Moon or Mars site, with the numbers
  function openCompare(site, id) {
    opener = document.activeElement;
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
    const close = () => { m.hidden = true; document.body.classList.remove("modal-open"); $("#vizTip").hidden = true; if (opener && opener.isConnected) opener.focus(); };
    $("#cmpClose").onclick = close;
    m.onclick = e => { if (e.target === m) close(); };
    $("#cmpGlobe").onclick = () => { close(); peek(id); };
    $("#cmpClose").focus();
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && $("#cmpModal") && !$("#cmpModal").hidden) $("#cmpClose").click(); });

  // ---------- where NASA itself trains: checked against our own ranking ----------
  const NA = () => window.NASA_ANALOGS || { catalog: {}, field: [] };
  const nasaBadge = s => (NA().catalog[s.id] ? `<span class="badge nasa">${T().nasa.badge}</span>` : "");
  function nasaNote(s) {
    const c = NA().catalog[s.id], N = T().nasa; if (!c) return "";
    const nm = s.name.split(" – ")[0];
    return `<div class="nasa-note">${c.photo ? `<a href="${NA().page(c.photo)}" target="_blank" rel="noopener"><img src="${NA().img(c.photo)}" alt="${esc(N.photoAlt(nm))}" loading="lazy"></a>` : ""}
      <div><b>${N.here}</b><p>${esc(c[state.lang])}</p>${c.photo ? `<small>${N.photo}: ${esc(c.credit)}, images.nasa.gov</small>` : ""}</div></div>`;
  }
  function nasaHtml() {
    const N = T().nasa, pool = rank("match", CURATED), n = pool.length;
    const ours = pool.map((r, i) => ({ r, pos: i + 1 })).filter(x => NA().catalog[x.r.site.id]);
    if (!ours.length) return "";
    const nm = x => esc(x.name.split(" – ")[0]), best = ours[0];
    const rows = ours.map(x => `<li data-id="${x.r.site.id}"><div><b>${nm(x.r.site)}</b><small>${esc(NA().catalog[x.r.site.id][state.lang])}</small></div><span class="v">#${x.pos}</span></li>`).join("");
    const field = NA().field.map((f, i) => `<li data-f="${i}"><div><b>${esc(f.name[state.lang])}${f.indoor ? `<span class="badge est">${N.indoor}</span>` : ""}</b><small>${esc(f[state.lang])}</small></div><span class="v">${f.indoor ? N.see : N.scan}</span></li>`).join("");
    return `<details class="fold fold-nasa" open><summary>${N.title}</summary>
      <p class="help">${N.summary(best.pos, n, nm(best.r.site), nm(pool[0].site))}</p>
      <ol class="rank nasa-rank">${rows}</ol>
      <div class="sec">${N.outside}</div><p class="help">${N.outsideHelp}</p>
      <ol class="rank nasa-field">${field}</ol>
      <p class="foot-note">${N.credit}</p></details>`;
  }
  function bindNasa() {
    document.querySelectorAll("#tabBody .nasa-field li").forEach(li => (li.onclick = () => {
      const f = NA().field[+li.dataset.f];
      globe.pointOfView({ lat: f.lat, lng: f.lon, altitude: 1.4 }, reduced() ? 0 : 1000);
      globe.ringsData([{ lat: f.lat, lng: f.lon }]);
      if (f.indoor) { tell(T().nasa.indoorSaid(f.name[state.lang])); return; }
      state.tab = "scan"; state.fromTop = false; renderVerdictPanel();
      scanPoint(f.lat, f.lon);
    }));
  }

  function tabTop(results) {
    $("#tabBody").innerHTML = `
      <div class="seg">${["match", "untapped", "ready"].map(m => `<button data-m="${m}" class="${m === state.mode ? "on" : ""}">${T().modes[m]}</button>`).join("")}</div>
      <p class="help">${T().modeHelp[state.mode]}</p>
      <ol class="rank">${results.slice(0, 10).map(r => {
        const s = r.site, b = s.scanned ? "" : s.usage <= 0.2 ? `<span class="badge new">${T().newCandidate}</span>` : "";
        return `<li data-id="${s.id}" class="${s.id === state.selectedId ? "on" : ""}"><div><b>${esc(s.name)}${b}${nasaBadge(s)}</b><small>${esc(CTRY(s.country))}</small>
          <div class="bar"><i style="width:${TW.clamp(r.value / 80) * 100}%;background:${scoreColor(r.score)}"></i></div></div><span class="v">${r.value.toFixed(0)}</span></li>`;
      }).join("")}</ol>
      ${nasaHtml()}
      <button class="btn ghost" id="csvBtn" style="margin-top:10px">${T().csv}</button>`;
    document.querySelectorAll(".seg button").forEach(b => (b.onclick = () => {
      state.mode = b.dataset.m; const res = rank(); state.selectedId = res[0].site.id;
      renderVerdictPanel(); showEarthResults(res, true); writeHash();
    }));
    document.querySelectorAll(".rank li").forEach(li => (li.onclick = () => { state.fromTop = true; selectSite(li.dataset.id); $("#tabBody").scrollTop = 0; }));
    $("#csvBtn").onclick = () => exportCSV(results);
    bindNasa();
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
      <div class="camp">${camp.chosen.map((c, i) => `<div><b>${i + 1}. ${esc(c.site.name)}</b><small>${esc(CTRY(c.site.country))}: ${c.score.toFixed(0)}/100</small>
        <small>${T().covers}: ${roles.get(c).map(k => FL(k)).join(", ") || "—"}</small></div>`).join("")}</div>
      <div class="covbars">${KEYS.filter(k => w[k] > 0).map(k => { const v = camp.owner[k].value; return `<div class="row"><span>${FL(k)}</span><div class="track"><i style="width:${v * 100}%;background:${matchColor(v)}"></i></div><span>${Math.round(v * 100)}</span></div>`; }).join("")}</div>
      <p class="foot-note">${T().beyond}</p>`;
    drawCampaignArcs(camp);
  }

  function tabEvidence(results, t) {
    const r = results.find(x => x.site.id === state.selectedId) || results[0], s = r.site;
    const kindOf = k => t.prov?.[k]?.kind || "literature";
    const earthKind = k => s.geo_kind?.[k] || (CLIMATE_KEYS.includes(k) || k === "relief" || (k === "barren" && s.ndvi != null) ? "measured" : "literature");
    const K = T().kinds, world = t.body === "Moon" ? T().moon : T().mars;
    const cell = (v, kind) => `<span class="evv">${v == null ? "?" : dec(v, 2)}<i class="kd k-${kind}" aria-label="${K[kind]}"></i></span>`;
    $("#tabBody").innerHTML = `<h2 class="p-title">${T().evTitle}</h2>
      <div class="ev-legend">${["measured", "mapped", "mission", "literature"].map(k => `<span><i class="kd k-${k}"></i>${K[k]}</span>`).join("")}</div>
      <p class="help">${T().evHint}</p>
      <div class="ev2-head"><span></span><span>${esc(short(t.name).split(" – ")[0])}</span><span>${esc(s.name.split(" – ")[0])}</span></div>
      ${KEYS.map(k => `<details class="ev2"><summary><span>${FL(k)}</span>${cell(t[k], kindOf(k))}${cell(s.fp[k], earthKind(k))}</summary>
        <div class="ev2-src"><p><span class="badge ${kindOf(k)}">${K[kindOf(k)]}</span> <b>${world}:</b> ${esc(targetDetail(k, t))}</p>
          <p><span class="badge ${earthKind(k)}">${K[earthKind(k)]}</span> <b>${T().place.earth}:</b> ${esc(earthDetail(k, s))}</p></div></details>`).join("")}
      <div class="sec">${T().dl.title}</div>
      <div class="ev-dl"><button class="btn ghost" id="mdBtn">${T().dl.md}</button><button class="btn ghost" id="csvAll">${T().dl.csv}</button></div>
      <p class="foot-note">${T().beyond}<br>${T().dataset}: ${esc(generated)}</p>`;
    $("#mdBtn").onclick = () => exportCard(r);
    $("#csvAll").onclick = () => exportCSV(results);
  }

  function tabScan(results) {
    const sc = state.scan;
    let box = "";
    if (state.scanBusy) box = scanSteps();
    else if (sc) {
      const r = results.find(x => x.site.id === sc.id);
      const pos = rank("match", CURATED.concat(sc)).findIndex(x => x.site.id === sc.id) + 1;
      box = `<div class="scanbox"><b>${dec(sc.lat, 3)}°, ${dec(sc.lon, 3)}°</b>, ${Math.round(sc.elev ?? 0)} m<br>${T().scanResult(dec(r.score, 1), pos, CURATED.length + 1)}
        <p class="help" style="margin-top:8px">${T().scanAxes}</p>
        <div class="scan-actions"><button class="btn ghost" id="seeScan">${T().tabs.verdict}</button><button class="btn big" id="travelScan">${T().earth.travel(esc(short(reverseTwins(sc)[0].t.name)))}</button></div>
        <p class="help">${T().scanTravelNote}</p>${reverseHtml(sc)}</div>`;
    }
    if (!sc && !state.scanBusy && state.scanError) box = `<p class="note">${T().scanErr[state.scanError]}</p>`;
    $("#tabBody").innerHTML = `<h2 class="p-title">${T().scanTitle}</h2><p class="p-sub">${T().scanHelp}</p>${state.scanBusy ? "" : scanForm(false)}${box}`;
    bindScanForm();
    const b = $("#seeScan"); if (b) b.onclick = () => selectSite(sc.id);
    const tv = $("#travelScan"); if (tv) tv.onclick = () => outbound(sc, reverseTwins(sc)[0].t);
    bindReverse();
  }

  // ---------- scan without a mouse: pick a catalogue site or type coordinates ----------
  function scanForm(withSites) {
    const F = T().scanForm;
    const sites = withSites ? `<label class="sf-site">${F.site}<select id="sfSite"><option value="">${F.choose}</option>${CURATED.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}">${esc(x.name.split(" – ")[0])}, ${esc(CTRY(x.country))}</option>`).join("")}</select></label>` : "";
    return `<details class="fold scan-form"><summary>${F.title}</summary>${sites}
      <div class="sf-row"><label>${F.lat}<input id="sfLat" type="number" inputmode="decimal" step="0.01" min="-90" max="90" placeholder="-24.08"></label>
      <label>${F.lon}<input id="sfLon" type="number" inputmode="decimal" step="0.01" min="-180" max="180" placeholder="-70.00"></label>
      <button class="btn ghost" id="sfGo">${F.go}</button></div><p class="help" id="sfErr" hidden>${F.err}</p></details>`;
  }
  function bindScanForm() {
    const sel = $("#sfSite");
    if (sel) sel.onchange = () => {
      const x = CURATED.find(c => c.id === sel.value); if (!x) return;
      state.scan = x; renderEarthPanel(); showEarthMode(true);
      globe.pointOfView({ lat: x.lat, lng: x.lon, altitude: 1.6 }, reduced() ? 0 : 900);
    };
    const go = $("#sfGo"); if (!go) return;
    go.onclick = () => {
      const lat = parseFloat($("#sfLat").value), lon = parseFloat($("#sfLon").value);
      const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      $("#sfErr").hidden = ok; if (!ok) return;
      globe.pointOfView({ lat, lng: lon, altitude: 1.6 }, reduced() ? 0 : 900);
      scanPoint(lat, lon);
    };
  }

  // ---------- live scan ----------
  async function fetchPower(lat, lon) {
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${POWER_PARAMS}&community=RE&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`;
    const raw = await (await fetch(url)).json();
    const p = raw.properties.parameter, fill = raw.header?.fill_value ?? -999;
    const ann = k => (p[k] && p[k].ANN !== fill ? p[k].ANN : null);
    const sw = MONTHS.map(m => p.ALLSKY_SFC_SW_DWN[m]).filter(v => v !== fill);
    return { t2m: ann("T2M"), t2m_range: ann("T2M_RANGE"), t2m_min: ann("T2M_MIN"), t2m_max: ann("T2M_MAX"), precip: ann("PRECTOTCORR"), rh: ann("RH2M"),
      ps: ann("PS"), sw: ann("ALLSKY_SFC_SW_DWN"), sw_min: sw.length ? Math.min(...sw) : null, sw_max: sw.length ? Math.max(...sw) : null, uv: ann("ALLSKY_SFC_UV_INDEX"), ws10m: ann("WS10M"), grid_elev: raw.geometry.coordinates[2] };
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
  const SCAN_SRC = ["power", "dem", "ndvi", "geo"];
  let scanDone = {};
  function scanSteps() {
    const L = T().scanSrc;
    return `<div class="scanbox busy" aria-live="polite"><b>${T().scanning}</b><ul class="scan-steps">${SCAN_SRC.map(k => `<li id="ss-${k}" class="${scanDone[k] ? "done" : ""}">${scanDone[k] ? ICON_OK : '<i class="spin" aria-hidden="true"></i>'}<span>${L[k]}</span></li>`).join("")}</ul></div>`;
  }
  const tick = (k, pr) => pr.finally(() => {
    scanDone[k] = true;
    const li = $(`#ss-${k}`); if (li) { li.classList.add("done"); li.firstElementChild.outerHTML = ICON_OK; }
  });
  async function scanPoint(lat, lng) {
    if (state.scanBusy) return;
    scanDone = {};
    state.scanBusy = true; state.scanError = null; renderPanel();
    globe.ringsData([{ lat, lng }]);
    try {
      const [power, rel, ndvi, geo] = await Promise.all([tick("power", fetchPower(lat, lng)), tick("dem", fetchReliefWindow(lat, lng)), tick("ndvi", fetchNdvi(lat, lng)), tick("geo", fetchGeology(lat, lng))]);
      if (power.t2m == null) throw new Error("no data");
      const s = { id: "scan", name: state.lang === "es" ? "Punto escaneado" : "Scanned point", country: `${dec(lat, 3)}°, ${dec(lng, 3)}°`, lat, lon: lng,
        scanned: true, usage: 0, access: null, power, elev: rel.center, relief_m: rel.relief_m, relief: TW.clamp(rel.relief_m / 1500) };
      KEYS.forEach(k => { if (!CLIMATE_KEYS.includes(k) && k !== "relief") s[k] = null; });
      if (ndvi != null) { s.ndvi = ndvi; s.barren = TW.clamp((0.5 - ndvi) / 0.4); }
      s.geo = geo; s.geo_kind = {};
      Object.entries(TW.geoAxes(geo, rel.relief_m)).forEach(([k, v]) => { s[k] = v; s.geo_kind[k] = GEO_KIND[k]; });
      s.fp = TW.fingerprint(s);
      if (rel.center != null && rel.center <= 0 && (!geo.worldcover || geo.worldcover.water > 0.5)) {
        state.scan = null; state.scanError = "ocean";
      } else {
        state.scan = s;
        if (state.stage === "earth") state.selectedId = "scan";
        tell(T().guide.scanDone(short(reverseTwins(s)[0].t.name)));
      }
    } catch (e) {
      state.scan = null; state.scanError = "fail";
    }
    if (state.scanError) tell(T().scanErr[state.scanError]);
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
  const fold = (title, html, cls = "") => `<details class="fold ${cls}"><summary>${title}</summary>${html}</details>`;
  function reverseHtml(site, withTitle = true) {
    state.revSite = site;
    const list = reverseTwins(site).slice(0, 3);
    return `${withTitle ? `<div class="sec">${T().reverse.title}</div>` : ""}<p class="help">${T().reverse.lead}</p>
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
    let body = state.scanError ? `<p class="note">${T().scanErr[state.scanError]}</p>` : `<p class="help">${E.pick}</p>`;
    const best = sc ? reverseTwins(sc)[0] : null;
    if (state.scanBusy) body = scanSteps();
    else if (sc) {
      body = `<div class="scanbox"><b>${esc(sc.name)}</b><br><small class="help">${esc(CTRY(sc.country))}${sc.elev != null ? `, ${Math.round(sc.elev)} m` : ""}</small>
        ${sc.scanned ? "" : `<button class="btn place-btn" id="placeBtn">${T().place.btn}</button>`}
        ${reverseHtml(sc)}
        <div class="sec">${T().viz.title}</div>
        ${profileChart(sc.fp, best.t, best.per, TW.profileWeights("balanced"), sc.scanned ? T().guide.yourPlace.replace(/^./, ch => ch.toUpperCase()) : sc.name.split(" – ")[0])}</div>`;
      setTimeout(() => bindTips($("#panel")), 0);
    }
    $("#panel").innerHTML = `<div class="p-body"><h2 class="p-title">${E.title}</h2><p class="p-sub">${E.help}</p>${state.scanBusy ? "" : scanForm(true)}${body}</div>
      <div class="p-foot"><button class="btn ghost" id="backBtn">${T().back}</button>${best && !state.scanBusy
        ? `<button class="btn big cue" id="travelBtn">${E.travel(esc(short(best.t.name)))}</button>`
        : `<button class="btn" id="toMission">${E.toMission}</button>`}</div>`;
    $("#backBtn").onclick = goHome;
    bindScanForm();
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
    $("#tabBody").innerHTML = `<h2 class="p-title">${M.title}</h2><p class="p-sub">${M.lead(scored.length, dec(window.TW_GRID.step, 1))}</p>
      <div class="legend-bar"><span>${Math.round(Math.min(...scored.map(c => c.score)))}</span><i style="background:linear-gradient(90deg,${STOPS().join(",")})"></i><span>${Math.round(Math.max(...scored.map(c => c.score)))}</span></div>
      <p class="help">${M.climateOnly}</p>
      <div class="sec">${M.hotspots}</div>
      <ol class="rank" id="hotList">${hs.map((c, i) => `<li data-i="${i}"><div><b id="hs${i}">${dec(c.lat, 1)}°, ${dec(c.lon, 1)}°</b><small>${dec(c.power.t2m, 1)} °C, ${(c.power.precip * 365).toFixed(0)} mm/${state.lang === "es" ? "año" : "yr"}, ${c.power.ps.toFixed(0)} kPa</small></div><span class="v">${c.score.toFixed(0)}</span></li>`).join("")}</ol>`;
    document.querySelectorAll("#hotList li").forEach(li => (li.onclick = () => {
      const c = hs[+li.dataset.i];
      globe.pointOfView({ lat: c.lat, lng: c.lon, altitude: 1.3 }, 1200);
      state.tab = "scan"; renderVerdictPanel(); setTexture("Earth"); scanPoint(c.lat, c.lon);
    }));
    globe.pointOfView({ lat: hs[0]?.lat ?? 0, lng: hs[0]?.lon ?? 0, altitude: 2.4 }, 1400);
    hs.forEach((c, i) => placeName(c.lat, c.lon).then(n => { const el = $("#hs" + i); if (el && n) el.textContent = `${n} (${dec(c.lat, 1)}°, ${dec(c.lon, 1)}°)`; }));
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
    return site.lat < -60 ? "NASA GIBS, MODIS Terra (250 m)" : "NASA GIBS, Landsat WELD (30 m)";
  }
  function targetSource(t) {
    return t.body === "Moon" ? "NASA Moon Trek, LRO WAC (~100 m)" : "NASA Mars Trek, Viking MDIM 2.1 (232 m)";
  }
  let opener = null; // where focus returns when a card closes
  addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const m = ["#gameModal", "#placeModal", "#cmpModal"].map(id => $(id)).find(x => x && !x.hidden);
    if (!m) return;
    const f = [...m.querySelectorAll("button, a[href], input, select, [tabindex='0']")].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  function openPlace(site, t) {
    opener = document.activeElement;
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
        <div class="place-top">
          ${ph ? `<figure class="photo"><img src="${esc(ph.src)}" alt="${esc(site.name)}" loading="lazy">
            <figcaption>${P.photo}: ${esc(ph.author)}, ${esc(ph.license)}, <a href="${esc(ph.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>`
            : `<p class="help">${P.noPhoto}</p>`}
          <div class="wiki">${txt ? `<p>${esc(txt.extract.replace(/\s*\[(cita requerida|citation needed)\]/gi, ""))}</p><a href="${esc(txt.url)}" target="_blank" rel="noopener">${P.read}</a><small>${P.textCredit}${state.lang === "es" && !w.es ? ". Este lugar no tiene artículo en español: el resumen está en inglés." : ""}</small>` : `<p class="help">${P.noText}</p>`}
            ${site.note ? `<p class="note">${esc(NOTE(site))}</p>` : ""}</div>
        </div>
      </div></div>`;
    m.hidden = false;
    document.body.classList.add("modal-open");
    const cmp = $("#cmp");
    $("#cmpRange").oninput = e => cmp.style.setProperty("--pos", e.target.value + "%");
    $("#placeClose").onclick = closePlace;
    $("#placeClose").focus();
    m.onclick = e => { if (e.target === m) closePlace(); };
  }
  function closePlace() {
    const m = $("#placeModal"); if (m) m.hidden = true;
    document.body.classList.remove("modal-open");
    if (opener && opener.isConnected) opener.focus();
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && $("#placeModal") && !$("#placeModal").hidden) closePlace(); });

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

| ${T().md.head.join(" | ")} |
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
  async function exportCertificate(r, test) {
    const s = r.site, t = target(), C = T().cert;
    const code = state.code || missionCode();
    const blob = await Patch.certificate({
      title: C.title, name: crewName(), role: roleLabel(),
      patch: { name: crewName(), code, body: t.body },
      statement: C.statement(PL(state.profile), short(t.name)),
      result: `${C.twin}: ${s.name.split(" – ")[0]}, ${CTRY(s.country)}, ${dec(r.score, 1)} / 100`,
      rows: [[C.code, code], [C.target, `${short(t.name)}, ${t.body === "Moon" ? T().moon : T().mars}`], [C.mission, PL(state.profile)],
        ...(test ? [[C.test, `${test.score}/${test.of}, ${test.rank}`]] : []), [C.date, new Date().toLocaleDateString(state.lang)]],
      footer: C.footer,
    });
    downloadBlob(`earth-analogs_${code}.png`, blob);
  }

  // ---------- deep links ----------
  function writeHash() { history.replaceState(null, "", `#t=${state.targetId}&p=${state.profile}&m=${state.mode}`); }
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const t = TARGETS.find(x => x.id === h.get("t"));
    if (!t || !Object.hasOwn(PROFILES, h.get("p"))) return false;
    state.targetId = t.id; state.body = t.body; state.profile = state.myProfile = h.get("p");
    if (["match", "untapped", "ready"].includes(h.get("m"))) state.mode = h.get("m");
    return true;
  }

  // ---------- boot ----------
  $("#startBtn").onclick = () => go("crew");
  $("#demoBtn").onclick = () => { location.hash = "t=moon_shackleton&p=balanced&m=match"; };
  addEventListener("hashchange", () => {
    if (run || !readHash()) return;
    state.selectedId = rank()[0].site.id; state.tab = "verdict"; state.fromTop = false; ctl.autoRotate = false;
    go("verdict"); showEarthResults(rank(), true);
  });
  $("#guideSound").onclick = () => { SFX.set(true); renderChrome(); SFX.go(); Guide.repeat(); };
  $("#soundBtn").onclick = () => { SFX.set(!SFX.on); renderChrome(); SFX.go(); if (SFX.on) Guide.repeat(); else Guide.hush(); };
  $("#skipBtn").onclick = skipJourney;
  addEventListener("keydown", e => { if (e.key === "Escape" && run) skipJourney(); });
  $("#homeBtn").onclick = goHome;
  $("#earthBtn").onclick = () => { state.scan = null; state.origin = null; state.targetId = null; ctl.autoRotate = false; go("earth"); showEarthMode(true); };
  document.querySelectorAll("#lang button").forEach(b => (b.onclick = () => {
    state.lang = b.dataset.l;
    if (state.scan?.scanned) { state.scan.name = state.lang === "es" ? "Punto escaneado" : "Scanned point"; state.scan.country = `${dec(state.scan.lat, 3)}°, ${dec(state.scan.lon, 3)}°`; }
    applyNames(); renderChrome(); renderPanel();
    if (touring) resumeTour?.(); else if (!run) guideStage(state.stage); // a tour carries on in the new language
    if (state.stage === "verdict" && state.tab !== "camp") showEarthResults(rank(), false);
  }));

  Guide.init({ voiceOn: () => SFX.on, lang: () => state.lang });
  Guide.show(true);
  renderChrome(); layoutGlobe();
  globe.pointOfView({ lat: 10, lng: -40, altitude: 2.3 }, 0);
  const linked = readHash();
  if (!linked) setTimeout(() => state.stage === "intro" && Guide.say(T().guide.intro), 900);
  if (linked) {
    state.selectedId = rank()[0].site.id; ctl.autoRotate = false;
    go("verdict"); showEarthResults(rank(), true);
  }
  window.TWApp = { state, scanPoint, globe }; // handle for debugging / demos
})();
