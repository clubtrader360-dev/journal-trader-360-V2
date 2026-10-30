/**
 * BANC DES POINTS PIVOTS DU BRIEF : api/_lib/pivots.js, la vraie.
 * Révision du 30/10/2026 : les pivots ES sont CALCULÉS par le code sur la barre de séance
 * (haut, bas, règlement), plus relevés par le modèle.
 * ES : pivots classiques journaliers lus sur Investing le 30/10/2026 au matin, dans un
 * navigateur, échelle « Daily » : S3 7 653,67 · S2 7 681,58 · S1 7 717,92 · P 7 745,83 ·
 * R1 7 782,17 · R2 7 810,08 · R3 7 846,42. Séance du 29/10 : haut 7 773,75, bas 7 709,50
 * (minutes CNBC, séance Globex), règlement 7 754,25 (publié par le brief du 30/10).
 * CFD : haut, bas et clôture Cboe du S&P 500 le 28/10/2026 ; pivots attendus à la main.
 * Usage : node outils/pivots-banc.mjs [chemin d'un brief réel]
 */
import { readFileSync } from 'node:fs';
import { calculerPivots, ajouterPivots, commentaireCfd, commentaireEs } from '../api/_lib/pivots.js';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 220) : '')); if (!ok) ko++; };

const INVESTING = { R3: 7846.42, R2: 7810.08, R1: 7782.17, P: 7745.83, S1: 7717.92, S2: 7681.58, S3: 7653.67 };
const SEANCE = { date: '2026-10-29', contrat: 'ESZ2026', haut: 7773.75, bas: 7709.5, cloture: 7754.25 };
dire(JSON.stringify(calculerPivots(SEANCE.haut, SEANCE.bas, SEANCE.cloture)) === JSON.stringify(INVESTING),
  'barre de séance + règlement = les pivots d Investing au centime (30/10)', calculerPivots(SEANCE.haut, SEANCE.bas, SEANCE.cloture));
dire(JSON.stringify(calculerPivots(SEANCE.haut, SEANCE.bas, 7710)) !== JSON.stringify(INVESTING),
  'témoin : avec le dernier cours (7 710) au lieu du règlement, la sonde échoue');
const CFD = { date: '2026-10-28', haut: 7758.43, bas: 7718.37, cloture: 7743.98 };
const CFD_ATTENDU = { R2: 7780.32, R1: 7762.15, P: 7740.26, S1: 7722.09, S2: 7700.2 };
const pc = calculerPivots(CFD.haut, CFD.bas, CFD.cloture);
dire(Object.entries(CFD_ATTENDU).every(([k, v]) => pc[k] === v), 'pivots CFD = calcul à la main', pc);

const ligne = (lib, es, cfd) => `\n  <tr><td style="x">${lib}</td><td align="center" style="y">${es}</td><td align="center" style="z">${cfd}</td></tr>`;
const brief = ({ modele = '', esCom = commentaireEs(SEANCE), cfdCom = commentaireCfd(CFD), clo = '7&nbsp;754,25', cloCfd = '7&nbsp;743,98', titre = '🎯 S&amp;P 500 : zones à surveiller' } = {}) =>
  `<div class="brief-marche"><p>Intro</p><h2 style="color:#ac862b">${titre}</h2><table>${ligne('', 'ES', 'CFD')}${ligne('CLÔTURE', clo, cloCfd)}${ligne('POC', '7&nbsp;771,25', '')}\n  <tr>\n    <td colspan="3"><div>Niveaux psychologiques</div><div>7&nbsp;750</div></td>\n  </tr>\n</table>\n${modele}\n<p><b>Pour les débutants en trading démo</b></p><h2 style="color:#ac862b">📅 Agenda éco</h2><p>…</p>\n<!-- AUDIT QUALITÉ V11\nx\n--></div>\n${cfdCom}\n${esCom}\n`;

