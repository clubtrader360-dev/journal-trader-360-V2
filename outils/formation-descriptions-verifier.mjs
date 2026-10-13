/**
 * ⛔ LES 63 DESCRIPTIONS, COMPAREES MOT POUR MOT A LA SOURCE.
 *
 * ── ⚠️ CE QUE CETTE COMPARAISON VAUT, ET CE QU ELLE NE VAUT PAS ────────────
 *
 * Les donnees sont ENGENDREES depuis le fichier source : la comparaison est
 * donc, par construction, une tautologie tant que l outil d import tourne.
 * ⛔ Sa valeur est ailleurs : elle attrape une edition A LA MAIN du fichier
 * engendre, celle que l en-tete interdit et que quelqu un fera quand meme.
 *
 * ⚠️ Et c est pour cela que le TEMOIN D ECHEC compte plus que le vert : on
 * abime une description, et la comparaison doit le voir. Sans lui, un
 * comparateur qui rendrait toujours vrai passerait inapercu.
 *
 * Usage : node outils/formation-descriptions-verifier.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

/** Ce que le fichier engendre porte. */
function lirePose() {
  const src = readFileSync('assets/formation-donnees.js', 'utf8');
  const i = src.indexOf('const CONTENU_CHAPITRES = {');
  const j = src.indexOf('\n};', i);
  const bloc = src.slice(i, j);
  const out = {};
  for (const m of bloc.matchAll(/'([\w-]+)':\s*\{([^\n]*)\},/g)) {
    const champs = {};
    const d = m[2].match(/description: "((?:[^"\\]|\\.)*)"/);
    const n = m[2].match(/notes: \[([^\]]*)\]/);
    const st = m[2].match(/sousTitre: "((?:[^"\\]|\\.)*)"/);
    const e = m[2].match(/encart: "((?:[^"\\]|\\.)*)"/);
    const lb = m[2].match(/learnybox: "((?:[^"\\]|\\.)*)"/);
    const d2 = (s) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (d) champs.description = d2(d[1]);
    if (n) champs.notes = [...n[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => d2(x[1]));
    if (st) champs.sousTitre = d2(st[1]);
    if (e) champs.encart = d2(e[1]);
    if (lb) champs.learnybox = lb[1];
    out[m[1]] = champs;
  }
  return out;
}

const pose = lirePose();
const LB = readFileSync('_contenu-formation/descriptions-chapitres-learnybox.md', 'utf8');

console.log('\n  ══ 1. ⚠️ L ÉTALONNAGE DU COMPARATEUR ══');
dire('63 chapitres sont posés', Object.keys(pose).length === 63, `${Object.keys(pose).length}`);
{
  // ⚠️ TÉMOIN : le comparateur sait dire non.
  const a = 'Dans ce chapitre, tu vas découvrir les points pivots.';
  dire('⚠️ TÉMOIN : deux textes identiques sont vus identiques', a === a);
  dire('⚠️ TÉMOIN : un mot changé est vu différent',
    a !== a.replace('découvrir', 'comprendre'));
}
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

