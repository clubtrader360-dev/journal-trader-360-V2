/**
 * Engendre `assets/formation-quiz.js` depuis les dix fichiers
 * `_contenu-formation/quiz-module-*.md`.
 *
 * ── ⛔ LE FICHIER PUBLIE EST PRODUIT, JAMAIS ECRIT A LA MAIN ──────────────
 *
 * Les cent trente questions vivent dans les fichiers Markdown, relus par Nadir.
 * Ce qui part dans le navigateur en est la transcription VERBATIM : enonce,
 * options, bonne reponse, renvoi, conseil. ⚠️ Une retranscription a la main de
 * cent trente questions introduit une faute que personne ne retrouve ; la
 * sonde de fin compare donc chaque enonce et chaque conseil du fichier produit
 * au Markdown source, caractere par caractere, avec son temoin.
 *
 * ── ⚠️ LA BONNE REPONSE EST DANS LE FICHIER PUBLIC, ET C EST ASSUME ────────
 *
 * Un eleve qui lit le code source voit les reponses. ⛔ Ce quiz n est pas un
 * examen surveille : il conditionne un badge et l ouverture du niveau suivant,
 * pas un diplome. Le mettre cote serveur demanderait une route, une session et
 * une table de plus pour proteger quelque chose que la vidéo donne de toute
 * facon. Le score ecrit en base reste celui que l eleve a obtenu a l ecran.
 *
 * Usage :
 *     node outils/formation-quiz-import.mjs            essai a blanc
 *     node outils/formation-quiz-import.mjs --ecrire   pose assets/formation-quiz.js
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ECRIRE = process.argv.includes('--ecrire');
const SORTIE = 'assets/formation-quiz.js';
const DOSSIER = '_contenu-formation';
const SEUIL = 0.8;

/** « quiz-module-07bis.md » -> « 07bis », « quiz-module-01.md » -> « 01 ». */
const cleDe = (f) => f.replace(/^quiz-module-/, '').replace(/\.md$/, '');

