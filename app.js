// LIFE — le script de l'app (sorti de index.html le 13/10 : la règle de sécurité CSP n'accepte plus aucun script en ligne).
// Contrat avec le serveur, version 2 : un identifiant client (cid) par message (jamais traité deux fois), un curseur donné
// par le serveur (pagination, suppressions propagées), « version » et « fils » dans chaque réponse. Sans « version »
// (ancien serveur), l'app garde un mode compatible. Tests : tests/lancer.mjs (app téléphone et app ordinateur).
/* l'adresse du serveur n'est pas dans ce code public : elle est collée dans les Réglages, avec la clé, et reste sur l'appareil */
function adresse() { try { const v = JSON.parse(localStorage.getItem('life.adresse') || '""'); return /^https:\/\/[^\s]+$/.test(v) ? v : ''; } catch (e) { return ''; } }
// ---------- Sécurité (audit expert de sécurité du 13/10) ----------
// 1. Jamais dans le cadre d'un autre site (LO2) : seule Ma carte de vie (même site) peut montrer LIFE dans un cadre.
const DANS_CARTE = (() => { try { return window.top !== window && window.parent.location.pathname.indexOf('/carte-de-vie') === 0; } catch (e) { return false; } })();
if (window.top !== window && !DANS_CARTE) { document.body.textContent = 'LIFE ne s\'ouvre pas dans le cadre d\'un autre site.'; throw new Error('cadre refusé'); }
// 2. Seconde règle de sécurité (CSP), TOUJOURS posée au lancement, avant tout appel réseau (LC2 ; audit de sécurité du
//    13/10, R6). Les deux règles se cumulent : une connexion doit passer celle de la page ET celle-ci.
//    - appareil relié : seulement le serveur EXACT enregistré ici (même un autre serveur du même domaine est bloqué) ;
//    - appareil neuf : 'self' seulement, aucun serveur extérieur (avant le 13/10 : tout « *.cloud »).
//    La règle de la page (index.html) ne nomme jamais le serveur (dépôt public). Changer d'adresse, ou relier un appareil
//    neuf, recharge l'app : la nouvelle règle suit.
const HOTE_CSP = (() => { try { const h = new URL(adresse()).host; return /^[a-z0-9.-]+(:\d+)?$/i.test(h) ? h : ''; } catch (e) { return ''; } })();
{ const m = document.createElement('meta'); m.httpEquiv = 'Content-Security-Policy';
  m.content = "connect-src 'self'" + (HOTE_CSP ? ' https://' + HOTE_CSP : ''); document.head.appendChild(m); }
// 3. Trusted Types (CSP : require-trusted-types-for 'script') : le HTML n'entre dans la page que par cette politique, qui
//    refuse tout script, cadre ou attribut d'événement ; seuls qr.js et le service worker (sw.js) peuvent être chargés.
const POLITIQUE = (() => {
  const regle = { createHTML: x => { if (/<(script|iframe|object|embed|link|meta|base)\b|\son[a-z]+\s*=|javascript:/i.test(x)) throw new TypeError('HTML refusé'); return x; },
                  createScriptURL: u => { if (u !== 'qr.js' && u !== 'sw.js') throw new TypeError('script refusé'); return u; } };
  try { return window.trustedTypes && window.trustedTypes.createPolicy ? window.trustedTypes.createPolicy('life', regle) : regle; } catch (e) { return regle; }
})();
const html = (el, x) => { el.innerHTML = POLITIQUE.createHTML(x); };
const FILS = [['general', 'Général'], ['travail', 'Travail'], ['metamorphose', 'Projet'], ['patrimoine', 'Patrimoine'],
  ['quotidien', 'Quotidien'], ['voyage', 'Voyage'], ['experts', 'Experts'], ['comite', 'Comité'], ['brainstorm', 'Brainstorming'], ['coach', 'Coach']];
// Icônes au trait (couleur du texte), une par fil.
const ICONES = {
  general: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  travail: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
  metamorphose: '<path d="M12 21v-9"/><path d="M12 12c0-4 2.5-7 7-7 0 4.5-3 7-7 7z"/><path d="M12 15c0-3-2-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z"/>',
  patrimoine: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  quotidien: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  voyage: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4c1-1 3-1.5 3.5-1s0 2.5-1 3.5l-4 4 1 8L14.5 22 12 14.5l-3 3V20l-1.5 1.5-1-3-3-1L6 16h2.5z"/>',
  experts: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"/>',
  comite: '<path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6z"/>',
  brainstorm: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  coach: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
};
const svg = id => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[id] + '</svg>';
const $ = id => document.getElementById(id);
// Brief et Maintenance : des vues à part ; quand l'une est ouverte, aucun fil n'est marqué actif.
const enVueAPart = () => document.body.classList.contains('brief') || document.body.classList.contains('maintenance');
function majVues() {
  $('brief').setAttribute('aria-pressed', String(document.body.classList.contains('brief')));
  $('maintenance').setAttribute('aria-pressed', String(document.body.classList.contains('maintenance')));
}
function vue(nom) {   // 'brief', 'maintenance', ou null pour revenir à la conversation
  const avant = document.body.classList.contains('brief') ? 'brief' : document.body.classList.contains('maintenance') ? 'maintenance' : null;
  const focusDedans = avant && $('vue-' + avant).contains(document.activeElement);
  document.body.classList.toggle('brief', nom === 'brief'); document.body.classList.toggle('maintenance', nom === 'maintenance');
  majVues(); afficher();
  if (nom) { const r = $(nom === 'brief' ? 'vue-brief' : 'vue-maintenance').querySelector('.retour'); if (r) r.focus({ preventScroll: true }); }
  else if (focusDedans) $(avant).focus({ preventScroll: true });   // le focus revient au bouton qui avait ouvert la vue
}
// Boîtes de dialogue : le focus revient, à la fermeture, à ce qui les avait ouvertes (audit expert accessibilité LO2) ;
// si c'était une entrée du menu « Plus » (refermé entre-temps), au bouton « Plus ».
function ouvrirDialogue(d) {
  if (d.open) return;
  const o = document.activeElement; d._ouvreur = o && o !== document.body ? o : null;
  d.showModal();
}
['dlg', 'dlg-effacer', 'dlg-connexion'].forEach(id => $(id).addEventListener('close', () => {
  const o = $(id)._ouvreur; $(id)._ouvreur = null;
  if (document.querySelector('dialog[open]')) return;
  const cible = o && o.isConnected && o.offsetParent ? o : (o && o.closest && o.closest('#menu') ? $('plus') : null);
  if (cible) cible.focus({ preventScroll: true });
}));
function boutonRetour() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'retour';
  html(b, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg><span>Conversation</span>');
  b.onclick = () => vue(null); return b;
}
const DEMO = location.search.includes('demo');
// Stockage de l'appareil (partagé avec les autres apps du même site) : une écriture ratée (stockage plein) est signalée,
// jamais ignorée en silence. ecrire() rend false en cas d'échec.
let alerteStockage = 0, dernierEchec = null;
// Copie protégée : on demande au navigateur de ne pas effacer LIFE de lui-même quand l'appareil manque de place
// (navigator.storage.persist, audit expert X2). Demandé une fois connectée, puis au plus une fois par semaine si refusé.
let persistant = null;
async function demanderPersistance() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    if (await navigator.storage.persisted()) { persistant = true; return; }
    if (Date.now() - store.lire('persistDemande', 0) < 7 * 864e5) { persistant = false; return; }
    store.ecrire('persistDemande', Date.now());
    persistant = await navigator.storage.persist();
  } catch (e) { persistant = false; }
}
function placeLife() {   // caractères gardés par LIFE dans le stockage de l'appareil
  let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('life.')) n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* */ }
  return n;
}
function decrireAppareil() {
  const ko = Math.round(placeLife() * 2 / 1024);   // 2 octets par caractère
  let t = 'LIFE garde ' + ko + ' Ko sur cet appareil (plafond : environ 1 Mo, le reste du stockage est pour Ma carte de vie). '
    + 'Copie protégée contre l\'effacement automatique : ' + (persistant === true ? 'oui.' : persistant === false ? 'non (le navigateur décide ; installer LIFE aide).' : 'inconnu.');
  if (dernierEchec) t += ' Dernier enregistrement raté à ' + new Date(dernierEchec.t).toTimeString().slice(0, 5) + ' : ' + dernierEchec.quoi + '.';
  $('stockage').textContent = t;
}
const store = {
  lire(k, d) { try { const v = localStorage.getItem('life.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  ecrire(k, v, silence) {
    try { localStorage.setItem('life.' + k, JSON.stringify(v)); return true; }
    catch (e) { if (!silence) stockagePlein(k === 'messages' ? 'les derniers messages ne sont pas gardés hors ligne sur cet appareil' : 'un réglage n\'a pas pu être enregistré'); return false; }
  },
  effacer(k) { try { localStorage.removeItem('life.' + k); } catch (e) { /* stockage indisponible */ } }
};
function stockagePlein(quoi) {
  dernierEchec = { t: Date.now(), quoi };   // gardé pour Réglages → « Cet appareil »
  if (Date.now() - alerteStockage < 60e3) return;   // une fois par minute au plus
  alerteStockage = Date.now();
  setTimeout(() => erreur('Stockage de l\'appareil plein : ' + quoi + '.', null, 10000), 0);
}
// PLACE PRISE PAR LIFE sur l'appareil (audit expert fiabilité CC-6 / LC-6) : le stockage du navigateur est commun à
// LIFE et à Ma carte de vie (même site, environ 5 millions de caractères en tout). LIFE se borne pour ne jamais priver la
// carte de place :
//   messages : 300 au plus par fil, 150 000 caractères au plus par fil, 500 000 caractères en tout (≈ 1 Mo, soit
//   environ 10 % du quota) ; les 5 derniers messages de chaque fil sont toujours gardés (et les envois pas encore partis) ;
//   suppressions et retraits en attente : 1 500 identifiants chacun au plus ; réglages : quelques centaines d'octets.
// Le serveur garde tout : ce qui sort de l'appareil n'est jamais perdu. Réglages → « Cet appareil » montre la place prise.
const PAR_FIL = 300, PAR_FIL_SERRE = 80, CAR_FIL = 150000, CAR_TOTAL = 500000, MIN_PAR_FIL = 5, MAX_IDS = 1500;
const poids = m => String(m.texte || '').length + 120;   // texte, plus identifiant, heure et champs
function borner(l, max) {
  const n = {}, c = {}, ferme = {}, r = []; let total = 0, plein = false;
  for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i], f = m.fil || 'general', t = poids(m); n[f] = (n[f] || 0) + 1;
    if (!(m.temp || m.echec || n[f] <= MIN_PAR_FIL)) {
      if (ferme[f] || plein) continue;
      if (n[f] > max || (c[f] || 0) + t > CAR_FIL) { ferme[f] = true; continue; }   // le reste de ce fil, plus ancien, reste au serveur
      if (total + t > CAR_TOTAL) { plein = true; continue; }
    }
    r.push(m); c[f] = (c[f] || 0) + t; total += t;
  }
  return r.reverse();
}
function garderMessages() {   // stockage plein : on garde moins d'historique hors ligne (le serveur a tout), et on le dit
  if (DEMO) return true;
  if (store.ecrire('messages', messages, true)) return true;
  const ok = store.ecrire('messages', borner(messages, PAR_FIL_SERRE), true);
  stockagePlein(ok ? 'seuls les ' + PAR_FIL_SERRE + ' derniers messages de chaque fil restent lisibles hors ligne' : 'les derniers messages ne sont pas gardés hors ligne sur cet appareil');
  return ok;
}
let fil = store.lire('fil', 'general');
let messages = borner(store.lire('messages', []), PAR_FIL);   // copie locale : l'app s'ouvre tout de suite, même hors ligne
// Un envoi interrompu (app fermée pendant l'attente) : la bulle revient en « Non envoyé · Réessayer », jamais perdue.
messages.forEach(m => { if (m.temp) { m.temp = false; m.echec = true; } });
let vus = store.lire('vus', {});              // fil → horodatage du dernier message lu
// Nouveaux messages d'un fil : ceux de LIFE ou du système arrivés après la dernière visite du fil.
function marquerLu(id) {
  for (let i = messages.length - 1; i >= 0; i--) if ((messages[i].fil || 'general') === id) {
    if (vus[id] !== messages[i].t) { vus[id] = messages[i].t; store.ecrire('vus', vus); }
    return;
  }
}
let pastille = -1;
function pastilleAppli(c) {   // le petit numéro sur l'icône de l'app (Android, app installée) ; c : non-lus par fil
  const total = FILS.reduce((n, [id]) => n + (id === fil && document.visibilityState === 'visible' ? 0 : (c[id] || 0)), 0);
  if (total === pastille) return; pastille = total;
  try { if (navigator.setAppBadge) total ? navigator.setAppBadge(total) : navigator.clearAppBadge(); } catch (e) { /* non pris en charge */ }
}

