// ========================================================================
// « SUR LES MARCHÉS HIER » : six lignes, plus le VIX, fournies par le CODE (brief v22).
//
// ── LA RÈGLE (Manu, 26/11/2026) ─────────────────────────────────────────────────
// Chaque valeur, clôture ET clôture précédente (donc la variation), est publiée quand
// DEUX sources indépendantes concordent :
//   indices (S&P 500, Nasdaq, DAX, CAC 40, VIX) : écart relatif ≤ 0,05 %
//   OAT France 10 ans : écart ≤ 0,01 point
//   Bitcoin : écart relatif ≤ 0,5 %
// Les sources sont essayées DANS L'ORDRE de leur liste : on n'appelle la troisième que
// si les deux premières ne s'accordent pas (muette, mal datée ou contradictoire).
//
// ── LA DATE EST CONTRÔLÉE, PAS SUPPOSÉE ─────────────────────────────────────────
// Chaque source rend une SÉRIE DATÉE (date de séance → clôture), et on y lit la date
// attendue pour SA place (calendriers.js). Une source qui ne connaît pas la séance
// attendue ne rend rien pour elle : elle ne peut pas glisser la séance d'avant.
// Une séance du jour même n'est lue qu'une fois la place fermée (`seanceClose`).
//
// ── ⛔ JAMAIS UNE VALEUR INVENTÉE ───────────────────────────────────────────────
// Une valeur sans accord de deux sources sort avec `nd: true`, son motif et la liste
// des sources essayées. Le workflow relance la collecte toutes les dix minutes ; à la
// coupure (6h05, envoi au plus tard 6h45), elle part en « n/d » et l'alerte la nomme
// (règle du 26/11/2026 21h, brief-cycle.js). Une seule source ne la publie jamais.
//
// Sources éprouvées DEPUIS LE RUNNER GITHUB le 26/11/2026 (outils/sonder-sources-v22.mjs) :
// CNBC, TradingView, FT, API Nasdaq, Börse Frankfurt, Coinbase, Bitstamp, Kraken
// répondent ; Cboe répond 403 depuis le 20/11 (gardé en dernier, il peut revenir).
// ========================================================================
import { obtenir, seanceCboe } from './sources.js';
import { PLACES, derniereSeance, seanceAvant, estSeance, dateLocale } from './calendriers.js';

const nb = (v) => { const x = Number(String(v ?? '').replace(/[ ,%  ]/g, '')); return Number.isFinite(x) ? x : null; };
const json = (txt) => { try { return JSON.parse(txt); } catch { throw new Error('JSON illisible'); } };

// Heure locale à partir de laquelle la séance du jour est close (marge comprise).
const HEURE_CLOTURE = { US: 17, DE: 18, FR: 19, BTC: 24 };

/** La séance `dateIso` de la place est-elle CLOSE à l'instant `maintenant` ? */
export function seanceClose(place, dateIso, maintenant = new Date()) {
  const aujourdhui = dateLocale(place, maintenant.getTime());
  if (dateIso < aujourdhui) return true;
  if (dateIso > aujourdhui) return false;
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: PLACES[place].fuseau, hour: '2-digit', hourCycle: 'h23' }).format(maintenant));
  return h >= HEURE_CLOTURE[place];
}

// ── LES SOURCES : chacune rend une Map date → clôture ─────────────────────────────

const CNBC_CHART = '9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b';

/** CNBC, graphique journalier sur un mois : barres DATÉES (tradeTime AAAAMMJJ…). */
export function cnbcJournalier(symbole) {
  return {
    nom: `CNBC (graphique journalier ${symbole})`,
    async serie() {
      const url = 'https://webql-redesign.cnbcfm.com/graphql?operationName=getQuoteChartData'
        + `&variables=${encodeURIComponent(JSON.stringify({ symbol: symbole, timeRange: '1M' }))}`
        + `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: CNBC_CHART } }))}`;
      const j = json(await obtenir(url));
      if (j?.errors?.length) throw new Error(`GraphQL : ${j.errors.map((e) => e.message).join(' ; ').slice(0, 120)}`);
      const cd = j?.data?.chartData;
      if (cd?.symbol && cd.symbol !== symbole) throw new Error(`CNBC rend ${cd.symbol}, ${symbole} demandé`);
      const barres = cd?.priceBars;
      if (!Array.isArray(barres) || !barres.length) throw new Error('aucune barre journalière');
      // ⚠️ La DERNIÈRE barre peut être un récapitulatif mal daté (mesuré le 26/11 sur .SPX :
      // « 20261124 » portant la clôture du 25). On ne garde que les dates STRICTEMENT
      // croissantes : un récapitulatif qui recule dans le temps est écarté.
      const m = new Map();
      let prec = '';
      for (const b of barres) {
        const t = String(b.tradeTime || '');
        const d = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
        if (!(d > prec)) break;
        const c = nb(b.close);
        if (c !== null) m.set(d, c);
        prec = d;
      }
      return m;
    },
  };
}