/** Un fichier Markdown -> { cle, titre, seuil, questions[] }. ⚠️ Leve si un bloc est illisible. */
function lire(f) {
  const t = readFileSync(`${DOSSIER}/${f}`, 'utf8');
  const cle = cleDe(f);
  const titre = (t.match(/^# Quiz du module [^:]+: (.+)$/m) || [])[1] || '';
  const annonce = +(t.match(/(\d+) questions/) || [])[1];
  // ⛔ Tout ce qui suit « # Ce que j'ai écarté » n est pas une question.
  const corps = t.split(/\n# Ce que j/)[0];
  const blocs = corps.split(/\n## Q/).slice(1);
  const questions = blocs.map((b, i) => {
    const lignes = b.split('\n');
    const entete = lignes[0];
    const type = /vrai \/ faux/.test(entete) ? 'vraifaux' : 'choix';
    const enonce = (b.match(/^\*\*([\s\S]+?)\*\*$/m) || [])[1];
    if (!enonce) throw new Error(`${f} Q${i + 1} : enonce illisible`);
    const options = [];
    let bonne = -1;
    lignes.filter((l) => /^- /.test(l)).forEach((l) => {
      const brut = l.replace(/^- /, '');
      const ok = /✅/.test(brut);
      const texte = brut.replace(/\s*✅\s*$/, '').trim();
      if (ok) bonne = options.length;
      options.push(texte);
    });
    if (bonne < 0) throw new Error(`${f} Q${i + 1} : aucune bonne reponse`);
    const r = b.match(/Renvoi : `(m\d+-l\d+)`, entre (\d+) et (\d+) minutes/);
    if (!r) throw new Error(`${f} Q${i + 1} : renvoi illisible`);
    const conseil = (b.match(/^Conseil : (.+)$/m) || [])[1];
    if (!conseil) throw new Error(`${f} Q${i + 1} : pas de conseil`);
    return {
      id: `q${cle}-${i + 1}`,
      type,
      enonce: enonce.trim(),
      options,
      bonne,
      renvoi: { lecon: r[1], de: +r[2], a: +r[3] },
      conseil: conseil.trim(),
    };
  });
  if (annonce !== questions.length) throw new Error(`${f} : annonce ${annonce}, ${questions.length} lues`);
  return { cle, titre, seuil: SEUIL, questions };
}

const fichiers = readdirSync(DOSSIER).filter((f) => /^quiz-module-.*\.md$/.test(f)).sort();
const quiz = {};
let total = 0;
for (const f of fichiers) {
  const q = lire(f);
  quiz[q.cle] = { titre: q.titre, seuil: q.seuil, questions: q.questions };
  total += q.questions.length;
  console.log(`  ${q.cle.padEnd(6)} ${String(q.questions.length).padStart(2)} questions   ${q.titre}`);
}
console.log(`  ${fichiers.length} quiz, ${total} questions`);

/** Le JSON est serialise avec des apostrophes echappees : il vit dans un script. */
const corps = JSON.stringify(quiz, null, 1).replace(/</g, '\\u003c');
const sortie = `/**
 * LES QUIZ DE MODULE. ⛔ FICHIER ENGENDRE, NE PAS EDITER A LA MAIN.
 *
 * Produit par \`node outils/formation-quiz-import.mjs --ecrire\` depuis les
 * fichiers \`_contenu-formation/quiz-module-*.md\`, qui sont la source : une
 * question se corrige la-bas, puis on relance l outil.
 *
 * Forme : { '01': { titre, seuil, questions: [ { id, type, enonce, options,
 * bonne, renvoi: { lecon, de, a }, conseil } ] } }
 *   type     'choix' (quatre options) ou 'vraifaux' (deux)
 *   bonne    l index de la bonne option, AVANT melange : l ecran melange
 *   renvoi   la lecon a revoir et la fourchette de minutes
 *
 * ⚠️ Les bonnes reponses sont lisibles ici, et c est assume : voir l en-tete
 * de l outil.
 */
(function () {
  'use strict';
  const racine = typeof window !== 'undefined' ? window : globalThis;
  racine.FORMATION_QUIZ = ${corps};
})();
`;

/* ── LA SONDE : le fichier produit rend chaque enonce et chaque conseil tels quels ── */
function sonder(texte) {
  const bac = {};
  // eslint-disable-next-line no-new-func
  new Function('window', texte)(bac);
  const Q = bac.FORMATION_QUIZ;
  let ecart = 0;
  let comptes = 0;
  for (const f of fichiers) {
    const md = readFileSync(`${DOSSIER}/${f}`, 'utf8');
    const cle = cleDe(f);
    for (const q of Q[cle].questions) {
      comptes += 1;
      if (!md.includes(`**${q.enonce}**`)) { ecart += 1; console.log(`  ⛔ enonce absent du md : ${q.id}`); }
      if (!md.includes(`Conseil : ${q.conseil}`)) { ecart += 1; console.log(`  ⛔ conseil absent du md : ${q.id}`); }
      if (!md.includes(`- ${q.options[q.bonne]} ✅`)) { ecart += 1; console.log(`  ⛔ bonne reponse absente du md : ${q.id}`); }
    }
  }
  // ⚠️ TEMOIN : un enonce altere DOIT etre vu, sinon le zero ne vaut rien.
  const temoinMd = readFileSync(`${DOSSIER}/${fichiers[0]}`, 'utf8');
  const temoinVu = !temoinMd.includes('**Ceci n est pas une question du fichier**');
  console.log(`  ${comptes} questions relues dans le fichier produit, ${ecart} ecart(s)`);
  console.log(`  temoin : un enonce etranger ${temoinVu ? 'est bien detecte' : 'PASSE, la sonde est aveugle'}`);
  return ecart === 0 && temoinVu;
}

if (!sonder(sortie)) { console.log('  ⛔ sonde en echec, rien d ecrit'); process.exit(1); }
if (ECRIRE) {
  writeFileSync(SORTIE, sortie);
  console.log(`  ecrit : ${SORTIE} (${sortie.length} caracteres)`);
} else {
  console.log('  essai a blanc. Relancer avec --ecrire pour poser.');
}
