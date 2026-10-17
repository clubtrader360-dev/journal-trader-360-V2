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
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const ECRIRE = process.argv.includes('--ecrire');
const SORTIE = 'assets/formation-quiz.js';
const DOSSIER = '_contenu-formation';
const SEUIL = 0.8;
/**
 * ── ⚠️ LES EXERCICES SUR GRAPHIQUE ET LES ILLUSTRATIONS (15/10) ────────────
 * `quiz-exercices.json` ajoute a un quiz des exercices (zone, entrees, reperer,
 * memes formes que la certification) et des illustrations sous certaines
 * questions, par identifiant. Le quiz passe alors par le moteur d examen
 * (voir `mods()` dans supabase-formation.js). Les controles sont ceux de
 * `formation-certification-import.mjs` : chemin complet, bougies au tick,
 * bande qui ne part pas sur la reponse, bons candidats dans la zone avec un
 * stop de 2 a 8 points, cible d un repere presente parmi ses reperes.
 */
const JSON_EX = `${DOSSIER}/quiz-exercices.json`;
const EXTRA = existsSync(JSON_EX) ? JSON.parse(readFileSync(JSON_EX, 'utf8')) : {};
const tick = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;
function verifierExercice(e, cle) {
  const ou = `${cle} ${e.id}`;
  if (!['zone', 'entrees', 'reperer'].includes(e.type)) throw new Error(`${ou} : type inconnu`);
  if (!e.consigne || !e.titre) throw new Error(`${ou} : titre ou consigne absent`);
  if (!Array.isArray(e.chemin) || e.chemin.length < 2) throw new Error(`${ou} : chemin trop court`);
  if (e.chemin[0][1] !== 0 || e.chemin[e.chemin.length - 1][1] !== e.n - 1) throw new Error(`${ou} : le chemin doit aller de la bougie 0 a la bougie ${e.n - 1}`);
  for (const [i, b] of Object.entries(e.bougies || {})) {
    if (+i >= e.n) throw new Error(`${ou} : bougie ${i} hors du graphique`);
    if (!(b.l <= Math.min(b.o, b.c) && b.h >= Math.max(b.o, b.c))) throw new Error(`${ou} : bougie ${i} incoherente`);
    if (![b.o, b.h, b.l, b.c].every(tick)) throw new Error(`${ou} : bougie ${i} hors tick 0,25`);
  }
  if (e.type === 'zone') {
    if (!e.bande || !e.attendu) throw new Error(`${ou} : bande ou attendu absent`);
    if (Math.abs(e.bande.depart - e.attendu.centre) <= e.attendu.marge) throw new Error(`${ou} : la bande part sur la bonne zone`);
  } else if (e.type === 'entrees') {
    if (!e.zone || !Array.isArray(e.candidats) || e.candidats.length < 3) throw new Error(`${ou} : zone ou candidats absents`);
    if (!e.candidats.some((c) => c.bon) || !e.candidats.some((c) => !c.bon)) throw new Error(`${ou} : il faut des bons ET des faux candidats`);
    for (const c of e.candidats) {
      if (!e.bougies || !e.bougies[c.i]) throw new Error(`${ou} : le candidat ${c.lettre} n a pas de bougie posee a la main`);
      if (!c.texte) throw new Error(`${ou} : candidat ${c.lettre} sans explication`);
      if (c.bon) {
        const b = e.bougies[c.i];
        const d = e.sens === 'achat' ? (Math.max(b.o, b.c) + 0.25) - (b.l - 1.25) : (b.h + 1.25) - (Math.min(b.o, b.c) - 0.25);
        if (d < 2 || d > 8) throw new Error(`${ou} : candidat ${c.lettre} donne un stop de ${d} points`);
        const dans = Math.max(b.o, b.c) >= e.zone.bas && Math.min(b.o, b.c) <= e.zone.haut;
        if (!dans) throw new Error(`${ou} : candidat ${c.lettre} « bon » hors de la zone`);
      }
    }
  } else {
    if (!Array.isArray(e.reperes) || e.reperes.length < 2 || !e.cible) throw new Error(`${ou} : reperes ou cible absents`);
    if (!e.reperes.some((r) => r.cle === e.cible)) throw new Error(`${ou} : la cible ${e.cible} n est pas parmi les reperes`);
    const traces = new Set([...(e.indicateurs || []), ...(e.cv != null ? ['cv'] : []), ...(e.pivot != null ? ['pivot'] : [])]);
    for (const r of e.reperes) if (!traces.has(r.cle)) throw new Error(`${ou} : le repere ${r.lettre} (${r.cle}) n est pas trace`);
    const lettres = e.reperes.map((r) => r.lettre);
    if (new Set(lettres).size !== lettres.length) throw new Error(`${ou} : lettres en double`);
  }
}

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
  const extra = EXTRA[cle] || {};
  for (const [id, il] of Object.entries(extra.illustrations || {})) {
    const q = questions.find((x) => x.id === id);
    if (!q) throw new Error(`${f} : illustration pour une question inconnue, ${id}`);
    if (!['bougies', 'graphique', 'courbe'].includes(il.type)) throw new Error(`${f} : illustration ${id} de type inconnu`);
    q.illustration = il;
  }
  const exercices = extra.exercices || [];
  exercices.forEach((e) => verifierExercice(e, cle));
  const ids = exercices.map((e) => e.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${f} : identifiants d exercice en double`);
  return { cle, titre, seuil: SEUIL, questions, exercices, points_par_exercice: extra.points_par_exercice || 2 };
}

const fichiers = readdirSync(DOSSIER).filter((f) => /^quiz-module-.*\.md$/.test(f)).sort();
const quiz = {};
let total = 0;
for (const f of fichiers) {
  const q = lire(f);
  quiz[q.cle] = { titre: q.titre, seuil: q.seuil, questions: q.questions, ...(q.exercices.length ? { exercices: q.exercices, points_par_exercice: q.points_par_exercice, exercices_minimum: 0 } : {}) };
  total += q.questions.length;
  const nbIl = q.questions.filter((x) => x.illustration).length;
  console.log(`  ${q.cle.padEnd(6)} ${String(q.questions.length).padStart(2)} questions${q.exercices.length ? `, ${q.exercices.length} exercice${q.exercices.length > 1 ? 's' : ''} x ${q.points_par_exercice} pts` : ''}${nbIl ? `, ${nbIl} illustree${nbIl > 1 ? 's' : ''}` : ''}   ${q.titre}`);
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
    for (const e of Q[cle].exercices || []) { comptes += 1; if (!readFileSync(JSON_EX, 'utf8').includes(JSON.stringify(e.consigne))) { ecart += 1; console.log(`  ⛔ consigne absente du json : ${cle} ${e.id}`); } }
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
