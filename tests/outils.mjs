// Outils de la suite de tests de LIFE (Playwright) : serveur statique local, faux serveur des messages (intercepté
// par page.route, aucune donnée réelle), profils « app téléphone » et « app ordinateur ».
// Variables d'environnement facultatives :
//   PLAYWRIGHT       chemin du module Playwright (index.mjs) ; sinon « playwright »
//   CHROMIUM         exécutable Chromium à utiliser
//   LIFE_SERVEUR_JS  fichier des fonctions du vrai serveur (lireDemandeLife, pageFil…) : le faux serveur les utilise
//                    à la place des siennes (contrat vérifié des deux côtés)
//   RACINE           dossier servi (par défaut : ce dépôt)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
export const RACINE = process.env.RACINE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOOK = 'https://essai.exemple.cloud/webhook/life';
export const HOOK_EXPERTS = 'https://essai.exemple.cloud/webhook/app-lien';
export const TEL = { nom: 'App téléphone', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' };
export const ORDI = { nom: 'App ordinateur', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, locale: 'fr-FR', timezoneId: 'Europe/Paris' };
export const pause = ms => new Promise(r => setTimeout(r, ms));

// ---------- serveur statique (port libre), avec un retard réglable pour simuler un réseau lent ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
export function serveurStatique(racine = RACINE) {
  const S = { retard: 0, port: 0 };
  S.http = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    let p = path.join(racine, decodeURIComponent(u.pathname));
    if (!p.startsWith(racine)) { r.writeHead(403); r.end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    setTimeout(() => fs.readFile(p, (e, d) => {
      if (e) { r.writeHead(404, { 'content-type': 'text/plain' }); r.end('absent'); return; }
      r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d);
    }), S.retard);
  });
  return new Promise(ok => S.http.listen(0, '127.0.0.1', () => { S.port = S.http.address().port; S.base = 'http://127.0.0.1:' + S.port + '/'; ok(S); }));
}

