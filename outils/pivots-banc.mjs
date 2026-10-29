/**
 * BANC DES POINTS PIVOTS DU BRIEF (29/10/2026) : api/_lib/pivots.js, la vraie.
 * ES : pivots classiques journaliers publiés par Investing pour le 29/10/2026 (capture
 * de Nadir), règlement 7 783,25 publié par le brief du même jour.
 * CFD : haut, bas et clôture Cboe du S&P 500 le 28/10/2026 (7 758,43 · 7 718,37 ·
 * 7 743,98, tels que publiés par le brief du 29/10) ; pivots attendus calculés à la main.
 * Usage : node outils/pivots-banc.mjs [chemin d'un brief réel]
 */
import { readFileSync } from 'node:fs';
import { calculerPivots, ajouterPivots, controlerPivots, commentaireCfd } from '../api/_lib/pivots.js';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 220) : '')); if (!ok) ko++; };

const INVESTING = { R3: 7876.58, R2: 7847.67, R1: 7800.58, P: 7771.67, S1: 7724.58, S2: 7695.67, S3: 7648.58 };
dire(JSON.stringify(calculerPivots(7818.75, 7742.75, 7753.50)) === JSON.stringify(INVESTING), 'la formule rend au centime les pivots publiés par Investing (H 7818,75 · B 7742,75 · C 7753,50)');
const CFD = { date: '2026-10-28', haut: 7758.43, bas: 7718.37, cloture: 7743.98 };
const CFD_ATTENDU = { R2: 7780.32, R1: 7762.15, P: 7740.26, S1: 7722.09, S2: 7700.2 };   // calcul à la main
const pc = calculerPivots(CFD.haut, CFD.bas, CFD.cloture);
dire(Object.entries(CFD_ATTENDU).every(([k, v]) => pc[k] === v), 'pivots CFD du 29/10 = calcul à la main', pc);

const commentaire = (v, extra = 'echelle=journaliere') => `<!-- PIVOTS-ES page=https://www.investing.com/indices/us-spx-500-futures-technical ${extra} ${Object.entries(v).map(([k, x]) => `${k.toLowerCase()}=${x}`).join(' ')} -->`;
const ligne = (lib, es, cfd) => `\n  <tr><td style="x">${lib}</td><td align="center" style="y">${es}</td><td align="center" style="z">${cfd}</td></tr>`;
const brief = ({ com = commentaire(INVESTING), cfdCom = commentaireCfd(CFD), clo = '7&nbsp;783,25', cloCfd = '7&nbsp;743,98', titre = '🎯 S&amp;P 500 : zones à surveiller' } = {}) =>
  `<div class="brief-marche"><p>Intro</p><h2 style="color:#ac862b">${titre}</h2><table>${ligne('', 'ES', 'CFD')}${ligne('CLÔTURE', clo, cloCfd)}${ligne('POC', '7&nbsp;771,25', '')}\n  <tr>\n    <td colspan="3"><div>Niveaux psychologiques</div><div>7&nbsp;750</div></td>\n  </tr>\n</table>\n${com}\n<p><b>Pour les débutants en trading démo</b></p><h2 style="color:#ac862b">📅 Agenda éco</h2><p>…</p>\n<!-- AUDIT QUALITÉ V11\nx\n--></div>\n${cfdCom}\n`;

