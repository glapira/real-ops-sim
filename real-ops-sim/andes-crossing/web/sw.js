// Andes Crossing service worker: the escape routes, the map and the app shell work with no connection.
// Live data (METAR, SIGMET, model) is network-first and falls back to the last copy; terrain tiles are cache-first.
const V = 'ac-v1';
const SHELL = ['./', 'index.html', 'app.css', 'app/main.js', 'app/engine.js', 'app/data.js', 'app/map-style.js', 'app/scene3d.js',
  'vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  'data/basemap.json', 'data/airports.json', 'data/navaids.json', 'data/crest.json', 'data/airways.json',
  'data/escape-routes.json', 'data/escape-routes.local.json', 'app/escape.js', 'manifest.webmanifest'];
const KIT = ['/solidaire/shared/kit/kit.css', '/solidaire/shared/kit/kit-components.css', '/solidaire/shared/kit/kit.js'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(V);
  await Promise.all([...SHELL, ...KIT].map(u => c.add(u).catch(() => null)));   // a missing optional file never blocks install
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k);
  self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'elevation-tiles-prod.s3.amazonaws.com') return e.respondWith(cacheFirst(e.request, V + '-tiles'));
  if (u.pathname.includes('/api/') || u.hostname === 'api.open-meteo.com') return e.respondWith(networkFirst(e.request));
  e.respondWith(cacheFirst(e.request, V));
});
async function cacheFirst(req, name) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch { return new Response('', { status: 504 }); }
}
async function networkFirst(req) {
  const c = await caches.open(V + '-live');
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch { return (await c.match(req)) || new Response('{"offline":true}', { status: 503, headers: { 'Content-Type': 'application/json' } }); }
}
// "Save for offline": the page posts a list of terrain tile URLs (the Andes, zooms 4–8) to cache in one go
self.addEventListener('message', e => {
  if (e.data?.type !== 'precache-tiles') return;
  e.waitUntil((async () => {
    const c = await caches.open(V + '-tiles'); let done = 0;
    for (const url of e.data.urls) {
      if (!(await c.match(url))) { try { const r = await fetch(url); if (r.ok) await c.put(url, r); } catch {} }
      if (++done % 25 === 0 || done === e.data.urls.length) e.source?.postMessage({ type: 'precache-progress', done, total: e.data.urls.length });
    }
  })());
});
