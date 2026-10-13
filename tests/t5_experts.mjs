// Point 9 de l'audit du 13/10 : Experts — refus lisible (reponse, sinon erreur), préfixe « nom : » seulement pour un
// expert connu (liste donnée par le serveur).
import { fauxServeur, ouvrir, ecrire, choisirFil, bulles, pause } from './outils.mjs';

const membres = S => S.appels.filter(a => a.corps.type === 'expert').map(a => [a.corps.expert.membre, a.corps.texte]);

export const tests = [
  { nom: 'Experts : refus du serveur affiché tel quel (jamais « erreur 200 »), avec reponse ou erreur', f: async ({ nav, st, profil, verif }) => {
    for (const refus of [{ ok: false, type: 'expert', reponse: 'Écris le nom d\'un expert puis ta question.' }, { ok: false, type: 'expert', erreur: 'question vide' }]) {
      const S = fauxServeur({ reponseExperts: () => refus });
      const { page, ctx } = await ouvrir(nav, st, profil, S);
      await choisirFil(page, 'Experts'); await ecrire(page, 'une question'); await pause(500);
      const b = await bulles(page), t = await page.textContent('#bandeau');
      verif(!/erreur 200/.test(t) && !b.some(x => /echec/.test(x.classe)), 'pas de « erreur 200 » ni d\'échec', { t, b });
      const attendu = refus.reponse || 'Refusé : ' + refus.erreur;
      verif(await page.evaluate(a => [...document.querySelectorAll('#messages .bulle.life')].some(x => x.textContent.includes(a)), attendu), 'l\'explication du serveur est affichée', attendu);
      await ctx.close();
    }
  } },
  { nom: 'Experts : « Rappel : … » n\'est pas pris pour un expert ; « Notaire : … » l\'est si le serveur connaît cet expert', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur({ experts: ['notaire', 'fiscaliste'] });
    const { page, ctx } = await ouvrir(nav, st, profil, S);   // la liste arrive avec la première actualisation
    await choisirFil(page, 'Experts');
    await ecrire(page, 'Rappel : appeler la banque'); await pause(400);
    await ecrire(page, 'Notaire : une succession'); await pause(400);
    const m = membres(S);
    verif(JSON.stringify(m) === JSON.stringify([['', 'Rappel : appeler la banque'], ['notaire', 'une succession']]), 'membre seulement pour un expert connu', m);
    await ctx.close();
    const S2 = fauxServeur({ ancien: true });   // ancien serveur : pas de liste → aucun préfixe interprété
    const B = await ouvrir(nav, st, profil, S2);
    await choisirFil(B.page, 'Experts'); await ecrire(B.page, 'Notaire : une succession'); await pause(400);
    verif(JSON.stringify(membres(S2)) === JSON.stringify([['', 'Notaire : une succession']]), 'sans liste, la question part entière', membres(S2));
    await B.ctx.close();
  } }
];
