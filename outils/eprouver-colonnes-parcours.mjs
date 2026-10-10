/**
 * Épreuve : les colonnes de « 👥 Parcours Membre » sont-elles bien retrouvées par TITRE ?
 *
 *   node outils/eprouver-colonnes-parcours.mjs
 *
 * Aucun réseau, aucun secret : le tableur et Supabase sont simulés en mémoire. Les TITRES,
 * eux, sont les vrais — la ligne 3 de l'onglet telle que relevée le 09/10/2026.
 *
 * Trois questions :
 *  1. Avec les titres actuels, retrouve-t-on exactement les anciennes positions en dur
 *     (B, C, D, T, U et l'écriture en X) ? Sinon le comportement a changé sans qu'on déplace rien.
 *  2. Avec 3 colonnes déplacées, les vrais endpoints (webhook, backfill, destinataires du
 *     brief, endpoint coach) lisent-ils et écrivent-ils toujours les bonnes cellules ?
 *  3. Titre absent ou en double : aucune écriture, et le webhook répond 200 ?
 *
 * Les endpoints testés sont les fichiers de `api/` eux-mêmes, pas une copie : seuls leurs
 * accès externes (client Sheets, client Supabase, auth coach) sont remplacés.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import module from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  normHeaderTitle, resolveColumns, columnLetter, cellA1, TITRES, SHEET_NAME, RANGE_ONGLET,
} from '../api/_lib/parcours-colonnes.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let echecs = 0;
const verifier = (nom, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`${ok ? '✅' : '❌'} ${nom}${detail ? ' — ' + detail : ''}`);
};

// ── Ligne 3 RÉELLE de l'onglet (A3 = « ID », posé par le script Apps Script le 09/10/2026) ──
const TITRES_REELS = [
  'ID', 'Prénom', 'Nom', 'Statut', 'Score Semaine\n/20', 'Date\nentrée', 'Ancienneté', 'Coach', 'Niveau',
  'Progression', 'Dernière\nactivité LB', 'Dernier\ncontact', 'Jours', 'Google Forms + Suivi rapport',
  'Dernier envoi rapport', 'Prochain contact (RT OK+31j)', 'Tél WhatsApp', 'ID\nDiscord',
  '🎧 Dernier message Discord', 'Mail\nLearnyBox', '2ème mail', 'Instagram', 'Méthode', 'Journal',
  'Ambassadeur', 'Témoignage', 'Sujet\ntémoignage', 'Contrat', 'Montant\n(€)', 'Parrain',
  'Autres\nformations', 'Présentiel', '🎂 Anniversaire', 'Notes',
  'Tes objectifs concrets avec Trader 360 ?', 'Tes blocages actuels ?', 'Autre chose à nous dire ?',
  'Remarques du membre', 'Nombre de messages Discord (total)', 'Messages cette semaine', 'Bonus engagement',
];
const TOUS = Object.values(TITRES);

// ── 1. Normalisation : même résultat que le script Apps Script ──
verifier('normalisation : emoji, accents, retours ligne, espaces',
  normHeaderTitle('🎂 Anniversaire') === 'anniversaire' && normHeaderTitle('Mail\nLearnyBox') === 'mail learnybox'
  && normHeaderTitle(' 2ème  mail ') === '2eme mail' && normHeaderTitle('Montant\n(€)') === 'montant (€)');
{
  const voisin = path.join(os.homedir(), 'projets/trader360-apps-script/src/Code.js');
  if (fs.existsSync(voisin)) {
    const m = /function _normHeaderTitle_\(raw\) \{[\s\S]*?\n\}/.exec(fs.readFileSync(voisin, 'utf8'));
    const appsScript = m && new Function(`${m[0]}; return _normHeaderTitle_;`)();
    const epreuves = TITRES_REELS.concat(['  STATUT ', 'Journal 📓', 'É́té indien', '', null, 42, '🇫🇷 Drapeau', 'a\tb\r\nc']);
    const ecarts = appsScript ? epreuves.filter((t) => appsScript(t) !== normHeaderTitle(t)) : ['fonction introuvable'];
    verifier('normalisation IDENTIQUE à _normHeaderTitle_ (Apps Script)', ecarts.length === 0, ecarts.length ? `écarts : ${JSON.stringify(ecarts)}` : `${epreuves.length} titres comparés`);
  } else {
    console.log('⏭️  comparaison avec le script Apps Script sautée (repo voisin absent)');
  }
}

// ── 2. Titres actuels → mêmes positions que les anciennes constantes en dur ──
{
  const r = resolveColumns(TITRES_REELS, TOUS);
  const lettres = Object.fromEntries(TOUS.map((t) => [t, r.cols[t] === undefined ? '∅' : columnLetter(r.cols[t])]));
  const attendu = { prenom: 'B', nom: 'C', statut: 'D', 'mail learnybox': 'T', '2eme mail': 'U', journal: 'X' };
  verifier('titres actuels : résolution sans absent ni doublon', r.ok, r.error || '');
  verifier('titres actuels : positions = anciennes constantes (B, C, D, T, U, écriture X)',
    JSON.stringify(lettres) === JSON.stringify(attendu), JSON.stringify(lettres));
  verifier('titres actuels : cellule d\'écriture', cellA1(r.cols.journal, 12) === `'${SHEET_NAME}'!X12`, cellA1(r.cols.journal, 12));
}

// ── Tableur simulé ──
// Membres fictifs. Une valeur par TITRE normalisé : le même contenu sert à toutes les dispositions.
const MEMBRES = [
  { prenom: 'Alice', nom: 'MARTIN', statut: '🟢', 'mail learnybox': 'alice@example.com', '2eme mail': '', journal: '55.0' },
  { prenom: 'Bruno', nom: 'DURAND', statut: '🔴 Inactif', 'mail learnybox': 'bruno@example.com', '2eme mail': '' },
  { prenom: 'Chloé', nom: 'PETIT', statut: '⚪', 'mail learnybox': '', '2eme mail': 'chloe@example.org / chloe.bis@example.net' },
  { prenom: 'David', nom: 'ROUX', statut: '⚪', 'mail learnybox': 'pas un mail', '2eme mail': '' },
  { prenom: 'Emma', nom: 'MOREAU', statut: '🔵', 'mail learnybox': 'emma@example.com', '2eme mail': 'alice@example.com' },
  { prenom: '', nom: '', statut: '', 'mail learnybox': '', '2eme mail': '' },
  { prenom: 'Farid', nom: 'BENALI', statut: '⚪', 'mail learnybox': 'Farid@Example.com', '2eme mail': '' },
];
// Disposition = ordre des titres. `deplacer` reproduit un glisser-déposer de colonne.
const deplacer = (titres, titre, avant) => {
  const t = titres.filter((x) => normHeaderTitle(x) !== titre);
  const src = titres.find((x) => normHeaderTitle(x) === titre);
  const i = avant === null ? t.length : t.findIndex((x) => normHeaderTitle(x) === avant);
  t.splice(i, 0, src);
  return t;
};
const ORIGINE = TITRES_REELS;
// S avant B, Journal en fin, Statut après Ancienneté (= avant Coach).
const DEPLACEE = deplacer(deplacer(deplacer(TITRES_REELS, 'dernier message discord', 'prenom'), 'journal', null), 'statut', 'coach');

function construireGrille(titres) {
  const grille = [[], ['Mise à jour : 09/10/2026 08:00 (épreuve)'], titres.slice()];
  MEMBRES.forEach((m, i) => {
    grille.push(titres.map((t) => {
      const n = normHeaderTitle(t);
      if (n === 'id') return m.prenom ? String(i + 1) : '';
      return m[n] !== undefined ? m[n] : (m.prenom ? `${n}#${i + 1}` : '');
    }));
  });
  return grille;
}
const lettreVersIdx = (L) => [...L].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

function faireSheets(grille) {
  const journal = { lectures: [], ecritures: [] };
  // L'API coupe les cellules vides en fin de ligne : on fait pareil.
  const rogner = (row) => { const r = row.slice(); while (r.length && (r[r.length - 1] === '' || r[r.length - 1] == null)) r.pop(); return r; };
  const lire = (range) => {
    journal.lectures.push(range);
    if (range === RANGE_ONGLET) return grille.map(rogner);
    if (range === `'${SHEET_NAME}'!A2`) return [[grille[1][0]]];
    throw new Error(`plage inattendue (position en dur ?) : ${range}`);
  };
  const ecrire = (range, values) => {
    const m = new RegExp(`^'${SHEET_NAME}'!([A-Z]+)(\\d+)$`).exec(range);
    if (!m) throw new Error(`écriture hors cellule unique : ${range}`);
    const col = lettreVersIdx(m[1]), row = Number(m[2]);
    journal.ecritures.push({ range, titre: normHeaderTitle(grille[2][col]), prenom: grille[row - 1][grille[2].findIndex((t) => normHeaderTitle(t) === 'prenom')], valeur: values[0][0] });
    grille[row - 1][col] = values[0][0];
  };
  const client = { spreadsheets: { values: {
    get: async ({ range }) => ({ data: { values: lire(range) } }),
    batchGet: async ({ ranges }) => ({ data: { valueRanges: ranges.map((r) => ({ values: lire(r) })) } }),
    update: async ({ range, requestBody }) => { ecrire(range, requestBody.values); return {}; },
    batchUpdate: async ({ requestBody }) => { requestBody.data.forEach((d) => ecrire(d.range, d.values)); return {}; },
  } } };
  return { client, journal };
}

// Supabase simulé : alice et emma ont rempli leur journal, farid est inscrit sans journal.
const UTILISATEURS = [
  { uuid: 'u-alice', email: 'alice@example.com' }, { uuid: 'u-emma', email: 'emma@example.com' },
  { uuid: 'u-farid', email: 'farid@example.com' }, { uuid: 'u-chloe', email: 'chloe.bis@example.net' },
  { uuid: 'u-inconnu', email: 'personne@example.com' },
];
const JOURNAUX = { 'u-alice': 2, 'u-emma': 1, 'u-chloe': 1 };
function faireSupabase() {
  return { from(table) {
    const q = { table, filtres: {} };
    const resultat = () => {
      if (table === 'users') {
        if (q.filtres.uuid) { const u = UTILISATEURS.find((x) => x.uuid === q.filtres.uuid); return { data: u || null, error: u ? null : { message: 'absent' } }; }
        return { data: UTILISATEURS, error: null };
      }
      if (table === 'journal_entries') return { count: JOURNAUX[q.filtres.user_id] || 0, error: null };
      return { data: [], error: null };
    };
    const b = {
      select: () => b, limit: () => b, lte: () => b,
      // Plus de borne basse sur la date : la fenêtre de 3 jours a été supprimée (10/10/2026).
      gte: () => { throw new Error('fenêtre de dates réintroduite (gte) : la note doit s\'afficher quel que soit son âge'); },
      eq: (k, v) => { q.filtres[k] = v; return b; },
      single: async () => resultat(),
      then: (ok, ko) => Promise.resolve(resultat()).then(ok, ko),
    };
    return b;
  } };
}

// ── Remplacement des accès externes des endpoints (rien d'autre n'est touché) ──
if (typeof module.registerHooks !== 'function') {
  console.log('❌ Node trop ancien pour l\'épreuve de bout en bout (module.registerHooks requis, Node ≥ 22.15).');
  process.exit(1);
}
const BOUCHONS = {
  'coach/_lib/sheets-client.js': 'export const getSheetsClient = () => globalThis.__epreuve.sheets; export const getSheetId = () => "tableur-epreuve";',
  'tradovate/_lib/auth.js': 'export const getServiceClient = () => globalThis.__epreuve.sb; export const readJson = async (req) => req.body;',
  'vimeo/_lib/coach-auth.js': 'export const requireCoach = async () => ({ role: "coach" });',
};
module.registerHooks({
  resolve(specifier, context, next) {
    const r = next(specifier, context);
    const cle = Object.keys(BOUCHONS).find((k) => r.url.endsWith('/api/' + k));
    return cle ? { url: 'data:text/javascript,' + encodeURIComponent(BOUCHONS[cle]), shortCircuit: true, format: 'module' } : r;
  },
});
const importer = (rel) => import(pathToFileURL(path.join(RACINE, rel)).href);
const { default: webhook } = await importer('api/webhook/journal-entry.js');
const { getBriefRecipients } = await importer('api/_lib/tableur-recipients.js');
process.env.SUPABASE_WEBHOOK_SECRET = 'secret-epreuve';

const faireRes = () => { const r = { code: null, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(o) { r.corps = o; return r; } }; return r; };
async function appelerWebhook(grille, { user_id, backfill } = {}) {
  const { client, journal } = faireSheets(grille);
  globalThis.__epreuve = { sheets: client, sb: faireSupabase() };
  const res = faireRes();
  const erreurs = [];
  const origErr = console.error, origLog = console.log, origWarn = console.warn;
  console.error = (...a) => erreurs.push(a.join(' ')); console.log = () => {}; console.warn = () => {};
  try {
    await webhook({ method: 'POST', headers: { 'x-webhook-secret': 'secret-epreuve' }, query: backfill ? { action: 'backfill-full' } : {}, body: { type: 'INSERT', record: { user_id } } }, res);
  } finally { console.error = origErr; console.log = origLog; console.warn = origWarn; }
  return { res, journal, erreurs };
}

// ── 3. Webhook, backfill, destinataires, endpoint coach : origine puis colonnes déplacées ──
const attenduBackfill = { Alice: 'score', Bruno: 'no', 'Chloé': 'score', Emma: 'score', Farid: 'vide' };
let destinatairesOrigine = null;
for (const [nom, titres, lettreJournal] of [['disposition actuelle', ORIGINE, 'X'], ['3 colonnes déplacées', DEPLACEE, 'AO']]) {
  const cols = resolveColumns(titres, TOUS);
  console.log(`\n— ${nom} : ${TOUS.map((t) => `${t}=${columnLetter(cols.cols[t])}`).join(', ')}`);
  verifier(`${nom} : colonne « journal » en ${lettreJournal}`, columnLetter(cols.cols.journal) === lettreJournal);

  // Webhook unitaire : Emma (ligne 8) a un journal → score écrit dans SA cellule « Journal ».
  let g = construireGrille(titres);
  let r = await appelerWebhook(g, { user_id: 'u-emma' });
  let e = r.journal.ecritures;
  verifier(`${nom} : webhook → 1 écriture, colonne « Journal », ligne d'Emma`,
    r.res.code === 200 && r.res.corps.ok === true && r.res.corps.row === 8 && e.length === 1 && e[0].titre === 'journal' && e[0].prenom === 'Emma' && e[0].range === `'${SHEET_NAME}'!${lettreJournal}8` && /^\d+\.\d$/.test(e[0].valeur),
    `${e[0] && e[0].range} = ${e[0] && e[0].valeur}`);
  // Match par le 2ème mail (multi-valeurs) : Chloé, ligne 6.
  r = await appelerWebhook(construireGrille(titres), { user_id: 'u-chloe' });
  verifier(`${nom} : webhook → match par « 2ème mail » (Chloé)`, r.res.corps.row === 6 && r.journal.ecritures[0].prenom === 'Chloé', r.journal.ecritures[0] && r.journal.ecritures[0].range);
  // Élève absent du tableur : 200, aucune écriture.
  r = await appelerWebhook(construireGrille(titres), { user_id: 'u-inconnu' });
  verifier(`${nom} : webhook → élève hors tableur, aucune écriture`, r.res.code === 200 && r.res.corps.matched === false && r.journal.ecritures.length === 0);

  // Backfill : une cellule « Journal » par ligne portant un e-mail, rien ailleurs.
  r = await appelerWebhook(construireGrille(titres), { backfill: true });
  e = r.journal.ecritures;
  const lu = Object.fromEntries(e.map((x) => [x.prenom, /^\d+\.\d$/.test(x.valeur) ? 'score' : x.valeur]));
  verifier(`${nom} : backfill → ${e.length} écritures, toutes en « Journal »`,
    r.res.corps.ok === true && e.length === 6 && e.every((x) => x.titre === 'journal' && x.range.startsWith(`'${SHEET_NAME}'!${lettreJournal}`)),
    `scored=${r.res.corps.scored} pas_rempli=${r.res.corps.pas_rempli} non_inscrit=${r.res.corps.non_inscrit} skipped=${r.res.corps.skipped}`);
  verifier(`${nom} : backfill → bonne valeur pour chaque membre`,
    Object.entries(attenduBackfill).every(([p, v]) => lu[p] === v) && lu.David === 'no', JSON.stringify(lu));

  // Destinataires du brief.
  const { client } = faireSheets(construireGrille(titres));
  globalThis.__epreuve = { sheets: client, sb: faireSupabase() };
  const dest = await getBriefRecipients();
  const eleves = dest.recipients.filter((x) => x.statut !== 'Coach').map((x) => `${x.name} <${x.email}> ${x.statut}`);
  verifier(`${nom} : destinataires du brief`,
    JSON.stringify(eleves) === JSON.stringify(['Alice MARTIN <alice@example.com> 🟢', 'Chloé PETIT <chloe@example.org> ⚪', 'Emma MOREAU <emma@example.com> 🔵', 'Farid BENALI <farid@example.com> ⚪'])
    && dest.stats.inactifs === 1 && dest.stats.no_valid_email === 2 && dest.stats.coaches === 3,
    `${eleves.length} élèves + ${dest.stats.coaches} coachs, inactifs=${dest.stats.inactifs}, sans mail=${dest.stats.no_valid_email}`);
  if (!destinatairesOrigine) destinatairesOrigine = JSON.stringify(dest);
  else verifier(`${nom} : destinataires IDENTIQUES à la disposition actuelle`, JSON.stringify(dest) === destinatairesOrigine);

  // Endpoint coach : plage ouverte → aucune colonne perdue, même au-delà de AL.
  const { default: coach } = await import(pathToFileURL(path.join(RACINE, 'api/coach/tableur-members.js')).href + `?${encodeURIComponent(nom)}`);
  const f = faireSheets(construireGrille(titres));
  globalThis.__epreuve = { sheets: f.client, sb: faireSupabase() };
  const res = faireRes();
  await coach({ method: 'GET', headers: {} }, res);
  const c = res.corps;
  const emma = (c.members || []).find((m) => m['Prénom'] === 'Emma');
  verifier(`${nom} : endpoint coach → ${c.total_columns} colonnes, ${c.total_members} membres, plage ouverte`,
    res.code === 200 && c.total_columns === 41 && c.total_members === 6 && f.journal.lectures[0] === RANGE_ONGLET
    && emma && emma['Bonus engagement'] === 'bonus engagement#5' && emma['Mail\nLearnyBox'] === 'emma@example.com' && emma.row === 8,
    `lecture ${f.journal.lectures[0]}, dernière colonne « ${c.columns[c.columns.length - 1].name} » (${c.columns[c.columns.length - 1].letter})`);
}

// ── 4. Garde-fou : titre absent ou en double → aucune écriture, webhook en 200 ──
console.log('\n— garde-fou');
const CASSES = {
  '« Journal » renommé (absent)': ORIGINE.map((t) => (t === 'Journal' ? 'Journal de trading' : t)),
  '« Journal » en double': ORIGINE.concat(['  JOURNAL ']),
  '« Mail LearnyBox » effacé': ORIGINE.map((t) => (normHeaderTitle(t) === 'mail learnybox' ? '' : t)),
};
for (const [nom, titres] of Object.entries(CASSES)) {
  const u = await appelerWebhook(construireGrille(titres), { user_id: 'u-emma' });
  const b = await appelerWebhook(construireGrille(titres), { backfill: true });
  verifier(`${nom} : webhook 200, ok:false, 0 écriture, erreur loggée`,
    u.res.code === 200 && u.res.corps.ok === false && u.journal.ecritures.length === 0 && u.erreurs.length === 1 && /AUCUNE écriture/.test(u.erreurs[0]));
  verifier(`${nom} : backfill 200, ok:false, 0 écriture`, b.res.code === 200 && b.res.corps.ok === false && b.journal.ecritures.length === 0 && b.erreurs.length === 1);
  if (nom === Object.keys(CASSES)[0]) console.log('     log : ' + u.erreurs[0]);
}
{
  const { client } = faireSheets(construireGrille(CASSES['« Mail LearnyBox » effacé']));
  globalThis.__epreuve = { sheets: client, sb: faireSupabase() };
  let msg = ''; const origErr = console.error; console.error = () => {};
  try { await getBriefRecipients(); } catch (e) { msg = e.message; } finally { console.error = origErr; }
  verifier('« Mail LearnyBox » effacé : destinataires → erreur levée, aucune liste renvoyée', /mail learnybox/.test(msg), msg);
}
// Un titre absent dont le brief n'a pas besoin ne le bloque pas (« journal » n'est requis que par le webhook).
{
  const { client } = faireSheets(construireGrille(CASSES['« Journal » renommé (absent)']));
  globalThis.__epreuve = { sheets: client, sb: faireSupabase() };
  const dest = await getBriefRecipients();
  verifier('« Journal » absent : le brief, qui ne lit pas cette colonne, garde ses destinataires', JSON.stringify(dest) === destinatairesOrigine);
}

console.log(`\n${echecs === 0 ? '✅ Épreuve réussie' : `❌ ${echecs} vérification(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);
