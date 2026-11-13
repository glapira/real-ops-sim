// Andes Crossing · map style (DESIGN.md §3). Colours come from the CSS tokens (andes.css over kit.css), read at build
// time, so light, dark and Increase Contrast all follow the kit. The style stays portable to MapLibre Native.
import { layers as escapeLayers, ESC_TOKENS } from './escape.js';
const TERRARIUM = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
const EMPTY = { type: 'FeatureCollection', features: [] };

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const num = (n, d) => { const x = parseFloat(v(n)); return Number.isFinite(x) ? x : d; };
  return {
    ocean: v('--map-ocean'), land: v('--map-land'), landDim: v('--map-land-dim'), lake: v('--map-lake'),
    hillShadow: v('--map-hill-shadow'), hillHi: v('--map-hill-highlight'), hillAccent: v('--map-hill-accent'),
    coast: v('--map-coast'), border: v('--map-border'), fir: v('--map-fir'),
    awyUp: v('--map-airway-upper'), awyLow: v('--map-airway-lower'), awyCase: v('--map-airway-casing'),
    fix: v('--map-fix'), navaid: v('--map-navaid'), apt: v('--map-airport'), aptFill: v('--map-airport-fill'),
    label: v('--map-label'), label2: v('--map-label-2'), halo: v('--map-halo'), select: v('--map-select'),
    route: v('--map-route'), routeCase: v('--map-route-casing'), sigmet: v('--map-sigmet'), sigmetFill: v('--map-sigmet-fill'),
    sky: v('--map-sky'), horizon: v('--map-horizon'), fog: v('--map-fog'), relief: v('--map-relief-high'),
    rLight: v('--risk-light'), rMod: v('--risk-moderate'), rSev: v('--risk-severe'), rExt: v('--risk-extreme'), rNil: v('--risk-nil'),
    fLight: num('--risk-fill-light', .4), fMod: num('--risk-fill-moderate', .5), fSev: num('--risk-fill-severe', .6),
    esc: ESC_TOKENS.map(v), hatch: v('--risk-hatch'), dark: document.documentElement.getAttribute('data-theme') === 'dark',
  };
}

const riskColor = t => ['match', ['get', 'cat'], 1, t.rLight, 2, t.rMod, 3, t.rSev, 4, t.rExt, t.rNil];
const riskFill = t => ['match', ['get', 'cat'], 1, t.fLight, 2, t.fMod, 3, t.fSev, 0];
const font = w => [w === 'b' ? 'Noto Sans Medium' : 'Noto Sans Regular'];

