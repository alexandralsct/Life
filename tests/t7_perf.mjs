// Audit expert performance (LT1) : rendu incrémental. Mesures sur 400 messages (300 dans Général, 100 dans Travail),
// textes de 1 500 caractères. App téléphone : processeur ralenti ×4 (comme l'expert) ; app ordinateur : ×1.
// Budgets : changement de fil < 200 ms (téléphone) et < 100 ms (ordinateur) ; plus longue tâche au démarrage < 400 ms
// (téléphone) ; un nouveau message ne redessine pas les autres bulles.
import { fauxServeur, ouvrir, pause } from './outils.mjs';

const serie = (n, fil, long) => Array.from({ length: n }, (_, i) => ({ id: 'S-' + fil + '-' + i,
  t: '2026-10-' + String(1 + Math.floor(i / 40)).padStart(2, '0') + ' 10:' + String(Math.floor(i / 60) % 60).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0'),
  auteur: i % 2 ? 'life' : 'moi', fil, texte: 'Message de démonstration ' + i + ' ' + 'texte neutre '.repeat(Math.ceil(long / 13)).slice(0, long) }));
export const MESSAGES = serie(300, 'general', 1500).concat(serie(100, 'travail', 1500));
const prep = cpu => async (ctx, page) => {
  const cdp = await ctx.newCDPSession(page); if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ } });
};
export const changeFil = (page, nom) => page.evaluate(async nom => {
  const bt = [...document.querySelectorAll('#fils button')].find(b => b.getAttribute('aria-label').toLowerCase().startsWith(nom));
  const t0 = performance.now(); bt.click();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return Math.round(performance.now() - t0);
}, nom);
export async function mesurer(nav, st, profil, tel) {
  const S = fauxServeur(); const cpu = tel ? 4 : 1;
  const { page, ctx } = await ouvrir(nav, st, profil, S, { init: { messages: MESSAGES, fil: 'general' }, avantChargement: prep(cpu), attente: 2500 });
  const demarrage = await page.evaluate(() => ({ pire: Math.round(Math.max(0, ...window.__lt)), tbt: Math.round(window.__lt.reduce((s, d) => s + Math.max(0, d - 50), 0)) }));
  const fils = [];
  for (const n of ['travail', 'g', 'travail', 'g']) { fils.push(await changeFil(page, n)); await pause(300); }
  return { page, ctx, S, demarrage, fils };
}
export const tests = [
  { nom: 'Performance : 400 longs messages, changement de fil rapide et démarrage sans longue tâche (rendu incrémental)', f: async ({ nav, st, profil, tel, verif }) => {
    const { page, ctx, demarrage, fils } = await mesurer(nav, st, profil, tel);
    console.log('      mesures ' + (tel ? 'téléphone ×4' : 'ordinateur ×1') + ' : démarrage ' + JSON.stringify(demarrage) + ' ; changements de fil (ms) ' + fils.join(', '));
    const budget = tel ? 200 : 100;
    verif(Math.max(...fils) < budget, 'changement de fil < ' + budget + ' ms', fils);
    verif(demarrage.pire < (tel ? 400 : 150), 'plus longue tâche au démarrage < ' + (tel ? 400 : 150) + ' ms', demarrage);
    await ctx.close();
  } },
  { nom: 'Rendu incrémental : un nouveau message ne refait pas les autres bulles ; les plus anciens arrivent en remontant', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const court = Array.from({ length: 120 }, (_, i) => ({ id: 'S-c-' + i, t: '2026-10-12 10:' + String(Math.floor(i / 60)).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0'), auteur: i % 2 ? 'life' : 'moi', fil: 'general', texte: 'court ' + i }));
    const { page, ctx, erreurs } = await ouvrir(nav, st, profil, S, { init: { messages: court, fil: 'general' } });
    const n0 = await page.$$eval('#flux .bulle', l => l.length);
    verif(n0 === 40 && await page.$('#flux .anciens'), '40 bulles dans la page sur 120, et « Messages plus anciens »', n0);
    await page.evaluate(() => document.querySelectorAll('#flux .bulle').forEach(b => { b.__ancienne = true; }));
    S.ajouter({ id: 'S-neuf-0', horodatage: S.heure(), fil: 'general', texte: 'nouveau' });
    await page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('actualiser').click(); }); await pause(500);
    const r = await page.$$eval('#flux .bulle', l => ({ n: l.length, refaites: l.filter(b => !b.__ancienne).map(b => b.firstChild.textContent) }));
    verif(r.refaites.length <= 2 && r.refaites.includes('nouveau'), 'seules la nouvelle bulle (et la précédente, dont l\'heure change) sont créées', r.refaites);
    await page.evaluate(() => { document.getElementById('messages').scrollTop = 0; }); await pause(600);
    const n1 = await page.$$eval('#flux .bulle', l => l.length);
    verif(n1 > 41, 'en remontant en haut, les messages plus anciens s\'ajoutent', n1);
    verif(!erreurs.length, 'aucune erreur JavaScript', erreurs);
    await ctx.close();
  } }
];