/** TradingView, scanner : barre courante datée par `time`, barres précédentes par rang. */
export function tradingView(symbole, place) {
  return {
    nom: `TradingView (${symbole})`,
    async serie() {
      const champs = 'time,close,close[1],close[2],description';
      const j = json(await obtenir(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbole)}&fields=${champs}&no_404=true`));
      if (!j || !j.description) throw new Error('réponse vide ou symbole inconnu');
      if (typeof j.time !== 'number') throw new Error('champ « time » absent : barre non datable');
      let d = dateLocale(place, j.time * 1000);
      if (!estSeance(place, d)) throw new Error(`barre courante datée du ${d}, qui n'est pas une séance ${place}`);
      const m = new Map();
      for (const k of [0, 1, 2]) {
        const c = nb(j[k ? `close[${k}]` : 'close']);
        if (c !== null) m.set(d, c);
        d = seanceAvant(place, d);
      }
      return m;
    },
  };
}

/** FT markets, page de synthèse : prix, variation du jour, et « as of <date> ». */
export function ft(genre, symbole, place) {
  return {
    nom: `FT (${symbole})`,
    async serie() {
      const t = await obtenir(`https://markets.ft.com/data/${genre}/tearsheet/summary?s=${encodeURIComponent(symbole)}`);
      const lire = (lib) => (t.match(new RegExp(`${lib}</span><span class="mod-ui-data-list__value">(?:<[^>]*>)*([^<]*)`)) || [])[1];
      const prix = nb(genre === 'bonds' ? lire('Yield') : lire('Price \\([A-Z]+\\)'));
      const variation = nb(String(lire("Today's Change") || '').split('/')[0]);
      const quand = (t.match(/as of ([A-Z][a-z]{2} \d{1,2} \d{4} \d{1,2}:\d{2}) GMT/) || [])[1];
      if (prix === null) throw new Error('prix absent de la page');
      if (variation === null) throw new Error('variation du jour absente de la page');
      if (!quand) throw new Error('date « as of » absente de la page');
      const ms = Date.parse(`${quand} GMT`);
      if (!Number.isFinite(ms)) throw new Error(`date illisible « ${quand} »`);
      const d = dateLocale(place, ms);
      return new Map([[d, prix], [seanceAvant(place, d), Math.round((prix - variation) * 10000) / 10000]]);
    },
  };
}

/** API Nasdaq, historique DATÉ (Nasdaq Composite). */
export function nasdaqHistorique(symbole, maintenant) {
  return {
    nom: `Nasdaq.com (historique ${symbole})`,
    async serie() {
      const fin = maintenant.toISOString().slice(0, 10);
      const debut = new Date(maintenant.getTime() - 12 * 86400000).toISOString().slice(0, 10);
      const j = json(await obtenir(`https://api.nasdaq.com/api/quote/${symbole}/historical?assetclass=index&fromdate=${debut}&todate=${fin}&limit=20`));
      const rows = j?.data?.tradesTable?.rows;
      if (!Array.isArray(rows) || !rows.length) throw new Error(`historique vide (${j?.status?.bCodeMessage?.[0]?.errorMessage || 'sans motif'})`);
      const m = new Map();
      for (const r of rows) {
        const [mm, jj, aa] = String(r.date || '').split('/');
        const c = nb(r.close);
        if (aa && c !== null) m.set(`${aa}-${mm}-${jj}`, c);
      }
      return m;
    },
  };
}

