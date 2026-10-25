/* 서비스 워커: 설치형 앱(PWA)으로 쓸 수 있게 하는 최소한. 실시간 게임이라 캐시는 three.js만 */
const CACHE = 'teamesc-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('assets/vendor/three.module.min.js'))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (!e.request.url.includes('/assets/vendor/')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
