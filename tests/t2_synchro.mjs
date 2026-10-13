// Points 3, 4 et 7 de l'audit du 13/10 : curseur serveur et pagination, suppressions propagées, contrat (version, fils,
// filsForces seulement pour l'ancien serveur), quota (pas d'appel « fil » après un envoi ; relève sur ordinateur).
import { fauxServeur, ouvrir, ecrire, choisirFil, ls, bulles, actualiser, attendre, pause, TEL } from './outils.mjs';

const ids = async page => (await ls(page, 'messages')).map(m => m.id);

export const tests = [
  { nom: 'Pagination : 450 messages arrivés pendant une absence, tous reçus en une actualisation', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S);
    for (let i = 0; i < 450; i++) S.ajouter({ id: 'S-' + i + '-0', horodatage: S.heure(1000), fil: i % 2 ? 'travail' : 'patrimoine', texte: 'n° ' + i });
    const avant = S.appels.length;
    await actualiser(page); await attendre(async () => (await ids(page)).filter(i => i.startsWith('S-')).length === 450, 5000);
    const recus = (await ids(page)).filter(i => i.startsWith('S-'));
    verif(recus.length === 450, '450 / 450 reçus', recus.length);
    const appels = S.appels.slice(avant).map(a => a.corps);
    verif(appels.length === 3 && appels.every(c => c.action === 'fil') && appels[1].curseur > appels[0].curseur, '3 pages, curseur croissant donné par le serveur', appels.map(c => c.curseur));
    await ctx.close();
  } },
  { nom: 'Curseur : un message écrit dans la même seconde, et un appareil à l\'heure de Tokyo, ne sautent plus rien', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ reponseExperts: () => ({ ok: true, type: 'expert', reponses: [{ id: 'x', nom: 'Expert', texte: 'avis' }] }) });
    const { page, ctx } = await ouvrir(nav, st, { ...profil, timezoneId: 'Asia/Tokyo' }, S);
    const h = S.heure();
    S.ajouter({ id: 'S-a-0', horodatage: h, fil: 'general', texte: 'premier' });
    await actualiser(page); await pause(300);
    S.ajouter({ id: 'S-b-0', horodatage: h, fil: 'general', texte: 'même seconde' });
    await choisirFil(page, 'Experts'); await ecrire(page, 'question'); await pause(500);   // copies locales à l'heure de Tokyo
    S.ajouter({ id: 'S-c-0', horodatage: S.heure(), fil: 'travail', texte: 'brief de l\'après-midi' });
    await actualiser(page); await pause(400);
    const l = await ids(page);
    verif(['S-a-0', 'S-b-0', 'S-c-0'].every(i => l.includes(i)), 'les trois messages du serveur reçus', l);
    verif(S.appels.filter(a => a.corps.action === 'fil').slice(1).every(a => Number.isInteger(a.corps.curseur)), 'le curseur du serveur est renvoyé (jamais une heure de l\'appareil)');
    await ctx.close();
  } },
  { nom: 'Ancien serveur (repli) : « depuis » tiré des seuls messages du serveur, moins une seconde', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ ancien: true });
    const { page, ctx } = await ouvrir(nav, st, { ...profil, timezoneId: 'Asia/Tokyo' }, S, {
      init: { messages: [{ id: 'loc-zz', t: '2099-01-01 23:00:00', auteur: 'moi', fil: 'experts', texte: 'copie locale', local: true, expert: true }] } });
    const h = S.heure();
    S.ajouter({ id: 'S-a-0', horodatage: h, fil: 'general', texte: 'premier' });
    await actualiser(page); await pause(300);
    S.ajouter({ id: 'S-b-0', horodatage: h, fil: 'general', texte: 'même seconde' });
    await actualiser(page); await pause(300);
    const l = await ids(page);
    verif(l.includes('S-a-0') && l.includes('S-b-0'), 'même seconde reçue avec l\'ancien serveur', l);
    const dernier = S.appels.filter(a => a.corps.action === 'fil').pop().corps;
    verif(dernier.depuis < h && dernier.depuis >= '2000' && dernier.curseur === undefined, '« depuis » = dernier message du serveur moins 1 s (pas la copie locale de 2099), pas de curseur', dernier);
    verif(!(await ls(page, 'versionServeur')), 'ancien serveur reconnu (pas de version)');
    await ctx.close();
  } },
  { nom: 'Suppression propagée à un autre appareil ; ok:false du serveur : la suppression est gardée et réessayée', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.ajouter({ id: 'S-1-0', horodatage: S.heure(), fil: 'general', texte: 'à supprimer' });
    S.ajouter({ id: 'S-2-0', horodatage: S.heure(), fil: 'general', texte: 'à garder' });
    const A = await ouvrir(nav, st, profil, S), B = await ouvrir(nav, st, TEL, S);
    verif((await ids(B.page)).includes('S-1-0'), 'l\'autre appareil a le message');
    S.echecRetrait = true;
    await A.page.evaluate(() => { const b = [...document.querySelectorAll('#messages .bulle')].find(x => x.textContent.includes('à supprimer')); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); });
    await A.page.evaluate(() => [...document.querySelectorAll('.feuille-msg button')].find(x => x.textContent === 'Supprimer').click());
    await A.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await pause(500);
    verif((await ls(A.page, 'aRetirer')).includes('S-1-0'), 'écriture ratée côté serveur (ok:false) : la suppression reste à envoyer');
    S.echecRetrait = false;
    await A.page.reload(); await pause(900);
    verif((await ls(A.page, 'aRetirer')).length === 0, 'au lancement suivant, la suppression part et est confirmée');
    await actualiser(B.page); await pause(500);
    const lb = await ids(B.page);
    verif(!lb.includes('S-1-0') && lb.includes('S-2-0'), 'l\'autre appareil ne montre plus le message supprimé', lb);
    await A.ctx.close(); await B.ctx.close();
  } },
  { nom: 'Contrat : serveur à jour → fil inconnu refusé, version notée, filsForces jamais utilisé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.repondre = (c, S) => c.action === 'envoyer' && c.fil === 'coach' ? S.F.contratLife({ ok: false, erreur: 'fil inconnu' }) : null;
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { filsForces: { 'L-1-a': 'coach' } } });
    verif((await ls(page, 'versionServeur')) === 2, 'version 2 notée');
    verif((await ls(page, 'filsForces')) === null, 'table filsForces purgée dès que le serveur est à jour');
    await choisirFil(page, 'Coach'); await ecrire(page, 'fil pas publié'); await pause(500);
    const t = await page.textContent('#bandeau');
    verif(/ne connaît pas ce fil/.test(t), 'le refus est dit clairement', t);
    verif((await bulles(page)).some(b => /echec/.test(b.classe) && b.texte === 'fil pas publié'), 'bulle gardée en « Non envoyé »');
    verif((await ls(page, 'filsForces')) === null, 'aucune réponse « forcée » enregistrée');
    await choisirFil(page, 'Général');
    verif(!(await bulles(page)).some(b => /fil pas publié/.test(b.texte)), 'rien de rangé dans Général');
    await ctx.close();
  } },
  { nom: 'Contrat : ancien serveur → repli filsForces (borné), puis purge quand le serveur est mis à jour', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ ancien: true, filsAnciens: ['general', 'travail'] });
    const vieux = {}; for (let i = 0; i < 900; i++) vieux['L-' + i + '-a'] = 'coach';
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { filsForces: vieux } });
    await choisirFil(page, 'Brainstorming'); await ecrire(page, 'idée'); await pause(600);
    verif((await bulles(page)).filter(b => /idée/.test(b.texte)).length === 2, 'l\'échange reste dans Brainstorming');
    verif(/ne connaît pas encore le fil Brainstorming/.test(await page.textContent('#bandeau')), 'avertissement affiché');
    const ff = await ls(page, 'filsForces');
    verif(Object.keys(ff).length === 2 && Object.values(ff).every(f => f === 'brainstorm'), 'table bornée aux messages présents (2 au lieu de 902)', Object.keys(ff).length);
    S.ancien = false;   // le serveur est publié
    await actualiser(page); await pause(400);
    verif((await ls(page, 'filsForces')) === null && (await ls(page, 'versionServeur')) === 2, 'serveur à jour : table purgée');
    await ctx.close();
  } },
  { nom: 'Quota : un envoi apporte aussi les nouveaux messages, sans appel « fil » en plus', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S);
    S.ajouter({ id: 'S-9-0', horodatage: S.heure(), fil: 'travail', texte: 'offre arrivée entre-temps' });
    const n0 = S.appels.length;
    await ecrire(page, 'bonjour'); await pause(600);
    const appels = S.appels.slice(n0).map(a => a.corps.action);
    verif(appels.join() === 'envoyer', 'un seul appel (envoyer)', appels);
    verif((await ids(page)).includes('S-9-0'), 'le message arrivé entre-temps est reçu avec la réponse');
    await ctx.close();
  } },
  { nom: 'Quota : actualisation au retour sur la fenêtre et toutes les 15 min si visible (ordinateur seulement)', f: async ({ nav, st, profil, tel, verif }) => {
    const S = fauxServeur();
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: (c, p) => p.clock.install() });
    const fil = () => S.appels.filter(a => a.corps.action === 'fil').length;
    const n0 = fil();
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await pause(200);
    verif(fil() === n0, 'retour immédiat : pas d\'appel (moins de 2 min)');
    await page.clock.fastForward(3 * 60e3); await pause(300);
    const n1 = fil();
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await pause(400);
    if (tel) verif(fil() === n1, 'app téléphone : le focus ne déclenche rien (seulement le retour dans l\'app après 5 min)', fil() - n1);
    else verif(fil() === n1 + 1, 'app ordinateur : retour sur la fenêtre après 3 min → une actualisation', fil() - n1);
    const n2 = fil();
    await page.mouse.move(10, 10); await page.mouse.down(); await page.mouse.up();
    for (let i = 0; i < 16; i++) { await page.clock.fastForward(60e3); await pause(30); }
    await pause(300);
    if (tel) verif(fil() === n2, 'app téléphone : aucune relève en arrière-plan', fil() - n2);
    else verif(fil() - n2 === 1, 'app ordinateur : une relève en 16 min, fenêtre visible', fil() - n2);
    await ctx.close();
  } }
];
