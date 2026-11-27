// ========================================================================
// « ZONES À SURVEILLER » DU BRIEF V22 : ES et CFD, calculés par le CODE.
//
// Même règle que « Sur les marchés hier » (hier.js, Manu 27/11/2026) : UNE source
// principale, UNE source de secours, aucune comparaison entre elles. La séance est
// contrôlée (barre datée de la séance attendue) et la barre doit être cohérente
// (haut ≥ clôture ≥ bas) ; sinon, la source de secours. « n/d » seulement si les deux
// manquent, jamais une valeur inventée.
//   ES  : haut, bas et règlement de la séance réglée du contrat front-month.
//         Principale CNBC (barres journalières du contrat) · secours TradingView
//         (barres du MÊME contrat, datées au jour de cotation Globex).
//   CFD : haut, bas et clôture du S&P 500 comptant.
//         Principale CNBC (.SPX) · secours TradingView (SP:SPX).
// Pivots classiques calculés sur ces trois nombres (pivots.js, vérifiés le 26/11/2026
// contre la référence v22 : ES P 7 134,08, CFD P 7 117,40).
// POC : barres 1 minute CNBC du contrat, SANS source de secours. Aucun autre fournisseur
// public ne donne les minutes ES avec volume, et les barres de 5 minutes de CNBC rendent
// un autre POC (mesuré le 27/11 sur la séance du 25 : 7 022,75 contre 7 203,25, deux
// zones de volume, la taille des barres fait basculer de l'une à l'autre). Un POC faux
// ne vaut pas mieux qu'un POC inventé : sans minutes CNBC, « n/d ».
// Contrôles internes gardés (couverture, volume) ; la fourchette et le règlement ne
// servent de contrôle que s'ils viennent de CNBC aussi (pas de comparaison entre sources).
// ========================================================================
import { obtenir, contratFrontMonth, codeCnbc, esMinutesCnbc, seanceCboe } from './sources.js';
import { derniereSeance, seanceAvant, seanceApres, estSeance, dateLocale } from './calendriers.js';
import { seanceClose } from './hier.js';
import { calculerPivots } from '../pivots.js';
import { pocControle } from './poc.js';

const nb = (v) => { const x = Number(v); return Number.isFinite(x) && v !== null && v !== '' ? x : null; };
const json = (t) => { try { return JSON.parse(t); } catch { throw new Error('JSON illisible'); } };
const CNBC_CHART = '9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b';

/** CNBC, barres journalières datées → Map date → {haut, bas, cloture}. */
export function cnbcOhlc(symbole) {
  return {
    nom: `CNBC (barres journalières ${symbole})`,
    async serie() {
      const url = 'https://webql-redesign.cnbcfm.com/graphql?operationName=getQuoteChartData'
        + `&variables=${encodeURIComponent(JSON.stringify({ symbol: symbole, timeRange: '1M' }))}`
        + `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: CNBC_CHART } }))}`;
      const j = json(await obtenir(url));
      const barres = j?.data?.chartData?.priceBars;
      if (!Array.isArray(barres) || !barres.length) throw new Error('aucune barre journalière');
      const m = new Map();
      let prec = '';
      for (const b of barres) {
        const t = String(b.tradeTime || '');
        const d = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
        if (!(d > prec)) break; // récapitulatif mal daté en fin de liste (voir hier.js)
        const o = { haut: nb(b.high), bas: nb(b.low), cloture: nb(b.close) };
        if (o.haut !== null && o.bas !== null && o.cloture !== null) m.set(d, o);
        prec = d;
      }
      return m;
    },
  };
}

/** Finviz, barres journalières (futures ES ou indice SPX), datées. */
export function finvizOhlc(instrument, ticker) {
  return {
    nom: `Finviz (barres journalières ${ticker})`,
    async serie() {
      const j = json(await obtenir(`https://finviz.com/api/quote.ashx?instrument=${instrument}&ticker=${ticker}&timeframe=d&type=new&events=false&rev=1`));
      if (!Array.isArray(j?.date) || !j.date.length) throw new Error('aucune barre');
      const m = new Map();
      j.date.forEach((t, k) => {
        const o = { haut: nb(j.high[k]), bas: nb(j.low[k]), cloture: nb(j.close[k]) };
        if (o.haut !== null && o.bas !== null && o.cloture !== null) m.set(dateLocale('US', t * 1000), o); // 05:00 UTC (futures) ou 14:00 UTC (indice) : date de New York
      });
      return m;
    },
  };
}

/**
 * TradingView, barres 0 à 2. `futures` : la barre s'ouvre à 18h00 (New York) la VEILLE
 * de son jour de cotation ; elle est datée de la séance qui suit son ouverture.
 */
export function tvOhlc(symbole, { futures = false } = {}) {
  return {
    nom: `TradingView (${symbole})`,
    async serie() {
      const champs = ['time', ...[0, 1, 2].flatMap((k) => ['high', 'low', 'close'].map((c) => (k ? `${c}[${k}]` : c)))].join(',');
      const j = json(await obtenir(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbole)}&fields=${champs}&no_404=true`));
      if (typeof j?.time !== 'number') throw new Error('champ « time » absent : barre non datable');
      const ouverture = dateLocale('US', j.time * 1000);
      let d = futures ? seanceApres('US', ouverture) : ouverture;
      if (!estSeance('US', d)) throw new Error(`barre courante datée du ${d}, qui n'est pas une séance`);
      const m = new Map();
      for (const k of [0, 1, 2]) {
        const s = (c) => nb(j[k ? `${c}[${k}]` : c]);
        const o = { haut: s('high'), bas: s('low'), cloture: s('close') };
        if (o.haut !== null && o.bas !== null && o.cloture !== null) m.set(d, o);
        d = seanceAvant('US', d);
      }
      return m;
    },
  };
}

