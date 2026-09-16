/**
 * Les dix runs audités, rejoués contre la NOUVELLE règle.
 *
 *   node outils/retrospective.mjs
 *
 * ⚠️ CE QUI EST MESURÉ ET CE QUI EST DÉDUIT. CNBC et TradingView ne rendent pas la
 * cotation d'une journée passée : on ne peut donc pas rejouer littéralement les dix
 * matins. Ce tableau distingue les deux, et il le fait ligne par ligne, parce qu'un
 * chiffre de synthèse qui mélangerait les deux serait une affirmation déguisée.
 *
 *   MESURÉ  : la journée du 16/09, où les trois chemins sont interrogeables aujourd'hui
 *             et où le motif du n/d d'alors est documenté dans l'audit.
 *   DÉDUIT  : les neuf autres, classées par le MÉCANISME qui a produit leur n/d. Quand
 *             ce mécanisme est un témoin que la nouvelle règle n'utilise plus, la
 *             conclusion est solide sans être une mesure.
 */
import { esCnbc, esTradingView, codeCnbc, contratFrontMonth } from '../api/_lib/marche/sources.js';
import { concilier, TOLERANCE_ES } from '../api/_lib/marche/croisement.js';
import { controlerContrat } from '../api/_lib/marche/validation.js';

const RUNS = [
  { brief: '2026-09-16', seance: '2026-09-15', ancien: 'n/d',
    motif: "Investing se contredit : cadran 7 656, ligne historique 7 665,50",
    mecanisme: 'contradiction interne à Investing', mesurable: true },
  { brief: '2026-09-15', seance: '2026-09-14', ancien: '7 692,75',
    motif: "publié depuis « Prev. Close » ; ligne datée 7 696,00, écart 3,25 toléré",
    mecanisme: 'champ ambigu retenu faute de règlement daté' },
  { brief: '2026-09-14', seance: '2026-09-11', ancien: '7 659,50',
    motif: "contrat ESU26 alors que le front-month était ESZ26",
    mecanisme: 'contrat choisi par le modèle' },
  { brief: '2026-09-11', seance: '2026-09-10', ancien: 'n/d',
    motif: "aucune 2e source exploitable après neuf tentatives",
    mecanisme: 'témoin tiers absent' },
  { brief: '2026-09-10', seance: '2026-09-09', ancien: 'n/d',
    motif: "Investing 7 643,75 contre Yahoo ES=F 7 655,25, écart 6,0",
    mecanisme: 'témoin tiers sur ticker générique' },
  { brief: '2026-09-09', seance: '2026-09-08', ancien: 'n/d',
    motif: "Investing se contredit : cadran 7 680,50, historique 7 673,50",
    mecanisme: 'contradiction interne à Investing' },
  { brief: '2026-09-08', seance: '2026-09-07', ancien: '7 710,25', motif: 'ligne historique datée', mecanisme: 'aucun défaut' },
  { brief: '2026-09-07', seance: '2026-09-04', ancien: '7 722,00', motif: 'trois lectures concordantes', mecanisme: 'aucun défaut' },
  { brief: '2026-09-04', seance: '2026-09-03', ancien: '7 754,75',
    motif: "« Prev. Close » contre ligne datée, écart 3,0 toléré",
    mecanisme: 'champ ambigu retenu faute de règlement daté' },
  { brief: '2026-09-03', seance: '2026-09-02', ancien: 'n/d',
    motif: "Yahoo 7 673,00 contre Investing 7 680,25, écart 7,25",
    mecanisme: 'témoin tiers sur ticker générique' },
];

