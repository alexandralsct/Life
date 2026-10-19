// V.0.0.4.9 : balayer pour changer de fil (téléphone), Le comité (maquette du Drive), « Connecter un autre appareil » dans le menu.
import { fauxServeur, ouvrir, ls, pause, attendre, choisirFil } from './outils.mjs';

const balayer = (page, de, vers, type = 'touch') => page.evaluate(([a, b, t]) => {
  const z = document.getElementById('messages'), y = 300, ev = (n, x) => z.dispatchEvent(new PointerEvent(n, { bubbles: true, pointerId: 7, pointerType: t, clientX: x, clientY: y }));
  ev('pointerdown', a); ev('pointermove', a + (b - a) / 2); ev('pointermove', b); ev('pointerup', b);
}, [de, vers, type]);

export const tests = [
  { nom: 'Balayer : à gauche fil suivant, à droite fil précédent ; la souris ne change rien ; au bout, le fil reste', profils: ['tel'], f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S); const p = A.page;
    const fil = async () => (await ls(p, 'fil')) || 'general';
    await balayer(p, 300, 40, 'mouse'); await pause(400);
    verif((await fil()) === 'general', 'à la souris, rien ne change');
    await balayer(p, 300, 40); await attendre(async () => (await fil()) === 'travail');
    verif((await fil()) === 'travail', 'balayage à gauche : Travail', await ls(p, 'fil'));
    await balayer(p, 40, 300); await attendre(async () => (await fil()) === 'general');
    verif((await fil()) === 'general', 'balayage à droite : retour à Général');
    await balayer(p, 40, 300); await pause(500);
    verif((await fil()) === 'general', 'au premier fil, balayer à droite ne fait rien');
    await balayer(p, 300, 320); await pause(300);
    verif((await fil()) === 'general', 'un petit geste ne change pas de fil');
    await A.ctx.close();
  } },
  { nom: 'Le comité : table à cinq voix, étape, voix qui parle ; rien ailleurs', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.ajouter({ id: 'C-1-0', horodatage: S.heure(), fil: 'comite', texte: 'Rester ou partir ?', auteur: 'moi' });
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    verif(await p.evaluate(() => { const z = document.getElementById('comite'); return !z || z.hidden; }), 'hors du fil Comité, pas de table');
    await choisirFil(p, 'Comité'); await pause(300);
    const e = await p.evaluate(() => { const z = document.getElementById('comite'); return z && !z.hidden ? { sieges: z.querySelectorAll('.cm-siege').length, etape: z.querySelector('.cm-etape').textContent, centre: z.querySelector('.cm-centre').textContent, pied: z.querySelector('.cm-pied').textContent } : null; });
    verif(e && e.sieges === 5 && /Rester ou partir/.test(e.centre) && /ne décide jamais à ta place/.test(e.pied), 'la table montre les 5 voix, la décision au centre et le pied de la maquette', e);
    await choisirFil(p, 'Général'); await pause(200);
    verif(await p.evaluate(() => document.getElementById('comite').hidden), 'retour à Général : la table disparaît');
    await A.ctx.close();
  } }
];
