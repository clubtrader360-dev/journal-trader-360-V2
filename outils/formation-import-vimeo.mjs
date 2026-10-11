/**
 * PRODUIT le contenu de `assets/formation-donnees.js` depuis les dossiers Vimeo.
 *
 * ⛔ IL N'ECRIT RIEN. Il affiche ce qu'il PROPOSE, et Nadir relit avant de
 * coller. Un outil qui ecrirait directement dans le fichier de donnees ferait
 * disparaitre sans bruit les titres deja corriges a la main.
 *
 * ── ⚠️ LE REFUS QUI COMPTE ──────────────────────────────────────────────────
 *
 * ⛔ IL REFUSE DE PRODUIRE QUOI QUE CE SOIT SI UNE SEULE VIDEO N'EST PAS EN
 * `embed: whitelist`. Une exception suffirait a rendre la formation diffusable :
 * un identifiant d'integration est dans le code de la page, donc lisible par
 * tout eleve, et ⛔ une video diffusee ne se reprend pas.
 *
 * ⚠️ Il refuse EN BLOC, pas video par video. Produire les soixante-trois bonnes
 * et taire la mauvaise serait le pire des deux : on collerait la liste, elle
 * marcherait, et la fuite serait en ligne.
 *
 * ── ⚠️ CE QU'IL NE PEUT PAS SAVOIR ──────────────────────────────────────────
 *
 * 1. LA CORRESPONDANCE DES MODULES. Le site en compte dix, Vimeo neuf plus un
 *    `7BIS`. ⛔ Elle n'est pas tranchee, et il n'en invente aucune : la table
 *    `CORRESPONDANCE` ci-dessous est a remplir par Nadir, en deux minutes, avec
 *    `formation-rapprochement-modules.md` sous les yeux.
 * 2. LES TITRES A AFFICHER. Ceux de Vimeo sont des titres de TRAVAIL, portant
 *    souvent une numerotation interne (« 1.5 - Creer ta routine… »). L'outil les
 *    propose nettoyes de ce prefixe, et le dit : ⚠️ ce ne sont pas des titres
 *    valides, c'est un point de depart.
 *
 * Usage :
 *   node outils/formation-import-vimeo.mjs                      releve local
 *   VIMEO_ACCESS_TOKEN=... node outils/formation-import-vimeo.mjs --vimeo
 */
import { readFileSync } from 'node:fs';

/**
 * ⛔ A REMPLIR PAR NADIR. Chaque module du site pointe vers un ou plusieurs
 * dossiers Vimeo, dans l'ordre ou leurs lecons doivent se suivre.
 * ⚠️ Laisser `null` pour un module sans dossier : l'outil le dira et le laissera
 * vide plutot que d'y mettre n'importe quoi.
 *
 * Exemple de ce qu'il faudra ecrire, et ⛔ CE N'EST PAS UNE PROPOSITION :
 *     '07': ['MODULE 7', 'MODULE 7BIS'],
 */
const CORRESPONDANCE = {
  '01': null,
  '02': null,
  '03': null,
  '04': null,
  '05': null,
  '06': null,
  '07': null,
  '08': null,
  '09': null,
  '10': null,
};

/**
 * ⚠️ UN TABLEAU, PAS UN OBJET, ET C EST UNE CORRECTION.
 * `Object.entries` d un objet rend d abord les cles qui ressemblent a des
 * INDICES de tableau, dans l ordre numerique, puis les autres dans l ordre
 * d insertion. `'10'` est un indice valide, `'01'` non : le module 10 sortait
 * donc EN PREMIER, avant le module 01. ⛔ Rien ne l aurait signale, et la liste
 * collee aurait eu ses modules dans le desordre.
 */
const TITRES_SITE_OBJET = {
  '01': 'Se préparer mentalement et comprendre les bases',
  '02': 'Comprendre le trading',
  '03': 'Maîtriser tes indicateurs, et rien de plus',
  '04': 'Prendre en main ta plateforme de trading',
  '05': 'Appliquer la méthode Trader 360',
  '06': 'Renforcer ta psychologie de trader',
  '07': "Gérer l'après-challenge et structurer son activité",
  '08': 'Comprendre la fiscalité liée au trading',
  '09': 'Pour aller plus loin',
  '10': 'Certification Trader 360',
};

const TITRES_SITE = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
  .map((n) => [n, TITRES_SITE_OBJET[n]]);

const DOSSIER_FORMATION = '27539169';

