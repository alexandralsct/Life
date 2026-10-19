// V.0.0.5.9 : filtres « Immobilier » et « Bourse » du fil Patrimoine (19/10) : pastilles accessibles, classement par mots fixes
// (sans IA), le non classé reste dans « Tout », choix gardé sur l'appareil, textContent seulement.
import { fauxServeur, ouvrir, choisirFil, pause, attendre, ls } from './outils.mjs';

const MESSAGES = [
  ['S-f1-0', '🗂 Patrimoine — ⚡ Immédiat\n\n• Immobilier — T3 lumineux, 4e étage : 285 000 €'],
  ['S-f2-0', '• Viager — maison de village, bouquet 40 000 €'],
  ['S-f3-0', '• Copropriété : appel de charges du syndic'],
  ['S-f4-0', '📈 Revue bourse et actualité — semaine du 12/10'],
  ['S-f5-0', '• Crypto 🔴 urgent : le bitcoin passe sous le seuil bas'],
  ['S-f6-0', '📚 Cours de finance n° 6 : « La diversification »'],
  ['S-f7-0', '🏛 Point de la semaine — Patrimoine\n\n1. Revue bourse dans le fil.\n2. Copropriété : rien à signaler.'],
  ['S-f8-0', 'Rappel : penser au rendez-vous chez le notaire']   // aucun mot de sujet : reste dans « Tout »
];
const textes = p => p.$$eval('#flux .bulle[data-id]', l => l.map(b => b.textContent));
const ids = p => p.$$eval('#flux .bulle[data-id]', l => l.map(b => b.dataset.id));

export const tests = [
  { nom: 'Patrimoine : classement par mots fixes, sans IA', f: async ({ nav, st, profil, verif }) => {
    const A = await ouvrir(nav, st, profil, fauxServeur()); const p = A.page;
    const c = await p.evaluate(l => l.map(t => sujetsPatrimoine({ texte: t }).join('+')), MESSAGES.map(m => m[1]));
    verif(c.join('|') === 'immobilier|immobilier|immobilier|bourse|bourse|bourse|immobilier+bourse|', 'chaque message classé comme prévu, le dernier nulle part', c);
    verif(await p.evaluate(() => sujetsPatrimoine({}).length === 0 && sujetsPatrimoine({ texte: null }).length === 0), 'message sans texte : non classé');
    await A.ctx.close();
  } },
  { nom: 'Patrimoine : pastilles Tout / Immobilier / Bourse, filtre, choix gardé', f: async ({ nav, st, profil, tel, verif }) => {
    const S = fauxServeur(); MESSAGES.forEach(([id, texte], k) => S.ajouter({ id, horodatage: S.heure(-600 + k), fil: 'patrimoine', texte }));
    S.ajouter({ id: 'S-t1-0', horodatage: S.heure(-30), fil: 'travail', texte: '• Immobilier — hors sujet : autre fil' });
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await choisirFil(p, 'Travail'); await pause(300);
    verif(await p.$eval('#outilfil', e => e.hidden), 'pas de pastilles hors du fil Patrimoine');
    await choisirFil(p, 'Patrimoine');
    verif(await attendre(async () => (await ids(p)).length === 8), 'Tout : les 8 messages du fil, et pas celui d\'un autre fil', await ids(p));
    const bt = await p.$$eval('#filtres .pastille', l => l.map(b => ({ t: b.textContent, r: b.type, p: b.getAttribute('aria-pressed'), h: Math.round(b.getBoundingClientRect().height), tag: b.tagName })));
    verif(bt.map(b => b.t).join('|') === 'Tout|Immobilier|Bourse' && bt.every(b => b.tag === 'BUTTON' && b.r === 'button'), 'trois vrais boutons : Tout, Immobilier, Bourse', bt);
    verif(bt.map(b => b.p).join() === 'true,false,false', 'Tout est choisi par défaut (aria-pressed)', bt);
    verif(bt.every(b => b.h >= (tel ? 44 : 36)), tel ? 'cibles d\'au moins 44 px (téléphone)' : 'cibles d\'au moins 36 px (ordinateur)', bt);
    verif(await p.$eval('#filtres', g => g.getAttribute('role') === 'group' && !!g.getAttribute('aria-label')), 'groupe nommé pour les lecteurs d\'écran');
    await p.click('#filtres [data-sujet=immobilier]'); await pause(300);
    verif((await ids(p)).join() === 'S-f1-0,S-f2-0,S-f3-0,S-f7-0', 'Immobilier : seulement les messages immobilier (et le point de la semaine)', await ids(p));
    verif((await p.$$eval('#filtres .pastille', l => l.map(b => b.getAttribute('aria-pressed')))).join() === 'false,true,false', 'Immobilier est marqué choisi');
    await p.click('#filtres [data-sujet=bourse]'); await pause(300);
    verif((await ids(p)).join() === 'S-f4-0,S-f5-0,S-f6-0,S-f7-0', 'Bourse : revue, crypto, cours et point de la semaine', await ids(p));
    verif(await ls(p, 'filtrePatrimoine') === 'bourse', 'choix gardé sur l\'appareil', await ls(p, 'filtrePatrimoine'));
    await p.reload(); await pause(800); await choisirFil(p, 'Patrimoine'); await pause(300);
    verif((await ids(p)).join() === 'S-f4-0,S-f5-0,S-f6-0,S-f7-0', 'après rechargement : Bourse toujours choisi');
    await choisirFil(p, 'Général'); await choisirFil(p, 'Patrimoine'); await pause(300);
    verif((await ids(p)).length === 4, 'changer de fil puis revenir garde le filtre');
    await p.click('#filtres [data-sujet=tout]'); await pause(300);
    verif((await ids(p)).length === 8 && (await ids(p)).includes('S-f8-0'), 'Tout : le message non classé est bien là');
    verif(A.erreurs.length === 0 && A.csp.length === 0, 'aucune erreur de script ni de sécurité', [A.erreurs, A.csp]);
    await A.ctx.close();
  } },
  { nom: 'Patrimoine : filtre sans résultat, texte affiché comme du texte, valeur du stockage invalide', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.ajouter({ id: 'S-x1-0', horodatage: S.heure(-60), fil: 'patrimoine', texte: '• Immobilier — <img src=x onerror=alert(1)> <b>gras</b>' });
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await p.evaluate(() => localStorage.setItem('life.filtrePatrimoine', JSON.stringify('<script>'))); await p.reload(); await pause(800);
    await choisirFil(p, 'Patrimoine'); await pause(300);
    verif((await p.$$eval('#filtres .pastille', l => l.map(b => b.getAttribute('aria-pressed')))).join() === 'true,false,false', 'valeur inconnue en stockage : retour à Tout');
    verif(await p.$$eval('#flux img, #flux b, #filtres img, #filtres script', l => l.length) === 0, 'aucune balise injectée (textContent)');
    await p.click('#filtres [data-sujet=bourse]'); await pause(300);
    verif((await ids(p)).length === 0 && /Rien sur « Bourse »/.test(await p.textContent('#flux .vide')), 'Bourse sans message : mot explicite, pas de page blanche');
    await p.click('#filtres [data-sujet=immobilier]'); await pause(300);
    verif(/<img src=x onerror=alert\(1\)> <b>gras<\/b>/.test((await textes(p)).join()), 'le texte reçu reste du texte');
    verif(A.erreurs.length === 0 && A.csp.length === 0, 'aucune erreur ni violation CSP', [A.erreurs, A.csp]);
    await A.ctx.close();
  } }
];
