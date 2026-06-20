// ========================================================================
// #19 — Système expert + design + Trader 360 Score pour le rapport hebdo
// Module partagé entre /api/cron/weekly-report.js et /api/preview/weekly-report.js
// 100% rules-based (0€ d'IA). Formules répliquées du dashboard pour cohérence.
// ========================================================================

// ---- Helpers numériques de base ----
const num = (v) => (parseFloat(v) || 0);
const pnlOf = (t) => num(t.pnl);
const dateOf = (t) => String(t.trade_date || t.date || '').slice(0, 10);
const hourOf = (t) => parseInt(String(t.entry_time || '').split(':')[0], 10);
const directionOf = (t) => String(t.direction || t.trade_type || '').toUpperCase();

function protectionsCount(t) {
  const p = t.protections;
  if (!p) return 0;
  if (Array.isArray(p)) return p.filter(Boolean).length;
  return String(p).split(',').map(s => s.trim()).filter(Boolean).length;
}

// ---- Win Rate (exclut break-even, aligné #66) ----
function computeWinRate(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  let denom = trades.length, num_ = 0;
  for (const t of trades) {
    const pnl = pnlOf(t);
    const isBE = t.is_break_even === true || pnl === 0;
    if (isBE) denom -= 1;
    else if (pnl > 0) num_ += 1;
  }
  return denom > 0 ? Math.round((num_ / denom) * 100) : 0;
}

// ---- Profit Factor (Total PF, aligné #66) ----
function computeProfitFactor(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  let gp = 0, gl = 0;
  for (const t of trades) {
    const pnl = pnlOf(t);
    if (pnl > 0) gp += pnl; else if (pnl < 0) gl += Math.abs(pnl);
  }
  if (gl === 0) return gp > 0 ? 99.99 : 0;
  return Math.round((gp / gl) * 100) / 100;
}

// ---- RR total par trade (R du compte de chaque trade) ----
function computeTotalRR(trades, accounts) {
  if (!Array.isArray(trades) || trades.length === 0) return null;
  let total = 0, hasAny = false;
  for (const t of trades) {
    const acc = (accounts || []).find(a => a.id === t.account_id || a.id === t.accountId);
    const r = acc && acc.risk_per_trade ? num(acc.risk_per_trade) : 0;
    if (r > 0) { total += pnlOf(t) / r; hasAny = true; }
  }
  return hasAny ? total : null;
}

function groupByDate(trades) {
  const map = {};
  for (const t of trades) {
    const d = dateOf(t);
    if (!d) continue;
    (map[d] = map[d] || []).push(t);
  }
  return map;
}

function computeLongestLossStreak(trades) {
  // chronologique par date + heure
  const sorted = [...trades].filter(dateOf).sort((a, b) =>
    (`${dateOf(a)} ${a.entry_time || '00:00'}`).localeCompare(`${dateOf(b)} ${b.entry_time || '00:00'}`));
  let cur = 0, max = 0;
  for (const t of sorted) { if (pnlOf(t) < 0) { cur++; max = Math.max(max, cur); } else cur = 0; }
  return max;
}

function detectRevengeTrades(trades, accounts) {
  const sorted = [...trades].filter(dateOf).sort((a, b) =>
    (`${dateOf(a)} ${a.entry_time || '00:00'}`).localeCompare(`${dateOf(b)} ${b.entry_time || '00:00'}`));
  const losses = sorted.filter(t => pnlOf(t) < 0);
  const avgLoss = losses.length ? losses.reduce((s, t) => s + Math.abs(pnlOf(t)), 0) / losses.length : 0;
  const isBigLoss = (t) => {
    if (pnlOf(t) >= 0) return false;
    const acc = (accounts || []).find(a => a.id === t.account_id);
    const r = acc && acc.risk_per_trade ? num(acc.risk_per_trade) : 0;
    if (r > 0) return Math.abs(pnlOf(t)) > r;
    return avgLoss > 0 && Math.abs(pnlOf(t)) > avgLoss * 1.5;
  };
  const revenge = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const t = sorted[i], next = sorted[i + 1];
    if (isBigLoss(t) && dateOf(t) === dateOf(next) && t.exit_time && next.entry_time) {
      const ex = t.exit_time.split(':'), en = next.entry_time.split(':');
      const exitMin = (parseInt(ex[0]) || 0) * 60 + (parseInt(ex[1]) || 0);
      const entryMin = (parseInt(en[0]) || 0) * 60 + (parseInt(en[1]) || 0);
      const gap = entryMin - exitMin;
      if (gap >= 0 && gap <= 5) revenge.push(next);
    }
  }
  return revenge;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ========================================================================
