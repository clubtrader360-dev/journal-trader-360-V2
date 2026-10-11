/**
 * IMPORTE LA PROGRESSION LEARNYBOX DANS `formation_progression`.
 *
 * ── ⛔ POURQUOI CET OUTIL EXISTE AVANT L'EXPORT ─────────────────────────────
 *
 * Ce que les eleves ont deja parcouru n'existe QUE chez LearnyBox. Le jour ou la
 * plateforme s'eteint, cela disparait, et ⛔ C'EST LE SEUL POINT IRRATTRAPABLE
 * DE TOUT LE CHANTIER. Tout le reste peut se refaire.
 *
 * ⚠️ Il est ecrit AVANT l'export, et pas apres, pour que Nadir sache quoi
 * DEMANDER a LearnyBox. Un export qui arrive sans les bonnes colonnes oblige a
 * retourner en chercher un second, et le jour ou la plateforme est coupee, il
 * n'y a plus de second.
 *
 * ── LE FORMAT ATTENDU ───────────────────────────────────────────────────────
 *
 * Un CSV, separateur virgule, premiere ligne d'en-tetes, encodage UTF-8 :
 *
 *     email,lecon_externe,vue,secondes,date
 *     marie@exemple.fr,1.5 - Creer ta routine mentale,oui,0,2026-09-14
 *     marie@exemple.fr,2.1 - Trading contre investissement,oui,312,2026-09-16
 *
 *   email          l'adresse LearnyBox de l'eleve
 *   lecon_externe  le libelle de la lecon COTE LEARNYBOX, tel quel
 *   vue            oui / non, 1 / 0, true / false
 *   secondes       position de lecture si LearnyBox la connait, sinon 0
 *   date           derniere consultation, AAAA-MM-JJ, vide si inconnue
 *
 * ⚠️ `secondes` et `date` peuvent manquer : l'outil s'en passe. ⛔ `email` et
 * `lecon_externe` ne le peuvent pas, et il refuse la ligne si l'un manque.
 *
 * ── ⚠️ CE QU'IL REFUSE DE DEVINER ───────────────────────────────────────────
 *
 * ⛔ Un eleve de l'export absent du journal : il le NOMME et ne cree rien. Creer
 * un compte au passage serait decider a la place de Nadir.
 * ⛔ Une lecon LearnyBox sans correspondance ici : il la NOMME et ne range rien.
 * Deviner une correspondance sur une ressemblance de titre rangerait des
 * progressions sous la mauvaise lecon, et personne ne le verrait.
 *
 * ── ⚠️ IL EST REJOUABLE ─────────────────────────────────────────────────────
 *
 * ⛔ UN IMPORT RELANCE NE DOIT NI DOUBLER NI ECRASER. La cle primaire
 * (user_id, lecon_id) empeche le doublon ; l'ecrasement est empeche par une
 * comparaison de dates : une progression faite dans le NOUVEL espace depuis
 * l'import est plus recente que celle de LearnyBox, et elle gagne.
 *
 * Usage :
 *   node outils/formation-import-progression.mjs fichier.csv            a blanc
 *   node outils/formation-import-progression.mjs fichier.csv --ecrire   ecrit
 */
import { readFileSync } from 'node:fs';

/**
 * ⛔ A REMPLIR PAR NADIR, apres l'import Vimeo. Chaque libelle LearnyBox pointe
 * vers un identifiant de lecon d'ici. ⚠️ L'outil n'en invente aucune : il liste
 * les libelles inconnus et s'arrete.
 *
 *     'Creer ta routine mentale': 'm01-l5',
 */
const CORRESPONDANCE_LECONS = {};

const fichier = process.argv[2];
const ecrire = process.argv.includes('--ecrire');
if (!fichier) {
  console.error('  Usage : node outils/formation-import-progression.mjs fichier.csv [--ecrire]');
  process.exit(1);
}

/** Analyse un CSV simple, guillemets compris. ⚠️ Les notes peuvent contenir des virgules. */
function lireCsv(texte) {
  const lignes = [];
  let champ = '';
  let ligne = [];
  let dansGuillemets = false;
  const t = texte.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (dansGuillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i += 1; }
      else if (c === '"') dansGuillemets = false;
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ',') { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  if (!lignes.length) return [];
  const entetes = lignes[0].map((h) => h.trim().toLowerCase());
  return lignes.slice(1).filter((l) => l.some((c) => c.trim()))
    .map((l) => Object.fromEntries(entetes.map((h, i) => [h, (l[i] || '').trim()])));
}

const vraiFaux = (v) => ['oui', '1', 'true', 'vrai', 'yes'].includes(String(v).trim().toLowerCase());

const brut = lireCsv(readFileSync(fichier, 'utf8'));
console.log(`\n  ${brut.length} lignes lues dans ${fichier}\n`);

/* ══ CE QU'IL NE SAIT PAS FAIRE, DIT AVANT TOUTE ECRITURE ══════════════════ */
const manquants = brut.filter((l) => !l.email || !l.lecon_externe);
const leconsInconnues = [...new Set(brut.map((l) => l.lecon_externe).filter(Boolean))]
  .filter((x) => !CORRESPONDANCE_LECONS[x]);

