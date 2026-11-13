// Builds web/data/crest.json: the Andes crest approximated by the Argentina–Chile border (it follows the main
// drainage divide between about 22°S and 52°S), simplified to one point every ~0.25° of latitude.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const [nm, out] = process.argv.slice(2);
const require = createRequire(nm + '/');
const { mesh } = require('topojson-client');
const topo = JSON.parse(readFileSync(nm + '/world-atlas/countries-10m.json', 'utf8'));
const ids = new Set(['032', '152']);
const m = mesh(topo, topo.objects.countries, (a, b) => a !== b && ids.has(a.id) && ids.has(b.id));
// join the pieces into one north→south line
let pts = m.coordinates.flat().filter(p => p[1] < -21.5 && p[1] > -52.5).sort((a, b) => b[1] - a[1]);
const line = []; let last = null;
for (const p of pts) { if (!last || last[1] - p[1] >= 0.25) { line.push([+p[0].toFixed(3), +p[1].toFixed(3)]); last = p; } }
writeFileSync(out, JSON.stringify({ type: 'Feature', properties: { name: 'Andes crest (AR–CL border)', note: 'approximation' }, geometry: { type: 'LineString', coordinates: line } }));
console.log('crest points', line.length, line[0], line[line.length - 1]);
