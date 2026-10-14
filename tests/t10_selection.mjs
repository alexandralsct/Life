// Sélection de plusieurs messages (14/10) : appui long (ou clic droit) → « Sélectionner plusieurs », toucher d'autres messages,
// « Supprimer » retire tout le choix (avec Annuler) ; « Fermer » et Échap quittent sans rien supprimer.
import { fauxServeur, ouvrir, ls, pause, attendre } from './outils.mjs';

const ids = async page => (await ls(page, 'messages')).map(m => m.id);
const menu = (page, texte) => page.evaluate(t => { const b = [...document.querySelectorAll('#messages .bulle')].find(x => x.textContent.includes(t)); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); }, texte);
const toucher = (page, texte) => page.evaluate(t => [...document.querySelectorAll('#messages .bulle')].find(x => x.textContent.includes(t)).click(), texte);

export const tests = [
  { nom: 'Sélection de plusieurs messages : choisir, compter, supprimer ensemble (avec Annuler), fermer sans supprimer', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    ['un', 'deux', 'trois', 'quatre'].forEach((t, i) => S.ajouter({ id: 'S-' + (i + 1) + '-0', horodatage: S.heure(), fil: 'general', texte: 'message ' + t }));
    const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await attendre(async () => (await ids(p)).length >= 4);
    await menu(p, 'message un');
    const entrees = await p.$$eval('.feuille-msg button', l => l.map(x => x.textContent));
    verif(entrees.includes('Sélectionner plusieurs'), 'le menu d\'un message propose « Sélectionner plusieurs »', entrees);
    await p.evaluate(() => [...document.querySelectorAll('.feuille-msg button')].find(x => x.textContent === 'Sélectionner plusieurs').click());
    await toucher(p, 'message deux'); await toucher(p, 'message trois'); await toucher(p, 'message trois');   // trois : choisi puis retiré
    const barre = await p.$eval('#selbarre', z => ({ visible: !z.hidden, texte: z.textContent }));
    verif(barre.visible && /2 messages sélectionnés/.test(barre.texte), 'la barre compte 2 messages choisis', barre);
    const choisies = await p.$$eval('#messages .bulle.choisie', l => l.length);
    verif(choisies === 2, 'les 2 bulles choisies sont marquées', choisies);
    await p.evaluate(() => [...document.querySelectorAll('#selbarre button')].find(x => x.textContent === 'Supprimer').click()); await pause(300);
    let reste = await ids(p);
    verif(!reste.includes('S-1-0') && !reste.includes('S-2-0') && reste.includes('S-3-0') && reste.includes('S-4-0'), 'les 2 messages choisis sont supprimés, les autres restent', reste);
    const band = await p.$eval('#bandeau', z => z.textContent);
    verif(/2 messages supprimés/.test(band) && /Annuler/.test(band), 'bandeau « 2 messages supprimés » avec Annuler', band);
    await p.evaluate(() => [...document.querySelectorAll('#bandeau button')].find(x => x.textContent === 'Annuler').click()); await pause(300);
    reste = await ids(p);
    verif(reste.includes('S-1-0') && reste.includes('S-2-0'), 'Annuler les rend', reste);
    await menu(p, 'message quatre');
    await p.evaluate(() => [...document.querySelectorAll('.feuille-msg button')].find(x => x.textContent === 'Sélectionner plusieurs').click());
    await p.keyboard.press('Escape'); await pause(150);
    const ferme = await p.evaluate(() => ({ barre: document.getElementById('selbarre').hidden, choisies: document.querySelectorAll('#messages .bulle.choisie').length }));
    verif(ferme.barre && ferme.choisies === 0 && (await ids(p)).includes('S-4-0'), 'Échap ferme la sélection sans rien supprimer', ferme);
    await toucher(p, 'message un'); await pause(100);
    verif(await p.$eval('#selbarre', z => z.hidden), 'hors sélection, toucher un message ne sélectionne rien');
    await A.ctx.close();
  } },
  { nom: 'Appui long au doigt : le menu reste ouvert après avoir levé le doigt (il se refermait aussitôt)', profils: ['tel'], f: async ({ nav, st, profil, verif }) => {
  const S = fauxServeur(); S.ajouter({ id: 'S-1-0', horodatage: S.heure(), fil: 'general', texte: 'message test appui' });
  const A = await ouvrir(nav, st, profil, S); const p = A.page; await attendre(async () => (await ls(p, 'messages')).length >= 1);
  const r = await p.evaluate(() => { const b = [...document.querySelectorAll('#messages .bulle')].find(x => x.textContent.includes('appui')).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  const cdp = await A.ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] }); await pause(800);
  const pendant = await p.$$eval('.feuille-msg button', l => l.map(x => x.textContent));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pause(300);
  const m = await p.$$eval('.feuille-msg button', l => l.map(x => x.textContent));
  verif(m.includes('Supprimer'), 'appui long tactile : menu ouvert', { pendant, apres: m });
  await A.ctx.close(); } },
];
