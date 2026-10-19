// Écran « Connexion » commun (19/10) dans LIFE, réduit à deux choses : un QR qu'on génère par un bouton, et la saisie à la main.
import { fauxServeur, ouvrir, pause } from './outils.mjs';

const ouvreReglages = page => page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });

export const tests = [
  { nom: 'Connexion : deux blocs seulement (QR, saisie à la main), nom de l\'app, libellés clairs, secrets jamais affichés', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await pause(300);
    const titres = await page.$$eval('.cx .cx-sous', n => n.map(x => x.textContent));
    verif(titres.join('|') === 'Un QR pour tout connecter|Saisir les codes à la main', 'deux blocs', titres);
    verif(/Connexion · LIFE/.test(await page.textContent('.cx-titre')), 'le titre porte le nom de l\'app');
    const t = await page.textContent('.cx');
    verif(!/Tout tester|Coller un code|Scanner|Avancé/.test(t) && (await page.$$('.cx .cx-lien')).length === 0, 'plus de liste d\'état, de « Tout tester », de « Coller », de « Scanner » ni d\'« Avancé »');
    const lab = await page.$$eval('.cx label', n => n.map(x => x.textContent));
    verif(lab.includes('Jeton de synchro GitHub') && lab.includes('Clé des apps') && lab.includes('Adresse du serveur'), 'le jeton de synchro (GitHub) est séparé de la clé des apps', lab);
    verif(await page.$eval('#cx-champ-cle', i => i.type === 'password' && i.value === '' && /Enregistré/.test(i.placeholder)), 'la clé enregistrée n\'est pas affichée');
    verif((await page.$('.cx .cx-qr')) === null, 'le QR n\'est pas affiché d\'office');
    await ctx.close();
  } },
  { nom: 'Connexion : le bouton « Générer un QR » affiche un QR à usage unique, sans clé dans le lien', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur(); const { page, ctx } = await ouvrir(nav, st, profil, S); const paquets = [];
    await ctx.route('https://essai.exemple.cloud/crochets/life', async r => { const q = r.request(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      const c = JSON.parse(q.postData() || '{}'); if (c.action === 'transfert_deposer') paquets.push(c.donnees);
      return r.fulfill({ status: 200, headers: h, body: '{"ok":true,"transfert":true,"expire":1}' }); });
    await ouvreReglages(page); await pause(300);
    await page.click('.cx button:has-text("Générer un QR")'); await page.waitForSelector('.cx .cx-qr', { timeout: 8000 });
    verif(await page.$eval('.cx .cx-qr', i => /^data:image/.test(i.src) && i.alt.length > 10), 'QR affiché, image nommée');
    await pause(1300); verif(/une seule fois/.test(await page.textContent('.cx .cx-plus')), 'dit : une seule fois');
    verif(paquets.length === 1 && paquets[0].length > 100 && !paquets[0].includes('cle-de-test'), 'le serveur ne reçoit qu\'un paquet chiffré');
    await ctx.close();
  } },
  { nom: 'Connexion : saisie à la main — forme fausse refusée sans rien changer, clé valide enregistrée dans les anciens rangements', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await pause(300);
    await page.fill('#cx-champ-serveur', 'http://pas-https.cloud'); await page.click('.cx button:has-text("Enregistrer")');
    verif(/Forme incorrecte : Adresse du serveur/.test(await page.textContent('.cx .cx-etat')), 'adresse fausse : message clair');
    verif(await page.evaluate(() => JSON.parse(localStorage.getItem('life.cle')) === 'cle-de-test-123456'), 'rien n\'a changé');
    await page.fill('#cx-champ-serveur', ''); await page.fill('#cx-champ-cle', 'nouvelle-cle-de-test-9876'); await page.click('.cx button:has-text("Enregistrer")');
    await pause(400);
    const r = await page.evaluate(() => ({ lien: localStorage.getItem('carte-de-vie-lien'), life: JSON.parse(localStorage.getItem('life.cle')), u: JSON.parse(localStorage.getItem('connexion') || 'null'), txt: document.querySelector('.cx .cx-etat').textContent }));
    verif(r.lien === 'nouvelle-cle-de-test-9876' && r.life === r.lien && r.u && r.u.cle === r.lien, 'clé des apps enregistrée pour la carte, LIFE et le rangement commun', r);
    verif(/Connectées sur cet appareil/.test(r.txt) && !r.txt.includes('nouvelle-cle'), 'une ligne dit quelles apps sont connectées, sans secret', r.txt);
    await ctx.close();
  } },
  { nom: 'Connexion : mise en page de ce profil (boutons tactiles 44 px au téléphone), sans débordement', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await pause(300);
    const m = await page.evaluate(() => ({ h: Math.min(...[...document.querySelectorAll('.cx .cx-btn')].map(x => x.getBoundingClientRect().height)), deborde: document.getElementById('dlg').scrollWidth > document.getElementById('dlg').clientWidth + 1 }));
    const tel = profil.nom === 'App téléphone';
    verif(m.h >= (tel ? 44 : 38), 'boutons assez hauts', m); verif(!m.deborde, 'aucun débordement horizontal', m);
    await ctx.close();
  } }
];
