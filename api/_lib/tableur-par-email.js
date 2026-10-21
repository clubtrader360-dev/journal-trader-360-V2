// ========================================
// LE TABLEUR DE MANU, INDEXÉ PAR EMAIL, POUR ACADÉMIE · MEMBRES.
//
// Demande de Nadir du 21/10/2026 : « Académie · Membres » doit reprendre le tableur :
//   - le statut (la couleur de la légende), pas l'état du compte, qui disait « Actif »
//     à des gens absents depuis 222 jours ;
//   - les membres absents du tableur n'y apparaissent plus ;
//   - la fiche reprend toutes les colonnes du tableur.
//
// ⛔ LECTURE SEULE, et « ne touche vraiment pas au tableur » : aucune écriture ici.
// ⚠️ Correspondance par les DEUX colonnes d'adresse (« Mail LearnyBox » et « 2ème mail »),
// insensible à la casse : un membre dont le compte du journal porte son adresse perso est
// retrouvé quand même. Titres retrouvés par nom normalisé (parcours-colonnes.js), jamais
// par position : Manu déplace ses colonnes.
// ========================================

import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';
import { RANGE_ONGLET, splitParcours, normHeaderTitle, FIRST_MEMBER_ROW, TITRES } from './parcours-colonnes.js';
import { fondsDesLignes, poserCouleurs } from './tableur-couleurs.js';

let _cache = null;
let _cacheAt = 0;
const TTL = 60_000;

/**
 * @returns {Promise<{ colonnes: string[], parEmail: Map<string, object>, schema: string, total: number }>}
 *   `parEmail` : email en minuscules → { row, couleur, couleur_source, couleur_hex, cellules: {titre: valeur} }
 */
export async function tableurParEmail() {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;
  const sheets = getSheetsClient();
  const id = getSheetId();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: id, range: RANGE_ONGLET,
    valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const { header, rows } = splitParcours(r.data.values);
  // ⚠️ Même réalignement que tableur-members.js : l'API omet la première cellule vide de la
  // ligne de titres, ce qui décale tout d'une colonne. On complète à gauche.
  const largeur = Math.max(0, ...rows.slice(0, 5).map((x) => (x || []).length));
  const titres = largeur > header.length ? new Array(largeur - header.length).fill('').concat(header) : header.slice();
  if (!String(titres[0] ?? '').trim()) titres[0] = 'ID';
  const colonnes = titres.map((t) => String(t ?? '').trim());
  const norm = colonnes.map(normHeaderTitle);
  const iMails = [TITRES.MAIL_LB, TITRES.MAIL_PERSO].map((t) => norm.indexOf(t)).filter((i) => i >= 0);
  if (!iMails.length) throw new Error('tableur : aucune colonne d adresse (« Mail LearnyBox », « 2ème mail ») retrouvée');
  const colStatut = colonnes[norm.indexOf(TITRES.STATUT)] || null;

  const membres = [];
  rows.forEach((ligne, i) => {
    const l = ligne || [];
    if (!l.some((c) => String(c ?? '').trim())) return;
    const cellules = {};
    colonnes.forEach((t, j) => { if (t) cellules[t] = l[j] ?? ''; });
    const emails = iMails.map((j) => String(l[j] ?? '').trim().toLowerCase()).filter((e) => e.includes('@'));
    membres.push({ row: FIRST_MEMBER_ROW + i, emails, cellules, [colStatut || '__statut']: colStatut ? cellules[colStatut] : '' });
  });

  let schema;
  try { schema = poserCouleurs(membres, await fondsDesLignes(sheets, id), colStatut); }
  catch (e) { console.error('[TABLEUR] ⚠️ fonds illisibles, repli sur le texte :', e.message); poserCouleurs(membres, new Map(), colStatut); schema = 'texte-repli'; }

  const parEmail = new Map();
  for (const m of membres) {
    const fiche = { row: m.row, couleur: m.couleur, couleur_source: m.couleur_source, couleur_hex: m.couleur_hex, cellules: m.cellules };
    for (const e of m.emails) if (!parEmail.has(e)) parEmail.set(e, fiche);
  }
  _cache = { colonnes: colonnes.filter(Boolean), parEmail, schema, total: membres.length };
  _cacheAt = Date.now();
  return _cache;
}
