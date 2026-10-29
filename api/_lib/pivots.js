/**
 * POINTS PIVOTS DU BRIEF (Nadir et Manu, 29/10/2026) : un tableau sous la section
 * « S&P 500 : zones à surveiller », méthode classique, valeurs d'Investing.com.
 *
 * D'OÙ VIENNENT LES CHIFFRES. Nadir veut les pivots d'Investing, au centime. Investing
 * les calcule sur SA barre de la veille (haut, bas, dernier cours de la journée Globex),
 * qui n'est ni notre barre TradingView ni le règlement CME publié en CLÔTURE. Mesuré le
 * 29/10 : Investing H 7 818,75 · B 7 742,75 · C 7 753,50 ; notre brief H 7 819,50 ·
 * B 7 750,25 · règlement 7 783,25. Calculer sur nos chiffres aurait décalé le pivot de
 * dix points. Investing ne se lit pas depuis du code (protection anti-robot) : c'est le
 * modèle qui relève la ligne « Classic » de la page technique, en journalier, et l'écrit
 * dans un commentaire machine :
 *   <!-- PIVOTS-ES page=<url> echelle=journaliere r3=… r2=… r1=… p=… s1=… s2=… s3=… -->
 *   <!-- PIVOTS-ES n/d (raison) -->
 *
 * ⛔ UN MODÈLE QUI LIT UNE PAGE REND TOUJOURS UNE VALEUR PLAUSIBLE. On ne le croit donc
 * pas sur parole : sept pivots classiques ne sont pas sept nombres libres, ils sont
 * déterminés par TROIS (haut, bas, clôture). Le code en déduit H = 2P − S1, B = 2P − R1,
 * C = 3P − H − B, puis exige que R2, S2, R3, S3 retombent sur la formule à quelques
 * centimes près. Une faute de lecture sur un chiffre, une ligne Fibonacci ou Camarilla
 * prise pour la Classic, un nombre inventé : refusé. Restent deux pièges cohérents par
 * construction, l'échelle horaire et la mauvaise séance, d'où deux contrôles de plus :
 * l'amplitude H − B doit être celle d'une journée, et le règlement publié en CLÔTURE ES
 * doit tomber dans la barre (il en fait partie).
 *   P  = (H + B + C) / 3
 *   R1 = 2P − B        S1 = 2P − H
 *   R2 = P + (H − B)   S2 = P − (H − B)
 *   R3 = H + 2(P − B)  S3 = B − 2(H − P)
 *
 * ⚠️ UN REFUS N'EST JAMAIS COMBLÉ. Pas de tableau, la raison est rendue et journalisée :
 * un pivot faux est pire qu'un pivot absent. Le commentaire machine est retiré dans
 * TOUS les cas, accepté ou non, pour ne jamais partir dans un courriel.
 */
