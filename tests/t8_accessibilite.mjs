// Audit expert accessibilité (WCAG 2.2 AA) : axe-core (injecté hors réseau s'il est installé : variable AXE_CORE, ou
// paquet axe-core de node_modules) ; sinon, des contrôles scriptés. Puis clavier (messages, menus, boîtes), focus rendu,
// textes de 11 px au moins, noms accessibles. App téléphone et app ordinateur, séparément.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { fauxServeur, ouvrir, pause, TEL } from './outils.mjs';

function trouverAxe() {
  const essais = [process.env.AXE_CORE];
  for (const base of [process.cwd() + '/', import.meta.url]) { try { essais.push(createRequire(base).resolve('axe-core/axe.min.js')); } catch (e) { /* absent */ } }
  const f = essais.find(x => x && fs.existsSync(x));
  return f ? fs.readFileSync(f, 'utf8') : null;
}
const AXE = trouverAxe();
const focusDe = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.dataset.id || a.textContent.trim().slice(0, 30) || a.tagName) : null; });

async function controleAxe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, cibles: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
  });
}
// Repli sans axe-core : noms accessibles, étiquettes, repères, ids uniques, rôles de menu, aria-hidden sans focus.
const controleScripte = page => page.evaluate(() => {
  const nom = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(i => (document.getElementById(i) || {}).textContent || '').join(' ') || e.textContent || e.title || '').trim();
  const visibles = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent || e.getClientRects().length);
  const v = [];
  visibles('button').forEach(b => { if (!nom(b)) v.push({ id: 'button-name', impact: 'critical', n: 1, cibles: [b.id || b.className] }); });
  visibles('input, textarea').forEach(i => { if (!nom(i) && !(i.id && document.querySelector('label[for="' + i.id + '"]'))) v.push({ id: 'label', impact: 'critical', n: 1, cibles: [i.id] }); });
  document.querySelectorAll('dialog[open], [role="dialog"]:not([hidden])').forEach(d => { if (!nom(d)) v.push({ id: 'aria-dialog-name', impact: 'serious', n: 1, cibles: [d.id] }); });
  document.querySelectorAll('[role="menu"]:not([hidden])').forEach(m => { if ([...m.children].some(c => c.getAttribute('role') !== 'menuitem')) v.push({ id: 'aria-required-children', impact: 'critical', n: 1, cibles: [m.id] }); });
  const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); Object.keys(ids).filter(i => ids[i] > 1).forEach(i => v.push({ id: 'duplicate-id', impact: 'serious', n: 1, cibles: [i] }));
  document.querySelectorAll('[aria-hidden="true"]').forEach(e => { if (e.querySelector('button, a, input, [tabindex="0"]')) v.push({ id: 'aria-hidden-focus', impact: 'serious', n: 1, cibles: [e.id || e.className] }); });
  if (!document.querySelector('main')) v.push({ id: 'landmark-one-main', impact: 'moderate', n: 1, cibles: [] });
  if (document.querySelector('[aria-live] #flux, #flux[aria-live], main[aria-live]')) v.push({ id: 'live-conversation', impact: 'serious', n: 1, cibles: ['main'] });
  return v;
});
const serieuses = l => l.filter(v => v.impact === 'serious' || v.impact === 'critical');

