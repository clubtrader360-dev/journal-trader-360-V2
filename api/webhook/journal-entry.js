// ========================================
// POST /api/webhook/journal-entry
// Supabase Database Webhook sur public.journal_entries (INSERT/UPDATE/DELETE).
// Header d'auth : X-Webhook-Secret == process.env.SUPABASE_WEBHOOK_SECRET (timingSafeEqual).
//
// À chaque changement de journal d'un élève : recalcule son T360 Score, vérifie s'il a rempli
// son journal dans les 3 derniers jours (Paris), et écrit dans la col X du tableur Manu :
//   - "<score>" (ex "72.4")    → élève inscrit + journal rempli les 3 derniers jours
//   - "Pas rempli"             → élève inscrit + journal PAS rempli les 3 derniers jours
//   - "Non inscrit au journal" → email tableur absent de public.users
//                                (via ?action=backfill-full uniquement — le webhook unitaire
//                                 est déclenché par un user_id qui existe forcément)
// N'écrit QUE dans la col X. Ne throw jamais (retourne 500 { ok:false } en cas d'erreur).
//
// Deux modes :
//   - POST (webhook Supabase, défaut)        → traite l'élève du payload, écrit sa seule cellule X.
//   - POST ?action=backfill-full             → re-scanne TOUT le tableur, recalcule chaque ligne,
//                                              écrit toutes les cellules X en 1 batchUpdate.
// ========================================

import crypto from 'crypto';
import { getServiceClient, readJson } from '../tradovate/_lib/auth.js';
import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';
import { computeT360Score } from '../_lib/t360-score.js';

const SHEET_NAME = '👥 Parcours Membre';
const READ_RANGE = `'${SHEET_NAME}'!A4:U77`; // lignes MEMBRES (4→77), jusqu'à col U (mails perso)
const COL_PRENOM = 1;   // B
const COL_NOM = 2;      // C
const COL_MAIL_LB = 19; // T (clé de matching principale)
const COL_MAIL_PERSO = 20; // U
const FIRST_MEMBER_ROW = 4;
const ACTIVE_WINDOW_DAYS = 3;

// Le backfill peut prendre 30-60s (compute par élève). Vercel Hobby = 10s par défaut → on relève.
export const config = { maxDuration: 60 };

// Comparaison secret constante en temps (anti timing-attack).
function secretOk(provided, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parisTodayStr() {
  // 'sv-SE' → 'YYYY-MM-DD'
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}
function minusDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Emails candidats d'une ligne tableur : col T (LB, prioritaire) puis col U (perso, multi-valeurs).
function rowEmails(row) {
  const out = [];
  const tv = String(row[COL_MAIL_LB] || '').trim().toLowerCase();
  if (tv) out.push(tv);
  const uv = String(row[COL_MAIL_PERSO] || '').trim().toLowerCase();
  if (uv) uv.split(/[,;\s]+/).forEach((e) => { if (e) out.push(e); });
  return out;
}

// Valeur col X pour un élève EXISTANT (uuid connu) : "<score>" si journal rempli sur [today-3j, today],
// sinon "Pas rempli". Partagé entre le webhook unitaire et le backfill.
async function computeUserColX(sb, uuid) {
  const today = parisTodayStr();
  const cutoff = minusDaysStr(today, ACTIVE_WINDOW_DAYS);
  const [{ data: trades }, { data: accounts }] = await Promise.all([
    sb.from('trades').select('pnl, account_id, trade_date').eq('user_id', uuid).limit(10000),
    sb.from('accounts').select('id, active').eq('user_id', uuid),
  ]);
  const { globalScore } = computeT360Score(trades || [], accounts || []);

  // Journal rempli dans les 3 derniers jours (Paris), en excluant les dates futures (saisies erronées).
  const { count: journalCount, error: jErr } = await sb
    .from('journal_entries')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uuid)
    .gte('entry_date', cutoff)
    .lte('entry_date', today);
  if (jErr) throw jErr;

  return (journalCount && journalCount > 0) ? globalScore.toFixed(1) : 'Pas rempli';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method not allowed' });
    }

    // 1. Auth webhook.
    const provided = req.headers['x-webhook-secret'];
    if (!secretOk(provided, process.env.SUPABASE_WEBHOOK_SECRET)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    // 1bis. Mode backfill complet (re-scan tout le tableur).
    if ((req.query && req.query.action) === 'backfill-full') {
      return await handleBackfillFull(res);
    }

    // 2. Payload Supabase.
    const body = await readJson(req);
    const type = body?.type || 'UNKNOWN';
    const record = body?.record || null;
    const oldRecord = body?.old_record || null;
    const user_id = record?.user_id || oldRecord?.user_id || null;
    if (!user_id) {
      return res.status(400).json({ ok: false, error: 'payload invalide : user_id manquant' });
    }

    const sb = getServiceClient();

    // 3. Email de l'élève.
    const { data: appUser, error: uErr } = await sb
      .from('users').select('email').eq('uuid', user_id).single();
    if (uErr || !appUser || !appUser.email) {
      console.warn('[WEBHOOK-COL-X] user introuvable ou sans email:', user_id);
      return res.status(404).json({ ok: false, error: 'user introuvable' });
    }
    const email = String(appUser.email).trim().toLowerCase();

    // 4-7. Valeur col X : "<score>" si journal rempli <3j (dates futures exclues), sinon "Pas rempli".
    const valueToWrite = await computeUserColX(sb, user_id);

    // 8. Matching dans le tableur (col T ou U == email).
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();
    const readResp = await sheets.spreadsheets.values.get({
      spreadsheetId, range: READ_RANGE,
      valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
    });
    const values = readResp.data.values || [];

    let matchIdx = -1, matchedMulti = 0;
    for (let i = 0; i < values.length; i++) {
      const row = values[i] || [];
      const tv = String(row[COL_MAIL_LB] || '').trim().toLowerCase();
      const uv = String(row[COL_MAIL_PERSO] || '').trim().toLowerCase();
      const hit = (tv && tv === email) || (uv && (uv === email || uv.split(/[,;\s]+/).includes(email)));
      if (hit) { matchedMulti++; if (matchIdx === -1) matchIdx = i; }
    }
    if (matchIdx === -1) {
      console.warn(`[WEBHOOK-COL-X] aucun match tableur pour email=${email} user=${user_id}`);
      return res.status(200).json({ ok: true, matched: false, email, value: valueToWrite });
    }
    if (matchedMulti > 1) {
      console.warn(`[WEBHOOK-COL-X] ${matchedMulti} matches pour email=${email} → prend le premier`);
    }

    const rowNum = FIRST_MEMBER_ROW + matchIdx;
    const matchedRow = values[matchIdx] || [];
    const prenom = matchedRow[COL_PRENOM] || '';
    const nom = matchedRow[COL_NOM] || '';

    // 9. Écriture col X (UNIQUEMENT).
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET_NAME}'!X${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[valueToWrite]] },
    });

    // 10. Log détaillé.
    console.log(`[WEBHOOK-COL-X] user=${user_id} email=${email} (${prenom} ${nom}) action=${type} row=${rowNum} value=${valueToWrite}`);

    // 11.
    return res.status(200).json({ ok: true, matched: true, row: rowNum, value: valueToWrite, email });
  } catch (err) {
    console.error('[WEBHOOK-COL-X] error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'erreur' });
  }
}

