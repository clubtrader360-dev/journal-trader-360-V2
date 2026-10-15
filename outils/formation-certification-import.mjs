/**
 * Engendre `assets/formation-certification.js` depuis deux sources relues par
 * Nadir : `_contenu-formation/certification-t360.md` (les vingt questions, au
 * format des quiz de module) et `_contenu-formation/certification-exercices.json`
 * (les quatre exercices sur graphique).
 *
 * ── ⛔ LE FICHIER PUBLIE EST PRODUIT, JAMAIS ECRIT A LA MAIN ──────────────
 * Meme regle que `formation-quiz-import.mjs` : ce qui part dans le navigateur
 * est la transcription verbatim des sources, et la sonde de fin le prouve,
 * enonce par enonce, avec son temoin.
 *
 * ── ⚠️ LES REPONSES SONT DANS LE FICHIER PUBLIC, ET C EST ASSUME ───────────
 * Comme pour les quiz. La certification conditionne un badge et 1 000 XP, pas
 * un diplome delivre par un tiers : le diplome reste a la main du coach, qui
 * voit chaque tentative dans le back-office.
 *
 * Usage :
 *     node outils/formation-certification-import.mjs            essai a blanc
 *     node outils/formation-certification-import.mjs --ecrire   pose le fichier
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ECRIRE = process.argv.includes('--ecrire');
const SORTIE = 'assets/formation-certification.js';
const MD = '_contenu-formation/certification-t360.md';
const JSON_EX = '_contenu-formation/certification-exercices.json';

/* ── Les questions, au format des quiz ─────────────────────────────────── */
function lireQuestions() {
  const t = readFileSync(MD, 'utf8');
  const annonce = +(t.match(/partie 1\s+(\d+) questions/) || [])[1];
  const corps = t.split(/\n# Les exercices sur graphique/)[0];
  const blocs = corps.split(/\n## Q/).slice(1);
  const questions = blocs.map((b, i) => {
    const lignes = b.split('\n');
    const type = /vrai \/ faux/.test(lignes[0]) ? 'vraifaux' : 'choix';
    const enonce = (b.match(/^\*\*([\s\S]+?)\*\*$/m) || [])[1];
    if (!enonce) throw new Error(`Q${i + 1} : enonce illisible`);
    const options = [];
    let bonne = -1;
    lignes.filter((l) => /^- /.test(l)).forEach((l) => {
      const brut = l.replace(/^- /, '');
      if (/✅/.test(brut)) bonne = options.length;
      options.push(brut.replace(/\s*✅\s*$/, '').trim());
    });
    if (bonne < 0) throw new Error(`Q${i + 1} : aucune bonne reponse`);
    const r = b.match(/Renvoi : `(m\d+-l\d+)`, entre (\d+) et (\d+) minutes/);
    if (!r) throw new Error(`Q${i + 1} : renvoi illisible`);
    const conseil = (b.match(/^Conseil : (.+)$/m) || [])[1];
    if (!conseil) throw new Error(`Q${i + 1} : pas de conseil`);
    return { id: `c10-${i + 1}`, type, enonce: enonce.trim(), options, bonne, renvoi: { lecon: r[1], de: +r[2], a: +r[3] }, conseil: conseil.trim() };
  });
  if (annonce !== questions.length) throw new Error(`annonce ${annonce} questions, ${questions.length} lues`);
  return questions;
}

/* ── Les exercices : on verifie ce qu on peut verifier ──────────────────── */
function lireExercices() {
  const j = JSON.parse(readFileSync(JSON_EX, 'utf8'));
  const ex = j.exercices;
  if (!Array.isArray(ex) || !ex.length) throw new Error('exercices absents');
  const tick = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;
  for (const e of ex) {
    if (!['zone', 'entrees'].includes(e.type)) throw new Error(`${e.id} : type inconnu`);
    if (!Array.isArray(e.chemin) || e.chemin.length < 2) throw new Error(`${e.id} : chemin trop court`);
    if (e.chemin[0][1] !== 0 || e.chemin[e.chemin.length - 1][1] !== e.n - 1) throw new Error(`${e.id} : le chemin doit aller de la bougie 0 a la bougie ${e.n - 1}`);
    for (const [i, b] of Object.entries(e.bougies || {})) {
      if (+i >= e.n) throw new Error(`${e.id} : bougie ${i} hors du graphique`);
      if (!(b.l <= Math.min(b.o, b.c) && b.h >= Math.max(b.o, b.c))) throw new Error(`${e.id} : bougie ${i} incoherente (l/h)`);
      if (![b.o, b.h, b.l, b.c].every(tick)) throw new Error(`${e.id} : bougie ${i} hors tick 0,25`);
    }
    if (e.type === 'zone') {
      if (!e.bande || !e.attendu) throw new Error(`${e.id} : bande ou attendu absent`);
      // ⚠️ Le depart ne doit pas etre deja la bonne reponse.
      if (Math.abs(e.bande.depart - e.attendu.centre) <= e.attendu.marge) throw new Error(`${e.id} : la bande part sur la bonne zone`);
    } else {
      if (!e.zone || !Array.isArray(e.candidats) || e.candidats.length < 3) throw new Error(`${e.id} : zone ou candidats absents`);
      if (!e.candidats.some((c) => c.bon) || !e.candidats.some((c) => !c.bon)) throw new Error(`${e.id} : il faut des bons ET des faux candidats`);
      for (const c of e.candidats) {
        if (!e.bougies || !e.bougies[c.i]) throw new Error(`${e.id} : le candidat ${c.lettre} n a pas de bougie posee a la main (indice ${c.i})`);
        if (!c.texte) throw new Error(`${e.id} : candidat ${c.lettre} sans explication`);
      }
      // ⛔ Les bons candidats respectent la regle du stop (2 a 8 points) : on la
      // recalcule ici, en entree 0,25 au-dela du corps et stop 1,25 au-dela de
      // la meche, pour que l explication ne mente pas.
      for (const c of e.candidats.filter((x) => x.bon)) {
        const b = e.bougies[c.i];
        const d = e.sens === 'achat' ? (Math.max(b.o, b.c) + 0.25) - (b.l - 1.25) : (b.h + 1.25) - (Math.min(b.o, b.c) - 0.25);
        if (d < 2 || d > 8) throw new Error(`${e.id} : candidat ${c.lettre} donne un stop de ${d} points, hors de 2 a 8`);
        const dansZone = Math.max(b.o, b.c) >= e.zone.bas && Math.min(b.o, b.c) <= e.zone.haut;
        if (!dansZone) throw new Error(`${e.id} : candidat ${c.lettre} « bon » mais son corps n est pas dans la zone`);
      }
    }
  }
  return { points: j.points_par_exercice || 5, exercices: ex };
}

const questions = lireQuestions();
const { points, exercices } = lireExercices();
const total = questions.length + exercices.length * points;
const seuil = Math.ceil(total * 0.8);
console.log(`  ${questions.length} questions, ${exercices.length} exercices x ${points} points, total ${total}, seuil ${seuil} et ${exercices.length - 1} exercices sur ${exercices.length}`);

const donnees = {
  titre: 'Certification Trader 360',
  seuil: 0.8,
  exercices_minimum: exercices.length - 1,
  points_par_exercice: points,
  questions,
  exercices,
};
const corps = JSON.stringify(donnees, null, 1).replace(/</g, '\\u003c');
const sortie = `/**
 * LA CERTIFICATION TRADER 360. ⛔ FICHIER ENGENDRE, NE PAS EDITER A LA MAIN.
 *
 * Produit par \`node outils/formation-certification-import.mjs --ecrire\` depuis
 * \`_contenu-formation/certification-t360.md\` (questions) et
 * \`_contenu-formation/certification-exercices.json\` (exercices), qui sont la
 * source : une question ou un graphique se corrige la-bas, puis on relance.
 *
 * Forme : { titre, seuil, exercices_minimum, points_par_exercice,
 *           questions: [ comme FORMATION_QUIZ ], exercices: [ voir le json ] }
 */
(function () {
  'use strict';
  const racine = typeof window !== 'undefined' ? window : globalThis;
  racine.FORMATION_CERTIFICATION = ${corps};
})();
`;

/* ── LA SONDE ─────────────────────────────────────────────────────────── */
function sonder(texte) {
  const bac = {};
  // eslint-disable-next-line no-new-func
  new Function('window', texte)(bac);
  const C = bac.FORMATION_CERTIFICATION;
  const md = readFileSync(MD, 'utf8');
  const js = readFileSync(JSON_EX, 'utf8');
  let ecart = 0;
  for (const q of C.questions) {
    if (!md.includes(`**${q.enonce}**`)) { ecart += 1; console.log(`  ⛔ enonce absent du md : ${q.id}`); }
    if (!md.includes(`Conseil : ${q.conseil}`)) { ecart += 1; console.log(`  ⛔ conseil absent du md : ${q.id}`); }
    if (!md.includes(`- ${q.options[q.bonne]} ✅`)) { ecart += 1; console.log(`  ⛔ bonne reponse absente du md : ${q.id}`); }
  }
  for (const e of C.exercices) {
    if (!js.includes(JSON.stringify(e.consigne))) { ecart += 1; console.log(`  ⛔ consigne absente du json : ${e.id}`); }
    for (const c of e.candidats || []) if (!js.includes(JSON.stringify(c.texte))) { ecart += 1; console.log(`  ⛔ explication absente du json : ${e.id} ${c.lettre}`); }
  }
  const temoinVu = !md.includes('**Ceci n est pas une question du fichier**') && !js.includes('"Ceci n est pas une consigne"');
  console.log(`  ${C.questions.length} questions et ${C.exercices.length} exercices relus dans le fichier produit, ${ecart} ecart(s)`);
  console.log(`  temoin : un texte etranger ${temoinVu ? 'est bien detecte' : 'PASSE, la sonde est aveugle'}`);
  return ecart === 0 && temoinVu;
}

if (!sonder(sortie)) { console.log('  ⛔ sonde en echec, rien d ecrit'); process.exit(1); }
if (ECRIRE) {
  writeFileSync(SORTIE, sortie);
  console.log(`  ecrit : ${SORTIE} (${sortie.length} caracteres)`);
} else {
  console.log('  essai a blanc. Relancer avec --ecrire pour poser.');
}
