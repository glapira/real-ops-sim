// Andes Crossing · escape routes (depressurization / driftdown). No DOM: the iOS shell can reuse it.
// Data: data/escape-routes.local.json on the server (never in the public repo), schema in docs/escape-routes-schema.md.
// Drawing rule: every stretch of the route takes the colour of its escape action (the airport you turn to from there);
// the branch to that airport and the airport's ring use the same colour. Cool hues only: warm colours mean turbulence.
import { nmBetween } from './engine.js';

export const ESC_TOKENS = ['--esc-1', '--esc-2', '--esc-3', '--esc-4', '--esc-5', '--esc-6'];

// one colour index per escape airport of the selected chart (a chart has three airports at most)
export function airportColors(route) {
  const ids = [];
  for (const s of route?.segments || []) { const a = s.action?.airport; if (a && !ids.includes(a)) ids.push(a); }      // main escape airports first:
  for (const s of route?.segments || []) { const a = s.action?.alternate; if (a && !ids.includes(a)) ids.push(a); }    // they get the most distinct colours
  return Object.fromEntries(ids.map((a, i) => [a, i % ESC_TOKENS.length]));
}
export const routesFor = (data, aircraft) => (data?.routes || []).filter(r => !r.aircraft || r.aircraft === aircraft || (Array.isArray(r.aircraft) && r.aircraft.includes(aircraft)));

// GeoJSON for the selected chart: each stretch in its escape airport's colour, the escape path dashed in the same
// colour, the escape airports ringed, decision points as diamonds. Other charts of the aircraft: thin neutral lines.
export function toGeoJSON(data, aircraft, selectedId) {
  const routes = routesFor(data, aircraft), sel = routes.find(r => r.id === selectedId) || routes[0] || null;
  const colors = airportColors(sel), fc = f => ({ type: 'FeatureCollection', features: f });
  const segs = [], branches = [], decisions = [], airports = new Map();
  for (const r of routes) {
    const pos = Object.fromEntries((r.points || []).filter(p => p.lat != null).map(p => [p.ident, [p.lon, p.lat]]));
    const isSel = r === sel;
    for (const s of r.segments || []) {
      const coords = (s.path || [s.from, s.to]).map(id => pos[id]).filter(Boolean);
      if (coords.length < 2) continue;
      const c = isSel ? (colors[s.action?.airport] ?? 5) : -1;
      segs.push({ type: 'Feature', properties: { route: r.id, chart: r.chart, sel: isSel, from: s.from, to: s.to, color: c, airport: s.action?.airport || '', type: s.action?.type || '', text: s.action?.text || '' }, geometry: { type: 'LineString', coordinates: coords } });
      if (!isSel) continue;
      const a = s.action || {}, start = a.start ? [a.start.lon, a.start.lat] : coords[Math.floor(coords.length / 2)];
      if (a.via?.length) branches.push({ type: 'Feature', properties: { color: c, schematic: !!a.schematic,
        label: a.airport ? `${a.type === 'return' ? 'Return' : a.type === 'continue' ? 'Continue' : 'Turn'} to ${a.airport}` : 'To the coast' },
        geometry: { type: 'LineString', coordinates: [start, ...a.via.map(v => [v.lon, v.lat])] } });
      for (const id of [a.airport, a.alternate]) {
        const ap = id && (data.airports?.[id] || (id === a.airport && a.airport_pos));
        if (ap) airports.set(id, { type: 'Feature', properties: { icao: id, color: colors[id] ?? 5, alt: id !== a.airport }, geometry: { type: 'Point', coordinates: [ap.lon, ap.lat] } });
      }
    }
    if (isSel) for (const p of r.points || []) if (p.role === 'decision' && p.lat != null)
      decisions.push({ type: 'Feature', properties: { ident: p.ident }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
  }
  return { segments: fc(segs), branches: fc(branches), decisions: fc(decisions), airports: fc([...airports.values()]), colors, selected: sel, routes };
}

// Where am I on the escape routes, and what does the chart say to do from here?
export function instruction(gps, geo) {
  if (!gps || !geo.segments.features.length) return null;
  const here = [gps.lon, gps.lat]; let best = null;
  for (const f of geo.segments.features) {
    if (!f.properties.sel) continue;
    const cs = f.geometry.coordinates;
    for (let i = 0; i < cs.length; i++) { const d = nmBetween(here, cs[i]); if (!best || d < best.off) best = { off: d, f, i }; }
  }
  if (!best || best.off > 60) return { offRoute: true, off: best ? Math.round(best.off) : null };
  const p = best.f.properties, end = best.f.geometry.coordinates.at(-1);
  return { route: p.route, from: p.from, to: p.to, airport: p.airport, type: p.type, text: p.text, color: p.color,
    toNext: Math.round(nmBetween(here, end)), off: Math.round(best.off) };
}

// MapLibre layers for the escape routes. colors: { 0..5: token colours, ink, casing, halo, other }.
export function layers(colors) {
  const col = ['match', ['get', 'color'], 0, colors[0], 1, colors[1], 2, colors[2], 3, colors[3], 4, colors[4], 5, colors[5], colors.other];
  return [
    { id: 'esc-other', type: 'line', source: 'esc-seg', filter: ['!', ['get', 'sel']], layout: { 'line-join': 'round' }, paint: { 'line-color': colors.other, 'line-width': 2, 'line-opacity': 0.6 } },
    { id: 'esc-seg-casing', type: 'line', source: 'esc-seg', filter: ['get', 'sel'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.casing, 'line-width': 10 } },
    { id: 'esc-seg', type: 'line', source: 'esc-seg', filter: ['get', 'sel'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 6 } },
    { id: 'esc-branch', type: 'line', source: 'esc-branch', filter: ['!', ['get', 'schematic']], layout: { 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 3, 'line-dasharray': [2.5, 1.5] } },
    { id: 'esc-branch-schematic', type: 'line', source: 'esc-branch', filter: ['get', 'schematic'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col, 'line-width': 3, 'line-dasharray': [0.5, 2] } },
    { id: 'esc-branch-label', type: 'symbol', source: 'esc-branch', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-offset': [0, -1], 'text-rotation-alignment': 'viewport' }, paint: { 'text-color': col, 'text-halo-color': colors.halo, 'text-halo-width': 2.5 } },
    { id: 'esc-apt', type: 'circle', source: 'esc-apt', paint: { 'circle-radius': ['case', ['get', 'alt'], 9, 13], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': col, 'circle-stroke-width': ['case', ['get', 'alt'], 2, 3.5] } },
    { id: 'esc-dp', type: 'symbol', source: 'esc-dp', layout: { 'icon-image': 'diamond', 'icon-size': 0.6, 'icon-allow-overlap': true, 'text-field': ['get', 'ident'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'icon-color': colors.ink, 'icon-halo-color': colors.halo, 'icon-halo-width': 2, 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 2 } },
  ];
}
