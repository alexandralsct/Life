// Point 8 de l'audit du 13/10 : stockage (échec d'écriture signalé, limite par fil) et service worker (repli sur la
// copie après 3 s de réseau lent, seules les bonnes réponses en cache).
import { fauxServeur, ouvrir, ls, actualiser, pause } from './outils.mjs';

const serie = (n, fil, long = 100) => Array.from({ length: n }, (_, i) => ({ id: 'S-' + fil + '-' + i, t: '2026-10-01 10:' + String(Math.floor(i / 60) % 60).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0'), auteur: 'systeme', fil, texte: fil + ' ' + i + ' ' + 'z'.repeat(long) }));

export const tests = [
  { nom: 'Stockage plein : signalé, et l\'historique hors ligne est réduit plutôt que perdu', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const plafond = (c, p) => c.addInitScript(() => { const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'life.messages' && String(v).length > 30000) { const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { messages: serie(200, 'travail') }, avantChargement: plafond });
    S.ajouter({ id: 'S-neuf-0', horodatage: S.heure(), fil: 'general', texte: 'nouveau' });
    await actualiser(page); await pause(500);
    const t = await page.textContent('#bandeau');
    verif(/Stockage de l'appareil plein : seuls les 80 derniers messages de chaque fil/.test(t), 'l\'échec d\'écriture est signalé', t);
    const l = await ls(page, 'messages');
    verif(l.filter(m => m.fil === 'travail').length === 80 && l.some(m => m.id === 'S-neuf-0'), 'historique réduit à 80 par fil, le nouveau message est gardé', l.length);
    await ctx.close();
  } },
  { nom: 'Limite par fil : un fil très actif ne fait plus sortir les messages des fils calmes', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { messages: serie(5, 'patrimoine', 10).concat(serie(380, 'travail', 10)) } });
    S.ajouter({ id: 'S-x-0', horodatage: S.heure(), fil: 'travail', texte: 'encore' });
    await actualiser(page); await pause(500);
    const l = await ls(page, 'messages');
    verif(l.filter(m => m.fil === 'patrimoine').length === 5, 'les 5 messages du fil calme sont gardés', l.filter(m => m.fil === 'patrimoine').length);
    verif(l.filter(m => m.fil === 'travail').length === 300, 'le fil actif est limité à 300', l.filter(m => m.fil === 'travail').length);
    await ctx.close();
  } },
  // Audit expert fiabilité CC-6 / LC-6 : LIFE ne doit pas priver Ma carte de vie de place (stockage commun au site).
  { nom: 'Place prise par LIFE bornée (150 000 caractères par fil, 500 000 en tout) ; Réglages la montrent', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const gros = ['general', 'travail', 'patrimoine', 'voyage', 'coach'].flatMap(f => serie(120, f, 1200)).concat(serie(3, 'quotidien', 10000));
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { messages: gros } });
    S.ajouter({ id: 'S-neuf-0', horodatage: S.heure(), fil: 'coach', texte: 'nouveau' });
    await actualiser(page); await pause(500);
    const l = await ls(page, 'messages'), car = {}; let total = 0;
    l.forEach(m => { const t = m.texte.length + 120; car[m.fil] = (car[m.fil] || 0) + t; total += t; });
    verif(Object.values(car).every(c => c <= 150000), 'aucun fil au-delà de 150 000 caractères', car);
    verif(total <= 500000 + 5 * 6 * 12200, 'en tout : environ 500 000 caractères au plus (≈ 1 Mo)', total);
    verif(l.some(m => m.id === 'S-neuf-0') && l.filter(m => m.fil === 'quotidien').length === 3, 'le message neuf et les 5 derniers de chaque fil sont gardés', l.filter(m => m.fil === 'quotidien').length);
    const garde = await page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('life.')) n += k.length + localStorage.getItem(k).length; } return n; });
    verif(garde < 560000, 'LIFE occupe moins de 560 000 caractères du stockage commun', garde);
    await page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); document.getElementById('avance-life').open = true; }); await pause(200);
    verif(/LIFE garde \d+ Ko sur cet appareil \(plafond : environ 1 Mo/.test(await page.textContent('#stockage')), 'Réglages → « Cet appareil » : la place prise est affichée', await page.textContent('#stockage'));
    await ctx.close();
  } },
  { nom: 'Copie protégée : navigator.storage.persist() demandé une fois connectée, état montré dans les Réglages', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const espion = c => c.addInitScript(() => { window.__persist = 0; if (!navigator.storage) return;
      navigator.storage.persisted = async () => false; navigator.storage.persist = async () => { window.__persist++; return true; }; });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: espion });
    await pause(300);
    verif(await page.evaluate(() => window.__persist) === 1, 'persist() demandé une fois après la première actualisation réussie', await page.evaluate(() => window.__persist));
    await page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); document.getElementById('avance-life').open = true; }); await pause(200);
    verif(/effacement automatique : oui/.test(await page.textContent('#stockage')), 'état « protégée : oui » dans les Réglages', await page.textContent('#stockage'));
    await ctx.close();
  } },
  { nom: 'Échec d\'écriture : signalé au moment même, et rappelé dans les Réglages', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const plein = c => c.addInitScript(() => { const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'life.theme') { const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: plein });
    await page.click('#theme'); await pause(100);
    verif(/Stockage de l'appareil plein : un réglage n'a pas pu être enregistré/.test(await page.textContent('#bandeau')), 'bandeau immédiat', await page.textContent('#bandeau'));
    await page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); document.getElementById('avance-life').open = true; }); await pause(200);
    verif(/Dernier enregistrement raté à \d\d:\d\d/.test(await page.textContent('#stockage')), 'rappelé dans Réglages → « Cet appareil »', await page.textContent('#stockage'));
    await ctx.close();
  } },
  { nom: 'Manifeste : icône « maskable » dédiée (fond plein), icônes « any » à part', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S);
    const m = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
    verif(m.icons.filter(i => /maskable/.test(i.purpose || '')).map(i => i.src).join() === 'icon-maskable-512.png' && m.icons.filter(i => i.type === 'image/png' && i.purpose === 'any').length === 2, 'une icône maskable dédiée', m.icons);
    const coin = await page.evaluate(async () => { const b = await createImageBitmap(await (await fetch('icon-maskable-512.png')).blob()); const c = new OffscreenCanvas(512, 512).getContext('2d'); c.drawImage(b, 0, 0); return [...c.getImageData(2, 2, 1, 1).data]; });
    verif(coin[3] === 255, 'icône maskable : coins pleins (pas de transparence)', coin);
    await ctx.close();
  } },
  { nom: 'Service worker : réseau qui traîne → la copie gardée en 3 s ; une page absente (404) n\'est pas mise en cache', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { sw: true, attente: 1500 });
    await A.page.reload(); await pause(1500);
    verif(await A.page.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker contrôle la page');
    const entrees = await A.page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map(r => new URL(r.url).pathname); });
    verif(['/app.js', '/app.css', '/index.html'].every(x => entrees.includes(x)), 'app.js et app.css font partie de la copie gardée', entrees);
    st.retard = 15000;
    const t0 = Date.now();
    await A.page.reload({ waitUntil: 'load', timeout: 30000 });
    const duree = Date.now() - t0;
    st.retard = 0;
    verif(duree < 6000, 'page affichée depuis la copie en moins de 6 s (réseau à 15 s)', duree);
    verif(/V\.0\.0\.\d+/.test(await A.page.textContent('#ver-haut')), 'le script de l\'app tourne (copie complète)');
    await A.page.evaluate(() => fetch('nexiste-pas.html').then(r => r.status)); await pause(500);
    const en404 = await A.page.evaluate(async () => { for (const k of await caches.keys()) { if (await (await caches.open(k)).match('nexiste-pas.html')) return true; } return false; });
    verif(!en404, 'la réponse 404 n\'est pas gardée en cache');
    await A.ctx.setOffline(true);
    await A.page.reload({ waitUntil: 'load' }).catch(() => {});
    verif((await A.page.title()) === 'LIFE', 'hors ligne : l\'app s\'ouvre');
    await A.ctx.close();
  } }
];
