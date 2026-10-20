// V.0.0.6.0 : App téléphone : Comité s'ouvre en écran plein, à part (maquette « Le comité »). L'ordinateur ne change pas.
import { fauxServeur, ouvrir, choisirFil, pause } from './outils.mjs';

const VOIX = [['raison', 'la raison'], ['coeur', 'le cœur'], ['argent', 'l\'argent'], ['temps', 'le temps'], ['futur', 'toi dans 5 ans']].map(([id, nom]) => ({ id, nom }));
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, sel);

export const tests = [
  { nom: 'Comité en écran plein (téléphone) : en-tête et fils masqués, table + parole + saisie, « ‹ LIFE » ramène au fil d\'origine ; ordinateur inchangé', f: async ({ nav, st, profil, verif, tel }) => {
    const S = fauxServeur();
    S.ajouter({ id: 'C-1-a', horodatage: S.heure(-2000), fil: 'comite', texte: 'Changer de travail ou rester ?', auteur: 'moi' });
    S.ajouter({ id: 'C-1-b', horodatage: S.heure(-1000), fil: 'comite', texte: 'Avant de choisir : qu\'est-ce qui te retient vraiment, en une phrase ?', auteur: 'life', comite: JSON.stringify({ mode: 'voix', membres: VOIX, parle: 'raison' }) });
    const A = await ouvrir(nav, st, profil, S), p = A.page;
    await choisirFil(p, 'Travail'); await pause(200);
    verif(!(await p.evaluate(() => document.body.classList.contains('comite-plein'))), 'hors Comité : pas d\'écran plein');
    await choisirFil(p, 'Comité'); await pause(400);
    verif(await p.evaluate(() => document.body.classList.contains('comite-plein')), 'dans Comité : l\'écran plein est actif');
    if (tel) {
      verif(!(await vis(p, 'header')) && !(await vis(p, '#barre-fils')) && !(await vis(p, '#messages')), 'téléphone : en-tête, barre des fils et flux sont masqués');
      verif((await vis(p, '#comite .cm-table')) && (await vis(p, '#comite .cm-parole')) && (await vis(p, '#saisie')) && (await vis(p, '#micro')), 'téléphone : table, carte de parole, saisie et micro visibles');
      const g = await p.evaluate(() => { const c = document.querySelector('.cm-centre').getBoundingClientRect(), t = document.querySelector('.cm-table').getBoundingClientRect(), pa = document.querySelector('.cm-parole').getBoundingClientRect(), f = document.querySelector('footer').getBoundingClientRect();
        const z = document.getElementById('comite').getBoundingClientRect(), hors = [...document.querySelectorAll('.cm-siege')].filter(s => { const r = s.getBoundingClientRect(); return r.left < z.left || r.right > z.right; }).length;
        return { disque: Math.round(c.width), table: Math.round(t.width), paroleSousTable: pa.top >= t.bottom - 1, paroleAvantSaisie: pa.bottom <= f.top + 1, hors, debord: document.documentElement.scrollWidth > innerWidth,
          futurPointille: getComputedStyle(document.querySelector('.cm-siege.futur .cm-rond')).borderStyle, allume: document.querySelector('.cm-siege.parle small').textContent }; });
      verif(g.disque > 180 && g.paroleSousTable && g.paroleAvantSaisie && g.hors === 0 && !g.debord, 'grand disque central ; parole sous la table, au-dessus de la saisie ; rien ne sort du cadre', g);
      verif(g.futurPointille === 'dashed' && g.allume === 'la raison', '« toi dans 5 ans » en pointillés ; la raison est allumée', g);
      await p.screenshot({ path: process.env.CAPTURE_COMITE || undefined, type: 'png' }).catch(() => {});
      await p.evaluate(() => document.querySelector('.cm-echange').click()); await pause(250);
      verif((await vis(p, '#messages')) && !(await vis(p, '#comite .cm-table')), '« L\'échange » : le fil du comité se relit, la table se range');
      await p.evaluate(() => document.querySelector('.cm-echange').click()); await pause(250);
      await p.evaluate(() => document.querySelector('.cm-retour').click()); await pause(300);
      verif(!(await p.evaluate(() => document.body.classList.contains('comite-plein'))) && (await vis(p, 'header')) && (await vis(p, '#barre-fils')), '« ‹ LIFE » : retour à la messagerie (en-tête et fils revenus)');
      verif((await p.evaluate(() => localStorage.getItem('fil') || '')).includes('travail') || (await p.evaluate(() => document.querySelector('#fils [aria-pressed="true"]').getAttribute('aria-label'))).startsWith('Travail'), 'retour au fil d\'où l\'on venait (Travail)');
    } else {
      verif((await vis(p, 'header')) && (await vis(p, '#barre-fils')) && !(await vis(p, '.cm-retour')) && !(await vis(p, '.cm-echange')), 'ordinateur : en-tête et fils restent, pas de « ‹ LIFE » ni de « L\'échange »');
    }
    await A.ctx.close();
  } }
];
