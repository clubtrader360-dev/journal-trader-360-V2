// ========================================================================
// #19 — Système expert + design + Trader 360 Score pour le rapport hebdo
// Module partagé entre /api/cron/weekly-report.js et /api/preview/weekly-report.js
// 100% rules-based (0€ d'IA). Formules répliquées du dashboard pour cohérence.
// ========================================================================

import { Resvg } from '@resvg/resvg-js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// resvg-js (Vercel Linux) ne charge AUCUNE font système → on embarque 2 .ttf open-source.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_FILES = [
  path.join(FONT_DIR, 'Inter-Regular.ttf'),
  path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf'),
];
for (const f of FONT_FILES) {
  if (!fs.existsSync(f)) console.warn(`[WEEKLY-REPORT] ⚠️ Font manquante : ${f} — labels radar invisibles`);
}

// ---- Helpers numériques de base ----
const num = (v) => (parseFloat(v) || 0);
const pnlOf = (t) => num(t.pnl);
const dateOf = (t) => String(t.trade_date || t.date || '').slice(0, 10);
// #91 — entry_time/exit_time sont des TIMESTAMP ("2026-06-25T09:22:00" ou "2026-06-25 09:22:00"),
// pas des "HH:MM". On extrait toujours la 1re occurrence HH:MM (gère aussi un "HH:MM" nu).
// Sans ça, split(':')[0] renvoyait "2026-06-25 09" → parseInt = 2026 → toutes les sessions
// flaggées ≥17h, tout classé PM, et le gap revenge faussé. Pattern aligné sur le fix coach 2b-iii.
const timeStr = (v) => { const m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? (m[1].padStart(2, '0') + ':' + m[2]) : ''; };
const hourOf = (t) => parseInt(timeStr(t.entry_time).split(':')[0], 10);
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
    (`${dateOf(a)} ${timeStr(a.entry_time) || '00:00'}`).localeCompare(`${dateOf(b)} ${timeStr(b.entry_time) || '00:00'}`));
  let cur = 0, max = 0;
  for (const t of sorted) { if (pnlOf(t) < 0) { cur++; max = Math.max(max, cur); } else cur = 0; }
  return max;
}

