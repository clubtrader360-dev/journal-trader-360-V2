/**
 * BANC : la scène « Partager mes performances » (assets/partage-perf.js), 27/10/2026.
 * La scène est dessinée à 40 instants pour chaque période et chaque cas (gain, perte,
 * sans facteur de profit, sans courbe) sur un contexte 2D enregistreur :
 *   1. aucune exception ;
 *   2. ⛔ jamais le nombre de trades à l'image (demande de Nadir) ;
 *   3. le rappel du risque est écrit dans l'image finale ;
 *   4. rien d'indéfini (undefined, NaN, null) dans les textes écrits.
 * Usage : node outils/partage-perf-banc.mjs
 */
import { readFileSync } from 'node:fs';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 160) : '')); if (!ok) ko++; };

globalThis.window = {}; globalThis.document = {};
new Function(readFileSync('assets/partage-perf.js', 'utf8'))();
const P = window.PartagePerf;

function ctxEnregistreur() {
  const textes = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(o, k) {
      if (k === 'fillText') return (t) => textes.push(String(t));
      if (k === 'measureText') return (t) => ({ width: String(t).length * 10 });
      if (['createLinearGradient', 'createRadialGradient'].includes(k)) return () => grad;
      if (k in o) return o[k];
      return () => {};
    },
    set(o, k, v) { o[k] = v; return true; },
  });
  return { ctx, textes };
}
const cas = {
  jour: { timeframe: 'day', label: 'Performance du jour', dateRange: 'Mardi 27 octobre 2026', netPnl: 1245, netPnlInR: 2.5, winRate: 100, profitFactor: null, bestTrade: 440, totalTrades: 5, courbe: [180, 420, 610, 805, 1245] },
  perte: { timeframe: 'day', label: 'Performance du jour', dateRange: 'Lundi', netPnl: -380, netPnlInR: -0.8, winRate: 33, profitFactor: 0.4, bestTrade: -50, totalTrades: 3, courbe: [] },
  semaine: { timeframe: 'week', label: 'Performance de la semaine', dateRange: 'Semaine', netPnl: 2130, netPnlInR: null, winRate: 71, profitFactor: 2.8, totalTrades: 14, dailyBars: [{ date: '2026-10-26', pnl: 620 }, { date: '2026-10-27', pnl: -310 }], meilleurJour: { date: '2026-10-26', pnl: 620 } },
  mois: { timeframe: 'month', label: 'Performance du mois', dateRange: 'Octobre 2026', netPnl: 6545, netPnlInR: 13.1, winRate: 74, profitFactor: null, totalTrades: 41, dailyBars: [{ date: '2026-10-01', pnl: 300 }, { date: '2026-10-02', pnl: -150 }], meilleurJour: null, reference: '2026-10-27' },
};
for (const [nom, m] of Object.entries(cas)) {
  let erreur = null; let finaux = [];
  for (let i = 0; i <= 40; i++) {
    const { ctx, textes } = ctxEnregistreur();
    try { P.dessiner(ctx, m, (i / 40) * P.DUREE, null); } catch (e) { erreur = e.message; break; }
    if (i === 40) finaux = textes;
  }
  dire(!erreur, `${nom} : 41 instants dessinés sans erreur`, erreur || undefined);
  const tout = finaux.join(' | ');
  dire(!/trade(s)? sur|TRADES\b|\b\d+ trades?\b/i.test(tout), `${nom} : aucun nombre de trades`, tout.match(/trade(s)? sur|TRADES\b|\b\d+ trades?\b/i)?.[0]);
  dire(/risque de perte en capital/.test(tout), `${nom} : rappel du risque présent`);
  dire(!/undefined|NaN|null/.test(tout), `${nom} : rien d’indéfini`, tout.match(/undefined|NaN|null/)?.[0]);
}
dire(/\b\d+ trades?\b/i.test('5 trades sur la journée'), '⚠️ TÉMOIN : la sonde voit « 5 trades »');
dire(Math.abs(P.ease(0.5) - 0.9) < 0.15 && P.ease(0) === 0 && P.ease(1) === 1, 'easing cubic-bezier(0.16, 1, 0.3, 1) : 0 → 0, 1 → 1, rapide au début', P.ease(0.5));
const idx = readFileSync('index.html', 'utf8');
dire(idx.includes('<script src="/assets/partage-perf.js" defer></script>') && /window\.PartagePerf\.ouvrir\(metrics\)/.test(idx), 'le module est chargé et branché sur « Partager mes performances »');
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
