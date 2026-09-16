// ========================================================================
// Les sources de marché, appelées par du CODE.
//
// POURQUOI CE FICHIER EXISTE. Jusqu'ici tous les chiffres du brief étaient collectés
// par le modèle via WebSearch/WebFetch. Un modèle qui lit une page rend TOUJOURS une
// valeur plausible : mauvais champ, page modifiée, contrat qui vient de rouler, il ne
// plante pas, il produit un nombre crédible. Un appel de code échoue bruyamment.
//
// ⚠️ CHAQUE SOURCE ICI A ÉTÉ ÉPROUVÉE DEPUIS UN RUNNER GITHUB, pas depuis une machine
// de développement et pas d'après sa documentation. Les adresses des runners ne sont
// pas traitées comme celles de Vercel ni comme une adresse résidentielle, et vingt
// candidats sur vingt-trois ont été écartés sur ce seul critère. Le détail des refus
// est dans `outils/sonder-sources.mjs` et dans la PR qui l'accompagne.
//
// Ce qui a été REFUSÉ, et qu'il ne faut pas réessayer sans nouvelle mesure :
//   - Yahoo Finance : 429 sur les trois essais, depuis le runner comme depuis Vercel
//     et Supabase. Le blocage n'est pas propre à l'hébergeur.
//   - CME Group, y compris ses fichiers de règlement : 403 « suspected web scraping ».
//   - Investing.com : SEPT portes essayées, sept fois 403 ou challenge Cloudflare —
//     la page historique, l'API financialdata, la voie héritée HistoricalDataAjax, les
//     flux de graphique tvc4 et tvc6, l'ancien domaine forexpros. C'est le point
//     important, et il mérite d'être dit sans ambiguïté : le MODÈLE sait lire
//     Investing par WebFetch, depuis l'infrastructure d'Anthropic ; le CODE lit depuis
//     le runner GitHub, et n'y arrive par aucune porte. Que le SPX et le VIX en
//     soient sortis justes dix fois sur dix ne prouve donc rien sur l'accès du code :
//     ces valeurs-là étaient lues par le modèle, et elles viennent aujourd'hui de Cboe.
//   - Stooq, Barchart, WSJ, EODHD, stockanalysis : page anti-robot, 401 ou 403.
// ========================================================================

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DELAI_MS = 20000;

/**
 * Un appel HTTP qui échoue FRANCHEMENT.
 *
 * Pas de valeur de repli, pas de « on verra plus tard » : soit on obtient le corps,
 * soit on lève une erreur dont le message dit exactement ce qui s'est passé. C'est
 * toute la différence avec la collecte par le modèle, et c'est la raison d'être de ce
 * module. Le message d'erreur sert à l'humain qui lira l'alerte Discord ; AUCUNE
 * logique de ce fichier ne branche sur son contenu.
 */
async function obtenir(url, options = {}) {
  // Une reprise BORNÉE sur 429 et 5xx. Cboe limite le débit : le fichier historique
  // fait 1,7 Mo et dix appels rapprochés le font basculer en 429 pendant une bonne
  // minute. Ce n'est pas une panne de la source, c'est une politesse qu'on lui doit —
  // et c'est le test de déterminisme qui l'a révélé, en s'infligeant lui-même le
  // blocage qu'il croyait mesurer.
  //
  // Les attentes sont MESURÉES et non choisies au hasard : une fois le débit bloqué,
  // Cboe répond encore 429 à 5 s et à 10 s, et repasse en 200 à 20 s. Une reprise à
  // deux essais rapprochés serait donc tombée dans le trou à chaque fois.
  //
  // ⚠️ LA REPRISE NE MASQUE RIEN. Après ses essais, elle relève l'erreur avec le code
  // réel : un blocage durable reste un échec, il n'est pas maquillé en valeur.
  const ATTENTES = [0, 3000, 9000, 20000];
  let derniere;
  for (const attente of ATTENTES) {
    if (attente) await new Promise((r) => setTimeout(r, attente));
    try { return await obtenirUneFois(url, options); }
    catch (e) {
      derniere = e;
      if (!/^HTTP (429|5\d\d)$/.test(e.message)) throw e;   // seules ces causes se reprennent
    }
  }
  throw new Error(`${derniere.message} après ${ATTENTES.length} tentatives`);
}

