// LIFE — le script de l'app (sorti de index.html le 13/10 : la règle de sécurité CSP n'accepte plus aucun script en ligne).
// Contrat avec le serveur, version 2 : un identifiant client (cid) par message (jamais traité deux fois), un curseur donné
// par le serveur (pagination, suppressions propagées), « version » et « fils » dans chaque réponse. Sans « version »
// (ancien serveur), l'app garde un mode compatible. Tests : tests/lancer.mjs (app téléphone et app ordinateur).
/* l'adresse du serveur n'est pas dans ce code public : elle est collée dans les Réglages, avec la clé, et reste sur l'appareil */
function adresse() { try { const v = JSON.parse(localStorage.getItem('life.adresse') || '""'); return /^https:\/\/[^\s]+$/.test(v) ? v : ''; } catch (e) { return ''; } }
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
const svg = id => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[id] + '</svg>';
const $ = id => document.getElementById(id);
// Brief et Maintenance : des vues à part ; quand l'une est ouverte, aucun fil n'est marqué actif.
const enVueAPart = () => document.body.classList.contains('brief') || document.body.classList.contains('maintenance');
function majVues() {
  $('brief').setAttribute('aria-pressed', String(document.body.classList.contains('brief')));
  $('maintenance').setAttribute('aria-pressed', String(document.body.classList.contains('maintenance')));
}
function vue(nom) {   // 'brief', 'maintenance', ou null pour revenir à la conversation
  document.body.classList.toggle('brief', nom === 'brief'); document.body.classList.toggle('maintenance', nom === 'maintenance');
  majVues(); afficher();
  if (nom) { const r = $(nom === 'brief' ? 'vue-brief' : 'vue-maintenance').querySelector('.retour'); if (r) r.focus({ preventScroll: true }); }
}
function boutonRetour() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'retour';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg><span>Conversation</span>';
  b.onclick = () => vue(null); return b;
}
const DEMO = location.search.includes('demo');
// Stockage de l'appareil (partagé avec les autres apps du même site) : une écriture ratée (stockage plein) est signalée,
// jamais ignorée en silence. ecrire() rend false en cas d'échec.
let alerteStockage = 0;
const store = {
  lire(k, d) { try { const v = localStorage.getItem('life.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  ecrire(k, v, silence) {
    try { localStorage.setItem('life.' + k, JSON.stringify(v)); return true; }
    catch (e) { if (!silence) stockagePlein(k === 'messages' ? 'les derniers messages ne sont pas gardés hors ligne sur cet appareil' : 'un réglage n\'a pas pu être enregistré'); return false; }
  },
  effacer(k) { try { localStorage.removeItem('life.' + k); } catch (e) { /* stockage indisponible */ } }
};
function stockagePlein(quoi) {
  if (Date.now() - alerteStockage < 60e3) return;   // une fois par minute au plus
  alerteStockage = Date.now();
  setTimeout(() => bandeau('Stockage de l\'appareil plein : ' + quoi + '.', null, 10000, true), 0);
}
// Limite par fil (et non plus globale) : un fil très actif ne fait plus sortir les messages des fils calmes.
const PAR_FIL = 300, PAR_FIL_SERRE = 80;
function borner(l, max) {
  const n = {}, r = [];
  for (let i = l.length - 1; i >= 0; i--) { const f = l[i].fil || 'general'; n[f] = (n[f] || 0) + 1;
    if (n[f] <= max || l[i].temp || l[i].echec) r.push(l[i]); }
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
let messages = store.lire('messages', []);   // copie locale : l'app s'ouvre tout de suite, même hors ligne
// Un envoi interrompu (app fermée pendant l'attente) : la bulle revient en « Non envoyé · Réessayer », jamais perdue.
messages.forEach(m => { if (m.temp) { m.temp = false; m.echec = true; } });
let vus = store.lire('vus', {});              // fil → horodatage du dernier message lu
// Nouveaux messages d'un fil : ceux de LIFE ou du système arrivés après la dernière visite du fil.
function nonLus(id) { const v = vus[id] || ''; return messages.filter(m => (m.fil || 'general') === id && m.auteur !== 'moi' && !m.temp && m.t > v && !(m.auteur === 'systeme' && /^☀️/.test(m.texte || ''))).length; }
function marquerLu(id) {
  const l = messages.filter(m => (m.fil || 'general') === id);
  if (l.length) { vus[id] = l[l.length - 1].t; store.ecrire('vus', vus); }
}
function pastilleAppli() {   // le petit numéro sur l'icône de l'app (Android, app installée)
  const total = FILS.reduce((n, [id]) => n + (id === fil && document.visibilityState === 'visible' ? 0 : nonLus(id)), 0);
  try { if (navigator.setAppBadge) total ? navigator.setAppBadge(total) : navigator.clearAppBadge(); } catch (e) { /* non pris en charge */ }
}

// Message d'état : bandeau au-dessus de la saisie, lu par les lecteurs d'écran (role="status"), qui s'efface seul.
// action = [libellé, fonction] : un bouton dans le bandeau (« Annuler », « Réessayer »).
let minuterieBandeau = null;
function bandeau(texte, action, duree, important) {   // important : une actualisation réussie ne l'efface pas
  const z = $('bandeau'); clearTimeout(minuterieBandeau); z.innerHTML = ''; z.dataset.important = important ? '1' : '';
  if (!texte) { z.hidden = true; return; }
  const s = document.createElement('span'); s.textContent = texte; z.appendChild(s);
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action[0];
    b.onclick = e => { e.stopPropagation(); clearTimeout(minuterieBandeau); z.hidden = true; action[1](); }; z.appendChild(b); }
  z.hidden = false;
  minuterieBandeau = setTimeout(() => { z.hidden = true; }, duree || 4000);
}
function etat(t) { const z = $('bandeau'); if (t) bandeau(t); else if (!z.querySelector('button') && !(z.dataset.important && !z.hidden)) bandeau(''); }   // sans texte : efface, sauf un « Annuler » en cours
function ouvrirReglages() {
  $('accueil').hidden = !!(cle() && adresse());   // premier lancement : une phrase d'accueil avant la connexion
  $('cle').value = cle(); $('adresse').value = adresse();
  if (!$('dlg').open) $('dlg').showModal();
}
// Sans clé propre, LIFE reprend la clé du lien de Ma carte de vie (même site, même stockage) : une seule clé à coller.
function cle() { const c = store.lire('cle', ''); if (c) return c; try { return (localStorage.getItem('carte-de-vie-lien') || '').trim(); } catch (e) { return ''; } }

// Délai d'attente : 20 s ; 90 s pour les fils où l'IA réfléchit longtemps (Comité, Brainstorming, Experts).
const DELAI = 20e3, DELAI_LONG = 90e3, TEXTE_MAX = 2000;
const delaiPour = f => ['comite', 'brainstorm', 'experts'].includes(f) ? DELAI_LONG : DELAI;
// Contrat avec le serveur : un serveur à jour annonce sa version et ses fils dans chaque réponse.
// Sans « version » (ancien serveur), l'app garde un mode compatible (filsForces, « depuis »).
let versionServeur = store.lire('versionServeur', 0);
const serveurAJour = () => versionServeur >= 2;
let experts = store.lire('experts', []);   // identifiants des experts connus, donnés par le serveur (jamais dans ce code)
function noterExperts(j) { if (j && Array.isArray(j.experts)) { experts = j.experts.map(String).filter(x => /^[a-z0-9_]{2,40}$/.test(x)); store.ecrire('experts', experts); } }
function noterContrat(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return;
  const v = Number(j.version) || 0;
  if (v !== versionServeur) { versionServeur = v; store.ecrire('versionServeur', v); }
  if (serveurAJour() && Object.keys(filsForces).length) { filsForces = {}; store.effacer('filsForces'); }   // plus utile : purgée
  noterExperts(j);
}
async function appel(corps, o = {}) {
  if (!cle() || !adresse()) { ouvrirReglages(); throw new Error('clé ou adresse manquante'); }
  const ac = new AbortController(), minuterie = setTimeout(() => ac.abort(), o.delai || DELAI);
  try {
    let r;
    try { r = await fetch(o.url || adresse(), { method: 'POST', headers: { 'content-type': 'application/json', 'x-cle-app': cle() },
                                               body: JSON.stringify(corps), signal: ac.signal }); }
    catch (e) { if (ac.signal.aborted) throw new Error('délai dépassé'); throw e; }
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
function fusionner(nouveaux, retires) {
  const parId = new Map(messages.map(m => [m.id, m]));
  const partis = new Set((retires || []).map(String));   // suppressions faites sur un autre appareil
  partis.forEach(id => parId.delete(id));
  if (partis.size) Object.keys(epingles).forEach(f => { epingles[f] = (epingles[f] || []).filter(i => !partis.has(i)); });
  const cids = new Set(), textes = new Set();
  (nouveaux || []).forEach(m => {
    if (!m || !m.id || supprimes.has(m.id) || partis.has(m.id)) return;
    if (!serveurAJour() && filsForces[m.id]) m.fil = filsForces[m.id];
    parId.set(m.id, m);
    const c = cidDe(m.id); if (c) cids.add(c);
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
}
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

const AVATAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5L9 15M15 9l2.5-2.5"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';   // étincelle, cœur plein
const SVGC = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
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
      if (e) { t.innerHTML = ICONES_CARTE[e]; t.appendChild(document.createTextNode(sobre(l.slice(e.length).trim()))); }
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
// La suppression est d'abord locale et annulable pendant 5 s (bandeau « Annuler ») ; le serveur n'est prévenu qu'après.
let aRetirer = store.lire('aRetirer', []);   // suppressions confirmées, pas encore reçues par le serveur
let annulable = null;                        // { ids, avant, minuterie } : la dernière suppression, encore annulable
function supprimer(ids, libelle) {
  ids = ids.filter(Boolean); if (!ids.length) return;
  confirmerSuppression();   // une suppression précédente encore en attente part tout de suite
  const avant = { messages: messages.filter(m => ids.includes(m.id)), epingles: JSON.parse(JSON.stringify(epingles)) };
  ids.forEach(i => supprimes.add(i)); store.ecrire('supprimes', [...supprimes].slice(-3000));
  messages = messages.filter(m => !supprimes.has(m.id)); garderMessages();
  Object.keys(epingles).forEach(f => { epingles[f] = (epingles[f] || []).filter(i => !supprimes.has(i)); }); store.ecrire('epingles', epingles);
  afficher();
  annulable = { ids, avant, minuterie: setTimeout(confirmerSuppression, 5000) };
  bandeau(libelle || 'Message supprimé', ['Annuler', annulerSuppression], 5000);
}
function confirmerSuppression() {
  if (!annulable) return;
  const { ids, minuterie } = annulable; clearTimeout(minuterie); annulable = null;
  const serveur = ids.filter(i => !/^(tmp|loc)-/.test(i));
  if (!serveur.length) return;
  aRetirer = [...new Set(aRetirer.concat(serveur))].slice(-3000); store.ecrire('aRetirer', aRetirer);
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
  ids.forEach(i => supprimes.delete(i)); store.ecrire('supprimes', [...supprimes].slice(-3000));
  messages = messages.filter(m => !ids.includes(m.id)).concat(avant.messages).sort(ordre); garderMessages();
  epingles = avant.epingles; store.ecrire('epingles', epingles);
  afficher(); bandeau('Rétabli', null, 3000);
}
function fermerFeuilles() { document.querySelectorAll('.feuille-msg').forEach(x => x.remove()); }
function actionsMessage(m, b) {
  fermerFeuilles();
  if (!store.lire('aideAppui', false)) store.ecrire('aideAppui', true);   // le geste est connu : plus d'indice
  const f = document.createElement('div'); f.className = 'feuille-msg'; f.setAttribute('role', 'menu');
  const bt = (t, fn) => { const x = document.createElement('button'); x.type = 'button'; x.setAttribute('role', 'menuitem'); x.textContent = t;
    x.onclick = e => { e.stopPropagation(); f.remove(); fn(); }; f.appendChild(x); };
  const ep = (epingles[m.fil || 'general'] || []).includes(m.id);
  bt(ep ? 'Désépingler' : 'Épingler', () => epingler(m));
  bt('Copier', () => { try { navigator.clipboard.writeText(m.texte || '').then(() => bandeau('Copié', null, 2500), () => {}); } catch (e) { /* refusé */ } });
  bt('Supprimer', () => supprimer([m.id], 'Message supprimé'));
  b.appendChild(f); f.querySelector('button').focus({ preventScroll: true });
  setTimeout(() => document.addEventListener('click', () => f.remove(), { once: true }), 0);
}   // fil → [id]
function epingler(m) {
  const f = m.fil || 'general', l = epingles[f] || [];
  epingles[f] = l.includes(m.id) ? l.filter(x => x !== m.id) : [m.id].concat(l).slice(0, 3);
  store.ecrire('epingles', epingles);
  try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) { /* pas de vibreur */ }
  afficher();
}
function afficherEpingles() {
  const z = $('epingles'); z.innerHTML = '';
  if (document.body.classList.contains('brief') || document.body.classList.contains('maintenance')) return;
  (epingles[fil] || []).map(id => messages.find(m => m.id === id)).filter(Boolean).forEach(m => {
    const d = document.createElement('div'); d.className = 'epingle';
    d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 5 3 3H7l3-3zM12 15v5"/></svg><span></span><button aria-label="Désépingler"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    d.querySelector('span').textContent = sobre(m.texte.split('\n')[0]);
    d.querySelector('button').onclick = () => epingler(m);
    z.appendChild(d);
  });
}
function afficher() {
  afficherEpingles();
  $('saisie').placeholder = fil === 'experts' ? 'Ta question — ou « notaire : … » pour un expert précis' : fil === 'comite' ? 'Ta décision à prendre — /direct, /fiche, /vite, /comite' : fil === 'brainstorm' ? 'Un besoin, une idée : je pars dans tous les sens' : 'Écris à LIFE…';
  const nav = $('fils'), vueAPart = enVueAPart();
  nav.innerHTML = '';
  if (document.visibilityState !== 'hidden' && !vueAPart) marquerLu(fil);   // le fil ouvert est lu
  FILS.forEach(([id, nom]) => {
    const b = document.createElement('button'), n = id === fil && !vueAPart ? 0 : nonLus(id);
    b.type = 'button';
    b.innerHTML = svg(id) + '<span class="nom"></span>' + (n ? '<span class="badge" aria-hidden="true">' + (n > 99 ? '99+' : n) + '</span>' : '');
    b.querySelector('.nom').textContent = nom; b.classList.toggle('long', nom.length > 11); b.classList.toggle('moyen', nom.length > 8 && nom.length <= 11);
    b.setAttribute('aria-pressed', String(id === fil && !vueAPart));   // Brief ou Maintenance ouverts : aucun fil n'est actif
    b.setAttribute('aria-label', nom + (n ? ', ' + n + ' nouveau' + (n > 1 ? 'x' : '') + ' message' + (n > 1 ? 's' : '') : ''));
    b.onclick = () => { fil = id; store.ecrire('fil', fil); document.body.classList.remove('brief', 'maintenance'); majVues(); afficher(); };
    nav.appendChild(b);
  });
  pastilleAppli();
  const zone = $('messages'); zone.innerHTML = '';
  const estBrief = m => m.auteur === 'systeme' && /^☀️/.test(m.texte || '');
  const briefs = messages.filter(estBrief);
  const vb = $('vue-brief'); vb.innerHTML = ''; vb.appendChild(boutonRetour());
  if (!briefs.length) vb.insertAdjacentHTML('beforeend', '<div class="vide"><strong>Pas encore de brief</strong>Il arrive chaque matin à 7 h 50.</div>');
  else vb.appendChild(carteSysteme(briefs[briefs.length - 1]));
  // Brief et Maintenance : lus quand on ouvre leur section ; sinon un petit numéro sur leur bouton.
  if (document.body.classList.contains('brief') && briefs.length) { vus.brief = briefs[briefs.length - 1].t; store.ecrire('vus', vus); }
  const maint = messages.filter(m => m.fil === 'systeme');
  if (document.body.classList.contains('maintenance') && maint.length) { vus.systeme = maint[maint.length - 1].t; store.ecrire('vus', vus); }
  [['brief', briefs.filter(m => m.t > (vus.brief || '')).length], ['maintenance', maint.filter(m => m.t > (vus.systeme || '')).length]].forEach(([id, n]) => {
    const b = $(id), old = b.querySelector('.badge'); if (old) old.remove();
    if (n) { const x = document.createElement('span'); x.className = 'badge'; x.textContent = n > 9 ? '9+' : n; b.appendChild(x); }
  });
  const vm = $('vue-maintenance'); vm.innerHTML = ''; vm.appendChild(boutonRetour());
  if (!maint.length) vm.insertAdjacentHTML('beforeend', '<div class="vide"><strong>Rien à signaler</strong>Le rapport du système et ses alertes arrivent ici.</div>');
  else maint.slice(-10).forEach(m => vm.appendChild(carteSysteme(m)));
  if (document.body.classList.contains('maintenance')) vm.scrollTop = vm.scrollHeight;
  const liste = messages.filter(m => (m.fil || 'general') === fil && !estBrief(m));
  if (!liste.length) {
    zone.innerHTML = '<div class="vide"><strong>Rien ici pour l\'instant</strong>Écris à LIFE : une question, une idée, une chose à ne pas oublier.</div>';
    return;
  }
  let dernierJour = '';
  liste.forEach((m, k) => {
    const j = jourLisible(m.t);
    if (j && j !== dernierJour) { const s = document.createElement('div'); s.className = 'jour'; s.textContent = j; zone.appendChild(s); dernierJour = j; }
    const b = document.createElement('div');
    b.className = 'bulle ' + (m.auteur === 'moi' ? 'moi' : m.auteur === 'systeme' ? 'systeme info' : 'life') + (m.temp ? ' attente' : '') + (m.echec ? ' echec' : '');
    if (m.auteur === 'systeme') { remplirCarte(b, m.texte); b.dataset.etiquette = 'Info · ' + (FILS.find(f => f[0] === (m.fil || 'general')) || ['', ''])[1]; }
    else b.textContent = m.auteur === 'moi' ? m.texte : sobre(m.texte);   // texte brut : jamais interprété comme du HTML
    const suivant = liste[k + 1];
    const finDeGroupe = !suivant || suivant.auteur !== m.auteur || (suivant.t || '').slice(0, 15) !== (m.t || '').slice(0, 15);
    if (m.echec) {   // envoi raté : la bulle le dit, et se renvoie d'un toucher
      const r = document.createElement('button'); r.type = 'button'; r.className = 'reessayer'; r.textContent = 'Non envoyé · Réessayer';
      r.onclick = e => { e.stopPropagation(); reessayer(m); }; b.appendChild(r);
    } else if (m.temp || finDeGroupe) {   // l'heure une fois par groupe de messages rapprochés
      const h = document.createElement('span'); h.className = 'heure'; h.textContent = m.temp ? 'envoi…' : heure(m.t); b.appendChild(h);
    }
    if (m.auteur === 'life') {   // avatar de LIFE, une fois par groupe
      const l = document.createElement('div'); l.className = 'ligne-life';
      const a = document.createElement('span'); a.className = 'avatar' + (finDeGroupe ? '' : ' vide'); a.innerHTML = AVATAR;
      l.appendChild(a); l.appendChild(b); zone.appendChild(l);
    } else zone.appendChild(b);
    let appui = null;   // appui long (0,6 s) : épingler en haut du fil
    b.addEventListener('pointerdown', () => { appui = setTimeout(() => { try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* */ } actionsMessage(m, b); }, 550); });
    b.addEventListener('contextmenu', e => { e.preventDefault(); actionsMessage(m, b); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(appui)));
    if (!suivant && m.auteur === 'life' && /\?\s*$/.test(m.texte) && !envoisEnCours) {   // elle peut répondre d'un toucher
      const r = document.createElement('div'); r.className = 'rapides';
      ['Oui', 'Plus tard', 'Non merci'].forEach(t => { const x = document.createElement('button'); x.textContent = t;
        x.onclick = () => { $('saisie').value = t; envoyer(); }; r.appendChild(x); });
      zone.appendChild(r);
    }
  });
  if (!store.lire('aideAppui', false)) {   // indice discret, jusqu'à ce qu'il soit lu ou que le geste soit utilisé
    const a = document.createElement('div'); a.className = 'aide';
    const s = document.createElement('span');
    s.textContent = (matchMedia('(pointer: fine)').matches ? 'Clic droit' : 'Appui long') + ' sur un message : épingler, copier ou supprimer.';
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Compris';
    ok.onclick = () => { store.ecrire('aideAppui', true); a.remove(); };
    a.appendChild(s); a.appendChild(ok); zone.appendChild(a);
  }
  if (envoisEnCours) { const e = document.createElement('div'); e.className = 'ecrit'; e.setAttribute('aria-label', 'LIFE écrit');
    e.innerHTML = '<i></i><i></i><i></i>'; zone.appendChild(e); }
  zone.scrollTop = zone.scrollHeight;
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
    } catch (e) { etat(raison(e)); }
    finally { actuEnCours = null; }
  })();
  return actuEnCours;
}
// Dire pourquoi la connexion ne passe pas, au lieu d'un simple « hors ligne » (Réglages → « Tester la connexion »).
function raison(e) {
  const m = (e && e.message) || '';
  if (/manquante/.test(m)) return 'pas connectée : adresse ou clé manquante';
  if (m === 'clé refusée') return 'clé refusée — vérifie les réglages';
  if (m === 'délai dépassé') return 'pas de réponse à temps (réseau lent ?) — le message est peut-être arrivé ; « Réessayer » ne le traitera pas deux fois';
  if (m === 'fil inconnu') return 'le serveur ne connaît pas ce fil — sa dernière version doit être installée puis publiée';
  if (/erreur 404/.test(m)) return 'serveur introuvable (404) — lien LIFE pas encore publié dans ton système ?';
  if (/^erreur \d/.test(m)) return 'le serveur répond mal (' + m + ')';
  if (!navigator.onLine) return 'hors ligne';
  if (e instanceof TypeError) return 'serveur injoignable — connexion instable ou adresse à vérifier';
  return m.slice(0, 120) || 'hors ligne';
}

function heureLocale() { const d = new Date(), z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); }
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
// Un envoi = un identifiant client (cid). Le même cid est renvoyé par « Réessayer » : le serveur ne traite jamais deux fois.
async function expedier(texte, filCible, cid) {
  const temp = { id: 'tmp-' + cid, cid, t: heureLocale(), auteur: 'moi', fil: filCible, texte, temp: true };
  try { if (navigator.vibrate && !enCalme()) navigator.vibrate(12); } catch (e) { /* pas de vibreur */ }
  messages.push(temp); garderMessages();   // gardée sur l'appareil AVANT l'envoi (app fermée pendant l'attente : rien de perdu)
  envoisEnCours++; afficher();
  const retirerTemp = () => { messages = messages.filter(m => m.id !== temp.id); };
  try {
    if (filCible === 'experts') {
      if (!cle() || !adresse()) { ouvrirReglages(); throw new Error('clé ou adresse manquante'); }
      const rep = await demanderExpert(texte);
      retirerTemp();
      fusionner([Object.assign({}, temp, { id: 'loc-' + cid, temp: false, local: true, expert: true }),
        ...rep.map((x, k) => ({ id: 'loc-' + cid + '-' + k, t: heureLocale(), auteur: 'life', fil: 'experts', texte: x.nom + '\n' + x.texte, local: true, expert: true }))]);
      etat(''); return true;
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
    if (serveurAJour() && k !== null && Number.isInteger(j.curseur)) { majCurseur(j.curseur); derniereActu = Date.now(); if (j.plus) actualiser(); }
    etat('');
    if (j.tronque) bandeau('Le serveur a gardé les ' + j.tronque + ' premiers caractères de ce message.', null, 6000);
    if (horsFil && filCible !== 'general') bandeau('Le serveur ne connaît pas encore le fil ' + ((FILS.find(x => x[0] === filCible) || [0, filCible])[1]) + ' : c\'est Général qui a répondu. La dernière version du serveur doit être installée puis publiée.', null, 9000);
    return true;
  } catch (e) {
    // la bulle reste (remise dans la liste si une fusion l'avait écartée), marquée « Non envoyé · Réessayer », gardée sur l'appareil
    let m = messages.find(x => x.cid === cid && !duServeur(x));
    if (!m) { m = temp; messages.push(m); messages.sort(ordre); }
    m.temp = false; m.echec = true;
    garderMessages();
    bandeau(e.message === 'clé refusée' ? 'Non envoyé : clé refusée, vérifie les réglages' : 'Non envoyé : ' + raison(e), ['Réessayer', () => reessayer(m)], e.message === 'délai dépassé' ? 9000 : 5000);
    if (e.message === 'délai dépassé' && serveurAJour()) setTimeout(actualiser, 30e3);   // la réponse a pu arriver entre-temps
    return false;
  } finally {
    envoisEnCours = Math.max(0, envoisEnCours - 1); afficher();
  }
}
function reessayer(m) {   // renvoie un message resté « Non envoyé », dans son fil, avec le même cid, sans toucher à la saisie
  messages = messages.filter(x => x !== m && x.id !== m.id); garderMessages();
  if (m.fil && m.fil !== fil) { fil = m.fil; store.ecrire('fil', fil); }
  if (enVueAPart()) { document.body.classList.remove('brief', 'maintenance'); majVues(); }
  expedier(m.texte, m.fil || fil, m.cid || nouvelId());
}

function ajuster() {
  const s = $('saisie'); s.style.height = 'auto'; s.style.height = Math.min(s.scrollHeight, 140) + 'px';
  $('envoyer').disabled = !s.value.trim();
}

// Dictée : reconnaissance vocale du navigateur (Chrome Android), gratuite, rien n'est envoyé ailleurs que ton message.
const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
let reco = null;
$('micro').onclick = () => {
  if (!Reco) { etat('dictée non disponible ici'); return; }
  if (reco) { reco.stop(); return; }
  reco = new Reco(); reco.lang = 'fr-FR'; reco.interimResults = true; reco.continuous = false;
  const base = $('saisie').value ? $('saisie').value + ' ' : '';
  reco.onresult = ev => { $('saisie').value = base + [...ev.results].map(r => r[0].transcript).join(''); ajuster(); };
  reco.onend = () => { reco = null; $('micro').classList.remove('actif'); };
  reco.onerror = () => { etat('micro indisponible'); };
  $('micro').classList.add('actif'); reco.start();
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
function fermerRecherche() { $('recherche').hidden = true; $('q').value = ''; afficher(); }
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
  if (!$('installe').hidden) { $('installe').hidden = true; return; }
  if (document.querySelector('.feuille-msg')) { fermerFeuilles(); return; }
  if (!$('menu').hidden) { fermerMenu(); $('plus').focus(); return; }
  if (!$('recherche').hidden) { fermerRecherche(); $('chercher').focus(); return; }
  if (enVueAPart()) { vue(null); $('saisie').focus(); }
});
$('q').addEventListener('input', () => {
  const q = $('q').value.trim().toLowerCase(), zone = $('messages');
  if (q.length < 2) { afficher(); return; }
  zone.innerHTML = '';
  const trouves = messages.filter(m => (m.texte || '').toLowerCase().includes(q)).slice(-40).reverse();
  if (!trouves.length) { zone.innerHTML = '<div class="vide"><strong>Rien trouvé</strong>Essaie un autre mot.</div>'; return; }
  trouves.forEach(m => {
    const b = document.createElement('div'); b.className = 'bulle life resultat';
    const ou = document.createElement('span'); ou.className = 'ou';
    ou.textContent = (m.fil === 'systeme' ? 'Maintenance' : (FILS.find(f => f[0] === (m.fil || 'general')) || ['', 'Général'])[1]) + ' · ' + jourLisible(m.t);
    b.appendChild(ou);
    const t = m.texte, i = t.toLowerCase().indexOf(q), debut = Math.max(0, i - 60);
    b.appendChild(document.createTextNode((debut ? '…' : '') + t.slice(debut, i)));
    const mk = document.createElement('mark'); mk.textContent = t.slice(i, i + q.length); b.appendChild(mk);
    b.appendChild(document.createTextNode(t.slice(i + q.length, i + q.length + 120) + '…'));
    b.onclick = () => { $('recherche').hidden = true; $('q').value = ''; if (m.fil !== 'systeme') { fil = m.fil || 'general'; store.ecrire('fil', fil); afficher(); } else vue('maintenance'); };
    zone.appendChild(b);
  });
});
// Ne pas déranger (21 h – 8 h) : pas de vibration ; servira aussi aux notifications.
let calme = store.lire('calme', false);
const libelleCalme = () => { $('calme').textContent = 'Ne pas déranger 21 h – 8 h : ' + (calme ? 'oui' : 'non'); };
libelleCalme();
$('calme').onclick = () => { calme = !calme; store.ecrire('calme', calme); libelleCalme(); };
const enCalme = () => { const h = new Date().getHours(); return calme && (h >= 21 || h < 8); };
function fermerMenu() { $('menu').hidden = true; $('plus').setAttribute('aria-expanded', 'false'); }
$('plus').onclick = e => { e.stopPropagation(); const o = $('menu').hidden; $('menu').hidden = !o; $('plus').setAttribute('aria-expanded', String(o));
  if (o) $('menu').querySelector('button').focus({ preventScroll: true }); };
