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
