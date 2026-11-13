// Andes Crossing · data layer (no DOM). Every fetch returns { data, at, stale } so the screens can show freshness.
// Same-origin PHP endpoints (api/) proxy NOAA; Open-Meteo is called from the device (each crew device has its own quota).
const LEVELS = [700, 500, 300, 250, 200];
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode or full */ } },
};

async function getJSON(url, cacheKey, maxAgeMs) {
  const cached = ls.get(cacheKey);
  if (cached && Date.now() - cached.at < maxAgeMs) return { data: cached.data, at: cached.at, stale: false };
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    ls.set(cacheKey, { at: Date.now(), data });
    return { data, at: Date.now(), stale: false };
  } catch (e) {
    if (cached) return { data: cached.data, at: cached.at, stale: true, error: String(e) };
    throw e;
  }
}

export const staticData = name => fetch(`data/${name}.json`).then(r => { if (!r.ok) throw new Error(name); return r.json(); });

export async function metars(ids) {
  const r = await getJSON('api/metar.php?ids=' + ids.join(','), 'ac.metar.' + ids.join(','), 5 * 60e3);
  const by = {};
  for (const m of r.data || []) {
    if (by[m.icaoId] && by[m.icaoId].obsTime >= m.obsTime) continue;   // keep the latest per station
    by[m.icaoId] = { qnh: m.altim, temp: m.temp, dew: m.dewp, wdir: m.wdir, wspd: m.wspd, wgst: m.wgst,
      raw: m.rawOb, obsTime: m.obsTime, time: m.reportTime };
  }
  return { ...r, data: by };
}

export async function sigmets() {
  const r = await getJSON('api/sigmet.php', 'ac.sigmet', 10 * 60e3);
  const feats = [];
  for (const s of r.data || []) {
    const ring = (s.coords || []).map(c => [c.lon, c.lat]);
    if (ring.length < 3) continue;
    if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push(ring[0]);
    feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { fir: s.firId, firName: s.firName, hazard: s.hazard, qualifier: s.qualifier, base: s.base, top: s.top,
        from: s.validTimeFrom, to: s.validTimeTo, raw: s.rawSigmet,
        turb: /TURB|MTW/.test(s.hazard || '') } });
  }
  return { ...r, data: { type: 'FeatureCollection', features: feats } };
}

// GFS upper winds and temperatures at the crest samples, hourly for the next 48 h.
export async function crestModel(coords) {
  const v = LEVELS.flatMap(l => [`wind_speed_${l}hPa`, `wind_direction_${l}hPa`, `temperature_${l}hPa`, `geopotential_height_${l}hPa`]);
  const url = 'https://api.open-meteo.com/v1/gfs?latitude=' + coords.map(c => c[1]).join(',') +
    '&longitude=' + coords.map(c => c[0]).join(',') + '&hourly=' + v.join(',') +
    '&wind_speed_unit=kn&forecast_hours=48&timezone=UTC';
  const r = await getJSON(url, 'ac.gfs.crest', 60 * 60e3);
  const list = Array.isArray(r.data) ? r.data : [r.data];
  const times = list[0]?.hourly?.time || [];
  // samples[t] = [{coord, lv}] for each forecast hour t
  const at = t => list.map((pt, i) => {
    const h = pt.hourly, lv = {};
    for (const l of LEVELS) lv[l] = { spd: h[`wind_speed_${l}hPa`][t], dir: h[`wind_direction_${l}hPa`][t],
      t: h[`temperature_${l}hPa`][t], z: h[`geopotential_height_${l}hPa`][t] };
    return { coord: coords[i], lv };
  });
  return { ...r, data: { times, at } };
}

// Crew reports: queued on the device, sent when there is a connection (works offline in the cockpit).
const QUEUE = 'ac.reports.queue';
export function queueReport(rep) { const q = ls.get(QUEUE) || []; q.push({ ...rep, queued: Date.now() }); ls.set(QUEUE, q); return flushReports(); }
export function pendingReports() { return (ls.get(QUEUE) || []).length; }
export async function flushReports() {
  const q = ls.get(QUEUE) || []; if (!q.length || !navigator.onLine) return { sent: 0, left: q.length };
  const left = []; let sent = 0;
  for (const rep of q) {
    try {
      const r = await fetch('api/reports.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
      if (r.ok || r.status === 422) sent++; else left.push(rep);   // 422 = invalid: drop it, it will never pass
    } catch { left.push(rep); }
  }
  ls.set(QUEUE, left); return { sent, left: left.length };
}
export const recentReports = () => getJSON('api/reports.php', 'ac.reports.recent', 5 * 60e3);
