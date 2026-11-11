const CACHE = 'heures-v3';
const FILES = ['./','index.html','styles.css','app.js','manifest.json',
  'vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js',
  'icons/apple-touch-icon.png','assets/logo.png','assets/logo-160.png','fonts/PlusJakartaSans-latin.woff2','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first (so updates arrive), cache fallback (offline)
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match('index.html'))));
});
