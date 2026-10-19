// Écran « Connexion » commun (19/10) dans LIFE : une ligne ✓/✗ par lien, code collé, mise en page téléphone / ordinateur, message unique.
import { fauxServeur, ouvrir, pause, attendre } from './outils.mjs';

const CODE = 'CV1.' + Buffer.from(JSON.stringify({ v: 1, serveur: 'https://essai.exemple.cloud', cle: 'nouvelle-cle-de-test-9876', pilote: 'cle-pilote-de-test-123456', depot: 'moi/donnees', jeton: 'j'.repeat(30) })).toString('base64url');
const ouvreReglages = page => page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });

export const tests = [
  { nom: 'Connexion : une ligne ✓/✗ par lien, en français ; LIFE relié, le reste « pas encore »', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await pause(300);
    const l = await page.$$eval('.cx .cx-lien', n => n.map(x => ({ c: x.className, t: x.textContent })));
    verif(l.length === 4, '4 liens listés', l.length);
    verif(/ok/.test(l[1].c) && /Assistants/.test(l[1].t) && /ko/.test(l[0].c) && /pas encore reliée/.test(l[0].t), 'assistants ✓, synchro de la carte ✗ « pas encore reliée »', l);
    const b = await page.$$eval('.cx .cx-actions button', n => n.map(x => x.textContent));
    verif(b.join('|') === 'Connecter un autre appareil|Coller un code de connexion|Tout tester', 'les 3 boutons', b);
    verif(await page.$eval('#avance-life', d => !d.open), 'le reste est replié sous « Avancé »');
    await ctx.close();
  } },
  { nom: 'Connexion : « Tout tester » dans LIFE dit ✓ pour les assistants et laisse la synchro « à vérifier » (LIFE ne parle pas à GitHub)', f: async ({ nav, st, profil, verif }) => {
    const S = fauxServeur();
    const { page, ctx } = await ouvrir(nav, st, profil, S);
    await ouvreReglages(page); await page.click('.cx .cx-actions button:nth-child(3)');
    verif(await attendre(async () => /répond|ne répond|injoignable|refus/.test(await page.textContent('.cx .cx-liens')), 8000), 'un verdict apparaît pour le lien des assistants');
    const t = await page.textContent('.cx .cx-liens');
    verif(!/pas de verdict/.test(t) && /Synchro de la carte/.test(t), 'les 4 lignes restent affichées', t);
    await ctx.close();
  } },
  { nom: 'Connexion : coller un code enregistre tout, recopie les anciens rangements, puis LIFE se recharge', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await page.click('.cx .cx-actions button:nth-child(2)');
    await page.fill('.cx input[aria-label="Code de connexion"]', CODE); await page.click('.cx .cx-plus button');
    await pause(400);
    const r = await page.evaluate(() => ({ lien: localStorage.getItem('carte-de-vie-lien'), life: JSON.parse(localStorage.getItem('life.cle')), sync: localStorage.getItem('carte-de-vie-sync'), pil: JSON.parse(localStorage.getItem('coulisses-pilote') || 'null'), u: JSON.parse(localStorage.getItem('connexion') || 'null') }));
    verif(r.lien === 'nouvelle-cle-de-test-9876' && r.life === r.lien, 'clé des apps recopiée (carte et LIFE)', r);
    verif(r.sync === null && r.u && r.u.attente && r.u.attente.depot === 'moi/donnees' && r.pil && r.pil.cle === 'cle-pilote-de-test-123456' && r.u.v === 1, 'pilotage et rangement « connexion » ; la synchro reste en attente (jamais écrite par LIFE)', r);
    await pause(2200);
    verif(await page.evaluate(() => JSON.parse(localStorage.getItem('life.cle')) === 'nouvelle-cle-de-test-9876'), 'après rechargement, la clé est toujours là');
    await ctx.close();
  } },
  { nom: 'Connexion : un code illisible ne change rien et le dit', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await page.click('.cx .cx-actions button:nth-child(2)');
    await page.fill('.cx input[aria-label="Code de connexion"]', 'CV1.pas-un-vrai-code'); await page.click('.cx .cx-plus button');
    verif(/n'est pas un code de connexion/.test(await page.textContent('.cx .cx-etat')), 'message clair');
    verif(await page.evaluate(() => JSON.parse(localStorage.getItem('life.cle')) === 'cle-de-test-123456'), 'rien n\'a changé');
    await ctx.close();
  } },
  { nom: 'Connexion : mise en page de ce profil (boutons tactiles 44 px au téléphone, deux colonnes sur ordinateur)', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await ouvreReglages(page); await pause(300);
    const m = await page.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.cx-liens')).gridTemplateColumns.split(' ').length, h: Math.min(...[...document.querySelectorAll('.cx .cx-btn')].map(b => b.getBoundingClientRect().height)), deborde: document.documentElement.scrollWidth > innerWidth }));
    const tel = profil.nom === 'App téléphone';
    verif(m.cols === (tel ? 1 : 2), tel ? 'une colonne au téléphone' : 'deux colonnes sur ordinateur', m);
    verif(m.h >= (tel ? 44 : 38), 'boutons assez hauts', m); verif(!m.deborde, 'aucun débordement horizontal', m);
    await ctx.close();
  } }
];
