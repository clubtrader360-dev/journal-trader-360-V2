// ========================================================================
// « SUR LES MARCHÉS HIER » : six lignes, plus le VIX, fournies par le CODE (brief v22).
//
// ── LA RÈGLE (Manu, 27/11/2026, remplace celle des deux sources concordantes) ────────
// Chaque valeur a UNE source principale, la plus fiable, et UNE source de secours.
// La principale fait foi : clôture ET clôture précédente (donc la variation) viennent
// d'elle. Si elle ne répond pas ou ne donne pas la séance demandée (ou pas la veille),
// les deux viennent de la source de secours, pour que la variation reste cohérente.
// Plus aucune comparaison entre sources, plus de tolérance, plus de « désaccord ».
// En dernier recours seulement (aucune des deux n'a les deux nombres), la clôture et
// la veille sont prises chacune là où elles existent.
//
// ── LA DATE EST CONTRÔLÉE, PAS SUPPOSÉE ─────────────────────────────────────────
// Chaque source rend une SÉRIE DATÉE (date de séance → clôture), et on y lit la date
// attendue pour SA place (calendriers.js). Une source qui ne connaît pas la séance
// attendue ne rend rien pour elle : elle ne peut pas glisser la séance d'avant.
// Une séance du jour même n'est lue qu'une fois la place fermée (`seanceClose`).
//
// ── ⛔ JAMAIS UNE VALEUR INVENTÉE ───────────────────────────────────────────────
// Une valeur que NI la principale NI le secours ne donnent sort avec `nd: true`, son
// motif et les deux sources essayées. Le workflow relance la collecte toutes les dix
// minutes ; à la coupure (6h05, envoi au plus tard 6h45), elle part en « n/d ».
//
// Sources retenues après sonde du 27/11/2026 (CNBC, TradingView, Coinbase et Bitstamp
// répondent aussi depuis le runner, sonde du 26/11) :
// CNBC en principale (barres journalières DATÉES, concorde avec FT sur l'OAT du 26/11),
// TradingView en secours (barres datées, clôture et veille) ; Bitcoin : Coinbase puis
// Bitstamp (bougies UTC). FT, Nasdaq.com, Börse Frankfurt, Kraken et Cboe ne servent
// plus (FT sans veille datée, Börse Frankfurt rendait la clôture du jour comme veille,
// Cboe en 403 depuis le 20/11) ; leurs lecteurs restent pour les sondes.
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

// ── LES SEPT VALEURS : [source principale, source de secours] ─────────────────────

export function instruments() {
  return [
    { cle: 'spx', nom: 'S&P 500', place: 'US', unite: 'pct',
      sources: [cnbcJournalier('.SPX'), tradingView('SP:SPX', 'US')] },
    { cle: 'nasdaq', nom: 'Nasdaq', place: 'US', unite: 'pct',
      sources: [cnbcJournalier('.IXIC'), tradingView('NASDAQ:IXIC', 'US')] },
    { cle: 'dax', nom: 'DAX', place: 'DE', unite: 'pct',
      sources: [cnbcJournalier('.GDAXI'), tradingView('XETR:DAX', 'DE')] },
    { cle: 'cac', nom: 'CAC 40', place: 'FR', unite: 'pct',
      sources: [cnbcJournalier('.FCHI'), tradingView('EURONEXT:PX1', 'FR')] },
    { cle: 'oat', nom: 'OAT France 10 ans', place: 'FR', unite: 'pt',
      sources: [cnbcJournalier('FR10Y-FR'), tradingView('TVC:FR10Y', 'FR')] },
    { cle: 'btc', nom: 'Bitcoin', place: 'BTC', unite: 'pct',
      sources: [coinbase(), bitstamp()] },
    { cle: 'vix', nom: 'VIX', place: 'US', unite: 'pct',
      sources: [cnbcJournalier('.VIX'), tradingView('CBOE:VIX', 'US')] },
  ];
}

const nombre = (x) => typeof x === 'number' && Number.isFinite(x);

/**
 * Une valeur : la source principale, puis la source de secours si la principale ne
 * donne pas la clôture de la séance attendue ET celle de la séance précédente.
 */
export async function collecterInstrument(inst, dateBrief, maintenant = new Date()) {
  const seance = derniereSeance(inst.place, dateBrief);
  const precedente = seanceAvant(inst.place, seance);
  const base = { cle: inst.cle, nom: inst.nom, place: inst.place, seance, precedenteSeance: precedente };
  const publier = (c, p, sources, essais) => ({ ...base, nd: false, cloture: c, precedente: p, unite: inst.unite, sources, essais,
    variation: inst.unite === 'pt' ? Math.round((c - p) * 100) / 100 : Math.round(((c / p) - 1) * 10000) / 100 });
  const essais = [];
  for (const [rang, s] of inst.sources.entries()) {
    const lu = { nom: s.nom, role: rang === 0 ? 'principale' : 'secours' };
    try {
      const m = await s.serie({ seance });
      for (const d of [...m.keys()]) if (!seanceClose(inst.place, d, maintenant)) m.delete(d);
      const c = m.get(seance), p = m.get(precedente);
      if (nombre(c)) lu.cloture = c;
      if (nombre(p)) lu.precedente = p;
      lu.statut = !nombre(c) ? `aucune clôture datée du ${seance}`
        : !nombre(p) ? `clôture du ${seance} = ${c}, mais aucune clôture datée du ${precedente}` : 'ok';
    } catch (e) {
      lu.statut = `muette (${e.message})`;
    }
    essais.push(lu);
    if (lu.statut === 'ok') return publier(lu.cloture, lu.precedente, [{ nom: lu.nom, role: lu.role, cloture: lu.cloture, precedente: lu.precedente }], essais);
  }
  // Dernier recours : clôture et veille prises chacune là où elles existent.
  const c = essais.find((x) => nombre(x.cloture)), p = essais.find((x) => nombre(x.precedente));
  if (c && p) {
    return publier(c.cloture, p.precedente, [{ nom: c.nom, role: c.role, cloture: c.cloture }, { nom: p.nom, role: p.role, precedente: p.precedente }], essais);
  }
  const motif = c
    ? `${inst.nom} : clôture du ${seance} trouvée, mais ni la source principale ni la source de secours ne donnent la clôture du ${precedente}`
    : `${inst.nom} : ni la source principale ni la source de secours ne donnent la séance du ${seance}`;
  return { ...base, nd: true, motif, essais };
}

/** Les sept valeurs. Rend un objet indexé par clé. */
export async function collecterHier(dateBrief, { maintenant = new Date(), liste = instruments() } = {}) {
  const r = {};
  for (const inst of liste) r[inst.cle] = await collecterInstrument(inst, dateBrief, maintenant);
  return r;
}
