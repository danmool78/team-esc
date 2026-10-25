/* 서비스 워커: 설치형 앱(PWA)과 지도 타일 보관.
   지도 타일(위성사진·OSM·고도)은 한 번 받으면 기기에 보관해 두고 다음부터 바로 꺼내 쓴다 — 같은 지역을 다시 열면 받지 않고 뜬다.
   보관은 MAX장까지, 넘치면 먼저 넣은 것부터 지운다. (꺼내 쓸 때마다 지우고 다시 넣어 최근 것을 남기려 했더니
   그 저장 비용 때문에 두 번째 열기가 첫 번째보다 느려졌다)
   게임 데이터는 실시간이라 보관하지 않는다 */
const CACHE = 'teamesc-v2', TILES = 'teamesc-tiles-v1';
const MAX = 2500; // 타일 한 장 20~40KB → 대략 60~80MB
const TILE_HOSTS = ['clarity.maptiles.arcgis.com', 'server.arcgisonline.com', 'tile.openstreetmap.org', 's3.amazonaws.com'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('assets/vendor/three.module.min.js'))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const isTile = u => TILE_HOSTS.includes(u.hostname) && (u.hostname !== 's3.amazonaws.com' || u.pathname.startsWith('/elevation-tiles-prod/'));
let puts = 0;
async function trim(c) {
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX; i++) await c.delete(keys[i]);
}
async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await c.put(req, res.clone());
    if (++puts % 100 === 0) trim(c);
  }
  return res;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (isTile(u)) { e.respondWith(tile(e.request).catch(() => fetch(e.request))); return; }
  if (u.pathname.includes('/assets/vendor/')) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
