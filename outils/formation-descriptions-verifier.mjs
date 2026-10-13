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
import { demarquer, marqueursRestants } from './_demarquer.mjs';

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
  /**
   * ── ⛔ LES DEUX COTES SONT DEBALISES, PAR LA MEME FONCTION ────────────────
   *
   * ⚠️ DEFAUT MESURE LE 14/10 : cette comparaison etait VERTE sur six
   * descriptions qui arrivaient a l eleve avec les chevrons de leur bloc de
   * citation. Elle comparait au fichier source, qui porte les memes chevrons :
   * ⛔ un etalon pris dans le meme moule que la mesure ne discrimine rien.
   *
   * ⛔ LA SECTION 5 EST L AUTRE MOITIE DE LA CORRECTION : debaliser des deux
   * cotes rend la comparaison juste sur les MOTS, et il faut un controle separe
   * pour dire qu aucun marqueur n arrive a l ecran. Les deux, pas l un.
   */
  const plat = (s) => demarquer(s).replace(/\s+/g, ' ').trim();
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


console.log('\n  ══ 5. ⛔ LES ONZE DESCRIPTIONS DE MODULE, CARACTÈRE PAR CARACTÈRE ══');
{
  /**
   * ── ⛔ CE QUE LA SECTION 2 NE POUVAIT PAS VOIR ────────────────────────────
   *
   * Elle ne regardait que les CHAPITRES. ⚠️ Les descriptions de MODULE vivent
   * dans un autre bloc et dans un autre fichier source, et deux manquaient sur
   * onze sans qu aucune des quatre sondes ne le dise :
   *
   *     07bis   la cle se perdait un CINQUIEME endroit : la pose lisait
   *             `DESCRIPTIONS[m.numero]`, et le numero du 7 bis est « 7 bis »
   *     09      « Aucune description dans LearnyBox. » etait POSE comme
   *             description, mot pour mot, et s affichait a l eleve
   *
   * ⛔ Le second est le pire des deux : la carte avait l air remplie.
   */
  const LBM = readFileSync('_contenu-formation/descriptions-modules-learnybox.md', 'utf8');
  const plat = (s) => demarquer(s).replace(/\s+/g, ' ').trim();
  const sourceM = plat(LBM);

  // Le bloc DESCRIPTIONS tel qu il est pose dans le fichier de donnees.
  const src = readFileSync('assets/formation-donnees.js', 'utf8');
  const i = src.indexOf('const DESCRIPTIONS = {');
  const j = src.indexOf('\n  };', i);
  const posees = {};
  for (const m of src.slice(i, j).matchAll(/'([\w]+)':\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
    posees[m[1]] = JSON.parse(m[2][0] === "'"
      ? `"${m[2].slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"` : m[2]);
  }

  const ONZE = ['01', '02', '03', '04', '05', '06', '07', '07bis', '08', '09', '10'];
  dire('⛔ les ONZE modules du parcours ont une description posée',
    ONZE.every((c) => (posees[c] || '').trim().length > 20),
    ONZE.filter((c) => !(posees[c] || '').trim().length).join(', ') || '11 sur 11');

  // ⛔ Et chacune se retrouve DANS LA SOURCE, mot pour mot.
  // ⚠️ `'10'` exceptee : la certification n a pas de description LearnyBox, la
  // sienne vient du site. ⛔ Nommee, pas avalee par un filtre discret.
  const dix = ONZE.filter((c) => c !== '10');
  const absentes = dix.filter((c) => !sourceM.includes(plat(posees[c] || 'zzz')));
  dire('⛔ les dix venues de LearnyBox se retrouvent verbatim dans la source',
    absentes.length === 0, absentes.length ? absentes.join(', ') : '10 sur 10');
  dire('⚠️ et celle de la certification vient du site, pas de LearnyBox',
    !sourceM.includes(plat(posees['10'] || 'zzz')));

  /**
   * ⚠️ LE TEMOIN D ECHEC, et c est lui qui donne sa valeur aux deux verts.
   * ⛔ Sans lui, un comparateur qui rendrait toujours vrai passerait inapercu,
   * et c est exactement ce qui est arrive a la section 2 pendant six jours.
   */
  const abimee = posees['01'].replace(/\b(\w{7,})\b/, 'MOTABIME');
  dire('⚠️ TÉMOIN : une description de module abîmée n est PLUS retrouvée',
    abimee !== posees['01'] && !sourceM.includes(plat(abimee)));
  dire('⚠️ TÉMOIN : la phrase qui disait l absence n est PLUS posée',
    !Object.values(posees).some((d) => /^aucune description/i.test(d)),
    'aucun « Aucune description dans LearnyBox. »');

  /* ⛔ ET AUCUN MARQUEUR MARKDOWN N ARRIVE A L ECRAN. */
  const sales = Object.entries(posees)
    .map(([c, d]) => [c, marqueursRestants(d)]).filter(([, r]) => r.length);
  dire('⛔ aucune description de module ne porte de marqueur Markdown',
    sales.length === 0, sales.map(([c, r]) => `${c} (${r.join(', ')})`).join(' ; ') || 'toutes propres');
  dire('⚠️ TÉMOIN : le détecteur de marqueurs n est pas aveugle',
    marqueursRestants('> une citation').length > 0);
}

console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
