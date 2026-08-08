// ========================================
// GOOGLE SHEETS CLIENT — lecture seule du tableur Manu
// ========================================
// Initialise un client Google Sheets API en utilisant les credentials
// du service account `journal-tableur-reader` stockées dans l'env var
// GOOGLE_SHEETS_SA_KEY (JSON complet).
//
// Le SA est ajouté au partage du Sheet en rôle "Lecteur" —
// aucune écriture possible, même hypothétiquement bugguée.
// Le code Apps Script de Manu et la structure du tableur ne sont
// jamais touchés : on lit comme un onglet Chrome le ferait.
// ========================================

import { google } from 'googleapis';

const SA_KEY_ENV = 'GOOGLE_SHEETS_SA_KEY';
const SHEET_ID_ENV = 'SHEETS_TABLEUR_ID';

let _sheetsClient = null;

export function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  const rawKey = process.env[SA_KEY_ENV];
  if (!rawKey) {
    throw new Error(`Env var ${SA_KEY_ENV} manquante (config Vercel).`);
  }

  let credentials;
  try {
    credentials = JSON.parse(rawKey);
  } catch (e) {
    throw new Error(`${SA_KEY_ENV} : JSON invalide (${e.message}).`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    // Scope strictement read-only — sécurité en profondeur.
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

export function getSheetId() {
  const id = process.env[SHEET_ID_ENV];
  if (!id) {
    throw new Error(`Env var ${SHEET_ID_ENV} manquante (config Vercel).`);
  }
  return id;
}