// Lecture d'un nombre écrit à la française (« 7 876,58 ») ou à l'anglaise (« 7,876.58 »,
// la page anglaise d'Investing). Quand les deux séparateurs sont présents, le DERNIER est
// la marque décimale et l'autre sépare les milliers. Un séparateur seul est toujours
// décimal : « 7,876 » se lit donc 7,876 et non 7 876, et ce faux nombre est ensuite
// refusé par l'ordre et l'amplitude au lieu d'être deviné. ⛔ Pas d'heuristique « trois
// chiffres après un point = milliers » : elle lisait 7742.638 comme 7 742 638.
const nombre = (brut) => {
  let t = String(brut ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|[\s  ]/g, '').trim();
  if (!t || /n\/d/i.test(t)) return null;
  if (t.includes('.') && t.includes(',')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '') : t.replace(/,/g, '');
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** La valeur ES (première colonne de valeurs) d'une ligne du gabarit E, par son libellé. */
function valeurES(html, libelle) {
  const re = new RegExp(`>\\s*${libelle}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i');
  const m = html.match(re);
  return m ? nombre(m[1]) : null;
}

const arrondi = (x) => Math.round(x * 100) / 100;

export function calculerPivots(h, b, c) {
  const p = (h + b + c) / 3;
  return { R3: arrondi(h + 2 * (p - b)), R2: arrondi(p + (h - b)), R1: arrondi(2 * p - b), P: arrondi(p),
           S1: arrondi(2 * p - h), S2: arrondi(p - (h - b)), S3: arrondi(b - 2 * (h - p)) };
}

// Bornes des contrôles. TOLERANCE : chaque pivot publié est arrondi au centime, et R3 /
// S3 cumulent plusieurs arrondis (au plus 0,05) ; 0,08 laisse passer l'arrondi, pas une
// faute de lecture (la plus petite fausse lecture d'un chiffre décale de 0,10 au moins).
// AMPLITUDE : une séance ES va de quelques dizaines à quelques centaines de points ; une
// barre horaire, rarement au-delà de vingt. MARGE : le règlement de 22 h (Paris)
// appartient à la barre journalière d'Investing ; trois points couvrent l'écart entre
// deux flux de cotation.
export const BORNES = { TOLERANCE: 0.08, AMPLITUDE_MIN: 20, AMPLITUDE_MAX: 450, MARGE_REGLEMENT: 3 };

const MOTIF_COMMENTAIRE = /<!--\s*PIVOTS-ES\b([\s\S]*?)-->[ \t]*\n?/i;

/** Lit le commentaire machine. Rend { brut, nd } ou { brut, valeurs, page, echelle }, ou null. */
export function lireCommentaire(html) {
  const m = String(html || '').match(MOTIF_COMMENTAIRE);
  if (!m) return null;
  const corps = m[1].trim();
  if (/^n\/d/i.test(corps)) return { brut: m[0], nd: corps };
  const champ = (cle) => { const x = corps.match(new RegExp(`(?:^|\\s)${cle}=(\\S+)`, 'i')); return x ? x[1] : null; };
  const valeurs = {};
  for (const k of ['R3', 'R2', 'R1', 'P', 'S1', 'S2', 'S3']) valeurs[k] = nombre(champ(k.toLowerCase()));
  return { brut: m[0], nd: null, valeurs, page: champ('page'), echelle: champ('echelle') };
}

/**
 * Contrôle sept pivots relevés. Rend { ok, motif, haut, bas, cloture }.
 * `reglement` : la CLÔTURE ES (première colonne) publiée dans le gabarit E, ou null si elle est en n/d.
 */
export function controlerPivots(v, reglement = null) {
  const manquants = Object.entries(v).filter(([, x]) => x == null).map(([k]) => k);
  if (manquants.length) return { ok: false, motif: `pivot(s) illisible(s) : ${manquants.join(', ')}` };
  const ordre = ['S3', 'S2', 'S1', 'P', 'R1', 'R2', 'R3'];
  for (let i = 1; i < ordre.length; i++) {
    if (!(v[ordre[i]] > v[ordre[i - 1]])) return { ok: false, motif: `ordre rompu : ${ordre[i - 1]} ${v[ordre[i - 1]]}, ${ordre[i]} ${v[ordre[i]]}` };
  }
  const h = 2 * v.P - v.S1, b = 2 * v.P - v.R1, c = 3 * v.P - h - b;
  const attendu = calculerPivots(h, b, c);
  for (const k of ['R2', 'S2', 'R3', 'S3']) {
    if (Math.abs(attendu[k] - v[k]) > BORNES.TOLERANCE) {
      return { ok: false, motif: `pivots non classiques ou mal relevés : ${k} lu ${v[k]}, la formule donne ${attendu[k]}` };
    }
  }
  const amplitude = h - b;
  if (amplitude < BORNES.AMPLITUDE_MIN || amplitude > BORNES.AMPLITUDE_MAX) {
    return { ok: false, motif: `amplitude de ${arrondi(amplitude)} points : pas une séance journalière (échelle horaire ?)` };
  }
  if (reglement != null && (reglement < b - BORNES.MARGE_REGLEMENT || reglement > h + BORNES.MARGE_REGLEMENT)) {
    return { ok: false, motif: `le règlement publié ${reglement} sort de la barre déduite [${arrondi(b)} ; ${arrondi(h)}] : mauvaise séance ou mauvais contrat` };
  }
  return { ok: true, motif: null, haut: arrondi(h), bas: arrondi(b), cloture: arrondi(c) };
}

const fr = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\s  ]/g, '&nbsp;');

/** La valeur CFD (seconde colonne de valeurs) d'une ligne du gabarit E, par son libellé. */
function valeurCFD(html, libelle) {
  const re = new RegExp(`>\\s*${libelle}\\s*</td>\\s*<td[^>]*>[\\s\\S]*?</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i');
  const m = html.match(re);
  return m ? nombre(m[1]) : null;
}

// ── CFD (indice comptant) ────────────────────────────────────────────────────────
// Nadir, 29/10/2026 : les pivots du CFD à côté de ceux de l'ES. Ils ne sont PAS relevés
// par le modèle : le haut, le bas et la clôture du S&P 500 comptant viennent de Cboe,
// collectés et datés par le code (marche.mjs, variable SORTIE_CFD), et le workflow les
// accroche au brief dans un commentaire machine :
//   <!-- PIVOTS-CFD date=AAAA-MM-JJ haut=… bas=… cloture=… source=Cboe -->
// La clôture doit être EXACTEMENT celle publiée dans la ligne CLÔTURE, colonne CFD :
// même source, donc tout écart dit qu'on ne parle pas de la même séance.
const MOTIF_CFD = /<!--\s*PIVOTS-CFD\b([\s\S]*?)-->[ \t]*\n?/i;

export function commentaireCfd({ date, haut, bas, cloture, source = 'Cboe' }) {
  return `<!-- PIVOTS-CFD date=${date} haut=${haut} bas=${bas} cloture=${cloture} source=${source} -->`;
}

function pivotsCfd(corps, clotureTableau) {
  if (corps == null) return { pv: null, motif: 'commentaire PIVOTS-CFD absent (données Cboe non transmises)' };
  const champ = (cle) => { const x = corps.match(new RegExp(`(?:^|\\s)${cle}=(\\S+)`, 'i')); return x ? nombre(x[1]) : null; };
  const h = champ('haut'), b = champ('bas'), c = champ('cloture');
  if ([h, b, c].some((x) => x == null)) return { pv: null, motif: 'PIVOTS-CFD : haut, bas ou clôture illisible' };
  if (!(h > b) || c > h || c < b) return { pv: null, motif: `PIVOTS-CFD incohérents (haut ${h}, bas ${b}, clôture ${c})` };
  if (h - b < BORNES.AMPLITUDE_MIN || h - b > BORNES.AMPLITUDE_MAX) return { pv: null, motif: `PIVOTS-CFD : amplitude de ${arrondi(h - b)} points` };
  if (clotureTableau == null) return { pv: null, motif: 'clôture CFD du tableau absente ou en n/d : séance non vérifiable' };
  if (Math.abs(clotureTableau - c) > 0.01) return { pv: null, motif: `clôture CFD du tableau ${clotureTableau}, celle des pivots ${c} : pas la même séance` };
  return { pv: { ...calculerPivots(h, b, c), haut: h, bas: b, cloture: c }, motif: null };
}

// Les lignes posées DANS le tableau du gabarit E, juste avant la ligne des niveaux
// psychologiques : libellé, ES, CFD. R3 et S3 ne sont pas affichés (Nadir : on ne les
// utilise pas) mais restent CONTRÔLÉS côté ES : ce sont eux qui trahissent une ligne
// Fibonacci ou une faute de lecture. Une colonne refusée affiche n/d, l'autre reste.
export function lignesPivots(es, cfd) {
  const nd = '<span style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif; font-size:11px; font-weight:400; color:#5a5040;">n/d</span>';
  const cellule = (pv, k, fort, fin) => `<td align="center" style="padding:7px ${fin ? '12px' : '4px'} 7px 4px; border-top:1px solid rgba(212,175,55,0.30); text-align:center; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:14px; font-weight:700; color:${fort ? '#ac862b' : '#1a1208'};">${pv ? fr(pv[k]) : nd}</td>`;
  const ligne = (lib, k, fort) => `
  <tr>
    <td style="padding:7px 6px 7px 12px; border-top:1px solid rgba(212,175,55,0.30); color:${fort ? '#ac862b' : '#5a5040'}; font-size:10px; letter-spacing:0.10em; text-transform:uppercase;${fort ? ' font-weight:700;' : ''}">${lib}</td>
    ${cellule(es, k, fort, false)}
    ${cellule(cfd, k, fort, true)}
  </tr>`;
  return `
  <!-- PIVOTS : ES relevés sur Investing.com, CFD calculés sur Cboe, contrôlés par api/_lib/pivots.js -->${ligne('Résistance 2', 'R2')}${ligne('Résistance 1', 'R1')}${ligne('Pivot', 'P', true)}${ligne('Support 1', 'S1')}${ligne('Support 2', 'S2')}`;
}

const MENTION = '<p style="margin:0 0 10px; font-size:11px; color:#5a5040;">Pivots : méthode classique. ES : source Investing.com. CFD : calculés sur le haut, le bas et la clôture du S&amp;P 500 publiés par Cboe.</p>\n';

/**
 * Retire les commentaires machine, contrôle les deux jeux de pivots, et insère les
 * lignes dans le tableau de la section « zones à surveiller ».
 * Rend { html, pivots (ES), pivotsCfd, motif (ES), motifCfd }.
 */
export function ajouterPivots(html) {
  const src = String(html || '');
  const lu = lireCommentaire(src);
  const mCfd = src.match(MOTIF_CFD);
  const sans = src.replace(MOTIF_COMMENTAIRE, '').replace(MOTIF_CFD, '');
  const rien = (motif, motifCfd = motif) => ({ html: sans, pivots: null, pivotsCfd: null, motif, motifCfd });
  if (/PIVOTS : ES relevés sur Investing\.com/.test(sans)) return rien('déjà présents');
  const titre = sans.search(/<h2[^>]*>[^<]*zones à surveiller/i);
  if (titre < 0) return rien('section « zones à surveiller » introuvable');
  const finTable = sans.indexOf('</table>', titre);
  const suivant = sans.indexOf('<h2', titre + 3);
  if (finTable < 0 || (suivant >= 0 && finTable > suivant)) return rien('tableau de la section introuvable');
  // La ligne CLÔTURE doit EXISTER : absente, les contrôles de séance sauteraient sans
  // bruit. En n/d, elle existe : le contrôle concerné passe (ES) ou refuse (CFD).
  if (!/>\s*CLÔTURE\s*<\/td>/i.test(sans)) return rien('ligne « CLÔTURE » introuvable dans le tableau');

  // ES : relevé du modèle, contrôlé.
  let es = null, motif = null;
  if (!lu) motif = 'commentaire PIVOTS-ES absent du brief';
  else if (lu.nd) motif = `relevé en ${lu.nd}`;
  else if (!lu.echelle || !/^journali/i.test(lu.echelle)) motif = `échelle « ${lu.echelle || 'non dite'} », journalière attendue`;
  else {
    const ctl = controlerPivots(lu.valeurs, valeurES(sans, 'CLÔTURE'));
    if (ctl.ok) es = { ...lu.valeurs, haut: ctl.haut, bas: ctl.bas, cloture: ctl.cloture, page: lu.page };
    else motif = ctl.motif;
  }
  // CFD : calcul du code, contrôlé contre la clôture publiée.
  const c = pivotsCfd(mCfd ? mCfd[1] : null, valeurCFD(sans, 'CLÔTURE'));

  if (!es && !c.pv) return rien(motif, c.motif);
  const iNiv = sans.slice(titre, finTable).search(/Niveaux psychologiques/i);
  const avant = iNiv >= 0 ? sans.lastIndexOf('<tr', titre + iNiv) : finTable;
  let out = sans.slice(0, avant) + lignesPivots(es, c.pv).trimStart() + '\n  ' + sans.slice(avant);
  const finTable2 = out.indexOf('</table>', titre) + '</table>'.length;
  out = out.slice(0, finTable2) + '\n' + MENTION + out.slice(finTable2).replace(/^\n/, '');
  return { html: out, pivots: es, pivotsCfd: c.pv, motif, motifCfd: c.motif };
}
