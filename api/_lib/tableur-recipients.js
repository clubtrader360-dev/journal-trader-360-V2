// ========================================
// #20 — Destinataires du brief matinal depuis le TABLEUR Manu (source de vérité).
// Onglet "👥 Parcours Membre", lignes membres à partir de la 4 (range ouvert, cf READ_RANGE).
//   - col D (statut) : exclut 🔴 Inactif ; garde le reste (🟢 T360, 🟠 À surveiller,
//                      🟠 Peu impliqués, Moyen…).
//   - email : col T (Mail LB) prioritaire, fallback col U (Mails perso, multi-valeurs).
//   - dedup (email lowercase) + validation regex.
// SA Google en scope 'spreadsheets' déjà en place (cf api/coach/_lib/sheets-client.js).
// ========================================

import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';

const SHEET_NAME = '👥 Parcours Membre';
// Range OUVERT en fin (pas de borne de ligne) : Google renvoie jusqu'à la dernière ligne
// renseignée de l'onglet. La borne figée à 77 rendait invisibles les membres ajoutés
// au-delà (4 personnes début septembre 2026, dont 2 élèves actifs). Sans risque : les
// lignes sans email valide sont déjà écartées par pickEmail().
const READ_RANGE = `'${SHEET_NAME}'!A4:U`;
const COL_PRENOM = 1;    // B
const COL_NOM = 2;       // C
const COL_STATUT = 3;    // D
const COL_MAIL_LB = 19;  // T (prioritaire)
const COL_MAIL_PERSO = 20; // U (fallback, multi-valeurs)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Coachs : ajoutés EN DUR, volontairement hors tableur ----
// Décision produit : l'onglet "👥 Parcours Membre" de Manu est la source de vérité des
// ÉLÈVES et sert de base à ses décomptes (suivi, relances, statistiques d'engagement).
// Y insérer les coachs ferait passer ses totaux à 77 dont 3 non-élèves et fausserait
// toutes ses lignes. Les coachs sont donc concaténés ici, après lecture du tableur.
// Conséquence assumée : cette liste se maintient dans le code, pas dans le tableur.
const COACH_RECIPIENTS = [
  { email: 'clubtrader360@gmail.com',   prenom: 'Emmanuel', nom: 'Trader 360', statut: 'Coach', name: 'Coach Trader 360' },
  { email: 'nkasmi59@gmail.com',        prenom: 'Nadir',    nom: 'Kasmi',      statut: 'Coach', name: 'Nadir Kasmi' },
  { email: 'emmanuel.galiano@gmail.com', prenom: 'Emmanuel', nom: 'Galiano',   statut: 'Coach', name: 'Emmanuel Galiano' },
];

// Email retenu pour une ligne : T valide en priorité, sinon 1re valeur valide de U.
function pickEmail(row) {
  const t = String(row[COL_MAIL_LB] || '').trim().toLowerCase();
  if (EMAIL_RE.test(t)) return t;
  const u = String(row[COL_MAIL_PERSO] || '').trim().toLowerCase();
  for (const e of u.split(/[,;\s]+/)) { if (EMAIL_RE.test(e)) return e; }
  return null;
}

// Retourne { recipients: [{ email, prenom, nom, statut, name }], stats }.
export async function getBriefRecipients() {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId, range: READ_RANGE,
    valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = resp.data.values || [];

  const stats = { rows: values.length, inactifs: 0, no_valid_email: 0, duplicates: 0, kept: 0, coaches: 0, total: 0 };
  const seen = new Set();
  const recipients = [];

  for (const row of values) {
    const statut = String(row[COL_STATUT] || '').trim();
    if (/inactif/i.test(statut)) { stats.inactifs++; continue; } // exclut 🔴 Inactif

    const email = pickEmail(row);
    if (!email) { stats.no_valid_email++; continue; }

    const key = email.toLowerCase();
    if (seen.has(key)) { stats.duplicates++; continue; }
    seen.add(key);

    const prenom = String(row[COL_PRENOM] || '').trim();
    const nom = String(row[COL_NOM] || '').trim();
    recipients.push({ email, prenom, nom, statut, name: `${prenom} ${nom}`.trim() || prenom || null });
    stats.kept++;
  }

  // Coachs concaténés APRÈS le tableur, donc jamais soumis au filtre de statut (col D) :
  // ils ne viennent pas du tableur et n'ont pas de statut à filtrer.
  // Dédup case-insensitive contre `seen`, qui contient déjà les emails élèves : un coach
  // présent par ailleurs dans le tableur reste servi UNE seule fois (sa ligne tableur
  // l'emporte, avec son statut réel). Compté à part pour ne pas polluer stats.duplicates,
  // qui mesure les doublons internes au tableur.
  for (const coach of COACH_RECIPIENTS) {
    const key = coach.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ ...coach, email: key });
    stats.coaches++;
  }

  stats.total = recipients.length; // = kept + coaches
  return { recipients, stats };
}