export function buildStyle(base, t = tokens()) {
  const glyphs = new URL('fonts/{fontstack}/{range}.pbf', location.href).href.replace('%7Bfontstack%7D', '{fontstack}').replace('%7Brange%7D', '{range}');
  return {
    version: 8, glyphs,
    sky: { 'sky-color': t.sky, 'horizon-color': t.horizon, 'fog-color': t.fog, 'fog-ground-blend': 0.6, 'horizon-fog-blend': 0.5, 'sky-horizon-blend': 0.8 },
    sources: {
      countries: { type: 'geojson', data: base.countries },
      borders: { type: 'geojson', data: base.borders },
      coast: { type: 'geojson', data: base.coast },
      'dem-shade': { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 10, attribution: 'Terrain: Mapzen / AWS Open Data' },
      'dem-terrain': { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 10 },
      crest: { type: 'geojson', data: EMPTY },
      'turb-area': { type: 'geojson', data: EMPTY }, 'turb-onset': { type: 'geojson', data: EMPTY }, 'turb-end': { type: 'geojson', data: EMPTY },
      'wafs-onset': { type: 'geojson', data: EMPTY },
      sigmet: { type: 'geojson', data: EMPTY },
      airways: { type: 'geojson', data: EMPTY }, navaids: { type: 'geojson', data: EMPTY }, airports: { type: 'geojson', data: EMPTY },
      'esc-seg': { type: 'geojson', data: EMPTY }, 'esc-branch': { type: 'geojson', data: EMPTY }, 'esc-apt': { type: 'geojson', data: EMPTY }, 'esc-dp': { type: 'geojson', data: EMPTY },
      ownship: { type: 'geojson', data: EMPTY }, route: { type: 'geojson', data: EMPTY }, crossing: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': t.ocean } },
      { id: 'land-dim', type: 'fill', source: 'countries', paint: { 'fill-color': t.landDim, 'fill-antialias': false } },
      { id: 'land', type: 'fill', source: 'countries', filter: ['in', ['get', 'name'], ['literal', ['Chile', 'Argentina']]], paint: { 'fill-color': t.land, 'fill-antialias': false } },
      { id: 'hillshade', type: 'hillshade', source: 'dem-shade', paint: {
        'hillshade-shadow-color': t.hillShadow, 'hillshade-highlight-color': t.hillHi, 'hillshade-accent-color': t.hillAccent,
        'hillshade-illumination-direction': 315, 'hillshade-illumination-anchor': 'viewport',
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 2, t.dark ? 0.30 : 0.25, 4, t.dark ? 0.45 : 0.38, 6, t.dark ? 0.60 : 0.50, 8, t.dark ? 0.55 : 0.45, 10, t.dark ? 0.40 : 0.35] } },

      // turbulence: model bands (engine) and WAFS onset contours. Above relief, below everything aeronautical.
      { id: 'turb-fill', type: 'fill', source: 'turb-area', paint: { 'fill-color': riskColor(t), 'fill-opacity': riskFill(t), 'fill-antialias': false } },
      { id: 'turb-hatch', type: 'fill', source: 'turb-area', minzoom: 4, filter: ['>=', ['get', 'cat'], 3], paint: { 'fill-pattern': 'hatch' } },
      { id: 'turb-end', type: 'line', source: 'turb-end', paint: { 'line-color': riskColor(t), 'line-width': 1.25, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } },
      { id: 'turb-onset-glow', type: 'line', source: 'turb-onset', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': riskColor(t), 'line-width': 12, 'line-opacity': 0.28, 'line-blur': 6 } },
      { id: 'turb-onset', type: 'line', source: 'turb-onset', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': riskColor(t), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 7, 3.5] } },
      { id: 'wafs-onset', type: 'line', source: 'wafs-onset', layout: { 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'cat'], 'severe', t.rSev, t.rMod], 'line-width': ['match', ['get', 'cat'], 'severe', 2.25, 1.75] } },

      { id: 'sigmet-fill', type: 'fill', source: 'sigmet', filter: ['get', 'turb'], paint: { 'fill-color': t.sigmetFill } },
      { id: 'sigmet-line', type: 'line', source: 'sigmet', filter: ['get', 'turb'], paint: { 'line-color': t.sigmet, 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.9 } },

      { id: 'coastline', type: 'line', source: 'coast', paint: { 'line-color': t.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 0.75, 10, 1] } },
      { id: 'country-border', type: 'line', source: 'borders', paint: { 'line-color': t.border, 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 5, 0.75, 8, 1.25] } },
      { id: 'crest', type: 'line', source: 'crest', minzoom: 3.5, paint: { 'line-color': t.label2, 'line-width': 1, 'line-opacity': 0.55, 'line-dasharray': [1, 3] } },

      { id: 'airway-casing', type: 'line', source: 'airways', paint: { 'line-color': t.awyCase, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.6, 7, 3.5, 9, 4.25] } },
      { id: 'airway', type: 'line', source: 'airways', paint: { 'line-color': ['match', ['get', 'level'], 'lower', t.awyLow, t.awyUp], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 5, 1, 7, 1.5, 9, 2.25] } },
      { id: 'airway-label', type: 'symbol', source: 'airways', minzoom: 5, layout: { 'symbol-placement': 'line', 'symbol-spacing': 380, 'text-field': ['get', 'ident'], 'text-font': font('b'), 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 8, 12], 'text-rotation-alignment': 'viewport', 'text-padding': 8 }, paint: { 'text-color': t.awyUp, 'text-halo-color': t.halo, 'text-halo-width': 2 } },

      // escape routes (Jeppesen ANDES charts, server only): each stretch in the colour of its escape airport (escape.js)
      ...escapeLayers({ ...t.esc, ink: t.label, casing: t.routeCase, halo: t.halo, other: t.label2 }),

      // planned route: neutral line, risk-coloured casing (DESIGN §3.2 item 14)
      { id: 'route-risk', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': riskColor(t), 'line-width': 9, 'line-opacity': ['case', ['>', ['get', 'cat'], 0], 0.95, 0.5] } },
      { id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': t.routeCase, 'line-width': 5.5 } },
      { id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': t.route, 'line-width': 3 } },
      { id: 'crossing', type: 'circle', source: 'crossing', paint: { 'circle-radius': 7, 'circle-color': t.routeCase, 'circle-stroke-color': t.route, 'circle-stroke-width': 2.5 } },
      { id: 'crossing-label', type: 'symbol', source: 'crossing', layout: { 'text-field': ['get', 'label'], 'text-font': font('b'), 'text-size': 11, 'text-offset': [0, -1.4], 'text-anchor': 'bottom' }, paint: { 'text-color': t.label, 'text-halo-color': t.halo, 'text-halo-width': 2 } },
      { id: 'navaid', type: 'symbol', source: 'navaids', minzoom: 6, layout: { 'icon-image': 'hex', 'icon-size': 0.5, 'icon-allow-overlap': true, 'text-field': ['step', ['zoom'], '', 7, ['get', 'ident']], 'text-font': font('b'), 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'icon-color': t.navaid, 'text-color': t.navaid, 'text-halo-color': t.halo, 'text-halo-width': 1.25 } },

      { id: 'airport', type: 'circle', source: 'airports', filter: ['step', ['zoom'], ['==', ['get', 'tier'], 1], 4, ['<=', ['get', 'tier'], 2], 6, true], paint: {
        'circle-radius': ['match', ['get', 'tier'], 1, 6, 2, 4.5, 3], 'circle-color': t.aptFill,
        'circle-stroke-color': t.apt, 'circle-stroke-width': ['match', ['get', 'tier'], 1, 2, 2, 1.75, 1.5] } },
      { id: 'airport-label', type: 'symbol', source: 'airports',
        filter: ['step', ['zoom'], ['==', ['get', 'tier'], 1], 5, ['<=', ['get', 'tier'], 2], 7, true],
        layout: { 'symbol-sort-key': ['get', 'tier'],
          'text-field': ['step', ['zoom'], ['get', 'icao'], 5.5, ['format', ['get', 'icao'], {}, '\n', {}, ['get', 'short'], { 'font-scale': 0.82, 'text-font': ['literal', font('r')] }]],
          'text-font': font('b'), 'text-size': ['match', ['get', 'tier'], 1, 12.5, 11], 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.9, 'text-justify': 'auto' },
        paint: { 'text-color': t.label, 'text-halo-color': t.halo, 'text-halo-width': 1.5 } },

      { id: 'ownship-acc', type: 'circle', source: 'ownship', paint: { 'circle-radius': 18, 'circle-color': t.select, 'circle-opacity': 0.18 } },
      { id: 'ownship', type: 'symbol', source: 'ownship', layout: { 'icon-image': 'ownship', 'icon-size': 0.6, 'icon-rotate': ['get', 'track'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true }, paint: { 'icon-color': t.select, 'icon-halo-color': t.halo, 'icon-halo-width': 2 } },

      // turbulence labels last, so the onset reads above everything: "MOD from here"
      { id: 'turb-onset-label', type: 'symbol', source: 'turb-onset', minzoom: 4.5, layout: { 'symbol-placement': 'line-center', 'text-field': ['concat', ['match', ['get', 'cat'], 1, 'LGT', 2, 'MOD', 3, 'SEV', ''], ' turbulence from here'], 'text-font': font('b'), 'text-size': 11, 'text-offset': [0, -1], 'text-rotation-alignment': 'viewport' }, paint: { 'text-color': riskColor(t), 'text-halo-color': t.halo, 'text-halo-width': 2 } },
      { id: 'sigmet-label', type: 'symbol', source: 'sigmet', filter: ['get', 'turb'], layout: { 'text-field': ['concat', 'SIGMET · ', ['get', 'qualifier'], ' ', ['get', 'hazard'], '\n', ['get', 'fir']], 'text-font': font('b'), 'text-size': 11 }, paint: { 'text-color': t.sigmet, 'text-halo-color': t.halo, 'text-halo-width': 2 } },
    ],
  };
}

// SDF symbols drawn once (white on transparent; the layer tints them). DESIGN §3.1.
export function addImages(map, t = tokens()) {
  const draw = (id, size, fn, sdf = true) => {
    if (map.hasImage(id)) map.removeImage(id);
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.strokeStyle = g.fillStyle = '#fff'; fn(g, size);
    map.addImage(id, g.getImageData(0, 0, size, size), { pixelRatio: 2, sdf });
  };
  draw('hex', 48, (g, s) => { g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g.lineTo(s / 2 + 16 * Math.cos(a), s / 2 + 16 * Math.sin(a)); } g.closePath(); g.stroke(); g.beginPath(); g.arc(s / 2, s / 2, 3, 0, 7); g.fill(); });
  draw('diamond', 40, (g, s) => { g.beginPath(); g.moveTo(s / 2, 3); g.lineTo(s - 3, s / 2); g.lineTo(s / 2, s - 3); g.lineTo(3, s / 2); g.closePath(); g.fill(); });
  draw('ownship', 64, (g, s) => { g.beginPath(); g.moveTo(s / 2, 6); g.lineTo(s - 12, s - 8); g.lineTo(s / 2, s - 20); g.lineTo(12, s - 8); g.closePath(); g.fill(); });
  // 45° hatch for severe, tinted with the hatch token (not SDF: a pattern)
  draw('hatch', 16, (g, s) => { g.strokeStyle = t.hatch || 'rgba(255,255,255,.38)'; g.lineWidth = 1.5; g.beginPath(); for (let k = -s; k < s * 2; k += 8) { g.moveTo(k, s); g.lineTo(k + s, 0); } g.stroke(); }, false);
}

// Recolour without setStyle, so sources and the camera stay (DESIGN §2).
export function applyTheme(map, base) {
  const t = tokens(), st = buildStyle(base, t);
  for (const l of st.layers) {
    if (!map.getLayer(l.id)) continue;
    for (const [k, v] of Object.entries(l.paint || {})) { if (k !== 'fill-pattern') map.setPaintProperty(l.id, k, v); }
  }
  map.setSky(st.sky); addImages(map, t);
}