// Message d'état : bandeau au-dessus de la saisie, lu par les lecteurs d'écran (role="status"), qui s'efface seul.
// action = [libellé, fonction] : un bouton dans le bandeau (« Annuler », « Réessayer »).
// Erreur (erreur()) : affichée au moins 8 s (audit UX du 13/10). Tant que le doigt, la souris ou le focus est sur le bandeau,
// il ne s'efface pas (sauf « Annuler » d'une suppression, qui suit son propre délai).
let minuterieBandeau = null, dureeBandeau = 4000;
function bandeau(texte, action, duree, important) {   // important : une actualisation réussie ne l'efface pas
  const z = $('bandeau'); clearTimeout(minuterieBandeau); z.textContent = ''; z.dataset.important = important ? '1' : '';
  if (!texte) { z.hidden = true; return; }
  const s = document.createElement('span'); s.textContent = texte; z.appendChild(s);
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action[0];
    b.onclick = e => { e.stopPropagation(); clearTimeout(minuterieBandeau); z.hidden = true; action[1](); }; z.appendChild(b); }
  z.hidden = false; dureeBandeau = duree || 4000;
  minuterieBandeau = setTimeout(() => { z.hidden = true; }, dureeBandeau);
}
const erreur = (texte, action, duree) => bandeau(texte, action, Math.max(duree || 0, 8000), true);
(() => { const z = $('bandeau');
  const tenir = () => { if (!annulable) clearTimeout(minuterieBandeau); };
  const relacher = () => { if (annulable || z.hidden || z.matches(':hover') || z.contains(document.activeElement)) return;
    clearTimeout(minuterieBandeau); minuterieBandeau = setTimeout(() => { z.hidden = true; }, Math.max(3000, dureeBandeau / 2)); };
  z.addEventListener('pointerenter', tenir); z.addEventListener('focusin', tenir);
  z.addEventListener('pointerleave', relacher); z.addEventListener('focusout', () => setTimeout(relacher, 0)); })();
function etat(t) { const z = $('bandeau'); if (t) bandeau(t); else if (!z.querySelector('button') && !(z.dataset.important && !z.hidden)) bandeau(''); }   // sans texte : efface, sauf un « Annuler » en cours
function ouvrirReglages() {
  decrireAppareil();
  // premier lancement (audit UX du 13/10) : une seule page, « Bienvenue », le chemin court d'abord (code montré par un appareil
  // déjà relié) ; la saisie à la main reste à un toucher (« Saisir l'adresse et la clé à la main »)
  const premier = !(cle() && adresse());
  $('accueil').hidden = !premier; $('dlg').classList.toggle('premier', premier); $('dlg').classList.remove('main'); $('a-la-main').hidden = false;
  $('dlg-titre').textContent = premier ? 'Bienvenue dans LIFE' : 'Clé et connexion';
  $('cle').value = cle(); $('cle-life').value = store.lire('cleLife', ''); $('adresse').value = adresse();
  ouvrirDialogue($('dlg'));
}
// Clé du lien : sans clé enregistrée ici, LIFE reprend celle de Ma carte de vie (même site, même stockage).
// Clé du lien (celle des experts). Depuis la V.0.0.35, LIFE ne lit plus la clé de Ma carte de vie à chaque appel
// (audit de sécurité CC3) : un appareil déjà relié qui s'en servait la recopie une seule fois, puis plus jamais.
function cle() { return store.lire('cle', ''); }
(function recopierCleCarteUneFois() {
  if (store.lire('cle', '') || !adresse()) return;
  try { const c = (localStorage.getItem('carte-de-vie-lien') || '').trim(); if (c) store.ecrire('cle', c); } catch (e) { /* stockage indisponible */ }
})();
// Clé propre à LIFE (facultative, réglage séparé) : si elle existe, le serveur de LIFE la reçoit à la place de la clé du
// lien ; le circuit des experts (lien de l'app) garde la clé du lien. Sans elle : comportement d'avant.
function cleLife() { return store.lire('cleLife', '') || cle(); }
// L'adresse vient-elle d'un lien de connexion (et non d'une saisie dans les Réglages) ? Alors un refus de clé ne doit
// surtout pas inviter à coller la vraie clé : ce serveur n'est peut-être pas le bon.
const adresseDuLien = () => !!store.lire('adresseDuLien', false);

// Délai d'attente : 60 s (audit expert de fiabilité, LC-1 : 20 s coupait des réponses normales) ; 90 s pour les fils où
// l'IA réfléchit longtemps (Comité, Brainstorming, Experts).
const DELAI = 60e3, DELAI_LONG = 90e3, TEXTE_MAX = 2000;
// Après un délai dépassé, pendant GARDE_REESSAI (à compter du premier envoi), « Réessayer » commence par une relève :
// le serveur a peut-être déjà le message (version 3 : il l'écrit avant l'IA). Avec le serveur version 2, qui n'écrit
// qu'après l'IA, on ne renvoie pas tant que ce délai court : le message n'est jamais traité deux fois.
const GARDE_REESSAI = 150e3;
const delaiPour = f => ['comite', 'brainstorm', 'experts'].includes(f) ? DELAI_LONG : DELAI;
// Contrat avec le serveur : un serveur à jour annonce sa version et ses fils dans chaque réponse.
// Sans « version » (ancien serveur), l'app garde un mode compatible (filsForces, « depuis »).
let versionServeur = store.lire('versionServeur', 0);
const serveurAJour = () => versionServeur >= 2;
// Envois dont le serveur a la demande mais pas encore la réponse (version 3 : « en_cours », ou délai dépassé) :
// cid → { fil, t }. LIFE « écrit » dans ce fil, et l'app relit le fil quelques fois jusqu'à la réponse.
let enCours = store.lire('enCours', {});
let experts = store.lire('experts', []);   // identifiants des experts connus, donnés par le serveur (jamais dans ce code)
function noterExperts(j) { if (j && Array.isArray(j.experts)) { experts = j.experts.map(String).filter(x => /^[a-z0-9_]{2,40}$/.test(x)); store.ecrire('experts', experts); } }
function noterContrat(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return;
  const v = Number(j.version) || 0;
  if (v !== versionServeur) { versionServeur = v; store.ecrire('versionServeur', v); }
  if (serveurAJour() && Object.keys(filsForces).length) { filsForces = {}; store.effacer('filsForces'); }   // plus utile : purgée
  if (v && !!j.transfert !== store.lire('transfert', false)) store.ecrire('transfert', !!j.transfert);   // code à usage unique possible
  noterExperts(j);
}
// Clé propre à LIFE, bascule SANS COUPURE (audit de sécurité LC1) : tant que le serveur ne l'a jamais acceptée, un refus
// fait reprendre la clé du lien (serveur pas encore passé à sa propre clé). Dès qu'il l'a acceptée une fois, la clé du
// lien n'est plus jamais envoyée au serveur de LIFE (life.cleLifeServeur).
async function appel(corps, o = {}) {
  const propre = !o.url && store.lire('cleLife', ''), k = o.url ? cle() : (propre || cle());
  if (!k || !adresse()) { ouvrirReglages(); throw new Error('clé ou adresse manquante'); }
  const ac = new AbortController(), minuterie = setTimeout(() => ac.abort(), o.delai || DELAI);
  const poster = c => fetch(o.url || adresse(), { method: 'POST', headers: { 'content-type': 'application/json', 'x-cle-app': c },
                                                 body: JSON.stringify(corps), signal: ac.signal });
  try {
    let r;
    try {
      r = await poster(k);
      if (propre && (r.status === 403 || r.status === 401) && !store.lire('cleLifeServeur', false) && cle() && cle() !== propre) r = await poster(cle());
      else if (propre && r.ok && !store.lire('cleLifeServeur', false)) store.ecrire('cleLifeServeur', true);
    } catch (e) { if (ac.signal.aborted) throw new Error('délai dépassé'); throw e; }
    if (r.status === 403 || r.status === 401) throw new Error('clé refusée');
    const j = await r.json().catch(() => ({}));
    if (ac.signal.aborted) throw new Error('délai dépassé');
    if (o.contrat !== false) noterContrat(j); else noterExperts(j);
    if (o.brut) return { r, j };
    if (!r.ok || j.ok === false) { const e = new Error(j.erreur || ('erreur ' + r.status)); e.reponse = j; throw e; }
    return j;
  } finally { clearTimeout(minuterie); }
}
const nouvelId = () => { let x = ''; const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  try { crypto.getRandomValues(new Uint8Array(14)).forEach(v => { x += c[v % 36]; }); } catch (e) { while (x.length < 14) x += c[Math.floor(Math.random() * 36)]; }
  return x; };
const duServeur = m => m && !m.local && !m.temp && !m.echec && !/^(tmp|loc)-/.test(m.id || '');
const cidDe = id => (/^L-([a-z0-9]{6,32})-[ab]$/i.exec(id || '') || [])[1] || '';

// Fusion des messages reçus : chaque bulle provisoire ou locale n'est retirée que si le serveur renvoie SON message
// (même cid ; avec un ancien serveur, même fil et même texte). Les autres envois en cours ne sont jamais touchés.
let enCoursChange = false;
function fusionner(nouveaux, retires) {
  const parId = new Map(messages.map(m => [m.id, m]));
  const partis = new Set((retires || []).map(String));   // suppressions faites sur un autre appareil
  partis.forEach(id => parId.delete(id));
  if (partis.size) Object.keys(epingles).forEach(f => { epingles[f] = (epingles[f] || []).filter(i => !partis.has(i)); });
  const cids = new Set(), textes = new Set(), arrives = [];
  (nouveaux || []).forEach(m => {
    if (!m || !m.id || supprimes.has(m.id) || partis.has(m.id)) return;
    if (!serveurAJour() && filsForces[m.id]) m.fil = filsForces[m.id];
    if (!parId.has(m.id)) arrives.push(m);
    parId.set(m.id, m);
    const c = cidDe(m.id); if (c) cids.add(c);
    if (c && /-b$/.test(m.id) && enCours[c]) { delete enCours[c]; enCoursChange = true; }   // la réponse est arrivée
    if (m.auteur === 'moi') textes.add((m.fil || 'general') + '|' + m.texte);
  });
  [...parId.values()].forEach(m => {
    if (duServeur(m) || m.expert) return;
    if (m.cid && cids.has(m.cid)) parId.delete(m.id);
    else if (m.local && textes.has((m.fil || 'general') + '|' + String(m.texte || '').slice(0, TEXTE_MAX))) parId.delete(m.id);
  });
  messages = borner([...parId.values()].sort(ordre), PAR_FIL);
  garderMessages();
  if (partis.size) store.ecrire('epingles', epingles);
  if (enCoursChange) { enCoursChange = false; store.ecrire('enCours', enCours); }
  if (arrives.length) annoncer(arrives);
}
// Le serveur a la demande, pas encore la réponse : LIFE « écrit » dans ce fil, et l'app relit le fil à 20, 40, 60 puis
// 120 s (4 exécutions au plus), jusqu'à la réponse. Au-delà de 10 minutes, on n'attend plus.
const RELEVES_EN_COURS = [20e3, 40e3, 60e3, 120e3];
let releveEnCours = null;
function attendreReponse(cid, filCible) {
  if (cid) { enCours[cid] = { fil: filCible, t: Date.now() }; store.ecrire('enCours', enCours); }
  clearTimeout(releveEnCours);
  const suivante = k => {
    Object.keys(enCours).forEach(c => { if (Date.now() - (enCours[c].t || 0) > 600e3) delete enCours[c]; });
    if (!Object.keys(enCours).length || k >= RELEVES_EN_COURS.length || DEMO) return;
    releveEnCours = setTimeout(() => { actualiser().then(() => { afficher(); suivante(k + 1); }); }, RELEVES_EN_COURS[k]);
  };
  suivante(0);
}
const enCoursDans = f => Object.keys(enCours).some(c => enCours[c].fil === f && Date.now() - (enCours[c].t || 0) < 600e3);
function ordre(a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : (a.id < b.id ? -1 : 1); }

