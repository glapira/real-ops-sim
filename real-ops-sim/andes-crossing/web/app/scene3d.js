// Andes Crossing · 3D scene. Turbulence as volumes in the air, the onset as a curtain on the crest, the route as a
// ribbon at cruise level. One MapLibre custom layer in plain WebGL (no library): three small programs, two vertex
// buffers rebuilt only when the data, the level or the theme changes; nothing is allocated per frame.
// Heights are true flight levels (FL × 100 ft, taken as metres MSL) multiplied by the terrain exaggeration, so the
// volumes sit correctly over the peaks. Colours come from the CSS tokens. Nothing here animates except one 200 ms
// fade when the scene comes on (opacity only, DESIGN §2.3). Reference only, not for navigation.
import { BANDS, nmBetween } from './engine.js';

const LAYER = 'scene3d', FT = 0.3048, EARTH = 2 * Math.PI * 6371008.8, DEG = Math.PI / 180;
const CAT_WORD = ['Nil', 'Light', 'Moderate', 'Severe', 'Extreme'], CAT_LETTER = ['N', 'L', 'M', 'S', 'X'];
const mercX = lon => (lon + 180) / 360;
const mercY = lat => (1 - Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)) / Math.PI) / 2;
const OX = mercX(-70), OY = mercY(-33);            // scene origin: vertices are stored relative to it (float precision)
const rel = c => [mercX(c[0]) - OX, mercY(c[1]) - OY];
const flM = fl => fl * 100 * FT;
const MAX_SEGS = 900, MAX_LABELS = 3, DROP_NM = 50;
// Vertical scale of the 3D view (terrain and everything in the air alike). True scale is unreadable at this range: FL450 is
// 14 km over a view 700 km wide. Always captioned on the map ("Heights ×4"), DESIGN §8.
export const EXAGGERATION = 4;

const st = {
  map: null, tokens: null, enabled: false, show: { turb: true },
  data: { result: null, band: 'high', fl: 360, plan: null, risk: null },
  theme: null, exag: 1.8, fadeAt: 0, saved: new Map(),
  gl: null, ready: false, dirty: true, prog: {}, meshN: 0, lineN: 0, planeN: 0,
  labels: [], labelBox: null, vx: null, planes: [],
};

// ---------- growable interleaved vertex stores (grown on rebuild only) ----------
function store(stride) {
  const s = { stride, cap: 2048, n: 0, ab: null, f: null, u: null, glbuf: null };
  const alloc = cap => { const ab = new ArrayBuffer(cap * stride); if (s.ab) new Uint8Array(ab).set(s.u.subarray(0, s.n * stride)); s.ab = ab; s.f = new Float32Array(ab); s.u = new Uint8Array(ab); s.cap = cap; };
  alloc(s.cap);
  s.need = k => { if (s.n + k > s.cap) alloc(Math.max(s.cap * 2, s.n + k)); };
  return s;
}
const mesh = store(28);   // x y z | u v kind | rgba
const line = store(48);   // pos xyz | other xyz | sideN width ext sideG | rgba | dashed soft - -

function mv(x, y, z, u, v, kind, c, a) {
  mesh.need(1); const o = mesh.n * 7, b = mesh.n * 28 + 24, f = mesh.f, ub = mesh.u;
  f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = u; f[o + 4] = v; f[o + 5] = kind;
  ub[b] = c[0] * 255; ub[b + 1] = c[1] * 255; ub[b + 2] = c[2] * 255; ub[b + 3] = Math.min(1, a) * 255; mesh.n++;
}
// horizontal quad A B C D at altitude z
function plate(A, B, C, D, z, kind, c, a) {
  mv(A[0], A[1], z, 0, 0, kind, c, a); mv(B[0], B[1], z, 1, 0, kind, c, a); mv(C[0], C[1], z, 1, 1, kind, c, a);
  mv(A[0], A[1], z, 0, 0, kind, c, a); mv(C[0], C[1], z, 1, 1, kind, c, a); mv(D[0], D[1], z, 0, 1, kind, c, a);
}
// vertical quad standing on A→B from z0 to z1 (heights may differ at the two ends); v runs 0 at the foot to 1 at the top
function wall(A, B, a0, a1, b0, b1, kind, c, a, ua = 0, ub = 1) {
  mv(A[0], A[1], a0, ua, 0, kind, c, a); mv(B[0], B[1], b0, ub, 0, kind, c, a); mv(B[0], B[1], b1, ub, 1, kind, c, a);
  mv(A[0], A[1], a0, ua, 0, kind, c, a); mv(B[0], B[1], b1, ub, 1, kind, c, a); mv(A[0], A[1], a1, ua, 1, kind, c, a);
}
function lv(P, zp, Q, zq, sideN, sideG, w, ext, c, a, dashed, soft) {
  line.need(1); const o = line.n * 12, b = line.n * 48 + 40, f = line.f, ub = line.u;
  f[o] = P[0]; f[o + 1] = P[1]; f[o + 2] = zp; f[o + 3] = Q[0]; f[o + 4] = Q[1]; f[o + 5] = zq;
  f[o + 6] = sideN; f[o + 7] = w; f[o + 8] = ext; f[o + 9] = sideG;
  ub[b] = c[0] * 255; ub[b + 1] = c[1] * 255; ub[b + 2] = c[2] * 255; ub[b + 3] = Math.min(1, a) * 255;
  ub[b + 4] = dashed ? 255 : 0; ub[b + 5] = soft ? 255 : 0; ub[b + 6] = 0; ub[b + 7] = 0; line.n++;
}
// one line segment in the air, drawn with a constant width in screen pixels
function seg(A, za, B, zb, w, c, a, ext = 0, dashed = false, soft = false) {
  lv(A, za, B, zb, 1, 1, w, ext, c, a, dashed, soft); lv(A, za, B, zb, -1, -1, w, ext, c, a, dashed, soft); lv(B, zb, A, za, -1, 1, w, ext, c, a, dashed, soft);
  lv(A, za, B, zb, -1, -1, w, ext, c, a, dashed, soft); lv(B, zb, A, za, 1, -1, w, ext, c, a, dashed, soft); lv(B, zb, A, za, -1, 1, w, ext, c, a, dashed, soft);
}

