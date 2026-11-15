// Earth Analogs – automated checks. Run: node tests/run.mjs   (exit code 1 on any failure)
// Node built-ins only. Browser scripts are loaded with node:vm and a minimal fake window/document.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (...p) => path.join(ROOT, ...p);
const read = p => fs.readFileSync(R(p), "utf8");
const VERBOSE = process.argv.includes("-v");
const MAX_LINES = VERBOSE ? 1e9 : 12;

// ------------------------------------------------------------------ tiny harness
const results = [];
async function test(name, fn) {
  const issues = [], warns = [];
  const ctx = { fail: m => issues.push(m), warn: m => warns.push(m), check: (c, m) => { if (!c) issues.push(m); } };
  const t0 = Date.now();
  try { await fn(ctx); } catch (e) { issues.push(`threw: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e}`); }
  const ms = Date.now() - t0;
  results.push({ name, issues, warns });
  const tag = issues.length ? "FAIL" : warns.length ? "WARN" : "PASS";
  console.log(`${tag}  ${name}${ms > 500 ? `  (${(ms / 1000).toFixed(1)} s)` : ""}`);
  const show = (list, p) => { list.slice(0, MAX_LINES).forEach(m => console.log(`      ${p} ${m}`)); if (list.length > MAX_LINES) console.log(`      ${p} … ${list.length - MAX_LINES} more (run with -v)`); };
  show(issues, "x"); show(warns, "!");
}