function heure(t) { return (t || '').slice(11, 16); }
function jourLisible(t) {
  const d = new Date((t || '').replace(' ', 'T'));
  if (isNaN(d)) return '';
  const auj = new Date(), hier = new Date(Date.now() - 864e5);
  if (d.toDateString() === auj.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === hier.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const AVATAR = '<svg viewBox="79 79 354 354" fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round" aria-hidden="true"><path d="M256 96v86M256 330v86M96 256h86M330 256h86M143 143l54 54M315 315l54 54M143 369l54-54M315 197l54-54"/></svg>';   // l'étincelle, exactement celle de l'icône de l'app (charte, D10)
const SVGC = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICONES_CARTE = {
  '☀️': SVGC('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  '💼': SVGC('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>'),
  '📚': SVGC('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h6"/>'),
  '🛠': SVGC('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
  '🧭': SVGC('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  '🏠': SVGC('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>'),
  '⚠️': SVGC('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>')
};
const SIGNES = { '⭐': '★', '🌟': '★', '✅': '✓', '✔️': '✓', '☑️': '✓', '❌': '✕', '⚠️': '⚠\ufe0e', '⚠': '⚠\ufe0e', '➡️': '→', '👉': '→', '📌': '•', '❗': '!', '❓': '?' };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}]\uFE0F?|\uFE0F|\u200D/gu;
const GARDES = new Set(['★', '✓', '✕', '✎', '☾', '✦', '✧', '◆', '♥', '♡', '☆', '✳', '✱', '⚠']);
function sobre(t) {
  let x = String(t || ''); Object.keys(SIGNES).forEach(k => { x = x.split(k).join(SIGNES[k]); });
  return x.replace(EMOJI, c => GARDES.has(c.replace(/\uFE0F/g, '')) ? c.replace(/\uFE0F/g, '') + '\ufe0e' : '').replace(/\uFE0E+/g, '\uFE0E').replace(/[ \t]{2,}/g, ' ');
}
function remplirCarte(b, texte) {   // 1re ligne = titre, lignes « ━━ » = sections (texte brut, jamais du HTML)
  String(texte).split('\n').forEach((l, i) => {
    if (i === 0) {
      const t = document.createElement('span'); t.className = 'titre';
      const e = Object.keys(ICONES_CARTE).find(k => l.startsWith(k));
      if (e) { html(t, ICONES_CARTE[e]); t.appendChild(document.createTextNode(sobre(l.slice(e.length).trim()))); }
      else t.textContent = sobre(l);
      b.appendChild(t); return;
    }
    if (/^━━/.test(l)) { const t = document.createElement('span'); t.className = 'section'; t.textContent = sobre(l.replace(/^━━\s*/, '')); b.appendChild(t); return; }
    if (l.trim()) b.appendChild(document.createTextNode(sobre(l) + '\n'));
  });
}
function carteSysteme(m) {
  const b = document.createElement('div'); b.className = 'bulle systeme'; remplirCarte(b, m.texte);
  const h = document.createElement('span'); h.className = 'heure'; h.textContent = jourLisible(m.t) + ' · ' + heure(m.t); b.appendChild(h);
  return b;
}
let epingles = store.lire('epingles', {});
// Suppression manuelle (appui long → Supprimer, ou ••• → Effacer ce fil) : retirée de l'appareil tout de suite, puis du serveur.
let supprimes = new Set(store.lire('supprimes', []));
// Ancien serveur seulement (sans « version ») : id du message → fil où l'échange a eu lieu. Table bornée ; purgée dès
// que le serveur est à jour (il refuse alors un fil inconnu au lieu de le ranger dans Général).
let filsForces = serveurAJour() ? {} : store.lire('filsForces', {});
if (serveurAJour()) store.effacer('filsForces');
// La suppression est d'abord locale et annulable (5 s pour un message, 10 s pour un fil entier : bandeau « Annuler ») ;
// le serveur n'est prévenu qu'après.
let aRetirer = store.lire('aRetirer', []);   // suppressions confirmées, pas encore reçues par le serveur
let annulable = null;                        // { ids, avant, minuterie } : la dernière suppression, encore annulable
function supprimer(ids, libelle, duree) {
  ids = ids.filter(Boolean); if (!ids.length) return;
  confirmerSuppression();   // une suppression précédente encore en attente part tout de suite
  const avant = { messages: messages.filter(m => ids.includes(m.id)), epingles: JSON.parse(JSON.stringify(epingles)) };
  ids.forEach(i => supprimes.add(i)); store.ecrire('supprimes', [...supprimes].slice(-MAX_IDS));
  messages = messages.filter(m => !supprimes.has(m.id)); garderMessages();
  Object.keys(epingles).forEach(f => { epingles[f] = (epingles[f] || []).filter(i => !supprimes.has(i)); }); store.ecrire('epingles', epingles);
  afficher();
  annulable = { ids, avant, minuterie: setTimeout(confirmerSuppression, duree || 5000) };
  bandeau(libelle || 'Message supprimé', ['Annuler', annulerSuppression], duree || 5000);
}
function confirmerSuppression() {
  if (!annulable) return;
  const { ids, minuterie } = annulable; clearTimeout(minuterie); annulable = null;
  const serveur = ids.filter(i => !/^(tmp|loc)-/.test(i));
  if (!serveur.length) return;
  aRetirer = [...new Set(aRetirer.concat(serveur))].slice(-MAX_IDS); store.ecrire('aRetirer', aRetirer);
  retirerServeur();
}
// Par lots de 400 (la limite du serveur) ; un lot n'est oublié qu'après un ok du serveur (ok:false si son écriture
// échoue) ; sinon on réessaie au prochain lancement.
let retraitEnCours = false;
async function retirerServeur() {
  if (DEMO || retraitEnCours || !aRetirer.length || !cle() || !adresse()) return;
  retraitEnCours = true;
  try {
    while (aRetirer.length) {
      const ids = aRetirer.slice(0, 400);
      await appel({ action: 'retirer', ids });
      aRetirer = aRetirer.filter(i => !ids.includes(i)); store.ecrire('aRetirer', aRetirer);
    }
  } catch (e) { /* gardé pour plus tard */ } finally { retraitEnCours = false; }
}
function annulerSuppression() {
  if (!annulable) return;
  const { ids, avant, minuterie } = annulable; clearTimeout(minuterie); annulable = null;
  ids.forEach(i => supprimes.delete(i)); store.ecrire('supprimes', [...supprimes].slice(-MAX_IDS));
  messages = messages.filter(m => !ids.includes(m.id)).concat(avant.messages).sort(ordre); garderMessages();
  epingles = avant.epingles; store.ecrire('epingles', epingles);
  afficher(); bandeau('Rétabli', null, 3000);
}
// ---------- Feuille d'actions d'un message (appui long, clic droit, ou clavier : Entrée, Maj+F10, touche Menu) ----------
// Un vrai menu (role="menu") : flèches haut / bas, Début / Fin, Échap ferme et rend le focus au message.
let feuilleOuverte = null;   // { f, b } : la feuille et la bulle d'où elle vient
function fermerFeuilles(rendreFocus) {
  const o = feuilleOuverte; feuilleOuverte = null;
  document.querySelectorAll('.feuille-msg').forEach(x => x.remove());
  document.querySelectorAll('#flux .ouverte').forEach(x => x.classList.remove('ouverte'));
  if (o && rendreFocus && o.b.isConnected) o.b.focus({ preventScroll: true });
}
function naviguerMenu(e, items, fermer) {   // flèches dans un menu (WAI-ARIA « menu »)
  const i = items.indexOf(document.activeElement);
  let j = null;
  if (e.key === 'ArrowDown') j = (i + 1) % items.length;
  else if (e.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = items.length - 1;
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(true); return; }
  else if (e.key === 'Tab') { fermer(false); return; }
  if (j !== null) { e.preventDefault(); items[j].focus(); }
}
function actionsMessage(m, b) {
  fermerFeuilles();
  if (!store.lire('aideAppui', false)) { store.ecrire('aideAppui', true); const a = document.querySelector('#flux .aide'); if (a) a.remove(); }
  const f = document.createElement('div'); f.className = 'feuille-msg'; f.setAttribute('role', 'menu');
  f.setAttribute('aria-label', 'Actions sur ce message');
  const bt = (t, fn) => { const x = document.createElement('button'); x.type = 'button'; x.setAttribute('role', 'menuitem'); x.tabIndex = -1; x.textContent = t;
    x.onclick = e => { e.stopPropagation(); fermerFeuilles(true); fn(); }; f.appendChild(x); };
  const ep = (epingles[m.fil || 'general'] || []).includes(m.id);
  bt(ep ? 'Désépingler' : 'Épingler', () => epingler(m));
  bt('Copier', () => { try { navigator.clipboard.writeText(m.texte || '').then(() => bandeau('Copié', null, 2500), () => {}); } catch (e) { /* refusé */ } });
  bt('Supprimer', () => supprimer([m.id], 'Message supprimé'));
  f.addEventListener('keydown', e => naviguerMenu(e, [...f.querySelectorAll('button')], fermerFeuilles));
  f.addEventListener('pointerdown', e => e.stopPropagation());
  b.appendChild(f); feuilleOuverte = { f, b };
  b.classList.add('ouverte'); if (b.parentNode.classList.contains('ligne-life')) b.parentNode.classList.add('ouverte');
  f.querySelector('button').focus({ preventScroll: true });
  setTimeout(() => document.addEventListener('click', () => { if (feuilleOuverte && feuilleOuverte.f === f) fermerFeuilles(); }, { once: true }), 0);
}
function epingler(m) {   // fil → [id], 3 au plus
  const f = m.fil || 'general', l = epingles[f] || [];
  epingles[f] = l.includes(m.id) ? l.filter(x => x !== m.id) : [m.id].concat(l).slice(0, 3);
  store.ecrire('epingles', epingles);
  try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) { /* pas de vibreur */ }
  afficher();
}
let sigEpingles = '';
function afficherEpingles() {
  const z = $('epingles');
  const l = enVueAPart() ? [] : (epingles[fil] || []).map(id => messages.find(m => m.id === id)).filter(Boolean);
  const sig = l.map(m => m.id + '\u0001' + m.texte).join('\u0002');
  if (sig === sigEpingles) return;
  sigEpingles = sig; z.textContent = '';
  l.forEach(m => {
    const d = document.createElement('div'); d.className = 'epingle';
    html(d, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 5 3 3H7l3-3zM12 15v5"/></svg><span></span><button type="button" aria-label="Désépingler"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>');
    d.querySelector('span').textContent = sobre(m.texte.split('\n')[0]);
    d.querySelector('button').onclick = () => epingler(m);
    z.appendChild(d);
  });
}

// ---------- Rendu incrémental (audit expert performance LT1) ----------
// Avant : toute la barre des fils, les deux vues et TOUTES les bulles (4 écouteurs chacune) étaient reconstruites à chaque
// action. Maintenant : les tuiles sont créées une fois et seulement mises à jour ; les bulles sont gardées par
// identifiant et ne sont refaites que si elles changent ; seules les FENETRE dernières bulles du fil sont dans la page
// (« Messages plus anciens » en ajoute autant) ; un seul écouteur, délégué, pour toute la conversation.
const FENETRE = 40, FENETRE_CAR = 12000;   // 40 bulles au plus, et environ 12 000 caractères (au moins 8 bulles)
const fenetre = {};            // fil → nombre de bulles affichées (fixé au premier affichage du fil, puis « plus anciens »)
const rendus = new Map();      // clé → { el, sig }
let filAffiche = null, focusFil = null;
const estBrief = m => m.auteur === 'systeme' && /^☀️/.test(m.texte || '');
// Nom affiché sur la tuile du téléphone quand le nom complet ne tient pas à 11 px (le nom complet reste celui lu à voix haute).
const NOM_COURT = {};
const nomFil = id => (FILS.find(f => f[0] === id) || ['', id === 'systeme' ? 'Maintenance' : 'Général'])[1];
function comptesNonLus() {   // une seule passe sur les messages (avant : une par fil)
  const c = {};
  for (const m of messages) { const f = m.fil || 'general';
    if (m.auteur !== 'moi' && !m.temp && m.t > (vus[f] || '') && !estBrief(m)) c[f] = (c[f] || 0) + 1; }
  return c;
}
function heureParlee(t) { const h = heure(t); return h ? h.replace(':', ' h ') : ''; }
function auteurLisible(m) { return m.auteur === 'moi' ? 'Toi' : m.auteur === 'systeme' ? 'Information' : 'LIFE'; }
function creerBulle(m, finDeGroupe) {
  const b = document.createElement('div');
  b.className = 'bulle ' + (m.auteur === 'moi' ? 'moi' : m.auteur === 'systeme' ? 'systeme info' : 'life') + (m.temp ? ' attente' : '') + (m.echec ? ' echec' : '');
  if (m.auteur === 'systeme') { remplirCarte(b, m.texte); b.dataset.etiquette = 'Info · ' + nomFil(m.fil || 'general'); }
  else b.textContent = m.auteur === 'moi' ? m.texte : sobre(m.texte);   // texte brut : jamais interprété comme du HTML
  // au clavier : chaque message est un « article » atteignable (flèches), avec ses actions (Entrée, Maj+F10, touche Menu)
  b.dataset.id = m.id; b.tabIndex = -1; b.setAttribute('role', 'article');
  b.setAttribute('aria-label', auteurLisible(m) + (m.temp ? ', envoi en cours' : m.echec ? (m.delai ? ', pas encore de réponse' : ', non envoyé') : (heure(m.t) ? ', ' + heureParlee(m.t) : '')));
  if (m.echec) {   // envoi raté : la bulle le dit, et se renvoie d'un toucher. Délai dépassé : le serveur a peut-être le message,
    // « Vérifier » relève d'abord (rien n'est renvoyé s'il est arrivé) ; sinon « Non envoyé · Réessayer ».
    const r = document.createElement('button'); r.type = 'button'; r.className = 'reessayer'; r.dataset.action = 'reessayer';
    r.textContent = m.delai ? 'Pas encore de réponse · Vérifier' : 'Non envoyé · Réessayer';
    b.appendChild(r);
  } else if (m.temp || finDeGroupe) {   // l'heure une fois par groupe de messages rapprochés
    const h = document.createElement('span'); h.className = 'heure'; h.textContent = m.temp ? 'envoi…' : heure(m.t); b.appendChild(h);
  }
  if (m.auteur !== 'life') return b;
  const l = document.createElement('div'); l.className = 'ligne-life';   // avatar de LIFE, une fois par groupe
  const a = document.createElement('span'); a.className = 'avatar' + (finDeGroupe ? '' : ' vide'); a.setAttribute('aria-hidden', 'true'); html(a, AVATAR);
  l.appendChild(a); l.appendChild(b); return l;
}
function element(cle, sig, fabriquer) {   // élément gardé (clé), refait seulement si sa signature change
  const r = rendus.get(cle);
  if (r && r.sig === sig) return r.el;
  const el = fabriquer(); rendus.set(cle, { el, sig }); return el;
}
const unique = {};   // éléments uniques de la conversation : vide, aide, « écrit », plus anciens
function elementUnique(nom, fabriquer) { return unique[nom] || (unique[nom] = fabriquer()); }
const bulleDe = el => el && el.closest ? el.closest('#flux .bulle[data-id]') : null;
const messageDe = b => b && messages.find(m => m.id === b.dataset.id);
function afficherConversation() {
  if (!$('recherche').hidden && $('q').value.trim().length >= 2) return;   // résultats de recherche à l'écran
  const zone = $('messages'), flux = $('flux');
  const liste = messages.filter(m => (m.fil || 'general') === fil && !estBrief(m));
  const nouveauFil = filAffiche !== fil; filAffiche = fil;
  const enBas = nouveauFil || zone.scrollHeight - zone.scrollTop - zone.clientHeight < 120;
  const hautAvant = zone.scrollHeight - zone.scrollTop;
  if (!fenetre[fil]) { let n = 0, car = 0;
    while (n < liste.length && n < FENETRE && (n < 8 || car < FENETRE_CAR)) { car += (liste[liste.length - 1 - n].texte || '').length; n++; }
    fenetre[fil] = Math.max(n, 8); }
  const n = fenetre[fil], debut = Math.max(0, liste.length - n);
  const voulus = [];
  if (debut > 0) voulus.push(elementUnique('anciens', () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'anciens';
    b.textContent = 'Messages plus anciens'; b.onclick = () => plusAnciens(true); return b; }));
  if (!liste.length) voulus.push(elementUnique('vide', () => { const d = document.createElement('div'); d.className = 'vide';
    html(d, '<strong>Rien ici pour l\'instant</strong>Écris à LIFE : une question, une idée, une chose à ne pas oublier.'); return d; }));
  let dernierJour = debut > 0 ? jourLisible(liste[debut - 1].t) : '';
  for (let k = debut; k < liste.length; k++) {
    const m = liste[k], j = jourLisible(m.t), suivant = liste[k + 1];
    if (j && j !== dernierJour) { voulus.push(element('jour|' + fil + '|' + j + '|' + (m.t || '').slice(0, 10), j, () => {
      const s = document.createElement('div'); s.className = 'jour'; s.setAttribute('role', 'separator'); s.setAttribute('aria-label', j); s.textContent = j; return s; })); dernierJour = j; }
    const finDeGroupe = !suivant || suivant.auteur !== m.auteur || (suivant.t || '').slice(0, 15) !== (m.t || '').slice(0, 15);
    voulus.push(element('m|' + m.id, [m.texte, m.temp ? 1 : 0, m.echec ? (m.delai ? 2 : 1) : 0, finDeGroupe ? 1 : 0, m.t, m.auteur, m.fil].join('\u0001'), () => creerBulle(m, finDeGroupe)));
    if (!suivant && m.auteur === 'life' && /\?\s*$/.test(m.texte) && !envoisEnCours && !enCoursDans(fil))   // elle peut répondre d'un toucher
      voulus.push(element('rapides|' + m.id, '', () => { const r = document.createElement('div'); r.className = 'rapides'; r.setAttribute('role', 'group'); r.setAttribute('aria-label', 'Réponses rapides');
        ['Oui', 'Plus tard', 'Non merci'].forEach(t => { const x = document.createElement('button'); x.type = 'button'; x.dataset.rapide = t; x.textContent = t; r.appendChild(x); }); return r; }));
  }
  if (!store.lire('aideAppui', false)) voulus.push(elementUnique('aide', () => {   // indice discret, jusqu'à ce qu'il soit lu ou que le geste soit utilisé
    const a = document.createElement('div'); a.className = 'aide';
    const s = document.createElement('span');
    s.textContent = (matchMedia('(pointer: fine)').matches ? 'Clic droit (ou Entrée au clavier)' : 'Appui long') + ' sur un message : épingler, copier ou supprimer.';
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Compris';
    ok.onclick = () => { store.ecrire('aideAppui', true); a.remove(); };
    a.appendChild(s); a.appendChild(ok); return a; }));
  if (envoisEnCours || enCoursDans(fil)) { const e = elementUnique('ecrit', () => { const e = document.createElement('div'); e.className = 'ecrit';
      html(e, '<span class="points" aria-hidden="true"><i></i><i></i><i></i></span><span class="ecrit-txt"></span>'); return e; });
    const t = texteAttente(fil); if (e.lastChild.textContent !== t) e.lastChild.textContent = t;
    voulus.push(e); }
  // réconciliation : on ne touche qu'aux nœuds qui changent de place, apparaissent ou disparaissent
  const actif = document.activeElement, idActif = flux.contains(actif) && actif.dataset ? actif.dataset.id : null;
  let cur = flux.firstChild;
  for (const el of voulus) { if (el === cur) cur = cur.nextSibling; else flux.insertBefore(el, cur); }
  while (cur) { const nx = cur.nextSibling; flux.removeChild(cur); cur = nx; }
  if (rendus.size > messages.length + 200) { const vivants = new Set(messages.map(m => 'm|' + m.id));   // ménage du cache
    [...rendus.keys()].forEach(k => { if (k.startsWith('m|') && !vivants.has(k)) rendus.delete(k); }); }
  // un seul message dans l'ordre de tabulation (le dernier, ou celui qui avait le focus) ; les flèches parcourent les autres
  const bl = [...flux.querySelectorAll('.bulle[data-id]')];
  const garde = (idActif && bl.find(x => x.dataset.id === idActif)) || (focusFil === fil && bl.find(x => x.tabIndex === 0)) || bl[bl.length - 1];
  bl.forEach(x => { const t = x === garde ? 0 : -1; if (x.tabIndex !== t) x.tabIndex = t; });
  focusFil = fil;
  if (idActif && garde && document.activeElement !== garde && garde.dataset.id === idActif) garde.focus({ preventScroll: true });
  if (enBas) zone.scrollTop = zone.scrollHeight; else zone.scrollTop = zone.scrollHeight - hautAvant;
}
function plusAnciens(focus) {   // ajoute FENETRE bulles plus anciennes, sans faire sauter la lecture
  const zone = $('messages'), avant = zone.scrollHeight - zone.scrollTop;
  fenetre[fil] = (fenetre[fil] || FENETRE) + FENETRE; afficherConversation();
  zone.scrollTop = zone.scrollHeight - avant;
  if (focus) { const b = $('flux').querySelector('.bulle[data-id]'); if (b) { [...$('flux').querySelectorAll('.bulle[data-id]')].forEach(x => { x.tabIndex = x === b ? 0 : -1; }); b.focus(); } }
}
// Un seul écouteur pour toute la conversation (avant : 4 par bulle).
(function brancherConversation() {
  const flux = $('flux'); let appui = null, depart = null;
  const annuler = () => { clearTimeout(appui); appui = null; };
  flux.addEventListener('pointerdown', e => {
    const b = bulleDe(e.target); if (!b || e.target.closest('button')) return;
    depart = [e.clientX, e.clientY];
    appui = setTimeout(() => { try { if (navigator.vibrate) navigator.vibrate(15); } catch (x) { /* */ } const m = messageDe(b); if (m) actionsMessage(m, b); }, 550);   // appui long
  });
  flux.addEventListener('pointermove', e => { if (appui && depart && Math.hypot(e.clientX - depart[0], e.clientY - depart[1]) > 10) annuler(); });
  ['pointerup', 'pointercancel', 'pointerout'].forEach(ev => flux.addEventListener(ev, annuler));
  $('messages').addEventListener('scroll', annuler, { passive: true });
  flux.addEventListener('contextmenu', e => { const b = bulleDe(e.target), m = messageDe(b); if (!m) return; e.preventDefault(); actionsMessage(m, b); });
  flux.addEventListener('click', e => {
    const r = e.target.closest('[data-action="reessayer"]');
    if (r) { e.stopPropagation(); const m = messageDe(bulleDe(r)); if (m) reessayer(m); return; }
    const q = e.target.closest('[data-rapide]');
    if (q) { $('saisie').value = q.dataset.rapide; envoyer(); }
  });
  flux.addEventListener('focusin', e => { const b = e.target.classList && e.target.classList.contains('bulle') ? e.target : null;
    if (b) flux.querySelectorAll('.bulle[tabindex="0"]').forEach(x => { if (x !== b) x.tabIndex = -1; }), b.tabIndex = 0; });
  flux.addEventListener('keydown', e => {   // clavier : flèches, Début / Fin, Page préc. / suiv. ; Entrée, Maj+F10 ou Menu : actions
    const b = e.target.classList && e.target.classList.contains('bulle') ? e.target : null; if (!b) return;
    const bl = [...flux.querySelectorAll('.bulle[data-id]')], i = bl.indexOf(b);
    let j = null;
    if (e.key === 'ArrowDown') j = i + 1; else if (e.key === 'ArrowUp') j = i - 1;
    else if (e.key === 'PageDown') j = i + 5; else if (e.key === 'PageUp') j = i - 5;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = bl.length - 1;
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault(); const m = messageDe(b); if (m) actionsMessage(m, b); return; }
    if (j === null) return;
    e.preventDefault();
    if (j < 0 && flux.querySelector('.anciens')) { plusAnciens(true); return; }
    const c = bl[Math.max(0, Math.min(bl.length - 1, j))];
    if (c) { b.tabIndex = -1; c.tabIndex = 0; c.focus(); }
  });
  // en remontant jusqu'en haut, les messages plus anciens arrivent d'eux-mêmes
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(l => { if (l.some(x => x.isIntersecting) && document.querySelector('#flux .anciens')) plusAnciens(false); }, { root: $('messages'), rootMargin: '200px 0px 0px 0px' });
    const veiller = () => { const a = unique.anciens; if (a && !a._vu) { io.observe(a); a._vu = true; } };
    new MutationObserver(veiller).observe(flux, { childList: true });
  }
})();
let boutonsFils = null;
function afficherFils(vueAPart) {
  const nav = $('fils');
  if (!boutonsFils) {   // créées une fois
    boutonsFils = {};
    FILS.forEach(([id, nom]) => {
      const b = document.createElement('button'); b.type = 'button';
      html(b, svg(id) + '<span class="nom" aria-hidden="true"></span>');
      b.querySelector('.nom').textContent = NOM_COURT[id] || nom;
      b.classList.toggle('long', (NOM_COURT[id] || nom).length > 11); b.classList.toggle('moyen', (NOM_COURT[id] || nom).length > 8 && (NOM_COURT[id] || nom).length <= 11);
      b.onclick = () => choisirFil(id);
      nav.appendChild(b); boutonsFils[id] = b;
    });
  }
  const c = comptesNonLus();
  FILS.forEach(([id, nom]) => {
    const b = boutonsFils[id], actif = id === fil && !vueAPart, n = actif ? 0 : (c[id] || 0), sig = n + '|' + actif;
    if (b._sig === sig) return; b._sig = sig;
    let x = b.querySelector('.badge');
    if (n && !x) { x = document.createElement('span'); x.className = 'badge'; x.setAttribute('aria-hidden', 'true'); b.appendChild(x); }
    if (x) { if (n) x.textContent = n > 99 ? '99+' : n; else x.remove(); }
    b.setAttribute('aria-pressed', String(actif));   // Brief ou Maintenance ouverts : aucun fil n'est actif
    b.setAttribute('aria-label', nom + (n ? ', ' + n + ' nouveau' + (n > 1 ? 'x' : '') + ' message' + (n > 1 ? 's' : '') : ''));
  });
  return c;
}
function choisirFil(id) {
  fil = id; store.ecrire('fil', fil);
  if (!$('recherche').hidden) { $('recherche').hidden = true; $('q').value = ''; $('resultats').hidden = true; $('flux').hidden = false; }
  document.body.classList.remove('brief', 'maintenance'); majVues(); afficher();
}
let sigBrief = null, sigMaint = null;
function afficherVues() {
  const briefs = messages.filter(estBrief), maint = messages.filter(m => m.fil === 'systeme');
  const ouvBrief = document.body.classList.contains('brief'), ouvMaint = document.body.classList.contains('maintenance');
  // Brief et Maintenance : lus quand on ouvre leur section ; sinon un petit numéro sur leur bouton.
  if (ouvBrief && briefs.length && vus.brief !== briefs[briefs.length - 1].t) { vus.brief = briefs[briefs.length - 1].t; store.ecrire('vus', vus); }
  if (ouvMaint && maint.length && vus.systeme !== maint[maint.length - 1].t) { vus.systeme = maint[maint.length - 1].t; store.ecrire('vus', vus); }
  [['brief', briefs.filter(m => m.t > (vus.brief || '')).length], ['maintenance', maint.filter(m => m.t > (vus.systeme || '')).length]].forEach(([id, n]) => {
    const b = $(id); let x = b.querySelector('.badge');
    if (!n) { if (x) x.remove(); return; }
    if (!x) { x = document.createElement('span'); x.className = 'badge'; x.setAttribute('aria-hidden', 'true'); b.appendChild(x); }
    x.textContent = n > 9 ? '9+' : n;
    b.setAttribute('aria-label', (id === 'brief' ? 'Brief du jour' : 'Maintenance') + ', ' + n + ' nouveau' + (n > 1 ? 'x' : ''));
  });
  // contenu des vues : construit seulement quand on les ouvre, et refait seulement s'il a changé
  const sb = briefs.length ? briefs[briefs.length - 1].id + '|' + briefs[briefs.length - 1].texte : '';
  if (ouvBrief && sb !== sigBrief) { sigBrief = sb;
    const vb = $('vue-brief'); vb.textContent = ''; vb.appendChild(boutonRetour());
    if (!briefs.length) vb.insertAdjacentHTML('beforeend', POLITIQUE.createHTML('<div class="vide"><strong>Pas encore de brief</strong>Il arrive chaque matin à 7 h 50.</div>'));
    else vb.appendChild(carteSysteme(briefs[briefs.length - 1])); }
  const sm = maint.slice(-10).map(m => m.id).join();
  if (ouvMaint && sm !== sigMaint) { sigMaint = sm;
    const vm = $('vue-maintenance'); vm.textContent = ''; vm.appendChild(boutonRetour());
    if (!maint.length) vm.insertAdjacentHTML('beforeend', POLITIQUE.createHTML('<div class="vide"><strong>Rien à signaler</strong>Le rapport du système et ses alertes arrivent ici.</div>'));
    else maint.slice(-10).forEach(m => vm.appendChild(carteSysteme(m)));
    vm.scrollTop = vm.scrollHeight; }
}
const PLACEHOLDERS = { experts: 'Ta question — ou « notaire : … » pour un expert précis', comite: 'Ta décision à prendre — /direct, /fiche, /vite, /comite', brainstorm: 'Un besoin, une idée : je pars dans tous les sens' };
function afficher() {
  const vueAPart = enVueAPart();
  const p = PLACEHOLDERS[fil] || 'Écris à LIFE…'; if ($('saisie').placeholder !== p) $('saisie').placeholder = p;
  if (document.visibilityState !== 'hidden' && !vueAPart) marquerLu(fil);   // le fil ouvert est lu
  const c = afficherFils(vueAPart);
  pastilleAppli(c);
  afficherEpingles(); afficherVues();
  $('flux').setAttribute('aria-label', 'Messages du fil ' + nomFil(fil));
  if (!vueAPart) afficherConversation();
}
// Annonce des nouveaux messages pour les lecteurs d'écran : une zone à part (avant : toute la conversation était
// « vivante » et relue à chaque reconstruction).
function annoncer(nouveaux) {
  const l = nouveaux.filter(m => m.auteur !== 'moi' && !m.local); if (!l.length) return;
  const dernier = l[l.length - 1], z = $('annonce');
  const t = l.length > 3 ? l.length + ' nouveaux messages' : auteurLisible(dernier) + ' (' + nomFil(dernier.fil || 'general') + ') : ' + String(dernier.texte || '').slice(0, 240);
  z.textContent = ''; setTimeout(() => { z.textContent = t; }, 50);
}

