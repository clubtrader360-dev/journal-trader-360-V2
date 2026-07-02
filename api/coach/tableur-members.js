// ========================================
// GET /api/coach/tableur-members
// Header : Authorization: Bearer <supabase JWT>
// Auth   : role ∈ ('coach','admin'), status ∈ ('active','approved')
//
// Lit l'onglet "👥 Parcours Membre" du tableur Manu (Google Sheets API,
// via service account read-only). Retourne les 74 membres avec toutes
// leurs colonnes (~38, A→AL), plus les métadonnées utiles.
//
// Format de sortie :
//   {
//     sheet_id: "1ozrk-...",
//     updated_at: "02/07/2026 15:33 (...)",  // cellule A2 du Sheet
//     total_columns: 38,
//     total_members: 74,
//     columns: [ { letter: "A", name: "ID" }, { letter: "B", name: "Prénom" }, ... ],
//     members: [ { row: 4, ID: "1", "Prénom": "Patrick", "Nom": "SAN CARLOS", ... }, ... ]
//   }
//
// Cache : in-memory (Lambda warm) + CDN Vercel (s-maxage=60, SWR=300).
// ========================================

import { requireCoach } from '../vimeo/_lib/coach-auth.js';
import { getSheetsClient, getSheetId } from './_lib/sheets-client.js';

// Range : onglet "👥 Parcours Membre", cellules A1 → AL77 (38 colonnes × 77 lignes).
// Ligne 1 = titre "PARCOURS MEMBRE 360". Ligne 2 = "Mise à jour : ..."
// Ligne 3 = headers de colonnes. Lignes 4→77 = les 74 membres.
const SHEET_NAME = '👥 Parcours Membre';
const RANGE_MAIN = `'${SHEET_NAME}'!A1:AL77`;
const RANGE_UPDATED = `'${SHEET_NAME}'!A2`;
const HEADER_ROW_IDX = 2;        // ligne 3 (0-indexed = 2)
const FIRST_MEMBER_ROW_IDX = 3;  // ligne 4 (0-indexed = 3)
const FIRST_MEMBER_ROW = 4;

// Cache Lambda in-memory. Survit tant que la Lambda reste warm.
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // 1. Auth : coach ou admin seulement.
    await requireCoach(req);

    // 2. Cache in-memory.
    const now = Date.now();
    if (_cache && (now - _cacheAt) < CACHE_TTL_MS) {
      res.setHeader('X-Cache', 'HIT-lambda');
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(_cache);
    }

    // 3. Pull du Sheet en 1 batch (main range + cellule updated_at).
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [RANGE_MAIN, RANGE_UPDATED],
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const [mainRange, updatedRange] = batch.data.valueRanges || [];
    const values = mainRange?.values || [];
    const updatedAt = updatedRange?.values?.[0]?.[0] || null;

    if (!values.length) {
      throw new Error(`Aucune donnée retournée pour ${RANGE_MAIN}`);
    }

    const headers = values[HEADER_ROW_IDX] || [];
    const memberRows = values.slice(FIRST_MEMBER_ROW_IDX);

    // 4. Colonnes : lettre (A, B, ..., Z, AA, AB, ...) + nom normalisé.
    const columns = headers.map((rawName, idx) => ({
      letter: columnLetter(idx),
      name: (rawName || '').toString().trim(),
    })).filter(c => c.name); // on ignore les colonnes sans header

    // 5. Membres : object { row, ...cellsByHeaderName }.
    //    On ignore les lignes complètement vides (au cas où le range dépasse
    //    les vraies données).
    const members = memberRows
      .map((row, rowIdx) => {
        const rowNum = FIRST_MEMBER_ROW + rowIdx;
        const rowArr = row || [];
        const hasContent = rowArr.some(cell =>
          cell !== null && cell !== undefined && String(cell).trim() !== ''
        );
        if (!hasContent) return null;

        const member = { row: rowNum };
        columns.forEach((col, idx) => {
          // Utilise le nom du header comme clé. Si Manu renomme, le frontend
          // s'adaptera via le tableau `columns` renvoyé aussi.
          member[col.name] = rowArr[idx] ?? '';
        });
        return member;
      })
      .filter(Boolean);

    // 6. Construction du payload final.
    const result = {
      sheet_id: spreadsheetId,
      sheet_name: SHEET_NAME,
      updated_at: updatedAt,
      pulled_at: new Date().toISOString(),
      total_columns: columns.length,
      total_members: members.length,
      columns,
      members,
    };

    _cache = result;
    _cacheAt = now;

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(result);

  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[TABLEUR-MEMBERS] error:', err);
    return res.status(status).json({
      error: err.message || 'erreur',
      code: err.code,
    });
  }
}

// A, B, ..., Z, AA, AB, ..., AZ, BA, ...
function columnLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