// ---------- theme ----------
let cx2d = null;
function css(colour) {
  if (!cx2d) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; cx2d = cv.getContext('2d', { willReadFrequently: true }); }
  cx2d.clearRect(0, 0, 1, 1); cx2d.fillStyle = '#000'; cx2d.fillStyle = colour || '#000'; cx2d.fillRect(0, 0, 1, 1);
  const d = cx2d.getImageData(0, 0, 1, 1).data, a = d[3] / 255 || 1;
  return [d[0] / 255, d[1] / 255, d[2] / 255, a];
}
const lift = (c, k) => k >= 0 ? [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, 1] : [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k), 1];   // k < 0 darkens
function readTheme() {
  const t = st.tokens(), cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim(), num = (n, d) => { const x = parseFloat(v(n)); return Number.isFinite(x) ? x : d; };
  return {
    t, dark: t.dark, risk: [t.rNil, t.rLight, t.rMod, t.rSev, t.rExt].map(css),
    ink: css(t.route), casing: css(t.routeCase), guide: css(t.label2), hatch: css(t.hatch), snow: css(t.relief),
    lift: num('--ac3d-lift', t.dark ? 0.45 : 0.08),                 // how far top faces and the curtain move towards white
    edge: num('--ac3d-edge', t.dark ? 0.45 : -0.18),                // edges: towards white on the dark map, darker on the light one
    add: num('--ac3d-additive', t.dark ? 0.35 : 0),                // share of additive light in the volumes (glow)
    shade: num('--ac3d-hillshade', 1.3),                           // relief shading is stronger while the scene is on
    face: num('--ac3d-face', t.dark ? 0.2 : 0.26),                 // opacity of the top face of the selected band
    sky: { 'sky-color': v('--ac3d-sky') || t.sky, 'horizon-color': v('--ac3d-horizon') || t.horizon, 'fog-color': v('--ac3d-fog') || t.fog,
      'fog-ground-blend': num('--ac3d-fog-ground', 0.6), 'horizon-fog-blend': num('--ac3d-horizon-fog', 0.5), 'sky-horizon-blend': num('--ac3d-sky-horizon', 0.8) },
  };
}

// ---------- geometry ----------
function build() {
  mesh.n = 0; line.n = 0; st.planes.length = 0;
  const T = st.theme, d = st.data, want = [];
  if (T) {
    if (st.show.turb && d.result?.areas) buildTurb(T, d, want);
    if (d.plan?.line?.length > 1) buildRoute(T, d, want);
  }
  setLabels(want);
  st.dirty = true;
  st.map?.triggerRepaint();
}

const narrow = () => (st.map?.getContainer().clientWidth || 1024) < 680;   // one column: fewer, shorter labels
const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

