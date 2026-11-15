// Andes Crossing · app. Two jobs in one map: escape routes with own position (works offline) and turbulence likelihood
// (live when online, refreshed every 15 min). Crew reports close the loop. Reference only, not for navigation.
import * as E from './engine.js';
import * as D from './data.js';
import * as X from './escape.js';
import { buildStyle, addImages, applyTheme, tokens } from './map-style.js';
import * as Scene from './scene3d.js';   // 3D scene: turbulence volumes, onset curtain, route ribbon (hooks marked "3D scene")

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
};
const Kit = () => window.Kit || null;
const reduceMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const zTime = iso => { const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z'); return String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + 'Z'; };
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CAT_WORD = ['Nil', 'Light', 'Moderate', 'Severe'];
const CAT_LETTER = ['N', 'L', 'M', 'S'];
const sw = cat => h('span', { class: 'ac-sw', 'data-cat': cat, 'aria-hidden': 'true' }, CAT_LETTER[cat]);

// Levels: the WAFS levels (DESIGN §4.3). Until the WAFS grids are on the server, each level reads the engine band it sits in.
const LEVELS = [100, 140, 180, 240, 270, 300, 340, 360, 390, 410, 450];
const bandOf = fl => fl < 200 ? 'low' : fl < 300 ? 'mid' : 'high';

const S = {
  fl: Number(localStorage.getItem('ac.fl')) || 390, step: 0, steps: [], model: null, result: [], pair: null,
  metar: {}, metarAt: null, sigmet: null, base: null, airports: null, escape: null, wafs: null,
  aircraft: localStorage.getItem('ac.acft') || 'B788', route: localStorage.getItem('ac.route') || '', plan: null, pairs: [], pairCfg: [],
  gps: null, watch: null, tab: 'crossing', layers: { turb: true, sigmet: true, wafs: true, escape: true, airways: true, navaids: false, crest: true },
};

let map;
boot().catch(err => { console.error(err); status('Could not start the map.', 'red'); });

async function boot() {
  const [base, airports, navaids, crest, airways, escape, pairs] = await Promise.all(
    ['basemap', 'airports', 'navaids', 'crest', 'airways', 'escape-routes', 'pressure-pairs'].map(n => D.staticData(n).catch(() => null)));
  // the operator's escape routes live only on the server (escape-routes.local.json, never in the public repo)
  const local = await D.staticData('escape-routes.local').catch(() => null);
  S.base = base; S.airports = airports; S.escape = local?.routes?.length ? local : escape; S.escSel = localStorage.getItem('ac.escSel') || null; S.crest = crest; S.pairCfg = pairs?.pairs || [];
  const hubs = new Set(['SABE', 'SAEZ']);   // the operator's bases
  airports.features.forEach(f => { const p = f.properties; p.tier = hubs.has(p.icao) ? 1 : p.rank <= 2 ? 2 : 3; p.short = (p.city || p.name || '').slice(0, 22); });

  map = new maplibregl.Map({
    container: 'map', style: buildStyle(base), bounds: [[-84, -56], [-33, 13.5]], fitBoundsOptions: { padding: 48 },
    minZoom: 2, maxZoom: 10, maxPitch: 70, attributionControl: { compact: true }, hash: false, cooperativeGestures: false,
  });
  map.on('styleimagemissing', () => {});
  window.AC = { map, S };   // for support: inspect state from the console
  await new Promise(r => map.on('load', r));
  addImages(map);
  Scene.init(map, tokens);   // 3D scene
  map.getSource('airports').setData(airports);
  map.getSource('navaids').setData(navaids);
  map.getSource('crest').setData(crest);
  if (airways?.features?.length) map.getSource('airways').setData(airways);
  drawEscape();
  await planRoute(S.route, false);
  setLayers();
  wireUi();
  renderAll();
  opening();
  await refresh();
  setInterval(refresh, 15 * 60e3);
  window.addEventListener('online', () => { refresh(); D.flushReports().then(renderReportTab); });
  window.addEventListener('offline', () => status('Offline: showing the last saved data.', 'amber'));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // a new release installed: tell the crew once, the next open uses it (never reload in the middle of a flight)
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('App updated. The new version opens next time.'); }); });
    }).catch(() => {});
  }
}

// ---------- camera ----------
const HERO = { center: [-69.85, -32.95], pitch: 68, bearing: 34 };   // 3D scene: from the south-west, so the onset curtain shows its face and the crossing reads left to right
function heroZoom() { const w = map.getContainer().clientWidth; return w < 680 ? 6.7 : w < 1344 ? 7.3 : 7.5; }
function opening() {
  setTerrain(true);
  const x = S.plan?.crossings?.[0];
  if (!x) { map.fitBounds([[-84, -56], [-52, 12]], { padding: 48, duration: reduceMotion() ? 0 : 1200 }); return; }
  const cam = { ...HERO, center: x.at, zoom: heroZoom() };
  if (reduceMotion()) { map.jumpTo(cam); return; }
  setTimeout(() => map.flyTo({ ...cam, duration: 2800, curve: 1.42, essential: false }), 400);
}
function setTerrain(on) {
  map.setTerrain(on ? { source: 'dem-terrain', exaggeration: Scene.EXAGGERATION } : null);
  Scene.setEnabled(on);   // 3D scene: volumes in the air when on, the flat bands when off
  $('#btn3d').setAttribute('aria-pressed', String(on));
  if (!on) map.easeTo({ pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 600 });
}

