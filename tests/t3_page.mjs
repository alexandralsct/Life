// Points 5, 6 et 10 de l'audit du 13/10 : mise en page (ordinateur = souris et 900 px ; tablette tactile = app
// téléphone ; zones tactiles de 44 px sans changer la disposition des tuiles), lien de connexion confirmé, CSP stricte.
import { fauxServeur, ouvrir, ls, pause, TEL, ORDI } from './outils.mjs';

// Disposition de référence mesurée sur la V.0.0.28 (avant les corrections) : elle ne doit pas bouger d'un pixel.
const REF = {"tel_grille":{"tuiles":[[16,72,70,70],[94,72,70,70],[171,72,70,70],[249,72,70,70],[326,72,70,70],[16,150,70,70],[94,150,70,70],[171,150,70,70],[249,150,70,70],[326,150,70,70]],"plier":[183,232,46,20],"chercher":[368,228,28,28],"entete":[[227,10,40,40],[270,10,40,40],[313,10,40,40],[356,10,40,40]],"main":[0,264,412,588]},"tel_replie":{"tuiles":[[16,64,33,33],[55,64,33,33],[93,64,33,33],[132,64,33,33],[170,64,33,33],[209,64,33,33],[248,64,33,33],[286,64,33,33],[325,64,33,33],[363,64,33,33]],"plier":[183,103,46,20],"chercher":[368,99,28,28],"entete":[[227,10,40,40],[270,10,40,40],[313,10,40,40],[356,10,40,40]],"main":[0,135,412,717]},"petit_grille":{"tuiles":[[16,58,61,54],[83,58,61,54],[150,58,61,54],[216,58,61,54],[283,58,61,54],[16,118,61,54],[83,118,61,54],[150,118,61,54],[216,118,61,54],[283,118,61,54]],"plier":[157,176,46,20],"chercher":[316,172,28,28],"entete":[[175,6,40,40],[218,6,40,40],[261,6,40,40],[304,6,40,40]],"main":[0,208,360,373]},"petit_replie":{"tuiles":[[16,58,27,27],[49,58,27,27],[83,58,27,27],[116,58,27,27],[150,58,27,27],[183,58,27,27],[216,58,27,27],[250,58,27,27],[283,58,27,27],[317,58,27,27]],"plier":[157,92,46,20],"chercher":[316,88,28,28],"entete":[[175,6,40,40],[218,6,40,40],[261,6,40,40],[304,6,40,40]],"main":[0,124,360,457]},"ordi_grille":{"tuiles":[[144,138,240,40],[144,182,240,40],[144,226,240,40],[144,270,240,40],[144,314,240,40],[144,358,240,40],[144,402,240,40],[144,446,240,40],[144,490,240,40],[144,534,240,40]],"plier":[0,0,0,0],"chercher":[144,86,240,40],"entete":[[952,24,40,40],[1000,24,40,40],[1048,24,40,40],[1096,24,40,40]],"main":[409,85,718,621]}};

const mesurer = page => page.evaluate(() => {
  const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  return { tuiles: [...document.querySelectorAll('#fils button')].map(r), plier: r(document.getElementById('plier')), chercher: r(document.getElementById('chercher')),
    entete: [...document.querySelectorAll('header > button')].filter(b => b.offsetParent).map(r), main: r(document.querySelector('main')) };
});
// Zone sensible réelle (elementFromPoint) : largeur et hauteur de la zone qui atteint l'élément, en passant par son centre.
const zones = page => page.evaluate(() => {
  const z = e => { const b = e.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const touche = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
    let w = 0, h = 0; for (let x = b.left - 40; x <= b.right + 40; x++) if (touche(x, cy)) w++; for (let y = b.top - 40; y <= b.bottom + 40; y++) if (touche(cx, y)) h++;
    return [e.id || e.className, w, h]; };
  const cibles = [...document.querySelectorAll('header > button')].filter(b => b.offsetParent).concat([document.getElementById('plier'), document.getElementById('chercher')]);
  // chaque tuile reste entièrement à elle : le bord de chaque côté et son centre la touchent
  const tuilesVolees = [...document.querySelectorAll('#fils button')].filter(e => { const b = e.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;   // milieux des bords (1 px à l'intérieur ; les coins sont arrondis) et centre
    return [[cx, b.top + 1], [cx, b.bottom - 1], [b.left + 1, cy], [b.right - 1, cy], [cx, cy]]
      .some(([x, y]) => { const t = document.elementFromPoint(x, y); return !t || !(t === e || e.contains(t)); }); }).length;
  return { cibles: cibles.map(z), tuilesVolees };
});

