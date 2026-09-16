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
  // ═══ TOUR 5 — LA QUESTION POSÉE PAR LES COACHS ═══════════════════════════════
  //
  // « L'information EST sur Investing, la preuve le SPX et le VIX en sortent justes
  // dix fois sur dix. » La deuxième moitié de la phrase est vraie ; la première ne
  // s'ensuit pas, et c'est ce tour qui doit trancher. Le MODÈLE lit Investing par
  // WebFetch, depuis l'infrastructure d'Anthropic. Le CODE lit depuis le runner
  // GitHub. Ce ne sont pas les mêmes adresses et ce n'est pas le même verdict.
  //
  // On ne se contente donc pas de répéter le 403 du tour 1 : on essaie TOUTES les
  // portes d'Investing, y compris celles qui ne passent pas par www.
  { cible: 'INV', nom: 'Investing www, page historique', corps: true,
    url: 'https://www.investing.com/indices/us-spx-500-futures-historical-data' },
  { cible: 'INV', nom: 'Investing api.financialdata', corps: true,
    url: 'https://api.investing.com/api/financialdata/historical/8839?start-date=2026-09-01&end-date=2026-09-16&time-frame=Daily' },
  { cible: 'INV', nom: 'Investing HistoricalDataAjax (voie héritée)', corps: true,
    url: 'https://www.investing.com/instruments/HistoricalDataAjax',
    post: 'curr_id=8839&smlID=1159963&header=&st_date=09/01/2026&end_date=09/16/2026&interval_sec=Daily&sort_col=date&sort_ord=DESC&action=historical_data',
    formulaire: true },
  { cible: 'INV', nom: 'Investing tvc4 — flux de graphique (UDF)', corps: true,
    url: 'https://tvc4.investing.com/0/0/0/0/0/history?symbol=8839&resolution=D&from=1756684800&to=1789689600' },
  { cible: 'INV', nom: 'Investing tvc6 — flux de graphique (UDF)', corps: true,
    url: 'https://tvc6.investing.com/0/0/0/0/0/history?symbol=8839&resolution=D&from=1756684800&to=1789689600' },
  { cible: 'INV', nom: 'Investing tvc4 — SPX comptant (id 166)', corps: true,
    url: 'https://tvc4.investing.com/0/0/0/0/0/history?symbol=166&resolution=D&from=1756684800&to=1789689600' },
  { cible: 'INV', nom: 'Forexpros tvc (ancien domaine)', corps: true,
    url: 'https://tvc4.forexpros.com/0/0/0/0/0/history?symbol=8839&resolution=D&from=1756684800&to=1789689600' },

  // ── Autres chemins vers un HISTORIQUE DATÉ d'ES ─────────────────────────────
  { cible: 'ES', nom: 'CNBC quote @ES.1', corps: true,
    url: 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=%40ES.1&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1' },
  { cible: 'ES', nom: 'Finviz futures (JSON public)', corps: true,
    url: 'https://finviz.com/api/futures_all.ashx?timeframe=d1' },
  { cible: 'ES', nom: 'Nasdaq futures ES (assetclass corrigé)', corps: true,
    url: 'https://api.nasdaq.com/api/quote/ES%3ACME/historical?assetclass=futures&fromdate=2026-09-01&todate=2026-09-16&limit=20' },
  { cible: 'ES', nom: 'Stooq via miroir sans challenge', corps: true,
    url: 'https://stooq.com/q/d/l/?s=es.f&i=d&d1=20260901&d2=20260916' },
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
