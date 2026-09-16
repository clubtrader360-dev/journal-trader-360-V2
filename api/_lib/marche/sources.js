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
//   - Investing.com, en direct comme via un relais de texte : challenge Cloudflare.
//     C'est le point important — le MODÈLE sait lire Investing, le CODE ne peut pas.
//     Reprendre la même source en la passant au code était l'idée évidente ; elle est
//     mesurément impossible.
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
