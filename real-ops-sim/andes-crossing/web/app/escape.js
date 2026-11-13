// Andes Crossing · escape routes (depressurization / driftdown). No DOM: the iOS shell can reuse it.
// Data: data/escape-routes.local.json on the server (never in the public repo), schema in docs/escape-routes-schema.md.
// Drawing rule: every stretch of the route takes the colour of its escape action (the airport you turn to from there);
// the branch to that airport and the airport's ring use the same colour. Cool hues only: warm colours mean turbulence.
import { nmBetween } from './engine.js';

export const ESC_TOKENS = ['--esc-1', '--esc-2', '--esc-3', '--esc-4', '--esc-5', '--esc-6'];

// one colour index per escape airport, stable within a route set
export function airportColors(routes) {
  const ids = [];
  for (const r of routes) for (const s of r.segments || []) { const a = s.action?.airport; if (a && !ids.includes(a)) ids.push(a); }
  return Object.fromEntries(ids.map((a, i) => [a, i % ESC_TOKENS.length]));
}

export function toGeoJSON(data, aircraft) {
  const routes = (data?.routes || []).filter(r => !r.aircraft || r.aircraft === aircraft || (Array.isArray(r.aircraft) && r.aircraft.includes(aircraft)));
  const colors = airportColors(routes), fc = f => ({ type: 'FeatureCollection', features: f });
  const segs = [], branches = [], decisions = [], airports = new Map(), unresolved = [];
  for (const r of routes) {
    const pos = Object.fromEntries((r.points || []).filter(p => p.lat != null).map(p => [p.ident, [p.lon, p.lat]]));
    if (!r.points?.length || (r.points || []).some(p => p.lat == null)) unresolved.push(r.chart);
    for (const s of r.segments || []) {
      const coords = (s.path || [s.from, s.to]).map(id => pos[id]).filter(Boolean);
      if (coords.length < 2) continue;
      const c = colors[s.action?.airport] ?? -1;
      segs.push({ type: 'Feature', properties: { route: r.chart, from: s.from, to: s.to, color: c, airport: s.action?.airport || '', type: s.action?.type || '', text: s.action?.text || '' }, geometry: { type: 'LineString', coordinates: coords } });
      if (s.action?.via?.length) {
        const start = pos[s.action.from || s.to] || coords[coords.length - 1];
        branches.push({ type: 'Feature', properties: { color: c, airport: s.action.airport, label: `${s.action.type === 'return' ? 'Return' : 'Turn'} to ${s.action.airport}` },
          geometry: { type: 'LineString', coordinates: [start, ...s.action.via.map(v => [v.lon, v.lat])] } });
      }
      if (s.action?.airport && s.action.airport_pos) airports.set(s.action.airport, { type: 'Feature', properties: { icao: s.action.airport, color: c }, geometry: { type: 'Point', coordinates: [s.action.airport_pos.lon, s.action.airport_pos.lat] } });
    }
    for (const p of r.points || []) if (p.role === 'decision' && p.lat != null)
      decisions.push({ type: 'Feature', properties: { ident: p.ident, route: r.chart, note: p.note || '' }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
  }
  return { segments: fc(segs), branches: fc(branches), decisions: fc(decisions), airports: fc([...airports.values()]), colors, unresolved, routes };
}

// Where am I on the escape routes, and what does the chart say to do from here?
export function instruction(gps, geo) {
  if (!gps || !geo.segments.features.length) return null;
  const here = [gps.lon, gps.lat]; let best = null;
  for (const f of geo.segments.features) {
    const cs = f.geometry.coordinates;
    for (let i = 0; i < cs.length; i++) { const d = nmBetween(here, cs[i]); if (!best || d < best.off) best = { off: d, f, i }; }
  }
  if (!best || best.off > 60) return { offRoute: true, off: best ? Math.round(best.off) : null };
  const p = best.f.properties, end = best.f.geometry.coordinates.at(-1);
  return { route: p.route, from: p.from, to: p.to, airport: p.airport, type: p.type, text: p.text, color: p.color,
    toNext: Math.round(nmBetween(here, end)), off: Math.round(best.off) };
}

// MapLibre layers for the escape routes (added under the airport symbols). colorExpr maps the index to token colours.
export function layers(colors) {
  const col = ['match', ['get', 'color'], 0, colors[0], 1, colors[1], 2, colors[2], 3, colors[3], 4, colors[4], 5, colors[5], colors.ink];
  return [
    { id: 'esc-seg-casing', type: 'line', source: 'esc-seg', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.casing, 'line-width': 9 } },
    { id: 'esc-seg', type: 'line', source: 'esc-seg', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 5 } },
    { id: 'esc-branch', type: 'line', source: 'esc-branch', layout: { 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 3, 'line-dasharray': [2, 1.2] } },
    { id: 'esc-branch-label', type: 'symbol', source: 'esc-branch', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, -1] }, paint: { 'text-color': col, 'text-halo-color': colors.halo, 'text-halo-width': 2 } },
    { id: 'esc-apt', type: 'circle', source: 'esc-apt', paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': col, 'circle-stroke-width': 3 } },
    { id: 'esc-dp', type: 'symbol', source: 'esc-dp', layout: { 'icon-image': 'diamond', 'icon-size': 0.55, 'icon-allow-overlap': true, 'text-field': ['get', 'ident'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top' }, paint: { 'icon-color': colors.ink, 'icon-halo-color': colors.halo, 'icon-halo-width': 2, 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 2 } },
  ];
}