/** Cboe, historique daté du S&P 500 comptant (403 au runner depuis le 20/11, gardé en dernier). */
export function cboeOhlc() {
  return {
    nom: 'Cboe (historique _SPX)',
    async serie({ seance }) {
      const s = await seanceCboe('_SPX', seance);
      return new Map([[seance, { haut: s.haut, bas: s.bas, cloture: s.cloture }]]);
    },
  };
}

/** Haut, bas et clôture d'une séance : la source principale, sinon la source de secours. */
export async function premiereSourceOhlc(nom, sources, seance, maintenant) {
  const essais = [];
  for (const [rang, s] of sources.entries()) {
    const lu = { nom: s.nom, role: rang === 0 ? 'principale' : 'secours' };
    try {
      const m = await s.serie({ seance });
      const o = seanceClose('US', seance, maintenant) ? m.get(seance) : null;
      if (!o) lu.statut = `aucune barre datée du ${seance}`;
      else if (!(o.haut >= o.cloture && o.cloture >= o.bas && o.haut > o.bas)) lu.statut = `barre incohérente (H ${o.haut} · B ${o.bas} · C ${o.cloture})`;
      else Object.assign(lu, { statut: 'ok', haut: o.haut, bas: o.bas, cloture: o.cloture });
    } catch (e) {
      lu.statut = `muette (${e.message})`;
    }
    essais.push(lu);
    if (lu.statut === 'ok') {
      return { nd: false, haut: lu.haut, bas: lu.bas, cloture: lu.cloture,
               sources: [{ nom: lu.nom, role: lu.role, haut: lu.haut, bas: lu.bas, cloture: lu.cloture }], essais };
    }
  }
  return { nd: true, motif: `${nom} : ni la source principale ni la source de secours ne donnent la séance du ${seance}`, essais };
}

export function sourcesZones(dateBrief) {
  const front = contratFrontMonth(dateBrief);
  const code = codeCnbc(front.contrat);
  return {
    front,
    es: [cnbcOhlc(code), tvOhlc(`CME_MINI:${front.contrat}`, { futures: true })],
    spx: [cnbcOhlc('.SPX'), tvOhlc('SP:SPX')],
    poc: [(seance, controle) => esMinutesCnbc(code, seance).then((mn) => ({ ...pocControle(mn.barres, controle), source: mn.source }))],
  };
}

/**
 * Les zones complètes. Rend { complet, es, cfd, motifs, detail } ; `es`/`cfd` portent des
 * nombres seulement quand ils sont publiables.
 */
export async function collecterZones(dateBrief, { maintenant = new Date(), sources = sourcesZones(dateBrief) } = {}) {
  const seance = derniereSeance('US', dateBrief);
  const r = { seance, contrat: sources.front.contrat, es: {}, cfd: {}, motifs: { es: {}, cfd: {} }, detail: {} };

  const es = await premiereSourceOhlc(`ES ${sources.front.contrat}`, sources.es, seance, maintenant);
  r.detail.es = es;
  if (es.nd) for (const k of ['cloture', 'poc', 'R2', 'R1', 'P', 'S1', 'S2']) r.motifs.es[k] = es.motif;
  else {
    const p = calculerPivots(es.haut, es.bas, es.cloture);
    Object.assign(r.es, { cloture: es.cloture, haut: es.haut, bas: es.bas, R2: p.R2, R1: p.R1, P: p.P, S1: p.S1, S2: p.S2 });
    // Fourchette et règlement comme contrôle du POC seulement s'ils viennent de CNBC,
    // comme les minutes : sinon ce serait une comparaison entre deux sources.
    const esCnbc = /^CNBC/.test(es.sources[0].nom);
    const controle = esCnbc ? { reglement: es.cloture, hautJour: es.haut, basJour: es.bas } : {};
    const essaisPoc = [];
    for (const [rang, f] of [].concat(sources.poc).entries()) {
      const role = rang === 0 ? 'principale' : 'secours';
      try {
        const poc = await f(seance, controle);
        essaisPoc.push({ nom: poc.source || `POC ${role}`, role, statut: typeof poc.valeur === 'number' ? 'ok' : poc.motif });
        if (typeof poc.valeur === 'number') { r.es.poc = poc.valeur; r.detail.poc = { ...poc, role, essais: essaisPoc }; break; }
      } catch (e) {
        essaisPoc.push({ nom: 'CNBC (barres 1 min du contrat)', role, statut: `muette (${e.message})` });
      }
    }
    if (typeof r.es.poc !== 'number') {
      r.motifs.es.poc = `POC : indisponible (${essaisPoc.map((x) => `${x.nom} : ${x.statut}`).join(' ; ')})`;
      r.detail.poc = { motif: r.motifs.es.poc, essais: essaisPoc };
    }
  }

  const spx = await premiereSourceOhlc('S&P 500 comptant (CFD)', sources.spx, seance, maintenant);
  r.detail.cfd = spx;
  if (spx.nd) for (const k of ['cloture', 'R2', 'R1', 'P', 'S1', 'S2']) r.motifs.cfd[k] = spx.motif;
  else {
    const p = calculerPivots(spx.haut, spx.bas, spx.cloture);
    Object.assign(r.cfd, { cloture: spx.cloture, haut: spx.haut, bas: spx.bas, R2: p.R2, R1: p.R1, P: p.P, S1: p.S1, S2: p.S2 });
  }
  return r;
}