// 1. Le cas réel : les deux colonnes passent.
let r = ajouterPivots(brief());
const pos = (x) => r.html.indexOf(x);
const iPoc = pos('>POC<'), iR2 = pos('Résistance 2'), iS2 = pos('Support 2'), iNiv = pos('Niveaux psychologiques'), iFin = pos('</table>');
dire(r.pivots?.P === 7745.83 && r.pivotsCfd?.P === 7740.26, 'ES et CFD acceptés', { es: r.pivots?.P, cfd: r.pivotsCfd?.P });
dire(iPoc < iR2 && iR2 < iS2 && iS2 < iNiv && iNiv < iFin, 'un seul tableau : clôture, POC, R2 à S2, puis niveaux psychologiques');
dire((r.html.match(/<table/g) || []).length === 1, 'aucun second tableau créé');
dire((r.html.match(/<tr>/g) || []).length === 9, 'neuf lignes : en-tête, clôture, POC, cinq pivots, niveaux', (r.html.match(/<tr>/g) || []).length);
const lr2 = r.html.slice(iR2, r.html.indexOf('</tr>', iR2));
dire(lr2.indexOf('7&nbsp;810,08') > 0 && lr2.indexOf('7&nbsp;780,32') > lr2.indexOf('7&nbsp;810,08'), 'Résistance 2 : ES 7 810,08 puis CFD 7 780,32');
dire(['7&nbsp;745,83', '7&nbsp;717,92', '7&nbsp;681,58', '7&nbsp;740,26'].every((x) => r.html.includes(x)), 'valeurs au format français, espace insécable');
dire(!r.html.includes('Résistance 3') && !r.html.includes('7&nbsp;846,42'), 'R3 et S3 ni affichés ni chiffrés');
dire(!/PIVOTS-(ES|SEANCE|CFD)/.test(r.html) && r.html.includes('AUDIT QUALITÉ'), 'commentaires machine retirés, audit laissé à son propre filtre');
dire(/Investing\.com/.test(r.html) && r.html.includes('Cboe') && !/source Investing/.test(r.html), 'mention : ES calculés (mêmes valeurs qu Investing), CFD Cboe');
dire(!/[—–]/.test(r.html), 'aucun tiret long dans le brief produit');
dire(ajouterPivots(r.html).html === r.html, 'deux passages (endpoint puis archive) : pas de doublon');
dire(ajouterPivots(brief({ titre: 'SPX : zones à surveiller' })).pivots !== null, 'l ancien titre reste reconnu');

// 2. Le relevé du modèle n'est plus utilisé : n/d ou valeurs fausses, l'ES passe quand même.
r = ajouterPivots(brief({ modele: '<!-- PIVOTS-ES n/d (page Investing inaccessible) -->' }));
dire(r.pivots?.P === 7745.83 && !r.html.includes('PIVOTS-ES'), 'un « PIVOTS-ES n/d » du modèle n empêche plus rien, et il est retiré');
r = ajouterPivots(brief({ modele: '<!-- PIVOTS-ES page=x echelle=journaliere r3=1 r2=1 r1=1 p=1 s1=1 s2=1 s3=1 -->' }));
dire(r.pivots?.P === 7745.83, 'des valeurs du modèle sont ignorées : seul le calcul du code compte');

// 3. Refus côté ES : colonne ES en n/d, CFD conservé.
const refuseEs = (o, attendu, m) => { const x = ajouterPivots(brief(o)); dire(!x.pivots && x.pivotsCfd && attendu.test(x.motif || '') && /Résistance 2/.test(x.html) && !/PIVOTS-SEANCE/.test(x.html), m, x.motif); };
refuseEs({ esCom: '' }, /absent/, 'ES : barre de séance non transmise');
refuseEs({ clo: '7&nbsp;783,25' }, /pas la même séance/, 'ES : clôture du tableau différente du règlement des pivots');
refuseEs({ clo: 'n/d (sources divergentes)' }, /non vérifiable/, 'ES : clôture du tableau en n/d');
refuseEs({ esCom: commentaireEs({ ...SEANCE, haut: 7740 }) }, /incohérents/, 'ES : haut sous la clôture');
refuseEs({ esCom: commentaireEs({ ...SEANCE, haut: 7760, bas: 7750, cloture: 7754.25 }) }, /amplitude/, 'ES : amplitude d une barre horaire');
dire((ajouterPivots(brief({ esCom: '' })).html.match(/>n\/d</g) || []).length === 5, 'ES refusé : exactement cinq cellules n/d');

// 4. Refus côté CFD : colonne CFD en n/d, ES conservé.
const refuseCfd = (o, attendu, m) => { const x = ajouterPivots(brief(o)); dire(x.pivots && !x.pivotsCfd && attendu.test(x.motifCfd || '') && !x.html.includes('PIVOTS-CFD'), m, x.motifCfd); };
refuseCfd({ cfdCom: '' }, /absent/, 'CFD : données Cboe non transmises');
refuseCfd({ cloCfd: '7&nbsp;740,00' }, /pas la même séance/, 'CFD : clôture du tableau différente');
refuseCfd({ cfdCom: commentaireCfd({ ...CFD, haut: 7745, bas: 7740 }) }, /amplitude/, 'CFD : amplitude de 5 points');

// 5. Les deux refusés : rien n'est inséré.
r = ajouterPivots(brief({ esCom: '', cfdCom: '' }));
dire(!r.pivots && !r.pivotsCfd && !r.html.includes('Résistance 2'), 'ES et CFD refusés : aucune ligne');
r = ajouterPivots(brief().replace('>CLÔTURE<', '>CLOTURE<'));
dire(!r.pivots && /CLÔTURE/.test(r.motif), 'ligne CLÔTURE absente : refusé, aucun contrôle ne saute en silence', r.motif);

const chemin = process.argv[2];
if (chemin) {
  const reel = readFileSync(chemin, 'utf8');
  const rr = ajouterPivots(reel + commentaireEs(SEANCE) + commentaireCfd(CFD));
  dire(rr.html.indexOf('Résistance 2') < rr.html.indexOf('Niveaux psychologiques'), `brief réel ${chemin.split('/').pop()} : lignes posées avant les niveaux`, { es: rr.motif, cfd: rr.motifCfd });
}
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
