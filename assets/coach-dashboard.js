/* ============================================================================
   #33 Commit 2a — Dashboard coach AGRÉGÉ (cœur).
   - Hero P&L mois + 4 KPI (Win Rate moyen, Profit Factor agrégé, Total trades, T360 moyen)
   - Carte Trader 360 Score moyen + radar hexagonal (moyenne SIMPLE des 6 composantes)
   - Calendrier mensuel agrégé (somme P&L/jour) via la vue SQL coach_daily_aggregate
   Réutilise window.getAllStudentsData() (déjà chargé) pour le T360/Win Rate par élève.
   security_invoker : la vue hérite du RLS coach. Aucune écriture, lecture seule.
   ============================================================================ */
(function () {
  'use strict';

  var calDate = new Date(); // mois affiché (défaut : courant)
  var MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function pnlOf(t) { return parseFloat(t.pnl) || 0; }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function tradeMonthKey(t) { return String(t.trade_date || t.date || '').slice(0, 7); }

  // Win Rate d'un élève (exclut break-even, aligné #66)
  function winRate(trades) {
    if (!trades.length) return 0;
    var denom = trades.length, num = 0;
    trades.forEach(function (t) {
      var p = pnlOf(t), be = t.is_break_even === true || p === 0;
      if (be) denom--; else if (p > 0) num++;
    });
    return denom > 0 ? Math.round((num / denom) * 100) : 0;
  }

  // Trader 360 Score d'un élève (réplique dashboard/weekly-report : 6 composantes pondérées,
  // par compte actif puis moyenne). Renvoie { global, components{winRate,profitFactor,avgRatio,consistency,drawdown,recovery} }.
  function studentScore(trades, accounts) {
    var active = (accounts || []).filter(function (a) { return a.active !== false; });
    var rows = [];
    active.forEach(function (acc) {
      var at = trades.filter(function (t) { return t.account_id === acc.id; });
      if (!at.length) return;
      var winners = at.filter(function (t) { return pnlOf(t) > 0; });
      var losers = at.filter(function (t) { return pnlOf(t) < 0; });
      var wr = at.length ? (winners.length / at.length) * 100 : 0;
      var gp = winners.reduce(function (s, t) { return s + pnlOf(t); }, 0);
      var gl = Math.abs(losers.reduce(function (s, t) { return s + pnlOf(t); }, 0));
      var pf = gl > 0 ? gp / gl : (gp > 0 ? 3 : 0);
      var pfScore = Math.min(100, (pf / 3) * 100);
      var avgWin = winners.length ? gp / winners.length : 0;
      var avgLoss = losers.length ? gl / losers.length : 0;
      var avgRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 2 : 0);
      var avgRatioScore = Math.min(100, (avgRatio / 2) * 100);
      var daily = {};
      at.forEach(function (t) { var d = t.trade_date || t.date; if (d) daily[d] = (daily[d] || 0) + pnlOf(t); });
      var profits = Object.keys(daily).map(function (k) { return daily[k]; }).filter(function (p) { return p > 0; });
      var best = profits.length ? Math.max.apply(null, profits) : 0;
      var totDaily = profits.reduce(function (s, p) { return s + p; }, 0);
      var consRatio = totDaily > 0 ? (best / totDaily) * 100 : 100;
      var consScore = Math.max(0, 100 - consRatio);
      var cum = 0, maxP = 0, maxDD = 0;
      at.forEach(function (t) { cum += pnlOf(t); maxP = Math.max(maxP, cum); maxDD = Math.max(maxDD, maxP - cum); });
      var totProfit = Math.abs(cum);
      var ddPct = totProfit > 0 ? (maxDD / totProfit) * 100 : 0;
      var ddScore = Math.max(0, 100 - ddPct);
      var recF = maxDD > 0 ? totProfit / maxDD : (totProfit > 0 ? 5 : 0);
      var recScore = Math.min(100, (recF / 5) * 100);
      var w = { winRate: 0.20, profitFactor: 0.25, avgRatio: 0.20, consistency: 0.15, drawdown: 0.10, recovery: 0.10 };
      var g = wr * w.winRate + pfScore * w.profitFactor + avgRatioScore * w.avgRatio + consScore * w.consistency + ddScore * w.drawdown + recScore * w.recovery;
      rows.push({ winRate: wr, profitFactor: pfScore, avgRatio: avgRatioScore, consistency: consScore, drawdown: ddScore, recovery: recScore, global: g });
    });
    if (!rows.length) return null;
    var avg = function (k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; };
    return { global: avg('global'), components: { winRate: avg('winRate'), profitFactor: avg('profitFactor'), avgRatio: avg('avgRatio'), consistency: avg('consistency'), drawdown: avg('drawdown'), recovery: avg('recovery') } };
  }

  // Radar hexagonal SVG (client-side, browser fonts OK)
  function radarSVG(c) {
    var axes = [
      { label: 'Win %', v: Math.round(c.winRate || 0) },
      { label: 'Consistency', v: Math.round(c.consistency || 0) },
      { label: 'Profit factor', v: Math.round(c.profitFactor || 0) },
      { label: 'Max drawdown', v: Math.round(c.drawdown || 0) },
      { label: 'Avg win/loss', v: Math.round(c.avgRatio || 0) },
      { label: 'Recovery factor', v: Math.round(c.recovery || 0) }
    ];
    var cx = 180, cy = 180, R = 100;
    var ang = function (i) { return (-90 + i * 60) * Math.PI / 180; };
    var pt = function (i, val) { return { x: cx + R * (val / 100) * Math.cos(ang(i)), y: cy + R * (val / 100) * Math.sin(ang(i)) }; };
    var color = function (v) { return v >= 80 ? '#10b981' : (v >= 50 ? '#f59e0b' : '#ef4444'); };
    var grid = [25, 50, 75, 100].map(function (lvl) {
      var pts = [0,1,2,3,4,5].map(function (i) { var p = pt(i, lvl); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="rgba(212,175,55,' + (0.12 + lvl / 100 * 0.18).toFixed(2) + ')" stroke-width="1"/>';
    }).join('');
    var spokes = [0,1,2,3,4,5].map(function (i) { var p = pt(i, 100); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="rgba(212,175,55,0.20)" stroke-width="1"/>'; }).join('');
    var vpts = axes.map(function (a, i) { var p = pt(i, a.v); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    var poly = '<polygon points="' + vpts + '" fill="rgba(212,175,55,0.22)" stroke="#d4af37" stroke-width="2"/>';
    var dots = axes.map(function (a, i) { var p = pt(i, a.v); return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#d4af37"/>'; }).join('');
    var labels = axes.map(function (a, i) {
      var lp = { x: cx + (R + 34) * Math.cos(ang(i)), y: cy + (R + 34) * Math.sin(ang(i)) };
      var vp = { x: lp.x, y: lp.y - 15 };
      return '<text x="' + lp.x.toFixed(1) + '" y="' + lp.y.toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--aube-text-primary, #f4e4c1)" dominant-baseline="middle">' + a.label + '</text>'
        + '<text x="' + vp.x.toFixed(1) + '" y="' + vp.y.toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + color(a.v) + '" dominant-baseline="middle">' + a.v + '</text>';
    }).join('');
    return '<svg viewBox="0 0 360 360" width="300" height="300" style="max-width:100%;height:auto;" role="img" aria-label="Radar T360 moyen">' + grid + spokes + poly + dots + labels + '</svg>';
  }

  function renderCalendar(dailyMap) {
    var grid = document.getElementById('globalCalendarGrid');
    var label = document.getElementById('globalCalendarMonthYear');
    if (!grid) return;
    if (label) label.textContent = MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear();
    var y = calDate.getFullYear(), m = calDate.getMonth();
    var firstDow = new Date(y, m, 1).getDay(); // 0 = dimanche
    var nbDays = new Date(y, m + 1, 0).getDate();
    var html = '';
    for (var i = 0; i < firstDow; i++) html += '<div></div>';
    for (var d = 1; d <= nbDays; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var rec = dailyMap[iso];
      var cls = 'text-center py-3 rounded';
      var inner = '<div class="font-semibold">' + d + '</div>';
      if (rec && rec.total_trades > 0) {
        var p = rec.total_pnl;
        cls += p > 0 ? ' bg-green-100 text-green-800' : (p < 0 ? ' bg-red-200 text-red-900' : ' bg-gray-100');
        inner += '<div class="cell-pnl" style="font-size:0.95rem;">' + (p >= 0 ? '+' : '') + Math.round(p).toLocaleString('fr-FR') + '$</div>';
        inner += '<div style="font-size:10px;opacity:0.75;">' + rec.active_students + ' élève' + (rec.active_students > 1 ? 's' : '') + '</div>';
      } else {
        cls += ' text-gray-400';
      }
      html += '<div class="' + cls + '">' + inner + '</div>';
    }
    grid.innerHTML = html;
  }

  window.loadCoachDashboard = async function () {
    try {
      var sb = window.supabaseClient;
      var mKey = monthKey(calDate);

      // 1) Agrégat journalier (vue SQL) → calendrier + Hero + KPI mois
      var dailyMap = {};
      var monthPnl = 0, monthTrades = 0, monthWins = 0, monthLosses = 0, monthGross = 0, monthLoss = 0;
      var activeMonthStudents = 0;
      if (sb) {
        var res = await sb.from('coach_daily_aggregate').select('*');
        if (!res.error && res.data) {
          res.data.forEach(function (r) {
            dailyMap[r.trade_date] = r;
            if (String(r.trade_date).slice(0, 7) === mKey) {
              monthPnl += parseFloat(r.total_pnl) || 0;
              monthTrades += parseInt(r.total_trades) || 0;
              monthWins += parseInt(r.wins) || 0;
              monthLosses += parseInt(r.losses) || 0;
            }
          });
        }
      }
      renderCalendar(dailyMap);

      // 2) Données par élève (T360 moyen, Win Rate moyen, PF agrégé, active students mois)
      var students = (typeof window.getAllStudentsData === 'function') ? await window.getAllStudentsData() : [];
      var wrSum = 0, wrCount = 0, scoreSum = 0, scoreCount = 0;
      var compAcc = { winRate: 0, profitFactor: 0, avgRatio: 0, consistency: 0, drawdown: 0, recovery: 0 };
      students.forEach(function (s) {
        var trades = (s.data && s.data.trades) || [];
        var accounts = (s.data && s.data.accounts) || [];
        var monthT = trades.filter(function (t) { return tradeMonthKey(t) === mKey; });
        if (monthT.length > 0) {
          activeMonthStudents++;
          wrSum += winRate(monthT); wrCount++;
          monthT.forEach(function (t) { var p = pnlOf(t); if (p > 0) monthGross += p; else if (p < 0) monthLoss += Math.abs(p); });
        }
        // T360 sur l'historique complet de l'élève (sémantique "santé", comme côté élève)
        var sc = studentScore(trades, accounts);
        if (sc) {
          scoreSum += sc.global; scoreCount++;
          Object.keys(compAcc).forEach(function (k) { compAcc[k] += sc.components[k]; });
        }
      });

      // 3) Peupler le DOM
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      var fmt$ = function (v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      var heroEl = document.getElementById('coachHeroPnl');
      if (heroEl) { heroEl.textContent = fmt$(monthPnl); heroEl.style.color = monthPnl >= 0 ? '#10b981' : '#ef4444'; }
      set('coachHeroMonthLabel', MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear());
      set('coachHeroSub', activeMonthStudents + ' élève' + (activeMonthStudents > 1 ? 's' : '') + ' actif' + (activeMonthStudents > 1 ? 's' : '') + ' ce mois');

      var avgWR = wrCount > 0 ? Math.round(wrSum / wrCount) : 0;
      set('coachGlobalWinRate', avgWR + '%');
      var bar = document.getElementById('coachWinRateBar'); if (bar) bar.style.width = Math.min(100, avgWR) + '%';
      var pf = monthLoss > 0 ? (monthGross / monthLoss) : (monthGross > 0 ? 99.99 : 0);
      set('coachProfitFactor', pf >= 99.99 ? '∞' : pf.toFixed(2));
      set('coachTotalTrades', monthTrades.toLocaleString('fr-FR'));
      set('coachTotalWins', monthWins);
      set('coachTotalLosses', monthLosses);
      var avgScore = scoreCount > 0 ? (scoreSum / scoreCount) : 0;
      set('coachT360Score', avgScore.toFixed(1));

      var radarEl = document.getElementById('coachT360Radar');
      if (radarEl) {
        if (scoreCount > 0) {
          var comps = {}; Object.keys(compAcc).forEach(function (k) { comps[k] = compAcc[k] / scoreCount; });
          radarEl.innerHTML = radarSVG(comps);
        } else {
          radarEl.innerHTML = '<div style="color:var(--aube-text-secondary,rgba(255,255,255,0.6));padding:40px;">Aucune donnée élève</div>';
        }
      }
      console.log('[COACH-DASH] ✅ Rendu : Hero ' + fmt$(monthPnl) + ', WR moyen ' + avgWR + '%, T360 moyen ' + avgScore.toFixed(1) + ' (' + scoreCount + ' élèves)');
    } catch (e) {
      console.error('[COACH-DASH] ❌', e);
    }
  };

  window.previousGlobalMonth = function () { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); window.loadCoachDashboard(); };
  window.nextGlobalMonth = function () { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); window.loadCoachDashboard(); };
})();
