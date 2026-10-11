/**
 * LE CONTROLE DES TIRETS, QUI ARRETE LA CHAINE QUAND IL ECHOUE.
 *
 * ── ⛔ POURQUOI IL EST ECRIT DEUX FOIS ──────────────────────────────────────
 *
 * 1. LA PREMIERE VERSION A ECHOUE SANS RIEN ARRETER. L assertion sortait en
 *    erreur, le shell enchainait, le commit est parti. Le controle disait rouge
 *    et j ai rapporte vert. ⚠️ Il sort donc en 1, et il doit etre chaine par
 *    `&&`, jamais par `;`.
 * 2. LA DEUXIEME MESURAIT LA MAUVAISE CHOSE. Elle lisait des fichiers ENTIERS,
 *    donc 52 cadratins ecrits bien avant ce chantier, dans `weekly-report.js` et
 *    `weekly-expert-system.js`. ⛔ Rouge sur du texte que personne ne vient
 *    d ecrire est un rouge qu on apprend a ignorer, et un controle qu on ignore
 *    ne controle plus rien.
 *
 * ⚠️ IL MESURE DONC CE QUE CE CHANTIER AJOUTE : les lignes `+` du diff contre
 * `main`, travail non commite compris, et le contenu des fichiers neufs. Un
 * cadratin ajoute dans un fichier qui en contenait deja est donc vu, puisque
 * c est la LIGNE qui est jugee, pas le fichier.
 *
 * Usage : node outils/controle-tirets.mjs && git commit ...
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * ⚠️ LES DEUX CARACTERES SONT ECRITS EN ECHAPPEMENT, et c est le seul moyen.
 * Ecrits en clair, ce fichier serait rouge DE LUI-MEME : il porterait les deux
 * caracteres qu il cherche. ⛔ Et l exclure de son propre perimetre serait pire :
 * un controle qui ne se regarde pas est un endroit ou un tiret peut vivre.
 * Le meme procede est deja utilise dans `outils/formation-import-vimeo.mjs`.
 */
const CADRATIN = '\u2014';
const DEMI = '\u2013';
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* ══ ETALONNAGE ════════════════════════════════════════════════════════════ */
/**
 * ⚠️ UN DETECTEUR QUI NE VERRAIT RIEN NULLE PART RENDRAIT LE MEME VERT QU UN
 * DEPOT PROPRE. Sur ce projet, un `grep` a deja repondu 0 sur un fichier qui en
 * contenait deux. Deux temoins positifs et un negatif passent avant la mesure.
 */
const compte = (t, c) => (t.match(new RegExp(c, 'g')) || []).length;
if (compte(`temoin ${CADRATIN}`, CADRATIN) !== 1 || compte(`temoin ${DEMI}`, DEMI) !== 1) {
  console.error('  ⛔ ETALONNAGE RATE : le detecteur ne voit pas un tiret connu.');
  process.exit(1);
}
if (compte('trait - barre ─ souligne _ moins −', CADRATIN)) {
  console.error('  ⛔ ETALONNAGE RATE : faux positif sur un trait ordinaire.');
  process.exit(1);
}
console.log('  etalonnage  2 temoins positifs vus, 1 temoin negatif non vu');

/* ══ CE QUE CE CHANTIER AJOUTE ═════════════════════════════════════════════ */
const base = sh('git merge-base main HEAD').trim();
const diff = sh(`git diff ${base} --unified=0`);
const neufs = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);

/** Les lignes `+` du diff, rattachees a leur fichier. ⚠️ `+++` n est pas une ligne ajoutee. */
const ajouts = [];
let courant = '?';
for (const l of diff.split('\n')) {
  if (l.startsWith('+++ b/')) { courant = l.slice(6); continue; }
  if (l.startsWith('+')) ajouts.push([courant, l.slice(1)]);
}
for (const f of neufs) {
  let t;
  try { t = readFileSync(f, 'utf8'); } catch { continue; }
  if (t.includes('\0')) continue;                       // ⚠️ un binaire n a pas de tirets
  for (const l of t.split('\n')) ajouts.push([f, l]);
}

const fautes = ajouts.filter(([, l]) => l.includes(CADRATIN) || l.includes(DEMI));
console.log(`  perimetre   ${ajouts.length} lignes ajoutees par ce chantier`
  + ` (diff contre main + ${neufs.length} fichiers neufs)`);

if (fautes.length) {
  console.error(`\n  ⛔ ${fautes.length} ligne(s) ajoutee(s) portent un tiret cadratin :\n`);
  for (const [f, l] of fautes.slice(0, 15)) console.error(`     ${f}\n       ${l.trim().slice(0, 90)}`);
  if (fautes.length > 15) console.error(`     ... et ${fautes.length - 15} autres`);
  console.error('\n  ⛔ CONTROLE ROUGE. Rien ne doit etre commite.');
  process.exit(1);
}
console.log('  ⇒ aucun tiret cadratin ni demi-cadratin ajoute par ce chantier.\n');

/**
 * ⚠️ POUR INFORMATION, ET CE N EST PAS UNE FAUTE. Ces fichiers portent des
 * cadratins ECRITS AVANT CE CHANTIER. ⛔ Le controle ne les compte pas : les
 * corriger serait toucher du code que ce lot n a pas de raison de rouvrir.
 */
const anciens = sh(`git diff --name-only ${base}`).split('\n').filter(Boolean)
  .map((f) => { try { return [f, compte(readFileSync(f, 'utf8'), CADRATIN)]; } catch { return [f, 0]; } })
  .filter(([, n]) => n > 0);
if (anciens.length) {
  console.log('  ⚠️ pour information, cadratins PREEXISTANTS, hors perimetre :');
  for (const [f, n] of anciens) console.log(`     ${f.padEnd(42)} ${n}`);
}
process.exit(0);