function buildTurb(T, d, want) {
  const feats = d.result.areas.features;
  for (const b of BANDS) {
    const sel = b.id === d.band, z0 = flM(b.from), z1 = flM(b.to);
    const list = feats.filter(f => f.properties.band === b.id && f.geometry?.coordinates?.[0]?.length >= 4).slice(0, 80);
    if (!list.length) continue;
    let run = 0;
    const Q = list.map((f, i) => {
      const r = f.geometry.coordinates[0], prev = list[i - 1], next = list[i + 1], u0 = run; run += nmBetween(r[0], r[1]);
      return { u0, u1: run, cat: Math.max(1, Math.min(4, f.properties.cat | 0)), P0: rel(r[0]), Q0: rel(r[1]), Q1: rel(r[2]), P1: rel(r[3]),
        joinP: !!prev && same(prev.geometry.coordinates[0][1], r[0]), joinQ: !!next && same(next.geometry.coordinates[0][0], r[1]),
        prevCat: prev ? prev.properties.cat : 0 };
    });
    if (!sel) {   // the other bands: only their tier of the curtain, faint, so the crest shows the risk level by level
      for (const q of Q) {
        const c = T.risk[q.cat], e = lift(c, T.edge * 0.5);
        wall(q.P0, q.Q0, z0, z1, z0, z1, 1, c, 0.2);
        seg(q.P0, z1, q.Q0, z1, 1, e, 0.5); seg(q.P0, z0, q.Q0, z0, 1, e, 0.5);
        if (!q.joinP) seg(q.P0, z0, q.P0, z1, 1, e, 0.4); if (!q.joinQ) seg(q.Q0, z0, q.Q0, z1, 1, e, 0.4);
      }
      continue;
    }
    const face = T.face;
    // back to front for a camera above the band: floor, far walls, curtain, then the lighter top face
    for (const q of Q) plate(q.P0, q.Q0, q.Q1, q.P1, z0, 0, T.risk[q.cat], face * 0.4);
    for (const q of Q) {
      const c = T.risk[q.cat];
      wall(q.P1, q.Q1, z0, z1, z0, z1, 1, c, face * 1.1);
      if (!q.joinP) wall(q.P0, q.P1, z0, z1, z0, z1, 1, c, face * 1.1);
      if (!q.joinQ) wall(q.Q0, q.Q1, z0, z1, z0, z1, 1, c, face * 1.1);
    }
    for (const q of Q) wall(q.P0, q.Q0, z0, z1, z0, z1, 2, lift(T.risk[q.cat], T.lift * 0.25), 0.82, q.u0, q.u1);
    for (const q of Q) plate(q.P0, q.Q0, q.Q1, q.P1, z1, q.cat >= 3 ? 4 : 0, lift(T.risk[q.cat], T.lift * 0.45), face);
    // crisp edges; the onset edge is the bright one
    for (const q of Q) {
      const c = T.risk[q.cat], e = lift(c, T.edge), w = 1.25 + (q.cat >= 3 ? 0.5 : 0);
      seg(q.P1, z1, q.Q1, z1, w, e, 0.9); seg(q.P1, z0, q.Q1, z0, 1, e, 0.5);
      if (!q.joinP) { seg(q.P0, z1, q.P1, z1, w, e, 0.9); seg(q.P0, z0, q.P1, z0, 1, e, 0.5); seg(q.P1, z0, q.P1, z1, 1, e, 0.6); seg(q.P0, z0, q.P0, z1, 1.5, e, 0.9); }
      else if (q.prevCat !== q.cat) seg(q.P0, z1, q.P1, z1, 1, e, 0.7);
      if (!q.joinQ) { seg(q.Q0, z1, q.Q1, z1, w, e, 0.9); seg(q.Q0, z0, q.Q1, z0, 1, e, 0.5); seg(q.Q1, z0, q.Q1, z1, 1, e, 0.6); seg(q.Q0, z0, q.Q0, z1, 1.5, e, 0.9); }
      // posts: the curtain stands on the crest. Neutral ink, because nothing is forecast below the band.
      seg(q.P0, 0, q.P0, z0, 1, T.guide, 0.5, 0, true); if (!q.joinQ) seg(q.Q0, 0, q.Q0, z0, 1, T.guide, 0.5, 0, true);
    }
    for (const q of Q) { const e = lift(T.risk[q.cat], T.lift);
      seg(q.P0, z1, q.Q0, z1, 14, e, 0.5, 0, false, true); seg(q.P0, z0, q.Q0, z0, 8, e, 0.3, 0, false, true); }
    for (const q of Q) { const e = lift(T.risk[q.cat], T.edge > 0 ? Math.min(1, T.edge * 1.5) : T.edge);
      seg(q.P0, z1, q.Q0, z1, 2.5, e, 1, 1); seg(q.P0, z0, q.Q0, z0, 1.5, e, 0.9, 0.5); }
    // one label per stretch of onset (the engine has already joined them by category)
    const x = d.plan?.crossings?.[0]?.at, lines = (d.result.onset?.features || []).filter(f => f.properties.band === b.id);
    const cand = lines.map(f => {
      const cs = f.geometry.coordinates, lats = cs.map(c => c[1]), lo = Math.min(...lats), hi = Math.max(...lats);
      const tgt = x && x[1] >= lo && x[1] <= hi ? Math.min(hi, Math.max(lo, x[1] + 0.55 > hi ? x[1] - 0.55 : x[1] + 0.55)) : (lo + hi) / 2;
      let at = cs[Math.floor(cs.length / 2)];
      for (let i = 0; i < cs.length - 1; i++) { const a = cs[i], c = cs[i + 1];
        if ((a[1] - tgt) * (c[1] - tgt) <= 0 && a[1] !== c[1]) { const k = (tgt - a[1]) / (c[1] - a[1]); at = [a[0] + k * (c[0] - a[0]), tgt]; break; } }
      return { at, cat: f.properties.cat, far: x ? Math.abs(tgt - x[1]) : -(hi - lo) };
    }).sort((p, q) => p.far - q.far).slice(0, narrow() ? 1 : MAX_LABELS);
    for (const c of cand) want.push({ kind: 'onset', at: c.at, z: z1, cat: c.cat, text: `${CAT_WORD[c.cat]}${narrow() ? '' : ' turbulence'} from here`, sub: b.label.replace('–', ' to ') });
  }
}