let envoisEnCours = 0;   // LIFE écrit (trois points) tant qu'au moins un envoi attend sa réponse
// Curseur de synchronisation : donné par le serveur (position dans son registre), jamais une heure de l'appareil.
// Rangé avec l'adresse : une autre adresse repart de zéro.
function curseur() { const c = store.lire('curseur', null); return serveurAJour() && c && c.a === adresse() && Number.isInteger(c.k) ? c.k : null; }
function majCurseur(k) { if (Number.isInteger(k) && k >= 0) store.ecrire('curseur', { a: adresse(), k }); }
// Repli pour un ancien serveur (sans curseur) : l'heure du dernier message VENU DU SERVEUR (jamais une copie locale à
// l'heure de l'appareil), moins une seconde (un message écrit dans la même seconde n'est plus sauté ; doublons écartés par id).
function depuisServeur() {
  const l = messages.filter(duServeur).map(m => m.t || '').filter(t => /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(t)).sort();
  if (!l.length) return '';
  const [d, h] = l[l.length - 1].split(' '), [a, mo, j] = d.split('-').map(Number), [hh, mi, se] = h.split(':').map(Number);
  const x = new Date(Date.UTC(a, mo - 1, j, hh, mi, se) - 1000).toISOString();
  return x.slice(0, 10) + ' ' + x.slice(11, 19);
}
let actuEnCours = null;
function actualiser() {
  if (DEMO) return Promise.resolve();
  if (actuEnCours) return actuEnCours;
  derniereActu = Date.now();
  actuEnCours = (async () => {
    try {
      for (let page = 0; page < 10; page++) {   // le serveur pagine (plus: true) : on suit jusqu'au bout, rien n'est sauté
        const k = curseur(), corps = { action: 'fil', depuis: depuisServeur() };
        if (k !== null) corps.curseur = k;
        const j = await appel(corps);
        fusionner(j.messages || [], j.retires);
        if (serveurAJour() && Number.isInteger(j.curseur)) majCurseur(j.curseur);
        if (!(serveurAJour() && j.plus)) break;
      }
      afficher(); etat('');
      if (persistant === null) demanderPersistance();   // connectée : on protège la copie de l'appareil
    } catch (e) { etat(raison(e)); }
    finally { actuEnCours = null; }
  })();
  return actuEnCours;
}
// Dire pourquoi la connexion ne passe pas, au lieu d'un simple « hors ligne » (Réglages → « Tester la connexion »).
function raison(e) {
  const m = (e && e.message) || '';
  if (/manquante/.test(m)) return 'pas connectée : adresse ou clé manquante';
  if (m === 'clé refusée') return adresseDuLien()
    ? 'le serveur « ' + hoteDe(adresse()) + ' », reçu par un lien, refuse la clé — ne lui donne pas ta clé : saisis toi-même l\'adresse dans les Réglages'
    : 'clé refusée — vérifie la clé dans les Réglages';
  if (m === 'délai dépassé') return 'pas de réponse à temps (réseau lent ?) — le message est peut-être arrivé : LIFE vérifie d\'elle-même, et « Réessayer » ne le traitera jamais deux fois';
  if (m === 'fil inconnu') return 'le serveur ne connaît pas ce fil — sa dernière version doit être installée puis publiée';
  if (/erreur 404/.test(m)) return 'serveur introuvable (404) — lien LIFE pas encore publié dans ton système ?';
  if (/^erreur \d/.test(m)) return 'le serveur répond mal (' + m + ')';
  if (!navigator.onLine) return 'hors ligne';
  if (e instanceof TypeError) return 'serveur injoignable — connexion instable ou adresse à vérifier';
  return m.slice(0, 120) || 'hors ligne';
}

