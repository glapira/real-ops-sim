// Builds web/data/basemap.json: Natural Earth land and countries (1:50m) for South America, as GeoJSON.
// Run from a folder where world-atlas and topojson-client are installed: node build_basemap.mjs <node_modules dir> <out file>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const [nm, out] = process.argv.slice(2);
const require = createRequire(nm + '/');
const { feature, mesh } = require('topojson-client');
const topo = JSON.parse(readFileSync(nm + '/world-atlas/countries-50m.json', 'utf8'));
const BBOX = [-95, -60, -25, 15];
const inBox = g => {
  let hit = false;
  const walk = c => { if (typeof c[0] === 'number') { if (c[0] >= BBOX[0] && c[0] <= BBOX[2] && c[1] >= BBOX[1] && c[1] <= BBOX[3]) hit = true; } else c.forEach(walk); };
  walk(g.coordinates); return hit;
};
const round = g => { const r = c => typeof c[0] === 'number' ? [Math.round(c[0] * 1e3) / 1e3, Math.round(c[1] * 1e3) / 1e3] : c.map(r); return { ...g, coordinates: r(g.coordinates) }; };
const countries = feature(topo, topo.objects.countries).features.filter(f => f.geometry && inBox(f.geometry))
  .map(f => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: round(f.geometry) }));
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const coast = mesh(topo, topo.objects.countries, (a, b) => a === b);
const clip = m => ({ ...m, coordinates: m.coordinates.filter(l => l.some(p => p[0] >= BBOX[0] && p[0] <= BBOX[2] && p[1] >= BBOX[1] && p[1] <= BBOX[3])) });
writeFileSync(out, JSON.stringify({
  countries: { type: 'FeatureCollection', features: countries },
  borders: { type: 'Feature', properties: {}, geometry: round(clip(borders)) },
  coast: { type: 'Feature', properties: {}, geometry: round(clip(coast)) },
}));
console.log('countries', countries.length);