document.addEventListener('click', fermerMenu);
$('actualiser').onclick = actualiser;
// Effacer ce fil : tout de suite à l'écran, annulable 5 s (bandeau « Annuler ») avant de partir au serveur.
$('effacer-fil').onclick = () => { fermerMenu(); if (enVueAPart()) vue(null);
  const nom = (FILS.find(([i]) => i === fil) || [, 'ce fil'])[1];
  const ids = messages.filter(m => (m.fil || 'general') === fil).map(m => m.id);
  if (!ids.length) { bandeau('Rien à effacer dans « ' + nom + ' »', null, 2500); return; }
  supprimer(ids, 'Fil effacé (' + ids.length + ' message' + (ids.length > 1 ? 's' : '') + ')'); };
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
$('garder').onclick = () => { store.ecrire('cle', $('cle').value.trim()); store.ecrire('adresse', $('adresse').value.trim()); $('dlg').close(); actualiser(); };
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
const DANS_CARTE = (() => { try { return window.top !== window && window.parent.location.pathname.indexOf('/carte-de-vie') === 0; } catch (e) { return false; } })();
if (DANS_CARTE) { document.body.classList.add('dans-carte'); $('retour-carte').hidden = false; $('vers-carte').hidden = true;
  $('retour-carte').onclick = () => { try { window.parent.postMessage({ life: 'fermer' }, location.origin); } catch (e) { /* */ } }; }
