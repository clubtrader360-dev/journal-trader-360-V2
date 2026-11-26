/**
 * Sonde des sources du bloc « Sur les marchés hier » (brief v22, 26/11/2026).
 *
 *   node outils/sonder-sources-v22.mjs
 *
 * Même principe que sonder-sources.mjs : seule la réponse obtenue DEPUIS LE RUNNER
 * vaut. Chaque candidat est appelé trois fois ; on imprime le début du corps pour
 * juger du contenu, pas seulement du code HTTP.
 */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const cnbc = (s) => `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(s)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`;
const tv = (s) => `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(s)}&fields=time,close,close[1],close[2],change_abs,description,update_mode&no_404=true`;
const CANDIDATS = [
  ['SPX', 'CNBC .SPX', cnbc('.SPX')], ['SPX', 'TradingView SP:SPX', tv('SP:SPX')],
  ['SPX', 'Cboe _SPX', 'https://cdn.cboe.com/api/global/delayed_quotes/quotes/_SPX.json'],
  ['SPX', 'Nasdaq api SPX', 'https://api.nasdaq.com/api/quote/SPX/info?assetclass=index'],
  ['IXIC', 'CNBC .IXIC', cnbc('.IXIC')], ['IXIC', 'TradingView NASDAQ:IXIC', tv('NASDAQ:IXIC')],
  ['IXIC', 'Nasdaq api COMP historique', 'https://api.nasdaq.com/api/quote/COMP/historical?assetclass=index&fromdate=2026-11-16&todate=2026-11-30&limit=10'],
  ['DAX', 'CNBC .GDAXI', cnbc('.GDAXI')], ['DAX', 'TradingView XETR:DAX', tv('XETR:DAX')],
  ['DAX', 'Börse Frankfurt DAX', 'https://api.boerse-frankfurt.de/v1/data/price_information/single?isin=DE0008469008&mic=XETR'],
  ['CAC', 'CNBC .FCHI', cnbc('.FCHI')], ['CAC', 'TradingView EURONEXT:PX1', tv('EURONEXT:PX1')],
  ['CAC', 'Boursorama CAC', 'https://www.boursorama.com/bourse/indices/cours/1rPCAC/'],
  ['CAC', 'FT FCHI:PAR', 'https://markets.ft.com/data/indices/tearsheet/summary?s=FCHI:PAR'],
  ['OAT', 'CNBC FR10Y-FR', cnbc('FR10Y-FR')], ['OAT', 'TradingView TVC:FR10Y', tv('TVC:FR10Y')],
  ['OAT', 'FT FR10YT', 'https://markets.ft.com/data/bonds/tearsheet/summary?s=FR10YT'],
  ['OAT', 'Boursorama FR10YT', 'https://www.boursorama.com/bourse/taux/cours/1rPFR10YT/'],
  ['BTC', 'Coinbase candles', 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400'],
  ['BTC', 'Bitstamp ohlc', 'https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=4'],
  ['BTC', 'Kraken OHLC', 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440'],
  ['BTC', 'CNBC BTC=', cnbc('BTC=')], ['BTC', 'TradingView BITSTAMP:BTCUSD', tv('BITSTAMP:BTCUSD')],
  ['VIX', 'CNBC .VIX', cnbc('.VIX')], ['VIX', 'TradingView CBOE:VIX', tv('CBOE:VIX')],
  ['VIX', 'Cboe _VIX', 'https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json'],
  ['ES', 'CNBC ESZ26', cnbc('ESZ26')], ['ES', 'TradingView CME_MINI:ESZ2026', tv('CME_MINI:ESZ2026')],
  ['ES', 'Finviz futures', 'https://finviz.com/api/futures_all.ashx?timeframe=d1'],
];
for (const [cible, nom, url] of CANDIDATS) {
  const essais = [];
  for (let n = 0; n < 3; n++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(20000) });
      const t = await r.text();
      const anti = /^\s*</.test(t) && /noscript|Just a moment|challenge|captcha/i.test(t.slice(0, 2000));
      essais.push({ code: r.status, anti, tete: t.replace(/\s+/g, ' ').slice(0, 220) });
    } catch (e) { essais.push({ code: 'ERR', tete: e.message }); }
    await new Promise((r) => setTimeout(r, 400));
  }
  const ok = essais.every((e) => e.code === 200 && !e.anti);
  console.log(`${ok ? '✅' : '❌'} [${cible}] ${nom} · ${essais.map((e) => e.code + (e.anti ? '(anti-robot)' : '')).join('/')}`);
  console.log(`      → ${essais[0].tete}`);
}