let arret = false;
if (manquants.length) {
  console.error(`  ⛔ ${manquants.length} ligne(s) sans email ou sans lecon_externe. Elles ne`);
  console.error('     peuvent pas etre rangees, et l outil ne devine pas a qui elles sont.');
  arret = true;
}
if (leconsInconnues.length) {
  console.error(`\n  ⛔ ${leconsInconnues.length} libelle(s) LearnyBox sans correspondance :\n`);
  for (const x of leconsInconnues.slice(0, 20)) console.error(`     ${x}`);
  if (leconsInconnues.length > 20) console.error(`     ... et ${leconsInconnues.length - 20} autres`);
  console.error('\n  ⚠️ Remplis `CORRESPONDANCE_LECONS` en tete de ce fichier. ⛔ L outil n en');
  console.error('     invente aucune : deviner sur une ressemblance de titre rangerait des');
  console.error('     progressions sous la mauvaise lecon, et personne ne le verrait.');
  arret = true;
}
if (arret) { console.error('\n  ⛔ RIEN N EST ECRIT.'); process.exit(1); }

/* ══ LES COMPTES ═══════════════════════════════════════════════════════════ */
const URL_SB = process.env.SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CLE) {
  console.error('  ⛔ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente.');
  console.error('  ⚠️ Ne mets jamais leur valeur dans une commande visible.');
  process.exit(1);
}
const sb = async (chemin, opts = {}) => {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
    ...opts,
    headers: { apikey: CLE, Authorization: `Bearer ${CLE}`,
      'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

const adresses = [...new Set(brut.map((l) => l.email.toLowerCase()))];
const comptes = await sb(`users?select=uuid,email&email=in.(${adresses.map((a) => `"${a}"`).join(',')})`);
const parAdresse = new Map(comptes.map((c) => [String(c.email).toLowerCase(), c.uuid]));
const inconnus = adresses.filter((a) => !parAdresse.has(a));
if (inconnus.length) {
  console.error(`  ⛔ ${inconnus.length} adresse(s) de l export absente(s) du journal :\n`);
  for (const a of inconnus.slice(0, 20)) console.error(`     ${a}`);
  console.error('\n  ⚠️ Ce sont les eleves qui perdraient leur progression. ⛔ L outil ne cree');
  console.error('     aucun compte : ce serait decider a la place de Nadir.');
  console.error('\n  ⛔ RIEN N EST ECRIT.');
  process.exit(1);
}

/* ══ CE QUI EXISTE DEJA, POUR NE RIEN ECRASER ══════════════════════════════ */
const uuids = [...new Set([...parAdresse.values()])];
const deja = await sb('formation_progression?select=user_id,lecon_id,vue,progress_seconds,last_watched_at'
  + `&user_id=in.(${uuids.map((u) => `"${u}"`).join(',')})`);
const cle = (u, l) => `${u}|${l}`;
const existant = new Map(deja.map((d) => [cle(d.user_id, d.lecon_id), d]));

const aEcrire = [];
let ignorees = 0;
let plusRecentes = 0;
for (const l of brut) {
  const u = parAdresse.get(l.email.toLowerCase());
  const leconId = CORRESPONDANCE_LECONS[l.lecon_externe];
  const quand = l.date ? new Date(`${l.date}T12:00:00Z`).toISOString() : new Date(0).toISOString();
  const avant = existant.get(cle(u, leconId));
  if (avant) {
    /**
     * ⚠️ C'EST ICI QUE LA REJOUABILITE SE JOUE. Une ligne deja presente dont la
     * date est PLUS RECENTE que celle de l export vient du nouvel espace : elle
     * gagne. ⛔ L ecraser ferait reculer la progression de quelqu un qui a
     * travaille depuis l import, et il ne comprendrait pas pourquoi.
     */
    if (Date.parse(avant.last_watched_at) > Date.parse(quand)) { plusRecentes += 1; continue; }
    ignorees += 1;
  }
  aEcrire.push({
    user_id: u, lecon_id: leconId, vue: vraiFaux(l.vue),
    progress_seconds: Math.max(0, parseInt(l.secondes, 10) || 0),
    last_watched_at: quand,
  });
}

console.log(`  ${aEcrire.length} ligne(s) a ecrire`);
console.log(`  ${plusRecentes} conservee(s) telles quelles : deja plus recentes en base`);
console.log(`  ${ignorees} reecrite(s) a l identique ou avec une date plus ancienne en base`);

if (!ecrire) {
  console.log('\n  ⚠️ A BLANC. Rien n a ete ecrit. Relance avec --ecrire pour appliquer.');
  console.log('  ⛔ Et relis les comptes ci-dessus avant : un import se defait mal.');
  process.exit(0);
}

/**
 * ⚠️ `resolution=merge-duplicates` sur la cle (user_id, lecon_id) : un import
 * relance ne DOUBLE donc jamais, la cle primaire l interdit par construction.
 */
for (let i = 0; i < aEcrire.length; i += 200) {
  await sb('formation_progression?on_conflict=user_id,lecon_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(aEcrire.slice(i, i + 200)),
  });
  console.log(`  ecrit ${Math.min(i + 200, aEcrire.length)} / ${aEcrire.length}`);
}
console.log('\n  ✅ Import termine.');
