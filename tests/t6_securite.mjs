// Vérification très poussée du 13/10 : clé refusée après un lien (pas d'invitation à coller la clé), collage de clé
// sans effet tant qu'on n'enregistre pas, clé propre à LIFE, « Effacer cet appareil », caches des autres apps intacts.
import { fauxServeur, ouvrir, ecrire, choisirFil, ls, pause } from './outils.mjs';
import { lien } from './t3_page.mjs';

const pressePapiers = (c, p) => c.addInitScript(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => 'cle-collee-1234567890', writeText: async () => {} } });
});

export const tests = [
  { nom: 'Clé refusée par un serveur reçu par lien : le message n\'invite pas à coller la clé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); S.statut = 401;
    const A = await ouvrir(nav, st, profil, S, { sansConnexion: true, chemin: lien('https://nouveau.exemple.cloud/webhook/life', 'cle-piege-123456') });
    await A.page.fill('#cx-saisie', 'nouveau.exemple.cloud'); await A.page.evaluate(() => document.getElementById('cx-ok').click());
    await pause(500);
    await ecrire(A.page, 'bonjour'); await pause(500);
    const t = await A.page.textContent('#bandeau');
    verif(/ne lui donne pas ta clé/.test(t) && /nouveau\.exemple\.cloud/.test(t) && !/vérifie la clé|colle/i.test(t), 'avertissement : ne pas donner sa clé à ce serveur', t);
    await A.ctx.close();
    // adresse saisie à la main dans les Réglages : message ordinaire
    const B = await ouvrir(nav, st, profil, S);
    await ecrire(B.page, 'bonjour'); await pause(500);
    const u = await B.page.textContent('#bandeau');
    verif(/clé refusée : c'est la clé des apps.*cocon_copier_cle_app\.sh/.test(u), 'adresse saisie par elle : message ordinaire', u);
    await B.ctx.close();
  } },
  { nom: 'Coller une clé ne valide ni ne garde rien (ni clé, ni adresse étrangère) sans « Enregistrer »', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { avantChargement: pressePapiers });
    const n0 = S.appels.length;
    await A.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
    await A.page.fill('#adresse', 'https://pirate.exemple.cloud/webhook/life');
    await A.page.evaluate(() => document.getElementById('coller-cle').click()); await pause(300);
    verif((await A.page.inputValue('#cle')) === 'cle-collee-1234567890', 'la clé collée est dans le champ');
    verif((await ls(A.page, 'cle')) === 'cle-de-test-123456' && (await ls(A.page, 'adresse')) === 'https://essai.exemple.cloud/webhook/life', 'rien d\'enregistré : ni la clé, ni l\'adresse tapée');
    verif(S.appels.length === n0, 'aucun appel au serveur (rien n\'est « validé »)');
    await A.page.evaluate(() => document.getElementById('annuler').click()); await A.page.reload(); await pause(700);
    verif((await ls(A.page, 'adresse')) === 'https://essai.exemple.cloud/webhook/life', 'après Annuler et rechargement : adresse d\'origine');
    await A.ctx.close();
  } },
  { nom: 'Clé propre à LIFE (facultative) : envoyée au serveur de LIFE ; les experts gardent la clé du lien', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { init: { cleLife: 'cle-propre-life-123456' } });
    await choisirFil(A.page, 'Experts'); await ecrire(A.page, 'question'); await pause(500);
    const life = S.appels.filter(a => !a.url.includes('app-lien')), exp = S.appels.filter(a => a.url.includes('app-lien'));
    verif(life.length && life.every(a => a.cle === 'cle-propre-life-123456'), 'LIFE reçoit sa clé propre', life.map(a => a.cle));
    verif(exp.length === 1 && exp[0].cle === 'cle-de-test-123456', 'les experts reçoivent la clé du lien', exp.map(a => a.cle));
    await A.ctx.close();
    const B = await ouvrir(nav, st, profil, S);   // sans clé propre : comportement d'avant
    verif(S.appels.slice(-1)[0].cle === 'cle-de-test-123456', 'sans clé propre : la clé du lien');
    await B.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
    await B.page.fill('#cle-life', 'cle-saisie-life-123456'); await B.page.evaluate(() => document.getElementById('garder').click()); await pause(400);
    verif((await ls(B.page, 'cleLife')) === 'cle-saisie-life-123456' && S.appels.slice(-1)[0].cle === 'cle-saisie-life-123456', 'réglage séparé enregistré et utilisé');
    await B.ctx.close();
  } },
  { nom: 'Effacer cet appareil : seulement LIFE (clés life. et caches life-), après avoir retapé EFFACER', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { init: { messages: [{ id: 'S-1', t: '2026-10-13 10:00:00', auteur: 'systeme', fil: 'general', texte: 'x' }] } });
    await A.page.evaluate(async () => { localStorage.setItem('carte-de-vie-lien', 'cle-de-la-carte'); localStorage.setItem('autre.reglage', '1');
      await caches.open('autre-app'); await caches.open('life-essai'); });
    await A.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); document.getElementById('effacer-appareil').click(); });
    verif(await A.page.evaluate(() => document.getElementById('dlg-effacer').open && document.getElementById('ef-ok').disabled), 'confirmation forte : bouton inactif au départ');
    await A.page.fill('#ef-saisie', 'effac');
    verif(await A.page.evaluate(() => document.getElementById('ef-ok').disabled), 'un mot incomplet ne suffit pas');
    verif((await ls(A.page, 'adresse')) !== null, 'rien d\'effacé avant la confirmation');
    await A.page.fill('#ef-saisie', 'effacer');
    await Promise.all([A.page.waitForNavigation(), A.page.evaluate(() => document.getElementById('ef-ok').click())]); await pause(600);
    const r = await A.page.evaluate(async () => ({ life: Object.keys(localStorage).filter(k => k.startsWith('life.') && !['life.aideAppui'].includes(k)),
      carte: localStorage.getItem('carte-de-vie-lien'), autre: localStorage.getItem('autre.reglage'), caches: await caches.keys(), reglages: document.getElementById('dlg').open }));
    verif(!r.life.some(k => ['life.adresse', 'life.cle', 'life.messages'].includes(k)), 'adresse, clé et messages de LIFE effacés', r.life);
    verif(r.carte === 'cle-de-la-carte' && r.autre === '1', 'le stockage de la carte et des autres apps est intact', r);
    verif(r.caches.includes('autre-app') && !r.caches.includes('life-essai'), 'seuls les caches life- sont supprimés', r.caches);
    verif(r.reglages, 'l\'app redémarre comme neuve (Réglages ouverts)');
    await A.ctx.close();
  } },
  { nom: 'Service worker : une mise à jour ne supprime que ses propres caches (life-)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const A = await ouvrir(nav, st, profil, S, { sw: true, attente: 1500 });
    const r = await A.page.evaluate(async () => {
      await caches.open('carte-copie'); await caches.open('coulisses-copie'); await caches.open('life-V.0.0.1');
      // une seconde inscription (autre portée) installe et active un nouveau service worker : son nettoyage s'exécute
      const n = await navigator.serviceWorker.register(POLITIQUE.createScriptURL('sw.js'), { scope: './essai-nettoyage/', updateViaCache: 'none' });
      await new Promise(ok => { const w = n.installing || n.waiting || n.active; if (!w || w.state === 'activated') return ok(); w.addEventListener('statechange', () => { if (w.state === 'activated') ok(); }); });
      await new Promise(ok => setTimeout(ok, 500));
      return caches.keys();
    });
    verif(r.includes('carte-copie') && r.includes('coulisses-copie'), 'les caches des autres apps du site sont gardés', r);
    verif(!r.includes('life-V.0.0.1') && r.some(k => /^life-V(\.\d)+$/.test(k)), 'l\'ancienne copie de LIFE est supprimée, la nouvelle est là', r);
    await A.ctx.close();
  } }
];
