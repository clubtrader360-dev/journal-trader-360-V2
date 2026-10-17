/**
 * TRANSFORME LE RELEVE DU BACK-OFFICE LEARNYBOX EN SQL POUR
 * `formation_progression_learnybox`.
 *
 * ── ⛔ D OU VIENT LE RELEVE ────────────────────────────────────────────────
 *
 * Le 14/10/2026, l API et l export LearnyBox ne donnant que le niveau et un
 * pourcentage global, le detail par chapitre a ete lu dans le back-office
 * (`/app/user/{id}/?tab=formation&action=formation_progression&formation_id=85588`)
 * pour les 101 membres, depuis le navigateur de Nadir connecte. Chaque page
 * y porte un etat : « Page terminée », « Page vue » ou « Non vue », une date
 * et un temps passe. Le releve est un JSON compact :
 *
 *     { titres: [65 titres], membres: { learnybox_id: [ "<idxTitre><T|V><AAAAMMJJ>", ... ] } }
 *
 * ⚠️ Les « Non vue » n y sont pas : rien a importer.
 *
 * ── ⛔ CE QUI COMPTE COMME « VU » ──────────────────────────────────────────
 *
 * « Page terminée » (T) devient `vue = true`. « Page vue » (V) est une page
 * ouverte et laissee : elle n est PAS cochee, exactement la regle de l espace
 * formation (voir l en-tete de `supabase-formation.js`). Elle est gardee dans
 * la table LearnyBox pour memoire, avec son etat.
 *
 * ── ⚠️ LA CORRESPONDANCE DES TITRES EST PAR NUMERO, ET ELLE EST EPROUVEE ──
 *
 * Les titres LearnyBox sont tronques (« ... ») : on ne les compare pas, on lit
 * leur NUMERO (« 2.3.1 », « 5.3 Bis », « 7bis 2 ») et on le cherche dans la
 * cle `learnybox` de `CONTENU_CHAPITRES`. Les trois bonus du module 9 n ont
 * pas de numero : ils sont nommes ici. « 6.5 QUIZZ » et « Bienvenue » sont
 * traites a part. ⛔ Un titre sans correspondance arrete l outil.
 *
 * ── ⛔ L APPLICATION A `formation_progression` EST FAITE EN BASE ───────────
 *
 * Par la fonction `appliquer_progression_learnybox()`, rejouable : elle ne
 * cree aucun compte, n ecrase jamais un `vue = true`, et ne touche que les
 * eleves dont l email LearnyBox est celui d un compte du journal. Les autres
 * attendent dans la table ; on la rejoue le jour ou ils ont un compte.
 *
 * Usage :
 *   node outils/formation-import-progression-learnybox.mjs releve.json > /tmp/progression.sql
 */
import { readFileSync } from 'node:fs';

const chemin = process.argv[2];
if (!chemin) { console.error('usage : node outils/formation-import-progression-learnybox.mjs releve.json'); process.exit(1); }
const releve = JSON.parse(readFileSync(chemin, 'utf8'));

/* La correspondance numero LearnyBox -> identifiant de lecon, lue dans la donnee. */
const src = readFileSync('assets/formation-donnees.js', 'utf8');
const PAR_NUMERO = {};
for (const m of src.matchAll(/'(m\d+-l\d+)': \{[^}]*learnybox: "([^"]+)"/g)) PAR_NUMERO[m[2]] = m[1];
const NOMMES = {
  'Bienvenue à Trader 360': 'm00-l0',
  'MODULE ANTI-PERTE DE CONFIANCE': 'm09-l0',
  'PROGRAMME MEMBRE & SYSTÈME DE RECOMMANDATION': 'm09-l1',
  'TUTO "IMBALANCE"': 'm09-l2',
};
/** Le numero en tete d un titre : « 2.3.1 - Configurer » -> « 2.3.1 », « 5.3 Bis Identifier » -> « 5.3 Bis », « 7bis 2 - ... » -> « 7bis 2 ». */
function numeroDe(titre) {
  let m = titre.match(/^(7bis (?:Intro|\d))\b/);
  if (m) return m[1];
  m = titre.match(/^(\d+(?:\.\d+)*)( Bis)?\b/);
  return m ? m[1] + (m[2] || '') : null;
}
function leconDe(titre) {
  if (NOMMES[titre]) return NOMMES[titre];
  const n = numeroDe(titre);
  if (n === '6.5') return null;                     // le quiz LearnyBox, pas un chapitre
  return n && PAR_NUMERO[n] ? PAR_NUMERO[n] : undefined;
}

/* ⚠️ TEMOINS : les formes connues se lisent, une forme etrangere arrete. */
const temoins = [
  leconDe('2.3.1 - Configurer INVESTING') === 'm02-l4',
  leconDe('5.3 Bis Identifier les zones (Sur ta plateforme)') === 'm05-l4',
  leconDe('5.3 Identifier les zones') === 'm05-l3',
  leconDe('7bis Intro - Structurer son activité de trader apr ...') === 'm07-l9',
  leconDe('7bis 2 - Appliquer un scaling plan pour faire croî ...') === 'm07-l11',
  leconDe('4.2.2 Installer TradingView (Complément)') === 'm04-l4',
  leconDe('6.5 QUIZZ et évaluation avant le niveau confirmé') === null,
  leconDe('TUTO "IMBALANCE"') === 'm09-l2',
  leconDe('12.9 Un chapitre qui n existe pas') === undefined,
];
if (!temoins.every(Boolean)) { console.error('⛔ temoin de correspondance en echec', temoins); process.exit(1); }

const CORRESP = releve.titres.map((t) => leconDe(t));
const inconnus = releve.titres.filter((t, i) => CORRESP[i] === undefined);
if (inconnus.length) { console.error('⛔ titres sans correspondance :', inconnus); process.exit(1); }
const lecons = new Set(CORRESP.filter(Boolean));
console.error(`${releve.titres.length} titres, ${lecons.size} lecons distinctes (64 attendues : 63 + Bienvenue), 1 quiz ignore`);
if (lecons.size !== 64) { console.error('⛔ 64 lecons attendues'); process.exit(1); }

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const valeurs = [];
let T = 0; let V = 0;
for (const [id, lignes] of Object.entries(releve.membres)) {
  for (const l of lignes) {
    const m = l.match(/^(\d+)([TV])(\d{8})$/);
    if (!m) { console.error('⛔ ligne illisible', id, l); process.exit(1); }
    const lecon = CORRESP[Number(m[1])];
    if (!lecon) continue;                            // 6.5 QUIZZ
    const etat = m[2] === 'T' ? 'terminee' : 'vue';
    if (m[2] === 'T') T += 1; else V += 1;
    const d = `${m[3].slice(0, 4)}-${m[3].slice(4, 6)}-${m[3].slice(6, 8)}`;
    valeurs.push(`(${q(id)}, ${q(lecon)}, ${q(etat)}, '${d}')`);
  }
}
console.error(`${valeurs.length} lignes : ${T} terminees, ${V} seulement vues, ${Object.keys(releve.membres).length} membres`);
console.log(`insert into public.formation_progression_learnybox (learnybox_id, lecon_id, etat, vu_le) values
${valeurs.join(',\n')}
on conflict (learnybox_id, lecon_id) do update set etat = excluded.etat, vu_le = excluded.vu_le, releve_le = now();`);
