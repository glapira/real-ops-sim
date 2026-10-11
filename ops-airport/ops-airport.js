/* =====================================================================
   OPS AIRPORT  ·  a 3D ops room built as a small airport
   ---------------------------------------------------------------------
   Gates = teams, aircraft = work items, the tower = the brain,
   the radar = Jarvis's sweep, the hangar = the code workshop,
   the fleet stands = your own aircraft.

   Reads the same two feeds as the current ops room:
     ops_room  { now, next_run_at, clocks, usage, agents[], departures[], arrivals[], feed[] }
     ops_graph { at, nodes[], edges[] }
   No AI calls and no network calls of its own: the host page fetches
   and hands the JSON over with update() / updateGraph().

   API
     const room = OpsAirport.mount(el, {
       THREE,              // optional, else window.THREE (r150+)
       lang: 'en'|'es',
       theme: 'light'|'dark'|'auto',
       tz: 'Europe/Madrid',
       fleet: [{ reg, type: 'b787'|'global', label }],
       onOpen(link, what)  // called when a row, node or flight with a link is opened
     });
     room.update(opsRoomJson);   room.updateGraph(opsGraphJson);
     room.setTheme('dark');      room.unmount();
   ===================================================================== */
(function (root) {
'use strict';

/* ---------------------------------------------------------------- i18n */
const STR = {
  en: {
    title: 'Ops room', live: 'Live', replay: 'Replay', overview: 'Overview', gates: 'Gates', brain: 'Brain', workshop: 'Workshop',
    runway: 'Runway', fleet: 'Fleet', landside: 'Landside', search: 'Search people, flights, aircraft',
    onShift: 'Working now', today: 'Done today', usage: 'Usage', h5: '5 h', week: 'Week', cap: 'cap',
    resting: 'resting', off: 'off', working: 'working', runs: 'runs', items: 'items',
    team: 'Team', arrivals: 'Arrivals', departures: 'Departures', feed: 'Messages', nothing: 'Nothing here yet',
    nextRun: 'Next sweep', local: 'Local', madrid: 'Madrid', weather: 'Weather', time: 'Light',
    auto: 'Auto', day: 'Day', night: 'Night', clear: 'Clear', rain: 'Rain', fog: 'Fog', calima: 'Calima', storm: 'Storm',
    steps: ['On block', 'Read', 'Check', 'Book', 'File', 'Pushback'],
    turnaround: 'Turnaround', model: 'Model', state: 'State', task: 'Now', last: 'Last', schedule: 'Shift',
    open: 'Open', close: 'Close', tour: 'Tour', gate: 'Gate', stand: 'Stand', status: 'Status', from: 'Agent',
    brainTitle: 'Jarvis brain', brainSub: 'Cards, people, notes and documents the agents read', nodes: 'nodes', links: 'links', hot: 'touched in the last 3 h',
    sweepNow: 'Jarvis is sweeping', sweepIdle: 'Radar idle', list: 'List', reset: 'Reset view',
    flight: 'Flight', aircraft: 'Aircraft', vehicle: 'Vehicle', at: 'Time', due: 'Due', sample: 'Sample',
    st: { Queued: 'Queued', Inbound: 'Inbound', Landed: 'Landed', 'Taxi in': 'Taxi in', 'On block': 'On block', Read: 'Reading', Check: 'Checking', Book: 'Booking', File: 'Filing', Pushback: 'Pushback', 'Taxi out': 'Taxi out', Departed: 'Departed' },
    teams: { cloud: 'Cloud · Jarvis', ledger: 'Ledger AI', mac: 'Mac', code: 'Code team' },
    veh: { tug: 'Pushback tug', bag: 'Page loader', fuel: 'Ledger bowser', cater: 'Check lift', van: 'Jarvis sweep van' },
    vehWhat: { tug: 'Pushes finished work out of the gate', bag: 'Unloads the pages of a document', fuel: 'Books the figures into the ledger', cater: 'Lifts the item up for a second look', van: 'Drives the apron while Jarvis sweeps mail, cards and contracts' },
    teamWhat: { cloud: 'Mail, contracts and second opinions, swept from the cloud', ledger: 'Reads documents and answers inside the ledger', mac: 'PDF filing, backup, vault and memory', code: 'Builds and fixes AeroLedger itself' }
  },
  es: {
    title: 'Sala de operaciones', live: 'En vivo', replay: 'Repetición', overview: 'Vista general', gates: 'Puertas', brain: 'Cerebro', workshop: 'Taller',
    runway: 'Pista', fleet: 'Flota', landside: 'Lado tierra', search: 'Buscar personas, vuelos, aviones',
    onShift: 'Trabajando', today: 'Hecho hoy', usage: 'Uso', h5: '5 h', week: 'Semana', cap: 'tope',
    resting: 'en pausa', off: 'fuera', working: 'trabajando', runs: 'tandas', items: 'elementos',
    team: 'Equipo', arrivals: 'Llegadas', departures: 'Salidas', feed: 'Mensajes', nothing: 'Nada por ahora',
    nextRun: 'Próximo barrido', local: 'Local', madrid: 'Madrid', weather: 'Tiempo', time: 'Luz',
    auto: 'Auto', day: 'Día', night: 'Noche', clear: 'Despejado', rain: 'Lluvia', fog: 'Niebla', calima: 'Calima', storm: 'Tormenta',
    steps: ['En calzos', 'Leído', 'Revisión', 'Asiento', 'Archivo', 'Remolque'],
    turnaround: 'Escala', model: 'Modelo', state: 'Estado', task: 'Ahora', last: 'Último', schedule: 'Turno',
    open: 'Abrir', close: 'Cerrar', tour: 'Recorrido', gate: 'Puerta', stand: 'Puesto', status: 'Estado', from: 'Agente',
    brainTitle: 'Cerebro de Jarvis', brainSub: 'Fichas, personas, notas y documentos que leen los agentes', nodes: 'nodos', links: 'enlaces', hot: 'tocados en las últimas 3 h',
    sweepNow: 'Jarvis está barriendo', sweepIdle: 'Radar en espera', list: 'Lista', reset: 'Restablecer vista',
    flight: 'Vuelo', aircraft: 'Avión', vehicle: 'Vehículo', at: 'Hora', due: 'Vence', sample: 'Ejemplo',
    st: { Queued: 'En cola', Inbound: 'En aproximación', Landed: 'Aterrizado', 'Taxi in': 'Rodando', 'On block': 'En calzos', Read: 'Leyendo', Check: 'Revisando', Book: 'Asentando', File: 'Archivando', Pushback: 'Remolque', 'Taxi out': 'Rodando a pista', Departed: 'Despegado' },
    teams: { cloud: 'Nube · Jarvis', ledger: 'IA del libro', mac: 'Mac', code: 'Equipo de código' },
    veh: { tug: 'Tractor de remolque', bag: 'Cargador de páginas', fuel: 'Cisterna del libro', cater: 'Elevador de revisión', van: 'Furgoneta de Jarvis' },
    vehWhat: { tug: 'Saca de la puerta el trabajo terminado', bag: 'Descarga las páginas de un documento', fuel: 'Asienta las cifras en el libro', cater: 'Sube el elemento para una segunda mirada', van: 'Recorre la plataforma mientras Jarvis barre correo, fichas y contratos' },
    teamWhat: { cloud: 'Correo, contratos y segundas opiniones desde la nube', ledger: 'Lee documentos y responde dentro del libro', mac: 'Archivo de PDF, copia, bóveda y memoria', code: 'Construye y arregla AeroLedger' }
  }
};
const STEP_KEYS = ['On block', 'Read', 'Check', 'Book', 'File', 'Pushback'];

/* gates per team */
const TEAMS = [
  { team: 'cloud',  id: 'A', x: -54, color: '#0A84FF' },
  { team: 'ledger', id: 'B', x: -24, color: '#FF9F0A' },
  { team: 'mac',    id: 'C', x: 24,  color: '#BF5AF2' },
  { team: 'code',   id: 'D', x: 54,  color: '#30D158' }
];
const FLIGHT_PREFIX = { A: 'JRV', B: 'LDG', C: 'MAC', D: 'DEV' };
const TYPE_OF_AGENT = { jarvis: 'mail', 'contract-desk': 'contract', 'second-opinion': 'contract', reader: 'invoice', assistant: 'invoice', 'mac-clerk': 'file', 'memory-curator': 'file' };

let cssInjected = false;

function mount(container, opts) {
  opts = opts || {};
  const T = opts.THREE || root.THREE;
  if (!T) throw new Error('OpsAirport needs three.js (pass opts.THREE or load window.THREE)');
  const lang = STR[opts.lang] ? opts.lang : 'en';
  const L = STR[lang];
  const tz = opts.tz || 'Europe/Madrid';
  const isPhone = Math.min(window.innerWidth, window.innerHeight) < 560 || /iPhone|Android/i.test(navigator.userAgent);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alive = { on: true };
  const disposables = [];
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => { if (alive.on) fn(); }, ms); timers.push(id); return id; };

  /* ======================================================== DATA MODEL */
  const D = {
    room: null, graph: null, agents: [], byId: new Map(), items: [], seen: new Set(), replayIdx: 0,
    live: false, log: [], seq: 100
  };
  const teamOf = t => TEAMS.find(g => g.team === t) || TEAMS[0];
  const gateById = id => TEAMS.find(g => g.id === id);
  const txt = (o, k) => (lang === 'es' && o && o[k + '_es']) ? o[k + '_es'] : (o ? o[k] : '');

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function typeOf(what, agentId, team) {
    const w = (what || '').toLowerCase();
    if (/invoice|factura|payment|pago|bank|banco|statement|extracto|swift|fuel|combustible/.test(w)) return 'invoice';
    if (/contract|contrato|sign|firm|nda|agreement|acuerdo|offer|oferta/.test(w)) return 'contract';
    if (/pdf|backup|copia|vault|bóveda|archiv|memory|memoria/.test(w)) return 'file';
    if (team === 'code') return 'code';
    return TYPE_OF_AGENT[agentId] || (team === 'ledger' ? 'invoice' : team === 'mac' ? 'file' : 'mail');
  }
  function makeItem(src, kind) {
    const agentId = src.agent || (kind === 'arrival' ? 'jarvis' : null);
    const ag = agentId && D.byId.get(agentId);
    const team = ag ? ag.team : 'cloud';
    const gate = teamOf(team);
    const key = kind + '|' + (src.at || src.due || '') + '|' + (src.what || '');
    const n = hashStr(key) % 900 + 100;
    return {
      key, id: FLIGHT_PREFIX[gate.id] + ' ' + n, what: txt(src, 'what') || '', link: src.link || null,
      at: src.at || null, due: src.due || null, agent: agentId, team, gate: gate.id,
      type: typeOf(src.what, agentId, team), status: 'Queued', step: -1, stepAt: [], kind, replay: false
    };
  }
  function ingest(room) {
    const first = !D.room;
    D.room = room;
    // agents
    const list = Array.isArray(room.agents) ? room.agents : [];
    list.forEach(a => {
      let cur = D.byId.get(a.id);
      if (!cur) { cur = { id: a.id }; D.byId.set(a.id, cur); D.agents.push(cur); cur.isNew = true; }
      const wasWorking = cur.state === 'working';
      Object.assign(cur, a);
      if (!TEAMS.some(t => t.team === cur.team)) cur.team = 'code';
      cur.justStarted = !first && !wasWorking && a.state === 'working';
    });
    // feed + arrivals become flights; on first load only the latest few, the rest wait as replay stock
    const incoming = [];
    (room.arrivals || []).forEach(a => incoming.push(makeItem(a, 'arrival')));
    (room.feed || []).forEach(f => incoming.push(makeItem(f, 'feed')));
    incoming.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const fresh = incoming.filter(it => !D.seen.has(it.key));
    fresh.forEach(it => D.seen.add(it.key));
    D.stock = incoming.slice(-40);
    if (first) {
      fresh.slice(-5).forEach(it => queue(it));
      D.live = false;
    } else {
      fresh.forEach(it => queue(it));
      if (fresh.length) D.live = true;
    }
    W && W.onAgents && W.onAgents();
    UI && UI.render();
  }
  function queue(it) {
    if (D.items.filter(i => i.status === 'Queued').length > 8) return;
    D.items.push(it); D.log.unshift({ at: clockStr(), text: `${it.id} · ${it.what}`, kind: 'info' }); D.log.length = Math.min(D.log.length, 60);
  }
  function replayOne() {
    const stock = D.stock || [];
    if (!stock.length) return;
    const src = stock[D.replayIdx % stock.length]; D.replayIdx++;
    const it = Object.assign({}, src, { key: src.key + '#' + D.replayIdx, status: 'Queued', step: -1, stepAt: [], replay: true });
    D.items.push(it);
  }
  function clockStr(d, zone) {
    try { return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { timeZone: zone || tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d || new Date()); }
    catch (e) { const x = d || new Date(); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }
  }

  /* ======================================================== DOM SHELL */
  injectCss();
  const host = document.createElement('div');
  host.className = 'oa';
  host.setAttribute('data-oa-theme', resolveTheme(opts.theme));
  host.innerHTML = `<canvas class="oa-canvas" aria-label="${L.title}"></canvas><div class="oa-vignette" aria-hidden="true"></div><div class="oa-ui"></div><div class="oa-tip" hidden></div>`;
  container.appendChild(host);
  const canvas = host.querySelector('canvas');
  const uiRoot = host.querySelector('.oa-ui');
  const tip = host.querySelector('.oa-tip');
  function resolveTheme(t) {
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ======================================================== WORLD */
  let W = null, UI = null;
  W = buildWorld();
  UI = buildUI();
  if (opts.data) ingest(opts.data);
  if (opts.graph) W.setGraph(opts.graph);

  /* -------------------------------------------------------------------- */
  function buildWorld() {
  const P = {
    grass: 0xcbd5b8, apron: 0xdcd9d2, taxi: 0xc8c5be, runway: 0x6c7076, mark: 0xf7f5f0,
    terminal: 0xf5f3ef, glass: 0x9fc4d6, roof: 0xe4ded4, steel: 0xb4b9c0, tower: 0xf3f0ea,
    yellow: 0xf2c14e, tug: 0xf2c14e, fuel: 0x5b8def, road: 0x8b8e93, tree: 0x86a872, trunk: 0x8b6b4a,
    skin: [0xf1c7a3, 0xd9a07a, 0xa8714f, 0x7b4a32, 0xf6d8bf],
    shirt: { A: 0x0a84ff, B: 0xff9f0a, C: 0xbf5af2, D: 0x30d158 },
    livery: { mail: 0x0a84ff, invoice: 0xff9f0a, contract: 0xbf5af2, code: 0x30d158, file: 0xc8823c },
    node: { card: 0x30d158, party: 0x0a84ff, note: 0xbf5af2, doc: 0xc8823c, person: 0x64d2ff, other: 0xffd60a }
  };

  const renderer = new T.WebGLRenderer({ canvas, antialias: !isPhone || window.devicePixelRatio < 2, powerPreference: 'high-performance', alpha: false });
  const DPR = Math.min(window.devicePixelRatio || 1, isPhone ? 1.75 : 2);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  disposables.push(renderer);

  const scene = new T.Scene();
  scene.background = new T.Color(0xdfe8ee);
  scene.fog = new T.Fog(0xdfe8ee, 380, 900);
  const camera = new T.PerspectiveCamera(30, 1, 1, 3000);

  // r155+ lights are physical; scale so both old and new builds look alike
  const LS = (T.REVISION && +T.REVISION >= 155) ? Math.PI : 1;
  const hemi = new T.HemisphereLight(0xfff6ea, 0xb9c2b0, 0.9 * LS); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1dc, 1.4 * LS);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -200; sc.right = 200; sc.top = 150; sc.bottom = -150; sc.near = 10; sc.far = 800;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);
  const flash = new T.AmbientLight(0xc8d6ff, 0); scene.add(flash);

  /* ---------- helpers ---------- */
  const matCache = new Map();
  function mat(color, o) {
    const key = color + JSON.stringify(o || {});
    if (matCache.has(key)) return matCache.get(key);
    const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0 }, o || {}));
    matCache.set(key, m); return m;
  }
  function mesh(geo, m, x, y, z, cast = true, recv = true) { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = cast; o.receiveShadow = recv; return o; }
  function box(w, h, d, c, x, y, z, o) { return mesh(new T.BoxGeometry(w, h, d), typeof c === 'object' ? c : mat(c, o), x, y, z); }
  function flat(w, d, c, x, y, z) { const m = box(w, 0.12, d, c, x, y, z); m.castShadow = false; return m; }
  function cyl(rt, rb, h, c, x, y, z, seg = 16) { return mesh(new T.CylinderGeometry(rt, rb, h, seg), typeof c === 'object' ? c : mat(c), x, y, z); }
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
  function roundedPath(pts, r = 6, y = 0) {
    const path = new T.CurvePath();
    const P3 = pts.map(p => V(p[0], y, p[1]));
    let prev = P3[0].clone();
    for (let i = 1; i < P3.length - 1; i++) {
      const a = P3[i - 1], b = P3[i], c = P3[i + 1];
      const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
      const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
      const p1 = b.clone().sub(d1.normalize().multiplyScalar(rr));
      const p2 = b.clone().add(d2.normalize().multiplyScalar(rr));
      if (prev.distanceTo(p1) > 0.01) path.add(new T.LineCurve3(prev, p1));
      path.add(new T.QuadraticBezierCurve3(p1, b.clone(), p2));
      prev = p2;
    }
    path.add(new T.LineCurve3(prev, P3[P3.length - 1]));
    path._len = path.getLength();
    return path;
  }
  function line(a, b) { const c = new T.LineCurve3(a, b); c._len = c.getLength(); return c; }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  }
  const GLOW = glowTexture();
  function glow(color, size, opacity = 1) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
    s.scale.set(size, size, 1); return s;
  }
  const pickables = [];
  function pickable(obj, info) { obj.userData.pick = info; pickables.push(obj); return obj; }

  /* ================================================== LAYOUT
     x east, z south (toward the viewer), y up.
     Runway z = -66, taxiway z = -48, stands z = -24,
     terminal z = -4..14 with the tower in the middle, landside z > 18. */
  const RWY_Z = -66, TWY_Z = -48, STAND_Z = -24;
  const HANGAR = { x: 104, z: -12 };
  const TOWER = { x: 0, z: 6 };
  const world = new T.Group(); scene.add(world);

  /* ---------- painted surfaces (canvas textures) ---------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  const texScale = isPhone ? 0.5 : 1;
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = Math.round(w * texScale); c.height = Math.round(h * texScale);
    const x = c.getContext('2d'); x.scale(texScale, texScale); draw(x, w, h);
    const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso); return t;
  }
  function speckle(x, w, h, n, colors, alpha, size = 2) {
    for (let i = 0; i < n; i++) { x.globalAlpha = alpha * (0.3 + Math.random() * 0.7); x.fillStyle = colors[i % colors.length]; const s = 0.6 + Math.random() * size; x.fillRect(Math.random() * w, Math.random() * h, s, s); }
    x.globalAlpha = 1;
  }
  // a flat ground plane that tiles its texture every `tile` world units
  const surfMats = [];
  function surface(tex, w, d, x, y, z, tileW, tileD, rotY = 0, wet = true) {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / tileW, d / (tileD || tileW));
    const m = new T.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0 });
    if (wet) surfMats.push(m);
    const o = new T.Mesh(new T.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.rotation.z = rotY; o.position.set(x, y, z); o.receiveShadow = true;
    world.add(o); return o;
  }
  const TEX = {
    grass: canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#a9c288'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.035)'; x.fillRect(0, 0, w / 2, h);           // mowing stripes
      speckle(x, w, h, 2600, ['#94ad76', '#bcd09d', '#a2bb80', '#86a06a'], 0.55, 2.2);
    }),
    concrete: canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#d6d3cc'; x.fillRect(0, 0, w, h);
      const n = 8, sz = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = Math.floor(Math.random() * 10 - 5); x.fillStyle = `rgb(${214 + v},${211 + v},${204 + v})`; x.fillRect(i * sz, j * sz, sz, sz); }
      speckle(x, w, h, 5000, ['#c4c0b8', '#e2dfd9', '#b9b5ad'], 0.5, 1.6);
      x.globalAlpha = 0.08; x.fillStyle = '#5a5248';
      for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 6 + Math.random() * 16, Math.random() * 3, 0, Math.PI * 2); x.fill(); }
      x.globalAlpha = 1; x.strokeStyle = 'rgba(120,112,100,0.45)'; x.lineWidth = 1.4;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * sz, 0); x.lineTo(i * sz, h); x.stroke(); x.beginPath(); x.moveTo(0, i * sz); x.lineTo(w, i * sz); x.stroke(); }
    }),
    taxi: canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = '#7d8086'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 1800, ['#6d7076', '#8f9298', '#5f6268'], 0.6, 1.4);
      x.fillStyle = '#f2c14e'; x.fillRect(0, h / 2 - 1.5, w, 3);                       // centreline
      x.fillStyle = 'rgba(242,193,78,0.9)'; x.fillRect(0, 3, w, 1.5); x.fillRect(0, h - 4.5, w, 1.5);   // edge lines
    }),
    road: canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = '#6f7277'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 1600, ['#62656a', '#7e8186', '#55585d'], 0.6, 1.4);
      x.fillStyle = '#f2f0ea'; for (let i = 0; i < w; i += 64) x.fillRect(i, h / 2 - 1, 34, 2);
      x.fillRect(0, 4, w, 1.4); x.fillRect(0, h - 5.4, w, 1.4);
    }),
    floor: canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#f1ece3'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 2500, ['#e3dccf', '#faf7f1', '#d9d0c1', '#c9bfae'], 0.6, 1.5);
      x.strokeStyle = 'rgba(160,148,130,0.25)'; x.lineWidth = 1; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
    })
  };
  // the runway is painted as one long texture: asphalt, edge and centre lines,
  // threshold piano keys, designators, touchdown zone and aiming point marks
  const RWY = { x0: -158, x1: 138, w: 12 };
  function runwayTexture() {
    const L = RWY.x1 - RWY.x0, W = RWY.w, ppu = 14;
    return canvasTex(L * ppu, W * ppu, (x, w, h) => {
      const u = v => v * ppu;
      x.fillStyle = '#5c6066'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 26000, ['#50545a', '#6a6e74', '#474a50', '#73777d'], 0.55, 1.8);
      // rubber in the touchdown zones
      [[6, 40], [L - 46, L - 6]].forEach(([a, b]) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0.3, 'rgba(25,25,28,0)'); g.addColorStop(0.5, 'rgba(25,25,28,0.35)'); g.addColorStop(0.7, 'rgba(25,25,28,0)'); x.fillStyle = g; x.fillRect(u(a), 0, u(b - a), h); });
      x.fillStyle = '#f4f3ee';
      x.fillRect(0, u(0.45), w, u(0.35)); x.fillRect(0, h - u(0.8), w, u(0.35));   // edge lines
      for (let v = 22; v < L - 22; v += 9) x.fillRect(u(v), h / 2 - u(0.18), u(4.6), u(0.36));
      [[2, 1], [L - 11, -1]].forEach(([s0]) => { for (let k = 0; k < 8; k++) { if (k === 3 || k === 4) continue; x.fillRect(u(s0), u(1.3 + k * 1.2), u(9), u(0.7)); } });
      // designators, read from the approach
      x.save(); x.font = `800 ${u(4.2)}px -apple-system, "Helvetica Neue", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.translate(u(15.5), h / 2); x.rotate(Math.PI / 2); x.fillText('09', 0, 0); x.restore();
      x.save(); x.font = `800 ${u(4.2)}px -apple-system, "Helvetica Neue", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.translate(u(L - 15.5), h / 2); x.rotate(-Math.PI / 2); x.fillText('27', 0, 0); x.restore();
      // touchdown zone pairs and aiming points
      [[30, 1], [L - 30, -1]].forEach(([s0, dir]) => {
        for (let k = 0; k < 3; k++) { const vx = s0 + dir * k * 10; [2.0, h / ppu - 2.0 - 0.5].forEach(z => { x.fillRect(u(vx - 2), u(z) - u(0.25), u(4), u(0.5)); x.fillRect(u(vx - 2), u(z) + u(0.55) * (z < 6 ? 1 : -1) - u(0.25), u(4), u(0.5)); }); }
        const ax = s0 + dir * 16; x.fillRect(u(ax - 4), u(2.2), u(8), u(1.4)); x.fillRect(u(ax - 4), h - u(3.6), u(8), u(1.4));
      });
    });
  }

  /* ---------- ground ---------- */
  {
    const g = new T.Mesh(new T.PlaneGeometry(1400, 1100), (() => { const t = TEX.grass.clone(); t.needsUpdate = true; t.repeat.set(1400 / 44, 1100 / 44); return new T.MeshStandardMaterial({ map: t, roughness: 0.95 }); })());
    g.rotation.x = -Math.PI / 2; g.position.set(0, -0.02, -10); g.receiveShadow = true; world.add(g);
    surface(TEX.concrete, 196, 40, 0, 0.06, -26, 40);                      // main apron
    surface(TEX.concrete, 48, 54, HANGAR.x, 0.07, -24, 40);                 // hangar apron
    surface(TEX.concrete, 58, 34, -105, 0.07, -27, 40);                     // fleet apron
    surface(TEX.taxi, 256, 8, -6, 0.09, TWY_Z, 32, 8);                       // taxiway
    surface(TEX.taxi, 22, 9, -122, 0.1, (RWY_Z + TWY_Z) / 2, 32, 9, Math.PI / 2);
    surface(TEX.taxi, 22, 9, 96, 0.1, (RWY_Z + TWY_Z) / 2, 32, 9, Math.PI / 2);
    const rt = runwayTexture(); rt.wrapS = rt.wrapT = T.ClampToEdgeWrapping;
    const rm = new T.MeshStandardMaterial({ map: rt, roughness: 0.82 }); surfMats.push(rm);
    const rw = new T.Mesh(new T.PlaneGeometry(RWY.x1 - RWY.x0, RWY.w), rm); rw.rotation.x = -Math.PI / 2; rw.position.set((RWY.x0 + RWY.x1) / 2, 0.12, RWY_Z); rw.receiveShadow = true; world.add(rw);
    // stand markings
    TEAMS.forEach(g => { world.add(flat(0.35, 22, P.yellow, g.x, 0.15, -36)); world.add(flat(5, 0.35, P.yellow, g.x, 0.15, -18.6)); world.add(flat(16, 0.25, 0xd9473a, g.x, 0.15, -13.2)); });
    [-112, -88].forEach(x => world.add(flat(0.35, 20, P.yellow, x, 0.15, -32)));
    world.add(flat(190, 0.3, 0xf4f3ee, 0, 0.15, -10.8));                    // service road edge
    surface(TEX.road, 430, 9, 0, 0.06, 34, 32, 9, 0, false);
    surface(TEX.concrete, 118, 8, 0, 0.07, 22.8, 40, 40, 0, false);
    world.add(box(118, 0.4, 1.2, 0xf0ede6, 0, 0.2, 18.2));
    [[-94, 54], [94, 54]].forEach(([x, z]) => {
      world.add(flat(72, 22, 0xb2b4b7, x, 0.06, z));
      for (let i = -6; i <= 6; i++) { world.add(flat(0.2, 7, P.mark, x + i * 5, 0.14, z - 6)); world.add(flat(0.2, 7, P.mark, x + i * 5, 0.14, z + 6)); }
    });
  }

  /* ---------- sky dome, hills and clouds ---------- */
  const skyU = { top: { value: new T.Color(0x8fb7dc) }, mid: { value: new T.Color(0xe3ebf0) }, sunDir: { value: new T.Vector3(0.5, 0.5, 0.5) }, sunCol: { value: new T.Color(0xfff1dc) }, glowK: { value: 0.4 } };
  const sky = new T.Mesh(new T.SphereGeometry(1600, 32, 16), new T.ShaderMaterial({
    uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glowK; varying vec3 vDir; void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(mid, top, pow(h, 0.55)); float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 24.0) * 0.6 + pow(s, 4.0) * 0.18) * glowK; gl_FragColor = vec4(c, 1.0); }'
  }));
  sky.renderOrder = -10; scene.add(sky);
  const hillMat = new T.MeshStandardMaterial({ color: 0x9db08f, roughness: 1, flatShading: true });
  {
    const segs = 96, rows = 3, pos = [], idx = [];
    const rnd = (() => { let s = 99; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let r = 0; r <= rows; r++) for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2, rad = 560 + r * 140;
      const hgt = r === 0 ? -2 : (20 + 60 * rnd()) * (r / rows) * (0.6 + 0.4 * Math.sin(a * 3 + 1.3)) + (a > 3.6 && a < 5.2 ? 70 * (r / rows) : 0);
      pos.push(Math.cos(a) * rad, hgt, Math.sin(a) * rad - 10);
    }
    for (let r = 0; r < rows; r++) for (let i = 0; i < segs; i++) { const a = r * segs + i, b = r * segs + (i + 1) % segs, c = a + segs, d = b + segs; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new T.Mesh(g, hillMat));
  }
  const clouds = [];
  {
    const cg = new T.IcosahedronGeometry(1, 1), cm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 14; i++) {
      const grp = new T.Group(); const n = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) { const m = new T.Mesh(cg, cm); const sz = 9 + Math.random() * 12; m.scale.set(sz * 1.4, sz * 0.7, sz); m.position.set((k - n / 2) * 11 + Math.random() * 6, Math.random() * 5, Math.random() * 10 - 5); grp.add(m); }
      const a = Math.random() * Math.PI * 2, r = 330 + Math.random() * 260;
      grp.position.set(Math.cos(a) * r, 70 + Math.random() * 70, Math.sin(a) * r - 60); world.add(grp); clouds.push(grp);
    }
    clouds.mat = cm;
  }

  /* ---------- edge lights (instanced) ---------- */
  const edgeMats = []; let edgeGlow = null;
  const pools = [];
  function lightPool(w, d, color, x, z, y = 0.22) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: GLOW, color, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 2; world.add(m); pools.push(m); return m;
  }
  {
    const pts = [];
    for (let x = -152; x <= 132; x += 8) { pts.push([x, RWY_Z - 6.4, 0]); pts.push([x, RWY_Z + 6.4, 0]); }
    for (let x = -130; x <= 118; x += 10) { pts.push([x, TWY_Z - 4.4, 1]); pts.push([x, TWY_Z + 4.4, 1]); }
    for (let i = -5; i <= 5; i++) { pts.push([-156, RWY_Z + i * 1.1, 2]); pts.push([136, RWY_Z + i * 1.1, 3]); }
    const geo = new T.SphereGeometry(0.34, 8, 6);
    [0xfff4d6, 0x4ea3ff, 0x52e07a, 0xff4a4a].forEach((c, gi) => {
      const list = pts.filter(p => p[2] === gi);
      const m = new T.MeshBasicMaterial({ color: c }); edgeMats.push({ m, c });
      const im = new T.InstancedMesh(geo, m, list.length); const o = new T.Object3D();
      list.forEach((p, i) => { o.position.set(p[0], 0.35, p[1]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      world.add(im);
    });
    // the same lights as soft glows for the night
    const gp = new Float32Array(pts.length * 3), gc = new Float32Array(pts.length * 3), cc = new T.Color();
    pts.forEach((p, i) => { gp.set([p[0], 0.5, p[1]], i * 3); cc.setHex([0xfff1c8, 0x4ea3ff, 0x52e07a, 0xff4a4a][p[2]]); gc.set([cc.r, cc.g, cc.b], i * 3); });
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(gp, 3)); gg.setAttribute('color', new T.BufferAttribute(gc, 3));
    edgeGlow = new T.Points(gg, new T.PointsMaterial({ map: GLOW, size: 3.2, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    world.add(edgeGlow);
  }
  // approach light glow bars (night)
  const approachGlows = [];
  for (let i = 1; i <= 7; i++) { const s = glow(0xfff1c8, 4, 0); s.position.set(-156 - i * 7, 0.6, RWY_Z); world.add(s); approachGlows.push(s); }

  /* ---------- terminal wings (cut-away roof) ---------- */
  const windowMats = [];
  function terminalWing(x0, x1) {
    const w = x1 - x0, cx = (x0 + x1) / 2, g = new T.Group();
    g.add(box(w, 0.6, 18, P.terminal, cx, 0.3, 5));
    { const t = TEX.floor.clone(); t.needsUpdate = true; t.repeat.set((w - 1) / 12, 16.6 / 12);
      const fl = new T.Mesh(new T.PlaneGeometry(w - 1, 16.6), new T.MeshStandardMaterial({ map: t, roughness: 0.5 })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.63, 5); fl.receiveShadow = true; g.add(fl); }
    g.add(box(w + 1, 0.3, 3.4, P.roof, cx, 4.95, -5.3));                                   // airside canopy
    g.add(box(w, 0.4, 0.66, 0xff9f0a, cx, 4.3, 13.72));                                     // brand band on the landside wall
    for (let x = x0 + 1; x < x1; x += 4) g.add(box(0.25, 3.4, 0.5, 0xd8d2c7, x, 2.4, 14.1)); // facade fins
    g.add(box(w, 4.2, 0.6, P.terminal, cx, 2.4, 13.7));
    const glassM = new T.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1 });
    g.add(mesh(new T.BoxGeometry(w, 3.6, 0.2), glassM, cx, 2.4, -3.8, false, false));
    for (let x = x0; x <= x1 + 0.01; x += 6) g.add(box(0.35, 4.2, 0.35, P.steel, x, 2.4, -3.8));
    g.add(box(w, 0.5, 0.8, P.roof, cx, 4.6, -3.7)); g.add(box(w, 0.5, 0.8, P.roof, cx, 4.6, 13.7));
    [x0, x1].forEach(x => g.add(box(0.6, 4.2, 18, P.terminal, x, 2.4, 5)));
    for (let x = x0 + 6; x < x1 - 1; x += 12) g.add(box(0.5, 0.4, 18, P.roof, x, 4.8, 5));
    const winM = new T.MeshStandardMaterial({ color: 0x334455, emissive: 0xffc777, emissiveIntensity: 0, roughness: 0.4 }); windowMats.push(winM);
    for (let x = x0 + 3; x < x1 - 2; x += 4) g.add(mesh(new T.BoxGeometry(2.4, 1.6, 0.1), winM, x, 2.6, 14.05, false, false));
    return g;
  }
  world.add(terminalWing(-72, -8)); world.add(terminalWing(8, 72));
  // team rugs, gate seating and plants inside the cut-away terminal
  {
    const floorC = new T.Color(0xf1ece3);
    TEAMS.forEach(g => { if (g.id === 'D') return; const rug = new T.Mesh(new T.PlaneGeometry(14.5, 10.5), new T.MeshStandardMaterial({ color: floorC.clone().lerp(new T.Color(g.color), 0.2), roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(g.x, 0.66, 5.4); rug.receiveShadow = true; world.add(rug); });
    const seatG = new T.BoxGeometry(0.8, 0.9, 0.8), seats = []; 
    TEAMS.forEach(g => { if (g.id === 'D') return; for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) seats.push([g.x - 9 + i * 0.95 - 8, -1.7 + r * 1.3]); });
    const sm = new T.InstancedMesh(seatG, mat(0x3b4a5e), seats.length); const o = new T.Object3D();
    seats.forEach(([x, z], i) => { o.position.set(x + 8, 1.1, z); o.updateMatrix(); sm.setMatrixAt(i, o.matrix); }); sm.castShadow = true; world.add(sm);
    const potG = new T.CylinderGeometry(0.5, 0.4, 0.8, 10), leafG = new T.IcosahedronGeometry(0.9, 0);
    [[-70, 12], [-10, 12], [10, 12], [70, 12], [-70, -2], [70, -2], [-6, -2], [6, -2]].forEach(([x, z]) => { world.add(mesh(potG, mat(0xd8cbb5), x + (x < 0 ? 1.2 : -1.2), 1.0, z)); const l = mesh(leafG, mat(0x6f9a5c, { flatShading: true }), x + (x < 0 ? 1.2 : -1.2), 2.0, z); l.scale.set(1, 1.3, 1); world.add(l); });
  }
  /* ---------- split-flap boards on the landside roof: departures and arrivals ---------- */
  const boards = [];
  function makeBoard(kind, x) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const tex = new T.CanvasTexture(c); if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = Math.min(8, maxAniso);
    const grp = new T.Group(); grp.position.set(x, 0, 14.4);
    grp.add(box(25.2, 9.8, 0.6, 0x23272e, 0, 9.9, -0.35));
    const face = new T.Mesh(new T.PlaneGeometry(24, 9), new T.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.set(0, 9.9, 0.0); grp.add(face);
    [-9, 9].forEach(px => grp.add(box(0.5, 1.4, 0.5, 0x5c636d, px, 4.7, -0.3)));
    world.add(grp); pickable(grp, { kind: 'board', id: kind === 'dep' ? 'departures' : 'arrivals' });
    const b = { kind, c, x: c.getContext('2d'), tex, grp }; boards.push(b); return b;
  }
  const BOARD_TXT = lang === 'es'
    ? { dep: 'SALIDAS', arr: 'LLEGADAS', time: 'HORA', item: 'ASUNTO', status: 'ESTADO', over: 'VENCIDO', board: 'EMBARQUE', sched: 'PROGRAM.', landed: 'LLEGADO', done: 'HECHO', none: 'SIN MOVIMIENTOS' }
    : { dep: 'DEPARTURES', arr: 'ARRIVALS', time: 'TIME', item: 'ITEM', status: 'STATUS', over: 'OVERDUE', board: 'BOARDING', sched: 'SCHEDULED', landed: 'LANDED', done: 'DONE', none: 'NO MOVEMENTS' };
  function dayKey(d) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch (e) { return d.toISOString().slice(0, 10); } }
  function flapText(x, str, px, py, n, col) {
    const cw = 21.5, ch = 38; str = String(str || '').toUpperCase().slice(0, n).padEnd(n, ' ');
    for (let i = 0; i < n; i++) {
      const cx = px + i * cw; x.fillStyle = '#191d24'; x.fillRect(cx, py - ch + 8, cw - 2.5, ch);
      x.fillStyle = '#0b0d11'; x.fillRect(cx, py - ch / 2 + 7, cw - 2.5, 1.6);
      x.fillStyle = col; x.fillText(str[i], cx + (cw - 2.5) / 2, py);
    }
  }
  function drawBoard(b) {
    const x = b.x, W = 1024, H = 384, room = D.room || {}, now = Date.now();
    x.fillStyle = '#0d1014'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffb340'; x.font = '700 38px ui-monospace, "SF Mono", Menlo, monospace'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText((b.kind === 'dep' ? '↗ ' : '↘ ') + (b.kind === 'dep' ? BOARD_TXT.dep : BOARD_TXT.arr), 30, 56);
    x.textAlign = 'right'; x.fillStyle = '#f5f1e6'; x.fillText(clockStr(), W - 30, 56);
    x.font = '600 18px ui-monospace, "SF Mono", Menlo, monospace'; x.fillStyle = '#7d8590'; x.textAlign = 'left';
    x.fillText(BOARD_TXT.time, 32, 94); x.fillText(BOARD_TXT.item, 168, 94); x.fillText(BOARD_TXT.status, W - 236, 94);
    let rows = [];
    if (b.kind === 'dep') rows = (room.departures || []).slice().sort((a, c) => String(a.due).localeCompare(String(c.due))).slice(0, 5).map(d => {
      const due = new Date(d.due).getTime(), dt = due - now;
      return { t: isNaN(due) ? '' : (dayKey(new Date(due)) === dayKey(new Date()) ? clockStr(new Date(due)) : dayKey(new Date(due)).slice(8, 10) + '/' + dayKey(new Date(due)).slice(5, 7)), w: txt(d, 'what'), st: dt < 0 ? BOARD_TXT.over : dt < 3 * 36e5 ? BOARD_TXT.board : BOARD_TXT.sched, c: dt < 0 ? '#ff5a4f' : dt < 3 * 36e5 ? '#4cd964' : '#f5f1e6' };
    });
    else { const src = (room.arrivals || []).length ? room.arrivals : (room.feed || []); rows = src.slice().sort((a, c) => String(c.at).localeCompare(String(a.at))).slice(0, 5).map(a => ({ t: a.at ? clockStr(new Date(a.at)) : '', w: txt(a, 'what'), st: (room.arrivals || []).length ? BOARD_TXT.landed : BOARD_TXT.done, c: '#4cd964' })); }
    x.font = '600 28px ui-monospace, "SF Mono", Menlo, monospace'; x.textAlign = 'center';
    if (!rows.length) flapText(x, BOARD_TXT.none, 168, 160, 20, '#7d8590');
    rows.forEach((r, i) => { const y = 148 + i * 50; flapText(x, r.t, 30, y, 5, '#ffb340'); flapText(x, r.w, 168, y, 27, '#f5f1e6'); flapText(x, r.st, W - 238, y, 9, r.c); });
    b.tex.needsUpdate = true;
  }
  makeBoard('dep', -40); makeBoard('arr', 40);
  function updateBoards() { boards.forEach(drawBoard); }
  updateBoards();
  world.add(box(16, 0.6, 18, P.terminal, 0, 0.3, 5));
  { const f = box(15, 0.05, 16.6, 0xe9e2d6, 0, 0.62, 5); f.castShadow = false; world.add(f); }
  world.add(cyl(6.2, 6.6, 0.5, 0xdcd5c9, TOWER.x, 0.9, TOWER.z, 40));

  /* ---------- the tower = the brain ----------
     An open platform on top of the tower; the brain floats above it,
     big enough to read from the overview. */
  const BRAIN_Y = 47, BRAIN_S = 2.3;
  const brainGroup = new T.Group();
  let radar, radarRing, brainHalo, beaconM, padM, beam;
  const towerG = new T.Group(); towerG.position.set(TOWER.x, 0, TOWER.z);
  {
    const g = towerG;
    g.add(cyl(2.6, 3.4, 30, P.tower, 0, 15, 0, 24));
    for (let y = 4; y < 29; y += 3) g.add(cyl(2.7 + (30 - y) * 0.027, 2.7 + (30 - y) * 0.027, 0.25, 0xd9d3c8, 0, y, 0, 24));
    g.add(cyl(7.4, 3.2, 2.0, P.tower, 0, 30.8, 0, 40));                       // platform
    padM = new T.MeshBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.55 });
    const pad = mesh(new T.RingGeometry(4.2, 6.6, 64), padM, 0, 31.85, 0, false, false); pad.rotation.x = -Math.PI / 2; g.add(pad);
    const railM = new T.MeshStandardMaterial({ color: 0xbfe7ff, transparent: true, opacity: 0.25, roughness: 0.05, side: T.DoubleSide, depthWrite: false });
    g.add(mesh(new T.CylinderGeometry(7.4, 7.4, 1.4, 48, 1, true), railM, 0, 32.5, 0, false, false));
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(box(0.16, 1.4, 0.16, P.steel, Math.cos(a) * 7.4, 32.5, Math.sin(a) * 7.4)); }
    // radar mast at the platform edge = Jarvis
    g.add(cyl(0.18, 0.22, 6, P.steel, 6.2, 34.8, 0, 8));
    beaconM = new T.MeshBasicMaterial({ color: 0xb23a2a });
    g.add(mesh(new T.SphereGeometry(0.35, 10, 8), beaconM, 6.2, 41.4, 0, false, false));
    radar = new T.Group(); radar.position.set(6.2, 37.8, 0);
    radar.add(box(4.2, 1.0, 0.3, 0xffffff, 0, 0.6, 0)); radar.add(cyl(0.25, 0.25, 0.6, P.steel, 0, 0, 0, 8));
    g.add(radar);
    world.add(g);
    pickable(g, { kind: 'brain', id: 'brain' });
    brainGroup.position.set(TOWER.x, BRAIN_Y, TOWER.z); brainGroup.scale.setScalar(BRAIN_S); world.add(brainGroup);
    brainHalo = glow(0x8fdcff, 13, 0.35); brainGroup.add(brainHalo);
    // an invisible sphere makes the whole brain easy to click
    const hit = mesh(new T.SphereGeometry(4.2, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0.3, 0, false, false);
    brainGroup.add(hit); pickable(hit, { kind: 'brain', id: 'brain' });
    // light column from the platform to the brain
    beam = mesh(new T.CylinderGeometry(1.6, 3.6, BRAIN_Y - 36, 24, 1, true), new T.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }), TOWER.x, 31.9 + (BRAIN_Y - 36) / 2, TOWER.z, false, false);
    world.add(beam);
    radarRing = mesh(new T.RingGeometry(0.96, 1, 96), new T.MeshBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }), TOWER.x, 0.45, TOWER.z, false, false);
    radarRing.rotation.x = -Math.PI / 2; world.add(radarRing);
  }

  /* ---------- the brain swarm (driven by ops_graph) ---------- */
  const BR = { mesh: null, seeds: [], nodes: [], edges: null, centers: [], N: 0 };
  // a point on (or just under) a folded two-lobed brain surface; dir biases the lobe region
  function brainShape(rand, depth = 0.12, dir = null) {
    let x, y, z, tries = 0;
    do {
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1);
      x = Math.sin(v) * Math.cos(u); y = Math.cos(v); z = Math.sin(v) * Math.sin(u);
      tries++;
    } while (dir && tries < 40 && (x * dir.x + y * dir.y + z * dir.z) < 0.82);
    const side = x < 0 ? -1 : 1;
    // gyri: ridges across the surface
    const fold = 1 + 0.07 * Math.sin(z * 9 + y * 5) + 0.05 * Math.sin(y * 13 - x * 4);
    const r = fold * (1 - depth * rand());
    // flatten the base, separate the hemispheres with a fissure
    const px = (Math.abs(x) * 1.0 + 0.2) * side, py = y < -0.35 ? y * 0.7 : y * 0.92, pz = z * 1.38;
    return V(px * r * 2.6, py * r * 2.6 + 0.4, pz * r * 2.6);
  }
  function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  BR.u = { uTime: { value: 0 }, uPulse: { value: 0 }, uSpin: { value: 0 }, uFocus: { value: -1 }, uPx: { value: 600 }, uReduced: { value: reduced ? 1 : 0 }, uNight: { value: 0 } };
  const BRAIN_VS = `attribute vec3 aColor; attribute float aSize; attribute vec2 aPh; attribute float aHot; attribute float aNode;
    uniform float uTime, uPulse, uSpin, uFocus, uPx, uReduced; varying vec3 vColor;
    void main(){
      float wob = (1.0 - uReduced) * sin(uTime * aPh.y + aPh.x) * 0.05 * (1.0 + uPulse * 2.0);
      float c = cos(uSpin), s = sin(uSpin);
      vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
      p.xz *= 1.0 + wob * 0.2; p.y += wob;
      float sz = aSize * (1.0 + 0.6 * uPulse * (sin(uTime * 6.0 + aPh.x) * 0.5 + 0.5));
      if (aHot > 0.5) sz *= 1.0 + 0.5 * (sin(uTime * 4.0 + aPh.x) * 0.5 + 0.5) * (1.0 - uReduced);
      if (uFocus >= 0.0 && abs(aNode - uFocus) < 0.5) sz *= 2.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = max(1.5, sz * uPx / -mv.z);
      gl_Position = projectionMatrix * mv; vColor = aColor;
    }`;
  const BRAIN_FS = `uniform float uNight; varying vec3 vColor;
    void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
      float core = 1.0 - smoothstep(0.0, 0.5, r); float a = pow(core, 1.2);
      gl_FragColor = vec4(vColor * (0.9 + mix(0.6, 0.9, uNight) * pow(core, 5.0)), a); }`;
  function setGraph(graph) {
    D.graph = graph || { nodes: [], edges: [] };
    const nodes = (D.graph.nodes || []).slice(0, 420);
    if (BR.mesh) { brainGroup.remove(BR.mesh); BR.mesh.geometry.dispose(); BR.mesh.material.dispose(); }
    if (BR.edges) { brainGroup.remove(BR.edges); BR.edges.geometry.dispose(); BR.edges.material.dispose(); }
    const per = nodes.length ? clamp(Math.floor((isPhone ? 900 : 1500) / nodes.length), 2, 10) : 0;
    const filler = nodes.length ? (isPhone ? 500 : 900) : (isPhone ? 1100 : 1800);
    const N = nodes.length * per + filler;
    const seeds = [], centers = [];
    // cluster nodes by type into regions of the brain so each lobe means something
    const typeAnchor = { card: V(-0.6, 0.5, 0.65).normalize(), party: V(0.6, 0.5, 0.65).normalize(), note: V(0, 1, -0.2).normalize(), doc: V(-0.6, 0.1, -0.8).normalize(), person: V(0.65, 0.05, -0.75).normalize() };
    const pos = new Float32Array(N * 3), colA = new Float32Array(N * 3), sizeA = new Float32Array(N), phA = new Float32Array(N * 2), hotA = new Float32Array(N), nodeA = new Float32Array(N);
    const col = new T.Color(), white = new T.Color(0xffffff);
    let k = 0;
    const put = (p, c, size, ph, sp, hot, ni) => { pos.set([p.x, p.y, p.z], k * 3); colA.set([c.r, c.g, c.b], k * 3); sizeA[k] = size; phA.set([ph, sp], k * 2); hotA[k] = hot ? 1 : 0; nodeA[k] = ni; seeds.push({ node: ni }); k++; };
    nodes.forEach((n, ni) => {
      const rnd = seeded(hashStr(String(n.id)));
      const c = brainShape(rnd, 0.02, typeAnchor[n.type] || null);
      centers.push({ node: n, p: c });
      const hex = n.type === 'card' ? (/(sign|firm|won|paid|done)/i.test(n.stage || '') ? 0x30d158 : /(declin|lost|rechaz)/i.test(n.stage || '') ? 0x8e8e93 : 0xff9f0a) : (P.node[n.type] || P.node.other);
      for (let j = 0; j < per; j++) {
        const off = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.42 + (n.weight ? Math.min(3, n.weight) * 0.08 : 0));
        col.setHex(hex); if (!n.hot) col.lerp(white, 0.12);
        put(c.clone().add(off), col, (n.hot ? 0.34 : 0.24) + rnd() * 0.12, rnd() * 6.28, 0.4 + rnd() * 0.9, n.hot, ni);
      }
    });
    const rnd = seeded(7);
    for (let j = 0; j < filler; j++) {
      col.setHex(0x7fd4ff).lerp(white, 0.2 + rnd() * 0.4);
      put(brainShape(rnd), col, 0.16 + rnd() * 0.12, rnd() * 6.28, 0.4 + rnd() * 0.9, false, -1);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new T.BufferAttribute(colA, 3));
    geo.setAttribute('aSize', new T.BufferAttribute(sizeA, 1)); geo.setAttribute('aPh', new T.BufferAttribute(phA, 2));
    geo.setAttribute('aHot', new T.BufferAttribute(hotA, 1)); geo.setAttribute('aNode', new T.BufferAttribute(nodeA, 1));
    const im = new T.Points(geo, new T.ShaderMaterial({ uniforms: BR.u, vertexShader: BRAIN_VS, fragmentShader: BRAIN_FS, transparent: true, depthWrite: false }));
    im.frustumCulled = false;
    BR.mesh = im; BR.seeds = seeds; BR.centers = centers; BR.N = N;
    brainGroup.add(im);
    // synapses: a faint line per edge between node centres
    const idx = new Map(nodes.map((n, i) => [String(n.id), i]));
    const es = (D.graph.edges || []).filter(e => idx.has(String(e.s)) && idx.has(String(e.t))).slice(0, 500);
    if (es.length) {
      const arr = new Float32Array(es.length * 6);
      es.forEach((e, i) => { const a = centers[idx.get(String(e.s))].p, b = centers[idx.get(String(e.t))].p; arr.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); });
      const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.BufferAttribute(arr, 3));
      BR.edges = new T.LineSegments(g2, new T.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.22, depthWrite: false }));
      brainGroup.add(BR.edges);
    } else BR.edges = null;
    BR.edgeCount = es.length;
    if (BR.sig) { brainGroup.remove(BR.sig); BR.sig.geometry.dispose(); }
    BR.sigEdges = es.map(e => [centers[idx.get(String(e.s))].p, centers[idx.get(String(e.t))].p]);
    if (!BR.sigEdges.length) { const r2 = seeded(3); for (let i = 0; i < 60; i++) BR.sigEdges.push([brainShape(r2), brainShape(r2)]); }
    const NS = isPhone ? 70 : 140, sp = new Float32Array(NS * 3);
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    BR.sig = new T.Points(sg, new T.PointsMaterial({ map: GLOW, color: 0xbfeaff, size: 0.55, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    BR.sig.frustumCulled = false;
    BR.sigs = Array.from({ length: NS }, () => ({ e: Math.floor(Math.random() * BR.sigEdges.length), t: Math.random(), v: 0.35 + Math.random() * 0.6 }));
    brainGroup.add(BR.sig);
  }
  setGraph(null);

  /* ---------- jet bridges ---------- */
  const bridges = {};
  TEAMS.forEach(g => {
    const grp = new T.Group();
    grp.add(cyl(1.6, 1.6, 3.2, P.terminal, 0, 2.4, 0, 16));
    const tube = new T.Group(); tube.position.set(0, 2.6, 0); grp.add(tube);
    const t = box(2.2, 2.2, 1, 0xe8e3da, 0, 0, 0.5); tube.add(t);
    const head = box(2.8, 2.6, 2, 0xdcd5c9, 0, 0, 1); tube.add(head);
    const leg = cyl(0.25, 0.25, 2.6, P.steel, 0, -1.3, 0, 8); tube.add(leg);
    grp.position.set(g.x - 6.5, 0, -6.2); world.add(grp);
    bridges[g.id] = { tube, t, head, leg, k: 0, target: 0 };
  });
  function updateBridge(b, dt) {
    b.k = lerp(b.k, b.target, 1 - Math.exp(-dt * 1.6));
    // rotunda sits at (gx-6.5, -6.2); the forward left door is near (gx-1.0, -17.2)
    const len = lerp(4.5, 11.6, b.k);
    b.tube.rotation.y = Math.PI + lerp(-0.25, -0.46, b.k);
    b.t.scale.z = len; b.t.position.z = len / 2; b.head.position.z = len + 0.8; b.leg.position.z = len - 1;
  }

  /* ---------- signs ---------- */
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function signSprite(code, name, color, w = 12.8) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#1c1c1e'; roundRect(x, 6, 6, 628, 148, 30); x.fill();
    x.fillStyle = color; roundRect(x, 18, 18, 124, 124, 22); x.fill();
    x.fillStyle = '#1c1c1e'; x.font = '800 88px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(code, 80, 84);
    x.fillStyle = '#f5f5f7'; x.textAlign = 'left'; x.font = '700 54px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif'; x.fillText(name, 168, 82);
    const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w, w / 4, 1); return s;
  }
  TEAMS.forEach(g => {
    if (g.id === 'D') return;
    const s = signSprite(g.id, L.teams[g.team], g.color); s.position.set(g.x - 6, 8.6, -4.5); world.add(s);
    world.add(cyl(0.12, 0.12, 3.6, P.steel, g.x - 6, 5.6, -4.2, 6));
  });

  /* ---------- hangar (code workshop) ---------- */
  {
    const g = new T.Group(); g.position.set(HANGAR.x, 0, HANGAR.z);
    const Wd = 36, Dp = 30, H = 13;
    g.add(box(Wd, 0.4, Dp, 0xe3ddd3, 0, 0.2, 0));
    const f = box(Wd - 1, 0.05, Dp - 1, 0xdfd8cc, 0, 0.42, 0); f.castShadow = false; g.add(f);
    g.add(box(0.8, H, Dp, P.terminal, -Wd / 2, H / 2, 0)); g.add(box(0.8, H, Dp, P.terminal, Wd / 2, H / 2, 0)); g.add(box(Wd, H, 0.8, P.terminal, 0, H / 2, Dp / 2));
    for (let i = -2; i <= 2; i++) { const rib = mesh(new T.TorusGeometry(Wd / 2, 0.4, 6, 24, Math.PI), mat(P.steel), 0, H, i * 7); rib.scale.y = 0.35; g.add(rib); }
    g.add(box(6, H - 1, 0.6, 0xd2ccc0, -Wd / 2 - 2.6, (H - 1) / 2, -Dp / 2)); g.add(box(6, H - 1, 0.6, 0xd2ccc0, Wd / 2 + 2.6, (H - 1) / 2, -Dp / 2));
    const s = signSprite('D', L.teams.code, TEAMS[3].color, 14); s.position.set(0, H + 4.5, -Dp / 2); g.add(s);
    world.add(g);
    pickable(g, { kind: 'team', id: 'code' });
  }

  /* ---------- trees, windsock, floodlights ---------- */
  const floodGlows = [], lampMats = [];
  let sock;
  {
    const trunkG = new T.CylinderGeometry(0.25, 0.35, 2, 6), crownG = new T.IcosahedronGeometry(1.8, 0);
    const spots = []; const r = seeded(42);
    for (let x = -180; x <= 180; x += 9) spots.push([x + r() * 3, 42 + r() * 2]);
    for (let x = -80; x <= 80; x += 10) if (Math.abs(x) > 8) spots.push([x, 27.5]);
    for (let i = 0; i < 46; i++) spots.push([-200 + r() * 34, -4 + r() * 60]);
    for (let i = 0; i < 46; i++) spots.push([150 + r() * 46, 10 + r() * 50]);
    for (let i = 0; i < 30; i++) spots.push([-200 + r() * 400, -96 - r() * 40]);
    const trunks = new T.InstancedMesh(trunkG, mat(P.trunk), spots.length), crowns = new T.InstancedMesh(crownG, mat(P.tree, { flatShading: true }), spots.length);
    trunks.castShadow = crowns.castShadow = true;
    const o = new T.Object3D();
    spots.forEach((s, i) => {
      const k = 0.8 + r() * 0.7;
      o.position.set(s[0], 1, s[1]); o.scale.set(k, k, k); o.rotation.set(0, r() * 6, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
      o.position.y = 2.6 * k; o.updateMatrix(); crowns.setMatrixAt(i, o.matrix);
    });
    world.add(trunks, crowns);
    const ws = new T.Group(); ws.position.set(-60, 0, RWY_Z + 14);
    ws.add(cyl(0.12, 0.12, 6, P.steel, 0, 3, 0, 6));
    sock = mesh(new T.ConeGeometry(0.6, 3, 10, 1, true), mat(0xff9f0a, { side: T.DoubleSide }), 1.5, 5.8, 0); sock.rotation.z = Math.PI / 2;
    const sockPivot = new T.Group(); sockPivot.position.set(0, 0, 0); sockPivot.add(sock); ws.add(sockPivot); world.add(ws); sock = sockPivot;
    [-86, -40, 40, 86].forEach(x => {
      world.add(cyl(0.25, 0.35, 16, P.steel, x, 8, -11, 8));
      const lm = new T.MeshBasicMaterial({ color: 0x8a8a8a }); lampMats.push(lm);
      world.add(mesh(new T.BoxGeometry(3, 0.8, 1.2), lm, x, 16.2, -11, false, false));
      const gl = glow(0xffe6b0, 14, 0); gl.position.set(x, 16.2, -11.8); world.add(gl); floodGlows.push(gl);
      lightPool(52, 44, 0xffd9a0, x, -22);
    });
    lightPool(70, 14, 0xffc977, -40, -6); lightPool(70, 14, 0xffc977, 40, -6);
    lightPool(120, 12, 0xffd9a0, 0, 22.5); lightPool(40, 30, 0xffd9a0, HANGAR.x, -32);
  }

  /* ================================================== PEOPLE */
  const people = [];
  const capG = new T.CapsuleGeometry(0.42, 0.7, 4, 10), headG = new T.SphereGeometry(0.36, 14, 10), limbG = new T.CapsuleGeometry(0.13, 0.55, 3, 6);
  const hairG = new T.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const deskG = new T.BoxGeometry(2.2, 0.12, 1.2), monG = new T.BoxGeometry(1.1, 0.7, 0.08), chairG = new T.CylinderGeometry(0.45, 0.45, 0.15, 12);
  const bubbleTex = {};
  function bubble(kind) {
    if (!bubbleTex[kind]) {
      const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(48, 42, 34, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(36, 70); x.lineTo(48, 92); x.lineTo(58, 70); x.fill();
      x.fillStyle = kind === 'work' ? '#0a84ff' : kind === 'brain' ? '#bf5af2' : '#8e8e93';
      if (kind === 'work') { [26, 48, 70].forEach((cx, i) => { x.beginPath(); x.arc(cx, 42, 7, 0, Math.PI * 2); x.fill(); }); }
      else if (kind === 'brain') { x.font = '700 40px -apple-system, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 48, 44); }
      else { x.fillRect(34, 32, 22, 22); x.fillRect(56, 37, 8, 10); }
      bubbleTex[kind] = new T.CanvasTexture(c);
    }
    const s = new T.Sprite(new T.SpriteMaterial({ map: bubbleTex[kind], transparent: true, depthWrite: false })); s.scale.set(1.3, 1.3, 1); return s;
  }
  function makePerson(agent, gate, idx) {
    const g = new T.Group();
    const shirt = mat(P.shirt[gate.id]);
    const skin = mat(P.skin[idx % P.skin.length]);
    g.add(mesh(capG, shirt, 0, 1.3, 0));
    const head = mesh(headG, skin, 0, 2.25, 0); g.add(head);
    g.add(mesh(hairG, mat([0x2b2118, 0x5a3b22, 0xc9a26b, 0x1a1a1a, 0x8b5a2b][idx % 5]), 0, 2.32, 0.02));
    const armL = new T.Group(), armR = new T.Group(); armL.position.set(-0.55, 1.75, 0); armR.position.set(0.55, 1.75, 0);
    armL.add(mesh(limbG, shirt, 0, -0.4, 0)); armR.add(mesh(limbG, shirt, 0, -0.4, 0)); g.add(armL, armR);
    const legL = new T.Group(), legR = new T.Group(); legL.position.set(-0.22, 0.75, 0); legR.position.set(0.22, 0.75, 0);
    const pants = mat(0x3a4250); legL.add(mesh(limbG, pants, 0, -0.38, 0)); legR.add(mesh(limbG, pants, 0, -0.38, 0)); g.add(legL, legR);
    const cup = mesh(new T.CylinderGeometry(0.12, 0.1, 0.25, 8), mat(0xffffff), 0, -0.85, 0.15); cup.visible = false; armR.add(cup);
    g.scale.setScalar(0.72);
    const bub = { work: bubble('work'), brain: bubble('brain'), coffee: bubble('coffee') };
    Object.values(bub).forEach(b => { b.position.set(0, 3.6, 0); b.visible = false; g.add(b); });
    return { agent, gate, g, armL, armR, legL, legR, head, cup, bub, phase: idx * 1.37, mode: 'desk', path: null, s: 0, wait: 0 };
  }
  const deskSlots = {};
  function seatFor(gate, i) {
    if (gate.id === 'D') { const col = i % 3, row = Math.floor(i / 3); return { x: HANGAR.x - 10 + col * 7, z: HANGAR.z + 2 + row * 3.8, y: 0.42 }; }
    const col = i % 3, row = Math.floor(i / 3); return { x: gate.x - 6 + (col - 1) * 4.4 + 6, z: 1.6 + row * 4.4, y: 0.62 };
  }
  function addPerson(a) {
    const gate = teamOf(a.team);
    deskSlots[gate.id] = deskSlots[gate.id] || 0;
    const i = deskSlots[gate.id]++;
    const s = seatFor(gate, i);
    const deskZ = s.z - 1.0;
    world.add(mesh(deskG, mat(0xd8cbb5), s.x, s.y + 0.83, deskZ));
    [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].forEach(([dx, dz]) => world.add(box(0.1, 0.8, 0.1, P.steel, s.x + dx, s.y + 0.4, deskZ + dz * 0.9)));
    const monM = new T.MeshStandardMaterial({ color: 0x1d2530, emissive: 0x64d2ff, emissiveIntensity: 0, roughness: 0.5 });
    world.add(mesh(monG, monM, s.x, s.y + 1.38, deskZ - 0.35));
    world.add(mesh(chairG, mat(0x3a4250), s.x, s.y + 0.38, s.z + 0.1));
    const p = makePerson(a, gate, people.length);
    p.home = V(s.x, s.y + 0.18, s.z + 0.2); p.face = Math.PI; p.mon = monM;
    p.g.position.copy(p.home); p.g.rotation.y = p.face;
    world.add(p.g); pickable(p.g, { kind: 'agent', id: a.id });
    people.push(p); a._p = p;
  }
  function onAgents() {
    D.agents.forEach(a => { if (!a._p) addPerson(a); });
    updateBoards();
    // Jarvis just started a sweep: its team walks to the brain
    const j = D.byId.get('jarvis');
    if (j && j.justStarted) startSweep();
  }
  const coffee = [V(-40, 0.8, 11), V(40, 0.8, 11), V(HANGAR.x + 12, 0.6, HANGAR.z + 10)];
  coffee.forEach(c => { world.add(box(2.4, 1.6, 1, 0x6b4f3a, c.x, c.y + 0.6, c.z + 1.4)); world.add(box(0.8, 0.5, 0.6, 0x2b2b2b, c.x - 0.5, c.y + 1.65, c.z + 1.4)); });
  function walkPath(from, to, viaCenter) {
    const pts = [[from.x, from.z]];
    if (viaCenter) { pts.push([from.x, 9.5]); pts.push([TOWER.x + (from.x < 0 ? -7.5 : 7.5), 9.5]); }
    else pts.push([from.x, Math.max(from.z, to.z) + 1.5]), pts.push([to.x, Math.max(from.z, to.z) + 1.5]);
    pts.push([to.x, to.z]);
    const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.2);
    return roundedPath(clean, 1.5, from.y);
  }
  function sendWalk(p, why) {
    if (p.mode !== 'desk' || reduced) return;
    let to;
    if (why === 'brain') {
      if (p.gate.id === 'D') to = V(HANGAR.x - 14, 0.6, HANGAR.z + 11);
      else { const ang = (p.gate.x < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 2.2; to = V(TOWER.x + Math.cos(ang) * 4.6, 0.8, TOWER.z + Math.sin(ang) * 4.6); }
      ENV.brainPulse = 1;
    } else to = coffee.reduce((b, c) => c.distanceTo(p.home) < b.distanceTo(p.home) ? c : b).clone().add(V((Math.random() - 0.5) * 2, 0, -1.2));
    p.mode = 'walking'; p.why = why; p.path = walkPath(p.g.position, to, why === 'brain' && p.gate.id !== 'D'); p.s = 0;
  }
  function updatePerson(p, dt) {
    const t = SIM.t + p.phase, a = p.agent, st = a.state || 'off';
    const rx = (o, x) => { o.rotation.x = x; };
    Object.values(p.bub).forEach(b => b.visible = false);
    if (p.mode === 'desk') {
      p.g.visible = st !== 'off';
      p.g.position.lerp(p.home, 1 - Math.exp(-dt * 6)); p.g.rotation.y = angLerp(p.g.rotation.y, p.face, 1 - Math.exp(-dt * 6));
      rx(p.legL, -1.45); rx(p.legR, -1.45);
      if (st === 'working') {
        const amp = reduced ? 0 : 0.12;
        rx(p.armL, -1.1 + Math.sin(t * 14) * amp); rx(p.armR, -1.1 + Math.sin(t * 14 + 1.7) * amp);
        p.head.rotation.x = 0.15 + Math.sin(t * 0.9) * 0.05 * (reduced ? 0 : 1); p.cup.visible = false;
        p.bub.work.visible = CAM.dist < 120; p.bub.work.position.y = 3.6 + Math.sin(t * 2) * 0.1;
        if (!reduced && Math.random() < dt * 0.006) sendWalk(p, 'brain');
      } else if (st === 'resting') {
        const sip = reduced ? 0.5 : (Math.sin(t * 0.8) + 1) / 2;
        rx(p.armL, -0.2); rx(p.armR, -0.6 - sip * 1.8); p.cup.visible = true; p.head.rotation.x = -0.1;
        if (!reduced && Math.random() < dt * 0.01) sendWalk(p, 'coffee');
      }
      p.mon.emissiveIntensity = st === 'working' ? 1.0 : st === 'resting' ? 0.15 : 0;
    } else if (p.mode === 'walking' || p.mode === 'return') {
      p.g.visible = true;
      p.s += 3.4 * dt; const u = clamp(p.s / p.path._len, 0, 1);
      p.g.position.copy(p.path.getPointAt(u)); const tan = p.path.getTangentAt(Math.min(u, 0.999));
      p.g.rotation.y = Math.atan2(tan.x, tan.z);
      const sw = Math.sin(t * 9) * 0.6; rx(p.legL, sw); rx(p.legR, -sw); rx(p.armL, -sw * 0.7); rx(p.armR, sw * 0.7); p.cup.visible = false;
      p.mon.emissiveIntensity = 0.1;
      if (u >= 1) { if (p.mode === 'walking') { p.mode = 'at'; p.wait = p.why === 'brain' ? 6 + Math.random() * 3 : 5; } else p.mode = 'desk'; }
    } else if (p.mode === 'at') {
      p.wait -= dt; rx(p.legL, 0); rx(p.legR, 0);
      if (p.why === 'brain') {
        p.g.rotation.y = Math.atan2(TOWER.x - p.g.position.x, TOWER.z - p.g.position.z);
        rx(p.armL, -0.3); rx(p.armR, -2.6 + Math.sin(t * 3) * 0.3); p.head.rotation.x = -0.45; p.bub.brain.visible = CAM.dist < 140;
      } else { rx(p.armR, -1.8); p.cup.visible = true; p.bub.coffee.visible = CAM.dist < 120; }
      if (p.wait <= 0) { p.mode = 'return'; p.path = walkPath(p.g.position, p.home, p.why === 'brain' && p.gate.id !== 'D'); p.s = 0; p.head.rotation.x = 0; }
    }
  }

  /* ================================================== AIRCRAFT */
  /* One builder for every aircraft: lathe fuselage with an upswept tail,
     extruded swept wings, nacelles, window rows, cheatline and fin livery. */
  const winGeo = new T.BoxGeometry(0.16, 0.2, 0.16);
  function wingGeom(rootC, tipC, span, sweep, thick, side) {
    const sh = new T.Shape(), sx = side;
    sh.moveTo(0, rootC * 0.45); sh.lineTo(sx * span, rootC * 0.45 - sweep); sh.lineTo(sx * span, rootC * 0.45 - sweep - tipC); sh.lineTo(0, -rootC * 0.55); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.35, bevelSize: thick * 0.35, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, thick / 2, 0); return g;
  }
  function nacelle(re, le, m, dark) {
    const g = new T.Group();
    const lg = new T.LatheGeometry([[re * 0.82, 0], [re, le * 0.12], [re * 0.98, le * 0.7], [re * 0.62, le]].map(([r, y]) => new T.Vector2(r, y)), 20);
    // lathe axis y -> -z, shifted so the intake lip sits at z = le and faces forward
    const n = new T.Mesh(lg, m); n.rotation.x = -Math.PI / 2; n.position.z = le; n.castShadow = true; g.add(n);
    const disc = new T.Mesh(new T.CircleGeometry(re * 0.8, 20), dark); disc.position.z = le - 0.06; g.add(disc);
    const fan = new T.Mesh(new T.CircleGeometry(re * 0.3, 12), mat(0xb0b6bd)); fan.position.z = le - 0.04; g.add(fan);
    g.position.z = -le / 2; const outer = new T.Group(); outer.add(g); return outer;
  }
  function airliner(o) {
    const g = new T.Group(); const L = o.len, R = o.r, Y = o.y;
    const body = mat(o.body || 0xf7f7f5), dark = mat(0x1d2530, { roughness: 0.35, metalness: 0.2 }), acc = mat(o.livery), wingM = mat(o.wing || 0xe9ebee, { side: T.DoubleSide }), engM = mat(o.engine || o.livery);
    // fuselage
    const prof = [[0.01, 0], [R * 0.45, R * 0.14], [R * 0.75, R * 0.5], [R * 0.93, R * 1.05], [R, R * 1.8], [R, L - R * 3.4], [R * 0.9, L - R * 2.3], [R * 0.6, L - R * 1.1], [R * 0.26, L - 0.18], [0.02, L]];
    const fg = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 26);
    const pa = fg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const t0 = L - R * 3.6; if (y > t0) { const t = (y - t0) / (L - t0); pa.setZ(i, pa.getZ(i) + Math.pow(t, 1.6) * R * 0.62); } if (y < R * 1.2) pa.setZ(i, pa.getZ(i) - (1 - y / (R * 1.2)) * R * 0.12); }
    fg.computeVertexNormals();
    const fus = new T.Mesh(fg, body); fus.rotation.x = -Math.PI / 2; fus.position.set(0, Y, L / 2); fus.castShadow = true; fus.receiveShadow = true; g.add(fus);
    // cockpit glazing
    const ck = new T.Mesh(new T.CylinderGeometry(R * 0.7, R * 0.84, R * 0.55, 18, 1, true, -1.1, 2.2), dark); ck.rotation.x = Math.PI / 2 - 0.55; ck.rotation.z = Math.PI; ck.position.set(0, Y + R * 0.42, L / 2 - R * 0.95); g.add(ck);
    // cabin windows and cheatline
    const nW = Math.floor((L - R * 6) / 0.62);
    const wins = new T.InstancedMesh(winGeo, dark, nW * 2); const o3 = new T.Object3D(); let wi = 0;
    for (const sx of [-1, 1]) for (let i = 0; i < nW; i++) { o3.position.set(sx * R * 0.985, Y + R * 0.3, L / 2 - R * 2.4 - i * 0.62); o3.scale.set(1, 1, 1); o3.updateMatrix(); wins.setMatrixAt(wi++, o3.matrix); }
    g.add(wins);
    for (const sx of [-1, 1]) { const st = new T.Mesh(new T.BoxGeometry(0.05, R * 0.22, L - R * 4.2), acc); st.position.set(sx * R * 0.99, Y - R * 0.12, -R * 0.4); g.add(st); }
    // door outlines (forward left)
    const door = new T.Mesh(new T.BoxGeometry(0.05, R * 1.0, R * 0.55), mat(0xd8dbe0)); door.position.set(-R * 0.995, Y + R * 0.05, L / 2 - R * 2.2); g.add(door);
    // wings
    const wz = o.wingZ ?? L * 0.06, wy = Y - R * 0.5;
    for (const sx of [-1, 1]) {
      const wg = new T.Group(); wg.position.set(sx * R * 0.55, wy, wz); wg.rotation.z = sx * (o.dihedral ?? 0.07);
      const w = new T.Mesh(wingGeom(o.rootC, o.tipC, o.span, o.sweep, o.thick || 0.22, sx), wingM); w.castShadow = true; w.receiveShadow = true; wg.add(w);
      if (o.tips === 'winglet') { const wl = new T.Mesh(new T.BoxGeometry(0.08, R * 1.1, o.tipC * 0.9), acc); wl.position.set(sx * o.span, R * 0.5, o.rootC * 0.45 - o.sweep - o.tipC * 0.5); wl.rotation.x = -0.35; wg.add(wl); }
      if (o.tips === 'raked') { const rk = new T.Mesh(wingGeom(o.tipC, 0.18, o.span * 0.12, o.tipC * 0.9, 0.12, sx), wingM); rk.position.set(sx * o.span, 0.02, o.rootC * 0.45 - o.sweep); wg.add(rk); }
      const nav = glow(sx < 0 ? 0xff3b30 : 0x34c759, 1.8); nav.position.set(sx * (o.span + (o.tips === 'raked' ? o.span * 0.12 : 0.1)), 0.3, o.rootC * 0.45 - o.sweep - o.tipC * 0.5); wg.add(nav); (g.userData.navs = g.userData.navs || []).push(nav);
      if (o.engines === 'wing') {
        const n = nacelle(o.er, o.el, engM, dark); n.position.set(sx * o.span * 0.34, -o.er * 0.95, o.rootC * 0.45 - o.sweep * 0.34 + o.el * 0.35); wg.add(n);
        const py = new T.Mesh(new T.BoxGeometry(0.16, o.er * 0.7, o.el * 0.7), wingM); py.position.set(sx * o.span * 0.34, -o.er * 0.3, o.rootC * 0.45 - o.sweep * 0.34 + o.el * 0.1); wg.add(py);
      }
      g.add(wg);
    }
    if (o.engines === 'rear') for (const sx of [-1, 1]) {
      const n = nacelle(o.er, o.el, engM, dark); n.position.set(sx * (R + o.er * 1.15), Y + R * 0.35, -L / 2 + R * 3.3); g.add(n);
      const py = new T.Mesh(new T.BoxGeometry(o.er * 1.2, 0.14, o.el * 0.5), body); py.position.set(sx * (R + o.er * 0.4), Y + R * 0.35, -L / 2 + R * 3.3); g.add(py);
    }
    // fin
    const fh = o.finH, fc = o.finC, fsw = fh * 0.85;
    const fs = new T.Shape(); fs.moveTo(0, 0); fs.lineTo(fc, 0); fs.lineTo(fc * 0.92 + fsw * 0.35, fh); fs.lineTo(fsw * 0.35 + fc * 0.92 - fc * 0.5, fh); fs.lineTo(fsw * 0.0 + fc * 0.12, fh * 0.3); fs.closePath();
    const fgeo = new T.ExtrudeGeometry(fs, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }); fgeo.rotateY(Math.PI / 2); fgeo.translate(-0.09, 0, 0);
    const fin = new T.Mesh(fgeo, acc); fin.position.set(0, Y + R * 0.75, -L / 2 + fc + R * 0.4); fin.castShadow = true; g.add(fin);
    const fstripe = new T.Mesh(new T.BoxGeometry(0.26, fh * 0.12, fc * 0.6), mat(0xffffff)); fstripe.position.set(0, Y + R * 0.75 + fh * 0.55, -L / 2 + fc * 0.5 + R * 0.4 - fsw * 0.2); g.add(fstripe);
    // horizontal stabiliser (on the fin top for a T-tail)
    const hy = o.ttail ? Y + R * 0.75 + fh - 0.05 : Y + R * 0.35, hz = o.ttail ? -L / 2 + R * 0.4 + fc * 0.5 - fsw * 0.32 : -L / 2 + R * 1.9;
    for (const sx of [-1, 1]) { const hs = new T.Mesh(wingGeom(o.rootC * 0.42, o.tipC * 0.55, o.span * 0.34, o.sweep * 0.3, 0.12, sx), o.ttail ? acc : wingM); hs.position.set(sx * (o.ttail ? 0.05 : R * 0.3), hy, hz); hs.castShadow = true; g.add(hs); }
    // gear
    const gear = new T.Group(); g.add(gear);
    const tyre = mat(0x1f2328);
    [[0, L / 2 - R * 2.6, 1], [-R * 1.05, wz - 0.4, 2], [R * 1.05, wz - 0.4, 2]].forEach(([x, z, n]) => {
      gear.add(cyl(0.07, 0.07, Y - R * 0.6, mat(0xc8ccd2), x, (Y - R * 0.6) / 2 + 0.25, z, 6));
      for (let k = 0; k < n; k++) { const w = cyl(0.3, 0.3, 0.24, tyre, x + (n > 1 ? (k - 0.5) * 0.3 : 0), 0.3, z, 12); w.rotation.z = Math.PI / 2; gear.add(w); }
    });
    // lights
    const strobe = glow(0xffffff, 3, 0); strobe.position.set(0, Y + R + 0.2, 0); g.add(strobe);
    const land = glow(0xfff6dd, 5, 0); land.position.set(0, Y - R * 0.2, L / 2 + 0.6); g.add(land);
    const beacon = glow(0xff3b30, 1.5, 0); beacon.position.set(0, Y + R + 0.05, -L * 0.1); g.add(beacon);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
    return { g, gear, navs: g.userData.navs, strobe, land, beacon };
  }
  function makeJet(liveryHex) {
    return airliner({ len: 12.6, r: 0.88, y: 1.95, livery: liveryHex, engine: 0xdfe3e8, span: 6.1, rootC: 2.6, tipC: 0.75, sweep: 2.3, thick: 0.2, tips: 'winglet', engines: 'wing', er: 0.5, el: 1.9, finH: 2.9, finC: 2.6 });
  }
  function makeB787() {   // the owner's 787-8: longer, raked wingtips, big engines, navy livery
    return airliner({ len: 19, r: 1.25, y: 2.7, livery: 0x1d3557, engine: 0xe3e6ea, span: 9.2, rootC: 3.8, tipC: 0.9, sweep: 3.6, thick: 0.26, tips: 'raked', engines: 'wing', er: 0.82, el: 3.0, finH: 4.4, finC: 3.8, dihedral: 0.09 }).g;
  }
  function makeGlobal() {  // the owner's Global 8000: T-tail, rear engines, winglets, gold cheatline
    return airliner({ len: 11.6, r: 0.78, y: 1.75, livery: 0xa07c3f, engine: 0xf2f2f0, span: 6.6, rootC: 2.4, tipC: 0.6, sweep: 2.6, thick: 0.16, tips: 'winglet', engines: 'rear', er: 0.5, el: 2.1, finH: 2.9, finC: 2.4, ttail: true, wingZ: 0.2, dihedral: 0.05 }).g;
  }
  const fleetObjs = [];
  const FLEET = (opts.fleet && opts.fleet.length ? opts.fleet : [{ reg: 'B787-8', type: 'b787' }, { reg: 'Global 8000', type: 'global' }]).slice(0, 2);
  FLEET.forEach((f, i) => {
    const g = f.type === 'global' ? makeGlobal() : makeB787();
    const x = i === 0 ? -100 : -124, z = f.type === 'global' ? -27 : -28;
    g.position.set(x, 0, z); g.rotation.y = 0;
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    world.add(g);
    const tag = signSprite('✈', f.reg, '#64d2ff', 8.5); tag.position.set(x, f.type === 'global' ? 9 : 11, z - 2); world.add(tag);
    pickable(g, { kind: 'fleet', id: f.reg });
    fleetObjs.push({ f, g });
  });

  /* ---------- ground vehicles ---------- */
  function makeVehicle(kind) {
    const g = new T.Group(); const dark = mat(0x2a2f36); const parts = {};
    if (kind === 'tug') { g.add(box(1.8, 0.8, 3.0, P.tug, 0, 0.7, 0)); g.add(box(1.3, 0.8, 1.0, dark, 0, 1.4, -0.7)); }
    else if (kind === 'bag') { g.add(box(1.3, 0.8, 1.8, P.tug, 0, 0.7, 0.9)); g.add(box(1.0, 0.7, 0.7, dark, 0, 1.4, 0.6)); for (let i = 0; i < 2; i++) g.add(box(1.3, 0.9, 1.6, 0xb9c3cf, 0, 0.8, -1.2 - i * 2.0)); }
    else if (kind === 'fuel') { g.add(box(1.8, 1.2, 1.6, 0xffffff, 0, 1.0, 2.0)); g.add(box(1.7, 0.6, 1.0, dark, 0, 1.7, 2.3)); const tk = mesh(new T.CylinderGeometry(0.95, 0.95, 4, 14), mat(P.fuel), 0, 1.35, -0.8); tk.rotation.x = Math.PI / 2; g.add(tk); }
    else if (kind === 'cater') {
      g.add(box(1.8, 1.1, 1.6, 0xffffff, 0, 0.9, 2.0)); g.add(box(1.7, 0.5, 1.0, dark, 0, 1.6, 2.3)); g.add(box(1.8, 0.4, 3.8, 0x9aa3ad, 0, 0.6, -0.7));
      parts.box = box(1.9, 1.6, 3.4, 0xffffff, 0, 1.6, -0.7); g.add(parts.box);
      parts.stripe = box(1.92, 0.25, 3.42, 0xff9f0a, 0, 1.6, -0.7); g.add(parts.stripe);
    } else if (kind === 'van') {
      g.add(box(2.0, 1.8, 4.2, 0xffffff, 0, 1.2, 0)); g.add(box(2.02, 0.35, 4.22, 0x0a84ff, 0, 1.0, 0)); g.add(box(1.9, 0.7, 0.1, dark, 0, 1.6, 2.1));
      parts.beacon = glow(0x64d2ff, 1.8); parts.beacon.position.set(0, 2.4, 0); g.add(parts.beacon);
    } else {
      const r = Math.random();
      const col = kind === 'taxi' ? 0xf2c14e : kind === 'bus' ? 0xffffff : [0x5b8def, 0xd9534f, 0x9aa3ad, 0x2b2f36, 0xf4f1ec, 0x6aa36b][Math.floor(r * 6)];
      const Ln = kind === 'bus' ? 8 : 3.4;
      g.add(box(1.7, 0.7, Ln, col, 0, 0.6, 0));
      if (kind === 'bus') { g.add(box(1.5, 1.3, Ln - 0.4, col, 0, 1.5, 0)); g.add(box(1.52, 0.5, Ln - 0.6, dark, 0, 1.7, 0)); g.add(box(1.72, 0.2, Ln, 0x0a84ff, 0, 0.9, 0)); }
      else g.add(box(1.5, 0.6, 1.8, dark, 0, 1.2, -0.2));
      parts.hl = glow(0xfff3cf, 2.2, 0); parts.hl.position.set(0, 0.7, Ln / 2 + 0.3); g.add(parts.hl);
    }
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    world.add(g);
    return { kind, g, parts, path: null, s: 0, speed: 0, max: kind === 'bus' ? 7 : kind === 'van' ? 9 : 6, state: 'idle' };
  }

  /* ================================================== SIMULATION */
  const SIM = { t: 0, speed: 1, aircraft: [], vehicles: [], stands: {}, runway: null };
  TEAMS.forEach(g => {
    const st = SIM.stands[g.id] = { gate: g, x: g.x, ac: null, reserved: null };
    const depot = { cater: V(g.x + 3.2, 0, -8.6), tug: V(g.x + 6.2, 0, -8.6), bag: V(g.x + 9.2, 0, -8.6), fuel: V(g.x + 12.6, 0, -8.6) };
    ['tug', 'bag', 'fuel', 'cater'].forEach(k => {
      const v = makeVehicle(k); v.home = depot[k]; v.g.position.copy(v.home); v.g.rotation.y = Math.PI; v.stand = g.id; v.id = g.id + '-' + k; v.vk = k;
      st[k] = v; SIM.vehicles.push(v); pickable(v.g, { kind: 'vehicle', id: v.id });
    });
  });
  function servicePos(st, k) {
    const x = st.x;
    return { bag: { p: V(x + 3.4, 0, STAND_Z - 3.4), face: 0 }, fuel: { p: V(x + 7.4, 0, STAND_Z - 1.0), face: 0 }, cater: { p: V(x + 2.8, 0, STAND_Z + 3.4), face: -Math.PI / 2 }, tug: { p: V(x, 0, STAND_Z + 7.4), face: Math.PI } }[k];
  }
  function driveTo(v, target, face, cb) {
    const a = v.g.position, midZ = -12.6;
    const pts = [[a.x, a.z], [a.x, midZ], [target.x, midZ], [target.x, target.z]].filter((p, i, arr) => i === 0 || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.3);
    if (pts.length < 2) { cb && cb(); return; }
    v.path = roundedPath(pts, 2.2, 0); v.s = 0; v.state = 'driving'; v.onArrive = cb; v.endFace = face;
  }
  function driveHome(v) { driveTo(v, v.home, Math.PI, () => { v.state = 'idle'; }); }

  // landside traffic
  const roadLoop = roundedPath([[-210, 36], [210, 36], [210, 32], [60, 32], [52, 22.8], [-52, 22.8], [-60, 32], [-210, 32], [-210, 36]], 4, 0);
  const roadMain = roundedPath([[230, 31.6], [-230, 31.6]], 4, 0);
  const cars = [];
  const nCars = isPhone ? 6 : 10;
  for (let i = 0; i < nCars; i++) { const kind = i === 0 ? 'bus' : i % 3 === 0 ? 'taxi' : 'car'; const v = makeVehicle(kind); v.path = roadLoop; v.s = i * roadLoop._len / nCars; v.speed = v.max; v.loop = true; cars.push(v); }
  for (let i = 0; i < 4; i++) { const v = makeVehicle('car'); v.path = roadMain; v.s = i * roadMain._len / 4; v.speed = v.max; v.loop = true; v.through = true; cars.push(v); }

  // Jarvis's van
  const van = makeVehicle('van');
  van.path = roundedPath([[-94, -12.6], [82, -12.6], [82, -2.4], [-94, -2.4], [-94, -12.6]], 5, 0);
  van.loop = true; van.id = 'jarvis-van'; van.vk = 'van'; SIM.vehicles.push(van); pickable(van.g, { kind: 'vehicle', id: 'jarvis-van' });
  van.path = roundedPath([[-94, -12.6], [80, -12.6], [80, -15.5], [-94, -15.5], [-94, -12.6]], 1.4, 0);

  function arrivalPaths(st) {
    return {
      approach: line(V(-330, 34, RWY_Z), V(-142, 0, RWY_Z)),
      roll: line(V(-142, 0, RWY_Z), V(78, 0, RWY_Z)),
      taxi: roundedPath([[78, RWY_Z], [96, RWY_Z], [96, TWY_Z], [st.x, TWY_Z], [st.x, STAND_Z]], 7, 0)
    };
  }
  function departurePaths(st) {
    return {
      push: roundedPath([[st.x, STAND_Z], [st.x, TWY_Z], [st.x + 12, TWY_Z]], 7, 0),
      taxi: roundedPath([[st.x + 12, TWY_Z], [-122, TWY_Z], [-122, RWY_Z], [-110, RWY_Z]], 7, 0),
      roll: line(V(-110, 0, RWY_Z), V(32, 0, RWY_Z)),
      climb: line(V(32, 0, RWY_Z), V(340, 64, RWY_Z))
    };
  }
  const _to = V(0, 0, 0);
  function blockedAhead(me, others, dist, cone, dir) {
    const p = me.g.position;
    for (const o of others) {
      if (o === me || !o.g.visible || o.state === 'queued' || o.state === 'approach' || o.state === 'climb' || o.state === 'gone') continue;
      _to.subVectors(o.g.position, p); _to.y = 0; const d = _to.length(); if (d > dist || d < 0.01) continue;
      if (_to.divideScalar(d).dot(dir) > cone) return o;
    }
    return null;
  }

  function makeAircraft(item) {
    const j = makeJet(P.livery[item.type] || 0xff9f0a);
    const pool = new T.Mesh(new T.PlaneGeometry(9, 16), new T.MeshBasicMaterial({ map: GLOW, color: 0xfff1d0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.25, 13); j.g.add(pool); j.pool = pool;
    world.add(j.g); j.g.visible = false;
    const ac = Object.assign(j, { item, state: 'queued', s: 0, speed: 0, heading: 0, timer: 0, phase: 0 });
    pickable(j.g, { kind: 'flight', id: item.key });
    return ac;
  }
  function standFree(st) { return !st.ac && !st.reserved; }
  function trySpawn() {
    if (SIM.runway || SIM.aircraft.some(a => a.holding)) return;
    const ac = SIM.aircraft.find(a => a.state === 'queued' && standFree(SIM.stands[a.item.gate]));
    if (!ac) return;
    const st = SIM.stands[ac.item.gate];
    st.reserved = ac; ac.stand = st; ac.paths = arrivalPaths(st);
    ac.state = 'approach'; ac.s = 0; ac.g.visible = true; SIM.runway = ac; ac.item.status = 'Inbound';
    UI && UI.dirty();
  }
  function setStep(ac, i) { ac.item.step = i; ac.item.stepAt[i] = clockStr(); ac.item.status = STEP_KEYS[i]; UI && UI.dirty(); }
  function gateAgents(gateId) { return people.filter(p => p.gate.id === gateId); }
  function turnaround(ac, dt) {
    const st = ac.stand, gid = st.gate.id; ac.timer += dt;
    const s = SIM.speed ? 1 : 1;
    switch (ac.phase) {
      case 0: bridges[gid].target = 1; if (ac.timer > 2.5) { ac.phase = 1; ac.timer = 0; setStep(ac, 1); driveTo(st.bag, servicePos(st, 'bag').p, 0, () => { st.bag.state = 'working'; }); } break;
      case 1:
        if (ac.timer > 3 && !ac.caterSent) { ac.caterSent = true; driveTo(st.cater, servicePos(st, 'cater').p, -Math.PI / 2, () => { st.cater.state = 'working'; st.cater.lift = 1; }); }
        if (ac.timer > 9) { ac.phase = 2; ac.timer = 0; setStep(ac, 2); driveHome(st.bag); const w = gateAgents(gid).filter(p => p.agent.state === 'working'); if (w.length && Math.random() < 0.7) sendWalk(w[Math.floor(Math.random() * w.length)], 'brain'); }
        break;
      case 2:
        if (ac.timer > 3 && !ac.fuelSent) { ac.fuelSent = true; driveTo(st.fuel, servicePos(st, 'fuel').p, 0, () => { st.fuel.state = 'working'; }); }
        if (ac.timer > 8) { ac.phase = 3; ac.timer = 0; setStep(ac, 3); st.cater.lift = 0; later(() => driveHome(st.cater), 1200); }
        break;
      case 3: if (ac.timer > 8) { ac.phase = 4; ac.timer = 0; setStep(ac, 4); driveHome(st.fuel); } break;
      case 4: if (ac.timer > 6) { ac.phase = 5; ac.timer = 0; setStep(ac, 5); bridges[gid].target = 0; driveTo(st.tug, servicePos(st, 'tug').p, Math.PI, () => { st.tug.state = 'attached'; }); } break;
      case 5: {
        if (st.tug.state === 'attached' && bridges[gid].k < 0.08) {
          const busy = SIM.aircraft.some(o => o !== ac && o.g.visible && ['taxiIn', 'taxiOut', 'pushback'].includes(o.state) && Math.abs(o.g.position.z - TWY_Z) < 10 && o.g.position.x > st.x - 16 && o.g.position.x < st.x + 46);
          if (!busy) { ac.paths = departurePaths(st); ac.state = 'pushback'; ac.s = 0; ac.speed = 0; ac.path = ac.paths.push; ac.item.status = 'Pushback'; UI && UI.dirty(); }
        }
      }
    }
  }
  function updateAircraft(ac, dt) {
    const g = ac.g;
    if (ac.state === 'queued' || ac.state === 'gone') return;
    const fwd = V(Math.sin(ac.heading), 0, Math.cos(ac.heading));
    switch (ac.state) {
      case 'approach': {
        ac.s += 28 * dt; const u = clamp(ac.s / ac.paths.approach._len, 0, 1);
        g.position.copy(ac.paths.approach.getPointAt(u)); ac.heading = Math.PI / 2; g.rotation.set(0, ac.heading, 0); g.rotateX(-0.06);
        ac.gearK = u > 0.35 ? 1 : 0;
        if (u >= 1) { ac.state = 'roll'; ac.s = 0; ac.speed = 28; ac.item.status = 'Landed'; UI && UI.dirty(); }
        break;
      }
      case 'roll': {
        ac.speed = Math.max(7, ac.speed - 6.5 * dt); ac.s += ac.speed * dt; const u = clamp(ac.s / ac.paths.roll._len, 0, 1);
        g.position.copy(ac.paths.roll.getPointAt(u)); g.rotation.set(0, Math.PI / 2, 0); ac.heading = Math.PI / 2;
        if (u >= 1) { ac.state = 'taxiIn'; ac.s = 0; ac.path = ac.paths.taxi; ac.item.status = 'Taxi in'; UI && UI.dirty(); }
        break;
      }
      case 'taxiIn': case 'taxiOut': case 'pushback': {
        const path = ac.path, rev = ac.state === 'pushback';
        const dir = rev ? fwd.clone().negate() : fwd;
        const blocker = blockedAhead(ac, SIM.aircraft, rev ? 10 : 19, 0.72, dir);
        ac.speed = lerp(ac.speed, blocker ? 0 : (rev ? 2.4 : 7.5), 1 - Math.exp(-dt * (blocker ? 4 : 1.2)));
        if (ac.state === 'taxiOut') {
          const holdS = path._len - 22;
          if (ac.s >= holdS - 0.5 && SIM.runway !== ac) {
            if (!SIM.runway) { SIM.runway = ac; ac.holding = false; }
            else { ac.speed = 0; ac.s = Math.min(ac.s, holdS); ac.holding = true; }
          }
        }
        ac.s = Math.min(path._len, ac.s + ac.speed * dt);
        const u = ac.s / path._len;
        g.position.copy(path.getPointAt(u));
        const tan = path.getTangentAt(Math.min(u, 0.9999));
        let h = Math.atan2(tan.x, tan.z); if (rev) h += Math.PI;
        ac.heading = angLerp(ac.heading, h, 1 - Math.exp(-dt * 10)); g.rotation.set(0, ac.heading, 0);
        if (rev) { const tug = ac.stand.tug, n = V(Math.sin(ac.heading), 0, Math.cos(ac.heading)); tug.g.position.copy(g.position).addScaledVector(n, 7.4); tug.g.rotation.y = ac.heading + Math.PI; }
        if (ac.state === 'taxiIn' && SIM.runway === ac && g.position.z > RWY_Z + 9) SIM.runway = null;
        if (u >= 1) {
          if (ac.state === 'taxiIn') { ac.state = 'onBlock'; ac.phase = 0; ac.timer = 0; ac.stand.ac = ac; ac.stand.reserved = null; setStep(ac, 0); g.rotation.set(0, 0, 0); ac.heading = 0; }
          else if (ac.state === 'pushback') { ac.state = 'taxiOut'; ac.s = 0; ac.path = ac.paths.taxi; ac.speed = 0; const st = ac.stand; st.ac = null; st.tug.state = 'returning'; later(() => driveHome(st.tug), 700); ac.item.status = 'Taxi out'; UI && UI.dirty(); }
          else { ac.state = 'takeoff'; ac.s = 0; ac.speed = 2; ac.holding = false; }
        }
        break;
      }
      case 'onBlock': turnaround(ac, dt); break;
      case 'takeoff': {
        ac.speed += 9 * dt; ac.s += ac.speed * dt; const u = clamp(ac.s / ac.paths.roll._len, 0, 1);
        g.position.copy(ac.paths.roll.getPointAt(u)); g.rotation.set(0, Math.PI / 2, 0); ac.heading = Math.PI / 2;
        if (u >= 1) { ac.state = 'climb'; ac.s = 0; }
        break;
      }
      case 'climb': {
        ac.speed = Math.min(42, ac.speed + 6 * dt); ac.s += ac.speed * dt; const u = clamp(ac.s / ac.paths.climb._len, 0, 1);
        g.position.copy(ac.paths.climb.getPointAt(u)); g.rotation.set(0, Math.PI / 2, 0); g.rotateX(-0.2);
        ac.gearK = u > 0.06 ? 0 : 1;
        if (SIM.runway === ac && g.position.y > 4) SIM.runway = null;
        if (u >= 1) { ac.state = 'gone'; g.visible = false; ac.item.status = 'Departed'; UI && UI.dirty(); }
        break;
      }
    }
    const gk = ac.gearK === undefined ? 1 : ac.gearK; ac.gearS = lerp(ac.gearS === undefined ? 1 : ac.gearS, gk, 1 - Math.exp(-dt * 3));
    ac.gear.scale.y = Math.max(0.01, ac.gearS); ac.gear.visible = ac.gearS > 0.05;
    const airborne = ['approach', 'climb', 'takeoff', 'roll'].includes(ac.state);
    ac.strobe.material.opacity = airborne ? ((SIM.t * 1.3) % 1 < 0.08 ? 1 : 0) : 0;
    ac.navs.forEach(n => n.material.opacity = 0.25 + ENV.night * 0.75);
    const moving = ac.state !== 'onBlock';
    ac.land.material.opacity = (airborne || ac.state === 'taxiIn' || ac.state === 'taxiOut') ? 0.25 + ENV.night * 0.75 : 0;
    ac.beacon.material.opacity = moving ? ((SIM.t * 1.1 + 0.4) % 1 < 0.12 ? 1 : 0.08) : 0;
    if (ac.pool) { ac.pool.material.opacity = (ac.state === 'taxiIn' || ac.state === 'taxiOut' || ac.state === 'roll' || ac.state === 'takeoff') ? ENV.night * 0.55 : 0; }
  }
  function updateVehicle(v, dt) {
    if (v.parts.box) { v.liftY = lerp(v.liftY || 0, v.lift ? 2.6 : 0, 1 - Math.exp(-dt * 1.5)); v.parts.box.position.y = 1.6 + v.liftY; v.parts.stripe.position.y = 1.6 + v.liftY; }
    if (v.parts.hl) v.parts.hl.material.opacity = ENV.night * 0.9;
    if (!v.loop && v.state !== 'driving') return;
    const path = v.path; if (!path) return;
    const fwd = V(Math.sin(v.g.rotation.y), 0, Math.cos(v.g.rotation.y));
    let blocker = blockedAhead(v, SIM.aircraft, 13, 0.55, fwd);
    if (!blocker) blocker = blockedAhead(v, v.loop && v !== van ? cars : SIM.vehicles.filter(o => o.state === 'driving' || o.state === 'working' || o === van), v.kind === 'bus' ? 9 : 5.5, 0.8, fwd);
    if (v.loop && !v.through && v !== van) {
      const p = v.g.position;
      if (v.kerbX === undefined) v.kerbX = (Math.random() - 0.5) * 80;
      if (!v.stopped && Math.abs(p.z - 22.8) < 0.8 && Math.abs(p.x - v.kerbX) < 1.5) { v.stopped = 3 + Math.random() * 4; v.kerbX = (Math.random() - 0.5) * 80; }
    }
    if (v.stopped) { v.stopped = Math.max(0, v.stopped - dt); if (v.stopped > 0) blocker = blocker || v; }
    if (v === van && ENV.sweepK <= 0) blocker = v;
    v.speed = lerp(v.speed, blocker ? 0 : v.max, 1 - Math.exp(-dt * (blocker ? 5 : 1.5)));
    v.s += v.speed * dt; if (v.loop) v.s %= path._len;
    const u = clamp(v.s / path._len, 0, 1);
    v.g.position.copy(path.getPointAt(u));
    const tan = path.getTangentAt(Math.min(u, 0.9999));
    v.g.rotation.y = angLerp(v.g.rotation.y, Math.atan2(tan.x, tan.z), 1 - Math.exp(-dt * 8));
    if (!v.loop && u >= 1) { v.state = 'arrived'; if (v.endFace !== undefined) v.g.rotation.y = v.endFace; const cb = v.onArrive; v.onArrive = null; cb && cb(); if (v.state === 'arrived') v.state = 'working'; }
  }
  function startSweep() {
    if (ENV.sweepK > 0.2) return;
    ENV.sweepK = 1; van.speed = 2;
    gateAgents('A').forEach((p, i) => later(() => sendWalk(p, 'brain'), 400 + i * 700));
    UI && UI.dirty();
  }

  /* ================================================== ENVIRONMENT */
  const ENV = { mode: 'auto', weather: 'clear', night: 0, hour: 12, brainPulse: 0, sweepK: 0, lightning: 0, deep: false };
  const RN = isPhone ? 1200 : 2400, rpos = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 420, y = Math.random() * 120, z = (Math.random() - 0.5) * 320 - 10; rpos.set([x, y, z, x + 0.3, y - 2.2, z], i * 6); }
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rpos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.5 })); rain.visible = false; scene.add(rain);
  const stars = (() => { const n = 900, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45; a.set([Math.cos(th) * Math.sin(ph) * 1400, Math.cos(ph) * 1400 + 100, Math.sin(th) * Math.sin(ph) * 1400], i * 3); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3)); const p = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 })); scene.add(p); return p; })();
  const dust = (() => { const n = 1400, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([(Math.random() - 0.5) * 420, Math.random() * 50, (Math.random() - 0.5) * 320], i * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3)); const p = new T.Points(g, new T.PointsMaterial({ color: 0xe0a066, size: 0.9, transparent: true, opacity: 0.6 })); p.visible = false; scene.add(p); return p; })();
  const SKY = {
    day:   { bg: 0xe3ebf0, hs: 0xf4f7fb, hg: 0xa3ab98, hi: 0.5, sun: 0xfff7ee, si: 0.78, fn: 380, ff: 900 },
    dusk:  { bg: 0xf2c9ab, hs: 0xffd6b0, hg: 0x8a7f86, hi: 0.45, sun: 0xff9a5a, si: 0.7, fn: 320, ff: 850 },
    night: { bg: 0x101a2b, hs: 0x5a6f9a, hg: 0x1b2230, hi: 0.42, sun: 0xa9bcff, si: 0.32, fn: 300, ff: 900 }
  };
  const WX = { clear: { fog: 1, tint: null, wet: 0, sun: 1 }, rain: { fog: 0.55, tint: 0xaab4bf, wet: 1, sun: 0.45 }, fog: { fog: 0.16, tint: 0xd5dade, wet: 0.3, sun: 0.5 }, calima: { fog: 0.34, tint: 0xe2b27c, wet: 0, sun: 0.7 }, storm: { fog: 0.4, tint: 0x6f7a88, wet: 1, sun: 0.35 } };
  const c1 = new T.Color(), c2 = new T.Color(), c3 = new T.Color();
  function zoneHour() {
    try { const s = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); const [h, m] = s.split(':').map(Number); return (h % 24) + m / 60; }
    catch (e) { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  }
  function updateEnv(dt) {
    const h = ENV.mode === 'auto' ? zoneHour() : ENV.mode === 'day' ? 12.5 : 23;
    ENV.hour = h;
    const rise = 7, set = 20;     // the room's day is 07:00 to 20:00 Madrid
    let n;
    if (h >= rise + 0.75 && h <= set - 0.75) n = 0; else if (h < rise - 0.5 || h > set + 0.75) n = 1;
    else if (h < 12) n = 1 - clamp((h - (rise - 0.5)) / 1.25, 0, 1); else n = clamp((h - (set - 0.75)) / 1.5, 0, 1);
    if (ENV.deep && n > 0.5) n = Math.min(1, n * 1.08);
    ENV.night = lerp(ENV.night, n, 1 - Math.exp(-dt * 2));
    const k = ENV.night, dusk = 1 - Math.abs(k - 0.5) * 2;
    const mix = (a, b, c) => { c1.setHex(a).lerp(c2.setHex(b), k); return c1.lerp(c3.setHex(c), dusk * 0.6); };
    const wx = WX[ENV.weather] || WX.clear;
    const bg = mix(SKY.day.bg, SKY.night.bg, SKY.dusk.bg).clone(); if (wx.tint) bg.lerp(c2.setHex(wx.tint).multiplyScalar(1 - k * 0.75), 0.6);
    if (ENV.deep) bg.multiplyScalar(1 - k * 0.35);
    scene.background.copy(bg); scene.fog.color.copy(bg);
    scene.fog.near = lerp(SKY.day.fn, SKY.night.fn, k) * wx.fog; scene.fog.far = lerp(SKY.day.ff, SKY.night.ff, k) * (0.35 + wx.fog * 0.65);
    hemi.color.copy(mix(SKY.day.hs, SKY.night.hs, SKY.dusk.hs)); hemi.groundColor.copy(mix(SKY.day.hg, SKY.night.hg, SKY.dusk.hg));
    hemi.intensity = lerp(SKY.day.hi, SKY.night.hi, k) * LS * (wx.tint ? 0.92 : 1);
    sun.color.copy(mix(SKY.day.sun, SKY.night.sun, SKY.dusk.sun)); sun.intensity = lerp(SKY.day.si, SKY.night.si, k) * LS * wx.sun;
    const ang = ((clamp(h, 6, 21) - 6) / 15) * Math.PI;
    sun.position.set(Math.cos(ang) * 260 + 30, 160 + Math.sin(ang) * 140, 150); sun.target.position.set(0, 0, -15);
    flash.intensity = ENV.lightning * 3 * LS;
    windowMats.forEach(m => m.emissiveIntensity = k * 1.1);
    edgeMats.forEach(e => { e.m.color.setHex(e.c).multiplyScalar(0.35 + k * 0.9); });
    approachGlows.forEach((s, i) => s.material.opacity = k * (((SIM.t * 2 - i * 0.12) % 1) < 0.15 ? 1 : 0.3));
    lampMats.forEach(m => m.color.setHex(k > 0.45 ? 0xfff2c8 : 0x8a8a8a));
    beaconM.color.setHex(k > 0.45 ? ((SIM.t % 1.4) < 0.7 ? 0xff453a : 0x5a1a14) : 0xb23a2a);
    floodGlows.forEach(g => g.material.opacity = k * 0.8);
    beam.material.opacity = 0.04 + k * 0.07;
    pools.forEach(m => m.material.opacity = k * 0.5);
    if (edgeGlow) edgeGlow.material.opacity = clamp(k * 1.3 - 0.15, 0, 1);
    stars.material.opacity = clamp(k * 1.2 - 0.2, 0, 1) * (ENV.weather === 'clear' ? 1 : 0.1);
    rain.visible = ENV.weather === 'rain' || ENV.weather === 'storm'; dust.visible = ENV.weather === 'calima';
    surfMats.forEach(m => { m.roughness = lerp(0.86, 0.2, wx.wet); m.metalness = wx.wet * 0.15; });
    // sky dome: zenith colour by time of day, horizon = fog colour, sun glow
    c1.setHex(0x6fa3d8).lerp(c2.setHex(0x050a16), k); c1.lerp(c3.setHex(0x5a6ea8), dusk * 0.5);
    if (wx.tint) c1.lerp(c2.setHex(wx.tint).multiplyScalar(1 - k * 0.8), 0.7);
    skyU.top.value.copy(c1); skyU.mid.value.copy(bg); skyU.sunDir.value.copy(sun.position).normalize();
    skyU.sunCol.value.copy(sun.color); skyU.glowK.value = (1 - k * 0.85) * (ENV.weather === 'clear' ? 1 : 0.3);
    clouds.mat.color.setHex(0xffffff).lerp(c2.setHex(0x2c3550), k * 0.85); if (wx.tint) clouds.mat.color.lerp(c2.setHex(wx.tint), 0.5);
    hillMat.color.setHex(0x9db08f).lerp(c2.setHex(0x1c2433), k * 0.6);
    brainHalo.material.opacity = 0.3 + k * 0.2 + ENV.brainPulse * 0.4;
  }

  /* ================================================== CAMERA */
  const CAM = { target: V(-4, 6, -20), dist: 300, az: -0.62, pol: 0.92, follow: null, tween: null, moved: true };
  const AREAS = {
    overview: { t: [-4, 6, -20], d: 300, az: -0.62, pol: 0.9 },
    gates: { t: [0, 2, -6], d: 100, az: -0.45, pol: 0.86 },
    brain: { t: [0, 43, 6], d: 70, az: -0.5, pol: 1.18 },
    workshop: { t: [HANGAR.x, 2, HANGAR.z], d: 74, az: -0.85, pol: 0.82 },
    fleet: { t: [-112, 2, -28], d: 80, az: -1.1, pol: 0.9 },
    runway: { t: [-10, 0, RWY_Z], d: 270, az: -0.22, pol: 1.0 },
    landside: { t: [0, 0, 28], d: 130, az: 0.55, pol: 0.95 }
  };
  if (isPhone) { AREAS.overview.d = 470; CAM.dist = 470; AREAS.gates.d = 170; AREAS.brain.d = 95; }
  function applyCam() {
    const t = CAM.target, d = CAM.dist;
    camera.position.set(t.x + d * Math.sin(CAM.pol) * Math.sin(CAM.az), t.y + d * Math.cos(CAM.pol), t.z + d * Math.sin(CAM.pol) * Math.cos(CAM.az));
    camera.lookAt(t);
  }
  function followPoint(o) { const p = V(0, 0, 0); o.getWorldPosition(p); if (o !== brainGroup) p.y += 2; return p; }
  function flyTo(t, d, az, pol, ms = 900, follow = null) {
    CAM.follow = follow;
    CAM.tween = { from: { t: CAM.target.clone(), d: CAM.dist, az: CAM.az, pol: CAM.pol }, to: { t: t.clone(), d, az: az == null ? CAM.az : az, pol: pol == null ? CAM.pol : pol }, k: 0, start: performance.now(), ms: reduced ? 1 : ms };
  }
  function flyArea(name) { const a = AREAS[name]; if (!a) return; clearSel(); flyTo(V(...a.t), a.d, a.az, a.pol, 1100, null); }
  // cinematic tour: glide between the most interesting places, drift slowly at each
  const TOUR = { on: false, i: 0, t: 0 };
  const TOUR_STOPS = [
    () => { flyTo(V(TOWER.x, BRAIN_Y, TOWER.z), isPhone ? 95 : 70, CAM.az + 0.6, 1.2, 2600, null); return 9; },
    () => { const a = SIM.aircraft.find(a => ['approach', 'roll', 'taxiIn', 'taxiOut', 'takeoff'].includes(a.state)); if (!a) return 0; flyTo(followPoint(a.g), isPhone ? 90 : 60, -0.9, 1.0, 2600, a.g); return 10; },
    () => { flyTo(V(0, 2, -6), isPhone ? 150 : 95, -0.2, 0.9, 2600, null); return 8; },
    () => { const a = SIM.aircraft.find(a => a.state === 'onBlock'); if (!a) return 0; flyTo(followPoint(a.g), isPhone ? 70 : 48, 0.7, 0.85, 2600, null); return 9; },
    () => { flyTo(V(HANGAR.x, 2, HANGAR.z + 2), isPhone ? 90 : 62, -1.0, 0.75, 2600, null); return 7; },
    () => { flyTo(V(-112, 2, -28), isPhone ? 100 : 70, -1.5, 0.95, 2600, null); return 7; },
    () => { flyTo(V(-40, 9, 14.4), isPhone ? 80 : 56, 0.15, 1.3, 2600, null); return 7; },
    () => { flyTo(V(-4, 6, -20), isPhone ? 470 : 300, -0.62, 0.9, 3000, null); return 8; }
  ];
  function tour(on) { TOUR.on = on; TOUR.t = 0; if (!on) CAM.follow = null; UI && UI.tourState && UI.tourState(on); }
  function tourTick(dt) {
    if (!TOUR.on) return;
    TOUR.t -= dt;
    if (!CAM.tween) CAM.az += dt * 0.035;
    if (TOUR.t <= 0) { let tries = 0, d = 0; while (!d && tries++ < TOUR_STOPS.length) { d = TOUR_STOPS[TOUR.i % TOUR_STOPS.length](); TOUR.i++; } TOUR.t = d || 6; }
  }
  function updateCam(dt) {
    if (CAM.tween) {
      const tw = CAM.tween; tw.k = Math.min(1, (performance.now() - tw.start) / tw.ms); const e = smooth(tw.k);
      const tgt = CAM.follow ? followPoint(CAM.follow) : tw.to.t;
      CAM.target.lerpVectors(tw.from.t, tgt, e); CAM.dist = lerp(tw.from.d, tw.to.d, e);
      CAM.az = angLerp(tw.from.az, tw.to.az, e); CAM.pol = lerp(tw.from.pol, tw.to.pol, e);
      if (tw.k >= 1) CAM.tween = null;
    } else if (CAM.follow) CAM.target.lerp(followPoint(CAM.follow), 1 - Math.exp(-dt * 4));
    CAM.pol = clamp(CAM.pol, 0.22, 1.4); CAM.dist = clamp(CAM.dist, 12, 560);
    applyCam();
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(V(0, 1, 0), 0);
  function setNdc(x, y) { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function groundAt(x, y) { setNdc(x, y); const p = V(0, 0, 0); return ray.ray.intersectPlane(ground, p) ? p : null; }
  function pickAt(x, y) {
    // brain nodes first when close enough to read them
    const n = brainNodeAt(x, y); if (n) return { userData: { pick: { kind: 'node', id: n.node.id, node: n.node } } };
    setNdc(x, y);
    const hits = ray.intersectObjects(pickables, true);
    for (const h of hits) { let o = h.object, vis = true; while (o && !o.userData.pick) { if (!o.visible) vis = false; o = o.parent; } if (o && vis && o.visible) return o; }
    return null;
  }
  const _np = V(0, 0, 0);
  function brainNodeAt(x, y) {
    if (!BR.centers.length || CAM.dist > (isPhone ? 130 : 110)) return null;
    const r = canvas.getBoundingClientRect(); let best = null, bd = 16;
    const spin = BR.spin || 0;
    for (const c of BR.centers) {
      const cx = c.p.x * Math.cos(spin) - c.p.z * Math.sin(spin), cz = c.p.x * Math.sin(spin) + c.p.z * Math.cos(spin);
      _np.set(cx, c.p.y, cz).multiplyScalar(BRAIN_S).add(brainGroup.position).project(camera);
      const sx = (_np.x + 1) / 2 * r.width + r.left, sy = (1 - _np.y) / 2 * r.height + r.top;
      const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  (function controls() {
    const el = canvas; let drag = null, pinch = null, moved = 0, lastTap = 0, lastTapInfo = null;
    const pts = new Map();
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (TOUR.on) tour(false);
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
      if (pts.size === 1) drag = { btn: (e.button === 2 || e.shiftKey || e.altKey) ? 'rot' : 'pan', type: e.pointerType };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; drag = null; }
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) { hover(e); return; }
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        CAM.dist *= pinch.d / Math.max(1, d); CAM.az -= (ang - pinch.ang);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; panBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
        pinch = { d, ang, mid }; CAM.tween = null; moved += 10; return;
      }
      if (!drag) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y; moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 5) return;
      CAM.tween = null; hideTip();
      if (drag.btn === 'rot') { CAM.az -= dx * 0.006; CAM.pol -= dy * 0.005; }
      else { CAM.follow = null; panBy(dx, dy); }
    });
    const up = e => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        if (moved < 6 && drag) {
          const o = pickAt(e.clientX, e.clientY); const info = o ? o.userData.pick : null;
          if (drag.type === 'touch' && info) {
            // touch: first tap shows the quick card, a second tap on the same thing opens it
            const same = lastTapInfo && info.kind === lastTapInfo.kind && String(info.id) === String(lastTapInfo.id) && Date.now() - lastTap < 4000;
            if (same) { select(info); hideTip(); } else { showTip(info, e.clientX, e.clientY); }
            lastTap = Date.now(); lastTapInfo = info;
          } else if (info) select(info);
          else { if (Date.now() - lastTap < 320) flyArea('overview'); lastTap = Date.now(); lastTapInfo = null; clearSel(); hideTip(); UI && UI.select(null); }
        }
        drag = null;
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      e.preventDefault(); CAM.tween = null; if (TOUR.on) tour(false);
      const before = groundAt(e.clientX, e.clientY);
      CAM.dist = clamp(CAM.dist * Math.exp(e.deltaY * 0.0012), 12, 560); applyCam();
      const after = groundAt(e.clientX, e.clientY);
      if (before && after && !CAM.follow) CAM.target.add(before.sub(after));
    }, { passive: false });
    function panBy(dx, dy) {
      const s = CAM.dist * 0.0016 * (900 / Math.max(420, el.clientHeight));
      const right = V(Math.cos(CAM.az), 0, -Math.sin(CAM.az)), fwd = V(Math.sin(CAM.az), 0, Math.cos(CAM.az));
      CAM.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
      CAM.target.x = clamp(CAM.target.x, -230, 230); CAM.target.z = clamp(CAM.target.z, -170, 120);
    }
    host.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      const k = e.key; let hit = true;
      if (k === '+' || k === '=') CAM.dist *= 0.85; else if (k === '-' || k === '_') CAM.dist *= 1.18; else if (k === '0') flyArea('overview');
      else if (k === 'ArrowLeft') { CAM.follow = null; panBy(60, 0); } else if (k === 'ArrowRight') { CAM.follow = null; panBy(-60, 0); }
      else if (k === 'ArrowUp') { CAM.follow = null; panBy(0, 60); } else if (k === 'ArrowDown') { CAM.follow = null; panBy(0, -60); }
      else if (k === 'Escape') { clearSel(); UI && UI.select(null); } else hit = false;
      if (hit) { CAM.tween = null; e.preventDefault(); }
    });
    host.tabIndex = 0;
  })();
  let hovered = null;
  function hover(e) {
    if (e.pointerType === 'touch') return;
    const o = pickAt(e.clientX, e.clientY);
    canvas.style.cursor = o ? 'pointer' : 'grab';
    const info = o ? o.userData.pick : null;
    if (info) showTip(info, e.clientX, e.clientY); else hideTip();
    hovered = info;
  }
  function showTip(info, x, y) { UI && UI.tip(info, x, y); }
  function hideTip() { UI && UI.tip(null); }

  /* ---------- selection ---------- */
  const selRing = mesh(new T.RingGeometry(1, 1.22, 48), new T.MeshBasicMaterial({ color: 0xff9f0a, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide }), 0, 0.3, 0, false, false);
  selRing.rotation.x = -Math.PI / 2; selRing.visible = false; scene.add(selRing);
  let SEL = null;
  function objFor(info) {
    if (!info) return null;
    if (info.kind === 'flight') { const a = SIM.aircraft.find(a => a.item.key === info.id); return a && a.g.visible ? a.g : null; }
    if (info.kind === 'agent') { const a = D.byId.get(info.id); return a && a._p ? a._p.g : null; }
    if (info.kind === 'vehicle') { const v = SIM.vehicles.find(v => v.id === info.id); return v ? v.g : null; }
    if (info.kind === 'fleet') { const f = fleetObjs.find(f => f.f.reg === info.id); return f ? f.g : null; }
    return null;
  }
  function select(info) {
    SEL = info; hideTip();
    if (!info) { clearSel(); UI && UI.select(null); return; }
    if (info.kind === 'board') {
      const b = boards.find(b => (b.kind === 'dep' ? 'departures' : 'arrivals') === info.id);
      if (b) flyTo(V(b.grp.position.x, 8, 14.4), isPhone ? 70 : 46, 0.0, 1.32, 900, null);
      selRing.visible = false; UI && UI.openTab(info.id); return;
    }
    if (info.kind === 'team') {
      const g = teamOf(info.id); const x = g.id === 'D' ? HANGAR.x : g.x, z = g.id === 'D' ? HANGAR.z + 4 : 3.5;
      flyTo(V(x, 1, z), g.id === 'D' ? 62 : 46, CAM.az, 0.88, 900, null);
      selRing.visible = true; selRing.position.set(x, 0.75, z); selRing.scale.setScalar(g.id === 'D' ? 17 : 10);
    } else if (info.kind === 'brain' || info.kind === 'node') {
      if (CAM.dist > 110 || info.kind === 'brain') flyTo(V(TOWER.x, BRAIN_Y, TOWER.z), isPhone ? 90 : 62, CAM.az, 1.15, 950, null);
      selRing.visible = false; ENV.brainPulse = 1;
      if (info.kind === 'node') BR.focus = info.id;
    } else {
      const o = objFor(info);
      if (o) {
        const d = (info.kind === 'flight' ? 62 : info.kind === 'fleet' ? 52 : info.kind === 'agent' ? 30 : 30) * (isPhone ? 1.5 : 1);
        flyTo(followPoint(o), d, CAM.az, info.kind === 'agent' ? 0.62 : 0.9, 900, info.kind === 'fleet' ? null : o);
        selRing.visible = true; selRing.scale.setScalar(info.kind === 'flight' ? 9 : info.kind === 'fleet' ? 13 : info.kind === 'agent' ? 1.6 : 3);
      }
    }
    UI && UI.select(info);
  }
  function clearSel() { SEL = null; selRing.visible = false; CAM.follow = null; BR.focus = null; }

  /* ================================================== LOOP */
  const _o = new T.Object3D();
  let last = performance.now(), raf = 0, frameAcc = 0, replayClock = 4, hidden = document.hidden, boardClock = 30;
  const minFrame = isPhone ? 1 / 30 : 0;
  const onVis = () => { hidden = document.hidden; if (!hidden) { last = performance.now(); raf = raf || requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); BR.u.uPx.value = h * DPR / (2 * Math.tan(camera.fov * Math.PI / 360)) * BRAIN_S; }
  }
  function frame(now) {
    raf = 0;
    if (!alive.on || hidden) return;
    raf = requestAnimationFrame(frame);
    const raw = Math.min(0.06, (now - last) / 1000);
    frameAcc += raw; if (frameAcc < minFrame) return;
    const rawDt = Math.min(0.06, frameAcc); frameAcc = 0; last = now;
    const dt = rawDt * SIM.speed; SIM.t += dt;
    resize();
    // keep the field alive: replay recent work when nothing new arrives
    D.items.forEach(it => { if (!it._ac && it.status === 'Queued') { it._ac = makeAircraft(it); SIM.aircraft.push(it._ac); } });
    replayClock -= dt;
    const active = SIM.aircraft.filter(a => a.state !== 'gone').length;
    if (replayClock <= 0) { replayClock = 18; if (active < 3) replayOne(); }
    trySpawn();
    SIM.aircraft.forEach(a => updateAircraft(a, dt));
    SIM.aircraft = SIM.aircraft.filter(a => {
      if (a.state === 'gone' && !(SEL && SEL.id === a.item.key)) {
        world.remove(a.g); const i = pickables.indexOf(a.g); if (i >= 0) pickables.splice(i, 1);
        D.items = D.items.filter(x => x !== a.item); D.done = (D.done || []); D.done.unshift(a.item); D.done.length = Math.min(D.done.length, 20);
        return false;
      }
      return true;
    });
    SIM.vehicles.forEach(v => updateVehicle(v, dt));
    cars.forEach(v => updateVehicle(v, dt));
    Object.values(bridges).forEach(b => updateBridge(b, dt));
    people.forEach(p => updatePerson(p, dt));
    // Jarvis: the radar spins fast and rings go out while it sweeps
    const j = D.byId.get('jarvis');
    if (j && j.state === 'working' && ENV.sweepK < 0.05) ENV.sweepK = 0.6;
    radar.rotation.y += dt * (ENV.sweepK > 0 ? 3.2 : 0.7);
    if (ENV.sweepK > 0) {
      ENV.sweepK = Math.max(0, ENV.sweepK - dt / 18);
      const r = (SIM.t * 22) % 140; radarRing.scale.setScalar(r + 1); radarRing.material.opacity = Math.min(1, ENV.sweepK * 2) * 0.5 * (1 - r / 140);
    } else radarRing.material.opacity = 0;
    van.parts.beacon.material.opacity = ENV.sweepK > 0 ? ((SIM.t * 2) % 1 < 0.5 ? 1 : 0.25) : 0.12;
    // brain swarm
    ENV.brainPulse = Math.max(0, ENV.brainPulse - dt * 0.35);
    const tt = SIM.t, spin = reduced ? 0 : tt * 0.18; BR.spin = spin;
    const focusIdx = BR.focus != null ? BR.centers.findIndex(c => String(c.node.id) === String(BR.focus)) : -1;
    BR.u.uTime.value = tt; BR.u.uPulse.value = ENV.brainPulse; BR.u.uSpin.value = spin; BR.u.uFocus.value = focusIdx; BR.u.uNight.value = ENV.night;
    if (BR.sig) {
      const arr = BR.sig.geometry.attributes.position.array, rate = reduced ? 0 : (0.6 + ENV.brainPulse * 1.5 + (ENV.sweepK > 0 ? 0.8 : 0));
      BR.sigs.forEach((g, i) => {
        g.t += dt * g.v * rate; if (g.t > 1) { g.t = 0; g.e = Math.floor(Math.random() * BR.sigEdges.length); }
        const [a, b] = BR.sigEdges[g.e]; arr[i * 3] = a.x + (b.x - a.x) * g.t; arr[i * 3 + 1] = a.y + (b.y - a.y) * g.t; arr[i * 3 + 2] = a.z + (b.z - a.z) * g.t;
      });
      BR.sig.geometry.attributes.position.needsUpdate = true; BR.sig.rotation.y = -spin;
      BR.sig.material.opacity = 0.6 + ENV.night * 0.2;
    }
    if (BR.edges) { BR.edges.rotation.y = -spin; BR.edges.material.opacity = 0.14 + ENV.brainPulse * 0.3 - ENV.night * 0.06; }
    brainHalo.scale.setScalar(12 + Math.sin(tt * 1.4) * 0.6 + ENV.brainPulse * 4);
    padM.opacity = 0.35 + 0.25 * Math.sin(tt * 2) + ENV.brainPulse * 0.3 + (ENV.sweepK > 0 ? 0.2 : 0);
    clouds.forEach((c, i) => { c.position.x += dt * (1.2 + (i % 3) * 0.4); if (c.position.x > 700) c.position.x -= 1400; });
    // weather
    if (rain.visible) { rain.position.y -= dt * 90; if (rain.position.y < -60) rain.position.y += 60; }
    if (dust.visible) { dust.position.x += dt * 9; if (dust.position.x > 60) dust.position.x -= 60; }
    if (ENV.weather === 'storm' && Math.random() < dt * 0.15) ENV.lightning = 1;
    ENV.lightning = Math.max(0, ENV.lightning - dt * 4);
    sock.rotation.y = Math.sin(tt * 0.7) * 0.25 + (ENV.weather === 'storm' ? 0.6 : 0);
    updateEnv(rawDt);
    if (SEL && ['flight', 'agent', 'vehicle', 'fleet'].includes(SEL.kind)) {
      const o = objFor(SEL); if (o) { o.getWorldPosition(_np); selRing.position.set(_np.x, Math.max(0.3, _np.y + 0.25), _np.z); selRing.material.opacity = 0.55 + Math.sin(tt * 5) * 0.35; } else selRing.visible = false;
    }
    tourTick(rawDt);
    boardClock -= rawDt; if (boardClock <= 0) { boardClock = 30; updateBoards(); }
    updateCam(rawDt);
    renderer.render(scene, camera);
    UI && UI.frame(rawDt);
  }
  if (!reduced) { CAM.target.set(-30, 0, -40); CAM.dist = 900; CAM.az = -1.7; CAM.pol = 0.62; const a = AREAS.overview; flyTo(V(...a.t), a.d, a.az, a.pol, 4200, null); }
  raf = requestAnimationFrame(frame);

  function dispose() {
    document.removeEventListener('visibilitychange', onVis);
    if (raf) cancelAnimationFrame(raf);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
  }

  return {
    flyArea, select, clearSel, objFor, AREAS, SIM, ENV, CAM, people, fleet: fleetObjs, setGraph, onAgents, startSweep, dispose, tour, TOUR, updateBoards,
    brainInfo: () => ({ nodes: BR.centers.length, links: BR.edgeCount || 0, hot: BR.centers.filter(c => c.node.hot).length }),
    vanInfo: () => van,
    vehicleOf: id => SIM.vehicles.find(v => v.id === id),
    setDeep: d => { ENV.deep = d; }
  };
  } /* end buildWorld */

  /* ======================================================== UI OVERLAY */
  function buildUI() {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtAt = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? esc(iso) : clockStr(d); };
    const fmtDay = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return esc(iso); try { return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { timeZone: tz, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); } catch (e) { return d.toISOString().slice(5, 16).replace('T', ' '); } };
    const stateWord = s => L[s] || s || '';
    const prefs = (() => { try { return JSON.parse(localStorage.getItem('oa-prefs') || '{}'); } catch (e) { return {}; } })();
    const savePrefs = () => { try { localStorage.setItem('oa-prefs', JSON.stringify(prefs)); } catch (e) {} };

    uiRoot.innerHTML = `
      <header class="oa-top oa-glass">
        <div class="oa-brand"><span class="oa-dot" aria-hidden="true"></span><strong>${esc(L.title)}</strong><span class="oa-mode" data-mode></span></div>
        <nav class="oa-areas" aria-label="Areas">
          <button type="button" class="oa-tour" data-tour aria-pressed="false">${icon('play')}${esc(L.tour)}</button>
          ${['overview', 'gates', 'brain', 'workshop', 'fleet', 'runway'].map(a => `<button type="button" data-area="${a}">${esc(L[a])}</button>`).join('')}
        </nav>
        <div class="oa-tools">
          <label class="oa-search"><span class="oa-sr">${esc(L.search)}</span><input id="oa-search" type="search" placeholder="${esc(L.search)}" autocomplete="off"><ul class="oa-results oa-glass" hidden></ul></label>
          <div class="oa-menu"><button type="button" class="oa-icon" data-menu="wx" aria-label="${esc(L.weather)}">${icon('cloud')}</button>
            <div class="oa-pop oa-glass" data-pop="wx" hidden>
              <p>${esc(L.weather)}</p>${['clear', 'rain', 'fog', 'calima', 'storm'].map(w => `<button type="button" data-wx="${w}">${esc(L[w])}</button>`).join('')}
              <p>${esc(L.time)}</p>${['auto', 'day', 'night'].map(m => `<button type="button" data-tm="${m}">${esc(L[m])}</button>`).join('')}
            </div></div>
        </div>
      </header>
      <section class="oa-clocks oa-glass" aria-label="Clocks"></section>
      <section class="oa-kpis"></section>
      <aside class="oa-detail oa-glass" hidden><button type="button" class="oa-close" aria-label="${esc(L.close)}">${icon('x')}</button><div class="oa-detail-body"></div></aside>
      <section class="oa-track oa-glass" hidden></section>
      <section class="oa-table oa-glass" data-open="${prefs.tableOpen ? '1' : '0'}">
        <div class="oa-tabs" role="tablist">
          ${['team', 'arrivals', 'departures', 'feed'].map(t => `<button type="button" role="tab" data-tab="${t}">${esc(L[t])}<span data-count="${t}"></span></button>`).join('')}
        </div>
        <div class="oa-rows"></div>
      </section>`;
    const $ = s => uiRoot.querySelector(s), $$ = s => [...uiRoot.querySelectorAll(s)];
    let tab = prefs.tab || 'team', selInfo = null, dirtyFlag = true, tick = 0;

    // area buttons
    $$('[data-area]').forEach(b => b.addEventListener('click', () => { W.tour(false); W.flyArea(b.dataset.area); select(null); }));
    $('[data-tour]').addEventListener('click', () => { const on = !W.TOUR.on; if (on) { W.clearSel(); select(null); } W.tour(on); });
    // weather + light
    const wxBtn = $('[data-menu="wx"]'), wxPop = $('[data-pop="wx"]');
    wxBtn.addEventListener('click', e => { e.stopPropagation(); wxPop.hidden = !wxPop.hidden; });
    host.addEventListener('click', e => { if (!e.target.closest('.oa-menu')) wxPop.hidden = true; if (!e.target.closest('.oa-search')) results.hidden = true; });
    $$('[data-wx]').forEach(b => b.addEventListener('click', () => { W.ENV.weather = b.dataset.wx; prefs.wx = b.dataset.wx; savePrefs(); markMenu(); }));
    $$('[data-tm]').forEach(b => b.addEventListener('click', () => { W.ENV.mode = b.dataset.tm; prefs.tm = b.dataset.tm; savePrefs(); markMenu(); }));
    if (prefs.wx) W.ENV.weather = prefs.wx; if (prefs.tm) W.ENV.mode = prefs.tm;
    function markMenu() { $$('[data-wx]').forEach(b => b.setAttribute('aria-pressed', b.dataset.wx === W.ENV.weather)); $$('[data-tm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tm === W.ENV.mode)); }
    markMenu();
    // tabs
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
      const t = $('.oa-table');
      if (tab === b.dataset.tab && t.dataset.open === '1') { t.dataset.open = '0'; prefs.tableOpen = false; }
      else { tab = b.dataset.tab; t.dataset.open = '1'; prefs.tableOpen = true; }
      prefs.tab = tab; savePrefs(); renderTable();
    }));
    $('.oa-close').addEventListener('click', () => { W.clearSel(); select(null); });
    // search
    const search = $('#oa-search'), results = $('.oa-results');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const hits = [];
      D.agents.forEach(a => { if ((a.name + ' ' + (a.role || '') + ' ' + a.id).toLowerCase().includes(q)) hits.push({ label: a.name, sub: txt(a, 'role'), info: { kind: 'agent', id: a.id } }); });
      W.SIM.aircraft.forEach(ac => { if (ac.g.visible && (ac.item.id + ' ' + ac.item.what).toLowerCase().includes(q)) hits.push({ label: ac.item.id, sub: ac.item.what, info: { kind: 'flight', id: ac.item.key } }); });
      W.fleet.forEach(f => { if ((f.f.reg + ' ' + (f.f.label || '')).toLowerCase().includes(q)) hits.push({ label: f.f.reg, sub: f.f.label || L.aircraft, info: { kind: 'fleet', id: f.f.reg } }); });
      if ('brain jarvis cerebro'.includes(q)) hits.push({ label: L.brainTitle, sub: '', info: { kind: 'brain', id: 'brain' } });
      results.innerHTML = hits.slice(0, 8).map((h, i) => `<li><button type="button" data-hit="${i}"><b>${esc(h.label)}</b><span>${esc(h.sub || '')}</span></button></li>`).join('') || `<li class="oa-empty">${esc(L.nothing)}</li>`;
      results.hidden = false;
      results.querySelectorAll('[data-hit]').forEach(b => b.addEventListener('click', () => { W.select(hits[+b.dataset.hit].info); results.hidden = true; search.value = ''; }));
    });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = results.querySelector('[data-hit]'); b && b.click(); } if (e.key === 'Escape') { results.hidden = true; search.blur(); } });

    function icon(n) {
      const p = { play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>', cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>' }[n];
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    }

    /* ---------- clocks ---------- */
    function renderClocks() {
      const room = D.room || {};
      const zones = (room.clocks && room.clocks.zones) || ['Europe/Madrid', 'America/Aruba', 'America/Argentina/Buenos_Aires', 'UTC'];
      const label = z => ({ 'Europe/Madrid': 'Madrid', 'America/Aruba': 'Aruba', 'America/Argentina/Buenos_Aires': 'Buenos Aires', UTC: 'UTC' }[z] || z.split('/').pop().replace(/_/g, ' '));
      const now = new Date();
      let local = null; try { local = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      const loc = room.clocks && room.clocks.local;
      const localZone = (loc && loc.tz) || local;
      const extra = localZone && !zones.includes(localZone) ? `<div class="oa-clock"><span>${esc(L.local)} · ${esc((loc && loc.label) || label(localZone))}</span><b>${clockStr(now, localZone)}</b></div>` : '';
      let next = '';
      if (room.next_run_at) {
        const ms = new Date(room.next_run_at) - now;
        const mins = Math.max(0, Math.round(ms / 60000));
        next = `<div class="oa-clock oa-next"><span>${esc(L.nextRun)}</span><b>${ms > 0 ? (mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' m' : mins + ' min') : '—'}</b></div>`;
      }
      $('.oa-clocks').innerHTML =
        `<div class="oa-clock oa-main"><span>MADRID</span><b>${clockStr(now, 'Europe/Madrid')}</b></div>` + extra +
        zones.filter(z => z !== 'Europe/Madrid').map(z => `<div class="oa-clock"><span>${esc(label(z))}</span><b>${clockStr(now, z)}</b></div>`).join('') + next;
    }

    /* ---------- KPIs ---------- */
    function ring(pct, cap, lbl) {
      const r = 15, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, +pct || 0));
      const warn = v >= cap ? 'crit' : v >= cap - 8 ? 'warn' : 'ok';
      const capA = (cap / 100) * 2 * Math.PI - Math.PI / 2;
      const cx = 18 + Math.cos(capA) * r, cy = 18 + Math.sin(capA) * r;
      return `<div class="oa-ring" data-level="${warn}"><svg viewBox="0 0 36 36" width="44" height="44" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="oa-ring-bg"/><circle cx="18" cy="18" r="${r}" class="oa-ring-fg" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="1.6" class="oa-ring-cap"/></svg><div><b>${pct == null ? '—' : Math.round(v) + '%'}</b><span>${esc(lbl)}</span></div></div>`;
    }
    function renderKpis() {
      const ag = D.agents, w = ag.filter(a => a.state === 'working').length, r = ag.filter(a => a.state === 'resting').length, o = ag.length - w - r;
      const items = ag.reduce((s, a) => s + ((a.today && a.today.items) || 0), 0), runs = ag.reduce((s, a) => s + ((a.today && a.today.runs) || 0), 0);
      const u = (D.room && D.room.usage) || null, cap = (u && u.cap) || 80;
      $('.oa-kpis').innerHTML = `
        <button type="button" class="oa-kpi oa-glass" data-kpi="team"><span>${esc(L.onShift)}</span><b>${w}<small>/${ag.length}</small></b><em>${r} ${esc(L.resting)} · ${o} ${esc(L.off)}</em></button>
        <button type="button" class="oa-kpi oa-glass" data-kpi="feed"><span>${esc(L.today)}</span><b>${items}</b><em>${runs} ${esc(L.runs)}</em></button>
        <div class="oa-kpi oa-glass oa-usage"><span>${esc(L.usage)} <i>${esc(L.cap)} ${cap}%</i></span><div class="oa-rings">${ring(u && u.five_hour, cap, L.h5)}${ring(u && u.seven_day, cap, L.week)}</div></div>`;
      $$('[data-kpi]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.kpi; $('.oa-table').dataset.open = '1'; prefs.tab = tab; prefs.tableOpen = true; savePrefs(); renderTable(); }));
    }

    /* ---------- table ---------- */
    function renderTable() {
      const room = D.room || {};
      $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
      const cnt = { team: D.agents.length, arrivals: (room.arrivals || []).length, departures: (room.departures || []).length, feed: (room.feed || []).length };
      $$('[data-count]').forEach(s => s.textContent = cnt[s.dataset.count] ? ' ' + cnt[s.dataset.count] : '');
      const rows = $('.oa-rows');
      if ($('.oa-table').dataset.open !== '1') { rows.innerHTML = ''; return; }
      let html = '';
      if (tab === 'team') {
        const byTeam = TEAMS.map(g => ({ g, list: D.agents.filter(a => a.team === g.team) })).filter(x => x.list.length);
        html = byTeam.map(({ g, list }) => `<li class="oa-group"><span class="oa-gate" style="--g:${g.color}">${g.id}</span>${esc(L.teams[g.team])}</li>` + list.map(a =>
          `<li><button type="button" data-sel="agent:${esc(a.id)}"><span class="oa-st" data-s="${esc(a.state)}"></span><b>${esc(a.name)}</b><span class="oa-sub">${esc(txt(a, 'task') || txt(a, 'role') || '')}</span><span class="oa-num">${(a.today && a.today.items) || 0}</span></button></li>`).join('')).join('');
      } else if (tab === 'arrivals' || tab === 'feed' || tab === 'departures') {
        const list = (room[tab] || []).slice().reverse();
        if (tab === 'departures') list.reverse();
        html = list.map((x, i) => {
          const who = x.agent ? D.byId.get(x.agent) : null;
          const when = tab === 'departures' ? fmtDay(x.due) : fmtAt(x.at);
          return `<li><button type="button" data-row="${tab}:${i}" ${x.link ? '' : 'data-nolink="1"'}><span class="oa-time">${esc(when)}</span><b>${esc(txt(x, 'what'))}</b>${who ? `<span class="oa-sub">${esc(who.name)}</span>` : ''}${x.link ? `<span class="oa-go">${icon('link')}</span>` : ''}</button></li>`;
        }).join('');
        rows._list = list;
      }
      rows.innerHTML = `<ul>${html || `<li class="oa-empty">${esc(L.nothing)}</li>`}</ul>`;
      rows.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => { const [k, id] = b.dataset.sel.split(':'); W.select({ kind: k, id }); }));
      rows.querySelectorAll('[data-row]').forEach(b => b.addEventListener('click', () => { const x = rows._list[+b.dataset.row.split(':')[1]]; if (x && x.link && opts.onOpen) opts.onOpen(x.link, x); }));
    }

    /* ---------- detail panel ---------- */
    const kv = (k, v) => v || v === 0 ? `<div class="oa-kv"><span>${esc(k)}</span><b>${v}</b></div>` : '';
    function detailHtml(info) {
      if (!info) return '';
      if (info.kind === 'agent') {
        const a = D.byId.get(info.id); if (!a) return '';
        const g = teamOf(a.team);
        return `<p class="oa-eyebrow"><span class="oa-gate" style="--g:${g.color}">${g.id}</span>${esc(L.teams[a.team])}</p>
          <h3>${esc(a.name)}</h3><p class="oa-lead">${esc(txt(a, 'role'))}</p>
          <p class="oa-pill" data-s="${esc(a.state)}">${esc(stateWord(a.state))}${a.since ? ' · ' + esc(fmtDay(a.since)) : ''}</p>
          ${kv(L.task, esc(txt(a, 'task')))}${kv(L.model, esc([a.model, a.effort].filter(Boolean).join(' · ')))}${kv(L.schedule, esc(txt(a, 'schedule')))}
          ${kv(L.today, a.today ? `${a.today.items || 0} ${esc(L.items)} · ${a.today.runs || 0} ${esc(L.runs)}` : '')}
          ${a.last ? kv(L.last, `${esc(txt(a.last, 'what'))} <small>${esc(fmtDay(a.last.at))}</small>`) : ''}`;
      }
      if (info.kind === 'flight') {
        const ac = W.SIM.aircraft.find(a => a.item.key === info.id); const it = ac ? ac.item : null; if (!it) return '';
        const g = gateById(it.gate), who = it.agent && D.byId.get(it.agent);
        return `<p class="oa-eyebrow"><span class="oa-gate" style="--g:${g.color}">${g.id}</span>${esc(L.flight)}${it.replay ? ' · ' + esc(L.replay) : ''}</p>
          <h3>${esc(it.id)}</h3><p class="oa-lead">${esc(it.what)}</p>
          <p class="oa-pill" data-s="working">${esc(L.st[it.status] || it.status)}</p>
          ${kv(L.from, who ? esc(who.name) : '')}${kv(L.at, esc(fmtDay(it.at)))}${kv(L.gate, esc(g.id + ' · ' + L.teams[g.team]))}
          ${it.link ? `<button type="button" class="oa-btn" data-open-link>${esc(L.open)}</button>` : ''}`;
      }
      if (info.kind === 'brain' || info.kind === 'node') {
        const b = W.brainInfo();
        const n = info.node || (D.graph && (D.graph.nodes || []).find(n => String(n.id) === String(info.id)));
        const byType = {}; ((D.graph && D.graph.nodes) || []).forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
        return `<p class="oa-eyebrow">${esc(L.brain)}</p><h3>${esc(n ? n.label : L.brainTitle)}</h3>
          <p class="oa-lead">${esc(n ? [n.type, n.group, n.stage].filter(Boolean).join(' · ') : L.brainSub)}</p>
          ${n ? (n.hot ? `<p class="oa-pill" data-s="working">${esc(L.hot)}</p>` : '') + (n.link || n.id ? '' : '') :
            `<div class="oa-chips">${Object.entries(byType).map(([k, v]) => `<span class="oa-chip" data-t="${esc(k)}">${esc(k)} ${v}</span>`).join('')}</div>
             ${kv(L.nodes, b.nodes)}${kv(L.links, b.links)}${kv(L.hot, b.hot)}`}
          ${n && opts.onOpen ? `<button type="button" class="oa-btn" data-open-node>${esc(L.open)}</button>` : ''}`;
      }
      if (info.kind === 'team') {
        const g = teamOf(info.id), list = D.agents.filter(a => a.team === g.team);
        return `<p class="oa-eyebrow"><span class="oa-gate" style="--g:${g.color}">${g.id}</span>${esc(L.gate)}</p><h3>${esc(L.teams[g.team])}</h3><p class="oa-lead">${esc(L.teamWhat[g.team])}</p>
          <ul class="oa-mini">${list.map(a => `<li><button type="button" data-sel="agent:${esc(a.id)}"><span class="oa-st" data-s="${esc(a.state)}"></span>${esc(a.name)}<small>${esc(stateWord(a.state))}</small></button></li>`).join('')}</ul>`;
      }
      if (info.kind === 'fleet') {
        const f = W.fleet.find(f => f.f.reg === info.id); if (!f) return '';
        return `<p class="oa-eyebrow">${esc(L.fleet)}</p><h3>${esc(f.f.reg)}</h3><p class="oa-lead">${esc(f.f.label || (f.f.type === 'global' ? 'Global 8000' : 'B787-8'))}</p>${(f.f.notes || []).map(n => kv(n[0], esc(n[1]))).join('')}`;
      }
      if (info.kind === 'vehicle') {
        const v = W.vehicleOf(info.id); if (!v) return '';
        const g = v.stand ? gateById(v.stand) : TEAMS[0];
        return `<p class="oa-eyebrow"><span class="oa-gate" style="--g:${g.color}">${g.id}</span>${esc(L.vehicle)}</p><h3>${esc(L.veh[v.vk])}</h3><p class="oa-lead">${esc(L.vehWhat[v.vk])}</p>
          ${v.vk === 'van' ? `<p class="oa-pill" data-s="${W.ENV.sweepK > 0 ? 'working' : 'resting'}">${esc(W.ENV.sweepK > 0 ? L.sweepNow : L.sweepIdle)}</p>` : ''}`;
      }
      return '';
    }
    function select(info) {
      selInfo = info;
      const panel = $('.oa-detail');
      if (!info) { panel.hidden = true; renderTrack(); return; }
      panel.hidden = false; $('.oa-detail-body').innerHTML = detailHtml(info);
      panel.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => { const [k, id] = b.dataset.sel.split(':'); W.select({ kind: k, id }); }));
      const ol = panel.querySelector('[data-open-link]'); if (ol) ol.addEventListener('click', () => { const ac = W.SIM.aircraft.find(a => a.item.key === info.id); if (ac && opts.onOpen) opts.onOpen(ac.item.link, ac.item); });
      const on = panel.querySelector('[data-open-node]'); if (on) on.addEventListener('click', () => { const n = info.node; if (n && opts.onOpen) opts.onOpen(n.link || null, n); });
      renderTrack();
    }

    /* ---------- turnaround tracker ---------- */
    function trackItem() {
      if (selInfo && selInfo.kind === 'flight') { const ac = W.SIM.aircraft.find(a => a.item.key === selInfo.id); if (ac) return ac.item; }
      const on = W.SIM.aircraft.filter(a => a.state === 'onBlock' || a.state === 'pushback').sort((a, b) => b.item.step - a.item.step);
      return on.length ? on[0].item : null;
    }
    function renderTrack() {
      const it = trackItem(), el = $('.oa-track');
      if (!it) { el.hidden = true; return; }
      el.hidden = false;
      const g = gateById(it.gate);
      el.innerHTML = `<header><span class="oa-gate" style="--g:${g.color}">${g.id}</span><b>${esc(it.id)}</b><span class="oa-sub">${esc(it.what)}</span></header>
        <ol>${L.steps.map((s, i) => `<li data-done="${it.step > i ? 1 : 0}" data-now="${it.step === i ? 1 : 0}"><i></i><span>${esc(s)}</span><time>${esc(it.stepAt[i] || '')}</time></li>`).join('')}</ol>`;
      el.onclick = () => W.select({ kind: 'flight', id: it.key });
    }

    /* ---------- hover / tap card ---------- */
    function tipHtml(info) {
      if (info.kind === 'agent') {
        const a = D.byId.get(info.id); if (!a) return '';
        return `<b>${esc(a.name)}</b><span>${esc(txt(a, 'role'))}</span><span class="oa-pill" data-s="${esc(a.state)}">${esc(stateWord(a.state))}</span>${txt(a, 'task') ? `<em>${esc(txt(a, 'task'))}</em>` : ''}<small>${esc([a.model, a.effort].filter(Boolean).join(' · '))}${a.today ? ' · ' + (a.today.items || 0) + ' ' + esc(L.items) : ''}</small>${a.last ? `<small>${esc(L.last)}: ${esc(txt(a.last, 'what'))}</small>` : ''}`;
      }
      if (info.kind === 'flight') { const ac = W.SIM.aircraft.find(a => a.item.key === info.id); if (!ac) return ''; return `<b>${esc(ac.item.id)}</b><span>${esc(ac.item.what)}</span><span class="oa-pill" data-s="working">${esc(L.st[ac.item.status] || ac.item.status)}</span>`; }
      if (info.kind === 'node') { const n = info.node; return `<b>${esc(n.label)}</b><span>${esc([n.type, n.group, n.stage].filter(Boolean).join(' · '))}</span>${n.hot ? `<span class="oa-pill" data-s="working">${esc(L.hot)}</span>` : ''}`; }
      if (info.kind === 'brain') { const b = W.brainInfo(); return `<b>${esc(L.brainTitle)}</b><span>${b.nodes} ${esc(L.nodes)} · ${b.links} ${esc(L.links)}</span>`; }
      if (info.kind === 'team') return `<b>${esc(L.teams[info.id])}</b><span>${esc(L.teamWhat[info.id])}</span>`;
      if (info.kind === 'board') { const n = ((D.room || {})[info.id] || []).length; return `<b>${esc(L[info.id])}</b><span>${n} · ${esc(L.open)}</span>`; }
      if (info.kind === 'fleet') { const f = W.fleet.find(f => f.f.reg === info.id); return f ? `<b>${esc(f.f.reg)}</b><span>${esc(f.f.label || '')}</span>` : ''; }
      if (info.kind === 'vehicle') { const v = W.vehicleOf(info.id); return v ? `<b>${esc(L.veh[v.vk])}</b><span>${esc(L.vehWhat[v.vk])}</span>` : ''; }
      return '';
    }
    function showTip(info, x, y) {
      if (!info) { tip.hidden = true; return; }
      const h = tipHtml(info); if (!h) { tip.hidden = true; return; }
      tip.innerHTML = h; tip.hidden = false;
      const r = host.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let lx = x - r.left + 16, ly = y - r.top + 16;
      if (lx + tw > r.width - 8) lx = x - r.left - tw - 16; if (ly + th > r.height - 8) ly = y - r.top - th - 16;
      tip.style.transform = `translate(${Math.max(8, lx)}px, ${Math.max(8, ly)}px)`;
    }

    function render() {
      const live = opts.live !== false && !opts.sample;
      $('[data-mode]').textContent = live ? L.live : L.sample;
      $('[data-mode]').dataset.live = live ? '1' : '0';
      renderClocks(); renderKpis(); renderTable(); renderTrack();
      if (selInfo) select(selInfo);
    }
    render();
    return {
      render, select, tip: showTip,
      openTab(t) { tab = t; $('.oa-table').dataset.open = '1'; prefs.tab = t; prefs.tableOpen = true; savePrefs(); renderTable(); },
      tourState(on) { const b = $('[data-tour]'); b.setAttribute('aria-pressed', on); },
      dirty() { dirtyFlag = true; },
      frame(dt) {
        tick += dt;
        if (dirtyFlag && tick > 0.4) { dirtyFlag = false; tick = 0; renderTrack(); if (selInfo && selInfo.kind !== 'brain') { const body = $('.oa-detail-body'); const h = detailHtml(selInfo); if (h && body.innerHTML !== h) select(selInfo); } }
        if ((UI._clk = (UI._clk || 0) + dt) > 15) { UI._clk = 0; renderClocks(); }
      }
    };
  }

  /* ======================================================== API */
  const api = {
    update(room) { if (room && alive.on) ingest(room); },
    updateGraph(graph) { if (alive.on) { W.setGraph(graph); UI.render(); } },
    setTheme(t) { const v = resolveTheme(t); host.setAttribute('data-oa-theme', v); W.setDeep(v === 'dark'); },
    flyTo(area) { W.flyArea(area); },
    select(info) { W.select(info); },
    sweep() { W.startSweep(); },
    unmount() { alive.on = false; timers.forEach(clearTimeout); W.dispose(); host.remove(); },
    _world: W, _data: D
  };
  api.setTheme(opts.theme || 'auto');
  return api;
}

