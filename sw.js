// LIFE — service worker : l'app s'ouvre même hors ligne (coquille en cache). Les messages ne passent jamais par le cache.
const CACHE = 'life-V.0.0.18';   // changer cette valeur à chaque version : les appareils se mettent à jour d'eux-mêmes
const COQUILLE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'qr.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // webhook : toujours le réseau
  // en ligne : la dernière version publiée (sans le cache du navigateur) ; hors ligne : la copie gardée
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