async function obtenirUneFois(url, options = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: options.post ? 'POST' : 'GET',
      headers: { 'user-agent': UA, accept: '*/*', ...(options.post ? { 'content-type': 'application/json' } : {}) },
      body: options.post,
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch (e) {
    throw new Error(`réseau injoignable (${e.name === 'TimeoutError' ? `pas de réponse en ${DELAI_MS} ms` : e.message})`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const txt = await r.text();
  if (!txt) throw new Error('réponse vide');
  // Une page anti-robot arrive en HTTP 200. Sans ce contrôle, le code croirait avoir
  // réussi et échouerait plus loin, sur un message qui ne dirait plus pourquoi.
  if (/^\s*</.test(txt) && /noscript|Just a moment|challenge|captcha/i.test(txt.slice(0, 2000))) {
    throw new Error('page anti-robot renvoyée en HTTP 200');
  }
  return txt;
}

const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── SPX comptant, source Cboe ─────────────────────────────────────────────────────
//
// Cboe publie et calcule l'indice : c'est la source de premier rang, pas un
// intermédiaire. Le cadran différé porte l'OHLC de la séance ET la clôture de la
// veille, ce qui permet de recouper la variation sans la calculer de tête.
//
// Le brief part à 18h43 à New York, soit près de trois heures après la clôture du
// comptant : les quatre champs décrivent donc une séance TERMINÉE. C'est ce qui rend
// le SPX facile et l'ES difficile — voir plus bas.
export async function spxCboe() {
  const txt = await obtenir('https://cdn.cboe.com/api/global/delayed_quotes/quotes/_SPX.json');
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error('JSON illisible'); }
  const d = j?.data;
  if (!d) throw new Error('champ « data » absent');
  const v = {
    ouverture: nombre(d.open), haut: nombre(d.high), bas: nombre(d.low),
    cloture: nombre(d.close), clotureVeille: nombre(d.prev_day_close),
    horodatage: j.timestamp || null,
  };
  for (const [k, x] of Object.entries(v)) {
    if (k !== 'horodatage' && x === null) throw new Error(`champ « ${k} » absent ou non numérique`);
  }
  return { ...v, source: 'Cboe (cdn.cboe.com, cadran différé _SPX)', symbole: '^SPX' };
}

// ── VIX, source Cboe ──────────────────────────────────────────────────────────────
//
// Même raison : le VIX est un indice Cboe. Le fichier historique porte l'OHLC de
// chaque séance depuis 1990 et se lit par DATE, ce qui évite la question « est-ce la
// séance d'aujourd'hui ou celle d'hier ? » : on demande une date, on obtient sa ligne
// ou rien du tout.
export async function vixCboe(dateIso) {
  const txt = await obtenir('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv');
  const lignes = txt.split('\n');
  if (!/^DATE,OPEN,HIGH,LOW,CLOSE/i.test(lignes[0] || '')) {
    throw new Error(`en-tête CSV inattendu : « ${(lignes[0] || '').slice(0, 60)} »`);
  }
  const [a, m, j] = dateIso.split('-');
  const cle = `${m}/${j}/${a}`;
  const ligne = lignes.find((l) => l.startsWith(cle + ','));
  if (!ligne) throw new Error(`aucune ligne datée du ${cle} dans le fichier Cboe`);
  const c = ligne.split(',').map(Number);
  if (c.slice(1, 5).some((x) => !Number.isFinite(x))) throw new Error(`ligne du ${cle} non numérique`);
  return { ouverture: c[1], haut: c[2], bas: c[3], cloture: c[4],
           source: 'Cboe (VIX_History.csv, ligne datée)', symbole: '^VIX' };
}

// ── ES, source TradingView, CONTRAT NOMMÉ ─────────────────────────────────────────
//
// ⚠️ LE CONTRAT EST DANS LA REQUÊTE, pas déduit d'un ticker générique. L'incident du
// 14/09 vient de là : le brief a publié la clôture d'ESU26 alors que le front-month
// était passé à ESZ26, soit 68 points d'écart sur un chiffre que des élèves utilisent
// pour poser leurs niveaux. Ici le symbole est `CME_MINI:ESZ2026` et la réponse porte
// en plus `expiration` et `description` : le code VÉRIFIE qu'il a bien le contrat
// demandé au lieu de l'espérer.
//
// ⚠️ ET SURTOUT — LA CLÔTURE N'EST PAS LE CHAMP `close`. À l'heure du brief, 18h43 à
// New York, le Globex a rouvert depuis quarante-trois minutes : `close` est le prix de
// la séance NOUVELLE, `high` et `low` couvrent ces quarante-trois minutes. Prendre
// `close` pour une clôture est exactement l'erreur que ce module doit rendre
// impossible. La clôture de la séance réglée s'obtient par `close - change_abs`,
// puisque la variation est calculée par TradingView contre la bougie journalière
// précédente. C'est vérifiable : le 16/09 ce calcul rendait 7 656,00, la valeur même
// que le champ « Prev. Close » d'Investing affichait ce matin-là.
//
// Ce que ce module NE PEUT PAS rendre à l'heure du brief : le haut et le bas de la
// séance réglée. Aucune source éprouvée ne les donne à 18h43. Ils sortent donc en n/d
// avec ce motif, sauf si l'instantané de 17h05 les a déposés (cf. marche-cloture.yml).
export async function esTradingView(contrat) {
  if (!/^ES[FGHJKMNQUVXZ]\d{4}$/.test(contrat)) {
    throw new Error(`contrat mal formé : « ${contrat} » (attendu ESZ2026 et compagnie)`);
  }
  const champs = 'close,open,high,low,change_abs,change,expiration,description,update_mode,volume';
  const txt = await obtenir(
    `https://scanner.tradingview.com/symbol?symbol=CME_MINI%3A${contrat}&fields=${champs}&no_404=true`);
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error('JSON illisible'); }
  const close = nombre(j.close);
  const varAbs = nombre(j.change_abs);
  if (close === null) throw new Error('champ « close » absent');
  if (varAbs === null) throw new Error('champ « change_abs » absent — la clôture veille n\'est pas calculable');
  if (!j.description) throw new Error('champ « description » absent — contrat non vérifiable');
  return {
    clotureVeille: Number((close - varAbs).toFixed(2)),
    prixCourant: close,
    hautCourant: nombre(j.high), basCourant: nombre(j.low),
    expiration: j.expiration ?? null,
    libelle: j.description,
    modeMaj: j.update_mode || null,
    contrat,
    source: `TradingView (scanner.tradingview.com, CME_MINI:${contrat})`,
  };
}