// ========================================
// ?action=backfill-full — re-scanne TOUT le tableur, recalcule chaque ligne, 1 seul batchUpdate.
// ========================================
async function handleBackfillFull(res) {
  const t0 = Date.now();
  const sb = getServiceClient();

  // Map email(lowercased) → uuid depuis public.users (1 requête ; table < 1000 lignes).
  const { data: users, error: uErr } = await sb.from('users').select('uuid, email');
  if (uErr) throw uErr;
  const emailToUuid = new Map();
  for (const u of users || []) {
    if (u.email) emailToUuid.set(String(u.email).trim().toLowerCase(), u.uuid);
  }

  // Lecture du tableur (1 requête).
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const readResp = await sheets.spreadsheets.values.get({
    spreadsheetId, range: READ_RANGE,
    valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = readResp.data.values || [];

  let scored = 0, pas_rempli = 0, non_inscrit = 0, skipped = 0;
  const updates = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const rowNum = FIRST_MEMBER_ROW + i;
    const emails = rowEmails(row);
    if (emails.length === 0) { skipped++; continue; } // ligne sans email → ne rien écrire

    // Premier email de la ligne qui matche un user Supabase (T prioritaire, cf rowEmails).
    let uuid = null;
    for (const e of emails) { if (emailToUuid.has(e)) { uuid = emailToUuid.get(e); break; } }

    let value;
    if (uuid) {
      value = await computeUserColX(sb, uuid);
      if (value === 'Pas rempli') pas_rempli++; else scored++;
    } else {
      value = 'Non inscrit au journal';
      non_inscrit++;
    }
    updates.push({ range: `'${SHEET_NAME}'!X${rowNum}`, values: [[value]] });
  }

  // 1 SEUL appel d'écriture pour toutes les cellules X (économie quota Google Sheets).
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });
  }

  const duration_ms = Date.now() - t0;
  console.log(`[WEBHOOK-COL-X][backfill-full] rows=${values.length} scored=${scored} pas_rempli=${pas_rempli} non_inscrit=${non_inscrit} skipped=${skipped} written=${updates.length} in ${duration_ms}ms`);

  return res.status(200).json({
    ok: true,
    total_rows: values.length,
    scored,
    pas_rempli,
    non_inscrit,
    skipped,
    written: updates.length,
    duration_ms,
  });
}
