// ========================================
// Colonnes de l'onglet "👥 Parcours Membre" — retrouvées par TITRE, jamais par position.
//
// Manu peut déplacer n'importe quelle colonne du tableur. Tout code qui lit ou écrit cet
// onglet passe donc par ce module : on lit la ligne 3 (titres), on normalise chaque titre,
// et on en déduit l'index de la colonne. Plus aucun `COL_MAIL_LB = 19` ni `!X${row}`.
//
// ⚠️ La normalisation doit rester IDENTIQUE à `_normHeaderTitle_` du script Apps Script
// (repo trader360-apps-script, src/Code.js) : minuscules, sans accents, sans emoji, blancs
// et retours ligne compressés. Les deux codes lisent la même ligne 3 ; s'ils normalisent
// différemment, l'un trouvera une colonne que l'autre déclare absente.
// `outils/eprouver-colonnes-parcours.mjs` compare les deux quand le repo voisin est là.
//
// Garde-fou : un titre demandé absent ou porté par deux colonnes → `ok: false`. L'appelant
// n'écrit alors RIEN. Il n'y a pas de repli sur les anciennes positions.
// ========================================

export const SHEET_NAME = '👥 Parcours Membre';
export const HEADER_ROW = 3;        // ligne des titres
export const FIRST_MEMBER_ROW = 4;  // première ligne membre
// Plage OUVERTE : le nom d'onglet seul désigne toutes ses cellules. Ni borne de ligne (les
// membres ajoutés en bas restent visibles), ni borne de colonne (une colonne ajoutée ou
// déplacée à droite aussi).
export const RANGE_ONGLET = `'${SHEET_NAME}'`;

// Titres normalisés des colonnes utilisées par ce repo.
export const TITRES = {
  PRENOM: 'prenom',
  NOM: 'nom',
  STATUT: 'statut',
  MAIL_LB: 'mail learnybox',
  MAIL_PERSO: '2eme mail',
  JOURNAL: 'journal',
};

// Copie conforme de `_normHeaderTitle_` (Apps Script). Ne pas « améliorer » d'un seul côté.
export function normHeaderTitle(raw) {
  return String(raw === null || raw === undefined ? '' : raw)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Lettre(s) A1 d'un index de colonne 0-based (0 → A, 23 → X, 26 → AA).
export function columnLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// Ligne de titres → index 0-based de chaque titre demandé.
// Retourne { ok, cols: { <titre>: idx }, missing: [titre], duplicates: [{ titre, letters }], error }.
// `cols` ne contient que les titres trouvés UNE fois : un titre absent ou en double n'y
// figure pas, on ne peut donc pas s'en servir par mégarde.
export function resolveColumns(headerRow, wanted) {
  const positions = new Map();
  (headerRow || []).forEach((raw, idx) => {
    const t = normHeaderTitle(raw);
    if (!t) return;
    if (!positions.has(t)) positions.set(t, []);
    positions.get(t).push(idx);
  });

  const cols = {}, missing = [], duplicates = [];
  for (const titre of wanted) {
    const hits = positions.get(titre) || [];
    if (hits.length === 1) cols[titre] = hits[0];
    else if (hits.length === 0) missing.push(titre);
    else duplicates.push({ titre, letters: hits.map(columnLetter) });
  }

  const pb = [];
  if (missing.length) pb.push(`titre(s) absent(s) : ${missing.map((t) => `« ${t} »`).join(', ')}`);
  if (duplicates.length) pb.push(`titre(s) en double : ${duplicates.map((d) => `« ${d.titre} » en ${d.letters.join(' et ')}`).join(', ')}`);
  const ok = pb.length === 0;
  return {
    ok, cols, missing, duplicates,
    error: ok ? null : `Colonnes « ${SHEET_NAME} » (ligne ${HEADER_ROW}) : ${pb.join(' ; ')}. Aucun repli sur les anciennes positions.`,
  };
}

// Découpe les valeurs de l'onglet ENTIER (lues depuis A1) : ligne de titres + lignes membres.
// Le numéro de ligne d'un membre reste FIRST_MEMBER_ROW + index dans `rows`.
export function splitParcours(values) {
  const all = values || [];
  return { header: all[HEADER_ROW - 1] || [], rows: all.slice(FIRST_MEMBER_ROW - 1) };
}

// Lit l'onglet et résout les titres demandés, en une requête.
// Retourne { ok, cols, error, missing, duplicates, header, rows }.
export async function readParcours(sheets, spreadsheetId, wanted) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId, range: RANGE_ONGLET,
    valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const { header, rows } = splitParcours(resp.data.values);
  return { ...resolveColumns(header, wanted), header, rows };
}

// Adresse A1 d'une cellule membre : (index de colonne 0-based, n° de ligne) → 'Onglet'!X12.
export function cellA1(colIdx, rowNum) {
  return `'${SHEET_NAME}'!${columnLetter(colIdx)}${rowNum}`;
}
