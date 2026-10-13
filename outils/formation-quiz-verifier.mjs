/**
 * Verifie les fichiers _contenu-formation/quiz-module-*.md : une bonne reponse
 * par question, 4 options en choix unique, 2 en vrai/faux, renvoi vers une lecon
 * existante dans assets/formation-donnees.js avec une fourchette dans la duree,
 * un conseil, le nombre annonce, aucun tiret cadratin. Avec son temoin.
 * Usage : node outils/formation-quiz-verifier.mjs   (code 1 si un defaut)
 */
import { readFileSync, readdirSync } from 'node:fs';
const src = readFileSync('assets/formation-donnees.js','utf8');
const ids = new Set([...src.matchAll(/id: '(m\d+-l\d+)'/g)].map(m=>m[1]));
const minutes = {}; for (const m of src.matchAll(/id: '(m\d+-l\d+)'[\s\S]*?minutes: (\d+)/g)) minutes[m[1]] = +m[2];
let ko = 0;
for (const f of readdirSync('_contenu-formation').filter(f=>/^quiz-module-.*\.md$/.test(f)).sort()) {
  const t = readFileSync('_contenu-formation/'+f,'utf8');
  const tirets = (t.match(/[\u2013\u2014]/g)||[]).length;
  const blocs = t.split(/\n## Q/).slice(1);
  const annonce = +(t.match(/(\d+) questions/)||[])[1];
  let err = [];
  blocs.forEach((b,i)=>{
    const n = i+1;
    const opts = (b.match(/^- /gm)||[]).length;
    const bonnes = (b.match(/✅/g)||[]).length;
    const type = /vrai \/ faux/.test(b.split('\n')[0]) ? 'vf' : 'choix';
    if (bonnes!==1) err.push(`Q${n}: ${bonnes} bonnes reponses`);
    if (type==='vf' && opts!==2) err.push(`Q${n}: vrai/faux avec ${opts} options`);
    if (type==='choix' && opts!==4) err.push(`Q${n}: ${opts} options`);
    const r = b.match(/Renvoi : `(m\d+-l\d+)`, entre (\d+) et (\d+) minutes/);
    if (!r) err.push(`Q${n}: renvoi illisible`);
    else { if (!ids.has(r[1])) err.push(`Q${n}: lecon inconnue ${r[1]}`);
      else if (+r[3] > minutes[r[1]]+1) err.push(`Q${n}: fin ${r[3]} > duree ${minutes[r[1]]} min de ${r[1]}`);
      if (+r[2] >= +r[3]) err.push(`Q${n}: fourchette vide`); }
    if (!/Conseil : /.test(b)) err.push(`Q${n}: pas de conseil`);
  });
  if (annonce !== blocs.length) err.push(`annonce ${annonce} questions, ${blocs.length} ecrites`);
  if (tirets) err.push(`${tirets} tirets cadratins`);
  console.log(`${f}: ${blocs.length} questions ${err.length? 'KO '+err.join(' | ') : 'ok'}`);
  ko += err.length;
}
// temoin : une question fautive doit etre vue
const temoin = '## Q1 · x · choix unique\n\n**?**\n\n- a ✅\n- b ✅\n- c\n\nRenvoi : `m99-l9`, entre 5 et 3 minutes.\n';
const b = temoin; const bonnes=(b.match(/✅/g)||[]).length; const r=b.match(/`(m\d+-l\d+)`, entre (\d+) et (\d+)/);
console.log('temoin:', bonnes!==1 && !ids.has(r[1]) && +r[2]>=+r[3] ? 'detecte' : 'RATE');
process.exit(ko?1:0);
