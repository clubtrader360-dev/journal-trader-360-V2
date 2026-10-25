/**
 * BANC : hauts et bas d'ES par les barres journalières TradingView, semaine reconstruite,
 * VIX en second chemin (25/10/2026). La VRAIE collecte est appelée ; seules les sources
 * réseau sont doublées, avec les formes mesurées le 25/10 (scanner TradingView, cadran
 * Cboe `_VIX.json`).  Usage : node outils/marche-barres-banc.mjs
 */
import fs from 'node:fs'; import os from 'node:os';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 200) : '')); if (!ok) ko++; };

const SEANCE = '2026-10-23';            // vendredi ; brief du lundi 26
const S = { vixHistoManque: false, vixQuoteDate: '2026-10-23T16:15:01', barres: null, veille: 7659.75 };
const hist = (sym) => {
  const base = sym === '_VIX' ? 19 : 7660;
  const data = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    .filter((d) => !(sym === '_VIX' && S.vixHistoManque && d === SEANCE))
    .map((d, i) => ({ date: d, open: base + i, high: base + i + 20, low: base + i - 20, close: base + i }));
  return { data };
};
const BARRES = { 0: [7760, 7790, 7740, 7770], 1: [7706.25, 7714.25, 7648.5, 7659.75], 2: [7797, 7798.75, 7676.75, 7704.5] };
globalThis.fetch = async (url) => {
  const u = String(url);
  const rep = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (u.includes('charts/historical/_SPX')) return rep(hist('_SPX'));
  if (u.includes('charts/historical/_VIX')) return rep(hist('_VIX'));
  if (u.includes('quotes/_VIX.json')) return rep({ timestamp: '2026-10-25', data: { close: 19.45, high: 20.66, low: 18.88, last_trade_time: S.vixQuoteDate } });
  if (u.includes('quote.cnbc.com')) return rep({ FormattedQuoteResult: { FormattedQuote: [{ code: 0, shortName: 'E-MINI S&P DEC26', settlePrice: '7,659.75', settleDate: SEANCE, previous_day_closing: String(S.veille), last: '7770', high: '7790', low: '7740', expiration_date: '2026-12-18', curmktstatus: 'REG_MKT' }] } });
  if (u.includes('scanner.tradingview.com')) {
    const b = S.barres || BARRES;
    const o = { description: 'E-mini S&P 500 Futures (Dec 2026)', expiration: 20261218, update_mode: 'delayed_streaming_600', close: b[0][3], change_abs: b[0][3] - S.veille, high: b[0][1], low: b[0][2] };
    for (const r of [0, 1, 2]) { const s = r ? `[${r}]` : ''; [o['open' + s], o['high' + s], o['low' + s], o['close' + s]] = b[r]; }
    return rep(o);
  }
  return new Response('?', { status: 404 });
};

const { collecterMarche } = await import('../api/_lib/marche/collecte.js');
const { viderCacheMarche } = await import('../api/_lib/marche/sources.js');
const APRES_REOUVERTURE = new Date('2026-10-25T22:43:00Z');   // dimanche 18h43 NY : rang 1
const dossier = (seances, semaine) => {
  const d = fs.mkdtempSync(os.tmpdir() + '/m-'); fs.mkdirSync(`${d}/seances`); fs.mkdirSync(`${d}/semaines`);
  for (const [date, h, b] of seances) fs.writeFileSync(`${d}/seances/${date}.json`, JSON.stringify({ date, contrat: 'ESZ2026', esHaut: h, esBas: b }));
  if (semaine) fs.writeFileSync(`${d}/semaines/2026-10-19.json`, JSON.stringify({ lundi: '2026-10-19', contrat: 'ESZ2026', ...semaine }));
  return d;
};
const lancer = async (opts) => { viderCacheMarche(); return collecterMarche('2026-10-26', { maintenant: APRES_REOUVERTURE, ...opts }); };

console.log('— séance du vendredi, lue au rang 1 dimanche soir');
let r = await lancer({});
dire(r.es.cloture.valeur === 7659.75, 'clôture conciliée 7 659,75 (règlement daté)', r.es.cloture);
dire(r.es.haut.valeur === 7714.25 && r.es.bas.valeur === 7648.5, 'haut 7 714,25 / bas 7 648,50 : la barre du vendredi', [r.es.haut, r.es.bas]);
dire(r.es.aDeposer.map((x) => x.date).join() === '2026-10-23,2026-10-22', 'à déposer : vendredi (rang 1) et jeudi (rang 2)', r.es.aDeposer);
dire(r.es.hautSemaine.nd && /2026-10-19, 2026-10-20, 2026-10-21/.test(r.es.hautSemaine.motif), 'semaine incomplète sans dépôt : n/d qui nomme les séances manquantes', r.es.hautSemaine.motif);