// TRADER 360 SCORE — réplique exacte du dashboard (index.html ~13597-13700)
// Par compte actif puis moyenne. Composants : winRate, profitFactor, avgRatio,
// consistency, drawdown, recovery (poids 0.20/0.25/0.20/0.15/0.10/0.10).
// ========================================================================
function computeTraderScore(trades, accounts) {
  const activeAccounts = (accounts || []).filter(a => a.active !== false);
  const accountScores = [];
  for (const account of activeAccounts) {
    const at = trades.filter(t => t.account_id === account.id);
    if (at.length === 0) continue;
    const winners = at.filter(t => pnlOf(t) > 0);
    const losers = at.filter(t => pnlOf(t) < 0);

    const winRate = at.length > 0 ? (winners.length / at.length) * 100 : 0;
    const grossProfit = winners.reduce((s, t) => s + pnlOf(t), 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + pnlOf(t), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 3 : 0);
    const profitFactorScore = Math.min(100, (profitFactor / 3) * 100);
    const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
    const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
    const avgRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 2 : 0);
    const avgRatioScore = Math.min(100, (avgRatio / 2) * 100);

    const dailyPnL = {};
    at.forEach(t => { const d = dateOf(t); if (d) dailyPnL[d] = (dailyPnL[d] || 0) + pnlOf(t); });
    const dailyProfits = Object.values(dailyPnL).filter(p => p > 0);
    const bestDay = dailyProfits.length > 0 ? Math.max(...dailyProfits) : 0;
    const totalDailyGrossProfit = dailyProfits.reduce((s, p) => s + p, 0);
    const consistencyRatio = totalDailyGrossProfit > 0 ? (bestDay / totalDailyGrossProfit) * 100 : 100;
    const consistencyScore = Math.max(0, 100 - consistencyRatio);

    let cumulative = 0, maxPnl = 0, maxDrawdown = 0;
    at.forEach(t => { cumulative += pnlOf(t); maxPnl = Math.max(maxPnl, cumulative); maxDrawdown = Math.max(maxDrawdown, maxPnl - cumulative); });
    const totalProfit = Math.abs(cumulative);
    const drawdownPct = totalProfit > 0 ? (maxDrawdown / totalProfit) * 100 : 0;
    const drawdownScore = Math.max(0, 100 - drawdownPct);
    const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : (totalProfit > 0 ? 5 : 0);
    const recoveryScore = Math.min(100, (recoveryFactor / 5) * 100);

    const w = { winRate: 0.20, profitFactor: 0.25, avgRatio: 0.20, consistency: 0.15, drawdown: 0.10, recovery: 0.10 };
    const globalScore = winRate * w.winRate + profitFactorScore * w.profitFactor + avgRatioScore * w.avgRatio
      + consistencyScore * w.consistency + drawdownScore * w.drawdown + recoveryScore * w.recovery;

    accountScores.push({ winRate, profitFactor: profitFactorScore, avgRatio: avgRatioScore, consistency: consistencyScore, drawdown: drawdownScore, recovery: recoveryScore, globalScore });
  }

  if (accountScores.length === 0) {
    return { globalScore: 0, components: { winRate: 0, profitFactor: 0, avgRatio: 0, consistency: 0, drawdown: 0, recovery: 0 } };
  }
  const avg = (k) => accountScores.reduce((s, a) => s + a[k], 0) / accountScores.length;
  return {
    globalScore: Math.round(avg('globalScore') * 10) / 10,
    components: {
      winRate: Math.round(avg('winRate')),
      profitFactor: Math.round(avg('profitFactor')),
      avgRatio: Math.round(avg('avgRatio')),
      consistency: Math.round(avg('consistency')),
      drawdown: Math.round(avg('drawdown')),
      recovery: Math.round(avg('recovery')),
    }
  };
}

