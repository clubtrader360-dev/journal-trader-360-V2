// ========================================
// GET /api/market-data/ohlc?symbol=ES&interval=1m&from=<epoch>&to=<epoch>
// ----------------------------------------
// Proxy Yahoo Finance (contourne CORS) pour le graph d'un trade (#16, Lightweight Charts).
// Auth : requireUser (élève OU coach ; données OHLC publiques non sensibles).
//
// Retour normalisé : { symbol, interval, yahoo, fallback_used, candles: [{time,open,high,low,close}] }
//   - time = epoch SECONDES (format Lightweight Charts)
//
// ⚠️ Limitations Yahoo Finance (historique max par intervalle) :
//   - 1m  : ~7 jours    - 5m  : ~60 jours    - 15m : ~60 jours
//   - 30m : ~60 jours   - 1h  : ~730 jours   - 1d  : illimité
//   - Rate limit officieux ~2000 req/h. UA "Mozilla/5.0…" OBLIGATOIRE (sinon 401/429 Yahoo).
// ========================================

import { requireUser, httpError } from '../tradovate/_lib/auth.js';

// Instrument interne → symbole Yahoo (+ fallback pour les micros parfois absents chez Yahoo).
const INSTRUMENT_MAP = {
  ES:  { yahoo: 'ES=F' },
  NQ:  { yahoo: 'NQ=F' },
  MES: { yahoo: 'MES=F', fallback: 'ES=F' },
  MNQ: { yahoo: 'MNQ=F', fallback: 'NQ=F' },
  GC:  { yahoo: 'GC=F' },
  CL:  { yahoo: 'CL=F' },
  RTY: { yahoo: 'RTY=F' },
  YM:  { yahoo: 'YM=F' },
};
const VALID_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '1d']);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Cache in-memory Lambda (5 min) : évite un refetch identique sur une instance chaude.
const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = new Map(); // key -> { at, payload }

function cacheGet(key) {
  const hit = _cache.get(key);
  if (hit && (Date.now() - hit.at) < CACHE_TTL_MS) return hit.payload;
  if (hit) _cache.delete(key);
  return null;
}
function cacheSet(key, payload) {
  _cache.set(key, { at: Date.now(), payload });
  if (_cache.size > 200) { // borne mémoire
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
}

// Récupère + normalise les bougies Yahoo. Renvoie { candles } ou lève { status } sur erreur Yahoo.
async function fetchYahoo(yahooSymbol, interval, from, to) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`
    + `?interval=${interval}&period1=${from}&period2=${to}`;
  const resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });

  if (resp.status === 429) throw httpError(429, 'Trop de requêtes, réessaie dans 1 min');
  if (resp.status === 404) throw httpError(404, 'Données non disponibles pour cette période');
  if (!resp.ok) throw httpError(502, `Yahoo ${resp.status}`);

  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) return { candles: [] };

  const ts = result.timestamp;
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue; // Yahoo laisse des trous à null
    candles.push({ time: ts[i], open: o, high: h, low: l, close: c });
  }
  return { candles };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method not allowed' });
    }

    // Auth (élève ou coach actif).
    await requireUser(req);

    const symbol = String(req.query.symbol || '').toUpperCase().trim();
    const interval = String(req.query.interval || '1m').trim();
    const from = parseInt(req.query.from, 10);
    const to = parseInt(req.query.to, 10);

    const mapped = INSTRUMENT_MAP[symbol];
    if (!mapped) return res.status(400).json({ ok: false, error: 'Instrument non supporté : ' + symbol });
    if (!VALID_INTERVALS.has(interval)) return res.status(400).json({ ok: false, error: 'Intervalle invalide : ' + interval });
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return res.status(400).json({ ok: false, error: 'Fenêtre temporelle invalide (from/to)' });
    }

    const cacheKey = `${symbol}|${interval}|${from}|${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // Fetch principal ; si vide ET fallback dispo (micros), on retente sur le contrat majeur.
    let usedYahoo = mapped.yahoo;
    let fallback_used = false;
    let { candles } = await fetchYahoo(mapped.yahoo, interval, from, to).catch((e) => {
      if (mapped.fallback) return { candles: [] }; // on laissera le fallback tenter
      throw e;
    });

    if (candles.length === 0 && mapped.fallback) {
      const fb = await fetchYahoo(mapped.fallback, interval, from, to);
      if (fb.candles.length > 0) { candles = fb.candles; usedYahoo = mapped.fallback; fallback_used = true; }
    }

    const payload = { ok: true, symbol, interval, yahoo: usedYahoo, fallback_used, candles };
    cacheSet(cacheKey, payload);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error('[OHLC] error:', err);
    return res.status(500).json({ ok: false, error: 'Erreur récupération données marché' });
  }
}