// ── Le front-month ES, calculé et non deviné ──────────────────────────────────────
//
// Les ES trimestriels (mars H, juin M, septembre U, décembre Z) expirent le troisième
// vendredi du mois d'échéance. Le roulement du volume se fait huit jours avant, le
// jeudi précédent. La règle est écrite ici parce qu'elle est VÉRIFIABLE : la réponse
// de TradingView porte la date d'expiration, et le collecteur compare.
export function contratFrontMonth(dateIso) {
  const [a, m, j] = dateIso.split('-').map(Number);
  const jour = Date.UTC(a, m - 1, j);
  const CODES = { 3: 'H', 6: 'M', 9: 'U', 12: 'Z' };
  for (let n = 0; n < 5; n++) {
    const annee = a + Math.floor((m - 1 + n * 3) / 12);
    const mois = ((m - 1 + n * 3) % 12) + 1;
    const moisTrim = [3, 6, 9, 12].find((x) => x >= mois) ?? 3;
    const anneeTrim = moisTrim < mois ? annee + 1 : annee;
    // Troisième vendredi : le premier vendredi tombe entre le 1 et le 7.
    const premier = new Date(Date.UTC(anneeTrim, moisTrim - 1, 1)).getUTCDay();
    const premierVendredi = 1 + ((5 - premier + 7) % 7);
    const expiration = Date.UTC(anneeTrim, moisTrim - 1, premierVendredi + 14);
    const bascule = expiration - 8 * 86400000;
    if (jour < bascule) {
      return { contrat: `ES${CODES[moisTrim]}${anneeTrim}`,
               expirationIso: new Date(expiration).toISOString().slice(0, 10),
               basculeIso: new Date(bascule).toISOString().slice(0, 10) };
    }
  }
  throw new Error(`front-month introuvable pour ${dateIso}`);
}


