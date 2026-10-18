// V.0.0.5.1 : le Comité a deux modes (« Les 5 voix » / « Les personnes du sujet ») ; la table (5 à 8 sièges) et la voix qui parle
// viennent d'un CHAMP structuré `comite` du serveur, plus d'un nom en tête du texte. Sans champ, rien ne s'allume.
import { fauxServeur, ouvrir, ls, pause, attendre, choisirFil, ecrire } from './outils.mjs';

const PERSONNES = ['Notaire', 'Banquier', 'Artisan', 'Voisin', 'Agent', 'Toi dans 10 ans', 'Assureur'].map(n => ({ id: n.toLowerCase().replace(/ /g, '-'), nom: n }));
const champ = (mode, membres, parle) => JSON.stringify({ mode, membres, parle });
const VOIX = [['raison', 'la raison'], ['coeur', 'le cœur'], ['argent', 'l\'argent'], ['temps', 'le temps'], ['futur', 'toi dans 5 ans']].map(([id, nom]) => ({ id, nom }));
const etatTable = p => p.evaluate(() => { const z = document.getElementById('comite');
  return z && !z.hidden ? { sieges: [...z.querySelectorAll('.cm-siege')].map(e => e.querySelector('small').textContent), allume: [...z.querySelectorAll('.cm-siege.parle')].map(e => e.querySelector('small').textContent),
    parole: z.querySelector('.cm-parole').textContent, modes: [...z.querySelectorAll('.cm-mode')].map(b => [b.textContent, b.getAttribute('aria-pressed')]), centre: z.querySelector('.cm-centre').textContent } : null; });
const cliquerMode = (p, nom) => p.evaluate(n => [...document.querySelectorAll('#comite .cm-mode')].find(b => b.textContent === n).click(), nom);
const ouvrirComite = async ({ nav, st, profil }, S) => { const A = await ouvrir(nav, st, profil, S); await choisirFil(A.page, 'Comité'); await pause(300); return A; };

