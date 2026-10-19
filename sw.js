// LIFE — service worker : l'app s'ouvre même hors ligne (coquille en cache). Les messages ne passent jamais par le cache.
const CACHE = 'life-V.0.0.5.8';   // un chiffre par position (règle de la propriétaire, 13/10) ; changer cette valeur à chaque version (avec VERSION dans app.js) : les appareils se mettent à jour d'eux-mêmes
const COQUILLE = ['./', 'index.html', 'boussole.html', 'app.js', 'app.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'qr.js', 'connexion.js', 'connexion.css',
  'fonts/instrument-sans.woff2', 'fonts/plex-mono-400.woff2', 'fonts/plex-mono-400-italique.woff2', 'fonts/plex-mono-500.woff2',
  'fonts/plex-mono-600.woff2', 'fonts/plex-mono-700.woff2'];
// Empreintes SHA-256 de la coquille (audit de sécurité LC3) : le Cache Storage est commun à tout le site, une autre page
// pourrait y glisser une copie piégée. Une copie n'est servie, et une réponse n'est gardée, que si son empreinte est
// celle-ci. Ce fichier-ci n'est jamais dans le Cache Storage : personne ne peut changer ces empreintes depuis une page.
// Recalculées par « node tests/empreintes.mjs » ; vérifiées par le garde-fou.
const EMPREINTES = {
  'index.html': 'c5983ec5fd3cf6e8b5bafa6ee2826cec2436797f8bf054d9a34054bdf9b79060',
  'boussole.html': '9b670ef040ff25ea54f232de812cc49dddf60f97d4c7a7c271b68d4899497c95',
  'app.js': '7abf9a614baefc5b06845151e3ee811c4dd6c7ae9a3acb90b30e754d7094dc7a',
  'app.css': '3d52e0cc340a01a5cd91bcc8723c9740d9ba1853aa80d3ea5542e8a17e6d6921',
  'manifest.webmanifest': '59b243d98715d5a854c578e49a063b4896d74b9792ba1152c07ff43deeaf7223',
  'icon.svg': '3db4a287148a7d8bb77418ca5408d217a967804f150eca013b5a03f9e39f3d35',
  'icon-192.png': 'e99334a6b4cec7dfd82972c3cdda40bd6506d80abb1ab6d24dcc60edde6c0ffd',
  'icon-512.png': '911decb9b5c73875a1783cf51b022846e0f02cbf75f110e2a0f800a73f6a65dc',
  'icon-maskable-512.png': '48d9d5e3aa2e608158933d22e566853ca8c34a2e4fcda8b7b3a12f374c035c59',
  'qr.js': '14685aab1677fc1e530c7e761a28bd842ede7a18fcd3e804b3e7037ca0fb0444',
  'connexion.js': 'c25c5a9ca19236108606957edfcf7049d7c95327873f6b9f06ed4e0664e28b5d',
  'connexion.css': '01bf86c5c909a65f76fd2a55214ead405d8ce57ff1d2d394ab7eac950c8819ce',
  'fonts/instrument-sans.woff2': '6219bc4bfdfc5d9b2201dcdf046218b122a758f932e25ed5f168f929b7ca2311',
  'fonts/plex-mono-400.woff2': 'c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac',
  'fonts/plex-mono-400-italique.woff2': '2665f5fbbb334780fa135c7f1dc6e2459061a2d6d44c32b7c1fdbc34cde65ede',
  'fonts/plex-mono-500.woff2': 'a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0',
  'fonts/plex-mono-600.woff2': 'ad4580d8cb4b5f627c2d18457656732f7f7b070f7837fbc380e08054157e6f6c',
  'fonts/plex-mono-700.woff2': '9e1455e6e9c5866f607e464fffb7855486dcf575b7e69b83a3d234e587fce41b'
};
const ATTENTE_RESEAU = 3000;   // réseau qui traîne : au-delà, la copie gardée (la nouvelle version sera prise au prochain lancement)
let lentJusqua = 0;            // après une attente dépassée, les fichiers suivants (styles, script, polices) partent de la copie
const nomDe = url => { const r = url.slice(self.registration.scope.length).split(/[?#]/)[0]; return r === '' ? 'index.html' : r; };
async function intacte(nom, reponse) {   // true si le fichier n'est pas de la coquille, ou si son empreinte est la bonne
  const attendue = EMPREINTES[nom]; if (!attendue || !reponse) return !!reponse;
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', await reponse.clone().arrayBuffer()));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('') === attendue;
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(COQUILLE.map(f => fetch(f, { cache: 'no-cache' })
    .then(async r => { if (r.ok && await intacte(nomDe(new URL(f, self.registration.scope).href), r)) await c.put(f, r); }).catch(() => {})))));
  self.skipWaiting();
});
// seulement SES anciennes copies (préfixe life-) : les autres apps du même site (carte, maintenance) gardent les leurs
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('life-') && n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // serveur des messages : toujours le réseau
  const nom = nomDe(e.request.url);
  // en ligne : la dernière version publiée (sans le cache du navigateur), gardée seulement si la réponse est bonne (r.ok)
  // et intacte ; hors ligne, ou réseau sans réponse après 3 s : la copie gardée, si elle est intacte.
  const reseau = fetch(e.request, { cache: 'no-cache' }).then(async r => {
    if (r.ok && await intacte(nom, r)) { const c = r.clone(); await caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); }
    return r;
  });
  e.waitUntil(reseau.catch(() => {}));   // la mise en cache continue même si la copie a déjà été servie
  // seulement dans SON cache (jamais caches.match, qui cherche dans les caches de tout le site)
  const garde = caches.open(CACHE).then(c => c.match(e.request)).then(async copie => {
    if (copie && !(await intacte(nom, copie))) { await caches.open(CACHE).then(c => c.delete(e.request)); return null; }   // piégée : jetée
    return copie;
  });
  e.respondWith(garde.then(copie => {
    if (!copie) return reseau;
    if (Date.now() < lentJusqua) return copie;   // le réseau vient de traîner : la copie tout de suite (mise à jour en fond)
    return new Promise(ok => {
      const minuterie = setTimeout(() => { lentJusqua = Date.now() + 15000; ok(copie); }, ATTENTE_RESEAU);
      reseau.then(r => { clearTimeout(minuterie); ok(r.ok ? r : copie); }, () => { clearTimeout(minuterie); ok(copie); });
    });
  }));
});

// Vraies notifications (Web Push, envoyées par le serveur) : {titre, corps, fil, tag}. Toucher la notification ouvre LIFE
// (sur le fil indiqué si c'est un nom de fil simple).
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corps: e.data ? e.data.text() : '' }; }
  const fil = /^[a-z]{2,20}$/.test(String(d.fil || '')) ? d.fil : '';
  e.waitUntil(self.registration.showNotification(String(d.titre || 'LIFE').slice(0, 80), { body: String(d.corps || '').slice(0, 300), tag: String(d.tag || 'life').slice(0, 60),
    icon: 'icon-192.png', badge: 'icon-192.png', data: { fil } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const fil = (e.notification.data || {}).fil || '';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(w => {
    for (const c of w) { if ('focus' in c) { if (fil) c.postMessage({ life: 'fil', fil }); return c.focus(); } }
    return clients.openWindow(fil ? './#' + fil : './');
  }));
});
