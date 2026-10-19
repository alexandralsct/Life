// V.0.0.5.4 (pre-mortem du 18/10, T2 « appareil délié », remis à niveau sur la connexion simplifiée) : clé absente, adresse absente, clé refusée, serveur injoignable,
// appareil neuf : ce que voit la propriétaire, et le chemin de reliage en gestes.
import { fauxServeur, ouvrir, ls, pause, attendre, ecrire } from './outils.mjs';

const dlg = p => p.evaluate(() => { const d = document.getElementById('dlg'); return { ouvert: d.open, titre: document.getElementById('dlg-titre').textContent,
  accueil: !document.getElementById('accueil').hidden, intro: document.getElementById('accueil-intro').textContent,
  ecran: !!document.querySelector('#connexion-ecran .cx-bloc') }; });
const bandeau = p => p.evaluate(() => { const z = document.getElementById('bandeau'); return { vu: !z.hidden, texte: z.textContent, bouton: (z.querySelector('button') || {}).textContent || '' }; });

export const tests = [
  { nom: 'T2 · appareil neuf : « Bienvenue », gestes, rien sur une clé perdue', f: async ({ nav, st, profil, verif }) => {
    const A = await ouvrir(nav, st, profil, fauxServeur(), { sansConnexion: true }); const d = await dlg(A.page);
    verif(d.ouvert && d.accueil && d.titre === 'Bienvenue dans LIFE' && d.ecran && !/n'est plus relié/.test(d.titre), 'Bienvenue, écran Connexion unique (QR et saisie)', d);
    verif(/Générer un QR/.test(await A.page.textContent('#connexion-ecran')) && /Saisir les codes à la main/.test(await A.page.textContent('#connexion-ecran')), 'le chemin unique : Générer un QR / Saisir les codes à la main');
    await A.ctx.close();
  } },
  { nom: 'T2 · adresse gardée mais clé absente : « Cet appareil n\'est plus relié », avec la cause probable', f: async ({ nav, st, profil, verif }) => {
    const A = await ouvrir(nav, st, profil, fauxServeur(), { sansConnexion: true, init: { adresse: 'https://essai.exemple.cloud/webhook/life' } }); const d = await dlg(A.page);
    verif(d.ouvert && d.accueil && /n'est plus relié/.test(d.titre) && /navigateur nettoyé/.test(d.intro) && d.ecran, 'titre et explication d\'un appareil délié', d);
    await A.ctx.close();
  } },
  { nom: 'T2 · envoi sans clé : message clair, bouton « Relier », message gardé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S); const p = A.page;
    await p.evaluate(() => localStorage.removeItem('life.cle')); await p.reload(); await pause(700);
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d.open) d.close(); });
    await ecrire(p, 'sans clé'); await pause(500);
    const b = await bandeau(p);
    verif(/plus connecté/.test(b.texte) && /Ton message est gardé/.test(b.texte) && b.bouton === 'Relier', 'message et bouton « Relier »', b);
    verif((await ls(p, 'messages')).some(m => m.texte === 'sans clé' && m.echec), 'le message est gardé, marqué non envoyé');
    verif(S.appels.every(a => a.corps.action !== 'envoyer'), 'rien n\'est parti vers le serveur');
    await A.ctx.close();
  } },
  { nom: 'T2 · clé refusée (403) : message clair, drapeau, rappel à l\'ouverture, reliage à la main, drapeau levé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S); const p = A.page;
    S.cles = ['autre-cle-123456'];
    await ecrire(p, 'clé changée'); await pause(600);
    let b = await bandeau(p);
    verif(/plus connecté/.test(b.texte) && /Ton message est gardé/.test(b.texte) && b.bouton === 'Relier' && !/cocon_copier|zsh|GitHub/.test(b.texte), 'message en français simple, sans commande, avec « Relier »', b);
    verif((await ls(p, 'cleRefusee')) === true && (await ls(p, 'messages')).some(m => m.texte === 'clé changée' && m.echec), 'drapeau posé, message gardé');
    await p.reload(); await pause(900);
    b = await bandeau(p);
    verif(b.vu && /plus connecté à LIFE/.test(b.texte) && b.bouton === 'Relier', 'à la réouverture, le rappel revient', b);
    await p.evaluate(() => document.querySelector('#bandeau button').click()); await pause(300);
    let d = await dlg(p);
    verif(d.ouvert && /n'est plus relié/.test(d.titre) && d.accueil && d.ecran, '« Relier » ouvre l\'écran Connexion unique', d);
    // reliage à la main (clé du gestionnaire de mots de passe)
    S.cles = ['cle-neuve-123456'];
    await p.fill('#cx-champ-cle', 'cle-neuve-123456'); await p.click('#connexion-ecran button:has-text("Enregistrer")'); await pause(2500);
    verif((await ls(p, 'cleRefusee')) === null, 'nouvelle clé enregistrée : drapeau levé');
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d.open) d.close(); });
    const m = (await ls(p, 'messages')).find(x => x.texte === 'clé changée');
    verif(!!m && m.echec, 'le message en attente est toujours là pour « Réessayer »');
    await p.evaluate(() => document.querySelector('.bulle.echec button, [data-reessayer], .reessayer') && (document.querySelector('.bulle.echec button, [data-reessayer], .reessayer')).click()); await pause(900);
    verif(S.feuille.some(l => l.auteur === 'moi' && l.texte === 'clé changée'), 'après reliage, « Réessayer » envoie le message');
    await A.ctx.close();
  } },
  { nom: 'T2 · une réponse acceptée lève le drapeau « clé refusée » (la clé a été remise côté serveur)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S, { init: { cleRefusee: true } }); const p = A.page;
    await attendre(async () => (await ls(p, 'cleRefusee')) === null);
    verif((await ls(p, 'cleRefusee')) === null, 'drapeau levé après une réponse acceptée');
    await A.ctx.close();
  } },
  { nom: 'T2 · serveur injoignable : autre message, et le drapeau « clé refusée » n\'est PAS posé', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S); const p = A.page; S.coupe = true;
    await ecrire(p, 'réseau coupé'); await pause(600);
    const b = await bandeau(p);
    verif(/injoignable|hors ligne/.test(b.texte) && b.bouton === 'Réessayer' && !/plus connecté/.test(b.texte), 'message de réseau, bouton « Réessayer »', b);
    verif((await ls(p, 'cleRefusee')) === null, 'une panne de réseau ne fait pas croire que la clé est mauvaise');
    await A.ctx.close();
  } },
  { nom: 'T2 · l\'avertissement « plus relié » n\'est pas répété chaque minute ni à chaque relève', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S); const p = A.page; S.cles = ['autre-cle-123456'];
    await p.evaluate(() => document.getElementById('plus').click()); await p.evaluate(() => document.getElementById('actualiser').click()); await pause(500);
    const b1 = await bandeau(p);
    await p.evaluate(() => { document.getElementById('bandeau').hidden = true; document.getElementById('plus').click(); document.getElementById('actualiser').click(); }); await pause(500);
    const b2 = await bandeau(p);
    verif(b1.vu && /plus connecté/.test(b1.texte), 'premier refus : avertissement', b1);
    verif(!b2.vu, 'second refus dans la minute : pas de nouvel avertissement', b2);
    await A.ctx.close();
  } }
];