export const tests = [
  { nom: 'Comité, « Les 5 voix » : la voix qui parle vient du champ ; un nom en tête du texte n\'allume plus rien', f: async function ({ nav, st, profil, verif }) {
    const S = fauxServeur();
    S.ajouter({ id: 'C-1-a', horodatage: S.heure(-2000), fil: 'comite', texte: 'Rester ou partir ?', auteur: 'moi' });
    S.ajouter({ id: 'C-1-b', horodatage: S.heure(-1000), fil: 'comite', texte: 'La raison dirait de compter. Qu\'est-ce qui te retient ?', auteur: 'life', comite: champ('voix', VOIX, 'argent') });
    const A = await ouvrirComite(arguments[0], S), p = A.page;
    let e = await etatTable(p);
    verif(e && e.sieges.length === 5 && e.modes[0][1] === 'true' && e.modes[1][1] === 'false', 'mode par défaut : les 5 voix, bouton pressé', e);
    verif(e.allume.length === 1 && e.allume[0] === 'l\'argent' && /L'ARGENT PREND LA PAROLE/.test(e.parole), 'la voix du champ (l\'argent) est allumée, pas « la raison » citée dans le texte', e);
    verif(/La raison dirait de compter/.test(e.parole), 'le texte reste naturel, affiché tel quel', e.parole);
    // sans champ (ancien serveur) : texte lisible, rien allumé
    S.ajouter({ id: 'C-2-b', horodatage: S.heure(), fil: 'comite', texte: 'Le cœur : et si tu écoutais ce que tu ressens ?', auteur: 'life' });
    await p.evaluate(() => { document.getElementById('plus').click(); document.getElementById('actualiser').click(); });
    await attendre(async () => /Le cœur : et si/.test((await etatTable(p) || {}).parole || ''));
    e = await etatTable(p);
    verif(e.sieges.length === 5 && e.allume.length === 0 && /LE COMITÉ PREND LA PAROLE/.test(e.parole) && /Le cœur : et si/.test(e.parole), 'sans champ : rien ne s\'allume, le texte reste lisible', e);
    await A.ctx.close();
  } },
  { nom: 'Comité, « Les personnes du sujet » : 5 à 8 sièges selon le champ, voix qui parle allumée, retour aux 5 voix', f: async function ({ nav, st, profil, verif, tel }) {
    const S = fauxServeur();
    S.ajouter({ id: 'C-1-a', horodatage: S.heure(-2000), fil: 'comite', texte: 'Acheter un appartement ?', auteur: 'moi' });
    S.ajouter({ id: 'C-1-b', horodatage: S.heure(-1000), fil: 'comite', texte: 'Combien peux-tu emprunter ?', auteur: 'life', comite: champ('personnes', PERSONNES, 'banquier') });
    const A = await ouvrirComite(arguments[0], S), p = A.page;
    await cliquerMode(p, 'Les personnes du sujet'); await pause(250);
    let e = await etatTable(p);
    verif(e.modes[1][1] === 'true' && e.sieges.length === 7 && e.sieges.includes('Banquier') && e.sieges.includes('Toi dans 10 ans'), 'mode personnes : 7 sièges du champ', e);
    verif(e.allume.join() === 'Banquier' && /BANQUIER PREND LA PAROLE/.test(e.parole), 'le banquier parle', e);
    verif((await ls(p, 'comiteMode')) === 'personnes', 'le choix est gardé sur l\'appareil');
    const g = await p.evaluate(() => { const z = document.getElementById('comite').getBoundingClientRect(), t = document.querySelector('#comite .cm-table').getBoundingClientRect();
      const hors = [...document.querySelectorAll('#comite .cm-siege')].filter(s => { const r = s.getBoundingClientRect(); return r.left < z.left - 1 || r.right > z.right + 1; }).length;
      return { hors, debord: document.documentElement.scrollWidth > innerWidth, large: t.width }; });
    verif(g.hors === 0 && !g.debord, 'aucun siège ne sort du cadre, pas de défilement horizontal', g);
    await cliquerMode(p, 'Les 5 voix'); await pause(250);
    e = await etatTable(p);
    verif(e.sieges.length === 5 && e.allume.length === 0 && e.sieges[4] === 'toi dans 5 ans', 'retour aux 5 voix : table fixe, rien d\'allumé (la dernière réponse était d\'un autre mode)', e);
    await A.ctx.close();
  } },
  { nom: 'Comité : mode « personnes » sans table → pas de siège, une aide ; 8 sièges au plus ; champ invalide ignoré', f: async function ({ nav, st, profil, verif }) {
    const S = fauxServeur();
    const A = await ouvrirComite(arguments[0], S), p = A.page;
    await cliquerMode(p, 'Les personnes du sujet'); await pause(250);
    let e = await etatTable(p);
    verif(e.sieges.length === 0 && /choisira les personnes/.test(e.centre), 'aucune table inventée tant que le serveur n\'a rien choisi', e);
    const invalides = [champ('personnes', PERSONNES.slice(0, 3), 'notaire'), champ('personnes', PERSONNES.concat(PERSONNES).map((m, i) => ({ id: m.id + i, nom: m.nom })), ''), 'pas du json',
      champ('personnes', PERSONNES.slice(0, 4).concat([{ id: 'Maj', nom: 'x' }]), ''), champ('inconnu', PERSONNES, '')];
    invalides.forEach((c, i) => S.ajouter({ id: 'C-' + i + '-b', horodatage: S.heure(i - 20), fil: 'comite', texte: 'Réponse ' + i, auteur: 'life', comite: c }));
    S.ajouter({ id: 'C-9-b', horodatage: S.heure(), fil: 'comite', texte: 'Huit sièges', auteur: 'life',
      comite: champ('personnes', PERSONNES.concat([{ id: 'maire', nom: 'Maire' }]).slice(0, 8), 'maire') });
    await p.evaluate(() => { document.getElementById('plus').click(); document.getElementById('actualiser').click(); });
    await attendre(async () => /Huit sièges/.test((await etatTable(p) || {}).parole || ''));
    e = await etatTable(p);
    verif(e.sieges.length === 8 && e.allume.join() === 'Maire', 'huit sièges (le plus), le maire parle', e);
    await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('life.messages') || '[]'); localStorage.setItem('life.messages', JSON.stringify(l.filter(m => m.id !== 'C-9-b'))); });
    await A.ctx.close();
  } },
  { nom: 'Comité : le mode (et la table actuelle) partent avec chaque message du fil Comité, et seulement lui', f: async function ({ nav, st, profil, verif }) {
    const S = fauxServeur();
    S.ajouter({ id: 'C-1-a', horodatage: S.heure(-2000), fil: 'comite', texte: 'Acheter un appartement ?', auteur: 'moi' });
    S.ajouter({ id: 'C-1-b', horodatage: S.heure(-1000), fil: 'comite', texte: 'Combien peux-tu emprunter ?', auteur: 'life', comite: champ('personnes', PERSONNES.slice(0, 6), 'notaire') });
    const A = await ouvrirComite(arguments[0], S), p = A.page;
    const dernier = () => S.appels.filter(a => a.corps.action === 'envoyer').pop().corps;
    await ecrire(p, 'Je ne sais pas encore'); await attendre(async () => S.appels.some(a => a.corps.action === 'envoyer'));
    verif(dernier().mode === 'voix' && !('membres' in dernier()), 'mode par défaut : « voix », sans table à renvoyer', dernier());
    await cliquerMode(p, 'Les personnes du sujet'); await pause(200);
    const n = S.appels.filter(a => a.corps.action === 'envoyer').length;
    await ecrire(p, 'Plutôt 250 000 euros'); await attendre(async () => S.appels.filter(a => a.corps.action === 'envoyer').length > n);
    verif(dernier().mode === 'personnes' && dernier().membres.length === 6 && dernier().membres[0].nom === 'Notaire', 'mode « personnes » : la table actuelle repart avec le message', dernier());
    const m = S.appels.filter(a => a.corps.action === 'envoyer').length;
    await ecrire(p, '/comite Louer ou rester ?'); await attendre(async () => S.appels.filter(a => a.corps.action === 'envoyer').length > m);
    verif(dernier().mode === 'personnes' && !('membres' in dernier()), 'nouvelle décision (/comite) : le serveur recompose la table', dernier());
    await choisirFil(p, 'Travail'); await pause(200);
    const k = S.appels.filter(a => a.corps.action === 'envoyer').length;
    await ecrire(p, 'Un point sur le travail'); await attendre(async () => S.appels.filter(a => a.corps.action === 'envoyer').length > k);
    verif(!('mode' in dernier()) && !('membres' in dernier()), 'dans un autre fil, ni mode ni table', dernier());
    await A.ctx.close();
  } },
  { nom: 'Comité : ancien serveur (sans champ) — l\'app reste lisible, rien ne s\'allume, aucune erreur', f: async function ({ nav, st, profil, verif }) {
    const S = fauxServeur({ ancien: true });
    S.ajouter({ id: 'C-1-a', horodatage: S.heure(-2000), fil: 'comite', texte: 'Rester ou partir ?', auteur: 'moi' });
    S.ajouter({ id: 'C-1-b', horodatage: S.heure(-1000), fil: 'comite', texte: 'La raison : que dit ton budget ?', auteur: 'life' });
    const A = await ouvrirComite(arguments[0], S), p = A.page;
    let e = await etatTable(p);
    verif(e.sieges.length === 5 && e.allume.length === 0 && /que dit ton budget/.test(e.parole), 'texte lisible, table à 5 voix, rien d\'allumé', e);
    await ecrire(p, 'Mon budget est serré'); await attendre(async () => S.appels.some(a => a.corps.action === 'envoyer'));
    await pause(500);
    const erreurs = await p.evaluate(() => document.getElementById('bandeau') ? document.getElementById('bandeau').textContent : '');
    verif(!/erreur|refus/i.test(erreurs), 'l\'envoi avec mode et table ne dérange pas un ancien serveur', erreurs);
    await A.ctx.close();
  } },
];
