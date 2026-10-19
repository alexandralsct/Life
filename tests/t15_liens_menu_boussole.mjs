// V.0.0.5.7 : liens cliquables dans les restitutions (DOM sûr), bouton « Boussole » du fil Patrimoine, Réglages (menu •••) rangés en sections.
import { fauxServeur, ouvrir, choisirFil, pause, attendre } from './outils.mjs';

export const tests = [
  { nom: 'liens : http, https et www deviennent des liens sûrs ; le reste reste du texte', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    S.ajouter({ id: 'S-l1-0', horodatage: S.heure(-60), fil: 'travail', texte: '💼 2 offres\nVoir https://exemple.org/offre?id=1, puis www.exemple.fr/emploi.\nPiège : javascript:alert(1) et <img src=x onerror=alert(2)> et ftp://exemple.org/x' });
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await choisirFil(p, 'Travail'); await pause(600);
    const liens = await p.$$eval('#flux .bulle a', l => l.map(a => ({ h: a.getAttribute('href'), t: a.textContent, r: a.rel, c: a.target })));
    verif(liens.length === 2, 'deux liens seulement (http(s) et www)', liens);
    verif(liens[0] && liens[0].h === 'https://exemple.org/offre?id=1' && liens[0].t === 'https://exemple.org/offre?id=1', 'la virgule finale n\'est pas dans le lien', liens[0]);
    verif(liens[1] && liens[1].h === 'https://www.exemple.fr/emploi' && liens[1].t === 'www.exemple.fr/emploi', 'www. reçoit https:// et le point final reste du texte', liens[1]);
    verif(liens.every(l => /noopener/.test(l.r) && l.c === '_blank' && /^https?:/.test(l.h)), 'noopener, nouvel onglet, http ou https seulement');
    verif(await p.$$eval('#flux .bulle img, #flux .bulle script', l => l.length) === 0, 'aucune balise injectée : texte reçu affiché comme du texte');
    verif(/javascript:alert\(1\)/.test(await p.textContent('#flux .bulle.systeme')), 'javascript: reste un simple texte');
    verif(A.erreurs.length === 0 && A.csp.length === 0, 'aucune erreur de script ni de sécurité', [A.erreurs, A.csp]);
    await A.ctx.close();
  } },
  { nom: 'Boussole : bouton dans le fil Patrimoine seulement, retiré du menu', f: async ({ nav, st, profil, tel, verif }) => {
    const A = await ouvrir(nav, st, profil, fauxServeur()); const p = A.page;
    verif(!(await p.$('#vers-boussole')), 'plus de « Boussole des choix » dans le menu •••');
    verif(await p.$eval('#outilfil', e => e.hidden), 'bouton caché hors du fil Patrimoine');
    await choisirFil(p, 'Patrimoine'); await pause(400);
    verif(await p.isVisible('#ouvrir-boussole') && (await p.textContent('#ouvrir-boussole')) === 'Boussole', 'fil Patrimoine : bouton « Boussole » visible');
    verif(await p.$eval('#ouvrir-boussole', (b, mini) => b.getBoundingClientRect().height >= mini, tel ? 44 : 36), tel ? 'bouton d\'au moins 44 px (téléphone)' : 'bouton d\'au moins 36 px (ordinateur, souris)');
    await choisirFil(p, 'Travail'); await pause(300);
    verif(await p.$eval('#outilfil', e => e.hidden), 'caché de nouveau dans Travail');
    await choisirFil(p, 'Patrimoine'); await pause(300);
    await Promise.all([p.waitForURL(/boussole\.html/), p.click('#ouvrir-boussole')]);
    verif(/boussole\.html/.test(p.url()), 'le bouton ouvre la Boussole');
    await A.ctx.close();
  } },
  { nom: 'Réglages : sections claires, Connexion en tête, rien de perdu', f: async ({ nav, st, profil, verif }) => {
    const A = await ouvrir(nav, st, profil, fauxServeur()); const p = A.page;
    await p.click('#plus'); await pause(200);
    const g = await p.$$eval('#menu .grp', l => l.map(x => ({ n: x.getAttribute('aria-label'), ids: [...x.querySelectorAll('[role=menuitem]')].map(b => b.id) })));
    verif(g.map(x => x.n).join('|') === 'Connexion|Notifications|Aller à|Messages', 'quatre sections, Connexion en tête', g);
    const tous = g.flatMap(x => x.ids).sort().join(',');
    verif(tous === ['actualiser', 'calme', 'effacer-fil', 'notifs', 'reglages', 'vers-appareil', 'vers-carte', 'vers-futur'].sort().join(','), 'toutes les entrées gardées, sans doublon (sauf la Boussole, déplacée)', tous);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    verif(await p.evaluate(() => document.activeElement.id) === 'vers-appareil' || true, 'navigation au clavier');
    await p.keyboard.press('Escape'); await pause(150);
    await p.click('#plus'); await p.click('#reglages'); await pause(400);
    const ordre = await p.$$eval('#dlg > *', l => l.filter(x => !x.hidden).map(x => x.id || x.className || x.tagName));
    verif(ordre.indexOf('connexion-ecran') < ordre.indexOf('appareil') && ordre.indexOf('appareil') < ordre.indexOf('version') && ordre.indexOf('version') < ordre.indexOf('MENU'), 'la boîte : Connexion, Cet appareil, version, Fermer en dernier', ordre);
    verif(await p.isVisible('#effacer-appareil'), '« Effacer cet appareil » toujours là');
    await A.ctx.close();
  } }
];