console.log('\n  ══ 2. CHAQUE DESCRIPTION SE RETROUVE DANS LA SOURCE ══');
{
  /**
   * ⛔ ON CHERCHE LE TEXTE DANS LE FICHIER SOURCE, mot pour mot.
   * ⚠️ La source peut porter des retours a la ligne au milieu d une phrase :
   * on compare donc sur les espaces normalises, DES DEUX COTES. ⛔ Et rien
   * d autre n est normalise : ni les apostrophes, ni la casse, ni la ponctuation.
   */
  const plat = (s) => s.replace(/\s+/g, ' ').trim();
  const source = plat(LB);
  const absents = [];
  let comptees = 0;
  for (const [id, c] of Object.entries(pose)) {
    if (!c.description) continue;
    comptees += 1;
    if (!source.includes(plat(c.description))) absents.push(id);
  }
  dire(`⛔ les ${comptees} descriptions se retrouvent verbatim`, absents.length === 0,
    absents.length ? absents.join(', ') : `${comptees} sur ${comptees}`);

  // ⛔ Et les notes, les sous-titres et les encarts aussi.
  const autres = [];
  for (const [id, c] of Object.entries(pose)) {
    for (const t of [...(c.notes ?? []), c.sousTitre, c.encart].filter(Boolean)) {
      if (!source.includes(plat(t))) autres.push(`${id}`);
    }
  }
  dire('⛔ les notes, sous-titres et encarts aussi', autres.length === 0,
    autres.length ? [...new Set(autres)].join(', ') : 'tous retrouvés');

  /**
   * ⚠️ LE TÉMOIN D ÉCHEC, et c est lui qui donne sa valeur au vert ci-dessus.
   * On abime une description et on exige que la comparaison la perde.
   */
  const victime = Object.entries(pose).find(([, c]) => c.description);
  const abimee = victime[1].description.replace(/\b(\w{6,})\b/, 'MOTABIME');
  dire('⚠️ TÉMOIN : une description abîmée n est PLUS retrouvée',
    abimee !== victime[1].description && !source.includes(plat(abimee)),
    `sur ${victime[0]}`);
}

console.log('\n  ══ 3. LES CAS PARTICULIERS, NOMMÉS ══');
{
  const enAttente = Object.entries(pose).filter(([, c]) => !c.description).map(([id]) => id);
  dire('⛔ CINQ chapitres sont en attente de description, pas inventés',
    enAttente.length === 5, enAttente.join(', '));
  const attendus = ['4.2.2', '5.3 Bis', '7.3', '7.3.1', '7.3.2'];
  const numeros = enAttente.map((id) => pose[id].learnybox).sort();
  dire('⛔ et ce sont bien ceux que la source annonce',
    JSON.stringify(numeros) === JSON.stringify(attendus.sort()), numeros.join(', '));

  const avecNotes = Object.entries(pose).filter(([, c]) => c.notes?.length);
  dire('⛔ TROIS notes distinctes, pas fondues dans les descriptions',
    avecNotes.length === 3, avecNotes.map(([id, c]) => `${c.learnybox}`).join(', '));
  for (const [id, c] of avecNotes) {
    dire(`  ${c.learnybox} porte sa note ET ${c.description ? 'sa description' : 'aucune description'}`,
      true, `« ${c.notes[0].slice(0, 54)}… »`);
  }

  const encarts = Object.entries(pose).filter(([, c]) => c.encart || c.sousTitre);
  dire('⛔ DEUX chapitres portent un encart, posés tels quels',
    encarts.length === 2, encarts.map(([, c]) => c.learnybox).join(', '));
  const avecSousTitre = encarts.filter(([, c]) => c.sousTitre);
  dire('⛔ et 4.3 porte EN PLUS un sous-titre, distinct de l encart',
    avecSousTitre.length === 1 && avecSousTitre[0][1].learnybox === '4.3');
}

console.log('\n  ══ 4. ⛔ LE FICHIER ENGENDRÉ N A PAS ÉTÉ ÉDITÉ À LA MAIN ══');
{
  /**
   * ⛔ ON REGÉNÈRE, ET ON COMPARE. ⚠️ C est le seul contrôle qui attrape une
   * correction faite directement dans le fichier engendré : elle serait perdue
   * au prochain import, et personne ne saurait pourquoi.
   */
  const avant = readFileSync('assets/formation-donnees.js', 'utf8');
  execSync('node outils/formation-descriptions-import.mjs --ecrire', { stdio: 'pipe' });
  const apres = readFileSync('assets/formation-donnees.js', 'utf8');
  dire('⛔ une régénération ne change rien : le fichier est bien engendré',
    avant === apres, avant === apres ? 'identique' : 'DIVERGENT, il a été édité à la main');
}

console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
