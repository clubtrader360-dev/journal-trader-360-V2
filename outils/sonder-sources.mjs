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
  // ═══ TOUR 6 — un HISTORIQUE DATÉ, pour les hauts et bas de séance passée ═════
  // CNBC rend le règlement daté du contrat nommé. Reste à savoir s'il rend aussi la
  // bougie journalière des séances précédentes : c'est ce qui décide si les hauts et
  // bas sont disponibles tout de suite ou seulement via le prélèvement de 17h05.
  { cible: 'HIST', nom: 'CNBC ts-api chart ESZ26 (1D)', corps: true,
    url: 'https://ts-api.cnbc.com/harmonize/services/quote/chart?symbol=ESZ26&interval=1D&requestMethod=extended' },
  { cible: 'HIST', nom: 'CNBC ts-api chart ESZ26 (86400 / 1M)', corps: true,
    url: 'https://ts-api.cnbc.com/harmonize/services/quote/chart?symbol=ESZ26&timeRange=1M&interval=86400' },
  { cible: 'HIST', nom: 'CNBC api.cnbc chart', corps: true,
    url: 'https://api.cnbc.com/services/quote/chart?symbol=ESZ26&interval=86400' },
  { cible: 'HIST', nom: 'CNBC ts-api chart .SPX', corps: true,
    url: 'https://ts-api.cnbc.com/harmonize/services/quote/chart?symbol=.SPX&timeRange=1M&interval=86400' },
  { cible: 'HIST', nom: 'CNBC quote multi (ESZ26 + .SPX + .VIX)', corps: true,
    url: 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=ESZ26%7C.SPX%7C.VIX&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1' },
  { cible: 'HIST', nom: 'Finviz futures (structure)', corps: true,
    url: 'https://finviz.com/api/futures_all.ashx?timeframe=d1' },
  { cible: 'HIST', nom: 'Nasdaq futures ES (corps réel)', corps: true,
    url: 'https://api.nasdaq.com/api/quote/ES%3ACME/historical?assetclass=futures&fromdate=2026-09-01&todate=2026-09-16&limit=20' },
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
        headers: { 'user-agent': UA, accept: '*/*', ...(c.post ? { 'content-type': c.formulaire ? 'application/x-www-form-urlencoded' : 'application/json', 'x-requested-with': 'XMLHttpRequest' } : {}) },
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