// Heure de Paris, comme le serveur (audit expert LC-5) : en voyage, les bulles provisoires et les échanges experts se
// rangent au bon endroit et comptent juste dans les non-lus.
function heureLocale() {
  try { return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace('T', ' ').slice(0, 19); }
  catch (e) { const d = new Date(), z = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); }
}
const ACCENTS = /[\u0300-\u036f]/g;
// « nom : question » ne vise un expert que si « nom » est un expert connu (liste donnée par le serveur) ;
// sinon (« Rappel : … », ou liste encore inconnue) la question part entière et le système choisit l'expert.
function prefixeExpert(texte) {
  const m = texte.match(/^\s*([A-Za-zÀ-ÿ_ ]{2,30})\s*:\s*([\s\S]+)$/);
  if (!m) return { membre: '', texte };
  const membre = m[1].normalize('NFD').replace(ACCENTS, '').toLowerCase().trim().replace(/\s+/g, '_');
  return experts.includes(membre) ? { membre, texte: m[2].trim() } : { membre: '', texte };
}
async function demanderExpert(texte) {
  const q = prefixeExpert(texte);
  const url = adresse().replace(/\/life\/?$/, '/app-lien');
  const { r, j } = await appel({ type: 'expert', texte: q.texte, expert: { membre: q.membre } }, { url, delai: DELAI_LONG, contrat: false, brut: true });
  const motif = String(j.erreur || '');
  if (r.status === 404 || /type inconnu/i.test(motif)) return [{ nom: 'LIFE', texte: 'Les experts ne sont pas encore branchés : le circuit du lien avec l\'app doit être publié dans ton système.' }];
  // refus du serveur (ok:false) : on montre son explication (reponse, sinon erreur), jamais « erreur 200 »
  if (j.ok === false && (j.reponse || motif)) return [{ nom: 'LIFE', texte: String(j.reponse || ('Refusé : ' + motif)), refus: true }];
  if (!r.ok || j.ok === false) throw new Error(motif || ('erreur ' + r.status));
  const L = (j.reponses || []).filter(x => x && x.texte).map(x => ({ nom: String(x.nom || 'Expert'), texte: String(x.texte) }));
  return L.length ? L : [{ nom: 'LIFE', texte: String(j.reponse || 'Pas de réponse.') }];
}
function envoyer() {
  let texte = $('saisie').value.trim();
  if (!texte) return;
  $('saisie').value = ''; ajuster();
  const long = texte.length > TEXTE_MAX;
  if (long) texte = texte.slice(0, TEXTE_MAX).trim();   // un seul enregistrement, coupé ici et signalé (plus de doublon)
  const dire = () => bandeau('Message raccourci à 2 000 caractères (la limite du serveur) : la fin n\'est pas partie.', null, 8000);
  const envoi = expedier(texte, fil, nouvelId());
  if (long) { dire(); envoi.then(ok => { if (ok) dire(); }); }   // redit après la réponse (qui efface le bandeau)
}
// Attente annoncée (audit UX du 13/10) : « LIFE réfléchit… d'habitude ≈ N s », N = médiane des 9 dernières réponses du fil,
// mesurées sur cet appareil (rien n'est affiché comme durée avant 3 mesures). Annoncé aussi au lecteur d'écran.
let durees = store.lire('durees', {});
function dureeHabituelle(f) { const d = (durees[f] || []).slice().sort((a, b) => a - b); return d.length >= 3 ? d[d.length >> 1] : 0; }
function texteAttente(f) { const n = dureeHabituelle(f); return 'LIFE réfléchit…' + (n ? ' d\'habitude ≈ ' + Math.max(1, Math.round(n / 1000)) + ' s' : ''); }
function noterDuree(f, ms) { if (!(ms > 0 && ms < DELAI_LONG)) return; durees[f] = (durees[f] || []).concat(Math.round(ms)).slice(-9); store.ecrire('durees', durees); }
function direAuLecteur(t) { const a = $('annonce'); a.textContent = ''; setTimeout(() => { a.textContent = t; }, 50); }
// Un envoi = un identifiant client (cid). Le même cid est renvoyé par « Réessayer » : le serveur ne traite jamais deux fois.
async function expedier(texte, filCible, cid, parti) {
  const temp = { id: 'tmp-' + cid, cid, t: heureLocale(), auteur: 'moi', fil: filCible, texte, temp: true, parti: parti || Date.now() };
  try { if (navigator.vibrate && !enCalme()) navigator.vibrate(12); } catch (e) { /* pas de vibreur */ }
  messages.push(temp); garderMessages();   // gardée sur l'appareil AVANT l'envoi (app fermée pendant l'attente : rien de perdu)
  envoisEnCours++; afficher();
  { const n = dureeHabituelle(filCible); direAuLecteur('Message envoyé. LIFE réfléchit' + (n ? ', d\'habitude environ ' + Math.max(1, Math.round(n / 1000)) + ' secondes' : '') + '.'); }
  const debut = Date.now();
  const retirerTemp = () => { messages = messages.filter(m => m.id !== temp.id); };
  try {
    if (filCible === 'experts') {
      if (!cle() || !adresse()) { ouvrirReglages(); throw new Error('clé ou adresse manquante'); }
      const rep = await demanderExpert(texte);
      retirerTemp();
      fusionner([Object.assign({}, temp, { id: 'loc-' + cid, temp: false, local: true, expert: true }),
        ...rep.map((x, k) => ({ id: 'loc-' + cid + '-' + k, t: heureLocale(), auteur: 'life', fil: 'experts', texte: x.nom + '\n' + x.texte, local: true, expert: true }))]);
      noterDuree(filCible, Date.now() - debut); etat(''); return true;
    }
    const k = curseur(), corps = { action: 'envoyer', texte, fil: filCible, cid };
    if (k !== null) corps.curseur = k;
    const j = await appel(corps, { delai: delaiPour(filCible) });
    const recus = (j.messages || []).filter(m => m && m.id);
    let horsFil = false;
    if (!serveurAJour()) {
      // ANCIEN serveur seulement : il range un fil qu'il ne connaît pas dans Général ; l'échange reste affiché dans le fil
      // où il a été écrit (table filsForces bornée), et on le dit.
      horsFil = recus.some(m => m.auteur === 'life' && m.fil && m.fil !== filCible && m.fil !== 'systeme');
      const echange = new Set(recus.filter(m => m.auteur === 'moi' && m.texte === texte).map(m => m.id));
      recus.forEach(m => { if ((echange.has(m.id) || m.auteur === 'life') && m.fil !== filCible && m.fil !== 'systeme') { filsForces[m.id] = filCible; m.fil = filCible; } });
      const gardes = new Set(messages.map(m => m.id).concat(recus.map(m => m.id)));
      filsForces = Object.fromEntries(Object.entries(filsForces).filter(([id]) => gardes.has(id)).slice(-400));
      store.ecrire('filsForces', filsForces);
    }
    retirerTemp();
    const echo = recus.some(m => m.auteur === 'moi' && (cidDe(m.id) === cid || ((m.fil || 'general') === filCible && m.texte === texte)));
    if (!echo) recus.push(Object.assign({}, temp, { id: 'loc-' + cid, temp: false, local: true }));
    fusionner(recus, j.retires);
    if (recus.some(m => m.auteur === 'life')) noterDuree(filCible, Date.now() - debut);
    if (serveurAJour() && k !== null && Number.isInteger(j.curseur)) { majCurseur(j.curseur); derniereActu = Date.now(); if (j.plus) actualiser(); }
    etat('');
    if (j.tronque) bandeau('Le serveur a gardé les ' + j.tronque + ' premiers caractères de ce message.', null, 6000);
    // version 3 : le serveur traite déjà ce message (un premier envoi est en cours) : rien n'est retraité, la réponse suit
    if (j.en_cours) { attendreReponse(cid, filCible); bandeau('LIFE traite déjà ce message : sa réponse arrive.', null, 5000); }
    if (horsFil && filCible !== 'general') bandeau('Le serveur ne connaît pas encore le fil ' + ((FILS.find(x => x[0] === filCible) || [0, filCible])[1]) + ' : c\'est Général qui a répondu. La dernière version du serveur doit être installée puis publiée.', null, 9000);
    return true;
  } catch (e) {
    // la bulle reste (remise dans la liste si une fusion l'avait écartée), marquée « Non envoyé · Réessayer », gardée sur l'appareil
    let m = messages.find(x => x.cid === cid && !duServeur(x));
    if (!m) { m = temp; messages.push(m); messages.sort(ordre); }
    m.temp = false; m.echec = true; m.parti = temp.parti;
    if (e.message === 'délai dépassé') m.delai = true;
    garderMessages();
    if (m.delai) erreur('Pas encore de réponse de LIFE : ton message est peut-être bien arrivé. « Vérifier » regarde avant de renvoyer.', ['Vérifier', () => reessayer(m)], 10000);
    else erreur('Non envoyé : ' + raison(e), ['Réessayer', () => reessayer(m)]);
    if (e.message === 'délai dépassé' && serveurAJour()) attendreReponse(cid, filCible);   // la réponse a pu arriver entre-temps
    return false;
  } finally {
    envoisEnCours = Math.max(0, envoisEnCours - 1); afficher();
  }
}
// Renvoie un message resté « Non envoyé », dans son fil, avec le même cid, sans toucher à la saisie.
// Après un délai dépassé (le serveur a peut-être le message) : d'abord une relève ; s'il l'a, rien n'est renvoyé.
const arrive = cid => !!cid && messages.some(x => duServeur(x) && cidDe(x.id) === cid);
let reessaiEnCours = false;
async function reessayer(m) {
  if (m.fil && m.fil !== fil) { fil = m.fil; store.ecrire('fil', fil); }
  if (enVueAPart()) { document.body.classList.remove('brief', 'maintenance'); majVues(); }
  if (m.delai && serveurAJour() && m.cid && Date.now() - (m.parti || 0) < GARDE_REESSAI) {
    if (reessaiEnCours) return; reessaiEnCours = true;
    try { await actualiser(); } finally { reessaiEnCours = false; }
    if (arrive(m.cid)) { afficher(); bandeau('Ton message était bien arrivé : rien n\'a été renvoyé.', null, 5000);
      if (!messages.some(x => duServeur(x) && x.id === 'L-' + m.cid + '-b')) attendreReponse(m.cid, m.fil || fil);
      return; }
    if (versionServeur < 3) {   // serveur version 2 : il écrit après l'IA ; renvoyer maintenant risquerait un second traitement
      const s = Math.ceil((GARDE_REESSAI - (Date.now() - (m.parti || 0))) / 1000);
      bandeau('LIFE traite peut-être encore ce message : réessaie dans ' + s + ' s (il ne sera jamais traité deux fois).', null, 6000);
      return;
    }
  }
  messages = messages.filter(x => x !== m && x.id !== m.id); garderMessages();
  expedier(m.texte, m.fil || fil, m.cid || nouvelId(), m.parti);
}

