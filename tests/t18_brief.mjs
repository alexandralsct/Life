// V.0.0.6.3 (23/10) : le brief du jour s'affiche même précédé de l'étiquette « 🗂 Général » ; les briefs précédents restent lisibles
// (liste par jour, plus récent en haut), gardés à part de la borne des messages.
import { fauxServeur, ouvrir, pause, attendre, ls } from './outils.mjs';

const brief = (jour, avecEtiquette) => (avecEtiquette ? '🗂 Général\n' : '') + '☀️ Bonjour la personne — jour ' + jour + '\n\n━━ L\'essentiel\n• ligne du jour ' + jour;

export const tests = [
  { nom: 'Brief : étiquette tolérée, historique par jour, gardé à part', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    for (let j = 1; j <= 3; j++) S.ajouter({ id: 'S-b' + j + '-0', horodatage: S.heure(-86400 * (4 - j)), auteur: 'systeme', fil: 'general', texte: brief(j, j !== 2) });
    S.ajouter({ id: 'S-x-0', horodatage: S.heure(-60), auteur: 'systeme', fil: 'general', texte: '• message ordinaire' });
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await attendre(async () => (await p.evaluate(() => briefsGardes.length)) === 3);
    verif(await p.evaluate(() => estBrief({ auteur: 'systeme', texte: '🗂 Général\n☀️ Bonjour' }) && estBrief({ auteur: 'systeme', texte: '☀️ Bonjour' }) && !estBrief({ auteur: 'systeme', texte: '💼 offres' }) && !estBrief({ auteur: 'moi', texte: '☀️ x' })), 'estBrief : avec ou sans étiquette, jamais un autre message');
    await p.evaluate(() => document.getElementById('brief').click()); await pause(300);
    const t = await p.$eval('#vue-brief', v => v.textContent);
    verif(/jour 3/.test(t) && !/🗂/.test(t), 'le brief du jour s\'affiche, sans l\'étiquette', t.slice(0, 200));
    const r = await p.$$eval('#vue-brief details.brief-ancien > summary', l => l.map(s => s.textContent));
    verif(r.length === 2 && /jour 2/.test(r[0]) && /jour 1/.test(r[1]), 'les 2 précédents en liste, le plus récent en haut', r);
    const g = await ls(p, 'briefs'); verif(Array.isArray(g) && g.length === 3 && g.every(b => !/🗂/.test(b.texte)), 'historique gardé sur l\'appareil, sans étiquette', g && g.length);
    await A.ctx.close();
  } }
];