// 1. Le cas réel du 29/10 : les deux colonnes passent.
let r = ajouterPivots(brief());
const pos = (x) => r.html.indexOf(x);
const iPoc = pos('>POC<'), iR2 = pos('Résistance 2'), iS2 = pos('Support 2'), iNiv = pos('Niveaux psychologiques'), iFin = pos('</table>');
dire(r.pivots?.P === 7771.67 && r.pivotsCfd?.P === 7740.26, 'ES et CFD acceptés', { es: r.pivots?.P, cfd: r.pivotsCfd?.P });
dire(iPoc < iR2 && iR2 < iS2 && iS2 < iNiv && iNiv < iFin, 'un seul tableau : clôture, POC, R2 à S2, puis niveaux psychologiques', { iPoc, iR2, iS2, iNiv, iFin });
dire((r.html.match(/<table/g) || []).length === 1, 'aucun second tableau créé');
dire((r.html.match(/<tr>/g) || []).length === 9, 'neuf lignes : en-tête, clôture, POC, cinq pivots, niveaux', (r.html.match(/<tr>/g) || []).length);
const lr2 = r.html.slice(iR2, r.html.indexOf('</tr>', iR2));
dire(lr2.indexOf('7&nbsp;847,67') > 0 && lr2.indexOf('7&nbsp;780,32') > lr2.indexOf('7&nbsp;847,67'), 'Résistance 2 : ES 7 847,67 puis CFD 7 780,32, dans cet ordre');
dire(['7&nbsp;771,67', '7&nbsp;695,67', '7&nbsp;740,26', '7&nbsp;700,20'].every((x) => r.html.includes(x)), 'valeurs au format français, espace insécable');
dire(!r.html.includes('Résistance 3') && !r.html.includes('Support 3') && !r.html.includes('7&nbsp;876,58'), 'R3 et S3 ni affichés ni chiffrés');
dire(!r.html.includes('PIVOTS-ES') && !r.html.includes('PIVOTS-CFD') && r.html.includes('AUDIT QUALITÉ'), 'commentaires machine retirés, audit laissé à son propre filtre');
const iMention = pos('source Investing.com'), iDeb = pos('Pour les débutants');
dire(iMention > iFin && iMention < iDeb && r.html.includes('Cboe'), 'mention des deux sources sous le tableau');
dire(!/[—–]/.test(r.html), 'aucun tiret long dans le brief produit');
dire(ajouterPivots(r.html).html === r.html, 'deux passages (endpoint puis archive) : pas de doublon');
dire(ajouterPivots(brief({ titre: 'SPX : zones à surveiller' })).pivots !== null, 'l ancien titre reste reconnu');
const enFormat = (loc) => Object.fromEntries(Object.entries(INVESTING).map(([k, v]) => [k, v.toLocaleString(loc, { minimumFractionDigits: 2 })]));
dire(ajouterPivots(brief({ com: commentaire(enFormat('en-US')) })).pivots?.R3 === 7876.58, 'format anglais 7,876.58 lu 7876,58');
dire(ajouterPivots(brief({ com: commentaire(enFormat('de-DE')) })).pivots?.S3 === 7648.58, 'format 7.648,58 lu 7648,58');
const pres = (a, b) => Math.abs(a - b) <= 0.02;
dire(pres(r.pivots.haut, 7818.75) && pres(r.pivots.bas, 7742.75) && pres(r.pivots.cloture, 7753.5), 'barre ES retrouvée depuis P, R1, S1 = celle d Investing', r.pivots);

// 2. Refus côté ES : la colonne ES passe en n/d, le CFD reste.
const refuseEs = (o, attendu, m) => { const x = ajouterPivots(brief(o)); dire(!x.pivots && x.pivotsCfd && attendu.test(x.motif || '') && /Résistance 2/.test(x.html) && !x.html.includes('PIVOTS-ES'), m, x.motif); };
refuseEs({ com: commentaire({ ...INVESTING, R2: 7848.67 }) }, /mal relevés/, 'ES : R2 mal lu, colonne ES en n/d, CFD conservé');
refuseEs({ com: commentaire({ ...INVESTING, R3: 7876.78 }) }, /mal relevés/, 'ES : R3 décalé de 0,20 : refusé');
const amp = 76, P = 7771.67, c2 = (x) => Math.round(x * 100) / 100;
refuseEs({ com: commentaire({ R3: c2(P + amp), R2: c2(P + 0.618 * amp), R1: c2(P + 0.382 * amp), P, S1: c2(P - 0.382 * amp), S2: c2(P - 0.618 * amp), S3: c2(P - amp) }) }, /non classiques|mal relevés/, 'ES : ligne Fibonacci refusée');
refuseEs({ com: commentaire(calculerPivots(7790.25, 7778.5, 7781)) }, /amplitude/, 'ES : échelle horaire refusée par l amplitude');
refuseEs({ com: commentaire(calculerPivots(7739.5, 7651.75, 7714.5)) }, /règlement/, 'ES : pivots d une autre séance refusés');
refuseEs({ com: commentaire(INVESTING, 'echelle=horaire') }, /échelle/, 'ES : échelle horaire déclarée');
refuseEs({ com: commentaire(INVESTING, '') }, /échelle/, 'ES : échelle non dite');
refuseEs({ com: '<!-- PIVOTS-ES n/d (page Investing inaccessible) -->' }, /n\/d/, 'ES : n/d déclaré');
refuseEs({ com: '' }, /absent/, 'ES : commentaire absent');
r = ajouterPivots(brief({ com: commentaire(INVESTING).replace('r2=7847.67', 'r2=7847.67') }));
const nCellNd = (h) => (h.match(/>n\/d</g) || []).length;
dire(nCellNd(ajouterPivots(brief({ com: '' })).html) === 5, 'ES refusé : exactement cinq cellules n/d (une par pivot)');
dire(ajouterPivots(brief({ clo: 'n/d (sources divergentes)' })).pivots !== null, 'ES : clôture en n/d, les autres contrôles suffisent');

