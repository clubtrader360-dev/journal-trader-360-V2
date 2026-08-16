// ========================================
// #20 — Destinataires du brief matinal depuis le TABLEUR Manu (source de vérité).
// Onglet "👥 Parcours Membre", lignes membres A4:U77.
//   - col D (statut) : exclut 🔴 Inactif ; garde le reste (🟢 T360, 🟠 À surveiller,
//                      🟠 Peu impliqués, Moyen…).
//   - email : col T (Mail LB) prioritaire, fallback col U (Mails perso, multi-valeurs).
//   - dedup (email lowercase) + validation regex.
// SA Google en scope 'spreadsheets' déjà en place (cf api/coach/_lib/sheets-client.js).
// ========================================

import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';

const SHEET_NAME = '👥 Parcours Membre';
const READ_RANGE = `'${SHEET_NAME}'!A4:U77`;
const COL_PRENOM = 1;    // B
const COL_NOM = 2;       // C
const COL_STATUT = 3;    // D
const COL_MAIL_LB = 19;  // T (prioritaire)
const COL_MAIL_PERSO = 20; // U (fallback, multi-valeurs)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const stats = { rows: values.length, inactifs: 0, no_valid_email: 0, duplicates: 0, kept: 0 };
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

  return { recipients, stats };
}
