// Points 1 et 2 de l'audit du 13/10 : plus aucune perte de message, délai d'attente, idempotence (cid), texte long.
import { fauxServeur, ouvrir, ecrire, ls, bulles, attendre, pause } from './outils.mjs';

const moi = async page => (await bulles(page)).filter(b => / moi/.test(b.classe));

export const tests = [
  { nom: 'Envois concurrents : un envoi qui échoue après un autre réussi reste à l\'écran et sur l\'appareil (Réessayer)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); S.retard = c => c.texte === 'PREMIER' ? 2500 : 0; S.coupe = c => c.texte === 'PREMIER';
    const { page, ctx, erreurs } = await ouvrir(nav, st, profil, S);
    await ecrire(page, 'PREMIER'); await pause(200); await ecrire(page, 'SECOND'); await pause(700);
    const pendant = await moi(page);
    verif(pendant.some(b => b.texte === 'PREMIER' && /attente/.test(b.classe)), 'PREMIER encore en « envoi… » pendant que SECOND arrive', pendant);
    verif(pendant.some(b => b.texte === 'SECOND' && !/attente|echec/.test(b.classe)), 'SECOND envoyé', pendant);
    verif(await page.$('.ecrit'), 'les trois points restent tant qu\'un envoi attend (compteur)');
    verif(await attendre(async () => (await page.$$('.reessayer')).length === 1, 6000), 'PREMIER passe en « Non envoyé · Réessayer »');
    const apres = await moi(page);
    verif(apres.some(b => b.texte === 'PREMIER' && /echec/.test(b.classe)), 'PREMIER toujours à l\'écran', apres);
    verif(!(await page.$('.ecrit')), 'plus de trois points une fois les deux envois terminés');
    const garde = (await ls(page, 'messages')).find(m => m.texte === 'PREMIER');
    verif(garde && garde.echec && garde.cid, 'PREMIER gardé sur l\'appareil, avec son cid', garde);
    S.coupe = false; S.retard = 0;
    await page.evaluate(() => document.querySelector('.reessayer').click()); await pause(600);
    const fin = await moi(page);
    verif(fin.filter(b => b.texte === 'PREMIER').length === 1 && !fin.some(b => /echec|attente/.test(b.classe)), 'Réessayer : PREMIER envoyé, une seule bulle', fin);
    const envois = S.appels.filter(a => a.corps.action === 'envoyer' && a.corps.texte === 'PREMIER');
    verif(envois.length === 2 && envois[0].corps.cid === envois[1].corps.cid, 'Réessayer renvoie le même cid', envois.map(a => a.corps.cid));
    verif(!erreurs.length, 'aucune erreur JavaScript', erreurs);
    await ctx.close();
  } },
  { nom: 'App fermée pendant un envoi : au retour, la bulle est là en « Non envoyé »', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); S.retard = c => c.action === 'envoyer' ? 8000 : 0;
    const { page, ctx } = await ouvrir(nav, st, profil, S);
    await ecrire(page, 'interrompu'); await pause(300);
    await page.reload(); await pause(800);
    const b = await moi(page);
    verif(b.some(x => x.texte === 'interrompu' && /echec/.test(x.classe)), 'bulle « interrompu » retrouvée, marquée Non envoyé', b);
    await ctx.close();
  } },
  // Audit expert de fiabilité (LC-1, scénario course.mjs) : ordre RÉEL du workflow (lecture → cid → demande écrite →
  // IA lente → réponse écrite). « Réessayer » pendant que l'IA travaille ne doit jamais faire traiter le message deux fois.
  { nom: 'Course (serveur version 3, ordre réel) : délai de 60 s dépassé puis Réessayer pendant que l\'IA travaille → un seul traitement', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ retardIA: c => c.action === 'envoyer' ? 5000 : 0 });
    const { page, ctx, erreurs } = await ouvrir(nav, st, profil, S, { avantChargement: (c, p) => p.clock.install() });
    await ecrire(page, 'question lente'); await pause(400);
    await page.clock.fastForward(59000); await pause(200);
    verif(!(await page.$('.reessayer')), 'pas encore abandonné à 59 s (délai porté de 20 à 60 s)');
    await page.clock.fastForward(2000); await pause(400);
    verif(await page.$('.reessayer'), 'abandon à 60 s : « Non envoyé · Réessayer »');
    await page.evaluate(() => document.querySelector('.reessayer').click()); await pause(800);   // l'IA travaille encore
    verif(S.appels.filter(a => a.corps.action === 'envoyer').length === 1, 'Réessayer n\'a pas renvoyé le message (le serveur l\'avait déjà)', S.appels.map(a => a.corps.action));
    verif(/bien arrivé/.test(await page.textContent('#bandeau')), 'le bandeau dit que le message était arrivé');
    verif(await page.$('.ecrit'), 'LIFE « écrit » en attendant la réponse');
    await pause(5000);   // l'IA finit
    await page.clock.fastForward(21000); await pause(800);   // relève automatique
    const b = await bulles(page);
    verif(S.traitements === 1, 'un seul traitement par le serveur', S.traitements);
    const ids = S.feuille.map(l => l.id);
    verif(ids.length === 2 && new Set(ids).size === 2 && ids[0].endsWith('-a') && ids[1].endsWith('-b'), 'deux lignes dans le classeur, identifiants distincts (demande puis réponse)', ids);
    verif(b.filter(x => x.texte === 'question lente').length === 1 && b.filter(x => /^Réponse/.test(x.texte)).length === 1, 'une bulle et une réponse', b);
    verif(!(await page.$('.ecrit')), 'plus de « LIFE écrit » une fois la réponse arrivée');
    verif(!erreurs.length, 'aucune erreur JavaScript', erreurs);
    await ctx.close();
  } },
  { nom: 'Course (serveur version 3) : app fermée pendant l\'envoi, Réessayer pendant l\'IA → « en cours », jamais un second traitement', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ retardIA: c => c.action === 'envoyer' ? 6000 : 0 });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: (c, p) => p.clock.install() });
    await ecrire(page, 'interrompu'); await pause(500);
    S.coupe = c => c.action === 'fil';   // au retour, la relève ne passe pas (réseau instable)
    await page.reload(); await pause(900);
    verif(await page.$('.reessayer'), 'au retour : « Non envoyé · Réessayer »');
    S.coupe = false;
    await page.evaluate(() => document.querySelector('.reessayer').click()); await pause(900);
    const envois = S.appels.filter(a => a.corps.action === 'envoyer');
    verif(envois.length === 2 && envois[0].corps.cid === envois[1].corps.cid, 'renvoyé avec le même cid', envois.map(a => a.corps.cid));
    verif(!(await page.$('.reessayer')) && /traite déjà/.test(await page.textContent('#bandeau')), 'le serveur répond « en cours » : bulle envoyée, rien à renvoyer');
    await pause(6000); await page.clock.fastForward(21000); await pause(800);
    verif(S.traitements === 1 && S.feuille.length === 2, 'un seul traitement, deux lignes', { t: S.traitements, l: S.feuille.map(l => l.id) });
    const b = await bulles(page);
    verif(b.filter(x => x.texte === 'interrompu').length === 1 && b.some(x => /^Réponse \(general\) : interrompu/.test(x.texte)), 'une bulle et la réponse', b);
    await ctx.close();
  } },
  { nom: 'Course (serveur version 2, encore publié) : Réessayer pendant l\'IA ne renvoie pas → un seul traitement', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ version: 2, retardIA: c => c.action === 'envoyer' ? 5000 : 0 });
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: (c, p) => p.clock.install() });
    await ecrire(page, 'question lente'); await pause(400);
    await page.clock.fastForward(61000); await pause(400);
    await page.evaluate(() => document.querySelector('.reessayer').click()); await pause(800);
    verif(S.appels.filter(a => a.corps.action === 'envoyer').length === 1, 'pas de second envoi pendant le délai de garde', S.appels.map(a => a.corps.action));
    verif(/réessaie dans \d+ s/.test(await page.textContent('#bandeau')), 'le bandeau dit d\'attendre', await page.textContent('#bandeau'));
    await pause(5000); await page.clock.fastForward(21000); await pause(800);
    verif(S.traitements === 1 && S.feuille.filter(l => l.auteur === 'moi').length === 1, 'un seul traitement', S.traitements);
    const b = await bulles(page);
    verif(b.filter(x => x.texte === 'question lente').length === 1 && !(await page.$('.reessayer')), 'la bulle est confirmée par la relève', b);
    await ctx.close();
  } },
  { nom: 'Texte de plus de 2 000 caractères : un seul enregistrement, coupé et signalé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S);
    await ecrire(page, 'y'.repeat(2500)); await pause(600);
    const b = await moi(page);
    verif(b.length === 1 && b[0].texte.length === 2000, 'une seule bulle de 2 000 caractères', b.map(x => x.texte.length));
    verif(/raccourci à 2 000 caractères/.test(await page.textContent('#bandeau')), 'le raccourcissement est signalé');
    verif(S.feuille.filter(l => l.auteur === 'moi').map(l => l.texte.length).join() === '2000', 'un seul enregistrement côté serveur');
    verif((await ls(page, 'messages')).filter(m => m.auteur === 'moi').length === 1, 'un seul message gardé sur l\'appareil');
    await ctx.close();
  } },
  { nom: 'Erreurs 401 et 500, réseau coupé : bulle gardée et message clair', f: async ({ nav, st, profil, verif }) => {
    for (const [nom, conf, motif] of [['401', { statut: 401 }, /clé refusée/], ['500', { statut: 500 }, /erreur 500/], ['coupé', { coupe: true }, /injoignable|hors ligne/]]) {
      const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S); Object.assign(S, conf);
      await ecrire(page, 'essai ' + nom); await pause(600);
      const t = await page.textContent('#bandeau');
      verif(motif.test(t), 'erreur ' + nom + ' : message clair', t);
      await page.reload(); await pause(700);
      verif((await moi(page)).some(x => x.texte === 'essai ' + nom && /echec/.test(x.classe)), 'erreur ' + nom + ' : bulle gardée après rechargement');
      await ctx.close();
    }
  } }
  ,
  // Pre-mortem du 18/10 (T1) : le serveur dit « ok » mais LIFE n'a rien répondu (réponse vide) → on le dit, pas de bulle vide.
  { nom: 'Réponse vide de LIFE : bandeau « LIFE n\'a rien répondu » avec Vérifier, aucune bulle vide', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.repondre = (c, S) => {
      if (c.action !== 'envoyer') return null;
      const d = S.F.lireDemandeLife(c), avant = S.feuille.map(l => Object.assign({}, l));
      const lg = S.F.lignesEchangeSeq(d, { reponse: '', statut: 'SUCCÈS' }, S.heure(), Date.now() + (S.n++), avant);
      S.ajouter(lg[0]);
      return S.F.reponseEnvoi(avant, d, lg, 'SUCCÈS');
    };
    const { page, ctx, erreurs } = await ouvrir(nav, st, profil, S);
    await ecrire(page, 'muet'); await pause(800);
    const b = await bulles(page);
    verif(!b.some(x => / life/.test(x.classe) && !x.texte.trim()), 'aucune bulle de LIFE vide', b);
    verif(b.some(x => x.texte === 'muet'), 'le message reste à l\'écran', b);
    const txt = await page.$eval('#bandeau', z => z.hidden ? '' : z.textContent);
    verif(/rien répondu/.test(txt) && /Vérifier/.test(txt), 'bandeau « LIFE n\'a rien répondu » avec Vérifier', txt);
    verif(!erreurs.length, 'aucune erreur JavaScript', erreurs);
    await ctx.close();
  } }
];
