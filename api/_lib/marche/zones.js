// ========================================================================
// « ZONES À SURVEILLER » DU BRIEF V22 : ES et CFD, calculés par le CODE.
//
// Même règle que « Sur les marchés hier » (hier.js) : sources ordonnées, publication à
// l'accord de DEUX sources indépendantes sur la séance attendue, jamais de n/d qui part.
//   ES  : haut, bas et règlement de la séance réglée du contrat front-month.
//         CNBC (barres journalières du contrat) · Finviz (barres journalières ES) ·
//         TradingView (barres du contrat, datées au jour de cotation Globex).
//         Accord au tick près (0,25).
//   CFD : haut, bas et clôture du S&P 500 comptant.
//         CNBC (.SPX) · TradingView (SP:SPX) · Finviz (SPX) · Cboe.
//         Accord à 0,05 %.
// Pivots classiques calculés sur ces trois nombres (pivots.js, vérifiés le 26/11/2026
// contre la référence v22 : ES P 7 134,08, CFD P 7 117,40).
// POC : minutes CNBC du contrat, contrôlées par le règlement et la fourchette du jour
// concordants (Manu, 26/11/2026 : « POC gardé, calculé sur CNBC avec les contrôles
// internes, on ne le retire pas »).
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

const accord = (a, b, t) => ['haut', 'bas', 'cloture'].every((k) => (t.type === 'absolue'
  ? Math.abs(a[k] - b[k]) <= t.valeur + 1e-9
  : Math.abs(a[k] - b[k]) <= t.valeur * Math.max(Math.abs(a[k]), Math.abs(b[k])) + 1e-9));

/** Haut, bas et clôture d'une séance, publiés à l'accord de deux sources. */
export async function concordanceOhlc(nom, sources, seance, tolerance, maintenant) {
  const essais = [];
  const valides = [];
  for (const s of sources) {
    let lu;
    try {
      const m = await s.serie({ seance });
      const o = seanceClose('US', seance, maintenant) ? m.get(seance) : null;
      if (!o) lu = { nom: s.nom, statut: `aucune barre datée du ${seance}` };
      else if (!(o.haut >= o.cloture && o.cloture >= o.bas && o.haut > o.bas)) lu = { nom: s.nom, statut: `barre incohérente (H ${o.haut} · B ${o.bas} · C ${o.cloture})` };
      else lu = { nom: s.nom, statut: 'ok', ...o };
    } catch (e) {
      lu = { nom: s.nom, statut: `muette (${e.message})` };
    }
    essais.push(lu);
    if (lu.statut !== 'ok') continue;
    const pair = valides.find((v) => accord(v, lu, tolerance));
    if (pair) {
      return { nd: false, haut: pair.haut, bas: pair.bas, cloture: pair.cloture,
               sources: [pair, lu].map((x) => ({ nom: x.nom, haut: x.haut, bas: x.bas, cloture: x.cloture })), essais };
    }
    if (valides.length) lu.statut = `ok, mais en désaccord avec ${valides.map((v) => v.nom).join(', ')} (H ${lu.haut} · B ${lu.bas} · C ${lu.cloture})`;
    valides.push(lu);
  }
  return { nd: true, motif: `${nom} : aucune paire de sources concordantes pour la séance du ${seance}`, essais };
}

export function sourcesZones(dateBrief) {
  const front = contratFrontMonth(dateBrief);
  const code = codeCnbc(front.contrat);
  return {
    front,
    es: [cnbcOhlc(code), finvizOhlc('futures', 'ES'), tvOhlc(`CME_MINI:${front.contrat}`, { futures: true })],
    spx: [cnbcOhlc('.SPX'), tvOhlc('SP:SPX'), finvizOhlc('index', 'SPX'), cboeOhlc()],
    poc: (seance, controle) => esMinutesCnbc(code, seance).then((mn) => ({ ...pocControle(mn.barres, controle), source: mn.source })),
  };
}

/**
 * Les zones complètes. Rend { complet, es, cfd, motifs, detail } ; `es`/`cfd` portent des
 * nombres seulement quand ils sont publiables.
 */
export async function collecterZones(dateBrief, { maintenant = new Date(), sources = sourcesZones(dateBrief) } = {}) {
  const seance = derniereSeance('US', dateBrief);
  const r = { seance, contrat: sources.front.contrat, es: {}, cfd: {}, motifs: { es: {}, cfd: {} }, detail: {} };

  const es = await concordanceOhlc(`ES ${sources.front.contrat}`, sources.es, seance, { type: 'absolue', valeur: 0.25 }, maintenant);
  r.detail.es = es;
  if (es.nd) for (const k of ['cloture', 'poc', 'R2', 'R1', 'P', 'S1', 'S2']) r.motifs.es[k] = es.motif;
  else {
    const p = calculerPivots(es.haut, es.bas, es.cloture);
    Object.assign(r.es, { cloture: es.cloture, haut: es.haut, bas: es.bas, R2: p.R2, R1: p.R1, P: p.P, S1: p.S1, S2: p.S2 });
    try {
      const poc = await sources.poc(seance, { reglement: es.cloture, hautJour: es.haut, basJour: es.bas });
      r.detail.poc = poc;
      if (typeof poc.valeur === 'number') r.es.poc = poc.valeur;
      else r.motifs.es.poc = poc.motif;
    } catch (e) {
      r.motifs.es.poc = `POC : minutes CNBC indisponibles (${e.message})`;
      r.detail.poc = { motif: r.motifs.es.poc };
    }
  }

  const spx = await concordanceOhlc('S&P 500 comptant (CFD)', sources.spx, seance, { type: 'relative', valeur: 0.0005 }, maintenant);
  r.detail.cfd = spx;
  if (spx.nd) for (const k of ['cloture', 'R2', 'R1', 'P', 'S1', 'S2']) r.motifs.cfd[k] = spx.motif;
  else {
    const p = calculerPivots(spx.haut, spx.bas, spx.cloture);
    Object.assign(r.cfd, { cloture: spx.cloture, haut: spx.haut, bas: spx.bas, R2: p.R2, R1: p.R1, P: p.P, S1: p.S1, S2: p.S2 });
  }
  return r;
}