const COMPONENT_RECOMMENDATIONS = {
  winRate: { label: 'Win Rate', recommendation: "Ton Win Rate est en dessous du seuil sain (50%). Cette semaine, focus sur la qualité d'entrée : valide les 3 protections (Setup + Target + Invalidation) AVANT chaque trade. Mieux vaut 2 trades de qualité que 5 trades précipités." },
  profitFactor: { label: 'Profit Factor', recommendation: "Ton Profit Factor est faible : tes pertes annulent tes gains. Cette semaine, mesure pour chaque trade perdant si tu as respecté ton stop loss. Si non = tu agrandis tes pertes, c'est LA priorité." },
  avgRatio: { label: 'Ratio Gain/Perte', recommendation: "Ton ratio gain moyen / perte moyenne est faible. Tu fermes tes gagnants trop tôt OU laisses courir tes pertes. Action : sors strictement sur le RR1/RR2 défini avant le trade. Pas avant, pas après." },
  consistency: { label: 'Régularité', recommendation: "Tes profits dépendent trop d'un seul jour. Quand ce jour disparaît, ta semaine s'effondre. Cette semaine, vise 3 jours profitables minimum, même de petits montants. La régularité bat l'éclat." },
  drawdown: { label: 'Max Drawdown', recommendation: "Ton drawdown maximum est trop important. Cette semaine : si tu enchaînes 2 pertes consécutives → cap à 3 trades MAX dans la journée + revue de la session avant de repartir." },
  recovery: { label: 'Recovery Factor', recommendation: "Tu mets trop de temps à récupérer tes pertes (ratio Profit/Drawdown insuffisant). Renforce : 1 session perdante = STOP immédiat, journal obligatoire, retour le lendemain seulement." },
};

function findWeakestComponent(components) {
  let weakest = null;
  for (const [name, score] of Object.entries(components)) {
    if (!weakest || score < weakest.score) weakest = { name, score };
  }
  if (!weakest) return null;
  const meta = COMPONENT_RECOMMENDATIONS[weakest.name] || { label: weakest.name, recommendation: '' };
  return { name: weakest.name, score: weakest.score, label: meta.label, recommendation: meta.recommendation };
}