// 3. Refus côté CFD : la colonne CFD passe en n/d, l'ES reste.
const refuseCfd = (o, attendu, m) => { const x = ajouterPivots(brief(o)); dire(x.pivots && !x.pivotsCfd && attendu.test(x.motifCfd || '') && !x.html.includes('PIVOTS-CFD'), m, x.motifCfd); };
refuseCfd({ cfdCom: '' }, /absent/, 'CFD : données Cboe non transmises, colonne CFD en n/d');
refuseCfd({ cloCfd: '7&nbsp;740,00' }, /pas la même séance/, 'CFD : clôture du tableau différente de celle des pivots : refusé');
refuseCfd({ cloCfd: 'n/d (source indisponible)' }, /non vérifiable/, 'CFD : clôture du tableau en n/d : refusé');
refuseCfd({ cfdCom: commentaireCfd({ ...CFD, haut: 7700 }) }, /incohérents/, 'CFD : haut sous la clôture : refusé');
refuseCfd({ cfdCom: commentaireCfd({ ...CFD, haut: 7745, bas: 7740 }) }, /amplitude/, 'CFD : amplitude de 5 points : refusé');
dire(ajouterPivots(brief({ clo: '1&nbsp;000,00' })).pivotsCfd !== null, 'la clôture ES n est jamais prise pour la clôture CFD');

// 4. Les deux refusés : rien n'est inséré.
r = ajouterPivots(brief({ com: '', cfdCom: '' }));
dire(!r.pivots && !r.pivotsCfd && !r.html.includes('Résistance 2') && !r.html.includes('PIVOTS-'), 'ES et CFD refusés : aucune ligne, commentaires retirés');
r = ajouterPivots(brief().replace('>CLÔTURE<', '>CLOTURE<'));
dire(!r.pivots && /CLÔTURE/.test(r.motif), 'ligne CLÔTURE absente : refusé, aucun contrôle ne saute en silence', r.motif);
r = ajouterPivots('<div class="brief-marche"><h2>Autre</h2></div>');
dire(!r.pivots && r.html === '<div class="brief-marche"><h2>Autre</h2></div>', 'brief sans section ni commentaire : inchangé');
dire(controlerPivots(INVESTING, 7743.98).ok && !controlerPivots(INVESTING, 7700).ok, 'contrôle du règlement : 7 743,98 dans la barre, 7 700 hors barre');

const chemin = process.argv[2];
if (chemin) {
  const reel = readFileSync(chemin, 'utf8');
  const rr = ajouterPivots(reel.replace(/(zones à surveiller[\s\S]*?<\/table>)/, `$1\n${commentaire(INVESTING)}`) + commentaireCfd(CFD));
  dire(rr.html.indexOf('Résistance 2') < rr.html.indexOf('Niveaux psychologiques'), `brief réel ${chemin.split('/').pop()} : lignes posées avant les niveaux`, { es: rr.motif, cfd: rr.motifCfd });
}
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