// ── HISTORIQUE DATÉ, source Cboe ──────────────────────────────────────────────────
//
// C'est la trouvaille qui change le tableau. Le fichier `SPX_History.csv` ne porte que
// les clôtures — c'est sur cette base que les hauts et bas de semaine avaient été
// déclarés indisponibles. Mais Cboe sert aussi un historique de GRAPHIQUE, sur un
// autre chemin, et celui-là porte l'OHLC complet de chaque séance depuis 1975.
//
// Conséquence directe : les hauts et bas de séance ET de semaine du comptant sont
// disponibles immédiatement, par date, sans rien attendre d'un prélèvement.
// Mémorisé par PROCESSUS. Une collecte demande la séance puis la semaine : sans cache,
// c'est deux fois 1,7 Mo par symbole, quatre téléchargements pour un seul brief. La
// durée de vie est courte à dessein — le brief ne tourne qu'une fois par jour, il
// repart donc toujours d'une lecture fraîche ; seuls les outils qui enchaînent les
// collectes en profitent.
const CACHE = new Map();
const CACHE_MS = 15 * 60 * 1000;

async function historiqueCboe(symbole) {
  const garde = CACHE.get(symbole);
  if (garde && Date.now() - garde.a < CACHE_MS) return garde.v;
  const v = await historiqueCboeFrais(symbole);
  CACHE.set(symbole, { v, a: Date.now() });
  return v;
}

/** Vider le cache : utilisé par le test de déterminisme, qui doit VRAIMENT relire. */
export function viderCacheMarche() { CACHE.clear(); }

async function historiqueCboeFrais(symbole) {
  const txt = await obtenir(`https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/${symbole}.json`);
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error('JSON illisible'); }
  if (!Array.isArray(j?.data) || j.data.length === 0) throw new Error('tableau « data » absent ou vide');
  const parDate = new Map();
  for (const r of j.data) {
    const o = Number(r.open), h = Number(r.high), b = Number(r.low), c = Number(r.close);
    if ([o, h, b, c].every(Number.isFinite)) parDate.set(r.date, { ouverture: o, haut: h, bas: b, cloture: c });
  }
  return { parDate, derniere: j.data.at(-1)?.date || null,
           source: `Cboe (charts/historical/${symbole}.json, lignes datées)` };
}

/** L'OHLC d'une séance DONNÉE. Une date absente est une absence, jamais une approximation. */
export async function seanceCboe(symbole, dateIso) {
  const h = await historiqueCboe(symbole);
  const l = h.parDate.get(dateIso);
  if (!l) throw new Error(`aucune ligne datée du ${dateIso} (dernière disponible : ${h.derniere})`);
  return { ...l, date: dateIso, source: h.source };
}

/**
 * Le haut et le bas d'une PLAGE de séances — la semaine en cours du brief.
 *
 * La semaine est comptée du lundi à la séance de référence incluse, et JAMAIS au-delà :
 * publier un haut de semaine qui engloberait une séance postérieure à celle du brief
 * serait le même défaut de date que celui qu'on corrige sur la clôture.
 */
