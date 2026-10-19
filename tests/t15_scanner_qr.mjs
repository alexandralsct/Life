// Bouton « Scanner un QR » (écran Connexion commun) : caméra simulée + lecteur de QR simulé (BarcodeDetector), sans vraie caméra.
import { fauxServeur, ouvrir, pause, attendre } from './outils.mjs';

const CODE = 'CV1.' + Buffer.from(JSON.stringify({ v: 1, serveur: 'https://essai.exemple.cloud', cle: 'cle-scannee-de-test-9876', pilote: 'cle-pilote-de-test-123456', depot: 'moi/donnees', jeton: 'j'.repeat(30) })).toString('base64url');
const ouvreReglages = page => page.evaluate(() => { document.getElementById('plus').click(); document.getElementById('reglages').click(); });
const scan = page => page.evaluate(() => [...document.querySelectorAll('.cx .cx-actions button')].find(b => b.textContent === 'Scanner un QR').click());

export const tests = [
  { nom: 'Scanner un QR : un code lu par la caméra est enregistré, la caméra s\'éteint', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await page.addInitScript(texte => {
      window.__pistes = [];
      const piste = { stop() { window.__pistes.push('arretee'); } };
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { const f = new MediaStream(); f.getTracks = () => [piste]; return f; } }, configurable: true });
      HTMLMediaElement.prototype.play = async function () {};
      window.BarcodeDetector = class { async detect() { return [{ rawValue: texte }]; } };
    }, CODE);
    await page.reload(); await pause(600);
    await ouvreReglages(page); await scan(page);
    verif(await attendre(async () => await page.evaluate(() => localStorage.getItem('carte-de-vie-lien')) === 'cle-scannee-de-test-9876', 8000), 'la clé lue par le scan est enregistrée');
    verif((await page.evaluate(() => window.__pistes)).length === 1, 'la caméra est arrêtée après la lecture');
    await ctx.close();
  } },
  { nom: 'Scanner un QR : un texte qui n\'est pas un QR de connexion ne change rien et le dit', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { const f = new MediaStream(); f.getTracks = () => [{ stop() {} }]; return f; } }, configurable: true });
      HTMLMediaElement.prototype.play = async function () {};
      window.BarcodeDetector = class { async detect() { return [{ rawValue: 'https://exemple.org/autre-chose' }]; } };
    });
    await page.reload(); await pause(600);
    const avant = await page.evaluate(() => localStorage.getItem('life.cle'));
    await ouvreReglages(page); await scan(page);
    verif(await attendre(async () => /n'est pas un QR de connexion/.test(await page.textContent('.cx .cx-etat')), 8000), 'le message le dit');
    verif(await page.evaluate(() => localStorage.getItem('life.cle')) === avant, 'rien n\'a changé');
    await ctx.close();
  } },
  { nom: 'Scanner un QR : sans lecteur de QR dans le navigateur, le geste de repli est dit (appareil photo du téléphone)', f: async ({ nav, st, profil, verif }) => {
    const { page, ctx } = await ouvrir(nav, st, profil, fauxServeur());
    await page.addInitScript(() => { delete window.BarcodeDetector; });
    await page.reload(); await pause(600);
    await ouvreReglages(page); await scan(page);
    verif(/appareil photo du téléphone/.test(await page.textContent('.cx .cx-etat')) && !(await page.$('.cx video')), 'message de repli, pas de caméra ouverte');
    await ctx.close();
  } }
];