/** Lit le releve local, ou interroge Vimeo si on lui donne un jeton. */
async function lireDossiers() {
  if (!process.argv.includes('--vimeo')) {
    const f = JSON.parse(readFileSync('formation-vimeo-releve.json', 'utf8'));
    console.log('  source : formation-vimeo-releve.json (releve local du 09/10/2026)');
    console.log('  ⚠️ Relance avec --vimeo et un jeton pour interroger Vimeo en direct.\n');
    return f.dossiers;
  }
  const jeton = process.env.VIMEO_ACCESS_TOKEN;
  if (!jeton) {
    console.error('  ⛔ VIMEO_ACCESS_TOKEN absent. ⚠️ Ne mets jamais sa valeur dans une commande\n'
      + '     visible : passe-la par l environnement.');
    process.exit(1);
  }
  const dossiers = {};
  let page = 1;
  for (;;) {
    const r = await fetch(
      `https://api.vimeo.com/me/projects/${DOSSIER_FORMATION}/videos`
      + `?page=${page}&per_page=100&fields=uri,name,duration,privacy,parent_folder`,
      { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.vimeo.*+json;version=3.4' } });
    if (!r.ok) {
      console.error(`  ⛔ Vimeo a repondu ${r.status}. Rien n est produit.`);
      process.exit(1);
    }
    const j = await r.json();
    for (const v of j.data || []) {
      const d = (v.parent_folder && v.parent_folder.name) || 'Formation';
      (dossiers[d] = dossiers[d] || []).push({
        id: v.uri.split('/').pop(), nom: v.name,
        duree: v.duration, embed: v.privacy.embed, view: v.privacy.view,
      });
    }
    if (!j.paging || !j.paging.next) break;
    page += 1;
  }
  console.log(`  source : API Vimeo, dossier ${DOSSIER_FORMATION}\n`);
  return dossiers;
}

/**
 * Nettoie la numerotation interne des titres Vimeo. ⚠️ `1.5 - Creer ta routine`
 * devient `Creer ta routine` : le numero est deja porte par la position.
 */
const titreDeTravail = (nom) =>
  String(nom).replace(/^\s*\d+(?:\s*bis)?(?:\.\d+)*\s*[-–—:]\s*/i, '').trim() || String(nom).trim();

/** Un identifiant de lecon stable. ⛔ Il ne changera JAMAIS : c'est la cle des notes. */
const idLecon = (mod, rang) => `m${mod}-l${rang}`;

const dossiers = await lireDossiers();
const toutes = Object.entries(dossiers).flatMap(([d, vs]) => vs.map((v) => ({ ...v, dossier: d })));

/* ══ LE REFUS, AVANT TOUTE PRODUCTION ══════════════════════════════════════ */
console.log(`  ${toutes.length} videos relevees dans ${Object.keys(dossiers).length} dossiers\n`);
const fautives = toutes.filter((v) => v.embed !== 'whitelist');
if (fautives.length) {
  console.error('  ⛔ REFUS. Ces videos ne sont pas en `embed: whitelist` :\n');
  for (const v of fautives) {
    console.error(`     ${v.id}  embed=${v.embed}  ${v.dossier}  ${v.nom.slice(0, 50)}`);
  }
  console.error('\n  ⚠️ Une seule exception rendrait la formation diffusable : un identifiant');
  console.error('     d integration est dans le code de la page, donc lisible par tout eleve,');
  console.error('     et une video diffusee ne se reprend pas.');
  console.error('  ⛔ RIEN N EST PRODUIT, pas meme les videos conformes.');
  process.exit(1);
}
console.log('  ok  les ' + toutes.length + ' videos sont en `embed: whitelist`\n');

/* ══ LA CORRESPONDANCE ═════════════════════════════════════════════════════ */
const remplis = Object.entries(CORRESPONDANCE).filter(([, v]) => v && v.length);
if (!remplis.length) {
  console.error('  ⛔ LA TABLE `CORRESPONDANCE` EST VIDE, et elle est a remplir par Nadir.');
  console.error('     Lis `formation-rapprochement-modules.md`, puis ecris par exemple :\n');
  console.error("         '01': ['MODULE 1'],");
  console.error("         '07': ['MODULE 7', 'MODULE 7BIS'],\n");
  console.error('  ⚠️ L outil n en invente aucune : le module 10 n a aucun dossier et le');
  console.error('     `7BIS` aucun module, et ces deux arbitrages ne sont pas techniques.');
  console.error('\n  ── Les dossiers disponibles ──');
  for (const [d, vs] of Object.entries(dossiers)) console.log(`     ${d.padEnd(16)} ${vs.length} videos`);
  process.exit(1);
}

/* ══ LA PRODUCTION ═════════════════════════════════════════════════════════ */
const lignes = [];
let total = 0;
const utilises = new Set();
for (const [num, titreSite] of TITRES_SITE) {
  const sources = CORRESPONDANCE[num];
  if (!sources || !sources.length) {
    lignes.push(`  // ⚠️ Module ${num} : aucun dossier Vimeo associe. Lecons a venir.`);
    lignes.push(`  { numero: '${num}', titre: ${JSON.stringify(titreSite)}, lecons: [] },`);
    continue;
  }
  const videos = sources.flatMap((d) => {
    if (!dossiers[d]) { console.error(`  ⛔ dossier inconnu dans CORRESPONDANCE : ${d}`); process.exit(1); }
    utilises.add(d);
    return dossiers[d].slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });
  lignes.push(`  { numero: '${num}', titre: ${JSON.stringify(titreSite)}, lecons: [`);
  videos.forEach((v, i) => {
    const m = Math.floor(v.duree / 60);
    lignes.push(`    { id: '${idLecon(num, i)}', titre: ${JSON.stringify(titreDeTravail(v.nom))},`
      + ` video: '${v.id}' },  // ${m} min`);
    total += 1;
  });
  lignes.push('  ] },');
}

const orphelins = Object.keys(dossiers).filter((d) => !utilises.has(d));
console.log('  ── A COLLER DANS assets/formation-donnees.js, DANS `MODULES` ──\n');
console.log(lignes.join('\n'));
console.log(`\n  ${total} lecons produites sur ${toutes.length} videos relevees.`);
if (orphelins.length) {
  console.log(`\n  ⚠️ DOSSIERS NON UTILISES, et l outil ne les range pas tout seul :`);
  for (const d of orphelins) console.log(`     ${d.padEnd(16)} ${dossiers[d].length} videos`);
}
console.log('\n  ⚠️ LES TITRES SONT DES TITRES DE TRAVAIL, nettoyes de leur numerotation');
console.log('     interne. ⛔ Ce ne sont pas des titres valides : relis-les avant de coller.');
console.log('  ⚠️ Et les `description` sont absentes : elles viennent de LearnyBox, aucune');
console.log('     video Vimeo n en porte, verifie.');