export async function semaineCboe(symbole, seanceIso) {
  const h = await historiqueCboe(symbole);
  const [a, m, j] = seanceIso.split('-').map(Number);
  const fin = Date.UTC(a, m - 1, j);
  const jourSemaine = new Date(fin).getUTCDay();          // 0 = dimanche
  const debut = fin - ((jourSemaine + 6) % 7) * 86400000; // lundi de la même semaine
  const dans = [];
  for (let t = debut; t <= fin; t += 86400000) {
    const l = h.parDate.get(new Date(t).toISOString().slice(0, 10));
    if (l) dans.push(l);
  }
  if (dans.length === 0) throw new Error(`aucune séance entre le lundi et le ${seanceIso}`);
  return {
    haut: Math.max(...dans.map((l) => l.haut)),
    bas: Math.min(...dans.map((l) => l.bas)),
    seances: dans.length,
    debutIso: new Date(debut).toISOString().slice(0, 10),
    source: h.source,
  };
}

// ── ES, source CNBC, CONTRAT NOMMÉ, RÈGLEMENT DATÉ ────────────────────────────────
//
// La source qui règle le problème des n/d. Elle rend, pour le contrat nommé :
//
//   settlePrice + settleDate  → le prix de RÈGLEMENT, avec sa date. Pas un « dernier
//                               prix » qu'il faudrait interpréter : le règlement, daté.
//   previous_day_closing      → la clôture de la veille, calculée autrement par le
//                               même fournisseur.
//   expiration_date, shortName → de quoi VÉRIFIER le contrat au lieu de l'espérer.
//   curmktstatus              → l'état du marché, pour savoir si la séance est close.
//
// Les deux premiers champs sont les DEUX CHEMINS du croisement interne réclamé par les
// coachs. Leur idée portait sur Investing, que le code ne peut pas atteindre ; le
// principe, lui, s'applique mieux ici — parce que `settleDate` rend la date EXPLICITE
// au lieu de la faire déduire d'une ligne de tableau.
export async function esCnbc(contrat) {
  if (!/^ES[FGHJKMNQUVXZ]\d{2}$/.test(contrat)) {
    throw new Error(`contrat mal formé pour CNBC : « ${contrat} » (attendu ESZ26 et compagnie)`);
  }
  const txt = await obtenir('https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol'
    + `?symbols=${contrat}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`);
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error('JSON illisible'); }
  const q = j?.FormattedQuoteResult?.FormattedQuote?.[0];
  if (!q) throw new Error('cotation absente de la réponse');
  // `code` non nul = symbole inconnu. CNBC répond 200 dans ce cas : sans ce contrôle,
  // un contrat mal orthographié passerait pour une source muette au lieu d'une erreur.
  if (q.code !== 0) throw new Error(`symbole « ${contrat} » refusé par CNBC (code ${q.code})`);
  const nb = (v) => { const x = Number(String(v ?? '').replace(/[ ,\u202f\u00a0]/g, '')); return Number.isFinite(x) ? x : null; };
  return {
    contrat,
    libelle: q.shortName || q.altName || null,
    reglement: nb(q.settlePrice), dateReglement: q.settleDate || null,
    clotureVeille: nb(q.previous_day_closing),
    prixCourant: nb(q.last), hautCourant: nb(q.high), basCourant: nb(q.low),
    expirationIso: q.expiration_date || null,
    etatMarche: q.curmktstatus || null,
    source: `CNBC (quote.cnbc.com, ${contrat})`,
  };
}

/** Le code CNBC du contrat : ESZ26 là où TradingView écrit ESZ2026. */
export const codeCnbc = (contratTv) => contratTv.replace(/^ES([FGHJKMNQUVXZ])\d{2}(\d{2})$/, 'ES$1$2');