// ---------- faux serveur des messages ----------
// Version 2 (à jour) : curseur, pagination, cid idempotent, version et fils dans chaque réponse, retraits propagés.
// ancien: true : l'ancien serveur (sans version : fil inconnu rangé dans « general », « depuis » strict, 80 messages au plus).
const FILS_V2 = ['general', 'travail', 'metamorphose', 'patrimoine', 'voyage', 'quotidien', 'experts', 'comite', 'brainstorm', 'coach'];
function fonctionsInternes(o) {
  const F = {};
  const t = v => v === undefined || v === null ? '' : String(v).trim();
  const visible = m => t(m.id) && t(m.texte) && t(m.statut) !== 'retire' && t(m.statut) !== 'retrait';
  const msg = m => ({ id: t(m.id), t: t(m.horodatage), auteur: t(m.auteur), fil: t(m.fil), texte: t(m.texte), source: t(m.source) });
  const curs = v => { const n = Number(v); return v !== '' && v !== null && v !== undefined && Number.isInteger(n) && n >= 0 ? n : -1; };
  F.contratLife = x => Object.assign({ version: 2, fils: FILS_V2 }, o.experts ? { experts: o.experts } : {}, x);
  F.lireDemandeLife = c => {
    c = c || {}; const action = t(c.action), filBrut = t(c.fil).toLowerCase(), fil = filBrut || 'general';
    if (action === 'fil') return filBrut && !FILS_V2.includes(filBrut) ? { erreur: 'fil inconnu' } : { action, fil: filBrut, depuis: t(c.depuis).slice(0, 19), curseur: curs(c.curseur) };
    if (action === 'retirer') { const ids = (c.ids || []).map(t).filter(i => /^[\w-]{1,60}$/.test(i)).slice(0, 400); return ids.length ? { action, ids } : { erreur: 'rien à retirer' }; }
    if (action !== 'envoyer') return { erreur: 'action inconnue' };
    if (!FILS_V2.includes(fil)) return { erreur: 'fil inconnu' };
    const texte = t(c.texte).slice(0, 2000); if (!texte) return { erreur: 'message vide' };
    const d = { action, fil, texte }; if (t(c.texte).length > 2000) d.tronque = true;
    if (/^[a-z0-9]{6,32}$/i.test(t(c.cid))) d.cid = t(c.cid); if (curs(c.curseur) >= 0) d.curseur = curs(c.curseur);
    return d;
  };
  F.pageFil = (lignes, d, max = 200) => {
    const L = lignes.map((m, i) => ({ m, p: Number(m.row_number) > 0 ? Number(m.row_number) : i + 2 })).sort((a, b) => a.p - b.p);
    const fin = L.length ? L[L.length - 1].p : 0, k = curs(d.curseur); let debut;
    if (k >= 0) debut = k;
    else if (d.depuis) { const x = L.find(e => visible(e.m) && t(e.m.horodatage) >= d.depuis); debut = x ? x.p - 1 : fin; }
    else { const v = L.filter(e => visible(e.m)).slice(-80)[0]; debut = v ? v.p - 1 : fin; }
    const messages = [], retires = []; let curseur = debut, plus = false;
    for (const e of L) {
      if (e.p <= debut) continue;
      if (messages.length >= max) { plus = true; break; }
      curseur = e.p;
      if (t(e.m.statut) === 'retrait') { retires.push(...t(e.m.texte).split(/\s+/).filter(Boolean)); continue; }
      if (!visible(e.m) || (d.fil && t(e.m.fil) !== d.fil)) continue;
      messages.push(msg(e.m));
    }
    return F.contratLife({ ok: true, messages, retires, curseur: Math.max(curseur, debut), plus });
  };
  F.lignesEchangeLife = (d, rep, h, ms) => { const b = 'L-' + (d.cid || ms);
    return [{ id: b + '-a', horodatage: h, auteur: 'moi', fil: d.fil, texte: d.texte, source: 'app', statut: '' },
            { id: b + '-b', horodatage: h, auteur: 'life', fil: d.fil, texte: rep.reponse, source: 'app', statut: rep.statut }]; };
  F.dejaTraite = (lignes, d) => { if (!d.cid) return null; const l = lignes.filter(m => m.id === 'L-' + d.cid + '-a' || m.id === 'L-' + d.cid + '-b');
    return l.length ? F.contratLife({ ok: true, deja: true, messages: l.map(msg), statut: 'SUCCÈS' }) : null; };
  F.reponseEnvoi = (avant, d, nouv, statut) => {
    const r = F.contratLife({ ok: true, messages: nouv.map(msg), statut }); if (d.tronque) r.tronque = 2000;
    if (curs(d.curseur) >= 0) { const p = F.pageFil(avant, { curseur: d.curseur }), vus = new Set(r.messages.map(m => m.id));
      r.messages = p.messages.filter(m => !vus.has(m.id)).concat(r.messages); r.retires = p.retires; r.curseur = p.curseur; r.plus = p.plus; }
    return r;
  };
  F.ligneRetrait = (ids, h, ms) => ({ id: 'R-' + ms, horodatage: h, auteur: 'systeme', fil: '_retrait', texte: ids.join(' '), source: 'app', statut: 'retrait' });
  return F;
}
function fonctionsReelles(fichier, o) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(fichier, 'utf8') + (o.experts ? '\nvar LIFE_EXPERTS = ' + JSON.stringify(o.experts) + ';' : ''), ctx);
  return ctx;
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-cle-app', 'access-control-allow-methods': 'POST' };
export function fauxServeur(o = {}) {
  const F = !o.ancien && process.env.LIFE_SERVEUR_JS ? fonctionsReelles(process.env.LIFE_SERVEUR_JS, o) : fonctionsInternes(o);
  const S = { feuille: [], appels: [], traitements: 0, retard: o.retard || 0, statut: 200, coupe: false, ancien: !!o.ancien, n: 0, F,
              pageMax: o.pageMax || 200, echecRetrait: false, filsAnciens: o.filsAnciens || ['general', 'travail', 'metamorphose', 'patrimoine', 'voyage', 'quotidien', 'experts', 'comite', 'brainstorm', 'coach'] };
  S.heure = (decalage = 0) => new Date(Date.now() + decalage).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 19);
  S.ajouter = (l) => { S.feuille.push(Object.assign({ source: 'envois', statut: '', auteur: 'systeme' }, l)); S.feuille.forEach((m, i) => { m.row_number = i + 2; }); };
  S.repondre = o.repondre || null;   // (corps, S) → réponse JSON à la place du comportement normal (ou rien)
  S.experts = o.reponseExperts || (() => ({ ok: true, type: 'expert', reponses: [{ id: 'x', nom: 'Expert', texte: 'avis' }] }));
  S.gerer = async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (e) { /* illisible */ }
    const appel = { url: req.url(), corps, t: Date.now(), cle: req.headers()['x-cle-app'] }; S.appels.push(appel);
    const retard = typeof S.retard === 'function' ? S.retard(corps) : S.retard;
    if (retard) await pause(retard);
    if (typeof S.coupe === 'function' ? S.coupe(corps) : S.coupe) return route.abort('internetdisconnected').catch(() => {});
    if (S.statut !== 200) return route.fulfill({ status: S.statut, headers: cors, body: '{}' }).catch(() => {});
    const rep = await S.reponse(corps, req.url());
    // retardApres : le serveur a fait le travail, mais sa réponse traîne (cas de l'idempotence)
    const apres = typeof S.retardApres === 'function' ? S.retardApres(corps) : S.retardApres;
    if (apres) await pause(apres);
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(rep) }).catch(() => {});
  };
  S.reponse = async (corps, url) => {
    if (url.includes('/app-lien')) return S.experts(corps, S);
    if (S.repondre) { const x = S.repondre(corps, S); if (x) return x; }
    return S.ancien ? S.reponseAncienne(corps) : S.reponseV2(corps);
  };
  S.reponseV2 = corps => {
    const d = F.lireDemandeLife(corps);
    if (d.erreur) return F.contratLife({ ok: false, erreur: d.erreur });
    if (d.action === 'fil') return F.pageFil(S.feuille, d, S.pageMax);
    if (d.action === 'retirer') {
      if (S.echecRetrait) return F.contratLife({ ok: false, erreur: 'écriture impossible : rien n\'a été retiré' });
      S.feuille.forEach(l => { if (d.ids.includes(l.id)) l.statut = 'retire'; });
      S.ajouter(F.ligneRetrait(d.ids, S.heure(), Date.now() + (S.n++)));
      return F.contratLife({ ok: true, retires: d.ids.length });
    }
    const avant = S.feuille.map(l => Object.assign({}, l));
    const deja = F.dejaTraite(avant, d); if (deja) return deja;
    S.traitements++;
    const lignes = F.lignesEchangeLife(d, { reponse: 'Réponse (' + d.fil + ') : ' + d.texte.slice(0, 30), statut: 'SUCCÈS' }, S.heure(), Date.now() + (S.n++));
    lignes.forEach(l => S.ajouter(l));
    return F.reponseEnvoi(avant, d, lignes, 'SUCCÈS');
  };
  S.reponseAncienne = corps => {   // l'ancien serveur, tel qu'il était avant le 13/10
    const t = v => v === undefined || v === null ? '' : String(v).trim();
    const action = t(corps.action); let fil = t(corps.fil).toLowerCase() || 'general';
    if (!S.filsAnciens.includes(fil)) fil = 'general';
    if (action === 'fil') {
      const depuis = t(corps.depuis).slice(0, 19);
      const l = S.feuille.filter(m => t(m.id) && t(m.texte) && t(m.statut) !== 'retire' && t(m.statut) !== 'retrait' && (!depuis || t(m.horodatage) > depuis))
        .sort((a, b) => t(a.horodatage) < t(b.horodatage) ? -1 : 1).slice(-80);
      return { ok: true, messages: l.map(m => ({ id: m.id, t: m.horodatage, auteur: m.auteur, fil: m.fil, texte: m.texte, source: m.source })) };
    }
    if (action === 'retirer') { S.feuille.forEach(l => { if ((corps.ids || []).includes(l.id)) l.statut = 'retire'; }); return { ok: true, retires: (corps.ids || []).length }; }
    if (action !== 'envoyer') return { ok: false, erreur: 'action inconnue' };
    S.traitements++;
    const texte = t(corps.texte).slice(0, 2000), ms = Date.now() + (S.n++), h = S.heure();
    const l = [{ id: 'L-' + ms + '-a', horodatage: h, auteur: 'moi', fil, texte }, { id: 'L-' + ms + '-b', horodatage: h, auteur: 'life', fil, texte: 'Réponse (' + fil + ') : ' + texte.slice(0, 30) }];
    l.forEach(x => S.ajouter(x));
    return { ok: true, messages: l.map(m => ({ id: m.id, t: m.horodatage, auteur: m.auteur, fil: m.fil, texte: m.texte })), statut: 'SUCCÈS' };
  };
  return S;
}