export const tests = [
  { nom: 'Accessibilité : axe-core (WCAG 2.2 A et AA) sans violation sérieuse — accueil, nuit, menu, réglages, actions d\'un message, recherche', f: async ({ nav, st, profil, verif }) => {
    // axe est injecté dans la page : seul ce contexte de test contourne la CSP (l'app, elle, n'accepte aucun script en ligne)
    const A = await ouvrir(nav, st, profil, null, { chemin: '?demo', attente: 1200, contexte: AXE ? { bypassCSP: true } : {} });
    const p = A.page, controle = AXE ? controleAxe : controleScripte;
    if (!AXE) console.log('      axe-core absent (AXE_CORE ou node_modules) : contrôles scriptés à la place');
    const scenes = {
      accueil: async () => {},
      nuit: async () => { await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'nuit')); },
      menu: async () => { await p.evaluate(() => document.documentElement.removeAttribute('data-theme')); await p.click('#plus'); },
      reglages: async () => { await p.keyboard.press('Escape'); await p.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); document.getElementById('avance-life').open = true; }); },
      actions: async () => { await p.keyboard.press('Escape'); await p.evaluate(() => { const b = [...document.querySelectorAll('#flux .bulle')].pop(); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); }); },
      recherche: async () => { await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('chercher').click()); await p.fill('#q', 'relance'); }
    };
    const bilan = {};
    for (const [n, f] of Object.entries(scenes)) {
      await f(); await pause(250);
      const v = await controle(p); bilan[n] = v.map(x => x.id + ':' + x.impact);
      verif(serieuses(v).length === 0, n + ' : aucune violation sérieuse ou critique', serieuses(v));
    }
    console.log('      ' + (AXE ? 'axe-core' : 'contrôles scriptés') + ' — remarques mineures restantes : ' + JSON.stringify(Object.fromEntries(Object.entries(bilan).filter(([, l]) => l.length))));
    await A.ctx.close();
  } },
  { nom: 'Clavier : les messages sont atteignables (Tab, flèches) et leurs actions s\'ouvrent au clavier (menu à flèches, Échap rend le focus)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const msgs = Array.from({ length: 6 }, (_, i) => ({ id: 'S-k-' + i, t: '2026-10-13 10:0' + i + ':00', auteur: i % 2 ? 'life' : 'moi', fil: 'general', texte: 'message ' + i }));
    const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { messages: msgs, fil: 'general' } });
    await page.focus('#flux .bulle[tabindex="0"]');
    verif(await focusDe(page) === 'S-k-5', 'un seul message dans l\'ordre de tabulation : le dernier', await focusDe(page));
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    verif(await focusDe(page) === 'S-k-3', 'flèche haut : message précédent', await focusDe(page));
    await page.keyboard.press('Home'); verif(await focusDe(page) === 'S-k-0', 'Début : premier message');
    await page.keyboard.press('End'); await page.keyboard.press('ArrowUp');
    verif(await page.evaluate(() => document.activeElement.getAttribute('role') === 'article' && !!document.activeElement.getAttribute('aria-label')), 'chaque message est un article nommé (« LIFE, 10 h 04 »)');
    await page.keyboard.press('Enter'); await pause(100);
    verif(await page.evaluate(() => document.activeElement.getAttribute('role') === 'menuitem' && document.activeElement.textContent === 'Épingler'), 'Entrée : menu d\'actions, focus sur « Épingler »', await focusDe(page));
    await page.keyboard.press('ArrowDown'); verif(await focusDe(page) === 'Copier', 'flèche bas dans le menu : « Copier »', await focusDe(page));
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); verif(await focusDe(page) === 'Supprimer', 'le menu boucle (haut depuis le premier : le dernier)', await focusDe(page));
    await page.keyboard.press('Escape'); await pause(100);
    verif(await focusDe(page) === 'S-k-4' && !(await page.$('.feuille-msg')), 'Échap : menu fermé, focus rendu au message', await focusDe(page));
    await page.keyboard.press('Shift+F10'); await pause(100);
    await page.keyboard.press('Enter'); await pause(200);   // Épingler
    verif(await page.$$eval('#epingles .epingle', l => l.length) === 1 && await focusDe(page) === 'S-k-4', 'Maj+F10 puis Entrée : épinglé, focus gardé sur le message', await focusDe(page));
    await ctx.close();
  } },
  { nom: 'Clavier : menu « Plus » aux flèches, boîte des réglages nommée, focus rendu à la fermeture', f: async ({ nav, st, profil, verif }) => {
    const A = await ouvrir(nav, st, profil, null, { chemin: '?demo' }); const p = A.page;
    await p.focus('#plus'); await p.keyboard.press('Enter'); await pause(100);
    verif(await focusDe(p) === 'actualiser', 'Entrée : focus sur la première entrée');
    await p.keyboard.press('ArrowDown'); verif(await focusDe(p) === 'calme', 'flèche bas : entrée suivante', await focusDe(p));
    await p.keyboard.press('End'); verif(await focusDe(p) === 'effacer-fil', 'Fin : dernière entrée', await focusDe(p));
    await p.keyboard.press('Escape'); verif(await focusDe(p) === 'plus' && await p.$eval('#menu', m => m.hidden), 'Échap : menu fermé, focus sur « Plus »');
    await p.keyboard.press('ArrowDown'); await pause(50);
    verif(await focusDe(p) === 'actualiser', 'flèche bas sur « Plus » : le menu s\'ouvre');
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await pause(200);   // Réglages
    verif(await p.evaluate(() => { const d = document.getElementById('dlg'); return d.open && document.getElementById(d.getAttribute('aria-labelledby')).textContent === 'Clé et connexion'; }), 'la boîte des réglages est ouverte et nommée « Clé et connexion »');
    await p.keyboard.press('Escape'); await pause(150);
    verif(await focusDe(p) === 'plus', 'Échap : focus rendu au bouton « Plus » (et non au corps de la page)', await focusDe(p));
    await p.click('#brief'); await pause(100); await p.keyboard.press('Enter'); await pause(150);   // focus sur « Conversation » : retour
    verif(await focusDe(p) === 'brief', 'Brief fermé : focus rendu au bouton Brief', await focusDe(p));
    await A.ctx.close();
  } },
  { nom: 'Textes de 11 px au moins partout ; tous les boutons visibles ont un nom', f: async ({ nav, st, profil, tel, verif }) => {
    const tailles = tel ? [[412, 915, true], [412, 915, false], [360, 640, true], [360, 780, true]] : [[1280, 800, true]];
    for (const [w, h, grille] of tailles) {
      const A = await ouvrir(nav, st, { ...profil, viewport: { width: w, height: h } }, null, { chemin: '?demo', init: { grille2: grille, aideAppui: false } });
      const r = await A.page.evaluate(() => {
        const petits = [], sansNom = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || !e || !e.getClientRects().length) continue;
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || e.closest('[hidden], .lecteur, #ouverture')) continue;
          // noms des tuiles du téléphone : capitales aux tailles d'origine, choix de la propriétaire (préféré au 11 px)
          if (e.matches('#barre-fils nav button .nom')) continue;
          if (parseFloat(cs.fontSize) < 11) petits.push(n.textContent.trim().slice(0, 20) + ' (' + cs.fontSize + ')'); }
        [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && !b.closest('[hidden]')).forEach(b => {
          if (!(b.getAttribute('aria-label') || b.textContent.trim())) sansNom.push(b.id || b.className); });
        return { petits, sansNom };
      });
      verif(!r.petits.length, w + '×' + h + (grille ? '' : ' (fils repliés)') + ' : aucun texte sous 11 px', r.petits);
      verif(!r.sansNom.length, w + '×' + h + ' : tous les boutons ont un nom', r.sansNom);
      await A.ctx.close();
    }
  } }
];