export const tests = [
  { nom: 'App téléphone : tuiles exactement comme avant (412×915 et 360×640, grille et repliée), zones tactiles ≥ 44 px', profils: ['tel'], f: async ({ nav, st, verif }) => {
    for (const [nom, vp] of [['tel', { width: 412, height: 915 }], ['petit', { width: 360, height: 640 }]]) for (const plie of [false, true]) {
      const A = await ouvrir(nav, st, { ...TEL, viewport: vp }, null, { chemin: '?demo', init: { grille2: !plie } });
      const cle = nom + (plie ? '_replie' : '_grille'), m = await mesurer(A.page);
      const { entete, ...reste } = m, { entete: entRef, ...resteRef } = REF[cle];
      verif(JSON.stringify(reste) === JSON.stringify(resteRef), cle + ' : tuiles, ⌄, loupe et conversation identiques à la V.0.0.28', m);
      // en-tête : mêmes ronds de 40 px, calés à droite comme avant ; écart porté de 3 à 4 px pour 44 px de zone chacun
      verif(entete.length === 4 && entete.every((e, i) => e[1] === entRef[i][1] && e[2] === 40 && e[3] === 40) && entete[3][0] === entRef[3][0]
        && entete.slice(1).every((e, i) => e[0] - entete[i][0] === 44), cle + ' : en-tête calé à droite, ronds de 40 px tous les 44 px', entete);
      const z = await zones(A.page);
      verif(z.cibles.every(([, w, h]) => w >= 44 && h >= 44), cle + ' : en-tête, ⌄ et loupe ont une zone tactile de 44 px au moins', z.cibles);
      verif(z.tuilesVolees === 0, cle + ' : aucune tuile n\'a perdu de surface tactile', z.tuilesVolees);
      await A.ctx.close();
    }
  } },
  { nom: 'App ordinateur : colonne des fils inchangée (1280 px, souris)', profils: ['ordi'], f: async ({ nav, st, verif }) => {
    const A = await ouvrir(nav, st, ORDI, null, { chemin: '?demo' });
    const m = await mesurer(A.page);
    verif(JSON.stringify(m) === JSON.stringify(REF.ordi_grille), 'disposition identique à la V.0.0.28', m);
    const z = await zones(A.page);
    verif(z.cibles.filter(c => c[0] !== 'plier').every(([, w, h]) => w >= 24 && h >= 24), 'cibles de 24 px au moins à la souris', z.cibles);
    await A.ctx.close();
  } },
  { nom: 'Tablette 1024×768 et téléphone en paysage 915×412, tactiles : app téléphone (pas de mélange avec l\'ordinateur)', profils: ['tel'], f: async ({ nav, st, verif }) => {
    for (const vp of [{ width: 1024, height: 768 }, { width: 915, height: 412 }]) {
      const A = await ouvrir(nav, st, { ...TEL, viewport: vp }, null, { chemin: '?demo' });
      const d = await A.page.evaluate(() => ({ colonnes: getComputedStyle(document.getElementById('fils')).gridTemplateColumns.split(' ').length,
        barre: Math.round(document.getElementById('barre-fils').getBoundingClientRect().width), plier: !!document.getElementById('plier').offsetParent,
        ordi: matchMedia('(min-width: 900px) and (pointer: fine)').matches, deborde: document.documentElement.scrollWidth > innerWidth,
        nomCoupe: [...document.querySelectorAll('#fils .nom')].some(n => n.offsetParent && n.scrollWidth > n.clientWidth + 1) }));
      const z = await zones(A.page);
      verif(z.cibles.every(([, w, h]) => w >= 44 && h >= 44) && z.tuilesVolees === 0, vp.width + '×' + vp.height + ' : zones tactiles de 44 px, tuiles intactes', z);
      verif(!d.ordi && d.colonnes === 5 && d.plier && d.barre > 300 && !d.deborde && !d.nomCoupe, vp.width + '×' + vp.height + ' : grille de 5 tuiles du téléphone, ⌄ visible, rien de coupé', d);
      await A.ctx.close();
    }
  } },
  { nom: 'Lien #connexion= : jamais de remplacement silencieux ; serveur différent → il faut retaper son nom', f: async ({ nav, st, profil, verif }) => {
    const lien = (a, c) => '#connexion=' + Buffer.from(JSON.stringify({ a, c })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const S = fauxServeur();
    // 1. appareil déjà connecté, lien vers un autre serveur
    let A = await ouvrir(nav, st, profil, S, { chemin: lien('https://pirate.exemple.cloud/webhook/life', 'cle-piege-123456') });
    verif(await A.page.evaluate(() => document.getElementById('dlg-connexion').open), 'une boîte de confirmation s\'ouvre');
    verif((await A.page.textContent('#cx-hote')) === 'pirate.exemple.cloud', 'elle affiche le nom d\'hôte du serveur', await A.page.textContent('#cx-hote'));
    verif(/déjà relié au serveur « essai\.exemple\.cloud »/.test(await A.page.textContent('#cx-avert')), 'elle prévient que la connexion actuelle serait remplacée');
    verif((await ls(A.page, 'adresse')).includes('essai.exemple.cloud') && (await ls(A.page, 'cle')) === 'cle-de-test-123456', 'rien n\'a changé tant qu\'on n\'a pas confirmé');
    verif(await A.page.evaluate(() => document.getElementById('cx-ok').disabled), '« Connecter » inactif sans le nom retapé');
    await A.page.fill('#cx-saisie', 'autre.exemple.cloud');
    verif(await A.page.evaluate(() => document.getElementById('cx-ok').disabled), 'un autre nom ne suffit pas');
    await A.page.evaluate(() => document.getElementById('cx-non').click());
    verif((await ls(A.page, 'adresse')).includes('essai.exemple.cloud'), 'Refuser : adresse inchangée');
    verif(!(await A.page.evaluate(() => location.hash)), 'le lien est effacé de la barre d\'adresse');
    await A.ctx.close();
    // 2. même lien, nom retapé : accepté
    A = await ouvrir(nav, st, profil, S, { chemin: lien('https://nouveau.exemple.cloud/webhook/life', 'cle-nouvelle-123456') });
    await A.page.fill('#cx-saisie', 'Nouveau.Exemple.cloud ');
    await A.page.evaluate(() => document.getElementById('cx-ok').click());
    verif((await ls(A.page, 'adresse')) === 'https://nouveau.exemple.cloud/webhook/life' && (await ls(A.page, 'cle')) === 'cle-nouvelle-123456', 'nom retapé : connexion remplacée');
    await A.ctx.close();
    // 3. même serveur, nouvelle clé : un toucher suffit
    A = await ouvrir(nav, st, profil, S, { chemin: lien('https://essai.exemple.cloud/webhook/life', 'cle-renouvelee-123456') });
    verif(await A.page.evaluate(() => document.getElementById('cx-retaper').hidden && !document.getElementById('cx-ok').disabled), 'même serveur : pas besoin de retaper');
    verif((await ls(A.page, 'cle')) === 'cle-de-test-123456', 'toujours rien de changé avant le toucher');
    await A.page.evaluate(() => document.getElementById('cx-ok').click());
    verif((await ls(A.page, 'cle')) === 'cle-renouvelee-123456', 'clé mise à jour après confirmation');
    await A.ctx.close();
    // 4. appareil neuf : confirmation aussi, et pas de boîte des réglages par-dessus
    A = await ouvrir(nav, st, profil, S, { sansConnexion: true, chemin: lien('https://essai.exemple.cloud/webhook/life', 'cle-de-test-123456') });
    const etat = await A.page.evaluate(() => ({ cx: document.getElementById('dlg-connexion').open, reglages: document.getElementById('dlg').open, retaper: !document.getElementById('cx-retaper').hidden }));
    verif(etat.cx && !etat.reglages && etat.retaper, 'appareil neuf : confirmation avec le nom à retaper, sans autre boîte', etat);
    verif((await ls(A.page, 'adresse')) === null, 'rien d\'enregistré avant confirmation');
    await A.ctx.close();
  } },
  { nom: 'Sécurité : CSP sans « unsafe-inline », aucun script ni style dans la page, aucune violation', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const A = await ouvrir(nav, st, profil, S);
    const d = await A.page.evaluate(() => ({ csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
      inline: [...document.scripts].filter(s => !s.src).length, styles: document.querySelectorAll('style').length, attrs: document.querySelectorAll('[style]').length,
      evts: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/.test(a.name))).length }));
    verif(!/unsafe-inline/.test(d.csp) && /script-src 'self';/.test(d.csp) && /style-src 'self';/.test(d.csp), 'CSP stricte (script-src et style-src \'self\')', d.csp);
    verif(/connect-src 'self' https:\/\/\*\.cloud;/.test(d.csp) && /img-src 'self' data:;/.test(d.csp) && !/blob:/.test(d.csp), 'connexions et images : seulement ce qui sert', d.csp);
    verif(d.inline === 0 && d.styles === 0 && d.evts === 0, 'aucun script, style ou gestionnaire en ligne', d);
    await A.page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
    await A.page.evaluate(() => document.getElementById('montrer-qr').click()); await pause(600);
    verif(await A.page.evaluate(() => !document.getElementById('qr').hidden && document.getElementById('qr').naturalWidth > 0), 'le code QR (image data:) s\'affiche sous la CSP');
    verif(A.csp.length === 0 && A.erreurs.length === 0, 'aucune violation de CSP ni erreur', A.csp.concat(A.erreurs));
    await A.ctx.close();
  } }
];