$('vers-carte').onclick = () => { $('menu').hidden = true; location.href = '../carte-de-vie/'; };
const VERSION = 'V.0.0.29';   // à augmenter à chaque mise en ligne (avec CACHE dans sw.js)
$('version').textContent = 'Version ' + VERSION + ' · mise à jour automatique'; $('ver-haut').textContent = VERSION;
function lienConnexion() {
  const d = btoa(unescape(encodeURIComponent(JSON.stringify({ a: adresse(), c: cle() })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '#connexion=' + d;
}
function pretAConnecter() {
  if (adresse() && cle()) return true;
  etat('enregistre d\'abord l\'adresse et la clé'); return false;
}
let qrCharge = null;
$('montrer-qr').onclick = async () => {
  if (!pretAConnecter()) return;
  if (!$('qr').hidden) { $('qr').hidden = true; $('qr').removeAttribute('src'); $('montrer-qr').textContent = 'Montrer le code (téléphone)'; return; }
  qrCharge = qrCharge || new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'qr.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  try {
    await qrCharge;
    const q = qrcode(0, 'M'); q.addData(lienConnexion()); q.make();
    $('qr').src = q.createDataURL(6, 2); $('qr').hidden = false; $('montrer-qr').textContent = 'Cacher le code';
    setTimeout(() => { $('qr').hidden = true; $('qr').removeAttribute('src'); $('montrer-qr').textContent = 'Montrer le code (téléphone)'; }, 120e3);
  } catch (e) { qrCharge = null; etat('code indisponible hors ligne'); }
};
// La clé ne s'affiche jamais : on la colle depuis le presse-papiers (copiée dans Ma carte de vie → Clé du lien) ou on la copie.
$('coller-cle').onclick = async () => {
  let v = ''; try { v = ((await navigator.clipboard.readText()) || '').trim(); } catch (e) { /* lecture refusée */ }
  if (!v) { $('cle').focus(); etat('colle la clé dans le champ (⌘V)'); return; }
  if (/\s/.test(v) || v.length < 12) { $('coller-cle').textContent = 'Pas une clé'; }
  else { $('cle').value = v; store.ecrire('cle', v); $('coller-cle').textContent = 'Clé collée ✓'; }
  setTimeout(() => { $('coller-cle').textContent = 'Coller la clé copiée'; }, 2500);
};
$('copier-cle').onclick = async () => {
  const v = $('cle').value.trim() || cle();
  if (!v) { $('copier-cle').textContent = 'Aucune clé'; }
  else { try { await navigator.clipboard.writeText(v); $('copier-cle').textContent = 'Clé copiée ✓'; } catch (e) { $('copier-cle').textContent = 'Copie refusée'; } }
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
  try { await navigator.clipboard.writeText(lienConnexion()); $('copier-lien').textContent = 'Lien copié ✓'; }
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
    $('installe').hidden = false;
  }, 1200);   // laisse à Chrome le temps d'envoyer son invitation
}
$('installe-ok').onclick = async () => {
  if (!invitation) return;
  invitation.prompt(); const r = await invitation.userChoice.catch(() => ({})); invitation = null;
  $('installe').hidden = true; if (r && r.outcome === 'accepted') annonce('installation en cours…');
};
$('installe-non').onclick = () => { $('installe').hidden = true; };
// le message reste après la première actualisation, puis s'efface
function annonce(t) { setTimeout(() => bandeau(t, null, 5000), 1500); }
// Un lien reçu ne remplace JAMAIS l'adresse ni la clé sans confirmation : la boîte montre le serveur (son nom d'hôte).
// Même serveur que celui déjà enregistré : un toucher suffit. Serveur différent, ou aucun enregistré : il faut retaper
// son nom d'hôte (un lien piégé ne peut pas détourner les messages d'un simple toucher).
let connexionEnAttente = null;
const hoteDe = a => { try { return new URL(a).host.toLowerCase(); } catch (e) { return ''; } };
function recevoirConnexion(ev) {
  const m = location.hash.match(/^#connexion=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  let o;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    o = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
    if (!/^https:\/\/[^\s]+$/.test(o.a || '') || !hoteDe(o.a) || typeof o.c !== 'string' || !o.c.trim()) throw new Error('lien incomplet');
  } catch (e) { annonce('lien de connexion illisible'); return; }
  const nouveau = { a: o.a, c: o.c.trim() }, hote = hoteDe(nouveau.a), actuel = adresse() ? hoteDe(adresse()) : '';
  if (nouveau.a === adresse() && nouveau.c === cle()) { annonce('cet appareil est déjà connecté ✓'); return; }
  connexionEnAttente = nouveau;
  const meme = actuel && actuel === hote;
  $('cx-hote').textContent = hote;
  $('cx-avert').textContent = meme ? 'C\'est le serveur déjà enregistré sur cet appareil : seule la clé sera mise à jour.'
    : actuel ? 'Attention : cet appareil est déjà relié au serveur « ' + actuel + ' ». Ce lien le remplacerait. Ne continue que si c\'est toi qui as créé ce lien.'
    : 'Ne continue que si c\'est toi qui as créé ce lien (code montré par ton autre appareil).';
  $('cx-retaper').hidden = !!meme; $('cx-saisie').value = '';
  $('cx-ok').disabled = !meme;
  if ($('dlg').open) $('dlg').close();
  if (!$('dlg-connexion').open) $('dlg-connexion').showModal();
  if (!meme) $('cx-saisie').focus();
}
$('cx-saisie').addEventListener('input', () => {
  $('cx-ok').disabled = !connexionEnAttente || $('cx-saisie').value.trim().toLowerCase() !== hoteDe(connexionEnAttente.a);
});
$('cx-ok').onclick = () => {
  const n = connexionEnAttente; if (!n) return;
  const meme = adresse() && hoteDe(adresse()) === hoteDe(n.a);
  if (!meme && $('cx-saisie').value.trim().toLowerCase() !== hoteDe(n.a)) return;
  connexionEnAttente = null; $('dlg-connexion').close();
  store.ecrire('adresse', n.a); store.ecrire('cle', n.c); store.effacer('curseur');
  annonce('appareil connecté ✓'); proposerInstallation(); actualiser(); retirerServeur();
};
$('cx-non').onclick = () => {
  connexionEnAttente = null; $('dlg-connexion').close();
  bandeau('Lien de connexion refusé : rien n\'a changé sur cet appareil.', null, 5000);
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
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const verifier = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
    setInterval(verifier, 60 * 60e3);
  }).catch(() => {});
}
// Aperçu (?demo) : une conversation d'exemple, sans clé ni réseau.
setTimeout(() => { const o = $('ouverture'); if (o) { o.classList.add('fini'); setTimeout(() => o.remove(), 400); } }, 650);
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
  if (cle() && adresse()) { actualiser(); retirerServeur(); } else if (!connexionEnAttente) ouvrirReglages();
}
