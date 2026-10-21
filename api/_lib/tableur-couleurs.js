// ========================================
// LA COULEUR D'UN MEMBRE DANS LE TABLEUR DE MANU, LUE SANS RIEN Y ÉCRIRE.
//
// Légende donnée par Nadir le 21/10/2026 :
//   rouge  = inactif, plus aucune relance ;
//   blanc  = en apprentissage, pas encore qualifié ;
//   bleu   = financé au moins une fois ;
//   vert   = premier payout, à faire devenir ambassadeur.
//
// ⚠️ « BLANC » EST LA CLÉ DU DIAGNOSTIC. La colonne Statut de juin portait du texte calculé
// (« 🟢 T360 », « 🟠 Nouveau », « 🔴 Inactif »), sans blanc ni bleu. Une légende où le blanc
// signifie quelque chose est une légende de REMPLISSAGE : une ligne qu'on n'a pas encore
// colorée est blanche. Or l'API `values` ne rend que le texte : la couleur de fond y est
// invisible, et un écran qui ne lit que le texte classe tout le monde à côté, sans erreur.
//
// On lit donc les deux :
//   - le FOND des cellules (`effectiveFormat.backgroundColor`, lecture seule) ;
//   - le TEXTE de Statut, quand il commence par une pastille.
// Le schéma est tranché sur l'onglet entier : dès que trois lignes au moins portent un fond
// coloré, c'est le fond qui fait foi pour tous ; sinon le texte. ⛔ Jamais un mélange ligne à
// ligne, qui ferait dépendre la couleur d'un membre de la présence d'un emoji chez lui.
//
// ⛔ AUCUNE ÉCRITURE. `spreadsheets.get` avec un masque `fields` ne lit que les formats.
// ========================================

import { SHEET_NAME, normHeaderTitle, FIRST_MEMBER_ROW, HEADER_ROW } from './parcours-colonnes.js';

export const COULEURS = ['rouge', 'blanc', 'bleu', 'vert'];

// Teinte, saturation, luminosité d'une couleur Sheets ({ red, green, blue } entre 0 et 1,
// une composante absente vaut 0 : c'est la convention de l'API, le noir n'a aucun champ).
export function hsl(c) {
  if (!c) return null;
  const r = c.red || 0; const g = c.green || 0; const b = c.blue || 0;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

// Classe un fond : null si blanc, gris ou absent (= pas de couleur posée), sinon une clé.
export function classerFond(c) {
  const x = hsl(c);
  if (!x) return null;
  if (x.l > 0.94 || x.s < 0.18) return null;
  if (x.h < 22 || x.h >= 330) return 'rouge';
  if (x.h >= 80 && x.h < 170) return 'vert';
  if (x.h >= 170 && x.h < 265) return 'bleu';
  return 'autre';
}

// Le texte de Statut, s'il commence par une pastille.
export function classerTexte(v) {
  const t = String(v ?? '').trim();
  if (/^(🔴|🟥)/u.test(t)) return 'rouge';
  if (/^(🟢|🟩|💚)/u.test(t)) return 'vert';
  if (/^(🔵|🟦|💙)/u.test(t)) return 'bleu';
  if (/^(⚪|⬜|🤍)/u.test(t)) return 'blanc';
  return t ? 'autre' : null;
}

const hex = (c) => '#' + [c.red, c.green, c.blue].map((v) => Math.round((v || 0) * 255).toString(16).padStart(2, '0')).join('');

/**
 * Fond retenu pour chaque ligne membre : celui de la cellule Statut, sinon celui de Prénom
 * ou Nom, sinon le fond coloré le plus fréquent de la ligne.
 * @returns {Promise<Map<number, { cle: string|null, hex: string|null }>>} par numéro de ligne
 */
export async function fondsDesLignes(sheets, spreadsheetId) {
  const r = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`'${SHEET_NAME}'`],
    includeGridData: true,
    fields: 'sheets(data(startRow,rowData(values(effectiveFormat(backgroundColor),formattedValue))))',
  });
  const data = r.data?.sheets?.[0]?.data?.[0];
  const lignes = data?.rowData || [];
  const depart = data?.startRow || 0;
  const titres = (lignes[HEADER_ROW - 1 - depart]?.values || []).map((v) => normHeaderTitle(v?.formattedValue));
  const prio = ['statut', 'prenom', 'nom'].map((t) => titres.indexOf(t)).filter((i) => i >= 0);
  const out = new Map();
  lignes.forEach((ligne, i) => {
    const rowNum = depart + i + 1;
    if (rowNum < FIRST_MEMBER_ROW) return;
    const cellules = ligne?.values || [];
    const fond = (j) => cellules[j]?.effectiveFormat?.backgroundColor || null;
    let retenu = null;
    for (const j of prio) { if (classerFond(fond(j))) { retenu = fond(j); break; } }
    if (!retenu) {
      const compte = new Map();
      cellules.forEach((_, j) => { const f = fond(j); const k = classerFond(f); if (!k) return; const h = hex(f); compte.set(h, { n: (compte.get(h)?.n || 0) + 1, f }); });
      const top = [...compte.values()].sort((a, b) => b.n - a.n)[0];
      if (top && top.n >= 2) retenu = top.f;
    }
    out.set(rowNum, { cle: classerFond(retenu), hex: retenu ? hex(retenu) : null });
  });
  return out;
}

/**
 * Pose `couleur` ('rouge'|'blanc'|'bleu'|'vert'|'autre') et `couleur_source` ('fond'|'texte')
 * sur chaque membre, selon le schéma tranché sur l'onglet entier.
 * @param {Array<{row:number}>} membres
 * @param {Map<number,{cle:string|null,hex:string|null}>} fonds
 * @param {string|null} colStatut nom exact de la colonne Statut dans `membres`
 */
export function poserCouleurs(membres, fonds, colStatut) {
  const colores = membres.filter((m) => fonds.get(m.row)?.cle).length;
  const schema = colores >= 3 ? 'fond' : 'texte';
  for (const m of membres) {
    const f = fonds.get(m.row) || { cle: null, hex: null };
    m.couleur = schema === 'fond' ? (f.cle || 'blanc') : (classerTexte(colStatut ? m[colStatut] : '') || 'blanc');
    m.couleur_source = schema;
    m.couleur_hex = f.hex;
  }
  return schema;
}