/** Börse Frankfurt : dernier cours horodaté et clôture de la séance précédente. */
export function boerseFrankfurt(isin, place, maintenant) {
  return {
    nom: `Börse Frankfurt (${isin})`,
    async serie() {
      const j = json(await obtenir(`https://api.boerse-frankfurt.de/v1/data/price_information/single?isin=${isin}&mic=XETR`));
      const dernier = nb(j?.lastPrice), veille = nb(j?.closingPricePrevTradingDay);
      const ms = Date.parse(j?.timestampLastPrice || j?.timestamp || '');
      if (dernier === null || veille === null || !Number.isFinite(ms)) throw new Error('lastPrice, closingPricePrevTradingDay ou timestamp absent');
      const d = dateLocale(place, ms);
      const m = new Map([[seanceAvant(place, d), veille]]);
      if (seanceClose(place, d, maintenant)) m.set(d, dernier);
      return m;
    },
  };
}

/** Bougies journalières UTC d'une plateforme crypto. `lire(json)` → [[ms ouverture, clôture], …]. */
function bougiesCrypto(nom, url, lire) {
  return {
    nom,
    async serie() {
      const lignes = lire(json(await obtenir(url())));
      if (!Array.isArray(lignes) || !lignes.length) throw new Error('aucune bougie journalière');
      const m = new Map();
      for (const [ms, c] of lignes) if (Number.isFinite(ms) && c !== null) m.set(new Date(ms).toISOString().slice(0, 10), c);
      return m;
    },
  };
}
export const coinbase = () => bougiesCrypto('Coinbase (BTC-USD, bougies 1 j)',
  () => 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400',
  (j) => (Array.isArray(j) ? j.map((r) => [r[0] * 1000, nb(r[4])]) : null));
export const bitstamp = () => bougiesCrypto('Bitstamp (btcusd, bougies 1 j)',
  () => 'https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=6',
  (j) => j?.data?.ohlc?.map((r) => [Number(r.timestamp) * 1000, nb(r.close)]));
export const kraken = () => bougiesCrypto('Kraken (XBTUSD, bougies 1 j)',
  () => `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440&since=${Math.floor(Date.now() / 1000) - 8 * 86400}`,
  (j) => j?.result?.XXBTZUSD?.map((r) => [r[0] * 1000, nb(r[4])]));

/** Cboe, historique daté (S&P 500 comptant, VIX). Répond 403 au runner depuis le 20/11. */
export function cboe(symbole, place) {
  return {
    nom: `Cboe (historique ${symbole})`,
    async serie({ seance }) {
      const prec = seanceAvant(place, seance);
      const [a, b] = await Promise.all([seanceCboe(symbole, seance), seanceCboe(symbole, prec)]);
      return new Map([[seance, a.cloture], [prec, b.cloture]]);
    },
  };
}

