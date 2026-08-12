// ========================================
// GET /api/user/tableur-my-info
// Header : Authorization: Bearer <supabase JWT>
//
// Renvoie à l'ÉLÈVE authentifié ses propres infos formation depuis le tableur Manu
// (lecture seule). On matche sa ligne par email (col Mail LB) puis par nom en fallback,
// et on ne renvoie qu'un sous-ensemble RGPD-safe (pas les 37 colonnes coach).
//
// Mapping PAR NOM d'header (pas par lettre) : en #84 on a prouvé que les lettres du Sheet
// ne correspondent pas au sémantique supposé (col A vide dans les headers → décalage +1).
// ========================================

import { requireUser, getServiceClient, httpError } from '../tradovate/_lib/auth.js';
import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';

const SHEET_NAME = '👥 Parcours Membre';
const RANGE_MAIN = `'${SHEET_NAME}'!A1:AL77`;
const HEADER_ROW_IDX = 2;        // ligne 3
const FIRST_MEMBER_ROW_IDX = 3;  // ligne 4

let _cache = null;      // { columns, rows, updatedAt } — brut du sheet, partagé warm-Lambda
let _cacheAt = 0;
const CACHE_TTL_MS = 60_000;

function columnLetter(idx) {
  let s = '', n = idx;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}
function norm(s) { return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

async function loadSheet() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;

  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId, range: RANGE_MAIN,
    valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = resp.data.values || [];
  if (!values.length) throw httpError(502, 'Tableur illisible.');

  // Réalignement identique à l'endpoint coach : header row plus court d'1 cellule (col A vide).
  const headers = values[HEADER_ROW_IDX] || [];
  const dataRowLen = values[FIRST_MEMBER_ROW_IDX]?.length || 0;
  let aligned = headers;
  if (dataRowLen > headers.length) aligned = new Array(dataRowLen - headers.length).fill('').concat(headers);
  const firstDataCell = values[FIRST_MEMBER_ROW_IDX]?.[0];
  if ((aligned[0] == null || String(aligned[0]).trim() === '') &&
      firstDataCell != null && String(firstDataCell).trim() !== '' && !isNaN(Number(firstDataCell))) {
    aligned[0] = 'ID';
  }
  const columns = aligned.map((name, idx) => ({ letter: columnLetter(idx), idx, name: String(name || '').trim() }))
    .filter(c => c.name);

  const rows = values.slice(FIRST_MEMBER_ROW_IDX).filter(r =>
    (r || []).some(c => c != null && String(c).trim() !== ''));

  _cache = { columns, rows, updatedAt: (values[1] && values[1][0]) || null };
  _cacheAt = now;
  return _cache;
}

// Trouve la 1re colonne dont le nom contient l'un des mots-clés.
function colBy(columns, ...keywords) {
  return columns.find(c => { const n = norm(c.name); return keywords.some(k => n.includes(k)); }) || null;
}
function cell(row, col) { return col ? String(row[col.idx] ?? '').trim() : ''; }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const sb = getServiceClient();

    // Identité de l'élève (email + nom) pour le matching.
    const { data: appUser, error: uErr } = await sb
      .from('users').select('email, name').eq('uuid', user_id).single();
    if (uErr || !appUser) throw httpError(404, 'Profil introuvable.');
    const myEmail = norm(appUser.email);
    const myName = norm(appUser.name);

    const { columns, rows, updatedAt } = await loadSheet();

    const mailCol = colBy(columns, 'mail', 'email');
    const prenomCol = columns.find(c => { const n = norm(c.name); return n === 'prenom' || n.startsWith('prenom'); });
    const nomCol = columns.find(c => norm(c.name) === 'nom');

    // 1) Match prioritaire par email. 2) Fallback par "prénom nom" concaténé.
    let mine = null;
    if (mailCol && myEmail) mine = rows.find(r => norm(cell(r, mailCol)) === myEmail) || null;
    if (!mine && myName && (prenomCol || nomCol)) {
      mine = rows.find(r => norm((cell(r, prenomCol) + ' ' + cell(r, nomCol)).trim()) === myName) || null;
    }
    if (!mine) {
      return res.status(404).json({ error: 'Ton profil formation n\'est pas encore renseigné, contacte ton coach.' });
    }

    // Sous-ensemble RGPD-safe, mappé PAR NOM.
    const my_info = {
      niveau:               cell(mine, colBy(columns, 'niveau')) || null,
      progression_pct:      cell(mine, colBy(columns, 'progress')) || null,
      score_20:             cell(mine, colBy(columns, 'score')) || null,
      anciennete:           cell(mine, colBy(columns, 'anciennet')) || null,
      coach:                cell(mine, colBy(columns, 'coach')) || null,
      derniere_activite_lb: cell(mine, colBy(columns, 'activite lb', 'derniere activite', 'activité')) || null,
      methode_t360_pct:     cell(mine, colBy(columns, 'methode', 'méthode')) || null,
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, updated_at: updatedAt, my_info });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[TABLEUR-MY-INFO] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
