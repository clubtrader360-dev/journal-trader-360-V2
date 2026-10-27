// Banc : barre latérale élève (27/10/2026) et Trader 360 Score affiché par défaut.
// Lecture statique d index.html (ordre des blocs du menu élève) + exécution de la
// vraie fonction `hiddenOf` extraite de dashboard-customizer.js. Chaque sonde a son
// témoin : la même sonde appliquée à une version altérée DOIT échouer.
import { readFileSync } from 'node:fs';
const racine = new URL('..', import.meta.url).pathname;
const html = readFileSync(racine + 'index.html', 'utf8');
const dash = readFileSync(racine + 'assets/dashboard-customizer.js', 'utf8');
let ok = 0, ko = 0;
const verif = (nom, cond) => { if (cond) ok++; else { ko++; console.log('ÉCHEC', nom); } };

function barre(src) {
  const i = src.indexOf('id="mainAppSidebar"');
  const j = src.indexOf('<!-- Main Content -->', i);
  return src.slice(i, j);
}
function ordre(b, marques) {
  const pos = marques.map(m => b.indexOf(m));
  return pos.every(p => p >= 0) && pos.every((p, k) => k === 0 || p > pos[k - 1]);
}
const ORDRE = [
  'class="marque', 'id="userInfo"', 'class="sidebar-item formation-acces"',
  'id="vacationToggle"', 'id="vacationActiveBanner"', 'id="shareDropdownToggle"',
  'Compte actif\n', 'Compte inactif 🔥\n', '</i>Tableau de bord', '</i>Analyse IA',
  'data-section="connections"', 'Notre Instagram', 'class="sidebar-reglages"',
  'sidebar-perso', 'id="themeToggle"', 'id="zoomLevel"',
];
function sondeBarre(src) {
  const b = barre(src);
  const r = [];
  r.push(['ordre complet', ordre(b, ORDRE)]);
  r.push(['bannière Pause collée au curseur', /id="vacationToggle"[\s\S]*?<\/div>\s*<span[\s\S]*?<\/span>\s*<\/div>\s*<div class="vacation-active-banner"/.test(b)]);
  r.push(['plus de « Mes Comptes Actifs »', !/>\s*Mes Comptes Actifs\s*</.test(b)]);
  r.push(['plus de « Comptes Cramés »', !/>\s*🔥 Comptes Cramés\s*</.test(b)]);
  for (const id of ['userInfo', 'themeToggle', 'zoomLevel', 'shareDropdownToggle', 'vacationToggle', 'vacationActiveBanner', 'accountsList', 'blownAccountsList'])
    r.push(['id unique ' + id, (src.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1]);
  r.push(['connexion API une seule fois', (b.match(/data-section="connections"/g) || []).length === 1]);
  return r;
}
for (const [n, c] of sondeBarre(html)) verif(n, c);
// Témoins : chaque altération doit faire échouer au moins une sonde.
const alteres = {
  'prénom remis sous Formation': (() => { const ui = '                <div class="sidebar-section-title text-sm mt-3" id="userInfo"></div>\n'; const s = html.replace(ui, ''); return s.replace('                <!-- Mode Pause (vacances)', ui + '                <!-- Mode Pause (vacances)'); })(),
  'ancien libellé cramés': html.replace('Compte inactif 🔥', '🔥 Comptes Cramés'),
  'API remontée en tête': html.replace('<div class="sidebar-item active" data-section="dashboard"', '<div class="sidebar-item" data-section="connections">X</div><div class="sidebar-item active" data-section="dashboard"'),
  'thème doublé': html.replace('<div class="sidebar-reglages"', '<div id="themeToggle"></div><div class="sidebar-reglages"'),
};
for (const [n, s] of Object.entries(alteres)) {
  if (s === html) { ko++; console.log('TÉMOIN INOPÉRANT (altération sans effet)', n); continue; }
  verif('témoin ' + n, sondeBarre(s).some(([, c]) => !c));
}

// Score : carte sans masquage écrit en dur, jauge liée.
const carte = html.slice(html.indexOf('<canvas id="traderScoreChart">') - 900, html.indexOf('<canvas id="traderScoreChart">'));
verif('carte Score sans display:none', !/trader-card p-6" style="display: none;"\s*>\s*<h3[^>]*>\s*Trader 360 Score/.test(carte));
verif('témoin carte', /display: none/.test('<div class="trader-card p-6" style="display: none;">'));
verif('jauge présente', /id="traderScoreBar"[^>]*width: 0%/.test(html));
verif('plus de 75.2 figé', !/>75\.2</.test(html) && !/width: 75\.2%/.test(html));
const fn = html.match(/function afficherScore360\(v\) \{[\s\S]*?\n        \}/);
verif('afficherScore360 présente', !!fn);
if (fn) {
  const els = { traderScore: { textContent: '' }, traderScoreBar: { style: {} } };
  const f = new Function('document', fn[0] + '; return afficherScore360;')({ getElementById: id => els[id] });
  f(63.456); verif('score texte', els.traderScore.textContent === '63.5'); verif('score jauge', els.traderScoreBar.style.width === '63.456%');
  f(140); verif('borné à 100', els.traderScoreBar.style.width === '100%');
  f(undefined); verif('NaN → 0', els.traderScore.textContent === '0.0');
}
verif('plus aucun texte du score posé hors helper', !/getElementById\('traderScore'\)\.textContent/.test(html));

// hiddenOf : la vraie fonction, extraite du fichier.
function charger(src) {
  const m = src.match(/var DEFAULT_HIDDEN = [^\n]*\n[\s\S]*?function hiddenOf\(layout\) \{[\s\S]*?\n  \}/);
  if (!m) return null;
  return new Function(m[0] + '; return { hiddenOf: hiddenOf, DEFAULT_HIDDEN: DEFAULT_HIDDEN };')();
}
function sondeDash(src) {
  const k = charger(src); if (!k) return [['extraction', false]];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return [
    ['défaut sans masquage', eq(k.hiddenOf(null), [])],
    ['v1 hérité : Score rouvert', eq(k.hiddenOf({ version: 1, hidden: ['trader-score'] }), [])],
    ['v1 : autres masquages gardés', eq(k.hiddenOf({ version: 1, hidden: ['net-pnl', 'trader-score', 'day-win'] }), ['net-pnl', 'day-win'])],
    ['v2 : choix respecté', eq(k.hiddenOf({ version: 2, hidden: ['trader-score'] }), ['trader-score'])],
    ['sérialisation en v2', /out = \{ version: LAYOUT_VERSION,/.test(src) && /var LAYOUT_VERSION = 2;/.test(src)],
    ['applyLayout passe par hiddenOf', /applyHidden\(hiddenOf\(layout\)\)/.test(src)],
  ];
}
for (const [n, c] of sondeDash(dash)) verif('dash ' + n, c);
const dashAlteres = {
  'ancien défaut': dash.replace('var DEFAULT_HIDDEN = [];', "var DEFAULT_HIDDEN = ['trader-score'];"),
  'sans migration v1': dash.replace("if ((Number(layout.version) || 1) < 2)", 'if (false)'),
  'sérialisé en v1': dash.replace('version: LAYOUT_VERSION,', 'version: 1,'),
};
for (const [n, s] of Object.entries(dashAlteres)) {
  if (s === dash) { ko++; console.log('TÉMOIN INOPÉRANT', n); continue; }
  verif('témoin dash ' + n, sondeDash(s).some(([, c]) => !c));
}
console.log(`barre-laterale : ${ok} ok, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