function ajuster() {
  const s = $('saisie'); s.style.height = 'auto'; s.style.height = Math.min(s.scrollHeight, 140) + 'px';
  $('envoyer').disabled = !s.value.trim();
}

// Dictée : reconnaissance vocale du navigateur. Dans Chrome, le son passe par le service vocal de Google (c'est dit
// dans l'infobulle et la première fois qu'on dicte) ; le texte reconnu n'arrive que dans la saisie, rien n'est envoyé seul.
const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
let reco = null;
const ERREURS_DICTEE = {
  'not-allowed': 'Micro refusé : autorise-le pour ce site dans les réglages du navigateur.',
  'service-not-allowed': 'Dictée refusée par le navigateur sur cet appareil.',
  'audio-capture': 'Aucun micro trouvé sur cet appareil.',
  'network': 'Dictée impossible sans réseau : elle passe par le service vocal de Google.',
  'no-speech': 'Je n\'ai rien entendu : touche le micro et parle tout de suite.',
  'language-not-supported': 'La dictée en français n\'est pas disponible ici.'
};
$('micro').setAttribute('aria-pressed', 'false');
$('micro').title = 'Dicter (la dictée passe par le service vocal de Google)';
$('micro').onclick = () => {
  if (!Reco) { erreur('Dictée non disponible dans ce navigateur (elle marche dans Chrome).'); return; }
  if (reco) { reco.stop(); return; }
  if (!store.lire('dicteeVue', false)) { store.ecrire('dicteeVue', true); bandeau('La dictée passe par le service vocal de Google. Touche à nouveau le micro pour arrêter.', null, 8000); }
  reco = new Reco(); reco.lang = 'fr-FR'; reco.interimResults = true; reco.continuous = false;
  const base = $('saisie').value ? $('saisie').value + ' ' : '';
  reco.onresult = ev => { $('saisie').value = base + [...ev.results].map(r => r[0].transcript).join(''); ajuster(); };
  reco.onend = () => { reco = null; $('micro').classList.remove('actif'); $('micro').setAttribute('aria-pressed', 'false'); };
  reco.onerror = ev => { if (ev && ev.error === 'aborted') return; erreur(ERREURS_DICTEE[ev && ev.error] || 'Dictée interrompue : réessaie.'); };
  $('micro').classList.add('actif'); $('micro').setAttribute('aria-pressed', 'true');
  try { reco.start(); } catch (e) { reco = null; $('micro').classList.remove('actif'); $('micro').setAttribute('aria-pressed', 'false'); erreur('Dictée impossible pour le moment : réessaie.'); }
};

$('saisie').addEventListener('input', ajuster);
// Brief : section à part, ouverte par le soleil de l'en-tête.
$('brief').onclick = () => vue(document.body.classList.contains('brief') ? null : 'brief');
// Maintenance : section à part (rapport journalier, alertes du système), jamais mêlée aux conversations.
$('maintenance').onclick = () => vue(document.body.classList.contains('maintenance') ? null : 'maintenance');
// Téléphone : les fils sur une rangée qui défile ; la grille complète s'ouvre avec ⌄ (choix gardé sur l'appareil).
// Pendant la saisie, la grille se range pour laisser la place à la conversation.
let grille = store.lire('grille2', true), enSaisie = false;   // tuiles à icônes par défaut (13/10)
function majGrille() {
  const g = grille && !enSaisie, t = g ? 'Replier les fils' : 'Voir tous les fils';
  document.body.classList.toggle('grille', g);
  $('plier').setAttribute('aria-expanded', String(g)); $('plier').setAttribute('aria-label', t); $('plier').title = t;
}
majGrille();
$('saisie').addEventListener('focus', () => { enSaisie = true; majGrille(); });
$('saisie').addEventListener('blur', () => { enSaisie = false; majGrille(); });
$('plier').onclick = () => { grille = !grille; store.ecrire('grille2', grille); majGrille(); };
$('saisie').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); envoyer(); } });
$('envoyer').onclick = envoyer;
function ouvrirRecherche() { if (enVueAPart()) vue(null); $('recherche').hidden = false; $('q').focus(); $('q').select(); }
function fermerRecherche() { $('recherche').hidden = true; $('q').value = ''; $('resultats').hidden = true; $('flux').hidden = false; afficher(); }
$('chercher').onclick = () => { if ($('recherche').hidden) ouvrirRecherche(); else fermerRecherche(); };
$('fermer-recherche').onclick = fermerRecherche;
// Raccourcis (ordinateur surtout) : Ctrl/⌘ + K = rechercher ; Échap = fermer ce qui est ouvert ;
// Entrée = envoyer et Maj + Entrée = aller à la ligne (sur la saisie, avec un clavier physique).
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$('raccourci').textContent = MAC ? '⌘ K' : 'Ctrl K';
$('chercher').title = 'Rechercher (' + (MAC ? '⌘' : 'Ctrl') + ' K)';
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key || '').toLowerCase() === 'k') { e.preventDefault(); ouvrirRecherche(); return; }
  if (e.key !== 'Escape' || $('dlg').open) return;   // la boîte des réglages se ferme d'elle-même
  if (!$('installe').hidden) { fermerInstalle(); return; }
  if (document.querySelector('.feuille-msg')) { fermerFeuilles(true); return; }
  if (!$('menu').hidden) { fermerMenu(true); return; }
  if (!$('recherche').hidden) { fermerRecherche(); $('chercher').focus(); return; }
  if (enVueAPart()) { vue(null); $('saisie').focus(); }
});
$('q').addEventListener('input', () => {   // résultats dans leur propre zone : la conversation gardée reste intacte
  const q = $('q').value.trim().toLowerCase(), zone = $('resultats');
  if (q.length < 2) { zone.hidden = true; $('flux').hidden = false; afficher(); return; }
  zone.textContent = ''; zone.hidden = false; $('flux').hidden = true;
  const trouves = messages.filter(m => (m.texte || '').toLowerCase().includes(q)).slice(-40).reverse();
  if (!trouves.length) { html(zone, '<div class="vide"><strong>Rien trouvé</strong>Essaie un autre mot.</div>'); return; }
  trouves.forEach(m => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bulle life resultat';
    const ou = document.createElement('span'); ou.className = 'ou';
    ou.textContent = nomFil(m.fil || 'general') + ' · ' + jourLisible(m.t);
    b.appendChild(ou);
    const t = m.texte, i = t.toLowerCase().indexOf(q), debut = Math.max(0, i - 60);
    b.appendChild(document.createTextNode((debut ? '…' : '') + t.slice(debut, i)));
    const mk = document.createElement('mark'); mk.textContent = t.slice(i, i + q.length); b.appendChild(mk);
    b.appendChild(document.createTextNode(t.slice(i + q.length, i + q.length + 120) + '…'));
    b.onclick = () => { $('recherche').hidden = true; $('q').value = ''; zone.hidden = true; $('flux').hidden = false;
      if (m.fil !== 'systeme') choisirFil(m.fil || 'general'); else vue('maintenance'); };
    zone.appendChild(b);
  });
});
// Ne pas déranger (21 h – 8 h) : pas de vibration ; servira aussi aux notifications.
let calme = store.lire('calme', false);
const libelleCalme = () => { $('calme').textContent = 'Ne pas déranger 21 h – 8 h : ' + (calme ? 'oui' : 'non'); };
libelleCalme();
$('calme').onclick = () => { calme = !calme; store.ecrire('calme', calme); libelleCalme(); };
const enCalme = () => { const h = new Date().getHours(); return calme && (h >= 21 || h < 8); };
// Menu « Plus » : un vrai menu (WAI-ARIA) — flèches haut / bas, Début / Fin, Échap (focus rendu à « Plus »), Tab ferme.
const itemsMenu = () => [...$('menu').querySelectorAll('[role="menuitem"]')].filter(b => !b.hidden);
itemsMenu().forEach(b => { b.tabIndex = -1; });
function fermerMenu(rendre) { if ($('menu').hidden) return; $('menu').hidden = true; $('plus').setAttribute('aria-expanded', 'false'); if (rendre === true) $('plus').focus(); }
function ouvrirMenu(dernier) { $('menu').hidden = false; $('plus').setAttribute('aria-expanded', 'true');
  const l = itemsMenu(); (dernier ? l[l.length - 1] : l[0]).focus({ preventScroll: true }); }
$('plus').onclick = e => { e.stopPropagation(); if ($('menu').hidden) ouvrirMenu(); else fermerMenu(); };
$('plus').addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ouvrirMenu(e.key === 'ArrowUp'); } });
$('menu').addEventListener('keydown', e => naviguerMenu(e, itemsMenu(), fermerMenu));
document.addEventListener('click', fermerMenu);
$('actualiser').onclick = actualiser;
// Effacer ce fil : tout de suite à l'écran, annulable 10 s (bandeau « Annuler ») avant de partir au serveur, puis effacé
// sur tous les appareils (audit UX du 13/10 : 5 s était trop court pour une action de cette taille).
$('effacer-fil').onclick = () => { fermerMenu(); if (enVueAPart()) vue(null);
  const nom = (FILS.find(([i]) => i === fil) || [, 'ce fil'])[1];
  const ids = messages.filter(m => (m.fil || 'general') === fil).map(m => m.id);
  if (!ids.length) { bandeau('Rien à effacer dans « ' + nom + ' »', null, 2500); return; }
  supprimer(ids, '« ' + nom + ' » effacé sur tous tes appareils (' + ids.length + ' message' + (ids.length > 1 ? 's' : '') + ')', 10000); };