// ------------------------------------------------------------------ loading browser scripts
const scriptCache = new Map();
function script(file) {
  if (!scriptCache.has(file)) scriptCache.set(file, new vm.Script(read(file), { filename: file }));
  return scriptCache.get(file);
}
// every local script in index.html order, except the UI modules that the fake browser stubs and app.js itself
const STUBBED = ["js/guide.js", "js/sound.js", "js/patch.js", "js/app.js"];
const DATA_SCRIPTS = [...fs.readFileSync(R("index.html"), "utf8").matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map(m => m[1]).filter(f => !STUBBED.includes(f));
function loadData(extra = {}) {
  const w = vm.createContext(Object.assign({}, extra));
  w.window = w;
  for (const f of DATA_SCRIPTS) script(f).runInContext(w);
  return w;
}
const W = loadData();
const { TW, TW_DATA, I18N, PROCESSES } = W;
const SITES = TW_DATA.sites, TARGETS = TW_DATA.targets, KEYS = TW.KEYS, PROFILES = Object.keys(TW.PROFILES);
const isNum = v => typeof v === "number" && Number.isFinite(v);
const in01 = v => isNum(v) && v >= 0 && v <= 1;
const appSrc = read("js/app.js");
const html = read("index.html");
// custom properties of the first :root block in styles.css (what getComputedStyle(documentElement) sees by default)
const CSS_SRC = read("css/styles.css");
const CSS_VARS = {};
{
  const root = (CSS_SRC.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ""])[1];
  for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (!(m[1] in CSS_VARS)) CSS_VARS[m[1]] = m[2].trim();
}
// evaluate an object literal declared in app.js (const NAME = {...};)
function appConst(name) {
  const m = appSrc.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`));
  return m ? vm.runInNewContext(`(${m[1]})`) : null;
}

// ================================================================== 1. syntax
await test("1. every JS file parses (node --check)", ({ fail }) => {
  const files = fs.readdirSync(R("js")).filter(f => f.endsWith(".js")).map(f => `js/${f}`);
  for (const f of files) {
    const r = spawnSync(process.execPath, ["--check", R(f)], { encoding: "utf8" });
    if (r.status !== 0) fail(`${f}: ${(r.stderr || "").split("\n").slice(0, 4).join(" ")}`);
  }
  const refd = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map(m => m[1]);
  files.filter(f => !refd.includes(f)).forEach(f => fail(`${f} is not loaded by index.html`));
});

// ================================================================== 2. i18n
function walk(es, en, at, out) {
  const tes = Array.isArray(es) ? "array" : typeof es, ten = Array.isArray(en) ? "array" : typeof en;
  if (tes !== ten) { out.push({ kind: "type", at, msg: `${at}: ES is ${tes}, EN is ${ten}` }); return; }
  if (tes === "array") {
    if (es.length !== en.length) out.push({ kind: "len", at, msg: `${at}: array length ES ${es.length} vs EN ${en.length}` });
    es.forEach((v, i) => i < en.length && walk(v, en[i], `${at}[${i}]`, out));
  } else if (tes === "object" && es) {
    const ke = Object.keys(es), kn = Object.keys(en);
    ke.filter(k => !(k in en)).forEach(k => out.push({ kind: "key", at, msg: `${at}.${k}: missing in EN` }));
    kn.filter(k => !(k in es)).forEach(k => out.push({ kind: "key", at, msg: `${at}.${k}: missing in ES` }));
    ke.filter(k => k in en).forEach(k => walk(es[k], en[k], `${at}.${k}`, out));
  } else if (tes === "function") {
    if (es.length !== en.length) out.push({ kind: "arity", at, msg: `${at}: arity ES ${es.length} vs EN ${en.length}` });
    const args = ["Alfa", "Beta", "Gamma", "Delta", "Epsilon"];
    let a, b, ea, eb;
    try { a = es(...args); } catch (e) { ea = e.message; }
    try { b = en(...args); } catch (e) { eb = e.message; }
    if (!!ea !== !!eb) out.push({ kind: "call", at, msg: `${at}(…): ES ${ea ? "throws " + ea : "ok"}, EN ${eb ? "throws " + eb : "ok"}` });
    if (typeof a === "string" && typeof b === "string") strings(a, b, `${at}()`, out);
  } else if (tes === "string") strings(es, en, at, out);
}
const ES_IN_EN = /[áéíóúñ¿¡]/i;
// proper names that legitimately carry Spanish/other accents in English text
const NAME_OK = /Río Tinto|Payún|Matrú|Timanfaya|Kīlauea|Ka'ū|Ka‘ū|Piedra Pómez|Pómez|Licancabur|Uyuni|Galápagos|Lut|Hanksville|Ló|Tíbet|Limpiopungo|Chimborazo|Arenal|Pajonales|Concordia|Atacama|Yungay/g;
const EN_IN_ES = /\b(the|and|with|from|your|this|that|which|of the|click|here is|you)\b/i;
function strings(es, en, at, out) {
  if (!es.trim()) out.push({ kind: "empty", at, msg: `${at}: empty ES string` });
  if (!en.trim()) out.push({ kind: "empty", at, msg: `${at}: empty EN string` });
  if (ES_IN_EN.test(en.replace(NAME_OK, ""))) out.push({ kind: "esInEn", at, msg: `${at}: Spanish characters in EN: "${en.slice(0, 90)}"` });
  if (EN_IN_ES.test(es.replace(/<[^>]+>/g, ""))) out.push({ kind: "enInEs", at, msg: `${at}: English words in ES: "${es.slice(0, 90)}"` });
  if (es === en && es.length > 25 && /[a-z]{4,} [a-z]{4,}/i.test(es)) out.push({ kind: "same", at, msg: `${at}: ES and EN are identical: "${es.slice(0, 70)}"` });
  for (const [l, s] of [["ES", es], ["EN", en]]) if (/undefined|NaN|\[object /.test(s)) out.push({ kind: "undef", at, msg: `${at}: ${l} renders "${s.slice(0, 80)}"` });
}
await test("2a. i18n: I18N.es / I18N.en same keys, types, arity; no empty strings", ({ fail }) => {
  const out = []; walk(I18N.es, I18N.en, "I18N", out);
  out.filter(o => ["type", "len", "key", "arity", "call", "empty", "undef"].includes(o.kind)).forEach(o => fail(o.msg));
});
await test("2b. i18n: other bilingual tables (features, profiles, tags, processes…)", ({ fail, check }) => {
  const out = [];
  for (const g of ["I18N_FEATURES", "I18N_PROFILES", "I18N_PROFILE_DESC", "I18N_TARGET_TAG", "I18N_PROFILE_WHY"]) walk(W[g].es, W[g].en, g, out);
  walk(PROCESSES.label.es, PROCESSES.label.en, "PROCESSES.label", out);
  walk(PROCESSES.text.es, PROCESSES.text.en, "PROCESSES.text", out);
  out.filter(o => ["type", "len", "key", "arity", "call", "empty", "undef"].includes(o.kind)).forEach(o => fail(o.msg));
  for (const l of ["es", "en"]) {
    KEYS.forEach(k => check(W.I18N_FEATURES[l][k], `I18N_FEATURES.${l}.${k} missing`));
    for (const g of ["I18N_PROFILES", "I18N_PROFILE_DESC", "I18N_PROFILE_WHY"]) PROFILES.forEach(p => check(W[g][l][p], `${g}.${l}.${p} missing`));
    TARGETS.forEach(t => check(W.I18N_TARGET_TAG[l][t.id], `I18N_TARGET_TAG.${l}.${t.id} missing`));
    TARGETS.forEach(t => check(I18N[l].guide?.targets?.[t.id], `I18N.${l}.guide.targets.${t.id} missing`));
    PROCESSES.order.forEach(k => check(PROCESSES.label[l][k], `PROCESSES.label.${l}.${k} missing`));
  }
  TARGETS.forEach(t => {
    const es = W.I18N_TARGET_FACTS.es[t.id];
    if (!es) fail(`I18N_TARGET_FACTS.es.${t.id} missing (Spanish brief would show English facts)`);
    else if (es.length !== (t.facts || []).length) fail(`I18N_TARGET_FACTS.es.${t.id}: ${es.length} facts vs ${(t.facts || []).length} in EN data`);
  });
  Object.keys(W.I18N_TARGET_FACTS.es).filter(id => !TARGETS.some(t => t.id === id)).forEach(id => fail(`I18N_TARGET_FACTS.es.${id}: unknown target`));
});
await test("2c. i18n: language leaks (Spanish in EN / English in ES, heuristic)", ({ fail, warn }) => {
  const out = []; walk(I18N.es, I18N.en, "I18N", out);
  for (const g of ["I18N_FEATURES", "I18N_PROFILES", "I18N_PROFILE_DESC", "I18N_TARGET_TAG", "I18N_PROFILE_WHY"]) walk(W[g].es, W[g].en, g, out);
  walk(PROCESSES.text.es, PROCESSES.text.en, "PROCESSES.text", out);
  out.filter(o => o.kind === "esInEn").forEach(o => fail(o.msg));
  out.filter(o => o.kind === "enInEs" || o.kind === "same").forEach(o => warn(o.msg));
  // processes: per-target [when, es, en]
  for (const [id, procs] of Object.entries(PROCESSES.target)) for (const [k, [, es, en]] of Object.entries(procs)) {
    if (ES_IN_EN.test(en.replace(NAME_OK, ""))) fail(`PROCESSES.target.${id}.${k}: Spanish in EN text`);
    if (EN_IN_ES.test(es)) warn(`PROCESSES.target.${id}.${k}: English words in ES text`);
  }
  // Spanish data overlays
  const D = W.I18N_DATA;
  const ids = new Set([...SITES, ...TARGETS].map(x => x.id));
  Object.keys(D.name.es).filter(id => !ids.has(id)).forEach(id => fail(`I18N_DATA.name.es.${id}: unknown id`));
  Object.keys(D.note.es).filter(id => !SITES.some(s => s.id === id)).forEach(id => fail(`I18N_DATA.note.es.${id}: unknown site id`));
  SITES.filter(s => s.note && !D.note.es[s.id]).forEach(s => fail(`I18N_DATA.note.es.${s.id} missing: Spanish UI shows the English note`));
  [...new Set(SITES.map(s => s.country))].filter(c => !(c in D.country.es)).forEach(c => warn(`I18N_DATA.country.es["${c}"] missing`));
  // evidence lines: every target "prov" text should be rewritten into Spanish by some regex
  const PROV = txt => D.prov.es.reduce((t, [re, rep]) => t.replace(re, rep), txt);
  for (const t of TARGETS) for (const [k, p] of Object.entries(t.prov || {})) {
    const es = PROV(p.text);
    if (es === p.text && /\b(within|relief|mean|surface|month|counts|lower|no|full|day|up to|ice)\b/i.test(p.text)) fail(`target ${t.id}.prov.${k}: not translated to ES: "${p.text}"`);
  }
});
await test("2d. i18n: every static T().a.b / alias lookup in app.js resolves in ES and EN", ({ fail }) => {
  const get = (o, chain) => chain.reduce((a, k) => (a == null ? undefined : a[k]), o);
  const missing = new Set();
  const look = (chain, where) => { for (const l of ["es", "en"]) if (get(I18N[l], chain) === undefined) missing.add(`${l}: T().${chain.join(".")}  (${where})`); };
  // direct chains
  for (const m of appSrc.matchAll(/T\(\)((?:\.[A-Za-z_]\w*)+)/g)) {
    const chain = m[1].slice(1).split(".");
    // stop at a method of a string/array/function value (e.g. .replace, .map, .split)
    const cut = []; for (const k of chain) { cut.push(k); const v = get(I18N.es, cut); if (typeof v !== "object" || v === null || Array.isArray(v)) break; }
    look(cut, `line ${appSrc.slice(0, m.index).split("\n").length}`);
  }
  // aliases (X = T().path, X = now("path"), S = () => T().tour.steps), scoped to the top-level block they are declared in
  const blocks = appSrc.split(/\n(?=  (?:async )?function |  const [A-Za-z_]+ = )/);
  let line = 1;
  for (const b of blocks) {
    const aliases = {};
    for (const m of b.matchAll(/\b([A-Z][A-Za-z]?) = T\(\)((?:\.\w+)+)(?![\w.(\[])/g)) aliases[m[1]] = m[2].slice(1).split(".");
    for (const m of b.matchAll(/\b([A-Z]) = now\("(\w+)"\)/g)) aliases[m[1]] = [m[2]];
    if (/const S = \(\) => T\(\)\.tour\.steps/.test(b)) aliases["S()"] = ["tour", "steps"];
    for (const [a, base] of Object.entries(aliases)) {
      const re = a === "S()" ? /\bS\(\)\.(\w+)/g : new RegExp(`(?<![\\w.])${a}\\.(\\w+)`, "g");
      for (const m of b.matchAll(re)) look([...base, m[1]], `alias ${a}, near line ${line + b.slice(0, m.index).split("\n").length - 1}`);
    }
    line += b.split("\n").length;
  }
  [...missing].forEach(fail);
  // dynamic lookups with known key sets
  const ROLE_PROFILES = appConst("ROLE_PROFILES");
  for (const l of ["es", "en"]) {
    const L = I18N[l];
    ["verdict", "top", "camp", "map", "evidence", "scan"].forEach(k => { if (!L.tabs?.[k]) fail(`${l}: tabs.${k}`); if (!L.help?.[k]) fail(`${l}: help.${k}`); if (!L.guide?.tabs?.[k]) fail(`${l}: guide.tabs.${k}`); });
    ["match", "untapped", "ready"].forEach(k => { if (!L.modes?.[k]) fail(`${l}: modes.${k}`); if (!L.modeHelp?.[k]) fail(`${l}: modeHelp.${k}`); });
    ["ocean", "fail"].forEach(k => { if (!L.scanErr?.[k]) fail(`${l}: scanErr.${k}`); });
    ["measured", "mapped", "mission", "literature"].forEach(k => { if (!L.kinds?.[k]) fail(`${l}: kinds.${k}`); });
    ["Moon", "Mars"].forEach(b => { const p = L.hud?.landPhases?.[b]; if (!Array.isArray(p) || p.length < 4) fail(`${l}: hud.landPhases.${b} needs 4 entries`); });
    if (!Array.isArray(L.hud?.phases) || L.hud.phases.length < 4) fail(`${l}: hud.phases needs 4 entries`);
    if (!Array.isArray(L.steps) || L.steps.length !== 5) fail(`${l}: steps needs 5 entries`);
    Object.keys(ROLE_PROFILES).forEach(r => { if (!L.crew?.roles?.[r]) fail(`${l}: crew.roles.${r}`); if (!L.roleTip?.btn?.[r]) fail(`${l}: roleTip.btn.${r}`); });
    Object.keys(L.crew?.roles || {}).forEach(r => { if (!(r in ROLE_PROFILES)) fail(`${l}: crew.roles.${r} has no ROLE_PROFILES entry`); });
    ["easy", "mid", "hard"].forEach(k => { if (!L.roleTip?.access?.[k]) fail(`${l}: roleTip.access.${k}`); });
    ["top", "ok", "retry"].forEach(k => { if (!L.game?.rank?.[k]) fail(`${l}: game.rank.${k}`); });
    Object.keys(PROCESSES.text[l].lesson).length === 4 || fail(`${l}: PROCESSES lesson needs 4 pairings`);
  }
  // data-i attributes in index.html are filled from T()[key]
  for (const m of html.matchAll(/data-i="(\w+)"/g)) for (const l of ["es", "en"]) if (typeof I18N[l][m[1]] !== "string") fail(`index.html data-i="${m[1]}" is not a string in I18N.${l}`);
});

// ================================================================== 3. data integrity
await test("3a. data: Earth sites (ids, lat/lon, fields, fingerprint)", ({ fail, check, warn }) => {
  const seen = new Set();
  for (const s of SITES) {
    const id = s.id;
    check(typeof id === "string" && /^[a-z0-9_]+$/.test(id), `site id "${id}" invalid`);
    check(!seen.has(id), `duplicate site id ${id}`); seen.add(id);
    check(isNum(s.lat) && s.lat >= -90 && s.lat <= 90, `${id}: lat ${s.lat}`);
    check(isNum(s.lon) && s.lon >= -180 && s.lon <= 180, `${id}: lon ${s.lon}`);
    check(typeof s.name === "string" && s.name.trim(), `${id}: name`);
    check(typeof s.country === "string" && s.country.trim(), `${id}: country`);
    check(in01(s.usage), `${id}: usage ${s.usage}`);
    check(in01(s.access), `${id}: access ${s.access}`);
    KEYS.filter(k => !TW.CLIMATE_KEYS.includes(k)).forEach(k => check(in01(s[k]), `${id}: ${k} = ${s[k]} (needs number 0..1)`));
    const p = s.power || {};
    ["t2m", "t2m_range", "precip", "rh", "ps", "sw", "sw_min", "sw_max", "uv", "grid_elev"].forEach(k => check(isNum(p[k]), `${id}: power.${k} = ${p[k]}`));
    check(isNum(s.elev), `${id}: elev ${s.elev}`);
    if (isNum(p.sw_min) && isNum(p.sw_max)) check(p.sw_min <= p.sw && p.sw <= p.sw_max + 1e-9, `${id}: sw ${p.sw} outside monthly [${p.sw_min}, ${p.sw_max}]`);
    if (isNum(p.ps)) check(p.ps > 40 && p.ps < 110, `${id}: power.ps ${p.ps} kPa implausible`);
    if (p.ws10m == null) warn(`${id}: power.ws10m missing (wind process never detected)`);
    const fp = TW.fingerprint(s);
    KEYS.forEach(k => { if (fp[k] == null) fail(`${id}: fingerprint.${k} is null`); else if (!in01(fp[k])) fail(`${id}: fingerprint.${k} = ${fp[k]} (NaN / out of 0..1)`); });
    if (s.geo_kind) Object.entries(s.geo_kind).forEach(([k, v]) => check(["mapped", "measured"].includes(v), `${id}: geo_kind.${k} = ${v}`));
  }
  check(SITES.length >= 10, `only ${SITES.length} sites`);
});
await test("3b. data: Moon/Mars targets (ids, lat/lon, 15 axes, provenance)", ({ fail, check }) => {
  const seen = new Set();
  for (const t of TARGETS) {
    check(!seen.has(t.id), `duplicate target id ${t.id}`); seen.add(t.id);
    check(!SITES.some(s => s.id === t.id), `target id ${t.id} collides with a site id`);
    check(["Moon", "Mars"].includes(t.body), `${t.id}: body ${t.body}`);
    check(t.id.startsWith(t.body.toLowerCase() + "_"), `${t.id}: id prefix does not match body ${t.body}`);
    check(isNum(t.lat) && t.lat >= -90 && t.lat <= 90, `${t.id}: lat ${t.lat}`);
    check(isNum(t.lon) && t.lon >= -180 && t.lon <= 180, `${t.id}: lon ${t.lon}`);
    KEYS.forEach(k => check(in01(t[k]), `${t.id}: ${k} = ${t[k]} (needs number 0..1)`));
    check(Array.isArray(t.facts) && t.facts.length, `${t.id}: facts`);
    Object.entries(t.prov || {}).forEach(([k, p]) => { check(KEYS.includes(k), `${t.id}: prov.${k} is not an axis`); check(["measured", "mission", "mapped", "literature"].includes(p.kind), `${t.id}: prov.${k}.kind ${p.kind}`); });
  }
  check(TARGETS.some(t => t.body === "Moon") && TARGETS.some(t => t.body === "Mars"), "need Moon and Mars targets");
});
await test("3c. data: cross references (processes, app tables, wiki, assets)", ({ fail, check, warn }) => {
  const tid = new Set(TARGETS.map(t => t.id)), sid = new Set(SITES.map(s => s.id));
  for (const [id, procs] of Object.entries(PROCESSES.target)) {
    check(tid.has(id), `processes.js: target "${id}" does not exist`);
    for (const [k, v] of Object.entries(procs)) {
      check(PROCESSES.order.includes(k), `processes.js: ${id}.${k} is not a known process`);
      check(Array.isArray(v) && ["now", "old"].includes(v[0]) && typeof v[1] === "string" && typeof v[2] === "string", `processes.js: ${id}.${k} must be [now|old, es, en]`);
    }
  }
  TARGETS.filter(t => !PROCESSES.target[t.id]).forEach(t => warn(`processes.js: no processes for target ${t.id}`));
  PROCESSES.activeVolcano.forEach(id => check(sid.has(id), `processes.js activeVolcano: unknown site "${id}"`));
  PROCESSES.activeVolcano.forEach(id => { const s = SITES.find(x => x.id === id); if (s && TW.fingerprint(s).basalt < 0.6) warn(`processes.js activeVolcano "${id}" has basalt ${s.basalt} < 0.6, so the volcanic process is never shown`); });
  const CODE_T = appConst("CODE_T"), CODE_P = appConst("CODE_P"), SVG = appConst("PROFILE_SVG");
  TARGETS.forEach(t => check(CODE_T?.[t.id], `app.js CODE_T has no code for ${t.id}`));
  PROFILES.forEach(p => { check(CODE_P?.[p], `app.js CODE_P has no code for ${p}`); check(SVG?.[p], `app.js PROFILE_SVG has no icon for ${p}`); });
  Object.keys(CODE_T || {}).forEach(id => check(tid.has(id), `app.js CODE_T: unknown target ${id}`));
  Object.values(appConst("ROLE_PROFILES") || {}).flat().forEach(p => check(PROFILES.includes(p), `app.js ROLE_PROFILES: unknown profile ${p}`));
  Object.keys(W.TW_WIKI).forEach(id => check(sid.has(id), `wiki.js: entry "${id}" matches no site`));
  SITES.filter(s => !W.TW_WIKI[s.id]).forEach(s => warn(`wiki.js: no entry for ${s.id}`));
  for (const [id, w] of Object.entries(W.TW_WIKI)) {
    if (w.photo) check(/^https:\/\//.test(w.photo.src) && w.photo.author && w.photo.license, `wiki.js ${id}: photo needs https src, author, license`);
    for (const l of ["en", "es"]) if (w[l]) check(w[l].extract && /^https:\/\//.test(w[l].url), `wiki.js ${id}.${l}: extract/url`);
  }
  ["assets/earth.jpg", "assets/moon.jpg", "assets/mars.jpg"].forEach(f => check(fs.existsSync(R(f)), `${f} missing`));
  SITES.forEach(s => check(fs.existsSync(R("assets/views/earth", `${s.id}.jpg`)), `assets/views/earth/${s.id}.jpg missing (place card / landing photo)`));
  TARGETS.forEach(t => check(fs.existsSync(R("assets/views/target", `${t.id}.jpg`)), `assets/views/target/${t.id}.jpg missing`));
  fs.readdirSync(R("assets/views/earth")).forEach(f => check(sid.has(f.replace(/\.jpg$/, "")), `assets/views/earth/${f}: orphan image`));
  // js/nasa.js (NASA's own analog sites), when present and loaded
  const N = W.NASA_ANALOGS;
  if (N?.catalog) for (const [id, v] of Object.entries(N.catalog)) {
    check(sid.has(id), `nasa.js catalog: "${id}" matches no site`);
    check(v.es && v.en, `nasa.js catalog.${id}: needs es and en text`);
    if (v.en && ES_IN_EN.test(v.en.replace(NAME_OK, ""))) fail(`nasa.js catalog.${id}: Spanish characters in EN text`);
  }
});
await test("3d. data: js/data.js agrees with data/*.json sources and caches", ({ fail, check }) => {
  const src = JSON.parse(read("data/earth_sites.json")).sites, tsrc = JSON.parse(read("data/targets.json")).targets;
  check(src.length === SITES.length, `earth_sites.json has ${src.length} sites, data.js ${SITES.length} (rebuild with pipeline/build_data.py)`);
  src.forEach(s => { const d = SITES.find(x => x.id === s.id); if (!d) fail(`earth_sites.json ${s.id} missing in data.js`); else check(d.lat === s.lat && d.lon === s.lon, `${s.id}: lat/lon differ between earth_sites.json and data.js`); });
  check(tsrc.length === TARGETS.length, `targets.json has ${tsrc.length} targets, data.js ${TARGETS.length}`);
  tsrc.forEach(t => { const d = TARGETS.find(x => x.id === t.id); if (!d) fail(`targets.json ${t.id} missing in data.js`); else check(d.lat === t.lat && d.lon === t.lon && d.body === t.body, `${t.id}: lat/lon/body differ`); });
  const cache = (f) => { try { return JSON.parse(read(`data/${f}`)); } catch { return null; } };
  const power = cache("power_cache.json"), relief = cache("relief_cache.json"), ndvi = cache("ndvi_cache.json");
  for (const s of SITES) {
    // Python keys are f"{lat},{lon}": a float written as -70.0 in earth_sites.json becomes "-70.0"
    const py = x => [String(x), ...(Number.isInteger(x) ? [x.toFixed(1)] : [])];
    const keys = py(s.lat).flatMap(a => py(s.lon).map(o => `${a},${o}`));
    const pick = c => (c ? keys.map(k => c[k]).find(v => v !== undefined) : undefined);
    const key = keys.find(k => power && k in power) || keys[0];
    const p = pick(power);
    if (power && !p) { fail(`${s.id}: no power_cache entry for "${key}"`); continue; }
    if (p) for (const k of Object.keys(p)) if (p[k] !== s.power[k]) fail(`${s.id}: power.${k} ${s.power[k]} != cache ${p[k]}`);
    const rc = pick(relief);
    if (relief && rc == null) fail(`${s.id}: no relief_cache entry`);
    if (rc != null) {
      check(Math.abs(s.relief_m - rc) < 1e-6, `${s.id}: relief_m differs from relief_cache`);
      check(Math.abs(s.relief - Math.round(Math.min(Math.max(rc / 1500, 0), 1) * 1000) / 1000) < 1e-9, `${s.id}: relief ${s.relief} != clamp(relief_m/1500)`);
    }
    // ndvi is stored rounded to 3 decimals, so allow that rounding (÷0.4) plus barren's own rounding
    if (s.ndvi != null) check(Math.abs(s.barren - TW.clamp((0.5 - s.ndvi) / 0.4)) <= 0.0005 / 0.4 + 0.0005 + 1e-9, `${s.id}: barren ${s.barren} != f(ndvi ${s.ndvi})`);
  }
});
await test("3e. data: stored terrain axes = TW.geoAxes(site.geo) (catalog and live scan scored alike)", ({ fail }) => {
  for (const s of SITES) {
    if (!s.geo) continue;
    const ax = TW.geoAxes(s.geo, s.relief_m ?? null);
    for (const [k, v] of Object.entries(ax)) if (Math.abs(Math.round(v * 1000) / 1000 - s[k]) > 1e-9) fail(`${s.id}: ${k} stored ${s[k]}, engine geoAxes gives ${v.toFixed(3)}`);
    for (const k of Object.keys(s.geo_kind || {})) if (!(k in ax)) fail(`${s.id}: geo_kind.${k} set but geoAxes gives no ${k}`);
  }
});
await test("3f. data: global climate grid (grid.js) is well formed", ({ fail, check }) => {
  const G = W.TW_GRID, n = G.cols.length;
  check(G.cols[0] === "lat" && G.cols[1] === "lon", "grid cols must start with lat, lon");
  let bad = 0;
  for (const r of G.rows) {
    if (r.length !== n || r.some(v => !isNum(v))) { if (bad++ < 5) fail(`grid row ${JSON.stringify(r).slice(0, 80)}: wrong length or non-number`); continue; }
    if (Math.abs(r[0] / G.step - Math.round(r[0] / G.step)) > 1e-6 || Math.abs(r[1] / G.step - Math.round(r[1] / G.step)) > 1e-6) if (bad++ < 5) fail(`grid row at ${r[0]},${r[1]} is off the ${G.step}° grid`);
  }
  const keys = new Set(G.rows.map(r => `${r[0]},${r[1]}`)); check(keys.size === G.rows.length, `${G.rows.length - keys.size} duplicate grid cells`);
  const fp = G.rows.map(r => { const pw = {}; G.cols.forEach((c, i) => (pw[c] = r[i])); return TW.climateFromPower(pw, null); });
  const nan = fp.filter(f => TW.CLIMATE_KEYS.some(k => f[k] != null && !in01(f[k]))).length;
  check(!nan, `${nan} grid cells give a NaN / out-of-range climate axis`);
  if (bad > 5) fail(`… ${bad - 5} more bad rows`);
});

// ================================================================== 4. engine
function rankApp(t, profile, mode = "match", sites = SITES) {
  const w = TW.profileWeights(profile);
  return sites.map(s => {
    const c = TW.compare(s.fp, t, w);
    let value = c.score;
    if (mode === "untapped") value = c.score * (1 - 0.75 * (s.usage ?? 0));
    if (mode === "ready") value = c.score * (0.6 + 0.4 * (s.access ?? 0.5));
    return { site: s, ...c, value };
  }).sort((a, b) => b.value - a.value);
}
SITES.forEach(s => (s.fp = TW.fingerprint(s)));
await test("4a. engine: profiles are valid weight vectors", ({ check }) => {
  for (const [id, p] of Object.entries(TW.PROFILES)) {
    Object.keys(p.w).forEach(k => check(KEYS.includes(k), `profile ${id}: weight on unknown axis "${k}"`));
    const w = TW.profileWeights(id);
    KEYS.forEach(k => check(isNum(w[k]) && w[k] > 0, `profile ${id}: weight ${k} = ${w[k]}`));
  }
  check(KEYS.length === 15 && new Set(KEYS).size === 15, "15 unique axes expected");
  check(TW.FEATURES.every(f => ["climate", "terrain"].includes(f.group)), "feature groups");
});
await test("4b. engine: every target × profile × mode ranks all sites, scores finite 0–100, sorted, deterministic", ({ fail, warn }) => {
  for (const t of TARGETS) for (const p of PROFILES) for (const m of ["match", "untapped", "ready"]) {
    const tag = `${t.id}/${p}/${m}`;
    const a = rankApp(t, p, m), b = rankApp(t, p, m), c = rankApp(t, p, m, SITES.slice().reverse());
    if (a.length !== SITES.length) { fail(`${tag}: ${a.length} results`); continue; }
    a.forEach(r => { if (!isNum(r.score) || r.score < 0 || r.score > 100) fail(`${tag}: ${r.site.id} score ${r.score}`); if (!isNum(r.value)) fail(`${tag}: ${r.site.id} value ${r.value}`); if (!(r.confidence >= 0 && r.confidence <= 1)) fail(`${tag}: confidence ${r.confidence}`); });
    for (let i = 1; i < a.length; i++) if (a[i - 1].value < a[i].value) { fail(`${tag}: not sorted at ${i}`); break; }
    if (a.map(r => r.site.id).join() !== b.map(r => r.site.id).join()) fail(`${tag}: ranking differs between two runs`);
    if (a[0].site.id !== c[0].site.id) fail(`${tag}: top result depends on input order (${a[0].site.id} vs ${c[0].site.id})`);
    else if (a.length > 1 && Math.abs(a[0].value - a[1].value) < 1e-9) warn(`${tag}: exact tie for #1 (${a[0].site.id} = ${a[1].site.id})`);
  }
});
await test("4c. engine: identities and campaign builder invariants", ({ fail, check }) => {
  for (const t of TARGETS) {
    const self = TW.compare(t, t, TW.profileWeights("balanced"));
    check(Math.abs(self.score - 100) < 1e-9 && self.confidence === 1, `${t.id}: compare(target, itself) = ${self.score}`);
    for (const p of PROFILES) {
      const w = TW.profileWeights(p), pool = rankApp(t, p);
      const camp = TW.buildCampaign(pool, t, w, 3);
      const ids = camp.chosen.map(c => c.site.id);
      check(ids.length === 3 && new Set(ids).size === 3, `${t.id}/${p}: campaign picks ${ids}`);
      check(isNum(camp.coverage) && camp.coverage >= 0 && camp.coverage <= 100, `${t.id}/${p}: coverage ${camp.coverage}`);
      const tot = KEYS.reduce((a, k) => a + w[k], 0), single = 100 * KEYS.reduce((a, k) => a + w[k] * (pool[0].per[k] ?? 0), 0) / tot;
      check(camp.coverage >= single - 1e-9, `${t.id}/${p}: campaign coverage ${camp.coverage.toFixed(1)} < best single site ${single.toFixed(1)}`);
      KEYS.forEach(k => check(ids.includes(camp.owner[k].site?.site.id), `${t.id}/${p}: owner of ${k} not in campaign`));
    }
  }
  // climateFromPower edge cases that the live scan can produce
  const base = { t2m: 10, t2m_range: 10, precip: 1, rh: 50, ps: 90, sw: 5, uv: 2, grid_elev: 0 };
  const edge = [["sw_max = 0 (polar night all year)", { ...base, sw_min: 0, sw_max: 0 }], ["precip = 0", { ...base, precip: 0, sw_min: 3, sw_max: 7 }],
    ["all monthly SW are fill values (app.js fetchPower gives min=Infinity, max=-Infinity)", { ...base, sw_min: Infinity, sw_max: -Infinity }]];
  for (const [label, pw] of edge) {
    const c = TW.climateFromPower(pw, 100);
    TW.CLIMATE_KEYS.forEach(k => { if (c[k] != null && !in01(c[k])) fail(`climateFromPower(${label}): ${k} = ${c[k]}`); });
  }
});