function buildRoute(T, d, want) {
  const src = d.plan.line, risk = d.risk || [], dens = src.length <= MAX_SEGS / 2 ? 2 : 1, cruise = flM(d.fl);
  const pts = [], cat = [];                          // cat[k] belongs to the leg pts[k] → pts[k+1]
  for (let i = 0; i < src.length && pts.length < MAX_SEGS; i++) {
    const c = i < src.length - 1 ? Math.max(risk[i] || 0, risk[i + 1] || 0) : 0;
    pts.push(src[i]); cat.push(c);
    if (dens === 2 && i < src.length - 1) { pts.push([(src[i][0] + src[i + 1][0]) / 2, (src[i][1] + src[i + 1][1]) / 2]); cat.push(c); }
  }
  const n = pts.length, dist = new Float64Array(n);
  for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + nmBetween(pts[i - 1], pts[i]);
  const total = dist[n - 1];
  // Level at the planned FL from end to end: the app assesses the crossing at this level and does not model climb or descent.
  const P = pts.map(rel), Z = pts.map(() => cruise), altAt = () => cruise;
  const at = s => { let i = 1; while (i < n - 1 && dist[i] < s) i++; const k = (s - dist[i - 1]) / Math.max(1e-6, dist[i] - dist[i - 1]);
    return [P[i - 1][0] + k * (P[i][0] - P[i - 1][0]), P[i - 1][1] + k * (P[i][1] - P[i - 1][1])]; };
  // a faint sheet from the ribbon to the ground: the terrain cuts it, which shows the clearance over the crest
  for (let i = 0; i < n - 1; i++) wall(P[i], P[i + 1], 0, Z[i], 0, Z[i + 1], 3, T.ink, T.dark ? 0.26 : 0.2);
  // drop lines about every 50 NM, and a firmer one at each crest crossing
  const xs = (d.plan.crossings || []).slice(0, 4).map(x => { const k = Math.min(n - 2, Math.max(0, (x.index | 0) * dens)); return { x, s: dist[k] + nmBetween(pts[k], x.at) }; });
  for (let s = DROP_NM; s < total - DROP_NM * 0.4; s += DROP_NM) {
    if (xs.some(c => Math.abs(c.s - s) < 18)) continue;
    const p = at(s); seg(p, 0, p, altAt(s), 1, T.ink, 0.55, 0, true);
  }
  for (const c of xs) { const p = rel(c.x.at); seg(p, 0, p, altAt(c.s), 1.5, T.ink, 0.9); }
  seg(P[0], 0, P[0], cruise, 1.5, T.ink, 0.8); seg(P[n - 1], 0, P[n - 1], cruise, 1.5, T.ink, 0.8);   // the two ends stand on their airports
  // the ribbon: risk-coloured casing, then the neutral line, as on the flat map (DESIGN §3.2 item 14)
  for (let i = 0; i < n - 1; i++) seg(P[i], Z[i], P[i + 1], Z[i + 1], 9, T.risk[cat[i]] || T.risk[0], cat[i] > 0 ? 0.95 : 0.4, cat[i] > 0 ? 1 : 0);
  for (let i = 0; i < n - 1; i++) seg(P[i], Z[i], P[i + 1], Z[i + 1], 5.5, T.casing, 1, 1.5);
  for (let i = 0; i < n - 1; i++) seg(P[i], Z[i], P[i + 1], Z[i + 1], 3, T.ink, 1, 1);
  // an aircraft at each crossing, flat in the air and pointing along the track
  for (const c of xs) {
    const a = at(Math.max(0, c.s - 6)), b = at(Math.min(total, c.s + 6)), hx = b[0] - a[0], hy = b[1] - a[1], hl = Math.hypot(hx, hy) || 1, p = rel(c.x.at);
    st.planes.push({ x: p[0], y: p[1], z: altAt(c.s), hx: hx / hl, hy: hy / hl });
  }
  if (xs[0]) want.push({ kind: 'acft', at: xs[0].x.at, z: altAt(xs[0].s), text: 'FL' + d.fl });
}