// Tirer la conversation vers le bas, en haut de la liste, pour actualiser.
let tire = null;
$('messages').addEventListener('touchstart', e => { tire = $('messages').scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
$('messages').addEventListener('touchmove', e => { if (tire === null) return; const d = e.touches[0].clientY - tire;
  $('tirer').style.height = d > 20 ? Math.min(d / 2, 40) + 'px' : '0'; }, { passive: true });
$('messages').addEventListener('touchend', () => { if ($('tirer').offsetHeight >= 36) actualiser(); $('tirer').style.height = '0'; tire = null; });
$('reglages').onclick = () => { fermerMenu(); ouvrirReglages(); };
// Jour / nuit : automatique → jour → nuit → automatique ; gardé sur l'appareil
const THEMES = { auto: 'Jour / nuit : automatique', jour: 'Mode jour', nuit: 'Mode nuit' };
function appliquerTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const nuit = t === 'nuit' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', nuit ? '#0e1830' : '#f5eee2'); m.removeAttribute('media'); });
  $('theme').title = THEMES[t]; $('theme').setAttribute('aria-label', THEMES[t]);
}
let theme = store.lire('theme', 'auto'); appliquerTheme(theme);
$('theme').onclick = e => { e.stopPropagation(); theme = { auto: 'jour', jour: 'nuit', nuit: 'auto' }[theme] || 'auto'; store.ecrire('theme', theme); appliquerTheme(theme); bandeau(THEMES[theme], null, 2500); };
$('annuler').onclick = () => $('dlg').close();
$('a-la-main').onclick = () => { $('dlg').classList.add('main'); $('a-la-main').hidden = true; $('adresse').focus(); };
$('garder').onclick = () => {   // adresse saisie ici par elle-même : elle n'est plus « venue d'un lien »
  const a = $('adresse').value.trim();
  if (a !== adresse()) { store.effacer('curseur'); store.effacer('adresseDuLien'); }
  store.ecrire('cle', $('cle').value.trim()); store.ecrire('adresse', a);
  const cl = $('cle-life').value.trim();
  if (cl !== store.lire('cleLife', '')) store.effacer('cleLifeServeur');   // nouvelle clé propre : la bascule recommence
  if (cl) store.ecrire('cleLife', cl); else store.effacer('cleLife');
  $('dlg').close();
  if (hoteDe(a) !== HOTE_CSP) { location.reload(); return; }   // autre serveur : la règle de sécurité du lancement doit suivre
  actualiser();
};
// Effacer cet appareil : seulement ce que LIFE garde ici (clés « life. » et caches « life- ») ; la carte et les autres apps
// du même site ne sont pas touchées. Confirmation forte : retaper EFFACER.
$('effacer-appareil').onclick = () => { $('ef-saisie').value = ''; $('ef-ok').disabled = true; ouvrirDialogue($('dlg-effacer')); $('ef-saisie').focus(); };
$('ef-saisie').addEventListener('input', () => { $('ef-ok').disabled = $('ef-saisie').value.trim().toUpperCase() !== 'EFFACER'; });
$('ef-non').onclick = () => $('dlg-effacer').close();
$('ef-ok').onclick = async () => {
  if ($('ef-saisie').value.trim().toUpperCase() !== 'EFFACER') return;
  try { Object.keys(localStorage).filter(k => k.startsWith('life.')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* stockage indisponible */ }
  try { for (const k of await caches.keys()) if (k.startsWith('life-')) await caches.delete(k); } catch (e) { /* pas de cache */ }
  location.replace(location.pathname);
};
// Une actualisation = une exécution du serveur (quota). Après un envoi, les nouveaux messages arrivent dans la réponse :
// pas d'appel en plus.
//   APP TÉLÉPHONE : au retour dans l'app, pas plus d'une fois toutes les 5 minutes ; aucune relève en arrière-plan.
//   APP ORDINATEUR : au retour sur l'onglet ou la fenêtre (focus) après 2 minutes, et toutes les 15 minutes tant que la
//   fenêtre est visible et qu'on s'en est servi dans les 2 dernières heures.
let derniereActu = 0, derniereActivite = Date.now();
const ORDI = matchMedia('(min-width: 900px) and (pointer: fine)');
const RETOUR_TEL = 5 * 60e3, RETOUR_ORDI = 2 * 60e3, RELEVE_ORDI = 15 * 60e3, VEILLE_ORDI = 2 * 3600e3;
const siPasRecent = seuil => { if (!DEMO && document.visibilityState === 'visible' && Date.now() - derniereActu > seuil && cle() && adresse()) actualiser(); };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') siPasRecent(ORDI.matches ? RETOUR_ORDI : RETOUR_TEL);
  if (document.visibilityState === 'hidden') confirmerSuppression();   // on quitte l'app : la suppression en attente part
});
window.addEventListener('focus', () => { if (ORDI.matches) siPasRecent(RETOUR_ORDI); });
['pointerdown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { derniereActivite = Date.now(); }, { passive: true, capture: true }));
setInterval(() => { if (ORDI.matches && Date.now() - derniereActivite < VEILLE_ORDI) siPasRecent(RELEVE_ORDI - 30e3); }, 60e3);
window.addEventListener('pagehide', confirmerSuppression);

// Connexion d'un autre appareil : le lien porte l'adresse et la clé dans le « # », qui n'est jamais envoyé à un serveur.
// À l'ouverture, on les range sur l'appareil puis on efface le « # » de la barre d'adresse et de l'historique.
if (DANS_CARTE) { document.body.classList.add('dans-carte'); $('retour-carte').hidden = false; $('vers-carte').hidden = true;
  $('retour-carte').onclick = () => { try { window.parent.postMessage({ life: 'fermer' }, location.origin); } catch (e) { /* */ } }; }
$('vers-carte').onclick = () => { $('menu').hidden = true; location.href = '../carte-de-vie/'; };
// Ma carte de vie peut PRÉPARER un message (jamais l'envoyer) : elle choisit le fil et remplit la saisie, la personne relit et
// touche Envoyer. Seulement depuis la page qui contient LIFE, sur la même origine (cerveau « Ma mémoire » : oublie, pause…).
if (DANS_CARTE) window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== window.parent) return;
  const d = e.data || {}; if (d.life !== 'preparer' || typeof d.texte !== 'string' || !d.texte.trim()) return;
  choisirFil(FILS.some(x => x[0] === d.fil) ? d.fil : 'general');
  const s = $('saisie'); s.value = d.texte.slice(0, 2000); ajuster(); s.focus(); });
