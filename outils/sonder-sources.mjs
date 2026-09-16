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
  // ═══ TOUR 2 — ES seulement. Le tour 1 a écarté Yahoo (429 comme depuis Vercel et
  // Supabase), CME (403 anti-scraping), Investing (challenge Cloudflare), Stooq (page
  // anti-robot), Barchart (403). Il reste à savoir si TradingView rend une VALEUR et
  // non une enveloppe vide, et si d'autres chemins existent.
  { cible: 'ES', nom: 'TradingView scanner CME_MINI:ESZ2026', corps: true,
    url: 'https://scanner.tradingview.com/futures/scan', post: JSON.stringify({
      symbols: { tickers: ['CME_MINI:ESZ2026'] },
      columns: ['close', 'high', 'low', 'prev_close_price', 'update_mode'] }) },
  { cible: 'ES', nom: 'TradingView scanner ES1! (front-month)', corps: true,
    url: 'https://scanner.tradingview.com/futures/scan', post: JSON.stringify({
      symbols: { tickers: ['CME_MINI:ES1!'] },
      columns: ['close', 'high', 'low', 'prev_close_price', 'description', 'update_mode'] }) },
  { cible: 'ES', nom: 'TradingView symbol ESZ2026', corps: true,
    url: 'https://scanner.tradingview.com/symbol?symbol=CME_MINI%3AESZ2026&fields=close,high,low,prev_close_price,description&no_404=true' },
  { cible: 'ES', nom: 'TradingView history ESZ2026 (UDF)', corps: true,
    url: 'https://scanner.tradingview.com/futures/scan?label-product=markets-screener' , post: JSON.stringify({
      symbols: { tickers: ['CME_MINI:ESZ2026'] }, columns: ['open', 'high', 'low', 'close', 'volume'] }) },

  { cible: 'ES', nom: 'CME ftp settle stlint_v2', corps: true,
    url: 'https://www.cmegroup.com/ftp/pub/settle/stlint_v2' },
  { cible: 'ES', nom: 'CME ftp settle (index)', corps: true,
    url: 'https://www.cmegroup.com/ftp/settle/' },

  { cible: 'ES', nom: 'Twelve Data demo ES (clé demo)', corps: true,
    url: 'https://api.twelvedata.com/time_series?symbol=ES&interval=1day&outputsize=5&apikey=demo' },
  { cible: 'ES', nom: 'FMP ESUSD (clé demo)', corps: true,
    url: 'https://financialmodelingprep.com/api/v3/historical-price-full/ESUSD?apikey=demo' },
  { cible: 'ES', nom: 'Databento (sans clé — attendu 401, teste la joignabilité)', corps: true,
    url: 'https://hist.databento.com/v0/metadata.list_datasets' },

  { cible: 'ES', nom: 'Relais texte r.jina.ai sur Investing futures', corps: true,
    url: 'https://r.jina.ai/https://www.investing.com/indices/us-spx-500-futures-historical-data' },
  { cible: 'ES', nom: 'Relais texte r.jina.ai sur Barchart ESZ26', corps: true,
    url: 'https://r.jina.ai/https://www.barchart.com/futures/quotes/ESZ26/price-history/daily' },

  { cible: 'SPX', nom: 'Cboe SPX_History.csv (re-témoin)', corps: true,
    url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/SPX_History.csv' },
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
                    nat: nature(txt, r.headers.get('content-type')), tete: txt.slice(0, c.corps ? 400 : 160).replace(/\s+/g, ' ') });
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
  if (!ok || c.corps || process.env.VERBEUX) console.log(`      → ${essais[0].tete}`);
}

console.log('\n───────── RETENUS (trois réponses 200, contenu exploitable) ─────────');
for (const cible of ['ES', 'SPX', 'VIX']) {
  const bons = resultats.filter((r) => r.cible === cible &&
    r.essais.every((e) => e.code === 200) && !r.essais.some((e) => /ANTI-ROBOT|ERREUR|TIMEOUT/.test(e.nat)));
  console.log(`  ${cible} : ${bons.length ? bons.map((b) => b.nom).join(' | ') : 'AUCUNE'}`);
}