// ========================================================================
// SYSTÈME EXPERT — règles de détection
// ========================================================================
function runExpertSystem(trades, journalEntries, score, accounts, historicalTrades) {
  const insights = [];
  const tradesByDay = groupByDate(trades);

  // R1 — Win Rate vs norme historique
  if ((historicalTrades || []).length >= 50) {
    const histWR = computeWinRate(historicalTrades);
    const weekWR = computeWinRate(trades);
    if (weekWR < histWR - 10) {
      insights.push({ severity: 'high', type: 'win_rate_drop',
        message: `Ton Win Rate cette semaine (${weekWR}%) est en baisse de ${histWR - weekWR}pts vs ta norme historique (${histWR}%).`,
        action: "Vérifie : as-tu changé tes critères d'entrée cette semaine ? Reste discipliné sur ta méthode." });
    }
  }

  // R2 — Surtrading
  const surtradingDays = Object.entries(tradesByDay).filter(([, ts]) => ts.length > 4);
  if (surtradingDays.length >= 3) {
    insights.push({ severity: 'high', type: 'overtrading',
      message: `${surtradingDays.length} journées de surtrading cette semaine (plus de 4 trades/jour). La méthode T360 enseigne 3-4 max.`,
      action: "Pose-toi une règle stricte : après 4 trades, fermeture de la plateforme, point final." });
  }

  // R3 — Revenge trading
  const revenge = detectRevengeTrades(trades, accounts);
  if (revenge.length >= 2) {
    const impact = revenge.reduce((s, t) => s + pnlOf(t), 0);
    insights.push({ severity: 'high', type: 'revenge_trading',
      message: `${revenge.length} trades-vengeance détectés (trade <5min après une perte > R). Impact P&L cumulé : ${impact >= 0 ? '+' : ''}${Math.round(impact)}$.`,
      action: "Après chaque perte > R, ferme la plateforme 15 minutes. Reviens calme ou ne reviens pas." });
  }

  // R4 — Sessions tardives
  const late = trades.filter(t => { const h = hourOf(t); return isFinite(h) && h >= 17; });
  if (late.length >= 3) {
    const lateWR = computeWinRate(late);
    if (lateWR < 40) {
      insights.push({ severity: 'medium', type: 'late_sessions',
        message: `${late.length} sessions tardives (≥17h) cette semaine avec un Win Rate de ${lateWR}%.`,
        action: "Cap horaire à 17h. Passé cette heure, tu cherches à rattraper, pas à trader." });
    }
  }

  // R5 — Streak pertes consécutives
  const streak = computeLongestLossStreak(trades);
  if (streak >= 3) {
    insights.push({ severity: 'medium', type: 'loss_streak',
      message: `Plus longue série de pertes consécutives cette semaine : ${streak}.`,
      action: "Règle d'or : 2 pertes consécutives = pause. 3 pertes = arrêt de la session." });
  }

  // R6 — Hors-méthode > 30%
  if (trades.length > 0) {
    const horsPct = Math.round((trades.filter(t => t.is_hors_methode).length / trades.length) * 100);
    if (horsPct > 30) {
      insights.push({ severity: 'high', type: 'off_method',
        message: `${horsPct}% de tes trades sont marqués Hors-méthode cette semaine.`,
        action: "C'est ta zone à risque n°1. Engagement : -50% de trades Hors-méthode la semaine prochaine." });
    }
  }

  // R7 — Protections absentes sur trades perdants
  const losers = trades.filter(t => pnlOf(t) < 0);
  if (losers.length >= 3) {
    const protectedLosses = losers.filter(t => protectionsCount(t) >= 3);
    const pct = Math.round((protectedLosses.length / losers.length) * 100);
    if (pct < 60) {
      insights.push({ severity: 'high', type: 'protections_skipped',
        message: `Seulement ${pct}% de tes trades perdants avaient leurs 3 protections renseignées.`,
        action: "Les protections ne sont pas optionnelles. Sans Setup + Target + Invalidation = pas de trade." });
    }
  }

  // R8 — Meilleur jour (positif)
  const dayPnls = Object.entries(tradesByDay).map(([d, ts]) => [d, ts.reduce((s, t) => s + pnlOf(t), 0)]);
  const best = dayPnls.sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) {
    insights.push({ severity: 'positive', type: 'best_day',
      message: `Belle session le ${formatDate(best[0])} : +${Math.round(best[1])}$.`,
      action: "Identifie ce qui a marché ce jour-là (préparation, sessions tradées, type de trades) et reproduis le pattern." });
  }

  // R9 — Avg Win/Loss < 1
  const winners = trades.filter(t => pnlOf(t) > 0);
  const avgWin = winners.length ? winners.reduce((s, t) => s + pnlOf(t), 0) / winners.length : 0;
  const avgLoss = losers.length ? Math.abs(losers.reduce((s, t) => s + pnlOf(t), 0) / losers.length) : 0;
  if (avgLoss > 0 && avgWin / avgLoss < 1) {
    insights.push({ severity: 'medium', type: 'low_rr',
      message: `Ton gain moyen (${Math.round(avgWin)}$) est inférieur à ta perte moyenne (${Math.round(avgLoss)}$).`,
      action: "Laisse courir tes gagnants : cible le RR1/RR2 défini AVANT et tiens-le. La discipline sur la sortie = 50% du résultat." });
  }

  // R10 — Biais directionnel LONG/SHORT
  const longs = trades.filter(t => directionOf(t).includes('LONG'));
  const shorts = trades.filter(t => directionOf(t).includes('SHORT'));
  if (longs.length >= 3 && shorts.length >= 3) {
    const lWR = computeWinRate(longs), sWR = computeWinRate(shorts);
    if (Math.abs(lWR - sWR) > 25) {
      const better = lWR > sWR ? 'LONG' : 'SHORT';
      insights.push({ severity: 'medium', type: 'directional_bias',
        message: `Forte asymétrie LONG/SHORT cette semaine : tu gagnes nettement mieux en ${better} (${better === 'LONG' ? lWR : sWR}% vs ${better === 'LONG' ? sWR : lWR}%).`,
        action: `Soit c'est un edge réel à exploiter (privilégie les ${better}), soit un biais à corriger. Observe-le.` });
    }
  }

  // R11 — Session AM vs PM
  const am = trades.filter(t => { const h = hourOf(t); return isFinite(h) && h < 12; });
  const pm = trades.filter(t => { const h = hourOf(t); return isFinite(h) && h >= 12; });
  if (am.length >= 3 && pm.length >= 3) {
    const amWR = computeWinRate(am), pmWR = computeWinRate(pm);
    if (pmWR > amWR + 15) {
      insights.push({ severity: 'low', type: 'session_pattern',
        message: `Tu performes mieux en PM (${pmWR}%) qu'en AM (${amWR}%) cette semaine.`,
        action: "La méthode T360 privilégie l'AM ; si ton edge est PM, identifie pourquoi (volatilité, type de setup)." });
    }
  }

  // R12 — Un seul instrument
  const instruments = [...new Set(trades.map(t => (t.symbol || t.instrument || '').toUpperCase()).filter(Boolean))];
  if (instruments.length === 1 && trades.length >= 5) {
    insights.push({ severity: 'low', type: 'single_instrument',
      message: `Tu n'as tradé que ${instruments[0]} cette semaine.`,
      action: "Pas un problème si c'est volontaire. Sinon, teste si d'autres instruments offrent de meilleures opportunités sur tes setups." });
  }

  // === BLOC MENTAL (journal) ===
  const tradedDays = Object.keys(tradesByDay).length;
  const journaledDays = (journalEntries || []).length;

  // R13 — Journal peu rempli
  if (tradedDays > 0 && (journaledDays / tradedDays) < 0.3) {
    insights.push({ severity: 'high', type: 'journal_missing',
      message: `Tu n'as rempli ton journal que ${journaledDays} jour(s) sur ${tradedDays} tradés.`,
      action: "Sans journal, pas de progrès mental. Engagement : 1 minute de notes APRÈS chaque session, non négociable." });
  }

  // R14 — Erreur récurrente
  const allErrors = (journalEntries || []).flatMap(e => Array.isArray(e.errors_committed) ? e.errors_committed : []);
  if (allErrors.length > 0) {
    const counts = {};
    allErrors.forEach(e => { const k = (e && e.text) ? e.text : e; counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      insights.push({ severity: 'high', type: 'recurring_error',
        message: `Erreur récurrente cette semaine : « ${top[0]} » (${top[1]}×).`,
        action: "Cible n°1 pour la semaine prochaine. Mets-toi un rappel post-trade dessus." });
    }
  }

  // R15 — Émotions négatives dominantes
  const emotions = (journalEntries || []).flatMap(e => [e.emotion_before, e.emotion_after].filter(Boolean));
  const negatives = ['Nerveux', 'Inquiet', 'Frustré', 'Déçu', 'Énervé', 'Stressé', 'Anxieux'];
  const negCount = emotions.filter(e => negatives.some(n => String(e).toLowerCase().includes(n.toLowerCase()))).length;
  if (negCount >= 3) {
    insights.push({ severity: 'medium', type: 'negative_emotions',
      message: `${negCount} émotions négatives notées dans ton journal cette semaine.`,
      action: "Avant la prochaine session : 5 min de cohérence cardiaque + relecture de ton Pourquoi." });
  }

  return insights;
}