console.log('— semaine reconstruite depuis les dépôts');
let d = dossier([['2026-10-19', 7850, 7800], ['2026-10-20', 7840, 7790], ['2026-10-21', 7812.25, 7751]]);
r = await lancer({ dossier: `${d}/seances`, dossierSemaines: `${d}/semaines` });
dire(r.es.hautSemaine.valeur === 7850 && r.es.basSemaine.valeur === 7648.5 && r.es.hautSemaine.seances === 5, 'semaine = max/min des 5 séances (dépôts + barres)', [r.es.hautSemaine, r.es.basSemaine]);
d = dossier([['2026-10-19', 7850, 7800], ['2026-10-21', 7812.25, 7751]]);
r = await lancer({ dossier: `${d}/seances`, dossierSemaines: `${d}/semaines` });
dire(r.es.hautSemaine.nd && /2026-10-20/.test(r.es.hautSemaine.motif) && !/2026-10-19/.test(r.es.hautSemaine.motif), 'mardi manquant : n/d qui nomme le mardi seul', r.es.hautSemaine.motif);
d = dossier([], { haut: 7812.25, bas: 7648.5, source: 'TradingView High.5D/Low.5D relevé marché fermé le 25/10' });
r = await lancer({ dossier: `${d}/seances`, dossierSemaines: `${d}/semaines` });
dire(r.es.hautSemaine.valeur === 7812.25 && r.es.basSemaine.valeur === 7648.5, 'semaine relevée d’un bloc (backfill du 19/10) : utilisée', [r.es.hautSemaine, r.es.basSemaine]);

console.log('— rang mal deviné, barre fausse : n/d, jamais une autre séance');
r = await collecterMarche('2026-10-26', { maintenant: new Date('2026-10-25T15:00:00Z') }); // dimanche 11h NY : rang 0, mais la barre 0 du double est une autre séance
dire(r.es.cloture.nd && r.es.haut.nd && /divergents/.test(r.es.cloture.motif), 'rang 0 sur une barre qui n’est pas la séance : clôture ET hauts en n/d', r.es.cloture.motif);

console.log('— week-end réel (mesure du 25/10) : la barre courante EST la séance');
S.barres = { 0: BARRES[1], 1: BARRES[2], 2: [7785, 7812.25, 7751, 7800.25] }; S.veille = 7704.5;
r = await collecterMarche('2026-10-26', { maintenant: new Date('2026-10-25T15:00:00Z') });
dire(r.es.cloture.valeur === 7659.75 && r.es.haut.valeur === 7714.25 && r.es.bas.valeur === 7648.5, 'dimanche matin : règlement + barre 0 concordants, haut/bas du vendredi', [r.es.cloture.valeur, r.es.haut.valeur, r.es.bas.valeur]);
dire(!r.es.cloture.chemins.some((c) => /veille|close−change/.test(c)), 'les chemins « veille » (séance d’avant) sont écartés au rang 0', r.es.cloture.chemins);
S.barres = null; S.veille = 7659.75;
S.barres = { ...BARRES, 1: [7706.25, 7650, 7648.5, 7659.75] };
r = await lancer({});
dire(r.es.haut.nd, 'barre incohérente (haut ≈ bas) refusée par le contrôle OHLC', r.es.haut.motif); S.barres = null;

console.log('— VIX : second chemin daté');
S.vixHistoManque = true;
r = await lancer({});
dire(r.vix.cloture.valeur === 19.45, 'historique sans la séance : cadran différé daté du 23/10 retenu', r.vix.cloture);
S.vixQuoteDate = '2026-10-22T16:15:01';
r = await lancer({});
dire(r.vix.cloture.nd && /cadran daté du 2026-10-22/.test(r.vix.cloture.motif), 'cadran d’une autre date : n/d, motif explicite', r.vix.cloture.motif);
S.vixHistoManque = false; S.vixQuoteDate = '2026-10-23T16:15:01';
r = await lancer({});
dire(r.vix.cloture.valeur === 23, 'témoin : historique complet, cadran inutile (19 + 4 = 23)', r.vix.cloture);

console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