// ---------- navigateur et pages ----------
export async function navigateur() {
  return chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
}
// Ouvre LIFE déjà connectée au faux serveur. o.init : clés life.* à poser avant le chargement ; o.sansConnexion ;
// o.chemin ; o.sw (service worker autorisé) ; o.avantChargement(ctx, page).
export async function ouvrir(nav, statique, profil, S, o = {}) {
  const { nom, ...options } = profil;
  const ctx = await nav.newContext({ ...options, serviceWorkers: o.sw ? 'allow' : 'block' });
  if (S) await ctx.route(/^https:\/\/[a-z0-9.-]*exemple\.cloud\//, S.gerer);
  await ctx.addInitScript(([init, sans]) => {
    if (sessionStorage.getItem('__essai')) return; sessionStorage.setItem('__essai', '1');
    if (!sans) { localStorage.setItem('life.adresse', JSON.stringify('https://essai.exemple.cloud/webhook/life')); localStorage.setItem('life.cle', JSON.stringify('cle-de-test-123456')); }
    localStorage.setItem('life.aideAppui', 'true');
    for (const k in init) localStorage.setItem('life.' + k, JSON.stringify(init[k]));
  }, [o.init || {}, !!o.sansConnexion]);
  const page = await ctx.newPage(); const erreurs = [], csp = [];
  page.on('pageerror', e => erreurs.push(String(e)));
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  if (o.avantChargement) await o.avantChargement(ctx, page);
  await page.goto(statique.base + (o.chemin || ''), { waitUntil: 'load' });
  await page.waitForTimeout(o.attente ?? 900);
  return { ctx, page, erreurs, csp };
}
export async function ecrire(page, texte) { await page.fill('#saisie', texte); await page.evaluate(() => document.getElementById('envoyer').click()); }
export async function choisirFil(page, nom) { await page.evaluate(n => [...document.querySelectorAll('#fils button')].find(b => b.querySelector('.nom').textContent === n).click(), nom); }
export const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem('life.' + k) || 'null'), k);
export const bulles = page => page.$$eval('#messages .bulle', l => l.map(x => ({ classe: x.className, texte: (x.firstChild && x.firstChild.textContent) || '' })));
export async function actualiser(page) { await page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('actualiser').click(); }); }
export const attendre = async (f, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pause(100); } return false; };

// ---------- mini-cadre de test ----------
export function suite() {
  const R = [];
  const verif = (ok, quoi, detail) => { R.push({ ok: !!ok, quoi, detail }); if (!ok) throw new Error(quoi + (detail !== undefined ? ' — obtenu : ' + JSON.stringify(detail).slice(0, 300) : '')); };
  return { R, verif };
}