function detectRevengeTrades(trades, accounts) {
  const sorted = [...trades].filter(dateOf).sort((a, b) =>
    (`${dateOf(a)} ${timeStr(a.entry_time) || '00:00'}`).localeCompare(`${dateOf(b)} ${timeStr(b.entry_time) || '00:00'}`));
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
    const exT = timeStr(t.exit_time), enT = timeStr(next.entry_time);
    if (isBigLoss(t) && dateOf(t) === dateOf(next) && exT && enT) {
      const ex = exT.split(':'), en = enT.split(':');
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
// #19 — Palette LIGHT theme Bourse à l'Aube (meilleure délivrabilité + cohérence inbox claire).
// Approche A : aliases legacy (bgNavy/glass/champagne/bronze) remappés vers le clair → diff minimal.
const PALETTE = {
  bgPage: '#fdfaf3', bgCard: '#ffffff', bgInside: '#fdf8ed', bgInsightSoft: '#faf6ec',
  gold: '#ac862b', goldBright: '#d4af37', goldFrame: '#d4af37', goldFrameSoft: 'rgba(212, 175, 55, 0.45)',
  textPrimary: '#1a1208', textSecondary: '#5a5040', textMuted: '#7a6b50',
  emerald: '#067a4f', coral: '#c62828', amber: '#d97706', yellow: '#ca8a04',
  // aliases legacy (remappés clair)
  bgNavy: '#fdfaf3', glass: '#ffffff', champagne: '#1a1208', bronze: '#5a5040',
};
const SEV_COLOR = { high: '#c62828', medium: '#d97706', low: '#ca8a04', positive: '#067a4f' };

function kpiCard(label, value, color) {
  return `<td style="width:25%; padding:4px; vertical-align:top;">
    <div style="background:${PALETTE.bgInside}; border:1px solid ${PALETTE.goldFrame}; border-radius:10px; padding:14px 6px; text-align:center;">
      <div style="color:${PALETTE.textSecondary}; font-size:10px; letter-spacing:0.10em; text-transform:uppercase;">${label}</div>
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:22px; font-weight:700; color:${color || PALETTE.champagne}; margin-top:6px;">${value}</div>
    </div>
  </td>`;
}

function insightCard(i) {
  const color = SEV_COLOR[i.severity] || PALETTE.gold;
  return `<div style="background:${PALETTE.bgInsightSoft}; border:1px solid rgba(212,175,55,0.20); border-left:4px solid ${color}; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
    <div style="color:${PALETTE.textPrimary}; font-size:14px; line-height:1.5; margin-bottom:6px;">${i.message}</div>
    <div style="color:${PALETTE.textSecondary}; font-size:13px; line-height:1.5;">→ ${i.action}</div>
  </div>`;
}

// #19 — Radar hexagonal SVG inline (reproduit la card T360 Score du dashboard, compat email).
function buildT360RadarSVG(components) {
  const c = components || {};
  const axes = [
    { label: 'Win %',           value: Math.round(c.winRate || 0) },
    { label: 'Consistency',     value: Math.round(c.consistency || 0) },
    { label: 'Profit factor',   value: Math.round(c.profitFactor || 0) },
    { label: 'Max drawdown',    value: Math.round(c.drawdown || 0) },
    { label: 'Avg win/loss',    value: Math.round(c.avgRatio || 0) },
    { label: 'Recovery factor', value: Math.round(c.recovery || 0) },
  ];
  const cx = 180, cy = 180, R = 100;
  const angleAt = i => (-90 + i * 60) * Math.PI / 180;
  const point = (i, v) => ({ x: cx + R * (v / 100) * Math.cos(angleAt(i)), y: cy + R * (v / 100) * Math.sin(angleAt(i)) });
  const colorFor = v => v >= 80 ? PALETTE.emerald : (v >= 50 ? PALETTE.amber : PALETTE.coral);

  const gridLevels = [25, 50, 75, 100].map(level => {
    const pts = [0,1,2,3,4,5].map(i => { const p = point(i, level); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
    const opacity = (0.10 + (level / 100) * 0.20).toFixed(2);
    return `<polygon points="${pts}" fill="none" stroke="rgba(172,134,43,${opacity})" stroke-width="1"/>`;
  }).join('');
  const axesLines = [0,1,2,3,4,5].map(i => { const p = point(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(172,134,43,0.20)" stroke-width="1"/>`; }).join('');
  const valuePts = axes.map((a, i) => { const p = point(i, a.value); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
  const valuePolygon = `<polygon points="${valuePts}" fill="rgba(172,134,43,0.20)" stroke="${PALETTE.gold}" stroke-width="2"/>`;
  const dots = axes.map((a, i) => { const p = point(i, a.value); return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${PALETTE.gold}"/>`; }).join('');
  const labelsAndValues = axes.map((a, i) => {
    const lp = { x: cx + (R + 32) * Math.cos(angleAt(i)), y: cy + (R + 32) * Math.sin(angleAt(i)) };
    const vp = { x: lp.x, y: lp.y - 16 }; // valeur centrée PILE au-dessus du label (même X, offset Y constant)
    return `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" text-anchor="middle" font-family="Inter" font-size="12" fill="${PALETTE.textPrimary}" font-weight="700" dominant-baseline="middle">${a.label}</text>`
      + `<text x="${vp.x.toFixed(1)}" y="${vp.y.toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="${colorFor(a.value)}" font-weight="700" dominant-baseline="middle">${a.value}</text>`;
  }).join('');

  return `<svg viewBox="0 0 360 360" width="280" height="280" xmlns="http://www.w3.org/2000/svg" style="max-width:100%; height:auto;" role="img" aria-label="Radar T360 Score">${gridLevels}${axesLines}${valuePolygon}${dots}${labelsAndValues}</svg>`;
}

// #19 — Conversion du radar SVG en PNG data URI (Gmail/Outlook strippent le SVG inline).
// Rendu 600px (retina) pour un affichage net à 280px. Fond transparent (la card a déjà son fond).
function buildT360RadarPNG(components) {
  try {
    const svgString = buildT360RadarSVG(components);
    const resvg = new Resvg(svgString, { fitTo: { mode: 'width', value: 720 }, background: 'rgba(0,0,0,0)' });
    const pngBuffer = resvg.render().asPng();
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  } catch (e) {
    console.error('[WEEKLY-REPORT] ❌ Rendu radar PNG échoué:', e);
    return null; // fallback géré côté template (image omise)
  }
}

// #19 — Buffer PNG brut du radar (pour attachment CID inline Resend — Gmail bloque les data URI).
function buildT360RadarPNGBuffer(components) {
  const svgString = buildT360RadarSVG(components);
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: 720 },
    background: 'rgba(0,0,0,0)',
    font: {
      fontFiles: FONT_FILES.filter(f => fs.existsSync(f)),
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
      sansSerifFamily: 'Inter',
      monospaceFamily: 'JetBrains Mono',
    },
  });
  return resvg.render().asPng(); // Buffer Node natif
}

// radarMode : 'cid' (email — img cid: + attachment, Gmail-safe) ou 'datauri' (preview navigateur).
// Retourne { html, attachments } (attachments vide en mode datauri).
function generateWeeklyReportHTML({ user, trades, journalEntries, accounts, historicalTrades, startDate, endDate, radarMode = 'cid' }) {
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
  const RADAR_CID = 'radar-t360';
  let radarHtml, attachments = [];
  if (radarMode === 'cid') {
    // Email : PNG en attachment CID inline (Gmail bloque les data URI <img>).
    try {
      const buf = buildT360RadarPNGBuffer(score.components);
      radarHtml = `<img src="cid:${RADAR_CID}" width="280" height="280" alt="Radar T360 Score" style="max-width:100%; height:auto; display:inline-block;">`;
      attachments = [{ filename: 'radar-t360.png', content: buf.toString('base64'), content_id: RADAR_CID, content_type: 'image/png' }];
    } catch (e) {
      console.error('[WEEKLY-REPORT] ❌ Radar CID échoué, fallback SVG:', e);
      radarHtml = buildT360RadarSVG(score.components);
    }
  } else {
    // Preview navigateur : data URI (cid: ne s'affiche pas hors client mail).
    const dataUri = buildT360RadarPNG(score.components);
    radarHtml = dataUri
      ? `<img src="${dataUri}" width="280" height="280" alt="Radar T360 Score" style="max-width:100%; height:auto; display:inline-block;">`
      : buildT360RadarSVG(score.components);
  }

  const pnlColor = totalPnl >= 0 ? PALETTE.emerald : PALETTE.coral;
  const pnlSign = totalPnl >= 0 ? '+' : '-';
  const pnlAbs = Math.abs(totalPnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rrLine = totalRR !== null ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:16px; color:${pnlColor}; opacity:0.85; margin-top:4px;">≈ ${totalRR >= 0 ? '+' : ''}${totalRR.toFixed(1)}R</div>` : '';

  const hairline = `<div style="height:1px; background:linear-gradient(to right, transparent, ${PALETTE.goldFrame} 50%, transparent); margin:28px 0;"></div>`;
  const userName = (user && (user.name || user.email)) ? (user.name || user.email) : 'Trader';

  const html = `<!DOCTYPE html>
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

      <div style="background:${PALETTE.bgInside}; border:1px solid ${PALETTE.goldFrame}; border-radius:12px; padding:24px; text-align:center; margin-bottom:20px;">
        <div style="color:${PALETTE.textSecondary}; font-size:12px; letter-spacing:0.14em; text-transform:uppercase;">Net P&L de la semaine</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:40px; font-weight:700; color:${pnlColor}; line-height:1.2; margin-top:8px;">${pnlSign}$${pnlAbs}</div>
        ${rrLine}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        ${kpiCard('Win Rate', winRate + '%', winRate >= 50 ? PALETTE.emerald : PALETTE.coral)}
        ${kpiCard('Profit Factor', pfDisplay, pf >= 1 ? PALETTE.emerald : PALETTE.coral)}
        ${kpiCard('Trades', String(totalTrades), PALETTE.champagne)}
        ${kpiCard('T360 Score', String(score.globalScore), PALETTE.gold)}
      </tr></table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;"><tr><td style="background:${PALETTE.bgInside}; border:1px solid ${PALETTE.goldFrame}; border-radius:12px; padding:22px 16px; text-align:center;">
        <div style="color:${PALETTE.gold}; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:4px;">Trader 360 Score</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace; font-size:32px; font-weight:700; color:${PALETTE.gold}; line-height:1; margin-bottom:14px;">${score.globalScore.toFixed(1)}<span style="font-size:14px; color:${PALETTE.textSecondary};"> / 100</span></div>
        ${radarHtml}
        <div style="margin-top:10px; color:${PALETTE.textSecondary}; font-size:11px; font-style:italic;">Tes 6 dimensions de performance cette semaine</div>
      </td></tr></table>

      ${hairline}

      <h2 style="color:${PALETTE.gold}; font-size:15px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 16px;">📊 Analyse de ta semaine</h2>
      ${insights.length > 0 ? insights.map(insightCard).join('') : `<p style="color:${PALETTE.bronze}; font-size:14px;">Semaine propre, aucun pattern problématique détecté. Continue comme ça.</p>`}

      ${weakest ? `<div style="background:${PALETTE.bgInside}; border-left:4px solid ${PALETTE.gold}; padding:16px 20px; border-radius:8px; margin:24px 0;">
        <div style="color:${PALETTE.gold}; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:8px;">Axe prioritaire — Trader 360 Score</div>
        <div style="color:${PALETTE.champagne}; font-size:14px; line-height:1.6;"><strong>${weakest.label}</strong> : ${weakest.score}/100<br>${weakest.recommendation}</div>
      </div>` : ''}

      ${hairline}

      <h2 style="color:${PALETTE.gold}; font-size:15px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 16px;">💡 Ton plan d'action — semaine prochaine</h2>
      <ol style="color:${PALETTE.champagne}; line-height:1.7; padding-left:20px; margin:0;">
        ${actions.map(a => `<li style="margin-bottom:12px;">${a}</li>`).join('')}
      </ol>

      <div style="text-align:center; margin-top:32px;">
        <a href="https://journaltrader360.fr" style="display:inline-block; background:${PALETTE.goldBright}; color:#000B25; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:600; letter-spacing:0.04em;">Ouvrir mon journal →</a>
      </div>

      <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(212,175,55,0.30); color:${PALETTE.textMuted}; font-size:11px;">
        Trader 360 · rapport généré le ${formatDate(new Date().toISOString().split('T')[0])}<br>
        <em>Le trading comporte des risques de perte en capital.</em>
      </div>

    </td></tr>
  </table>
</div>
</body></html>`;
  return { html, attachments };
}

// ========================================================================
// RAPPORT PASSIF (#21) — élève sans journal dans les 3 derniers jours.
// Version alternative unique (motivation + article éducatif). Même DA/shell.
// ========================================================================
function generatePassiveReportHTML({ user }) {
  const userName = (user && (user.name || user.email)) ? (user.name || user.email) : 'Trader';
  const hairline = `<div style="height:1px; background:linear-gradient(to right, transparent, ${PALETTE.goldFrame} 50%, transparent); margin:28px 0;"></div>`;

  // Un point numéroté : badge or + titre gras + corps, séparateur or discret entre chaque.
  const point = (n, lead, body, withSep) => `
    <div style="margin:0 0 ${withSep ? '0' : '4px'};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="width:34px; vertical-align:top;">
          <div style="width:26px; height:26px; border-radius:50%; background:${PALETTE.bgInside}; border:1px solid ${PALETTE.goldFrame}; color:${PALETTE.gold}; font-family:'JetBrains Mono',ui-monospace,monospace; font-weight:700; font-size:13px; text-align:center; line-height:26px;">${n}</div>
        </td>
        <td style="vertical-align:top; padding-left:12px;">
          <div style="color:${PALETTE.textPrimary}; font-size:14.5px; line-height:1.7;"><strong style="color:${PALETTE.textPrimary};">${lead}</strong> ${body}</div>
        </td>
      </tr></table>
    </div>
    ${withSep ? `<div style="height:1px; background:rgba(212,175,55,0.25); margin:16px 0 16px 46px;"></div>` : ''}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ton rapport de la semaine — Trader 360</title></head>
<body style="margin:0; padding:0; background:${PALETTE.bgNavy};">
<div style="background:${PALETTE.bgNavy}; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${PALETTE.textPrimary};">
  <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:${PALETTE.glass}; border:1px solid ${PALETTE.goldFrame}; border-radius:14px;">
    <tr><td style="padding:32px;">

      <div style="text-align:center; margin-bottom:28px;">
        <img src="https://journaltrader360.fr/assets/trader360-logo-clean.png" width="72" alt="Trader 360" style="display:inline-block;">
        <h1 style="color:${PALETTE.gold}; font-size:22px; letter-spacing:0.12em; text-transform:uppercase; margin:16px 0 4px;">Ton rapport de la semaine</h1>
        <p style="color:${PALETTE.bronze}; font-style:italic; margin:0; font-size:14px;">${userName}</p>
      </div>

      <div style="background:${PALETTE.bgInside}; border:1px solid ${PALETTE.goldFrame}; border-radius:12px; padding:26px 24px; text-align:center; margin-bottom:24px;">
        <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:1.35; color:${PALETTE.textPrimary}; font-weight:700;">Cette semaine, tu n'as pas eu ton analyse.</div>
      </div>

      <p style="color:${PALETTE.textPrimary}; font-size:15px; line-height:1.75; margin:0 0 8px;">Pour te faire une vraie analyse de tes performances — T360 Score, radar des 6 dimensions, patterns identifiés, recommandations personnalisées — j'ai besoin de ta data. Cette semaine, tu n'as pas rempli ton journal dans les 3 derniers jours. Sans data récente, aucune analyse fiable n'est possible. C'est aussi simple que ça.</p>

      ${hairline}

      <h2 style="color:${PALETTE.gold}; font-size:16px; line-height:1.4; margin:0 0 18px;">Pourquoi le journal est LE seul chemin vers la profitabilité durable</h2>

      <p style="color:${PALETTE.textPrimary}; font-size:14.5px; line-height:1.75; margin:0 0 20px;">Depuis Jesse Livermore jusqu'à Brett Steenbarger, tous les grands traders imposent la même discipline : tenir un journal quotidien. Ce n'est pas du zèle académique, c'est la seule méthode qui permet de :</p>

      ${point(1, 'Distinguer la chance du skill.', 'Sans data, tu ne sauras jamais si tu gagnes parce que tu es bon ou parce que tu as eu du bol. La différence te sauvera quand le marché tournera contre toi.', true)}
      ${point(2, 'Identifier tes patterns émotionnels.', 'Le revenge trading, l\'overtrading, la peur de manquer une opportunité, la sortie prématurée : ces biais te coûtent des dizaines de pourcent par an. Tu ne les vois pas en temps réel. Tu les vois en relisant ton journal.', true)}
      ${point(3, 'Créer une boucle de feedback.', 'Chaque semaine, tu revois tes trades, tu identifies UNE erreur récurrente, tu la corriges. C\'est comme ça qu\'on passe de trader amateur à trader profitable. Il n\'y a pas d\'autre chemin.', true)}
      ${point(4, 'Bâtir une méthode réplicable.', 'Un système gagnant se documente. Sans journal, chaque trade est une improvisation. Avec journal, tu construis un processus solide qui tient dans le temps.', false)}

      <p style="color:${PALETTE.textPrimary}; font-size:14.5px; line-height:1.75; margin:22px 0 6px;">Trader 360 t'a donné le meilleur outil de journalisation trading francophone. Utilise-le. Chaque jour de trading. Sans exception.</p>
      <p style="color:${PALETTE.gold}; font-size:15px; font-weight:700; margin:0 0 8px;">La discipline commence là.</p>

      <div style="text-align:center; margin-top:32px;">
        <a href="https://www.journaltrader360.fr" style="display:inline-block; background:${PALETTE.goldBright}; color:#000B25; padding:16px 36px; border-radius:10px; text-decoration:none; font-weight:700; font-size:15px; letter-spacing:0.03em;">Ouvre ton journal maintenant</a>
      </div>

      <p style="text-align:center; color:${PALETTE.textSecondary}; font-size:14px; font-style:italic; margin:24px 0 0;">Tes coachs — Trader 360</p>

      <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(212,175,55,0.30); color:${PALETTE.textMuted}; font-size:11px;">
        Trader 360 · rapport généré le ${formatDate(new Date().toISOString().split('T')[0])}<br>
        <em>Le trading comporte des risques de perte en capital.</em>
      </div>

    </td></tr>
  </table>
</div>
</body></html>`;
  return html;
}

export {
  computeWinRate, computeProfitFactor, computeTotalRR, computeTraderScore,
  findWeakestComponent, runExpertSystem, buildActionPlan, generateWeeklyReportHTML,
  generatePassiveReportHTML,
  formatDate, COMPONENT_RECOMMENDATIONS,
};