// ---------- data refresh ----------
async function refresh() {
  const tasks = [
    D.metars(S.pairCfg.flatMap(p => [p.west, p.east])).then(r => { S.metar = r.data; S.metarAt = r.at; S.metarStale = r.stale; }).catch(() => { S.metarErr = true; }),
    D.sigmets().then(r => { S.sigmet = r.data; S.sigmetAt = r.at; map.getSource('sigmet').setData(r.data); }).catch(() => {}),
    fetch('data/wafs/index.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { S.wafs = j; }).catch(() => {}),
  ];
  const samples = E.crestSamples(S.crest, -24, -50, 1);
  tasks.push(D.crestModel(samples).then(r => { S.model = r.data; S.modelAt = r.at; S.modelStale = r.stale; S.modelErr = null; })
    .catch(e => { S.modelErr = String(e); }));
  await Promise.all(tasks);
  compute();
  renderAll();
  status(navigator.onLine ? null : 'Offline: showing the last saved data.', 'amber');
}

function compute() {
  S.pairs = S.pairCfg.map(c => E.pressurePair(c, S.metar[c.west], S.metar[c.east]));
  S.steps = []; S.result = [];
  if (!S.model?.times?.length) return;
  const now = Date.now();
  const first = Math.max(0, S.model.times.findIndex(t => new Date(t + 'Z').getTime() >= now - 90 * 60e3));
  for (let i = first; i < S.model.times.length && S.steps.length < 13; i += 3) {
    S.steps.push({ i, time: S.model.times[i] });
    S.result.push(E.assessCrest(S.model.at(i), S.pairs));
  }
  S.step = Math.min(S.step, S.steps.length - 1);
}

// ---------- rendering ----------
function renderAll() { renderTurb(); renderLevels(); renderScrub(); renderLegend(); renderTab(); if (S.tab !== 'crossing') renderPeek(); }

function current() { return S.result[S.step] || null; }
function renderTurb() {
  const r = current(), band = bandOf(S.fl);
  const pick = fc => ({ type: 'FeatureCollection', features: (fc?.features || []).filter(f => f.properties.band === band) });
  map.getSource('turb-area').setData(pick(r?.areas)); map.getSource('turb-onset').setData(pick(r?.onset)); map.getSource('turb-end').setData(pick(r?.ends));
  // the route wears its risk: one feature per leg between samples, cat from the bands it passes through (DESIGN §3.2 item 14)
  const line = S.plan?.line || [], risk = r && line.length ? E.routeRisk(line, r.areas, band) : line.map(() => 0);
  map.getSource('route').setData({ type: 'FeatureCollection', features: line.slice(1).map((c, i) => ({ type: 'Feature', properties: { cat: Math.max(risk[i], risk[i + 1]) }, geometry: { type: 'LineString', coordinates: [line[i], c] } })) });
  Scene.update({ result: r, band, fl: S.fl, plan: S.plan, risk });   // 3D scene
  map.getSource('crossing').setData({ type: 'FeatureCollection', features: (S.plan?.crossings || []).map(x => ({ type: 'Feature', properties: { label: 'Andes crest ' + Math.round(x.elev_m / 0.3048).toLocaleString() + ' ft' }, geometry: { type: 'Point', coordinates: x.at } })) });
  // WAFS onset contours for the selected level and time, when the scheduled job has put them on the server
  const st = S.wafs?.steps?.find(s => S.steps[S.step] && s.valid.slice(0, 13) === (S.steps[S.step].time + 'Z').slice(0, 13));
  const lvl = st?.levels?.reduce((a, b) => Math.abs(b - S.fl) < Math.abs(a - S.fl) ? b : a, st.levels[0]);
  if (st && lvl) fetch(`data/wafs/onset-FL${String(lvl).padStart(3, '0')}-f${String(st.f).padStart(2, '0')}.json`).then(r => r.json())
    .then(j => map.getSource('wafs-onset').setData(j)).catch(() => {});
  else map.getSource('wafs-onset').setData({ type: 'FeatureCollection', features: [] });
}

function renderLevels() {
  const el = $('#fl'); el.replaceChildren();
  const r = current();
  for (const fl of [...LEVELS].reverse()) {
    const cat = r ? r.summary[bandOf(fl)].cat : 0;
    const b = h('button', { class: 'ac-fl-stop', role: 'radio', 'aria-checked': String(fl === S.fl), 'aria-label': `FL${fl}, ${CAT_WORD[cat]}`, onclick: () => setFl(fl) },
      'FL' + fl, h('span', { class: 'ac-dot', 'data-cat': cat }));
    el.append(b);
  }
  el.setAttribute('aria-valuenow', S.fl); el.setAttribute('aria-valuetext', 'FL' + S.fl);
}
let flTimer = 0;
function setFl(fl) {
  const el = $('#fl'); if (!el.classList.contains('ac-open') && getComputedStyle(el.querySelector('.ac-fl-stop:not([aria-checked="true"])') || el).display === 'none') {
    el.classList.add('ac-open'); clearTimeout(flTimer); flTimer = setTimeout(() => el.classList.remove('ac-open'), 3000); return; }
  clearTimeout(flTimer); flTimer = setTimeout(() => el.classList.remove('ac-open'), 3000);
  S.fl = fl; localStorage.setItem('ac.fl', fl); haptic(); renderAll(); }

function renderScrub() {
  const el = $('#scrub'); el.replaceChildren();
  if (!S.steps.length) { el.append(h('span', { class: 'ac-cell', 'aria-disabled': 'true' }, S.modelErr ? 'No model' : 'Loading')); return; }
  let lastDay = null;
  S.steps.forEach((s, k) => {
    const d = new Date(s.time + 'Z'), day = DAYS[d.getUTCDay()] + ' ' + d.getUTCDate();
    const cat = S.result[k].summary[bandOf(S.fl)].cat;
    el.append(h('button', { class: 'ac-cell', role: 'radio', 'aria-checked': String(k === S.step), 'aria-label': `${zTime(s.time)} ${day}, ${CAT_WORD[cat]}`, onclick: () => { S.step = k; haptic(); renderAll(); } },
      h('small', {}, day !== lastDay ? day : ' '), zTime(s.time).slice(0, 2) + 'Z', h('span', { class: 'ac-bar4', 'data-cat': cat })));
    lastDay = day;
  });
  el.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderLegend() {
  const el = $('#legend'); el.replaceChildren(h('span', { class: 'k-figure' }, 'FL' + S.fl), ...[0, 1, 2, 3].map(sw));
  el.hidden = !S.layers.turb;
}

// ---------- panel tabs ----------
function renderTab() {
  document.querySelectorAll('.ac-tab').forEach(t => { t.hidden = t.dataset.tab !== S.tab; });
  ({ crossing: renderCrossing, escape: renderEscapeTab, gauge: renderGauge, report: renderReportTab })[S.tab]();
}

function verdict(cat, mog) {
  const word = cat === 0 ? 'unlikely' : mog >= 70 ? 'very likely' : mog >= 45 ? 'likely' : 'possible';
  return `${CAT_WORD[Math.max(cat, 0)]} ${cat === 0 ? '' : word}`.trim() || 'Nil';
}
function confidence() {
  // v0: Medium with a fresh model run, Low on a saved copy. Never High until crew reports calibrate the model.
  if (!S.model || S.modelStale) return { word: 'Low', bars: 1 };
  return { word: 'Medium', bars: 2 };
}

// ---------- route ----------
let WORLD = null;
async function lookup(id) {
  id = id.toUpperCase();
  const local = S.airports.features.find(f => f.properties.icao === id || f.properties.iata === id);
  if (local) return { id: local.properties.icao, coord: local.geometry.coordinates };
  if (!WORLD) WORLD = await D.staticData('airports-world');
  const r = WORLD.rows.find(x => x[0] === id || x[1] === id);
  return r ? { id: r[0], coord: [r[3], r[4]] } : null;
}
async function planRoute(text, redraw = true) {
  S.route = (text || '').toUpperCase().split(/[\s,>→-]+/).filter(Boolean).join(' → ');
  localStorage.setItem('ac.route', S.route);
  $('#routeText').textContent = S.route || 'Plan a crossing';
  S.plan = null;
  const ids = S.route ? S.route.split(' → ') : [];
  if (ids.length >= 2) {
    const pts = await Promise.all(ids.map(lookup)), missing = ids.filter((_, i) => !pts[i]);
    if (missing.length) toast(`Not found: ${missing.join(', ')}. Use ICAO codes.`);
    const ok = pts.filter(Boolean);
    if (ok.length >= 2) {
      const line = E.routeLine(ok.map(p => p.coord), 20);
      S.plan = { ids: ok.map(p => p.id), line, crossings: E.crestCrossings(line, S.crest) };
    }
  }
  if (redraw) { renderAll(); opening(); }
}
function routePop(anchor) {
  const box = h('form', { class: 'ac-form ac-card', onsubmit: async e => { e.preventDefault(); await planRoute(box.querySelector('input').value); Kit()?.pop ? document.querySelector('.k-pop-catcher')?.click() : (box.hidden = true); } },
    h('label', {}, 'Route: departure, waypoints (airports), destination', h('input', { name: 'route', value: S.route.replace(/ → /g, ' '), placeholder: 'SAEZ KMIA', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' })),
    h('p', { class: 'ac-stamp' }, 'Great-circle legs between the points you give. Airways follow once the airway data is loaded.'),
    h('div', { class: 'k-chips' }, ...['SAEZ SCEL', 'SAEZ KMIA', 'SAEZ SPJC', 'SABE SCEL', 'SAEZ SAZS SCTE'].map(r =>
      h('button', { class: 'k-chip', type: 'button', onclick: () => { box.querySelector('input').value = r; } }, r.replace(/ /g, ' → ')))),
    h('button', { class: 'k-btn k-btn-filled k-btn-block', type: 'submit' }, 'Show crossing'));
  const k = Kit(); if (k?.pop) k.pop(box, { anchor, title: 'Route' }); else { document.body.append(box); }
}

function crossingRisk(r, x, band) {
  // the crest sample nearest the crossing, and the worst band the route meets within 150 NM of it
  const pt = r.points.reduce((a, b) => Math.abs(b.coord[1] - x.at[1]) < Math.abs(a.coord[1] - x.at[1]) ? b : a);
  const risk = E.routeRisk(S.plan.line, r.areas, band);
  let cat = 0; S.plan.line.forEach((p, i) => { if (E.nmBetween(p, x.at) <= 150) cat = Math.max(cat, risk[i]); });
  const b = pt.bands[band], pair = S.pairs.find(p => p && !p.missing && x.at[1] >= p.lat[0] && x.at[1] <= p.lat[1]);
  return { pt, cat: Math.max(cat, b.cat), mog: b.mog, pair };
}
const latlon = ([lon, lat]) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}°W`;

function renderPeek() {
  const el = $('#peekline'); el.replaceChildren();
  const r = current(), x = S.plan?.crossings?.[0];
  if (!r || !x) { el.append(S.plan ? 'No Andes crossing on this route' : 'Plan a crossing'); return; }
  const k = crossingRisk(r, x, bandOf(S.fl));
  el.append(sw(k.cat), verdict(k.cat, k.mog), h('small', { class: 'k-figure' }, `FL${S.fl} · ${zTime(S.steps[S.step].time)}`));
}
function renderCrossing() {
  renderPeek();
  const box = $('.ac-tab[data-tab="crossing"]'); box.replaceChildren();
  const r = current(), band = bandOf(S.fl), step = S.steps[S.step];
  box.append(h('p', { class: 'ac-card-head' }, `${S.route || 'No route'} · ${S.aircraft === 'B788' ? '787-8' : 'Global 8000'}`));
  if (!S.plan) {
    box.append(h('div', { class: 'ac-verdict' }, 'Plan a crossing'));
    box.append(h('p', { class: 'k-subhead' }, 'Enter departure and destination. The app finds where the route crosses the Andes and assesses that crossing.'));
    box.append(h('button', { class: 'k-btn k-btn-tinted', onclick: e => routePop(e.currentTarget) }, 'Enter route'));
  } else if (!S.plan.crossings.length) {
    box.append(h('p', { class: 'k-subhead' }, 'This route does not cross the Andes crest.'));
  }
  if (!r) {
    box.append(h('p', { class: 'k-subhead' }, S.modelErr ? 'Could not load the model winds. SIGMETs and the pressure pairs still work.' : 'Loading the forecast…'));
    if (S.modelErr) box.append(h('button', { class: 'k-btn k-btn-tinted', onclick: refresh }, 'Retry'));
  } else {
    const c = confidence(), when = `valid ${zTime(step.time)} ${DAYS[new Date(step.time + 'Z').getUTCDay()]}`;
    for (const x of S.plan?.crossings || []) {
      const k = crossingRisk(r, x, band);
      box.append(h('p', { class: 'ac-card-head k-figure' }, `Crest ${latlon(x.at)} · ${Math.round(x.elev_m / 0.3048).toLocaleString()} ft · FL${S.fl} · ${when}`));
      box.append(h('div', { class: 'ac-verdict' }, sw(k.cat), verdict(k.cat, k.mog)));
      box.append(h('div', { class: 'ac-conf' }, `Confidence: ${c.word}`, h('span', { class: 'ac-bars3', 'aria-hidden': 'true' }, ...[1, 2, 3].map(i => h('i', { class: i <= c.bars ? 'on' : '' })))));
      const mog = k.mog, light = Math.min(98, Math.round(mog + (100 - mog) * 0.45)), sev = Math.round(mog * (k.cat >= 3 ? 0.6 : 0.25));
      const range = v => c.word === 'Low' ? `${Math.max(0, v - 10)}–${Math.min(100, v + 10)}%` : v + '%';
      box.append(h('div', { class: 'ac-probs' }, ...[['Light', light, 'var(--risk-light)'], ['Moderate', mog, 'var(--risk-moderate)'], ['Severe', sev, 'var(--risk-severe)']].flatMap(([n, v, col]) =>
        [h('span', {}, n), h('span', { class: 'ac-prob' }, h('i', { style: `width:${v}%;background:${col}` })), h('span', { class: 'k-figure' }, range(v))])));
      box.append(h('dl', { class: 'ac-pairs' },
        pairItem('500 hPa across the crest', `${Math.abs(k.pt.cross500)} kt from the ${k.pt.cross500 >= 0 ? 'west' : 'east'}`),
        pairItem('Shear FL300–FL390', `${k.pt.shearHi} kt/1000 ft`), pairItem('Jet max', `${k.pt.jet} kt`),
        pairItem('Turbulence reaches', k.pt.reach ? `${k.pt.reach} NM downwind` : '—'),
        k.pair ? pairItem(`ΔQNH ${k.pair.west} − ${k.pair.east}`, `${k.pair.dp > 0 ? '+' : ''}${k.pair.dp} hPa${k.pair.scored ? '' : ' (info)'}`) : pairItem('Pressure pair', 'None near this crossing')));
    }
    const better = S.plan?.crossings?.length ? LEVELS.filter(fl => crossingRisk(r, S.plan.crossings[0], bandOf(fl)).cat < crossingRisk(r, S.plan.crossings[0], band).cat)
      .sort((a, b) => Math.abs(a - S.fl) - Math.abs(b - S.fl))[0] : null;
    if (better) box.append(h('div', { class: 'ac-row' }, h('span', {}, `Smoother at FL${better}`), h('button', { class: 'k-btn k-btn-plain', onclick: () => setFl(better) }, 'Show')));
    // the whole range at this level and time, worst first
    const worst = [...r.points].map(p => ({ lat: p.coord[1], b: p.bands[band] })).filter(p => p.b.cat > 0).sort((a, b) => b.b.mog - a.b.mog).slice(0, 4);
    box.append(h('h3', { class: 'ac-section-title' }, `Along the Andes at FL${S.fl}`));
    if (!worst.length) box.append(h('p', { class: 'k-subhead' }, 'No turbulence band forecast anywhere on the crest at this level and time.'));
    for (const w of worst) box.append(h('div', { class: 'ac-row' }, h('span', {}, sw(w.b.cat), ' ', verdict(w.b.cat, w.b.mog)), h('span', { class: 'k-figure ac-row-sub' }, `${Math.abs(w.lat)}°${w.lat < 0 ? 'S' : 'N'}`)));
    box.append(h('p', { class: 'ac-stamp' }, `GFS (Open-Meteo) fetched ${S.modelAt ? zTime(new Date(S.modelAt).toISOString()) : '—'}${S.modelStale ? ' · saved copy' : ''}. Model ${E.MODEL_VERSION}: rules from the research, not yet calibrated with crew reports.${S.wafs ? ` WAFS run ${zTime(S.wafs.run)}.` : ' WAFS grids not on the server yet.'}`));
  }
  const sigs = (S.sigmet?.features || []).filter(f => f.properties.turb);
  box.append(h('h3', { class: 'ac-section-title' }, 'Turbulence SIGMETs'));
  if (!sigs.length) box.append(h('p', { class: 'k-subhead' }, 'No turbulence or mountain-wave SIGMET in the South American FIRs.'));
  for (const f of sigs) { const p = f.properties;
    box.append(h('div', { class: 'ac-row' }, h('div', { class: 'ac-row-main' }, h('div', { class: 'k-headline' }, `${p.qualifier || ''} ${p.hazard} · ${p.fir}`),
      h('div', { class: 'ac-row-sub k-figure' }, `${p.base != null ? 'FL' + Math.round(p.base / 100) : 'SFC'}–${p.top != null ? 'FL' + Math.round(p.top / 100) : ''} · ${p.from ? zTime(new Date(p.from * 1000).toISOString()) : ''}–${p.to ? zTime(new Date(p.to * 1000).toISOString()) : ''}`)),
      h('button', { class: 'k-btn k-btn-plain', onclick: () => fitFeature(f) }, 'Show'))); }
}
const pairItem = (k, v) => h('div', { class: 'ac-pair' }, h('dt', {}, k), h('dd', { class: 'k-figure' }, v));

// ---------- escape routes + own position ----------
// What to do on each stretch, in colour: the stretch, its escape path and the escape airport share one colour.
let ESC = null;
function drawEscape() {
  ESC = X.toGeoJSON(S.escape, S.aircraft, S.escSel);
  if (ESC.selected) { S.escSel = ESC.selected.id; try { localStorage.setItem('ac.escSel', S.escSel); } catch {} }
  map.getSource('esc-seg').setData(ESC.segments); map.getSource('esc-branch').setData(ESC.branches);
  map.getSource('esc-apt').setData(ESC.airports); map.getSource('esc-dp').setData(ESC.decisions);
}
const escColor = c => c >= 0 ? `var(${X.ESC_TOKENS[c]})` : 'var(--slate)';
const dirWord = d => d === 'EB' ? 'Eastbound' : d === 'WB' ? 'Westbound' : d;
function renderEscapeTab() {
  const box = $('.ac-tab[data-tab="escape"]'); box.replaceChildren();
  box.append(h('div', { class: 'k-seg', id: 'acftSeg' }, h('button', { class: 'k-seg-item', value: 'B788', 'aria-checked': String(S.aircraft === 'B788') }, '787-8'),
    h('button', { class: 'k-seg-item', value: 'GL8T', 'aria-checked': String(S.aircraft === 'GL8T') }, 'Global 8000')));
  segInit($('#acftSeg', box), v => { S.aircraft = v; localStorage.setItem('ac.acft', v); $('#acftText').textContent = v === 'B788' ? '787-8' : 'Global 8000'; S.escSel = null; drawEscape(); renderEscapeTab(); });
  const routes = X.routesFor(S.escape, S.aircraft);
  if (!routes.length) {
    box.append(h('p', { class: 'k-subhead' }, 'No escape routes on this device yet. They load from the server once and then work offline.'));
  } else {
    box.append(h('div', { class: 'k-chips ac-esc-chips' }, ...routes.map(r => h('button', { class: 'k-chip', type: 'button', 'aria-pressed': String(r.id === S.escSel),
      onclick: () => { S.escSel = r.id; drawEscape(); renderEscapeTab(); fitCoords(r.points.map(p => [p.lon, p.lat]).concat(ESC.airports.features.map(f => f.geometry.coordinates))); } },
      `${r.chart} ${r.direction}`))));
  }
  const r = ESC?.selected;
  if (r) {
    if (S.gps) {
      const ins = X.instruction(S.gps, ESC);
      box.append(h('div', { class: 'ac-esc-now', style: ins && !ins.offRoute ? `--esc:${escColor(ins.color)}` : '' },
        h('div', { class: 'ac-row-sub' }, 'Now'),
        ins && !ins.offRoute ? [h('div', { class: 'k-title2' }, ins.airport ? `${ins.type === 'return' ? 'Return' : ins.type === 'continue' ? 'Continue' : 'Turn'} to ${ins.airport}` : 'Turn west to the coast'),
          h('div', { class: 'k-subhead' }, `${ins.from} – ${ins.to} · ${ins.toNext} NM to ${ins.to}`)]
          : h('div', { class: 'k-subhead' }, ins?.off != null ? `${ins.off} NM from ${r.chart}: off the charted route.` : 'Position not on this chart.')));
    }
    box.append(h('h3', { class: 'ac-section-title' }, `${r.chart} · ${dirWord(r.direction)} · ${r.aircraft === 'B788' ? '787-8' : 'Global 8000'}`));
    box.append(h('p', { class: 'ac-row-sub' }, h('span', { class: 'k-chip' }, r.approval ? 'Approved proof' : 'Proof, not yet approved'), ' ', r.approval || ''));
    for (const sg of r.segments) {
      const a = sg.action || {}, c = ESC.colors[a.airport] ?? 5;
      box.append(h('div', { class: 'ac-esc-seg', style: `--esc:${escColor(c)}` },
        h('div', { class: 'ac-esc-head' }, h('span', { class: 'ac-esc-sw', 'aria-hidden': 'true' }), h('b', { class: 'k-figure' }, `${sg.from} – ${sg.to}`),
          h('span', { class: 'ac-esc-to' }, a.airport ? `→ ${a.airport}${a.alternate ? ' / ' + a.alternate : ''}` : '→ coast')),
        h('p', { class: 'k-subhead' }, a.text), a.levels ? h('p', { class: 'ac-row-sub k-figure' }, a.levels) : null));
    }
    for (const n of r.notes || []) box.append(h('p', { class: 'ac-stamp' }, n));
    for (const q of r.questions || []) box.append(h('p', { class: 'ac-stamp' }, 'To confirm: ' + q));
    box.append(h('p', { class: 'ac-stamp' }, `Proof chart ${r.proof_date}. Fix positions from the printed airway distances; dotted paths are schematic.`));
  }
  const pend = (S.escape?.pending || []).filter(q => q.aircraft === S.aircraft);
  if (pend.length) { box.append(h('h3', { class: 'ac-section-title' }, 'Charts to come'));
    for (const q of pend) box.append(h('div', { class: 'ac-esc-seg' }, h('b', {}, `${q.chart} · ${q.direction}`), h('p', { class: 'k-subhead' }, q.status),
      q.string ? h('p', { class: 'ac-mono' }, q.string) : null, q.note ? h('p', { class: 'ac-stamp' }, q.note) : null)); }
  if (S.escape?.missing?.length) box.append(h('p', { class: 'ac-stamp' }, 'Missing: ' + S.escape.missing.join(' · ')));
  box.append(h('h3', { class: 'ac-section-title' }, 'Own position'));
  if (!S.gps) box.append(h('p', { class: 'k-subhead' }, S.watch ? 'Waiting for GPS…' : 'Turn on the position button on the map. On iPad it uses the device GPS (cellular models) or a connected GPS receiver.'));
  else {
    const g = S.gps;
    box.append(h('dl', { class: 'ac-pairs' }, pairItem('Position', fmtPos(g.lat, g.lon)), pairItem('GPS altitude', g.alt != null ? Math.round(g.alt / 0.3048).toLocaleString() + ' ft' : '—'),
      pairItem('Track / speed', g.track != null ? `${Math.round(g.track)}°T / ${Math.round((g.speed || 0) * 1.94384)} kt` : '—'), pairItem('Accuracy', `±${Math.round(g.acc)} m`),
      pairItem('Crest', `${Math.round(distToCrest(g))} NM`)));
    box.append(h('p', { class: 'ac-stamp' }, `GPS fix ${zTime(new Date(g.t).toISOString())}`));
  }
}
const fmtPos = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
function nmBetween([lo1, la1], [lo2, la2]) { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.sqrt(a)); }
function distToCrest(g) { return Math.min(...S.crest.geometry.coordinates.map(c => nmBetween([g.lon, g.lat], c))); }
function toggleGps() {
  if (S.watch != null) { navigator.geolocation.clearWatch(S.watch); S.watch = null; S.gps = null; map.getSource('ownship').setData({ type: 'FeatureCollection', features: [] }); $('#btnGps').setAttribute('aria-pressed', 'false'); renderTab(); return; }
  if (!navigator.geolocation) { toast('This device has no position service.'); return; }
  $('#btnGps').setAttribute('aria-pressed', 'true');
  let first = true;
  S.watch = navigator.geolocation.watchPosition(p => {
    const c = p.coords; S.gps = { lat: c.latitude, lon: c.longitude, alt: c.altitude, acc: c.accuracy, track: c.heading, speed: c.speed, t: p.timestamp };
    map.getSource('ownship').setData({ type: 'Feature', properties: { track: c.heading || 0 }, geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] } });
    if (first) { first = false; map.easeTo({ center: [c.longitude, c.latitude], zoom: Math.max(map.getZoom(), 6.5), duration: reduceMotion() ? 0 : 600 }); }
    if (S.tab === 'escape' || S.tab === 'report') renderTab();
  }, e => { toast(e.code === 1 ? 'Position permission was refused.' : 'No GPS position yet.'); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
}

// ---------- gauge: the pressure pairs along the range ----------
function renderGauge() {
  const box = $('.ac-tab[data-tab="gauge"]'); box.replaceChildren();
  box.append(h('p', { class: 'k-subhead' }, 'QNH on the Pacific side minus QNH on the east side, for station pairs across the range. A large positive value means strong westerly flow over the crest.'));
  const xLat = S.plan?.crossings?.[0]?.at[1];
  for (const p of S.pairs) {
    if (!p) continue;
    const near = xLat != null && xLat >= p.lat[0] && xLat <= p.lat[1];
    const w = S.metar[p.west], e = S.metar[p.east];
    box.append(h('h3', { class: 'ac-section-title' }, `${p.name}${near ? ' · on your route' : ''}`));
    box.append(h('div', { class: 'ac-tiles' },
      h('div', { class: 'ac-tile' }, h('span', {}, `${p.west} QNH`), h('b', { class: 'k-figure' }, w ? w.qnh + ' hPa' : '—'), h('span', { class: 'k-figure' }, w ? `${w.temp} °C · ${zTime(w.time)}` : 'No METAR')),
      h('div', { class: 'ac-tile' }, h('span', {}, `${p.east} QNH`), h('b', { class: 'k-figure' }, e ? e.qnh + ' hPa' : '—'), h('span', { class: 'k-figure' }, e ? `${e.temp} °C · ${zTime(e.time)}` : 'No METAR'))));
    if (!p.missing) box.append(h('dl', { class: 'ac-pairs' }, pairItem(`ΔQNH ${p.west} − ${p.east}`, `${p.dp > 0 ? '+' : ''}${p.dp} hPa`), pairItem('ΔT east warmer', `${p.dt > 0 ? '+' : ''}${p.dt} °C`)));
    box.append(h('p', { class: 'ac-stamp' }, p.rule ? `${p.rule}. 8 hPa: ${p.flags?.dp8 ? 'met' : 'not met'} · 5 °C: ${p.flags?.dt5 ? 'met' : 'not met'}.` : 'No published threshold for this pair: shown for information, not used in the score.'));
  }
  box.append(h('p', { class: 'ac-stamp' }, 'No pair north of 21°S: the altiplano and sierra stations report QNH reduced from 3,000–4,000 m, which does not compare with a coastal QNH. North of there the score uses the model winds only.'));
}

// ---------- crew report ----------
function renderReportTab() {
  const box = $('.ac-tab[data-tab="report"]'); if (S.tab !== 'report') return; box.replaceChildren();
  const r = current(), fc = r ? r.summary[bandOf(S.fl)] : null;
  const nowIso = new Date().toISOString().slice(0, 16);
  const seg = (name, opts, sel) => h('div', { class: 'k-seg', 'data-name': name }, ...opts.map(([v, t]) => h('button', { class: 'k-seg-item', value: v, type: 'button', 'aria-checked': String(v === sel) }, t)));
  const form = h('form', { class: 'ac-form', onsubmit: e => { e.preventDefault(); sendReport(form, fc); } },
    h('p', { class: 'k-subhead' }, 'Tell us what you met crossing. Each report tunes the forecast for our two aircraft.'),
    h('label', {}, 'What did you feel?', seg('felt', [['nil', 'Smooth'], ['light', 'Light'], ['moderate', 'Moderate'], ['severe', 'Severe']], '')),
    h('label', {}, `The app said ${fc ? CAT_WORD[fc.cat].toLowerCase() : 'nothing (no forecast)'} at FL${S.fl}. Was it right?`, seg('verdict', [['correct', 'Right'], ['partly', 'Partly'], ['wrong', 'Wrong']], '')),
    h('div', { class: 'ac-two' },
      h('label', {}, 'Flight level', h('input', { name: 'fl', type: 'number', min: 0, max: 510, step: 10, value: S.fl, required: true, inputmode: 'numeric' })),
      h('label', {}, 'Time (UTC)', h('input', { name: 'obs_time', type: 'datetime-local', value: nowIso, required: true }))),
    h('label', {}, 'Cause, if you know it', h('select', { name: 'cause' }, ...[['unknown', 'Not sure'], ['mountain_wave', 'Mountain wave'], ['cat', 'Clear air / jet'], ['rotor', 'Rotor, low level'], ['convective', 'Convective']].map(([v, t]) => h('option', { value: v }, t)))),
    h('label', {}, 'Route', h('input', { name: 'route', value: S.route.replace(/\s*→\s*/, ' '), maxlength: 80 })),
    h('p', { class: 'ac-stamp' }, S.gps ? `Position from GPS: ${fmtPos(S.gps.lat, S.gps.lon)}` : 'No GPS position: the report is filed without coordinates.'),
    h('label', {}, 'Note (optional)', h('textarea', { name: 'note', maxlength: 500 })),
    h('button', { class: 'k-btn k-btn-filled k-btn-block', type: 'submit' }, 'Send report'),
    h('p', { class: 'ac-stamp' }, D.pendingReports() ? `${D.pendingReports()} report(s) waiting for a connection.` : 'Reports send now, or later when the device is back online.'));
  form.querySelectorAll('.k-seg').forEach(s => segInit(s));
  box.append(form);
}
async function sendReport(form, fc) {
  const fd = new FormData(form), segv = n => form.querySelector(`.k-seg[data-name="${n}"] [aria-checked="true"]`)?.value;
  const rep = { felt: segv('felt'), verdict: segv('verdict'), fl: Number(fd.get('fl')), obs_time: fd.get('obs_time') + ':00Z', cause: fd.get('cause'),
    route: fd.get('route'), note: fd.get('note'), aircraft: S.aircraft, forecast: fc ? ['nil', 'light', 'moderate', 'severe'][fc.cat] : null,
    lat: S.gps?.lat ?? null, lon: S.gps?.lon ?? null, model: E.MODEL_VERSION };
  if (!rep.felt || !rep.verdict) { toast('Pick what you felt and whether the forecast was right.'); return; }
  const res = await D.queueReport(rep);
  toast(res.left ? 'Saved. It sends when the device is online.' : 'Report sent. Thank you.', { kind: 'success' });
  renderReportTab();
}

// ---------- UI wiring ----------
function wireUi() {
  segInit($('.ac-tabs'), v => { S.tab = v; renderTab(); });
  $('#btn3d').onclick = () => { const on = !map.getTerrain(); setTerrain(on);
    if (on) map.easeTo({ pitch: HERO.pitch, bearing: HERO.bearing, duration: reduceMotion() ? 0 : 600 }); };   // 3D scene: back to the pitched view
  $('#btnAndes').onclick = () => { const x = S.plan?.crossings?.[0];
    if (x) map.flyTo({ ...HERO, center: x.at, zoom: heroZoom(), duration: reduceMotion() ? 0 : 600 });
    else map.fitBounds([[-84, -56], [-52, 12]], { padding: 48, pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 600 }); };
  $('#btnGps').onclick = toggleGps;
  $('#btnLayers').onclick = e => { const card = $('#layersCard'); const k = Kit(); if (k?.pop) k.pop(card, { anchor: e.currentTarget, title: 'Layers' }); else card.hidden = !card.hidden; };
  $('#routeBtn').onclick = e => routePop(e.currentTarget);
  $('#acftText').textContent = S.aircraft === 'B788' ? '787-8' : 'Global 8000';
  document.querySelectorAll('#layersCard input[data-layer]').forEach(i => { i.checked = S.layers[i.dataset.layer]; i.onchange = () => { S.layers[i.dataset.layer] = i.checked; setLayers(); renderLegend(); }; });
  const themeSeg = $('#themeSeg');
  themeSeg.querySelectorAll('.k-seg-item').forEach(b => b.setAttribute('aria-checked', String(b.value === document.documentElement.getAttribute('data-theme'))));
  segInit(themeSeg, v => { document.documentElement.setAttribute('data-theme', v); try { localStorage.setItem('solidaire.theme', v); } catch {} applyTheme(map, S.base); Scene.retheme(); });   // 3D scene follows the theme
  $('#btnOffline').onclick = saveOffline;
  map.on('click', 'airport', e => airportPopup(e.features[0]));
  map.on('click', 'airport-label', e => airportPopup(e.features[0]));
  map.on('click', 'turb-fill', e => { const p = e.features[0].properties; new maplibregl.Popup({ closeButton: true }).setLngLat(e.lngLat)
    .setHTML(`<b>${CAT_WORD[p.cat]}</b> · FL band ${bandOf(S.fl) === 'low' ? '100–200' : bandOf(S.fl) === 'mid' ? '200–300' : '300–450'}<br>Moderate-or-worse ${p.mog}% (uncalibrated)<br>500 hPa across range ${p.cross500} kt`).addTo(map); });
  for (const id of ['airport', 'airport-label', 'turb-fill']) { map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', id, () => map.getCanvas().style.cursor = ''); }
  // one-column bottom panel: tap the grabber to step peek → medium → large
  const heights = ['calc(var(--ac-peek) + var(--sa-bottom))', '50dvh', 'calc(100dvh - var(--sa-top) - 56px)']; let hi = 0;
  $('.ac-grabber').onclick = () => { hi = (hi + 1) % 3; document.documentElement.style.setProperty('--ac-sheet-h', heights[hi]); };
  $('#fl').addEventListener('keydown', e => { const i = LEVELS.indexOf(S.fl); if (e.key === 'ArrowUp' && i < LEVELS.length - 1) setFl(LEVELS[i + 1]); if (e.key === 'ArrowDown' && i > 0) setFl(LEVELS[i - 1]); });
  window.addEventListener('shell:pose', () => map.resize());
}
function setLayers() {
  const vis = (ids, on) => ids.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
  vis(['turb-fill', 'turb-hatch', 'turb-end', 'turb-onset-glow', 'turb-onset', 'turb-onset-label'], S.layers.turb);
  vis(['wafs-onset'], S.layers.wafs); vis(['sigmet-fill', 'sigmet-line', 'sigmet-label'], S.layers.sigmet);
  vis(['esc-other', 'esc-seg-casing', 'esc-seg', 'esc-branch', 'esc-branch-schematic', 'esc-branch-label', 'esc-apt', 'esc-dp'], S.layers.escape);
  vis(['airway-casing', 'airway', 'airway-label'], S.layers.airways); vis(['navaid'], S.layers.navaids); vis(['crest'], S.layers.crest);
  Scene.setLayers({ turb: S.layers.turb });   // 3D scene: after the flat layers, so it can hide the ones it replaces
}
function segInit(el, onChange) {
  const k = Kit(); if (k?.seg) { k.seg(el, { onChange: v => onChange && onChange(v) }); return; }
  el.querySelectorAll('.k-seg-item').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.k-seg-item').forEach(n => n.setAttribute('aria-checked', String(n === b))); onChange && onChange(b.value); }));
}
// ---------- airport weather: METAR and TAF (DESIGN §4.3 airport detail) ----------
const fmtVis = v => v == null ? '—' : String(v).includes('+') ? '10 km or more' : (() => { const m = Number(v) * 1609.34; return m >= 9999 ? '10 km or more' : m >= 5000 ? (m / 1000).toFixed(0) + ' km' : (Math.round(m / 100) * 100).toLocaleString() + ' m'; })();
const fmtWind = (d, s, g) => s == null ? '—' : s === 0 ? 'Calm' : `${d === 'VRB' || d == null ? 'VRB' : String(d).padStart(3, '0') + '°'} / ${s}${g ? 'G' + g : ''} kt`;
const fmtClouds = cs => !cs?.length ? '—' : cs.map(c => c.base != null ? `${c.cover} ${String(Math.round(c.base / 100)).padStart(3, '0')}${c.type || ''}` : c.cover).join(' ');
const zDay = sec => { const d = new Date(sec * 1000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`; };
const ageMin = iso => Math.round((Date.now() - new Date(iso).getTime()) / 60000);
function airportCard(p) {
  const card = h('div', { class: 'ac-card ac-apt' },
    h('div', { class: 'ac-apt-head' }, h('span', { class: 'ac-pop-icao k-figure' }, p.icao), p.iata ? h('span', { class: 'ac-row-sub' }, p.iata) : null, h('span', { class: 'k-chip ac-cat', hidden: true })),
    h('div', { class: 'k-headline' }, p.name), h('div', { class: 'ac-row-sub' }, `${p.city || ''} · Elevation ${Number(p.elev_ft).toLocaleString()} ft`),
    h('h3', { class: 'ac-section-title' }, 'METAR'), h('div', { class: 'ac-metar' }, h('div', { class: 'k-bone', style: 'height:4rem;border-radius:var(--r-small)' })),
    h('h3', { class: 'ac-section-title' }, 'TAF'), h('div', { class: 'ac-taf' }, h('div', { class: 'k-bone', style: 'height:6rem;border-radius:var(--r-small)' })),
    h('div', { class: 'ac-apt-actions' },
      h('button', { class: 'k-btn k-btn-tinted', type: 'button', onclick: () => setEnd(p.icao, 0) }, 'Set as departure'),
      h('button', { class: 'k-btn k-btn-tinted', type: 'button', onclick: () => setEnd(p.icao, 1) }, 'Set as destination')));
  D.metars([p.icao]).then(r => {
    const m = r.data[p.icao], box = card.querySelector('.ac-metar'); box.replaceChildren();
    if (!m) { box.append(h('p', { class: 'k-subhead' }, `No METAR for ${p.icao}.`)); return; }
    const age = ageMin(m.time), old = age > 90;
    if (m.cat) { const c = card.querySelector('.ac-cat'); c.hidden = false; c.textContent = m.cat; }
    box.append(h('div', { class: 'ac-apt-qnh' }, h('b', { class: 'k-figure', style: old ? 'color:var(--slate)' : '' }, `${m.qnh} hPa`),
      h('span', { class: old ? 'k-chip' : 'ac-row-sub k-figure' }, `${zTime(m.time)} · ${old ? 'Old · ' : ''}${age < 120 ? age + ' min' : Math.floor(age / 60) + ' h ' + age % 60 + ' min'} ago`)),
      h('dl', { class: 'ac-pairs' }, pairItem('Wind', fmtWind(m.wdir, m.wspd, m.wgst)), pairItem('Visibility', fmtVis(m.vis)),
        pairItem('Cloud', / CAVOK /.test(m.raw || '') ? 'CAVOK' : fmtClouds(m.clouds)), pairItem('Temp / dew', `${m.temp} / ${m.dew} °C`), m.wx ? pairItem('Weather', m.wx) : null),
      h('p', { class: 'ac-mono' }, m.raw));
  }).catch(() => { const box = card.querySelector('.ac-metar'); box.replaceChildren(h('p', { class: 'k-subhead' }, 'METAR not available offline.')); });
  D.taf(p.icao).then(r => {
    const t = r.data, box = card.querySelector('.ac-taf'); box.replaceChildren();
    if (!t) { box.append(h('p', { class: 'k-subhead' }, `No TAF for ${p.icao}.`)); return; }
    box.append(h('p', { class: 'ac-row-sub k-figure' }, `Issued ${zTime(t.issued)} · valid ${zDay(t.from)}–${zDay(t.to)}`));
    for (const f of t.periods) {
      const tag = f.change === 'BASE' ? 'From' : f.change === 'PROB' || f.prob ? `PROB${f.prob || ''}${f.change && f.change !== 'PROB' ? ' ' + f.change : ''}` : f.change;
      box.append(h('div', { class: 'ac-taf-row' }, h('span', { class: 'ac-taf-tag k-figure' }, tag), h('span', { class: 'ac-taf-time k-figure' }, `${zDay(f.from)}–${zDay(f.to)}`),
        h('span', { class: 'ac-taf-body' }, [f.wspd != null ? fmtWind(f.wdir, f.wspd, f.wgst) : null, f.vis != null ? fmtVis(f.vis) : null, f.wx, f.clouds.length ? fmtClouds(f.clouds) : null, f.vv ? `VV${String(f.vv / 100).padStart(3, '0')}` : null].filter(Boolean).join(' · ') || 'No change listed')));
    }
    box.append(h('p', { class: 'ac-mono' }, t.raw));
  }).catch(() => { const box = card.querySelector('.ac-taf'); box.replaceChildren(h('p', { class: 'k-subhead' }, 'TAF not available offline.')); });
  return card;
}
function setEnd(icao, which) {
  const ids = S.route ? S.route.split(' → ') : [];
  if (which === 0) ids[0] = icao; else { if (!ids.length) ids.push(''); ids[Math.max(1, ids.length - 1)] = icao; }
  planRoute(ids.filter(Boolean).join(' '));
  document.querySelector('.k-pop-catcher')?.click(); aptPopup?.remove();
}
let aptPopup = null, aptAnchor = null;
function airportPopup(f) {
  const p = f.properties, card = airportCard(p), k = Kit(), pt = map.project(f.geometry.coordinates);
  aptPopup?.remove();
  if (k?.pop) {
    aptAnchor?.remove();
    aptAnchor = h('div', { style: `position:absolute;left:${pt.x}px;top:${pt.y}px;width:1px;height:1px;pointer-events:none`, 'aria-hidden': 'true' });
    $('.ac-stage').append(aptAnchor);
    k.pop(card, { anchor: aptAnchor, title: `${p.icao} weather`, onClose: () => { aptAnchor?.remove(); aptAnchor = null; } });
  } else {
    aptPopup = new maplibregl.Popup({ maxWidth: '360px' }).setLngLat(f.geometry.coordinates).setDOMContent(card).addTo(map);
  }
}
function fitCoords(cs) { const b = cs.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(cs[0], cs[0])); map.fitBounds(b, { padding: 80, pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 600 }); }
function fitFeature(f) { fitCoords(f.geometry.coordinates[0]); }
function saveOffline() {
  const urls = [], tile = (lon, lat, z) => [Math.floor((lon + 180) / 360 * 2 ** z), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z)];
  for (let z = 2; z <= 9; z++) { const [x0, y0] = tile(-76, -26, z), [x1, y1] = tile(-64, -40, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`); }
  if (!navigator.serviceWorker?.controller) { toast('Offline saving starts after the app reloads once.'); return; }
  navigator.serviceWorker.controller.postMessage({ type: 'precache-tiles', urls });
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'precache-progress' && e.data.done === e.data.total) toast(`Saved ${e.data.total} terrain tiles for offline use.`, { kind: 'success' }); });
  toast(`Saving ${urls.length} terrain tiles of the central Andes…`);
}
function status(text, tone) { const el = $('#status'); el.replaceChildren(); if (text) el.append(h('span', { class: 'k-chip', 'data-k-tone': tone || '' }, text)); }
function toast(text, o) { const k = Kit(); if (k?.toast) k.toast(text, o); else status(text); }
function haptic() { try { Kit()?.shell?.haptic?.('selection'); } catch {} }