/* ---------------------------------------------------------------- CSS */
function injectCss() {
  if (cssInjected) return; cssInjected = true;
  const css = `
.oa{--oa-fg:#1d1d1f;--oa-fg2:#6e6e73;--oa-line:rgba(60,60,67,.14);--oa-glass:rgba(255,255,255,.72);--oa-glass-strong:rgba(255,255,255,.9);--oa-accent:#ff9500;--oa-blue:#007aff;--oa-green:#34c759;--oa-orange:#ff9500;--oa-red:#ff3b30;--oa-grey:#8e8e93;--oa-shadow:0 8px 28px rgba(0,0,0,.10),0 1px 2px rgba(0,0,0,.06);
  position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;border-radius:inherit;color:var(--oa-fg);background:#dfe8ee;
  font:13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;outline:none;isolation:isolate}
.oa[data-oa-theme=dark]{--oa-fg:#f5f5f7;--oa-fg2:#a1a1a6;--oa-line:rgba(255,255,255,.12);--oa-glass:rgba(28,28,30,.66);--oa-glass-strong:rgba(44,44,46,.92);--oa-accent:#ff9f0a;--oa-blue:#0a84ff;--oa-green:#30d158;--oa-orange:#ff9f0a;--oa-red:#ff453a;--oa-shadow:0 10px 30px rgba(0,0,0,.4);background:#101a2b}
.oa:focus-visible{box-shadow:inset 0 0 0 2px var(--oa-blue)}
.oa *{box-sizing:border-box}
.oa [hidden]{display:none!important}
.oa-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.oa-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(20,30,45,.16) 100%)}
.oa[data-oa-theme=dark] .oa-vignette{background:radial-gradient(120% 90% at 50% 45%,transparent 50%,rgba(0,0,0,.38) 100%)}
.oa-ui{position:absolute;inset:0;pointer-events:none;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto 1fr auto;gap:10px;padding:12px}
.oa-ui>*{pointer-events:auto}
.oa-glass{background:var(--oa-glass);-webkit-backdrop-filter:blur(20px) saturate(1.7);backdrop-filter:blur(20px) saturate(1.7);border:1px solid var(--oa-line);border-radius:16px;box-shadow:var(--oa-shadow)}
.oa button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.oa button:focus-visible,.oa input:focus-visible{outline:2px solid var(--oa-blue);outline-offset:2px}
.oa-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.oa-top{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;min-width:0}
.oa-brand{display:flex;align-items:center;gap:8px;white-space:nowrap}
.oa-brand strong{font-size:15px;font-weight:650;letter-spacing:-.01em}
.oa-dot{width:9px;height:9px;border-radius:50%;background:var(--oa-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--oa-accent) 25%,transparent)}
.oa-mode{font-size:11px;font-weight:600;padding:2px 7px;border-radius:99px;background:var(--oa-line);color:var(--oa-fg2);text-transform:uppercase;letter-spacing:.04em}
.oa-mode[data-live="1"]{background:color-mix(in srgb,var(--oa-green) 18%,transparent);color:var(--oa-green)}
.oa-areas{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:1;padding:2px;background:var(--oa-line);border-radius:10px}
.oa-areas::-webkit-scrollbar{display:none}
.oa-areas button{padding:6px 11px;border-radius:8px;white-space:nowrap;font-weight:500;color:var(--oa-fg2);min-height:32px}
.oa-areas button:hover{color:var(--oa-fg);background:var(--oa-glass-strong)}
.oa-tour{display:inline-flex;align-items:center;gap:5px;color:var(--oa-fg)!important;font-weight:600!important}
.oa-tour svg{width:13px;height:13px}
.oa-tour[aria-pressed=true]{background:var(--oa-accent)!important;color:#fff!important}
.oa-tools{display:flex;gap:6px;align-items:center}
.oa-search{position:relative}
.oa-search input{width:200px;height:34px;border-radius:10px;border:1px solid var(--oa-line);background:var(--oa-glass-strong);color:var(--oa-fg);padding:0 11px;font:inherit}
.oa-results{position:absolute;right:0;top:40px;width:280px;max-height:300px;overflow:auto;list-style:none;margin:0;padding:6px;z-index:5}
.oa-results button{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:7px 9px;border-radius:9px;text-align:left}
.oa-results button:hover{background:var(--oa-line)}
.oa-results span{color:var(--oa-fg2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.oa-icon{width:36px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--oa-glass-strong);border:1px solid var(--oa-line)!important}
.oa-menu{position:relative}
.oa-pop{position:absolute;right:0;top:40px;width:190px;padding:8px;display:flex;flex-wrap:wrap;gap:4px;z-index:5}
.oa-pop p{width:100%;margin:4px 4px 2px;font-size:11px;color:var(--oa-fg2);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.oa-pop button{padding:6px 10px;border-radius:8px;background:var(--oa-line);min-height:32px}
.oa-pop button[aria-pressed=true]{background:var(--oa-accent);color:#fff}
.oa-clocks{grid-column:1/2;justify-self:start;display:flex;gap:16px;padding:8px 14px;align-items:flex-end;max-width:100%;overflow-x:auto;scrollbar-width:none}
.oa-clock{display:flex;flex-direction:column;white-space:nowrap}
.oa-clock span{font-size:10px;color:var(--oa-fg2);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.oa-clock b{font:600 15px/1.1 ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
.oa-clock.oa-main b{font-size:24px;letter-spacing:-.02em}
.oa-clock.oa-next b{color:var(--oa-blue)}
.oa-kpis{grid-column:1/2;display:flex;gap:10px;align-self:start;flex-wrap:wrap}
.oa-kpi{display:flex;flex-direction:column;align-items:flex-start;padding:10px 14px;min-width:132px;text-align:left}
.oa-kpi>span{font-size:11px;color:var(--oa-fg2);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.oa-kpi>span i{font-style:normal;font-weight:500;text-transform:none;letter-spacing:0;margin-left:4px}
.oa-kpi>b{font-size:26px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}
.oa-kpi>b small{font-size:15px;color:var(--oa-fg2);font-weight:500}
.oa-kpi>em{font-style:normal;color:var(--oa-fg2);font-size:12px}
button.oa-kpi:hover{background:var(--oa-glass-strong)}
.oa-rings{display:flex;gap:14px;margin-top:4px}
.oa-ring{display:flex;align-items:center;gap:6px}
.oa-ring div{display:flex;flex-direction:column;line-height:1.1}
.oa-ring b{font-size:15px;font-variant-numeric:tabular-nums}
.oa-ring span{font-size:11px;color:var(--oa-fg2)}
.oa-ring-bg{fill:none;stroke:var(--oa-line);stroke-width:4}
.oa-ring-fg{fill:none;stroke:var(--oa-green);stroke-width:4;stroke-linecap:round}
.oa-ring[data-level=warn] .oa-ring-fg{stroke:var(--oa-orange)}
.oa-ring[data-level=crit] .oa-ring-fg{stroke:var(--oa-red)}
.oa-ring-cap{fill:var(--oa-fg)}
.oa-detail{grid-column:2;grid-row:2/4;align-self:start;width:300px;max-height:100%;overflow:auto;padding:16px 16px 14px;position:relative}
.oa-close{position:absolute;right:8px;top:8px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--oa-fg2)}
.oa-close:hover{background:var(--oa-line)}
.oa-detail h3{margin:2px 0 2px;font-size:20px;letter-spacing:-.015em;font-weight:650;padding-right:28px;text-wrap:balance}
.oa-eyebrow{margin:0;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:var(--oa-fg2);text-transform:uppercase;letter-spacing:.05em}
.oa-lead{margin:0 0 10px;color:var(--oa-fg2)}
.oa-kv{display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;padding:7px 0;border-top:1px solid var(--oa-line)}
.oa-kv span{color:var(--oa-fg2)}
.oa-kv b{font-weight:500;overflow-wrap:anywhere}
.oa-kv small{display:block;color:var(--oa-fg2);font-weight:400}
.oa-gate{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:var(--g);color:#fff;font-weight:700;font-size:11px;letter-spacing:0}
.oa-pill{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:3px 9px;border-radius:99px;font-size:12px;font-weight:600;background:var(--oa-line);color:var(--oa-fg2);width:max-content}
.oa-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--oa-grey)}
.oa-pill[data-s=working]{background:color-mix(in srgb,var(--oa-green) 16%,transparent);color:var(--oa-green)}
.oa-pill[data-s=working]::before{background:var(--oa-green)}
.oa-pill[data-s=resting]{background:color-mix(in srgb,var(--oa-orange) 16%,transparent);color:var(--oa-orange)}
.oa-pill[data-s=resting]::before{background:var(--oa-orange)}
.oa-btn{margin-top:10px;width:100%;min-height:40px;border-radius:11px;background:var(--oa-blue)!important;color:#fff!important;font-weight:600}
.oa-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.oa-chip{font-size:12px;padding:3px 8px;border-radius:99px;background:var(--oa-line)}
.oa-mini{list-style:none;margin:0;padding:0}
.oa-mini button{display:flex;align-items:center;gap:8px;width:100%;padding:8px 4px;border-top:1px solid var(--oa-line);text-align:left;min-height:40px}
.oa-mini small{margin-left:auto;color:var(--oa-fg2)}
.oa-st{width:8px;height:8px;border-radius:50%;background:var(--oa-grey);flex:none}
.oa-st[data-s=working]{background:var(--oa-green);box-shadow:0 0 0 3px color-mix(in srgb,var(--oa-green) 25%,transparent)}
.oa-st[data-s=resting]{background:var(--oa-orange)}
.oa-track{grid-column:1/2;grid-row:4;align-self:end;justify-self:start;padding:10px 14px;width:min(560px,100%);cursor:pointer}
.oa-track header{display:flex;align-items:center;gap:8px;min-width:0;margin-bottom:8px}
.oa-track header .oa-sub{color:var(--oa-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.oa-track ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
.oa-track li{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--oa-fg2);min-width:0}
.oa-track li i{height:5px;border-radius:3px;background:var(--oa-line)}
.oa-track li[data-done="1"] i{background:var(--oa-green)}
.oa-track li[data-now="1"] i{background:var(--oa-accent);animation:oa-pulse 1.2s ease-in-out infinite}
.oa-track li[data-now="1"]{color:var(--oa-fg);font-weight:600}
.oa-track li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oa-track time{font:500 11px ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums;min-height:1.2em}
@keyframes oa-pulse{50%{opacity:.45}}
.oa-table{grid-column:2;grid-row:4;align-self:end;width:340px;display:flex;flex-direction:column;overflow:hidden}
.oa-tabs{display:flex;gap:2px;padding:6px}
.oa-tabs button{flex:1;padding:7px 4px;border-radius:9px;font-weight:500;color:var(--oa-fg2);font-size:12px;white-space:nowrap;min-height:34px}
.oa-tabs button span{font-variant-numeric:tabular-nums;opacity:.75}
.oa-table[data-open="1"] .oa-tabs button[aria-selected=true]{background:var(--oa-glass-strong);color:var(--oa-fg);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.oa-rows{max-height:min(38vh,320px);overflow:auto}
.oa-table[data-open="0"] .oa-rows{display:none}
.oa-rows ul{list-style:none;margin:0;padding:0 6px 6px}
.oa-rows li>button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"st name num" "st sub num";align-items:center;column-gap:9px;width:100%;padding:7px 8px;border-radius:9px;text-align:left;min-height:40px}
.oa-rows li>button:hover{background:var(--oa-line)}
.oa-rows .oa-st,.oa-rows .oa-time{grid-area:st}
.oa-rows b{grid-area:name;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oa-rows .oa-sub{grid-area:sub;color:var(--oa-fg2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oa-rows .oa-num,.oa-rows .oa-go{grid-area:num;color:var(--oa-fg2);font-variant-numeric:tabular-nums}
.oa-rows .oa-time{font:500 12px ui-monospace,"SF Mono",Menlo,monospace;color:var(--oa-fg2);font-variant-numeric:tabular-nums}
.oa-rows .oa-group{display:flex;align-items:center;gap:7px;padding:10px 8px 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--oa-fg2)}
.oa-empty{padding:14px 10px;color:var(--oa-fg2);list-style:none}
.oa-tip{position:absolute;left:0;top:0;z-index:6;max-width:260px;display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:13px;background:var(--oa-glass-strong);border:1px solid var(--oa-line);box-shadow:var(--oa-shadow);pointer-events:none;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.oa-tip b{font-size:14px}
.oa-tip span,.oa-tip small{color:var(--oa-fg2)}
.oa-tip em{font-style:normal}
.oa-tip .oa-pill{margin:2px 0}
@media (max-width:820px){
  .oa-ui{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto 1fr auto;padding:8px;gap:8px}
  .oa-top{flex-wrap:wrap;padding:6px 8px}
  .oa-areas{order:3;flex-basis:100%}
  .oa-tools{margin-left:auto}
  .oa-search input{width:min(150px,36vw)}
  .oa-clocks{grid-column:1;gap:12px;padding:6px 12px}
  .oa-clock.oa-main b{font-size:19px}
  .oa-kpis{grid-column:1;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .oa-kpis::-webkit-scrollbar{display:none}
  .oa-kpi{min-width:118px;padding:8px 12px;flex:none}
  .oa-kpi>b{font-size:21px}
  .oa-track{grid-column:1;grid-row:5;width:100%}
  .oa-table{grid-column:1;grid-row:5;width:100%;justify-self:stretch}
  .oa-table[data-open="1"]{position:absolute;grid-area:auto;left:8px;right:8px;bottom:8px;width:auto;z-index:4}
  .oa-track:not([hidden])~.oa-table{grid-row:6}
  .oa-ui{grid-template-rows:auto auto auto 1fr auto auto}
  .oa-detail{position:absolute;grid-area:auto;left:8px;right:8px;bottom:8px;top:auto;width:auto;max-height:58%;z-index:5;border-radius:18px 18px 16px 16px}
  .oa-detail::before{content:"";display:block;width:36px;height:5px;border-radius:3px;background:var(--oa-line);margin:-6px auto 8px}
  .oa-track ol span{display:none}
  .oa-track ol li[data-now="1"] span{display:block}
}
@media (prefers-reduced-motion:reduce){.oa-track li[data-now="1"] i{animation:none}}
`;
  const s = document.createElement('style'); s.setAttribute('data-oa', ''); s.textContent = css; document.head.appendChild(s);
}

root.OpsAirport = { mount, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
