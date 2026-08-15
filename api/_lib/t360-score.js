// ========================================
// T360 Score — module partagé (formule = copie EXACTE de assets/coach-dashboard.js `studentScore`).
// Pas de refactor de coach-dashboard.js / weekly-expert-system.js ici (ils gardent leur copie locale) :
// extraction complète = chantier séparé. Ici on l'expose côté backend pour le webhook col X.
//
// computeT360Score(trades, accounts) → { globalScore: number (0..100, 1 décimale), components: {...} }
//   - globalScore = moyenne des scores par compte actif, arrondie à 1 décimale (0 si aucun compte tradé).
// ========================================

function pnlOf(t) { return parseFloat(t.pnl) || 0; }
function dateOf(t) { return String(t.trade_date || t.date || '').slice(0, 10); }

export function computeT360Score(trades, accounts) {
  trades = trades || [];
  const active = (accounts || []).filter(function (a) { return a.active !== false; });
  const rows = [];
  active.forEach(function (acc) {
    const at = trades.filter(function (t) { return t.account_id === acc.id; });
    if (!at.length) return;
    const winners = at.filter(function (t) { return pnlOf(t) > 0; });
    const losers = at.filter(function (t) { return pnlOf(t) < 0; });
    const wr = at.length ? (winners.length / at.length) * 100 : 0;
    const gp = winners.reduce(function (s, t) { return s + pnlOf(t); }, 0);
    const gl = Math.abs(losers.reduce(function (s, t) { return s + pnlOf(t); }, 0));
    const pf = gl > 0 ? gp / gl : (gp > 0 ? 3 : 0);
    const pfScore = Math.min(100, (pf / 3) * 100);
    const avgWin = winners.length ? gp / winners.length : 0;
    const avgLoss = losers.length ? gl / losers.length : 0;
    const avgRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 2 : 0);
    const avgRatioScore = Math.min(100, (avgRatio / 2) * 100);
    const daily = {};
    at.forEach(function (t) { const d = dateOf(t); if (d) daily[d] = (daily[d] || 0) + pnlOf(t); });
    const profits = Object.keys(daily).map(function (k) { return daily[k]; }).filter(function (p) { return p > 0; });
    const best = profits.length ? Math.max.apply(null, profits) : 0;
    const totDaily = profits.reduce(function (s, p) { return s + p; }, 0);
    const consScore = Math.max(0, 100 - (totDaily > 0 ? (best / totDaily) * 100 : 100));
    let cum = 0, maxP = 0, maxDD = 0;
    at.forEach(function (t) { cum += pnlOf(t); maxP = Math.max(maxP, cum); maxDD = Math.max(maxDD, maxP - cum); });
    const totProfit = Math.abs(cum);
    const ddScore = Math.max(0, 100 - (totProfit > 0 ? (maxDD / totProfit) * 100 : 0));
    const recF = maxDD > 0 ? totProfit / maxDD : (totProfit > 0 ? 5 : 0);
    const recScore = Math.min(100, (recF / 5) * 100);
    const w = { winRate: 0.20, profitFactor: 0.25, avgRatio: 0.20, consistency: 0.15, drawdown: 0.10, recovery: 0.10 };
    const g = wr * w.winRate + pfScore * w.profitFactor + avgRatioScore * w.avgRatio + consScore * w.consistency + ddScore * w.drawdown + recScore * w.recovery;
    rows.push({ winRate: wr, profitFactor: pfScore, avgRatio: avgRatioScore, consistency: consScore, drawdown: ddScore, recovery: recScore, global: g });
  });

  const round1 = function (v) { return Math.round(v * 10) / 10; };
  if (!rows.length) {
    return { globalScore: 0, components: { winRate: 0, profitFactor: 0, avgRatio: 0, consistency: 0, drawdown: 0, recovery: 0 } };
  }
  const avg = function (k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; };
  return {
    globalScore: round1(avg('global')),
    components: {
      winRate: avg('winRate'), profitFactor: avg('profitFactor'), avgRatio: avg('avgRatio'),
      consistency: avg('consistency'), drawdown: avg('drawdown'), recovery: avg('recovery')
    }
  };
}