// ---------- labels (DOM, positioned from the same matrix as the scene) ----------
function setLabels(want) {
  if (!st.labelBox) return;
  while (st.labels.length > want.length) st.labels.pop().el.remove();
  want.forEach((w, i) => {
    let L = st.labels[i];
    if (!L) { L = st.labels[i] = { el: document.createElement('div'), sx: NaN, sy: NaN, on: null }; st.labelBox.append(L.el); }
    const p = rel(w.at); L.x = p[0]; L.y = p[1]; L.z = w.z; L.sx = NaN;
    const key = w.kind + '|' + w.text + '|' + (w.sub || '') + '|' + (w.cat || '');
    if (L.key === key) return;
    L.key = key; L.el.className = 'ac3d-label ac3d-' + w.kind; L.el.replaceChildren();
    if (w.kind === 'onset') {
      const sw = document.createElement('span'); sw.className = 'ac-sw'; sw.dataset.cat = w.cat; sw.textContent = CAT_LETTER[w.cat] || ''; sw.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span'); tx.className = 'ac3d-label-text'; tx.textContent = w.text;
      const sub = document.createElement('span'); sub.className = 'ac3d-label-sub'; sub.textContent = w.sub;
      L.el.append(sw, tx, sub);
    } else L.el.textContent = w.text;
    L.w = L.el.offsetWidth; L.flip = null;
  });
}
function placeLabels(m, zs, w, h) {
  for (let i = 0; i < st.labels.length; i++) {
    const L = st.labels[i], z = L.z * zs;
    const cw = m[3] * L.x + m[7] * L.y + m[11] * z + m[15];
    let on = cw > 0, sx = 0, sy = 0;
    if (on) {
      sx = Math.round(((m[0] * L.x + m[4] * L.y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w);
      sy = Math.round((0.5 - (m[1] * L.x + m[5] * L.y + m[9] * z + m[13]) / cw * 0.5) * h);
      on = sx > -40 && sx < w + 40 && sy > -20 && sy < h + 40;
    }
    if (on !== L.on) { L.on = on; L.el.style.opacity = on ? '1' : '0'; }
    const flip = on && sx + L.w > w - 64 && sx - L.w > 0;   // keep clear of the buttons on the right edge
    if (flip !== L.flip) { L.flip = flip; L.el.classList.toggle('ac3d-flip', flip); }
    if (on && (sx !== L.sx || sy !== L.sy)) { L.sx = sx; L.sy = sy; L.el.style.transform = `translate(${sx}px,${sy}px)`; }
  }
}

// ---------- WebGL ----------
const MESH_VS = `
attribute vec3 a_pos; attribute vec3 a_fx; attribute vec4 a_color;
uniform mat4 u_matrix; uniform float u_zscale;
varying vec4 v_color; varying vec3 v_fx;
void main() { v_color = a_color; v_fx = a_fx; gl_Position = u_matrix * vec4(a_pos.xy, a_pos.z * u_zscale, 1.0); }`;
const HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const MESH_FS = HP + `
uniform float u_alpha, u_add, u_dpr, u_lift, u_pleat; uniform vec4 u_hatch;
varying vec4 v_color; varying vec3 v_fx;
void main() {
  vec3 c = v_color.rgb; float a = v_color.a, k = v_fx.z, t = v_fx.y, add = u_add;
  if (k > 3.5) {                                   // severe: 45 degree hatch, the second cue besides colour
    float h = step(0.72, fract((gl_FragCoord.x + gl_FragCoord.y) / (9.0 * u_dpr)));
    c = mix(c, u_hatch.rgb, h * u_hatch.a); a = mix(a, max(a, 0.55), h);
  } else if (k > 2.5) { a *= 0.22 + 0.78 * t * t; add = 0.0; }   // sheet under the route: fades towards the ground
  else if (k > 1.5) {                              // onset curtain: light gathers at the top and the foot
    float e = pow(t, 4.0) + 0.55 * pow(1.0 - t, 5.0);
    float s = fract(v_fx.x / 10.0), pleat = 1.0 - smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.95, 1.0, s));   // a fine line every 10 NM
    a *= (0.5 + 0.5 * e) * (1.0 - 0.3 * pleat * u_pleat); c = mix(c, vec3(1.0), 0.35 * e * max(u_lift, 0.0));
  } else if (k > 0.5) a *= 0.3 + 0.7 * t * t;      // side walls: denser towards the top edge
  a *= u_alpha;
  gl_FragColor = vec4(c * a, a * (1.0 - add));
}`;
const LINE_VS = `
attribute vec3 a_pos; attribute vec3 a_other; attribute vec4 a_par; attribute vec4 a_color; attribute vec4 a_flag;
uniform mat4 u_matrix; uniform float u_zscale, u_near; uniform mediump float u_dpr; uniform vec2 u_view;
varying vec4 v_color; varying vec4 v_line;
void main() {
  v_color = a_color;
  float hw = a_par.y * u_dpr * 0.5;
  v_line = vec4(a_par.w * (hw + 1.0), hw, a_flag.x, a_flag.y);
  vec4 a = u_matrix * vec4(a_pos.xy, a_pos.z * u_zscale, 1.0);
  vec4 b = u_matrix * vec4(a_other.xy, a_other.z * u_zscale, 1.0);
  if (a.w < u_near && b.w < u_near) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.w < u_near) a = mix(a, b, (u_near - a.w) / (b.w - a.w));
  if (b.w < u_near) b = mix(b, a, (u_near - b.w) / (a.w - b.w));
  vec2 d = b.xy / b.w * u_view - a.xy / a.w * u_view;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 off = vec2(-dir.y, dir.x) * a_par.x * (hw + 1.0) - dir * a_par.z * u_dpr;
  gl_Position = vec4(a.xy + off / u_view * a.w, a.z, a.w);
}`;
const LINE_FS = HP + `
uniform float u_alpha, u_add; uniform mediump float u_dpr;
varying vec4 v_color; varying vec4 v_line;
void main() {
  float d = abs(v_line.x), a = clamp(v_line.y + 0.5 - d, 0.0, 1.0), add = 0.0;
  if (v_line.w > 0.5) { float t = clamp(1.0 - d / v_line.y, 0.0, 1.0); a = t * t; add = u_add; }
  if (v_line.z > 0.5) a *= step(0.5, fract(gl_FragCoord.y / (7.0 * u_dpr)));
  a *= v_color.a * u_alpha;
  gl_FragColor = vec4(v_color.rgb * a, a * (1.0 - add));
}`;
const PLANE_VS = `
attribute vec2 a_local;
uniform mat4 u_matrix; uniform float u_zscale, u_size; uniform vec3 u_anchor; uniform vec2 u_head, u_px;
void main() {
  vec2 p = u_anchor.xy + (u_head * a_local.x + vec2(-u_head.y, u_head.x) * a_local.y) * u_size;
  vec4 c = u_matrix * vec4(p, u_anchor.z * u_zscale, 1.0);
  gl_Position = vec4(c.xy + u_px * c.w, c.z, c.w);
}`;
const PLANE_FS = `precision mediump float; uniform vec4 u_color; uniform float u_alpha; void main() { float a = u_color.a * u_alpha; gl_FragColor = vec4(u_color.rgb * a, a); }`;
// a jet seen from above, nose along +x, in units of its own length
const PLANE = (() => {
  const tri = [], q = (a, b, c, d) => tri.push(...a, ...b, ...c, ...a, ...c, ...d), both = (a, b, c, d) => { q(a, b, c, d); q([a[0], -a[1]], [b[0], -b[1]], [c[0], -c[1]], [d[0], -d[1]]); };
  tri.push(0.52, 0, 0.38, 0.055, 0.38, -0.055);                                   // nose
  q([0.38, 0.055], [-0.4, 0.05], [-0.4, -0.05], [0.38, -0.055]);                  // fuselage
  tri.push(-0.4, 0.05, -0.52, 0, -0.4, -0.05);                                    // tail cone
  both([0.16, 0.05], [-0.14, 0.5], [-0.24, 0.5], [-0.1, 0.05]);                   // wings
  both([-0.34, 0.045], [-0.47, 0.2], [-0.52, 0.2], [-0.46, 0.045]);               // tailplane
  return new Float32Array(tri);
})();
const HALO = [1, 0, 0.7, 0.7, 0, 1, -0.7, 0.7, -1, 0, -0.7, -0.7, 0, -1, 0.7, -0.7];

function program(gl, vs, fs, attrs, unis) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('scene3d shader: ' + gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, a); gl.attachShader(p, b); attrs.forEach((n, i) => gl.bindAttribLocation(p, i, n)); gl.linkProgram(p);
  gl.deleteShader(a); gl.deleteShader(b);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('scene3d link: ' + gl.getProgramInfoLog(p));
  const u = {}; for (const n of unis) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}
function glInit(gl) {
  st.gl = gl;
  st.prog.mesh = program(gl, MESH_VS, MESH_FS, ['a_pos', 'a_fx', 'a_color'], ['u_matrix', 'u_zscale', 'u_alpha', 'u_add', 'u_dpr', 'u_lift', 'u_pleat', 'u_hatch']);
  st.prog.line = program(gl, LINE_VS, LINE_FS, ['a_pos', 'a_other', 'a_par', 'a_color', 'a_flag'], ['u_matrix', 'u_zscale', 'u_alpha', 'u_add', 'u_dpr', 'u_near', 'u_view']);
  st.prog.plane = program(gl, PLANE_VS, PLANE_FS, ['a_local'], ['u_matrix', 'u_zscale', 'u_size', 'u_anchor', 'u_head', 'u_px', 'u_color', 'u_alpha']);
  mesh.glbuf = gl.createBuffer(); line.glbuf = gl.createBuffer();
  st.planeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, st.planeBuf); gl.bufferData(gl.ARRAY_BUFFER, PLANE, gl.STATIC_DRAW);
  st.ready = true; st.dirty = true;
}
function glFree() {
  const gl = st.gl; if (!gl) return;
  for (const k of Object.keys(st.prog)) gl.deleteProgram(st.prog[k].p);
  gl.deleteBuffer(mesh.glbuf); gl.deleteBuffer(line.glbuf); gl.deleteBuffer(st.planeBuf);
  st.prog = {}; st.ready = false; st.gl = null;
}

