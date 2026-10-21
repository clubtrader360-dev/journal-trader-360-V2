/**
 * BANC : couleur d'un membre dans le tableur (légende de Nadir, 21/10), par fond de cellule
 * ou par pastille de texte. Le double imite `sheets.spreadsheets.get` avec `includeGridData` :
 * `data[0].rowData[].values[].effectiveFormat.backgroundColor` et `formattedValue`, ce que
 * `fondsDesLignes` lit réellement. Usage : node outils/tableur-couleurs-banc.mjs
 */
import { classerFond, classerTexte, fondsDesLignes, poserCouleurs } from '../api/_lib/tableur-couleurs.js';
const dire = (ok, msg, v) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${v !== undefined ? '  ' + JSON.stringify(v) : ''}`); if (!ok) process.exitCode = 1; };
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 }; };

console.log('fonds de la palette Google Sheets');
for (const [h, attendu] of [['#f4cccc', 'rouge'], ['#ea9999', 'rouge'], ['#ff0000', 'rouge'], ['#e06666', 'rouge'],
  ['#d9ead3', 'vert'], ['#b6d7a8', 'vert'], ['#00ff00', 'vert'], ['#93c47d', 'vert'],
  ['#cfe2f3', 'bleu'], ['#c9daf8', 'bleu'], ['#9fc5e8', 'bleu'], ['#0000ff', 'bleu'], ['#4a86e8', 'bleu'],
  ['#ffffff', null], ['#f3f3f3', null], ['#d9d9d9', null], ['#fff2cc', 'autre'], ['#fce5cd', 'autre']]) {
  dire(classerFond(rgb(h)) === attendu, `${h} → ${attendu}`, classerFond(rgb(h)));
}
dire(classerFond({}) === null, 'noir sans champ (convention API) : pas une couleur de légende', classerFond({}));
dire(classerFond(null) === null, 'aucun fond : null');

console.log('\npastilles de texte');
for (const [t, a] of [['🔴 Inactif', 'rouge'], ['🟢 T360', 'vert'], ['🔵 Financé', 'bleu'], ['⚪ Nouveau', 'blanc'], ['🟠 Moyen', 'autre'], ['', null]]) dire(classerTexte(t) === a, `« ${t} » → ${a}`);

console.log('\nlecture de l onglet (double de spreadsheets.get)');
const cell = (v, h) => ({ formattedValue: v, ...(h ? { effectiveFormat: { backgroundColor: rgb(h) } } : { effectiveFormat: { backgroundColor: rgb('#ffffff') } }) });
const lignes = [
  { values: [cell('PARCOURS MEMBRE 360')] },
  { values: [cell('Mise à jour')] },
  { values: [cell(''), cell('Prénom'), cell('Nom'), cell('Statut'), cell('Score')] },
  { values: [cell('1'), cell('A'), cell('X'), cell('🟢 T360', '#f4cccc'), cell('3')] },            // ligne 4 : fond rouge sur Statut, texte vert
  { values: [cell('2', '#cfe2f3'), cell('B', '#cfe2f3'), cell('Y', '#cfe2f3'), cell('🟠 Moyen'), cell('5', '#cfe2f3')] }, // 5 : ligne bleue entière
  { values: [cell('3'), cell('C', '#d9ead3'), cell('Z'), cell('🔴 Inactif'), cell('1')] },         // 6 : prénom vert
  { values: [cell('4'), cell('D'), cell('W'), cell('🟢 T360'), cell('9')] },                       // 7 : aucun fond → blanc
  { values: [cell('5'), cell('E'), cell('V'), cell(''), cell('2', '#fff2cc')] },                    // 8 : une seule cellule jaune (pas majoritaire)
];
const sheets = (rows) => ({ spreadsheets: { get: async (o) => { if (!o.includeGridData || !/backgroundColor/.test(o.fields)) throw new Error('le double exige includeGridData et le masque backgroundColor'); return { data: { sheets: [{ data: [{ startRow: 0, rowData: rows }] }] } }; } } });
const f = await fondsDesLignes(sheets(lignes), 'x');
dire(f.get(4).cle === 'rouge', 'ligne 4 : le fond de Statut l emporte sur la pastille du texte', f.get(4));
dire(f.get(5).cle === 'bleu', 'ligne 5 : ligne entière bleue', f.get(5));
dire(f.get(6).cle === 'vert', 'ligne 6 : fond du prénom', f.get(6));
dire(f.get(7).cle === null, 'ligne 7 : aucun fond', f.get(7));
dire(f.get(8).cle === null, 'ligne 8 : une cellule isolée ne colore pas la ligne', f.get(8));
dire(!f.has(3) && !f.has(1), 'titres et en-têtes exclus');

const membres = [4, 5, 6, 7, 8].map((row, i) => ({ row, Statut: lignes[row - 1].values[3].formattedValue }));
dire(poserCouleurs(membres, f, 'Statut') === 'fond', 'trois lignes colorées : schéma « fond »');
dire(JSON.stringify(membres.map((m) => m.couleur)) === JSON.stringify(['rouge', 'bleu', 'vert', 'blanc', 'blanc']), 'couleurs par le fond, sans couleur = blanc', membres.map((m) => m.couleur));
const m2 = membres.map((m) => ({ row: m.row, Statut: m.Statut }));
dire(poserCouleurs(m2, new Map(), 'Statut') === 'texte', 'aucun fond : schéma « texte »');
dire(JSON.stringify(m2.map((m) => m.couleur)) === JSON.stringify(['vert', 'autre', 'rouge', 'vert', 'blanc']), 'couleurs par la pastille du texte', m2.map((m) => m.couleur));
let leve = false; try { await fondsDesLignes({ spreadsheets: { get: async () => { throw new Error('403'); } } }, 'x'); } catch { leve = true; }
dire(leve, 'une lecture refusée lève (l appelant replie sur le texte et le journalise)');
dire(classerFond(rgb('#f4cccc')) !== classerFond(rgb('#cfe2f3')), 'témoin : la sonde distingue deux couleurs');
console.log(process.exitCode ? '\n⛔ défauts' : '\nbanc vert');