const SEV_RANK = { high: 0, medium: 1, low: 2, positive: 3 };

function buildActionPlan(insights, weakest) {
  const sorted = [...insights].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
  const actions = [];
  for (const i of sorted) {
    if (i.severity === 'positive') continue;
    if (i.action && !actions.includes(i.action)) actions.push(i.action);
    if (actions.length >= 3) break;
  }
  // Compléter avec la reco du composant le plus faible
  if (actions.length < 3 && weakest && weakest.recommendation && !actions.includes(weakest.recommendation)) {
    actions.push(weakest.recommendation);
  }
  // Compléter avec une action positive (best day)
  if (actions.length < 3) {
    const positive = sorted.find(i => i.severity === 'positive');
    if (positive && positive.action && !actions.includes(positive.action)) actions.push(positive.action);
  }
  // Fallback générique
  if (actions.length === 0) {
    actions.push("Continue de tenir ton journal après chaque session : la régularité est la base du progrès.");
  }
  return actions.slice(0, 3);
}

// ========================================================================
// DESIGN EMAIL — Bourse à l'Aube (dark, table-based, compatible clients mail)
// ========================================================================
const PALETTE = {
  bgNavy: '#000B25', gold: '#d4af37', goldFrame: 'rgba(201, 162, 75, 0.55)',
  champagne: '#f4e4c1', bronze: '#b9a37e', emerald: '#10b981', coral: '#ef4444',
  glass: 'rgba(15, 28, 58, 0.65)'
};
const SEV_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#eab308', positive: '#10b981' };