const M = new Float32Array(16);
function render(gl, args) {
  if (st.failed || !st.theme) return;
  if (!st.ready) { try { glInit(gl); } catch (e) { console.error(e); st.failed = true; return; } }
  const src = args?.defaultProjectionData?.mainMatrix || args?.modelViewProjectionMatrix; if (!src) return;
  // shift the matrix to the scene origin (in double precision), so the vertices can stay small float32 numbers
  for (let i = 0; i < 16; i++) M[i] = src[i];
  for (let i = 0; i < 4; i++) M[12 + i] = src[i] * OX + src[4 + i] * OY + src[12 + i];
  const ex = st.map.getTerrain()?.exaggeration ?? 1; if (ex !== st.exag) { st.exag = ex; caption(); }
  const tr = st.map.transform, zs = ex / (EARTH * Math.cos((tr.center?.lat ?? -33) * DEG));
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, dpr = W / Math.max(1, tr.width || W), T = st.theme;
  let alpha = 1;
  if (st.fadeAt) { alpha = Math.min(1, (performance.now() - st.fadeAt) / 200); if (alpha < 1) st.map.triggerRepaint(); else st.fadeAt = 0; }

  if (st.dirty) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.glbuf); gl.bufferData(gl.ARRAY_BUFFER, mesh.u.subarray(0, mesh.n * mesh.stride), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, line.glbuf); gl.bufferData(gl.ARRAY_BUFFER, line.u.subarray(0, line.n * line.stride), gl.DYNAMIC_DRAW);
    st.meshN = mesh.n; st.lineN = line.n; st.dirty = false;
  }
  if (gl.bindVertexArray) gl.bindVertexArray(null);
  gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);   // the terrain hides what is behind it; nothing here writes depth

  if (st.meshN) {
    const p = st.prog.mesh; gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_matrix, false, M); gl.uniform1f(p.u.u_zscale, zs); gl.uniform1f(p.u.u_alpha, alpha);
    gl.uniform1f(p.u.u_add, T.add); gl.uniform1f(p.u.u_dpr, dpr); gl.uniform1f(p.u.u_lift, T.lift); gl.uniform1f(p.u.u_pleat, Math.min(1, Math.max(0, tr.zoom - 5.5))); gl.uniform4f(p.u.u_hatch, T.hatch[0], T.hatch[1], T.hatch[2], T.hatch[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.glbuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 28, 24);
    gl.drawArrays(gl.TRIANGLES, 0, st.meshN);
  }
  if (st.lineN) {
    const p = st.prog.line; gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_matrix, false, M); gl.uniform1f(p.u.u_zscale, zs); gl.uniform1f(p.u.u_alpha, alpha);
    gl.uniform1f(p.u.u_add, T.add); gl.uniform1f(p.u.u_dpr, dpr); gl.uniform1f(p.u.u_near, Math.max(1e-6, args.nearZ || 1)); gl.uniform2f(p.u.u_view, W / 2, H / 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, line.glbuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 48, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 48, 40);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 48, 44);
    gl.drawArrays(gl.TRIANGLES, 0, st.lineN);
    gl.disableVertexAttribArray(3); gl.disableVertexAttribArray(4);
  }
  if (st.planes.length) {
    const p = st.prog.plane; gl.useProgram(p.p); gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(p.u.u_matrix, false, M); gl.uniform1f(p.u.u_zscale, zs); gl.uniform1f(p.u.u_alpha, alpha);
    gl.uniform1f(p.u.u_size, 40 / (tr.worldSize || 512 * Math.pow(2, tr.zoom)));
    gl.bindBuffer(gl.ARRAY_BUFFER, st.planeBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    for (let i = 0; i < st.planes.length; i++) {
      const a = st.planes[i]; gl.uniform3f(p.u.u_anchor, a.x, a.y, a.z); gl.uniform2f(p.u.u_head, a.hx, a.hy);
      gl.uniform4f(p.u.u_color, T.casing[0], T.casing[1], T.casing[2], 1);
      for (let k = 0; k < 16; k += 2) { gl.uniform2f(p.u.u_px, HALO[k] * 3.2 * dpr / W, HALO[k + 1] * 3.2 * dpr / H); gl.drawArrays(gl.TRIANGLES, 0, PLANE.length / 2); }
      gl.uniform4f(p.u.u_color, T.ink[0], T.ink[1], T.ink[2], 1); gl.uniform2f(p.u.u_px, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, PLANE.length / 2);
    }
  }
  gl.disableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
  gl.depthMask(true);
  placeLabels(M, zs, tr.width || W, tr.height || H);
}