if (DANS_CARTE) try { window.parent.postMessage({ life: 'pret' }, location.origin); } catch (e) { /* */ }
const VERSION = 'V.0.0.4.2';   // un chiffre par position : V.0.0.3.7, puis V.0.0.3.8… ; à augmenter à chaque mise en ligne (avec CACHE dans sw.js)
$('version').textContent = 'Version ' + VERSION + ' · mise à jour automatique'; $('ver-haut').textContent = VERSION;
// Connecter un autre appareil (audit de sécurité LT2, LO1) : avec un serveur qui le permet (version 3, « transfert »),
// le code ne contient PLUS la clé : l'appareil dépose au serveur un paquet chiffré (AES-GCM, clé de 128 bits tirée au
// hasard), et le code ne porte que l'adresse, le numéro du paquet et la clé de déchiffrement. Le nouvel appareil retire
// le paquet UNE SEULE FOIS, dans les 2 minutes : une photo du code, ou l'historique d'un lecteur, ne sert plus à rien
// ensuite. Le serveur, lui, ne voit jamais la clé en clair. Avec un ancien serveur : l'ancien lien (clé dedans), signalé.
const b64u = o => btoa(typeof o === 'string' ? unescape(encodeURIComponent(o)) : String.fromCharCode(...new Uint8Array(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64u = t => { const b = t.replace(/-/g, '+').replace(/_/g, '/'); return atob(b + '==='.slice((b.length + 3) % 4)); };
const octets = t => Uint8Array.from(deb64u(t), c => c.charCodeAt(0));
async function lienConnexion() {
  const o = { a: adresse(), c: cle() }; if (store.lire('cleLife', '')) o.l = store.lire('cleLife', '');
  if (!store.lire('transfert', false) || !(window.crypto && crypto.subtle)) return { lien: location.origin + location.pathname + '#connexion=' + b64u(JSON.stringify(o)), unique: false };
  const k = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ck = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, new TextEncoder().encode(JSON.stringify({ c: o.c, l: o.l || '' }))));
  const paquet = new Uint8Array(12 + ct.length); paquet.set(iv); paquet.set(ct, 12);
  const id = nouvelId() + nouvelId();   // 28 caractères
  await appel({ action: 'transfert_deposer', id, donnees: b64u(paquet) });
  return { lien: location.origin + location.pathname + '#transfert=' + b64u(JSON.stringify({ a: o.a, i: id, k: b64u(k) })), unique: true };
}
async function retirerTransfert(n) {   // nouvel appareil : retire le paquet (une fois) et le déchiffre
  const url = n.a.replace(/\/life\/?$/, '/life-transfert');
  if (url === n.a) throw new Error('adresse inattendue');
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'transfert_retirer', id: n.transfert.i }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok || typeof j.donnees !== 'string') throw new Error(j.erreur || 'code inconnu, déjà utilisé ou expiré');
  const p = octets(j.donnees), ck = await crypto.subtle.importKey('raw', octets(n.transfert.k), 'AES-GCM', false, ['decrypt']);
  const o = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: p.slice(0, 12) }, ck, p.slice(12))));
  if (typeof o.c !== 'string' || !o.c.trim()) throw new Error('code illisible');
  return { c: o.c.trim(), l: typeof o.l === 'string' ? o.l.trim() : '' };
}
// presse-papiers vidé après un délai (lien ou clé copiés) ; sans effet si le navigateur le refuse
const viderPressePapiers = ms => setTimeout(() => { try { if (document.hasFocus()) navigator.clipboard.writeText('').catch(() => {}); } catch (e) { /* */ } }, ms);
function pretAConnecter() {
  if (adresse() && cle()) return true;
  etat('enregistre d\'abord l\'adresse et la clé'); return false;
}
let qrCharge = null;
$('montrer-qr').onclick = async () => {
  if (!pretAConnecter()) return;
  if (!$('qr').hidden) { $('qr').hidden = true; $('qr').removeAttribute('src'); $('montrer-qr').textContent = 'Montrer le code (téléphone)'; return; }
  qrCharge = qrCharge || new Promise((ok, ko) => { const s = document.createElement('script'); s.src = POLITIQUE.createScriptURL('qr.js'); s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  try {
    await qrCharge;
    const l = await lienConnexion();
    const q = qrcode(0, 'M'); q.addData(l.lien); q.make();
    $('qr').src = q.createDataURL(6, 2); $('qr').hidden = false; $('montrer-qr').textContent = 'Cacher le code';
    $('qr').alt = l.unique ? 'Code de connexion, valable une fois pendant 2 minutes' : 'Code de connexion (il contient ta clé)';
    etat(l.unique ? 'code valable une seule fois, pendant 2 minutes' : 'ce code contient ta clé (serveur à mettre à jour pour un code à usage unique)');
    setTimeout(() => { $('qr').hidden = true; $('qr').removeAttribute('src'); $('montrer-qr').textContent = 'Montrer le code (téléphone)'; }, 120e3);
  } catch (e) { qrCharge = null; etat('code indisponible : ' + raison(e)); }
};
// La clé ne s'affiche jamais : on la colle depuis le presse-papiers (copiée dans Ma carte de vie → Clé du lien) ou on la copie.
$('coller-cle').onclick = async () => {
  let v = ''; try { v = ((await navigator.clipboard.readText()) || '').trim(); } catch (e) { /* lecture refusée */ }
  if (!v) { $('cle').focus(); etat('colle la clé dans le champ (⌘V)'); return; }
  if (/\s/.test(v) || v.length < 12) { $('coller-cle').textContent = 'Pas une clé'; }
  else { $('cle').value = v; $('coller-cle').textContent = 'Clé collée ✓ — Enregistrer pour la garder'; }   // rien n'est enregistré ni validé ici
  setTimeout(() => { $('coller-cle').textContent = 'Coller la clé copiée'; }, 2500);
};
$('copier-cle').onclick = async () => {
  const v = $('cle').value.trim() || cle();
  if (!v) { $('copier-cle').textContent = 'Aucune clé'; }
  else { try { await navigator.clipboard.writeText(v); $('copier-cle').textContent = 'Clé copiée ✓'; viderPressePapiers(60e3); } catch (e) { $('copier-cle').textContent = 'Copie refusée'; } }
  setTimeout(() => { $('copier-cle').textContent = 'Copier la clé'; }, 2500);
};
$('tester').onclick = async () => {
  $('tester').textContent = 'Test…';
  try { await appel({ action: 'fil', depuis: depuisServeur() }); $('tester').textContent = 'Connectée ✓'; }
  catch (e) { $('tester').textContent = raison(e); }
  setTimeout(() => { $('tester').textContent = 'Tester la connexion'; }, 6000);
};
$('copier-lien').onclick = async () => {
  if (!pretAConnecter()) return;
  try { const l = await lienConnexion(); await navigator.clipboard.writeText(l.lien); viderPressePapiers(120e3);
    $('copier-lien').textContent = l.unique ? 'Lien copié ✓ (une fois, 2 min)' : 'Lien copié ✓'; }
  catch (e) { $('copier-lien').textContent = 'Copie refusée'; }
  setTimeout(() => { $('copier-lien').textContent = 'Copier le lien'; }, 2500);
};
$('dlg').addEventListener('close', () => { $('qr').hidden = true; $('qr').removeAttribute('src'); $('montrer-qr').textContent = 'Montrer le code (téléphone)'; });
// Installation : Chrome (Android, ordinateur) donne l'invitation « beforeinstallprompt » ; on la garde pour le bouton
// « Installer LIFE » affiché après une connexion par code. Sans elle (iPhone, ou Chrome qui croit l'app déjà là) : le geste à faire.
let invitation = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitation = e; });
window.addEventListener('appinstalled', () => { $('installe').hidden = true; annonce('LIFE est installée ✓'); });
function proposerInstallation() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;   // déjà ouverte comme app
  setTimeout(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!invitation) $('installe-txt').textContent = ios
      ? 'Pour l\'installer : touche Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ».'
      : 'Pour l\'installer : menu ⋮ de Chrome → « Installer l\'application » (ou « Ajouter à l\'écran d\'accueil »). Pas la flèche ⬇, qui enregistre seulement la page.';
    $('installe-ok').hidden = !invitation;
    $('installe')._ouvreur = document.activeElement !== document.body ? document.activeElement : null;
    $('installe').hidden = false; ($('installe-ok').hidden ? $('installe-non') : $('installe-ok')).focus();
  }, 1200);   // laisse à Chrome le temps d'envoyer son invitation
}
$('installe-ok').onclick = async () => {
  if (!invitation) return;
  invitation.prompt(); const r = await invitation.userChoice.catch(() => ({})); invitation = null;
  $('installe').hidden = true; if (r && r.outcome === 'accepted') annonce('installation en cours…');
};
function fermerInstalle() { $('installe').hidden = true; const o = $('installe')._ouvreur; if (o && o.isConnected && o.offsetParent) o.focus(); else $('saisie').focus(); }
$('installe-non').onclick = fermerInstalle;
// le message reste après la première actualisation, puis s'efface
function annonce(t) { setTimeout(() => bandeau(t, null, 5000), 1500); }
// Un lien reçu ne remplace JAMAIS l'adresse ni la clé sans confirmation : la boîte montre le serveur (son nom d'hôte).
// Même serveur que celui déjà enregistré : un toucher suffit. Serveur différent, ou aucun enregistré : il faut retaper
// son nom d'hôte (un lien piégé ne peut pas détourner les messages d'un simple toucher).
let connexionEnAttente = null;
const hoteDe = a => { try { return new URL(a).host.toLowerCase(); } catch (e) { return ''; } };
function recevoirConnexion(ev) {
  const m = location.hash.match(/^#(connexion|transfert)=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  let o;
  try {
    o = JSON.parse(decodeURIComponent(escape(deb64u(m[2]))));
    if (!/^https:\/\/[^\s]+$/.test(o.a || '') || !hoteDe(o.a)) throw new Error('lien incomplet');
    if (m[1] === 'transfert' ? !(/^[a-z0-9]{20,40}$/.test(o.i || '') && /^[A-Za-z0-9_-]{22}$/.test(o.k || '')) : (typeof o.c !== 'string' || !o.c.trim())) throw new Error('lien incomplet');
  } catch (e) { annonce('lien de connexion illisible'); return; }
  // code à usage unique : la clé n'est pas dans le lien, elle sera retirée du serveur après confirmation
  const nouveau = m[1] === 'transfert' ? { a: o.a, transfert: { i: o.i, k: o.k } } : { a: o.a, c: o.c.trim(), l: typeof o.l === 'string' ? o.l.trim() : '' };
  const hote = hoteDe(nouveau.a), actuel = adresse() ? hoteDe(adresse()) : '';
  if (!nouveau.transfert && nouveau.a === adresse() && nouveau.c === cle() && (!nouveau.l || nouveau.l === store.lire('cleLife', ''))) { annonce('cet appareil est déjà connecté ✓'); return; }
  const meme = actuel && actuel === hote, refuse = actuel && !meme;
  connexionEnAttente = refuse ? null : nouveau;
  $('cx-titre').textContent = refuse ? 'Lien refusé' : 'Connecter cet appareil ?';
  $('cx-hote').textContent = hote;
  // Appareil déjà relié à un serveur : un lien ne peut JAMAIS en changer (refus par défaut) ; même serveur : un toucher.
  $('cx-avert').textContent = refuse ? 'Cet appareil est relié au serveur « ' + actuel + ' ». Un lien ne peut pas le remplacer : rien n\'a changé. Pour changer de serveur, saisis toi-même l\'adresse dans les Réglages.'
    : meme ? 'C\'est le serveur déjà enregistré sur cet appareil : seule la clé sera mise à jour.'
    : 'Ne continue que si c\'est toi qui as créé ce lien (code montré par ton autre appareil).';
  $('cx-retaper').hidden = !!actuel; $('cx-saisie').value = '';
  $('cx-ok').hidden = !!refuse; $('cx-ok').disabled = !meme;
  $('cx-non').textContent = refuse ? 'Fermer' : 'Refuser';
  if ($('dlg').open) $('dlg').close();
  ouvrirDialogue($('dlg-connexion'));
  if (!actuel) $('cx-saisie').focus(); else $('cx-non').focus();   // par défaut : refuser
}
$('cx-saisie').addEventListener('input', () => {
  $('cx-ok').disabled = !connexionEnAttente || $('cx-saisie').value.trim().toLowerCase() !== hoteDe(connexionEnAttente.a);
});
$('cx-ok').onclick = async () => {
  const n = connexionEnAttente; if (!n) return;
  const actuel = adresse() ? hoteDe(adresse()) : '';
  if (actuel && actuel !== hoteDe(n.a)) return;   // jamais un autre serveur par un lien
  if (!actuel && $('cx-saisie').value.trim().toLowerCase() !== hoteDe(n.a)) return;
  connexionEnAttente = null; $('dlg-connexion').close();
  if (!actuel) {   // appareil neuf : la règle de sécurité du lancement n'autorise encore aucun serveur. On enregistre
    // l'adresse (et la clé si le lien la porte), puis on relance : la nouvelle règle nomme ce serveur exact, et la
    // connexion se termine (retrait du code à usage unique) après la relance.
    store.ecrire('adresseDuLien', true); store.effacer('curseur'); store.ecrire('adresse', n.a);
    if (!n.transfert) { store.ecrire('cle', n.c); if (n.l) store.ecrire('cleLife', n.l); }
    try { sessionStorage.setItem('life.reprise', JSON.stringify(n.transfert ? { a: n.a, transfert: n.transfert } : { a: n.a })); } catch (e) { /* sans reprise : les Réglages s'ouvriront */ }
    location.reload(); return;
  }
  finirConnexion(n, false);
};
// Fin d'une connexion par lien (même serveur, ou appareil neuf après la relance) ; neuf = l'adresse vient d'être posée.
async function finirConnexion(n, neuf) {
  if (n.transfert) {   // code à usage unique : la clé est retirée du serveur maintenant (une seule fois)
    try { Object.assign(n, await retirerTransfert(n)); }
    catch (e) {
      if (neuf) { store.effacer('adresse'); store.effacer('adresseDuLien'); store.effacer('curseur'); }   // rien de relié : comme avant le lien
      bandeau('Connexion impossible : ' + ((e && e.message) || 'code illisible') + '. Montre un nouveau code sur l\'autre appareil.', null, 9000, true);
      if (!(cle() && adresse())) setTimeout(ouvrirReglages, 300); return; }
    store.ecrire('cle', n.c); if (n.l) store.ecrire('cleLife', n.l);
  } else if (!neuf) { store.ecrire('adresse', n.a); store.ecrire('cle', n.c); if (n.l) store.ecrire('cleLife', n.l); }
  annonce('appareil connecté ✓'); proposerInstallation(); actualiser(); retirerServeur();
}
$('cx-non').onclick = () => {
  connexionEnAttente = null; $('dlg-connexion').close();
  bandeau('Lien de connexion ' + ($('cx-ok').hidden ? 'refusé' : 'ignoré') + ' : rien n\'a changé sur cet appareil.', null, 5000);
  if (!(cle() && adresse())) ouvrirReglages();
};
$('dlg-connexion').addEventListener('cancel', () => { connexionEnAttente = null; });
recevoirConnexion();
window.addEventListener('hashchange', recevoirConnexion);

// Mise à jour automatique : l'app vérifie s'il y a une nouvelle version à chaque retour au premier plan (et toutes les heures).
// La nouvelle version s'installe d'elle-même ; on recharge tout de suite si rien n'est en cours, sinon un bouton le propose.
if ('serviceWorker' in navigator) {
  const pageAvecSW = !!navigator.serviceWorker.controller;
  let recharge = false;
  const rechargerSiLibre = () => {
    if (recharge) return;
    if (!$('saisie').value.trim() && !$('dlg').open && !envoisEnCours) { recharge = true; location.reload(); }
    else $('maj').hidden = false;
  };
  $('maj').onclick = () => { recharge = true; location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (pageAvecSW) rechargerSiLibre(); });
  navigator.serviceWorker.register(POLITIQUE.createScriptURL('sw.js'), { updateViaCache: 'none' }).then(reg => {
    const verifier = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
    setInterval(verifier, 60 * 60e3);
  }).catch(() => {});
}
// Aperçu (?demo) : une conversation d'exemple, sans clé ni réseau.
setTimeout(() => { const o = $('ouverture'); if (o) { o.classList.add('fini'); setTimeout(() => o.remove(), 400); } }, 650);
// Reprise d'une connexion par lien sur un appareil neuf (voir « cx-ok ») : seulement si la règle de ce lancement nomme
// bien ce serveur, et une seule fois.
let reprise = null;
try { reprise = JSON.parse(sessionStorage.getItem('life.reprise') || 'null'); sessionStorage.removeItem('life.reprise'); } catch (e) { reprise = null; }
if (!reprise || typeof reprise.a !== 'string' || reprise.a !== adresse() || hoteDe(reprise.a) !== HOTE_CSP.toLowerCase()) reprise = null;
if (DEMO) {
  fil = 'general'; vus = {}; epingles = { travail: ['d5'] };
  messages = [
    { id: 'd1', t: '2026-10-13 07:50:00', auteur: 'systeme', fil: 'general', texte: '☀️ Bonjour — mardi 13 octobre\n\n━━ L\'essentiel\n• 1 suivi en retard, à reprendre aujourd\'hui.\n• 17 nouvelles offres d\'emploi.\n\n━━ Marchés\nLes marchés montent sans à-coup : rien d\'inhabituel cette semaine. La BCE parle jeudi, c\'est le rendez-vous à surveiller.' },
    { id: 'd2', t: '2026-10-13 09:12:00', auteur: 'moi', fil: 'general', texte: 'j\'ai combien de candidatures en attente ?' },
    { id: 'd3', t: '2026-10-13 09:12:06', auteur: 'life', fil: 'general', texte: '4 candidatures attendent une réponse. La plus ancienne : Atelier Dupont, envoyée il y a 12 jours — je te prépare une relance ?' },
    { id: 'd4', t: '2026-10-13 09:13:00', auteur: 'moi', fil: 'general', texte: 'oui' },
    { id: 'd4b', t: '2026-10-13 09:13:08', auteur: 'life', fil: 'general', texte: 'C\'est prêt : la relance est dans tes brouillons. Je te la rappelle vendredi si Dupont ne répond pas ?' },
    { id: 'd5', t: '2026-10-13 12:01:00', auteur: 'systeme', fil: 'travail', texte: '💼 2 offres qui te ressemblent\n★ Chef de projet — Agence A · 8/10\n★ Projeteur — Agence B · 8/10' },
    { id: 'd6', t: '2026-10-13 12:02:00', auteur: 'life', fil: 'travail', texte: 'La relance pour Atelier Dupont est prête en brouillon dans ta boîte mail.' },
    { id: 'd7', t: '2026-10-13 12:05:00', auteur: 'life', fil: 'travail', texte: 'Studio K a répondu : entretien proposé jeudi 10 h.' },
    { id: 'd9', t: '2026-10-13 07:55:00', auteur: 'systeme', fil: 'systeme', texte: '🛠 Rapport du système — mardi 13 octobre\n━━ En bref\n• 52 workflows en ordre · 0 erreur en 24 h\n• Quota : 612 / 2 500 exécutions ce mois-ci\n━━ À publier\n• Aucun brouillon en attente\n━━ Sécurité\n• Vérification de la carte : tout va bien' },
    { id: 'd8', t: '2026-10-13 19:00:00', auteur: 'systeme', fil: 'patrimoine', texte: '📚 Cours de finance n° 6 : « La diversification » — à lire dans l\'app, dans l\'app.' }
  ];
  afficher();
} else {
  afficher();
  if (reprise) finirConnexion(reprise, true);
  else if (cle() && adresse()) { actualiser(); retirerServeur(); if (Object.keys(enCours).length) attendreReponse(); } else if (!connexionEnAttente) ouvrirReglages();
}
