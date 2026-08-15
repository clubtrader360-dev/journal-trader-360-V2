// ========================================
// POST /api/webhook/journal-entry
// Supabase Database Webhook sur public.journal_entries (INSERT/UPDATE/DELETE).
// Header d'auth : X-Webhook-Secret == process.env.SUPABASE_WEBHOOK_SECRET (timingSafeEqual).
//
// À chaque changement de journal d'un élève : recalcule son T360 Score, vérifie s'il a rempli
// son journal dans les 3 derniers jours (Paris), et écrit dans la col X du tableur Manu :
//   - "Non"                     si aucune entrée journal < 3 jours
//   - "<score>" (ex "72.4")     sinon
// N'écrit QUE dans la col X. Ne throw jamais (retourne 500 { ok:false } en cas d'erreur).
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

    // 4-6. T360 Score (all-time). Note limite Supabase : on remonte large pour un seul user.
    const [{ data: trades }, { data: accounts }] = await Promise.all([
      sb.from('trades').select('pnl, account_id, trade_date').eq('user_id', user_id).limit(10000),
      sb.from('accounts').select('id, active').eq('user_id', user_id),
    ]);
    const { globalScore } = computeT360Score(trades || [], accounts || []);

    // 7. Journal rempli dans les 3 derniers jours (Paris) ?
    const cutoff = minusDaysStr(parisTodayStr(), ACTIVE_WINDOW_DAYS);
    const { count: journalCount, error: jErr } = await sb
      .from('journal_entries')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('entry_date', cutoff);
    if (jErr) throw jErr;

    const valueToWrite = (journalCount && journalCount > 0) ? globalScore.toFixed(1) : 'Non';

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