function kpiCard(label, value, color) {
  return `<td style="width:25%; padding:4px; vertical-align:top;">
    <div style="background:rgba(212,175,55,0.05); border:1px solid rgba(201,162,75,0.40); border-radius:10px; padding:14px 6px; text-align:center;">
      <div style="color:${PALETTE.bronze}; font-size:10px; letter-spacing:0.10em; text-transform:uppercase;">${label}</div>
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:22px; font-weight:700; color:${color || PALETTE.champagne}; margin-top:6px;">${value}</div>
    </div>
  </td>`;
}

function insightCard(i) {
  const color = SEV_COLOR[i.severity] || PALETTE.gold;
  return `<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-left:4px solid ${color}; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
    <div style="color:${PALETTE.champagne}; font-size:14px; line-height:1.5; margin-bottom:6px;">${i.message}</div>
    <div style="color:${PALETTE.bronze}; font-size:13px; line-height:1.5;">→ ${i.action}</div>
  </div>`;
}

function generateWeeklyReportHTML({ user, trades, journalEntries, accounts, historicalTrades, startDate, endDate }) {
  const totalTrades = trades.length;
  const totalPnl = trades.reduce((s, t) => s + pnlOf(t), 0);
  const winRate = computeWinRate(trades);
  const pf = computeProfitFactor(trades);
  const pfDisplay = pf >= 99.99 ? '∞' : pf.toFixed(2);
  const totalRR = computeTotalRR(trades, accounts);
  const score = computeTraderScore(trades, accounts);
  const weakest = findWeakestComponent(score.components);
  const insights = runExpertSystem(trades, journalEntries, score, accounts, historicalTrades);
  const actions = buildActionPlan(insights, weakest);

  const pnlColor = totalPnl >= 0 ? PALETTE.emerald : PALETTE.coral;
  const pnlSign = totalPnl >= 0 ? '+' : '-';
  const pnlAbs = Math.abs(totalPnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rrLine = totalRR !== null ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:16px; color:${pnlColor}; opacity:0.85; margin-top:4px;">≈ ${totalRR >= 0 ? '+' : ''}${totalRR.toFixed(1)}R</div>` : '';

  const hairline = `<div style="height:1px; background:linear-gradient(to right, transparent, rgba(201,162,55,0.55) 50%, transparent); margin:28px 0;"></div>`;
  const userName = (user && (user.name || user.email)) ? (user.name || user.email) : 'Trader';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Rapport hebdomadaire — Trader 360</title></head>
<body style="margin:0; padding:0; background:${PALETTE.bgNavy};">
<div style="background:${PALETTE.bgNavy}; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${PALETTE.champagne};">
  <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:${PALETTE.glass}; border:1px solid ${PALETTE.goldFrame}; border-radius:14px;">
    <tr><td style="padding:32px;">

      <div style="text-align:center; margin-bottom:28px;">
        <img src="https://journaltrader360.fr/assets/trader360-logo-clean.png" width="72" alt="Trader 360" style="display:inline-block;">
        <h1 style="color:${PALETTE.gold}; font-size:22px; letter-spacing:0.12em; text-transform:uppercase; margin:16px 0 4px;">Rapport hebdomadaire</h1>
        <p style="color:${PALETTE.bronze}; font-style:italic; margin:0; font-size:14px;">${userName} · semaine du ${formatDate(startDate)} au ${formatDate(endDate)}</p>
      </div>

      <div style="background:rgba(212,175,55,0.05); border:1px solid rgba(201,162,75,0.40); border-radius:12px; padding:24px; text-align:center; margin-bottom:20px;">
        <div style="color:${PALETTE.bronze}; font-size:12px; letter-spacing:0.14em; text-transform:uppercase;">Net P&L de la semaine</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:40px; font-weight:700; color:${pnlColor}; line-height:1.2; margin-top:8px;">${pnlSign}$${pnlAbs}</div>
        ${rrLine}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        ${kpiCard('Win Rate', winRate + '%', winRate >= 50 ? PALETTE.emerald : PALETTE.coral)}
        ${kpiCard('Profit Factor', pfDisplay, pf >= 1 ? PALETTE.emerald : PALETTE.coral)}
        ${kpiCard('Trades', String(totalTrades), PALETTE.champagne)}
        ${kpiCard('T360 Score', String(score.globalScore), PALETTE.gold)}
      </tr></table>

      ${hairline}

      <h2 style="color:${PALETTE.gold}; font-size:15px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 16px;">📊 Analyse de ta semaine</h2>
      ${insights.length > 0 ? insights.map(insightCard).join('') : `<p style="color:${PALETTE.bronze}; font-size:14px;">Semaine propre, aucun pattern problématique détecté. Continue comme ça.</p>`}

      ${weakest ? `<div style="background:rgba(212,175,55,0.08); border-left:4px solid ${PALETTE.gold}; padding:16px 20px; border-radius:8px; margin:24px 0;">
        <div style="color:${PALETTE.gold}; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:8px;">Axe prioritaire — Trader 360 Score</div>
        <div style="color:${PALETTE.champagne}; font-size:14px; line-height:1.6;"><strong>${weakest.label}</strong> : ${weakest.score}/100<br>${weakest.recommendation}</div>
      </div>` : ''}

      ${hairline}

      <h2 style="color:${PALETTE.gold}; font-size:15px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 16px;">💡 Ton plan d'action — semaine prochaine</h2>
      <ol style="color:${PALETTE.champagne}; line-height:1.7; padding-left:20px; margin:0;">
        ${actions.map(a => `<li style="margin-bottom:12px;">${a}</li>`).join('')}
      </ol>

      <div style="text-align:center; margin-top:32px;">
        <a href="https://journaltrader360.fr" style="display:inline-block; background:${PALETTE.gold}; color:${PALETTE.bgNavy}; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:600; letter-spacing:0.04em;">Ouvrir mon journal →</a>
      </div>

      <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08); color:${PALETTE.bronze}; font-size:11px;">
        Trader 360 · rapport généré le ${formatDate(new Date().toISOString().split('T')[0])}<br>
        <em>Le trading comporte des risques de perte en capital.</em>
      </div>

    </td></tr>
  </table>
</div>
</body></html>`;
}

export {
  computeWinRate, computeProfitFactor, computeTotalRR, computeTraderScore,
  findWeakestComponent, runExpertSystem, buildActionPlan, generateWeeklyReportHTML,
  formatDate, COMPONENT_RECOMMENDATIONS,
};