// ================================================================== 5. index.html
await test("5a. index.html: local files exist, one cache version", ({ fail, check }) => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|#|data:|mailto:)/.test(u));
  refs.forEach(u => check(fs.existsSync(R(u.split("?")[0])), `index.html references missing file ${u}`));
  const vers = [...html.matchAll(/\?v=([^"&]+)/g)].map(m => m[1]);
  const uniq = [...new Set(vers)];
  check(uniq.length === 1, `cache versions differ: ${uniq.join(", ")}`);
  refs.filter(u => /\.(js|css)(\?|$)/.test(u) && !/\?v=/.test(u)).forEach(u => fail(`${u} has no ?v= cache version`));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  ids.filter((x, i) => ids.indexOf(x) !== i).forEach(x => fail(`duplicate id="${x}" in index.html`));
  const css = CSS_SRC;
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(https?:|data:|#)/.test(m[1])) check(fs.existsSync(path.join(R("css"), m[1])), `styles.css url(${m[1]}) missing`);
});
await test("5b. ids used by JS exist in index.html or are created in JS", ({ fail }) => {
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const files = ["js/app.js", "js/guide.js", "js/patch.js", "js/sound.js"];
  const created = new Set(), createdPrefix = new Set(), used = new Map();
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/\bid="([A-Za-z][\w-]*)(\$\{)?/g)) (m[2] ? createdPrefix : created).add(m[1]);
    for (const m of src.matchAll(/\.id\s*=\s*["']([\w-]+)["']/g)) created.add(m[1]);
    for (const m of src.matchAll(/["'`]#([A-Za-z][\w-]*)(\$\{|["']\s*\+|=)?/g)) {
      if (m[2] === "=") continue; // "#t=…" is the deep-link hash, not a selector
      if (/^[0-9a-f]{3,8}$/i.test(m[1])) continue; // colours
      const key = m[2] ? m[1] + "*" : m[1];
      if (!used.has(key)) used.set(key, `${f}:${src.slice(0, m.index).split("\n").length}`);
    }
    for (const m of src.matchAll(/getElementById\(\s*["']([\w-]+)/g)) if (!used.has(m[1])) used.set(m[1], `${f}:${src.slice(0, m.index).split("\n").length}`);
  }
  for (const [id, where] of used) {
    if (id.endsWith("*")) { const p = id.slice(0, -1); if (![...htmlIds, ...created, ...createdPrefix].some(x => x.startsWith(p))) fail(`#${p}… (${where}) matches no id`); }
    else if (!htmlIds.has(id) && !created.has(id)) fail(`#${id} (${where}) is neither in index.html nor created in JS`);
  }
});

await test("5c. CSS custom properties read from JS are defined on :root (and parse as colours where hex is assumed)", ({ fail }) => {
  const used = new Map();
  for (const f of ["js/app.js", "js/patch.js", "js/guide.js"]) {
    const src = read(f);
    for (const m of src.matchAll(/(?:tok\(|getPropertyValue\()\s*["'`](--[\w-]+?)(\$\{[^}]+\})?["'`]/g)) {
      const names = m[2] ? [0, 1, 2, 3].map(i => m[1] + i) : [m[1]];
      names.forEach(n => used.set(n, `${f}:${src.slice(0, m.index).split("\n").length}`));
    }
    for (const m of src.matchAll(/var\((--[\w-]+)\)/g)) used.set(m[1], `${f}:${src.slice(0, m.index).split("\n").length}`);
  }
  for (const [n, where] of used) if (!(n in CSS_VARS) && !new RegExp(`${n}\\s*:`).test(CSS_SRC)) fail(`${n} (${where}) is not defined in styles.css`);
  // scoreColor() parses the --ramp-* stops with hex(): they must be #rrggbb
  Object.entries(CSS_VARS).filter(([n]) => /^--ramp-\d$/.test(n)).forEach(([n, v]) => { if (!/^#[0-9a-f]{6}$/i.test(v)) fail(`${n}: "${v}" is not #rrggbb (app.js scoreColor would give rgb(NaN…))`); });
});

// ================================================================== 6. app.js in a fake browser
// A permissive DOM: every element is a Proxy that remembers what is assigned to it and returns
// a fresh stub for anything else, so app.js runs end to end. Every HTML/text written is checked.
function makeBrowser({ hash = "", lang = "es-ES", store = {}, fetchImpl, fastTimers = false } = {}) {
  const texts = [], errors = [], handlers = {};
  const record = (v, where) => { if (typeof v === "string") texts.push([where, v]); };
  const memo = new Map(), pools = new Map();
  function el(name, init = {}) {
    const props = { dataset: {}, style: { setProperty() {} }, children: [], hidden: false, ...init };
    props.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    props.insertAdjacentHTML = (_, h) => record(h, name + ".insertAdjacentHTML");
    props.querySelector = sel => doc.querySelector(sel);
    props.querySelectorAll = sel => doc.querySelectorAll(sel);
    props.getAnimations = () => [];
    props.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, bottom: 100, right: 100 });
    props.getContext = () => el("ctx2d");
    props.toDataURL = () => "data:,";
    props.animate = () => el("anim", { finished: Promise.resolve(), finish() {}, cancel() {} });
    props.isConnected = true;
    return new Proxy(function () {}, {
      get(_, k) {
        if (k === Symbol.toPrimitive) return () => "";
        if (k === Symbol.iterator) return function* () {};
        if (k === "then" || typeof k === "symbol") return undefined;
        if (k in props) return props[k];
        if (/^on[a-z]/.test(k)) return null; // event handlers are unset until the app assigns one
        return (props[k] = el(`${name}.${String(k)}`));
      },
      set(_, k, v) { props[k] = v; if (k === "innerHTML" || k === "textContent") record(v, `${name}.${k}`); return true; },
      apply() { return el(`${name}()`); },
      construct() { return el(`new ${name}`); },
    });
  }
  const pool = (sel, list) => { if (!pools.has(sel)) pools.set(sel, list.map(d => el(sel, { dataset: d }))); return pools.get(sel); };
  const doc = {
    querySelector(sel) { if (!memo.has(sel)) memo.set(sel, el(sel)); return memo.get(sel); },
    querySelectorAll(sel) {
      if (/\.tabs button$/.test(sel)) return pool("tabs", ["verdict", "top", "camp", "map", "evidence", "scan"].map(tab => ({ tab })));
      if (sel === "#lang button") return pool("lang", [{ l: "es" }, { l: "en" }]);
      if (/\.rank li$/.test(sel)) return pool("rank", SITES.map(s => ({ id: s.id })));
      if (sel === ".seg button") return pool("seg", ["match", "untapped", "ready"].map(m => ({ m })));
      if (/\.bym$/.test(sel)) return pool("bym", PROFILES.map(p => ({ p })));
      if (sel === "[data-cmp]") return pool("cmp", TARGETS.map(t => ({ cmp: t.id })));
      if (sel === ".mission") return pool("mission", PROFILES.map(id => ({ id })));
      if (sel === ".site-btn") return pool("site", TARGETS.map(t => ({ id: t.id })));
      if (sel === ".body-btn") return pool("body", [{ b: "Moon" }, { b: "Mars" }]);
      return [];
    },
    createElement: n => el(`<${n}>`),
    body: el("body"), documentElement: el("html"), fonts: { load: async () => {} }, activeElement: null,
  };
  const loc = { hash, pathname: "/" };
  const realST = setTimeout;
  const g = {
    document: doc, location: loc, navigator: { language: lang },
    history: { replaceState(_, __, u) { const i = u.indexOf("#"); loc.hash = i < 0 ? "" : u.slice(i); } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: k => delete store[k] },
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ transform: "none", getPropertyValue: n => CSS_VARS[n] ?? "" }),
    addEventListener: (t, f) => (handlers[t] ||= []).push(f),
    setTimeout: fastTimers ? (f, ms, ...a) => realST(f, 0, ...a) : () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: fastTimers ? f => realST(() => f(performance.now() + 1e7), 0) : () => 0,
    performance: { now: () => performance.now() },
    Image: function () { return el("img"); },
    URLSearchParams,
    URL: { createObjectURL: () => "blob:", revokeObjectURL() {} }, Blob: function (parts) { record((parts || []).join(""), "download"); },
    AbortController: function () { return { signal: {}, abort() {} }; },
    fetch: fetchImpl || (async () => { throw new Error("offline"); }),
    Globe: () => () => el("globe"),
    Guide: { init() {}, show() {}, say: t => { record(t, "Guide.say"); return Promise.resolve(); }, idle: () => Promise.resolve(), repeat() {}, hush() {} },
    SFX: new Proxy({ on: false, set() {} }, { get: (o, k) => (k in o ? o[k] : () => {}) }),
    Patch: { paint() {}, drawPatch() {}, certificate: async () => ({}) },
    console: { log() {}, warn() {}, error: (...a) => errors.push(a.join(" ")) },
  };
  const w = loadData(g);
  return { w, texts, errors, handlers, memo, pools, doc, loc, store, run() { script("js/app.js").runInContext(w); return w.TWApp; } };
}
const BAD_TEXT = /undefined|NaN|\[object |Infinity|\bnull\b/;
// out(tag, msg) for a grouped reporter, or out(msg) for a plain fail()
function badTexts(b, tag, out) {
  const seen = new Set();
  for (const [where, t] of b.texts) {
    const m = t.match(BAD_TEXT); if (!m) continue;
    const i = t.search(BAD_TEXT), snip = t.slice(Math.max(0, i - 60), i + 30).replace(/\s+/g, " ");
    const msg = `${where} contains "${m[0]}": …${snip}…`;
    if (seen.has(msg)) continue; seen.add(msg);
    if (out.length >= 2) out(tag, msg); else out(`${tag}: ${msg}`);
  }
  b.texts.length = 0;
}
// the same failure across many target/profile combinations is reported once, with a count
function grouped(fail) {
  const m = new Map();
  return {
    add(tag, msg) { const e = m.get(msg) || { n: 0, first: tag }; e.n++; m.set(msg, e); },
    flush(total) { for (const [msg, e] of m) fail(`${msg}  [${e.n === 1 ? e.first : `${e.n}${total ? "/" + total : ""} cases, e.g. ${e.first}`}]`); },
  };
}
const click = (elm, label) => { if (typeof elm.onclick !== "function") throw new Error(`${label}: no onclick handler`); return elm.onclick({ stopPropagation() {}, preventDefault() {}, target: elm }); };
const ticks = (n = 20) => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : setImmediate(f)); f(); });

await test("6a. app.js boots on the intro screen, and renders every verdict tab for every target × profile (ES + EN)", async ({ fail }) => {
  const b0 = makeBrowser(); b0.run(); if (b0.w.TWApp.state.stage !== "intro") fail(`no hash: stage ${b0.w.TWApp.state.stage}`);
  const g = grouped(fail), total = TARGETS.length * PROFILES.length;
  const tryClick = (tag, elm, label) => { try { click(elm, label); } catch (e) { g.add(tag, `${label} threw: ${e.message}`); } };
  for (const t of TARGETS) for (const p of PROFILES) {
    const tag = `${t.id}/${p}`;
    const b = makeBrowser({ hash: `#t=${t.id}&p=${p}&m=match` });
    try { b.run(); } catch (e) { g.add(tag, `boot threw ${e.message}`); continue; }
    const st = b.w.TWApp.state;
    if (st.stage !== "verdict") { g.add(tag, `deep link did not open the verdict (stage ${st.stage})`); continue; }
    for (const lang of [0, 1]) {
      tryClick(tag, b.pools.get("lang")[lang], "language switch");
      const L = `[${st.lang}]`;
      for (const tab of b.pools.get("tabs")) {
        tryClick(tag, tab, `${L} tab "${tab.dataset.tab}"`);
        if (tab.dataset.tab === "top") tryClick(tag, b.memo.get("#csvBtn"), `${L} CSV export`);
        if (tab.dataset.tab === "evidence") { tryClick(tag, b.memo.get("#mdBtn"), `${L} Markdown card`); tryClick(tag, b.memo.get("#csvAll"), `${L} CSV (all)`); }
      }
      tryClick(tag, b.pools.get("tabs")[0], `${L} tab "verdict"`);
      tryClick(tag, b.memo.get("#certBtn"), `${L} final test (certBtn)`);
      tryClick(tag, b.memo.get("#roleTipBtn"), `${L} roleTipBtn`);
    }
    await ticks(2);
    badTexts(b, tag, g.add);
  }
  g.flush(total);
});
await test("6b. app.js: every Earth site renders as the selected twin (verdict, compare cards, other missions, roles)", async ({ fail }) => {
  const g = grouped(fail);
  for (const role of ["cmd", "geo", "eng"]) for (const t of TARGETS) {
    const tag = `${t.id}/${role}`;
    const b = makeBrowser({ hash: `#t=${t.id}&p=${role === "cmd" ? "balanced" : role === "geo" ? "astrobio" : "habitat"}&m=match`, store: { "ea.crew": JSON.stringify({ name: "Ada", role }) } });
    b.run();
    click(b.pools.get("tabs")[1], "top"); // the Top-10 list binds the row click handlers
    for (const li of b.pools.get("rank") || []) {
      try { click(li, "rank li"); } catch (e) { g.add(`${tag}, ${li.dataset.id}`, `selecting a site threw ${e.message}`); }
      if (role === "cmd") for (const c of b.pools.get("cmp") || []) { // compare card against every destination
        try { click(c, "cmp"); } catch (e) { g.add(`${tag}, ${li.dataset.id} vs ${c.dataset.cmp}`, `compare card threw ${e.message}`); }
      }
      try { click(b.memo.get("#placeBtn"), "placeBtn"); } catch (e) { g.add(`${tag}, ${li.dataset.id}`, `place card threw ${e.message}`); }
    }
    for (const m of b.pools.get("bym") || []) try { click(m, "bym"); } catch (e) { g.add(`${tag} → ${m.dataset.p}`, `switching mission threw ${e.message}`); }
    try { click(b.memo.get("#backMine"), "backMine"); } catch (e) { g.add(tag, `back to my mission threw ${e.message}`); }
    await ticks(2);
    badTexts(b, tag, g.add);
  }
  g.flush();
});

// ---------- 6c. deep links (#t=…&p=…&m=…)
await test("6c. deep-link hash parsing and writing", async ({ fail, check }) => {
  const boot = hash => { const b = makeBrowser({ hash }); let err = null; try { b.run(); } catch (e) { err = e; } return { b, err, st: b.w.TWApp?.state }; };
  // valid link
  let r = boot("#t=mars_gale&p=isru&m=untapped");
  check(!r.err && r.st.stage === "verdict" && r.st.targetId === "mars_gale" && r.st.profile === "isru" && r.st.mode === "untapped", `valid link not applied: ${r.err?.message || JSON.stringify({ stage: r.st?.stage, mode: r.st?.mode })}`);
  // unknown values fall back safely
  for (const h of ["#t=nope&p=balanced", "#t=mars_gale&p=nope", "#t=mars_gale", "#", "#garbage", "#t=&p=&m=", "#t=mars_gale&p=isru&m=bogus", "#t=MARS_GALE&p=isru"]) {
    r = boot(h);
    if (r.err) fail(`hash "${h}" crashed the boot: ${r.err.message}`);
    else if (h.includes("m=bogus")) check(r.st.mode === "match", `hash "${h}": mode ${r.st.mode}`);
    else check(r.st.stage === "intro", `hash "${h}": expected intro, got ${r.st.stage}`);
  }
  // inherited Object properties must not count as profiles
  for (const p of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    r = boot(`#t=moon_shackleton&p=${p}`);
    if (r.err) fail(`hash "#t=moon_shackleton&p=${p}" crashes app.js at boot: ${r.err.message}`);
    else if (r.st.stage !== "intro") fail(`hash p=${p} accepted as a mission profile (stage ${r.st.stage})`);
  }
  // writeHash round trip after changing mode and mission
  r = boot("#t=moon_malapert&p=balanced&m=match");
  click(r.b.pools.get("tabs")[1], "top");
  click(r.b.pools.get("seg")[2], "ready");
  check(r.b.loc.hash === "#t=moon_malapert&p=balanced&m=ready", `after choosing "ready": hash ${r.b.loc.hash}`);
  click(r.b.pools.get("tabs")[0], "verdict");
  click(r.b.pools.get("bym")[2], "bym isru");
  const h = new URLSearchParams(r.b.loc.hash.slice(1));
  check(h.get("t") === "moon_malapert" && h.get("p") === "isru" && h.get("m") === "match", `after switching mission: hash ${r.b.loc.hash}`);
  const again = boot(r.b.loc.hash);
  check(!again.err && again.st.profile === "isru" && again.st.selectedId === r.st.selectedId, "re-opening the written hash does not restore the same view");
  // an invalid hash still greets the visitor on the intro screen
  const bi = makeBrowser({ hash: "#garbage", fastTimers: true }); bi.run(); await ticks(5); await new Promise(res => setTimeout(res, 950));
  if (!bi.texts.some(([w]) => w === "Guide.say")) fail('invalid hash ("#garbage"): intro screen stays, but Vega\'s intro line is never said (app.js only checks !location.hash)');
});

// ---------- 6d. live scan with canned API answers
function fakeApis({ swFill = false, ocean = false } = {}) {
  return async (url) => {
    const u = String(url);
    const json = o => ({ ok: true, json: async () => o });
    if (u.includes("power.larc.nasa.gov")) {
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const p = s => Object.fromEntries([...months.map((m, i) => [m, swFill ? -999 : s - 1 + i / 6]), ["ANN", swFill ? -999 : s]]);
      const ann = v => ({ ANN: v });
      return json({ header: { fill_value: -999 }, geometry: { coordinates: [0, 0, 1200] }, properties: { parameter: {
        T2M: ann(8), T2M_RANGE: ann(15), T2M_MIN: ann(-5), T2M_MAX: ann(25), PRECTOTCORR: ann(0.3), RH2M: ann(30), PS: ann(85),
        ALLSKY_SFC_SW_DWN: p(6), ALLSKY_SFC_UV_INDEX: ann(swFill ? -999 : 2), WS10M: ann(4.2) } } });
    }
    if (u.includes("open-meteo")) return json({ elevation: Array.from({ length: 26 }, (_, i) => (ocean ? -50 : 1200 + i * 30)) });
    if (u.includes("modis.ornl.gov")) return json({ subset: [{ data: [900, 1100, -3000] }] });
    if (u.includes("macrostrat")) return json({ success: { data: [{ name: "Basalt flows", lith: "basalt", descrip: "lava", scale: "small" }] } });
    if (u.includes("/stac/v1/search")) return json({ features: [] });
    if (u.includes("bigdatacloud")) return json({ principalSubdivision: "Región", countryName: "País" });
    throw new Error("unexpected URL " + u);
  };
}
await test("6d. live scan (scanPoint) with canned API answers: fingerprint, ranking and panels stay valid", async ({ fail, check }) => {
  for (const [label, opts] of [["normal", {}], ["POWER returns fill values for solar", { swFill: true }], ["ocean point", { ocean: true }]]) {
    const b = makeBrowser({ hash: "#t=mars_jezero&p=balanced&m=match", fetchImpl: fakeApis(opts) });
    const app = b.run();
    click(b.pools.get("tabs")[5], "scan");
    try { await app.scanPoint(-23.5, -68.2); } catch (e) { fail(`${label}: scanPoint threw ${e.message}`); continue; }
    const st = app.state, sc = st.scan;
    if (opts.ocean) { check(!sc && st.scanError === "ocean", `${label}: expected the ocean error, got scan=${!!sc} error=${st.scanError}`); badTexts(b, label, fail); continue; }
    if (!sc) { fail(`${label}: no scan result (error ${st.scanError})`); continue; }
    TW.KEYS.forEach(k => { const v = sc.fp[k]; if (v != null && !in01(v)) fail(`${label}: scanned fingerprint ${k} = ${v}`); });
    for (const tab of b.pools.get("tabs")) try { click(tab, tab.dataset.tab); } catch (e) { fail(`${label}: tab ${tab.dataset.tab} threw ${e.message}`); }
    badTexts(b, label, fail);
  }
});

// ---------- 6e. the two guided journeys, timers fast-forwarded
async function until(cond, ms = 15000) { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) return false; await new Promise(r => setTimeout(r, 5)); } return true; }
await test("6e. journeys: crew → destination → mission → brief → launch → verdict, and Earth → scan → outbound → mission", async ({ fail, check }) => {
  const rejections = []; const onRej = e => rejections.push(e); process.on("unhandledRejection", onRej);
  try {
    const b = makeBrowser({ fastTimers: true, fetchImpl: fakeApis() }); const app = b.run(), st = app.state;
    click(b.memo.get("#startBtn"), "start"); check(st.stage === "crew", `start → ${st.stage}`);
    click(b.memo.get("#crewGo"), "crewGo"); check(st.stage === "dest", `crewGo → ${st.stage}`);
    click(b.pools.get("body")[1], "Mars"); click(b.pools.get("site").find(x => x.dataset.id === "mars_arcadia"), "site");
    click(b.memo.get("#nextBtn"), "next"); check(st.stage === "mission", `next → ${st.stage}`);
    click(b.pools.get("mission").find(x => x.dataset.id === "isru"), "isru");
    click(b.memo.get("#launchBtn"), "launch"); check(st.stage === "brief" && /^EA-ARC-ISR-\d\d$/.test(st.code), `brief: stage ${st.stage}, code ${st.code}`);
    click(b.memo.get("#acceptBtn"), "accept");
    const out = await until(() => typeof b.memo.get("#outGo")?.onclick === "function");
    if (!out) fail(`launch journey never reached the "outside" photo (stage ${st.stage})`);
    else { click(b.memo.get("#outGo"), "outGo"); await until(() => st.stage === "verdict", 3000); }
    check(st.stage === "verdict", `after the journey: stage ${st.stage}`);
    check(b.loc.hash === `#t=mars_arcadia&p=isru&m=match`, `hash after launch: ${b.loc.hash}`);
    badTexts(b, "launch journey", fail);

    // start from Earth
    const e = makeBrowser({ fastTimers: true, fetchImpl: fakeApis() }); const ea = e.run(), es = ea.state;
    click(e.memo.get("#earthBtn"), "earth"); check(es.stage === "earth", `earthBtn → ${es.stage}`);
    await ea.scanPoint(-23.5, -68.2);
    check(es.scan?.scanned, "earth mode: scan did not produce a site");
    click(e.memo.get("#travelBtn"), "travel");
    const ok = await until(() => typeof e.memo.get("#outGo")?.onclick === "function" && es.stage === "launch");
    if (!ok) fail(`outbound journey never reached the orbital view (stage ${es.stage})`);
    else { click(e.memo.get("#outGo"), "outGo"); await until(() => es.stage === "mission", 3000); }
    if (!(es.stage === "mission" && es.returning === true)) { fail(`after the outbound journey: stage ${es.stage} (expected mission)`); return; }
    click(e.pools.get("mission")[0], "balanced"); click(e.memo.get("#launchBtn"), "launch"); click(e.memo.get("#acceptBtn"), "accept");
    e.memo.get("#outGo").onclick = null;
    const back = await until(() => typeof e.memo.get("#outGo")?.onclick === "function");
    if (back) { click(e.memo.get("#outGo"), "outGo"); await until(() => es.stage === "verdict", 3000); }
    check(es.stage === "verdict", `return journey: stage ${es.stage}`);
    check(es.scan && es.scan.id === "scan" && es.origin === es.scan, "the scanned home place is not part of the final ranking");
    badTexts(e, "Earth journey", fail);
    await ticks(10);
  } finally {
    await ticks(5);
    process.off("unhandledRejection", onRej);
    rejections.forEach(r => fail(`unhandled promise rejection: ${r && r.stack ? r.stack.split("\n").slice(0, 2).join(" | ") : r}`));
  }
});

// ================================================================== 7. other risky bits
await test("7a. astro.js: Earth–Moon and Earth–Mars distances are physical, 2024–2032", ({ check }) => {
  const A = W.Astro;
  for (let d = Date.UTC(2024, 0, 1); d < Date.UTC(2032, 0, 1); d += 5 * 86400000) {
    const m = A.moonKm(new Date(d)), r = A.marsKm(new Date(d));
    check(m > 356000 && m < 407000, `moonKm ${new Date(d).toISOString().slice(0, 10)} = ${m}`);
    check(r > 54.5e6 && r < 401.5e6, `marsKm ${new Date(d).toISOString().slice(0, 10)} = ${r}`);
  }
  // known: Mars opposition 2025-01-16 ≈ 96 million km; Moon perigee 2025-11-05 ≈ 356 800 km
  const op = A.marsKm(new Date(Date.UTC(2025, 0, 12))) / 1e6; check(op > 94 && op < 98, `Mars closest approach 2025-01-12: ${op.toFixed(1)} M km (expected ~96)`);
  const pg = A.moonKm(new Date(Date.UTC(2025, 10, 5, 22))); check(Math.abs(pg - 356833) < 1500, `Moon perigee 2025-11-05: ${pg.toFixed(0)} km (expected ~356 833)`);
});
await test("7b. HTML escaping: data strings that reach innerHTML unescaped are safe", ({ fail, warn }) => {
  // app.js injects some data/i18n strings into innerHTML without esc(); they must not contain markup characters
  const risky = /[<>"]/;
  SITES.forEach(s => { if (risky.test(s.name) || risky.test(s.country)) fail(`site ${s.id}: name/country contains < > or "`); });
  TARGETS.forEach(t => { if (risky.test(t.name)) fail(`target ${t.id}: name contains < > or "`); });
  Object.entries(W.I18N_DATA.name.es).forEach(([id, n]) => { if (risky.test(n)) fail(`I18N_DATA.name.es.${id} contains markup characters`); });
  // the guide line is put in textContent; the profile WHY text goes to innerHTML unescaped
  for (const l of ["es", "en"]) Object.entries(W.I18N_PROFILE_WHY[l]).forEach(([k, v]) => { if (/[<>]/.test(v)) warn(`I18N_PROFILE_WHY.${l}.${k} contains markup`); });
});
await test("7c. guide.js sentence splitter keeps numbers and quotes whole", ({ fail }) => {
  const src = read("js/guide.js"), m = src.match(/const sentences = (t => [^\n]+);/);
  if (!m) { fail("sentences() not found in guide.js"); return; }
  const sentences = vm.runInNewContext(m[1]);
  const cases = [["Están a 403.830 km. Hoy es el día.", 2], ["«Hola.» Seguimos.", 2], ["Mars is 1.52 AU away! Ready?", 2], ["Sin punto final", 1]];
  for (const [t, n] of cases) { const s = sentences(t); if (s.length !== n || s.join("") !== t) fail(`sentences(${JSON.stringify(t)}) -> ${JSON.stringify(s)}`); }
});

// ================================================================== 8. pipeline (cheap, offline)
const PY = ["python", "python3", "py"].find(c => { const r = spawnSync(c, ["-c", "import sys; print(sys.version_info[0])"], { encoding: "utf8" }); return r.status === 0 && r.stdout.trim() === "3"; });
await test("8a. pipeline: every .py file parses (ast, no .pyc written)", ({ fail, warn }) => {
  if (!PY) { warn("no Python 3 on PATH: skipped"); return; }
  const files = fs.readdirSync(R("pipeline")).filter(f => f.endsWith(".py")).map(f => R("pipeline", f));
  const r = spawnSync(PY, ["-B", "-I", "-c", "import ast,sys\nfor f in sys.argv[1:]:\n  ast.parse(open(f,encoding='utf-8').read(), f)", ...files], { encoding: "utf8" });
  if (r.status !== 0) fail(r.stderr.trim().split("\n").slice(-3).join(" | "));
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const third = [...src.matchAll(/^\s*(?:import|from)\s+(\w+)/gm)].map(m => m[1]).filter(x => ["numpy", "requests", "pandas", "PIL", "rasterio", "scipy"].includes(x));
    if (third.length) warn(`${path.basename(f)} imports ${[...new Set(third)].join(", ")} (not stdlib)`);
  }
});
await test("8b. pipeline: geology.geo_axes (Python) == TW.geoAxes (JS) on every cached site", ({ fail, warn }) => {
  if (!PY) { warn("no Python 3 on PATH: skipped"); return; }
  const inputs = SITES.filter(s => s.geo).map(s => ({ id: s.id, geo: s.geo, relief_m: s.relief_m ?? null }));
  // synthetic edge cases: missing pieces, bare/steep, frozen, wet
  inputs.push({ id: "edge_empty", geo: {}, relief_m: null },
    { id: "edge_steep", geo: { worldcover: { bare: 0.9, snow_ice: 0, water: 0 }, palsar: { hv_db: -26 } }, relief_m: 1500 },
    { id: "edge_frozen", geo: { lst: { lst_mean_c: -10 }, worldcover: { bare: 0.2, snow_ice: 0.1, water: 0 } }, relief_m: 100 },
    { id: "edge_wet", geo: { macrostrat: { sediment: 0.1, basalt: 0 }, gsw: { ever_wet: 0.2 } }, relief_m: 10 },
    { id: "edge_nowc", geo: { palsar: { hv_db: -30 }, lst: { lst_mean_c: 5 } }, relief_m: 10 });
  const code = "import sys,json\nsys.path.insert(0, sys.argv[1])\nfrom geology import geo_axes\nd=json.load(sys.stdin)\nprint(json.dumps({x['id']: geo_axes(x['geo'], x['relief_m']) for x in d}))";
  const r = spawnSync(PY, ["-B", "-I", "-c", code, R("pipeline")], { input: JSON.stringify(inputs), encoding: "utf8" });
  if (r.status !== 0) { fail(`python failed: ${r.stderr.trim().split("\n").slice(-2).join(" | ")}`); return; }
  const py = JSON.parse(r.stdout);
  for (const x of inputs) {
    const js = TW.geoAxes(x.geo, x.relief_m), p = py[x.id] || {};
    const keys = new Set([...Object.keys(js), ...Object.keys(p)]);
    for (const k of keys) {
      const a = js[k] == null ? null : Math.round(js[k] * 1000) / 1000, b = p[k] ?? null;
      if (a !== b) fail(`${x.id}: ${k} JS ${a} vs Python ${b}`);
    }
  }
});
await test("8c. pipeline: build_data.summarize / ndvi.barren_from_ndvi agree with the app on a synthetic POWER answer", ({ fail, warn }) => {
  if (!PY) { warn("no Python 3 on PATH: skipped"); return; }
  const code = "import sys,json\nsys.path.insert(0, sys.argv[1])\nimport build_data, ndvi\nraw=json.load(sys.stdin)\nprint(json.dumps({'s': build_data.summarize(raw), 'b': [ndvi.barren_from_ndvi(v) for v in (0.05, 0.3, 0.6, None)]}))";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const P = (ann, mon) => Object.fromEntries([...months.map((m, i) => [m, mon ? mon[i] : ann]), ["ANN", ann]]);
  const raw = { header: { fill_value: -999 }, geometry: { coordinates: [-70, -24, 1261] }, properties: { parameter: {
    T2M: P(17), T2M_RANGE: P(14.7), T2M_MIN: P(-0.6), T2M_MAX: P(32.9), PRECTOTCORR: P(0.02), RH2M: P(44), PS: P(87.5),
    ALLSKY_SFC_SW_DWN: P(7.2, [9.4, 8.9, 7.9, 6.5, 5.2, 4.6, 4.9, 5.9, 7.2, 8.4, 9.1, 9.5]), ALLSKY_SFC_UV_INDEX: P(-999) } } };
  const r = spawnSync(PY, ["-B", "-I", "-c", code, R("pipeline")], { input: JSON.stringify(raw), encoding: "utf8" });
  if (r.status !== 0) { fail(`python failed: ${r.stderr.trim().split("\n").slice(-2).join(" | ")}`); return; }
  const { s, b } = JSON.parse(r.stdout);
  const want = { t2m: 17, t2m_range: 14.7, precip: 0.02, rh: 44, ps: 87.5, sw: 7.2, sw_min: 4.6, sw_max: 9.5, uv: null, grid_elev: 1261 };
  for (const [k, v] of Object.entries(want)) if (s[k] !== v) fail(`summarize: ${k} = ${s[k]}, expected ${v}`);
  const jsB = [0.05, 0.3, 0.6].map(v => Math.round(TW.clamp((0.5 - v) / 0.4) * 1000) / 1000);
  jsB.forEach((v, i) => { if (b[i] !== v) fail(`barren_from_ndvi(${[0.05, 0.3, 0.6][i]}): Python ${b[i]} vs app ${v}`); });
  if (b[3] !== null) fail("barren_from_ndvi(None) should be None");
});

// ------------------------------------------------------------------ summary
const nFail = results.filter(r => r.issues.length).length, nWarn = results.filter(r => !r.issues.length && r.warns.length).length;
console.log(`\n${results.length} checks: ${results.length - nFail - nWarn} passed, ${nWarn} passed with warnings, ${nFail} failed`);
process.exit(nFail ? 1 : 0);