// ---------- the flat layers while the scene is on ----------
// Only paint properties that map-style.js also sets are overridden, so applyTheme() always puts the flat values back.
function paint(layer, prop, value3d) {
  const m = st.map, key = layer + '|' + prop; if (!m.getLayer(layer)) return;
  if (st.enabled) { if (!st.saved.has(key)) st.saved.set(key, m.getPaintProperty(layer, prop)); m.setPaintProperty(layer, prop, value3d); }
  else if (st.saved.has(key)) { m.setPaintProperty(layer, prop, st.saved.get(key)); st.saved.delete(key); }
}
function flat() {
  const m = st.map, T = st.theme; if (!m || !T) return;
  const on = st.enabled, turb = st.show.turb, vis = (ids, v) => ids.forEach(id => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'));
  vis(['turb-hatch', 'turb-end', 'turb-onset-glow', 'turb-onset-label'], turb && !on);   // in the air instead
  vis(['route-risk', 'route-casing'], !on);
  const ink = T.ink.map(v => Math.round(v * 255));
  paint('turb-fill', 'fill-opacity', ['match', ['get', 'cat'], 1, 0.1, 2, 0.13, 3, 0.17, 0]);   // the footprint of the volume (and still the tap target)
  paint('turb-onset', 'line-width', 1.25);                                                    // the foot of the curtain
  paint('hillshade', 'hillshade-exaggeration', Math.min(1, (T.dark ? 0.6 : 0.5) * T.shade));                               // the range reads with depth
  paint('route-line', 'line-width', 1.5);                                                     // the ground track under the ribbon
  paint('route-line', 'line-color', `rgba(${ink[0]},${ink[1]},${ink[2]},0.45)`);
  if (m.getLayer('relief-tint')) m.setPaintProperty('relief-tint', 'color-relief-color', reliefRamp(T));
  if (m.getLayer(LAYER)) m.setLayoutProperty(LAYER, 'visibility', on ? 'visible' : 'none');
  if (st.labelBox) st.labelBox.hidden = !on;
  if (st.vx) st.vx.hidden = !on; caption();
  m.setSky(T.sky);
}

// Snow line (DESIGN §3.2 layer 4, optional): a pale tint on the high Andes, cool and neutral, never a terrain colour.
function reliefRamp(T) {
  const c = T.snow.map(v => Math.round(v * 255)), a = k => `rgba(${c[0]},${c[1]},${c[2]},${k})`;
  return ['interpolate', ['linear'], ['elevation'], 0, a(0), 2800, a(0), 4000, a(T.dark ? 0.16 : 0.3), 5200, a(T.dark ? 0.42 : 0.6), 6900, a(T.dark ? 0.62 : 0.8)];
}
const caption = () => { if (st.vx) st.vx.textContent = 'Heights ×' + (+st.exag.toFixed(1)); };

// ---------- API ----------
export function init(map, tokensFn) {
  st.map = map; st.tokens = tokensFn; st.theme = readTheme();
  st.labelBox = document.createElement('div'); st.labelBox.className = 'ac3d-labels'; st.labelBox.setAttribute('aria-hidden', 'true'); st.labelBox.hidden = true;
  map.getContainer().append(st.labelBox);
  // "No unlabelled vertical exaggeration" (DESIGN §8): a caption next to the legend whenever the scene is on
  const legend = document.getElementById('legend');
  if (legend) { st.vx = document.createElement('div'); st.vx.className = 'k-glass ac-legend ac3d-vx'; st.vx.hidden = true; legend.after(st.vx); }
  map.on('webglcontextlost', () => { st.ready = false; st.prog = {}; });
  map.on('resize', () => { if (narrow() !== st.narrow) { st.narrow = narrow(); build(); } });
  try { if (map.getLayer('hillshade')) map.addLayer({ id: 'relief-tint', type: 'color-relief', source: 'dem-shade', paint: { 'color-relief-color': reliefRamp(st.theme), 'color-relief-opacity': 1 } }, 'hillshade'); }
  catch (e) { /* older renderer without color-relief: the map is complete without it */ }
  // above every draped layer, below the airports and all labels, so taps and names stay on top
  map.addLayer({ id: LAYER, type: 'custom', renderingMode: '3d', onAdd() {}, onRemove() { glFree(); }, render }, map.getLayer('airport') ? 'airport' : undefined);
  flat(); build();
}
export function update(data) { Object.assign(st.data, data); if (st.map) build(); }
export function setEnabled(on) {
  if (!st.map) return;
  const was = st.enabled; st.enabled = !!on;
  st.exag = st.map.getTerrain()?.exaggeration ?? st.exag;
  if (st.enabled && !was) st.fadeAt = performance.now();
  flat(); st.map.triggerRepaint();
}
export function setLayers(show) { Object.assign(st.show, show); if (st.map) { flat(); build(); } }
// after applyTheme(): the flat values are back in the new colours, so forget the saved ones and rebuild in the new theme
export function retheme() { if (!st.map) return; st.saved.clear(); st.theme = readTheme(); flat(); build(); }