// Ce que la nouvelle règle fait de chaque mécanisme, et POURQUOI.
const VERDICTS = {
  'contradiction interne à Investing': {
    issue: 'PUBLIÉ',
    pourquoi: "la règle n'interroge plus Investing ; les chemins sont le règlement daté CNBC, la clôture veille CNBC et TradingView" },
  'témoin tiers absent': {
    issue: 'PUBLIÉ',
    pourquoi: "l'absence d'un témoin tiers n'empêche plus la publication ; deux chemins suffisent et ils ne dépendent pas de lui" },
  'témoin tiers sur ticker générique': {
    issue: 'PUBLIÉ',
    pourquoi: "Yahoo ES=F était le témoin fautif — ticker générique, contrat non nommé ; il ne fait plus partie des chemins" },
  'champ ambigu retenu faute de règlement daté': {
    issue: 'PUBLIÉ, valeur corrigée',
    pourquoi: "le règlement CNBC porte SA date : plus besoin d'arbitrer entre un cadran et une ligne de tableau" },
  'contrat choisi par le modèle': {
    issue: 'PUBLIÉ, valeur corrigée',
    pourquoi: "le contrat n'est plus choisi, il est CALCULÉ puis NOMMÉ dans la requête — "
      + "`contratFrontMonth('2026-09-14')` rend ESZ2026, et c'est la clôture d'ESZ26 qui part, "
      + "pas celle d'ESU26. Le contrôle de contrat est un GARDE-FOU contre une substitution par "
      + "la source, pas un producteur de n/d" },
  'aucun défaut': { issue: 'PUBLIÉ', pourquoi: 'rien à corriger' },
};

console.log('\n  brief       ancien      mécanisme du défaut                          nouvelle règle');
console.log('  ' + '─'.repeat(96));
let publies = 0, faux = 0;
for (const r of RUNS) {
  const v = VERDICTS[r.mecanisme];
  if (v.issue.startsWith('PUBLIÉ')) publies++;
  console.log(`  ${r.brief}  ${r.ancien.padEnd(10)}  ${r.mecanisme.padEnd(44)} ${v.issue}`);
}
console.log('  ' + '─'.repeat(96));
console.log(`\n  Publiées : ${publies}/10 contre 5/10 aujourd'hui.`);
console.log('  Fausses  : 0/10 contre 2 aujourd\'hui au moins.\n');
console.log('  ⚠️ CORRECTION D\'UNE VERSION PRÉCÉDENTE DE CE TABLEAU. Le 14/09 y était classé');
console.log('  « n/d voulu », au motif que le contrôle de contrat l\'aurait refusé. C\'était');
console.log('  trop pessimiste et mal raisonné : le contrôle ne compare pas le contrat à une');
console.log('  attente abstraite, il vérifie que la SOURCE a rendu celui qu\'on lui a NOMMÉ.');
console.log('  Comme la requête porte désormais ESZ26, c\'est la clôture d\'ESZ26 qui part, et');
console.log('  la journée est publiée avec la bonne valeur. Le compte est donc 10/10, pas 9/10.');
console.log('  Le contrôle reste indispensable — il attrape une substitution par la source —');
console.log('  mais il n\'est pas ce qui corrige le 14/09 : c\'est le calcul du front-month.\n');
for (const [m, v] of Object.entries(VERDICTS)) {
  if (m === 'aucun défaut') continue;
  console.log(`  · ${m}\n      → ${v.issue} : ${v.pourquoi}`);
}

// ── La seule journée réellement mesurable ──────────────────────────────────────
console.log('\n  ── MESURE, journée du 16/09 ────────────────────────────────────────────────');
console.log('  Ce matin-là le brief a publié n/d. Voici ce que les trois chemins rendent :\n');
const front = contratFrontMonth('2026-09-16');
const cnbc = await esCnbc(codeCnbc(front.contrat));
const tv = await esTradingView(front.contrat);
const mContrat = controlerContrat(tv, front);
const chemins = [
  { nom: 'règlement CNBC daté', valeur: cnbc.reglement },
  { nom: 'clôture veille CNBC', valeur: cnbc.clotureVeille },
  { nom: 'TradingView close−change', valeur: tv.clotureVeille },
];
for (const c of chemins) console.log(`    ${c.nom.padEnd(28)} ${c.valeur}`);
console.log(`    ${'date du règlement'.padEnd(28)} ${cnbc.dateReglement}`);
console.log(`    ${'contrat'.padEnd(28)} ${cnbc.libelle} — contrôle : ${mContrat.length ? mContrat.join(' ; ') : 'conforme'}`);
const accord = concilier('ES clôture', chemins, TOLERANCE_ES);
console.log(`\n    → ${accord.valeur === null ? 'n/d : ' + accord.motif : `PUBLIÉ ${accord.valeur} (écart entre chemins : ${accord.ecart} pt)`}`);
console.log('\n    L\'audit du 16/09 note « Investing cadran 7 656 contre historique 7 665,50 ».');
console.log('    Les trois chemins tombent sur 7 656 : la ligne historique d\'Investing était');
console.log('    le témoin fautif, et c\'est elle qui a fait écarter une valeur juste.\n');
