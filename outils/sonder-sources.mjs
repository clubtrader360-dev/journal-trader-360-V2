/**
 * Quelles sources de données de marché répondent RÉELLEMENT depuis le runner GitHub.
 *
 *   node outils/sonder-sources.mjs
 *
 * Pourquoi une sonde et pas la documentation : ce projet a déjà vérifié que Yahoo
 * Finance rend 429 depuis Vercel et depuis Supabase. Rien ne dit que les adresses
 * GitHub Actions soient traitées pareil, et rien ne dit l'inverse. La seule réponse qui
 * vaut est celle obtenue depuis la machine qui exécutera le brief.
 *
 * Chaque candidat est appelé TROIS FOIS : une source qui répond une fois sur deux est
 * pire qu'une source qui ne répond jamais, parce qu'elle installe une intermittence
 * qu'on mettra des semaines à attribuer.
 */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CANDIDATS = [
  // ── ES, contrat explicite ────────────────────────────────────────────────────
  { cible: 'ES', nom: 'CME settlements ES (JSON officiel)',
    url: 'https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/133/FUT?tradeDate=09/15/2026&strategy=DEFAULT' },
  { cible: 'ES', nom: 'CME settlements ES (id produit 138)',
    url: 'https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/138/FUT?tradeDate=09/15/2026&strategy=DEFAULT' },
  { cible: 'ES', nom: 'Yahoo chart ESZ26.CME (contrat nommé)',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/ESZ26.CME?range=1mo&interval=1d' },
  { cible: 'ES', nom: 'Yahoo chart ES=F (ticker générique)',
    url: 'https://query2.finance.yahoo.com/v8/finance/chart/ES%3DF?range=1mo&interval=1d' },
  { cible: 'ES', nom: 'Stooq es.f (CSV continu)',
    url: 'https://stooq.com/q/d/l/?s=es.f&i=d' },
  { cible: 'ES', nom: 'Stooq esz26.f (CSV contrat)',
    url: 'https://stooq.com/q/d/l/?s=esz26.f&i=d' },
  { cible: 'ES', nom: 'Barchart queryeod ESZ26',
    url: 'https://www.barchart.com/proxies/timeseries/queryeod.ashx?symbol=ESZ26&data=daily&maxrecords=20&volume=contract&order=asc' },
  { cible: 'ES', nom: 'Investing API historique (futures SPX)',
    url: 'https://api.investing.com/api/financialdata/historical/8839?start-date=2026-09-01&end-date=2026-09-16&time-frame=Daily' },
  { cible: 'ES', nom: 'Investing page futures (HTML brut)',
    url: 'https://www.investing.com/indices/us-spx-500-futures-historical-data' },
  { cible: 'ES', nom: 'TradingView scanner futures (POST)',
    url: 'https://scanner.tradingview.com/futures/scan', post: JSON.stringify({
      symbols: { tickers: ['CME_MINI:ESZ2026'] },
      columns: ['close', 'high', 'low', 'prev_close_price', 'update_mode'] }) },

  // ── SPX cash / CFD SPX500 ────────────────────────────────────────────────────
  { cible: 'SPX', nom: 'Cboe _SPX_History.csv',
    url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/_SPX_History.csv' },
  { cible: 'SPX', nom: 'Cboe SPX_History.csv',
    url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/SPX_History.csv' },
  { cible: 'SPX', nom: 'Yahoo chart ^GSPC',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1mo&interval=1d' },
  { cible: 'SPX', nom: 'Stooq ^spx (CSV)',
    url: 'https://stooq.com/q/d/l/?s=%5Espx&i=d' },
  { cible: 'SPX', nom: 'FRED SP500 (clôture seule)',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500' },
  { cible: 'SPX', nom: 'stockanalysis.com SPX historique',
    url: 'https://stockanalysis.com/api/symbol/i/SPX/history?range=1M&period=Daily' },
  { cible: 'SPX', nom: 'Investing page SPX (HTML brut)',
    url: 'https://www.investing.com/indices/us-spx-500-historical-data' },

  // ── VIX ──────────────────────────────────────────────────────────────────────
  { cible: 'VIX', nom: 'Cboe VIX_History.csv (officiel)',
    url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv' },
  { cible: 'VIX', nom: 'Yahoo chart ^VIX',
    url: 'https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1mo&interval=1d' },
  { cible: 'VIX', nom: 'Stooq ^vix (CSV)',
    url: 'https://stooq.com/q/d/l/?s=%5Evix&i=d' },
];

/** Ce qu'on a vraiment reçu — et non ce que le code HTTP prétend. */
function nature(txt, ctype) {
  if (/^\s*</.test(txt) && /noscript|challenge|captcha|cf-browser/i.test(txt.slice(0, 2000))) return 'PAGE ANTI-ROBOT';
  if (/^\s*<!DOCTYPE|^\s*<html/i.test(txt)) return 'HTML';
  if (/^\s*[{[]/.test(txt)) return 'JSON';
  if (/^[A-Z][A-Za-z ]*,/.test(txt) || /^\d{2}\/\d{2}\/\d{4},/.test(txt)) return 'CSV';
  return (ctype || 'inconnu').split(';')[0];
}

const resultats = [];
for (const c of CANDIDATS) {
  const essais = [];
  for (let n = 0; n < 3; n++) {
    const t0 = Date.now();
    try {
      const r = await fetch(c.url, {
        method: c.post ? 'POST' : 'GET',
        headers: { 'user-agent': UA, accept: '*/*', ...(c.post ? { 'content-type': 'application/json' } : {}) },
        body: c.post,
        signal: AbortSignal.timeout(25000),
      });
      const txt = await r.text();
      essais.push({ code: r.status, o: txt.length, ms: Date.now() - t0,
                    nat: nature(txt, r.headers.get('content-type')), tete: txt.slice(0, 160).replace(/\s+/g, ' ') });
    } catch (e) {
      essais.push({ code: 'ERR', o: 0, ms: Date.now() - t0, nat: e.name === 'TimeoutError' ? 'TIMEOUT' : 'ERREUR', tete: e.message.slice(0, 120) });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  resultats.push({ ...c, essais });
  const codes = essais.map((e) => e.code).join('/');
  const nats = [...new Set(essais.map((e) => e.nat))].join('+');
  const ok = essais.every((e) => e.code === 200) && !nats.includes('ANTI-ROBOT') && !nats.includes('ERREUR');
  console.log(`${ok ? '✅' : '❌'} [${c.cible}] ${c.nom}`);
  console.log(`      codes ${codes} · ${nats} · ${essais.map((e) => e.o).join('/')} o · ${essais.map((e) => e.ms).join('/')} ms`);
  if (!ok || process.env.VERBEUX) console.log(`      → ${essais[0].tete}`);
}

console.log('\n───────── RETENUS (trois réponses 200, contenu exploitable) ─────────');
for (const cible of ['ES', 'SPX', 'VIX']) {
  const bons = resultats.filter((r) => r.cible === cible &&
    r.essais.every((e) => e.code === 200) && !r.essais.some((e) => /ANTI-ROBOT|ERREUR|TIMEOUT/.test(e.nat)));
  console.log(`  ${cible} : ${bons.length ? bons.map((b) => b.nom).join(' | ') : 'AUCUNE'}`);
}
