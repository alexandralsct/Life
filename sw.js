// LIFE — service worker : l'app s'ouvre même hors ligne (coquille en cache). Les messages ne passent jamais par le cache.
const CACHE = 'life-V.0.0.31';   // changer cette valeur à chaque version (avec VERSION dans app.js) : les appareils se mettent à jour d'eux-mêmes
const COQUILLE = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'qr.js',
  'fonts/instrument-sans.woff2', 'fonts/plex-mono-400.woff2', 'fonts/plex-mono-400-italique.woff2', 'fonts/plex-mono-500.woff2',
  'fonts/plex-mono-600.woff2', 'fonts/plex-mono-700.woff2'];
const ATTENTE_RESEAU = 3000;   // réseau qui traîne : au-delà, la copie gardée (la nouvelle version sera prise au prochain lancement)
let lentJusqua = 0;            // après une attente dépassée, les fichiers suivants (styles, script, polices) partent de la copie
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE))); self.skipWaiting(); });
// seulement SES anciennes copies (préfixe life-) : les autres apps du même site (carte, maintenance) gardent les leurs
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('life-') && n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // serveur des messages : toujours le réseau
  // en ligne : la dernière version publiée (sans le cache du navigateur), seulement si la réponse est bonne (r.ok) ;
  // hors ligne, ou réseau sans réponse après 3 s : la copie gardée.
  const reseau = fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const c = r.clone(); return caches.open(CACHE).then(x => x.put(e.request, c)).then(() => r, () => r); }
    return r;
  });
  e.waitUntil(reseau.catch(() => {}));   // la mise en cache continue même si la copie a déjà été servie
  e.respondWith(caches.match(e.request).then(copie => {
    if (!copie) return reseau;
    if (Date.now() < lentJusqua) return copie;   // le réseau vient de traîner : la copie tout de suite (mise à jour en fond)
    return new Promise(ok => {
      const minuterie = setTimeout(() => { lentJusqua = Date.now() + 15000; ok(copie); }, ATTENTE_RESEAU);
      reseau.then(r => { clearTimeout(minuterie); ok(r.ok ? r : copie); }, () => { clearTimeout(minuterie); ok(copie); });
    });
  }));
});