/** Cboe, fichier CSV quotidien de l'indice (VIX_History.csv) : DATE,OPEN,HIGH,LOW,CLOSE. */
export function cboeCsv(indice) {
  return {
    nom: `Cboe (CSV quotidien ${indice})`,
    async serie() {
      const t = await obtenir(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${indice}_History.csv`);
      const lignes = t.trim().split(/\r?\n/).slice(-15);
      const m = new Map();
      for (const l of lignes) {
        const [d, , , , c] = l.split(',');
        const [mm, jj, aa] = String(d).split('/');
        if (aa && nb(c) !== null) m.set(`${aa}-${mm.padStart(2, '0')}-${jj.padStart(2, '0')}`, nb(c));
      }
      if (!m.size) throw new Error('CSV sans ligne lisible');
      return m;
    },
  };
}

// ── LES SEPT VALEURS ET LEURS SOURCES ORDONNÉES ────────────────────────────────────

const REL = (x) => ({ type: 'relative', valeur: x });
const ABS = (x) => ({ type: 'absolue', valeur: x });

export function instruments(maintenant = new Date()) {
  return [
    { cle: 'spx', nom: 'S&P 500', place: 'US', tolerance: REL(0.0005), unite: 'pct',
      sources: [cnbcJournalier('.SPX'), tradingView('SP:SPX', 'US'), ft('indices', 'INX:IOM', 'US'), cboe('_SPX', 'US')] },
    { cle: 'nasdaq', nom: 'Nasdaq', place: 'US', tolerance: REL(0.0005), unite: 'pct',
      sources: [cnbcJournalier('.IXIC'), tradingView('NASDAQ:IXIC', 'US'), nasdaqHistorique('COMP', maintenant)] },
    { cle: 'dax', nom: 'DAX', place: 'DE', tolerance: REL(0.0005), unite: 'pct',
      sources: [cnbcJournalier('.GDAXI'), tradingView('XETR:DAX', 'DE'), boerseFrankfurt('DE0008469008', 'DE', maintenant), ft('indices', 'DAX:GER', 'DE')] },
    { cle: 'cac', nom: 'CAC 40', place: 'FR', tolerance: REL(0.0005), unite: 'pct',
      sources: [cnbcJournalier('.FCHI'), tradingView('EURONEXT:PX1', 'FR'), ft('indices', 'CAC:PAR', 'FR')] },
    { cle: 'oat', nom: 'OAT France 10 ans', place: 'FR', tolerance: ABS(0.01), unite: 'pt',
      sources: [cnbcJournalier('FR10Y-FR'), tradingView('TVC:FR10Y', 'FR'), ft('bonds', 'FR10YT=RR', 'FR')] },
    { cle: 'btc', nom: 'Bitcoin', place: 'BTC', tolerance: REL(0.005), unite: 'pct',
      sources: [coinbase(), bitstamp(), kraken(), tradingView('BITSTAMP:BTCUSD', 'BTC')] },
    { cle: 'vix', nom: 'VIX', place: 'US', tolerance: REL(0.0005), unite: 'pct',
      sources: [cnbcJournalier('.VIX'), tradingView('CBOE:VIX', 'US'), cboeCsv('VIX'), cboe('_VIX', 'US')] },
  ];
}

const accord = (a, b, t) => (t.type === 'absolue'
  ? Math.abs(a - b) <= t.valeur + 1e-9
  : Math.abs(a - b) <= t.valeur * Math.max(Math.abs(a), Math.abs(b)) + 1e-9);

/**
 * Une valeur : sources essayées dans l'ordre, publiée au premier ACCORD de deux sources
 * sur la clôture de la séance attendue ET sur la clôture précédente.
 */
export async function collecterInstrument(inst, dateBrief, maintenant = new Date()) {
  const seance = derniereSeance(inst.place, dateBrief);
  const precedente = seanceAvant(inst.place, seance);
  const essais = [];
  const valides = [];
  for (const s of inst.sources) {
    let lu;
    try {
      const m = await s.serie({ seance });
      for (const d of [...m.keys()]) if (!seanceClose(inst.place, d, maintenant)) m.delete(d);
      const c = m.get(seance), p = m.get(precedente);
      if (typeof c !== 'number') lu = { nom: s.nom, statut: `aucune clôture datée du ${seance}` };
      else if (typeof p !== 'number') lu = { nom: s.nom, statut: `clôture du ${seance} = ${c}, mais aucune clôture datée du ${precedente}` };
      else lu = { nom: s.nom, statut: 'ok', cloture: c, precedente: p };
    } catch (e) {
      lu = { nom: s.nom, statut: `muette (${e.message})` };
    }
    essais.push(lu);
    if (lu.statut !== 'ok') continue;
    for (const v of valides) {
      const okC = accord(v.cloture, lu.cloture, inst.tolerance);
      const okP = accord(v.precedente, lu.precedente, inst.tolerance);
      if (okC && okP) {
        const variation = inst.unite === 'pt'
          ? Math.round((v.cloture - v.precedente) * 100) / 100
          : Math.round(((v.cloture / v.precedente) - 1) * 10000) / 100;
        return { cle: inst.cle, nom: inst.nom, place: inst.place, seance, precedenteSeance: precedente,
                 nd: false, cloture: v.cloture, precedente: v.precedente, variation, unite: inst.unite,
                 sources: [v, lu].map((x) => ({ nom: x.nom, cloture: x.cloture, precedente: x.precedente })), essais };
      }
      lu.statut = `en désaccord avec ${v.nom} (${lu.cloture} contre ${v.cloture}, veille ${lu.precedente} contre ${v.precedente})`;
    }
    valides.push(lu);
    if (lu.statut !== 'ok') lu.statut = `ok, mais ${lu.statut}`;
  }
  const motif = valides.length
    ? `${inst.nom} : aucune paire de sources concordantes pour la séance du ${seance}`
    : `${inst.nom} : aucune source n'a rendu la séance du ${seance}`;
  return { cle: inst.cle, nom: inst.nom, place: inst.place, seance, precedenteSeance: precedente, nd: true, motif, essais };
}

/** Les sept valeurs. Rend un objet indexé par clé. */
export async function collecterHier(dateBrief, { maintenant = new Date(), liste = instruments(maintenant) } = {}) {
  const r = {};
  for (const inst of liste) r[inst.cle] = await collecterInstrument(inst, dateBrief, maintenant);
  return r;
}
