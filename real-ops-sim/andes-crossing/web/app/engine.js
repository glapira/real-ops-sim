// Andes Crossing · turbulence likelihood engine v0 (no DOM, no network: the iOS shell can run the same file).
// Inputs: the two METARs of a station pair, model winds/temperatures at points along the crest, the crest line.
// Output: per crest segment and flight-level band, a category (0 nil … 3 severe), an uncalibrated likelihood and
// the geometry of the band where turbulence is expected to start (onset over the crest) and end (downstream).
// Reference only. v0 rules come from the research plan (docs/plans/andes-turbulence-app-plan.md §1.2–1.4) and are
// tuned later with crew reports.

export const MODEL_VERSION = 'v0.1-rules';
export const BANDS = [
  { id: 'low', label: 'FL100–FL200', from: 100, to: 200 },
  { id: 'mid', label: 'FL200–FL300', from: 200, to: 300 },
  { id: 'high', label: 'FL300–FL450', from: 300, to: 450 },
];
export const CATS = ['nil', 'light', 'moderate', 'severe'];
const NM = 1852, R = 6371008.8, G = 9.80665, KT = 0.514444;

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
export function destination([lon, lat], bearingDeg, distNm) {
  const d = distNm * NM / R, b = rad(bearingDeg), p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [+deg(l2).toFixed(4), +deg(p2).toFixed(4)];
}
export function bearing([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// wind "from" direction and speed → component blowing across a ridge whose line runs along ridgeBearing.
// Positive = west→east across a north–south ridge (toward the lee side, Argentina).
export function crossComponent(dirFrom, spd, ridgeBearing) {
  const toward = (dirFrom + 180) % 360;
  // the crest is walked north→south, so its left-hand normal points east (the lee side in westerly flow)
  const normal = (ridgeBearing + 270) % 360;
  return spd * Math.cos(rad(toward - normal));
}
const angleOff = (dirFrom, ridgeBearing) => {        // how far the wind is from perpendicular, 0..90
  const a = Math.abs(((dirFrom - ridgeBearing) % 180 + 180) % 180 - 90); return a;
};

function theta(tC, p) { return (tC + 273.15) * Math.pow(1000 / p, 0.2857); }
// Brunt–Väisälä frequency between two pressure levels (s⁻¹), from temperature (°C) and geopotential height (m)
export function bvf(t1, z1, p1, t2, z2, p2) {
  const th1 = theta(t1, p1), th2 = theta(t2, p2), dz = z2 - z1;
  if (!(dz > 0)) return null;
  const n2 = G / ((th1 + th2) / 2) * (th2 - th1) / dz;
  return n2 > 0 ? Math.sqrt(n2) : 0;
}
// vertical wind shear between two levels, knots per 1000 ft (vector difference)
export function vws(s1, d1, z1, s2, d2, z2) {
  const u = (s, d) => [-s * Math.sin(rad(d)), -s * Math.cos(rad(d))];
  const [u1, v1] = u(s1, d1), [u2, v2] = u(s2, d2);
  const dzFt = (z2 - z1) / 0.3048;
  return dzFt > 0 ? Math.hypot(u2 - u1, v2 - v1) / dzFt * 1000 : null;
}

// Pressure pair check (SCEL minus SAME QNH, temperature gap). Thresholds: pilot rule of thumb (plan §1.2), unverified.
export function pressurePair(windward, lee) {
  if (!windward || !lee || windward.qnh == null || lee.qnh == null) return null;
  const dp = windward.qnh - lee.qnh, dt = (lee.temp ?? 0) - (windward.temp ?? 0);
  let level = 0;
  if (dp >= 8) level = 2; else if (dp >= 4) level = 1;
  if (dp >= 12) level = 3;
  if (dt >= 5) level = Math.max(level, 1);
  return { dp: +dp.toFixed(1), dt: +dt.toFixed(1), level, flags: { dp8: dp >= 8, dp12: dp >= 12, dt5: dt >= 5 } };
}

const score2cat = s => s >= 2.5 ? 3 : s >= 1.5 ? 2 : s >= 0.6 ? 1 : 0;
// uncalibrated mapping from score to a likelihood of moderate-or-greater; replaced by calibration (plan §3.5)
const mogLikelihood = s => Math.round(100 / (1 + Math.exp(-2.2 * (s - 1.6))));

// One crest sample at one forecast hour.
// lv: { 700:{spd,dir,t,z}, 500:{…}, 300:{…}, 250:{…}, 200:{…} } (kt, deg from, °C, m)
export function assessPoint(lv, ridgeBearing, pair, central) {
  const c500 = crossComponent(lv[500].dir, lv[500].spd, ridgeBearing);
  const c700 = crossComponent(lv[700].dir, lv[700].spd, ridgeBearing);
  const off = angleOff(lv[500].dir, ridgeBearing);
  const dirF = off <= 30 ? 1 : off <= 60 ? 0.5 : 0;
  const n = bvf(lv[700].t, lv[700].z, 700, lv[500].t, lv[500].z, 500);
  const stabF = n == null ? 0.8 : n >= 0.01 ? 1 : n >= 0.006 ? 0.75 : 0.5;
  const u = Math.max(0, c500);
  // crest-level wind rules: 25–50 kt moderate possible, > 50 kt severe possible (plan §1.4)
  let mw = (u < 20 ? 0 : u < 35 ? 0.9 : u < 50 ? 1.8 : 2.7) * dirF * stabF;
  const trapped = c700 > 0 && lv[500].spd > 1.6 * Math.max(1, lv[700].spd); // the 1.6 rule, as a flag
  if (central && pair && u >= 15) mw += pair.level >= 3 ? 0.9 : pair.level === 2 ? 0.6 : pair.level === 1 ? 0.3 : 0;
  const shearHi = vws(lv[300].spd, lv[300].dir, lv[300].z, lv[200].spd, lv[200].dir, lv[200].z) ?? 0;
  const shearMid = vws(lv[500].spd, lv[500].dir, lv[500].z, lv[300].spd, lv[300].dir, lv[300].z) ?? 0;
  const jet = Math.max(lv[300].spd, lv[250].spd, lv[200].spd);
  const cat = s => s >= 9 ? 2.7 : s >= 6 ? 1.8 : s >= 4 ? 0.9 : 0;
  const jetF = jet >= 110 ? 0.4 : 0;
  const bands = {
    low: mw,
    mid: Math.max(mw * 0.85, cat(shearMid) + jetF * 0.5),
    high: Math.max(mw * 0.7, cat(shearHi) + jetF),
  };
  const out = {};
  for (const b of BANDS) {
    const s = bands[b.id];
    out[b.id] = { score: +s.toFixed(2), cat: score2cat(s), mog: mogLikelihood(s),
      cause: s === mw || (b.id === 'low') ? 'mountain_wave' : 'cat' };
  }
  // how far downstream the band reaches (NM): 50–150 NM for strong crest winds (plan §1.4)
  const reach = u < 20 ? 0 : u < 35 ? 40 : u < 50 ? 80 : 150;
  return { cross500: Math.round(c500), off: Math.round(off), n: n && +n.toFixed(4), trapped, jet: Math.round(jet),
    shearHi: +shearHi.toFixed(1), shearMid: +shearMid.toFixed(1), reach, windTo: (lv[500].dir + 180) % 360, bands: out };
}

// Whole crest: points [{coord:[lon,lat], lv}], returns GeoJSON for the map plus a summary per band.
export function assessCrest(samples, pair, centralLat = [-36.5, -30.5]) {
  const feats = [], onset = [], ends = [], segs = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], prev = samples[Math.max(0, i - 1)], next = samples[Math.min(samples.length - 1, i + 1)];
    const ridge = bearing(prev.coord, next.coord);
    const central = s.coord[1] <= centralLat[1] && s.coord[1] >= centralLat[0];
    segs.push({ ...s, ridge, a: assessPoint(s.lv, ridge, pair, central) });
  }
  const summary = {};
  for (const b of BANDS) summary[b.id] = { cat: 0, mog: 0, at: null };
  for (let i = 0; i < segs.length - 1; i++) {
    const p = segs[i], q = segs[i + 1];
    for (const b of BANDS) {
      const ra = p.a.bands[b.id], rb = q.a.bands[b.id];
      const cat = Math.max(ra.cat, rb.cat), mog = Math.max(ra.mog, rb.mog);
      if (mog > summary[b.id].mog) summary[b.id] = { cat, mog, at: p.coord };
      if (cat === 0) continue;
      const reachP = Math.max(20, p.a.reach), reachQ = Math.max(20, q.a.reach);
      const up = 10;                                           // onset slightly upwind of the crest
      const p0 = destination(p.coord, (p.a.windTo + 180) % 360, up), q0 = destination(q.coord, (q.a.windTo + 180) % 360, up);
      const p1 = destination(p.coord, p.a.windTo, reachP), q1 = destination(q.coord, q.a.windTo, reachQ);
      const props = { band: b.id, cat, mog, cause: ra.cause, cross500: Math.max(p.a.cross500, q.a.cross500) };
      feats.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[p0, q0, q1, p1, p0]] } });
      onset.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: [p0, q0] } });
      ends.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: [p1, q1] } });
    }
  }
  return {
    model: MODEL_VERSION, summary, points: segs.map(s => ({ coord: s.coord, ...s.a })),
    areas: { type: 'FeatureCollection', features: feats },
    onset: { type: 'FeatureCollection', features: onset },
    ends: { type: 'FeatureCollection', features: ends },
  };
}

// sample the crest every `stepDeg` of latitude between two latitudes
export function crestSamples(crestLine, from = -24, to = -50, stepDeg = 1) {
  const pts = crestLine.geometry.coordinates, out = [];
  for (let lat = from; lat >= to; lat -= stepDeg) {
    let best = pts[0]; for (const p of pts) if (Math.abs(p[1] - lat) < Math.abs(best[1] - lat)) best = p;
    out.push(best);
  }
  return out;
}
