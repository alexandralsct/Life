// Audit expert de sécurité du 13/10 (LIFE) : clé propre à LIFE avec bascule sans coupure (LC1), code de transfert à
// usage unique (LT2, LO1), seconde CSP sur le serveur exact (LC2), Trusted Types, refus des cadres d'autres pages (LO2),
// copies piégées du service worker ignorées (LC3), fin du repli sur la clé de la carte (CC3).
import { fauxServeur, ouvrir, ecrire, ls, actualiser, pause, attendre } from './outils.mjs';

const HOTE = 'essai.exemple.cloud';
export const tests = [
  { nom: 'Clé propre à LIFE : bascule sans coupure (avant et après le passage du serveur), jamais de retour à la clé du lien', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ cles: ['cle-de-test-123456'] });   // serveur pas encore passé : il n'accepte que la clé du lien
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { cleLife: 'cle-propre-life-123456' } });
    S.ajouter({ id: 'S-1-0', horodatage: S.heure(), fil: 'general', texte: 'avant la bascule' });
    await actualiser(page); await pause(300);
    verif((await ls(page, 'messages')).some(m => m.id === 'S-1-0'), 'avant le passage du serveur : ça marche (la clé du lien prend le relais)');
    S.cles = ['cle-propre-life-123456'];   // la propriétaire publie le serveur avec sa propre clé
    S.ajouter({ id: 'S-2-0', horodatage: S.heure(), fil: 'general', texte: 'après la bascule' });
    await actualiser(page); await pause(300);
    verif((await ls(page, 'messages')).some(m => m.id === 'S-2-0') && (await ls(page, 'cleLifeServeur')) === true, 'après : ça marche, la clé propre est retenue comme acceptée');
    S.cles = ['cle-de-test-123456']; const n0 = S.appels.length;
    await actualiser(page); await pause(300);
    const apres = S.appels.slice(n0).filter(a => /\/life$/.test(new URL(a.url).pathname));
    verif(apres.length && apres.every(a => a.cle === 'cle-propre-life-123456'), 'une fois acceptée, la clé du lien n\'est plus jamais envoyée au serveur de LIFE', apres.map(a => a.cle));
    verif(/plus connecté/.test(await page.textContent('#bandeau')), 'un refus est dit');
    await ctx.close();
  } },
  { nom: 'Plus de repli sur la clé de Ma carte de vie : recopiée une fois si l\'appareil était relié, jamais lue ensuite', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const pose = c => c.addInitScript(() => { if (!sessionStorage.getItem('__carte')) { sessionStorage.setItem('__carte', '1'); localStorage.removeItem('life.cle'); localStorage.setItem('carte-de-vie-lien', 'cle-de-la-carte-123'); } });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: pose });
    verif((await ls(page, 'cle')) === 'cle-de-la-carte-123', 'appareil déjà relié : la clé est recopiée une fois dans LIFE');
    await page.evaluate(() => localStorage.setItem('carte-de-vie-lien', 'autre-cle-de-la-carte'));
    await actualiser(page); await pause(300);
    verif(S.appels.slice(-1)[0].cle === 'cle-de-la-carte-123', 'la clé de la carte n\'est plus relue ensuite', S.appels.slice(-1)[0].cle);
    await ctx.close();
  } },
  { nom: 'Connecter un autre appareil : code à usage unique (la clé n\'est pas dans le lien), refusé à la seconde utilisation', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { init: { cleLife: 'cle-propre-life-123456' } });
    await A.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: st.base.slice(0, -1) });
    verif((await ls(A.page, 'transfert')) === true, 'le serveur annonce le transfert (version 3)');
    await A.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
    const lien = await A.page.evaluate(async () => (await lienConnexion()).lien);
    verif(/#transfert=/.test(lien), 'lien de transfert fabriqué', lien.slice(0, 60));
    const contenu = Buffer.from(lien.split('#transfert=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    verif(!contenu.includes('cle-de-test') && !contenu.includes('cle-propre') && Object.keys(S.memoire.transferts || {}).length === 1, 'aucune clé dans le lien ; le serveur ne garde qu\'un paquet chiffré', contenu);
    verif(!JSON.stringify(S.memoire).includes('cle-'), 'le paquet gardé par le serveur est illisible sans le code', JSON.stringify(S.memoire).slice(0, 120));
    const chemin = lien.slice(st.base.length);
    const B = await ouvrir(nav, st, profil, S, { sansConnexion: true, chemin });
    // appareil neuf : l'app enregistre l'adresse et se relance (seconde règle CSP sur ce serveur), puis retire le code (V.0.0.3.9)
    await Promise.all([B.page.waitForNavigation({ waitUntil: 'load' }), B.page.evaluate(() => document.getElementById('cx-ok').click())]);
    await attendre(async () => (await ls(B.page, 'cle')) !== null, 3000);
    verif((await ls(B.page, 'cle')) === 'cle-de-test-123456' && (await ls(B.page, 'cleLife')) === 'cle-propre-life-123456', 'le nouvel appareil a ses clés (retirées du serveur, déchiffrées)');
    const C = await ouvrir(nav, st, profil, S, { sansConnexion: true, chemin });
    await Promise.all([C.page.waitForNavigation({ waitUntil: 'load' }), C.page.evaluate(() => document.getElementById('cx-ok').click())]);
    await attendre(async () => /déjà utilisé|expiré/.test(await C.page.textContent('#bandeau')), 3000);
    verif((await ls(C.page, 'cle')) === null && (await ls(C.page, 'adresse')) === null && /déjà utilisé|expiré/.test(await C.page.textContent('#bandeau')), 'le même lien une seconde fois : refusé, rien d\'enregistré (ni clé ni adresse)', await C.page.textContent('#bandeau'));
    await A.ctx.close(); await B.ctx.close(); await C.ctx.close();
    const S2 = fauxServeur({ version: 2 });   // serveur version 2 : l'ancien lien, et la page le dit
    const D = await ouvrir(nav, st, profil, S2);
    await D.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: st.base.slice(0, -1) });
    await D.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
    const refus = await D.page.evaluate(async () => { try { await lienConnexion(); return ''; } catch (e) { return e.message; } });
    verif(/mettre à jour|mis à jour/.test(refus), 'serveur version 2 : plus d\'ancien lien avec la clé — refus, le serveur est à mettre à jour', refus);
    await D.ctx.close();
  } },
  { nom: 'CSP : seconde règle sur le serveur exact, Trusted Types, aucune violation au chargement', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx, csp, erreurs } = await ouvrir(nav, st, profil, S);
    verif(!csp.length && !erreurs.length, 'aucune violation ni erreur au chargement', { csp, erreurs });
    const r = await page.evaluate(async () => {
      const essai = u => fetch(u, { method: 'POST', body: '{}' }).then(() => 'permis', e => 'bloqué');
      let tt = 'permis'; try { document.body.insertAdjacentHTML('beforeend', '<b>x</b>'); } catch (e) { tt = 'bloqué'; }
      return { autre: await essai('https://autre.exemple.cloud/webhook/life'), sien: await essai('https://essai.exemple.cloud/webhook/life'), tt };
    });
    verif(r.autre === 'bloqué' && r.sien === 'permis', 'un autre serveur, même en .cloud, est bloqué ; le serveur enregistré passe', r);
    verif(r.tt === 'bloqué', 'Trusted Types : du HTML brut ne peut pas entrer dans la page', r.tt);
    verif(await page.evaluate(() => document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length === 2), 'deux règles CSP (celle de la page, celle du serveur exact)');
    await ctx.close();
    // appareil neuf (rien d'enregistré) : la seconde règle n'autorise AUCUN serveur extérieur, même en .cloud (audit R6, 13/10)
    const N = await ouvrir(nav, st, profil, fauxServeur(), { sansConnexion: true });
    const rn = await N.page.evaluate(async () => ({ regle: [...document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map(m => m.content).pop(),
      essai: await fetch('https://essai.exemple.cloud/webhook/life', { method: 'POST', body: '{}' }).then(() => 'permis', () => 'bloqué') }));
    verif(rn.regle === "connect-src 'self'" && rn.essai === 'bloqué', 'appareil neuf : connect-src \'self\' seulement, un serveur .cloud est bloqué', rn);
    await N.ctx.close();
  } },
  { nom: 'Cadre : LIFE refuse de s\'afficher dans la page d\'un autre site (ou d\'une autre page que Ma carte de vie)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: (c) => c.route(st.base + 'piege.html', r => r.fulfill({ contentType: 'text/html', body: '<iframe src="/index.html" width="400" height="400"></iframe>' })), chemin: 'piege.html' });
    await pause(800);
    const f = page.frames().find(x => x !== page.mainFrame());
    const t = await f.evaluate(() => ({ texte: document.body.textContent.trim(), fils: document.querySelectorAll('#fils button').length }));
    verif(/ne s'ouvre pas dans le cadre/.test(t.texte) && t.fils === 0, 'dans un cadre : rien de LIFE n\'est montré', t);
    await ctx.close();
  } },
  { nom: 'Service worker : une copie piégée (même dans le cache de LIFE) n\'est jamais servie ; empreintes de sw.js justes', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { sw: true, attente: 1500 });
    await A.page.reload(); await pause(1500);
    verif(await A.page.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker contrôle la page');
    await A.page.evaluate(async () => {
      const piege = new Response('window.__piege = true; document.title = "piégé";', { headers: { 'content-type': 'text/javascript' } });
      const k = (await caches.keys()).find(n => n.startsWith('life-'));
      await (await caches.open('autre-app')).put(new URL('app.js', location.href).href, piege.clone());
      await (await caches.open(k)).put(new URL('app.js', location.href).href, piege);
    });
    await A.ctx.setOffline(true);
    await A.page.reload({ waitUntil: 'load' }).catch(() => {}); await pause(800);
    verif(await A.page.evaluate(() => !window.__piege && document.title === 'LIFE'), 'hors ligne : le script piégé n\'a pas tourné');
    await A.ctx.setOffline(false);
    await A.page.reload({ waitUntil: 'load' }); await pause(1200);
    verif(await A.page.evaluate(() => !window.__piege && /V\.0\.0\.\d+/.test(document.getElementById('ver-haut').textContent)), 'en ligne : la vraie app revient');
    await A.ctx.close();
    const { execFileSync } = await import('node:child_process');
    let ok = true; try { execFileSync(process.execPath, [new URL('./empreintes.mjs', import.meta.url).pathname, '--verifier'], { stdio: 'pipe' }); } catch (e) { ok = false; }
    verif(ok, 'sw.js : les empreintes de la coquille correspondent aux fichiers');
  } }
];
