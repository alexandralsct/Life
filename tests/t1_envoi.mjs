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
  { nom: 'Délai d\'attente de 20 s, puis Réessayer sans second traitement (idempotence par cid)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); S.retardApres = c => c.action === 'envoyer' ? 40000 : 0;
    const { page, ctx } = await ouvrir(nav, st, profil, S, { avantChargement: (c, p) => p.clock.install() });
    await ecrire(page, 'lent'); await pause(400);
    verif((await moi(page)).some(b => b.texte === 'lent' && /attente/.test(b.classe)), 'en attente au départ');
    await page.clock.fastForward(19000); await pause(200);
    verif(!(await page.$('.reessayer')), 'pas encore abandonné à 19 s');
    await page.clock.fastForward(2000); await pause(400);
    verif(await page.$('.reessayer'), 'abandon à 20 s : « Non envoyé · Réessayer »');
    const txt = await page.textContent('#bandeau');
    verif(/pas de réponse à temps/.test(txt), 'le bandeau dit que le délai est dépassé', txt);
    verif(S.traitements === 1, 'le serveur a traité le message une fois', S.traitements);
    S.retardApres = 0;
    await page.evaluate(() => document.querySelector('.reessayer').click()); await pause(700);
    verif(S.traitements === 1, 'Réessayer : le serveur reconnaît le cid et ne retraite pas', S.traitements);
    const b = await bulles(page);
    verif(b.filter(x => x.texte === 'lent').length === 1 && b.some(x => /Réponse \(general\) : lent/.test(x.texte)), 'une seule bulle et la réponse', b);
    verif(S.feuille.filter(l => l.auteur === 'moi').length === 1, 'un seul enregistrement côté serveur', S.feuille.length);
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
];
