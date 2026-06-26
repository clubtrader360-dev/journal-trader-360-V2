/* ============================================================================
   #33 Dashboard coach AGRÉGÉ — commit 2a (cœur) + 2b-i (5e KPI radar, engrenage
   filtres calendrier $/R/%/Actions-Erreurs + persistance JSONB, 5 KPI mois).
   Lecture seule. Vue SQL coach_daily_aggregate (security_invoker) pour le $ ;
   R/% et T360 via window.getAllStudentsData() (déjà chargé) ; Actions/Erreurs via
   journal_entries (RLS coach). Réutilise computeTotalRR/computeTotalPercent (#78).
   ============================================================================ */
(function () {
  'use strict';

  var calDate = new Date();
  var MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var prefs = { showDollar: true, showR: false, showPercent: false, showActionsErrors: true };
  // Caches construits à chaque loadCoachDashboard (pour re-render rapide au toggle filtre)
  var cache = { dailyDollar: {}, dailyR: {}, dailyPct: {}, dailyActions: {}, dailyErrors: {} };

  function pnlOf(t) { return parseFloat(t.pnl) || 0; }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function tradeMonthKey(t) { return String(t.trade_date || t.date || '').slice(0, 7); }
  function dateOf(t) { return String(t.trade_date || t.date || '').slice(0, 10); }

  function winRate(trades) {
    if (!trades.length) return 0;
    var denom = trades.length, num = 0;
    trades.forEach(function (t) { var p = pnlOf(t), be = t.is_break_even === true || p === 0; if (be) denom--; else if (p > 0) num++; });
    return denom > 0 ? Math.round((num / denom) * 100) : 0;
  }

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
      at.forEach(function (t) { var d = dateOf(t); if (d) daily[d] = (daily[d] || 0) + pnlOf(t); });
      var profits = Object.keys(daily).map(function (k) { return daily[k]; }).filter(function (p) { return p > 0; });
      var best = profits.length ? Math.max.apply(null, profits) : 0;
      var totDaily = profits.reduce(function (s, p) { return s + p; }, 0);
      var consScore = Math.max(0, 100 - (totDaily > 0 ? (best / totDaily) * 100 : 100));
      var cum = 0, maxP = 0, maxDD = 0;
      at.forEach(function (t) { cum += pnlOf(t); maxP = Math.max(maxP, cum); maxDD = Math.max(maxDD, maxP - cum); });
      var totProfit = Math.abs(cum);
      var ddScore = Math.max(0, 100 - (totProfit > 0 ? (maxDD / totProfit) * 100 : 0));
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

  // Radar SVG. opts.mini = true → compact, sans labels.
  function radarSVG(c, opts) {
    opts = opts || {};
    var mini = !!opts.mini;
    var axes = [c.winRate, c.consistency, c.profitFactor, c.drawdown, c.avgRatio, c.recovery].map(function (v) { return Math.round(v || 0); });
    var labels = ['Win %', 'Consistency', 'Profit factor', 'Max drawdown', 'Avg win/loss', 'Recovery factor'];
    var size = mini ? 90 : 300;
    var box = mini ? 220 : 360;
    var cx = box / 2, cy = box / 2, R = mini ? 88 : 100;
    var ang = function (i) { return (-90 + i * 60) * Math.PI / 180; };
    var pt = function (i, val) { return { x: cx + R * (val / 100) * Math.cos(ang(i)), y: cy + R * (val / 100) * Math.sin(ang(i)) }; };
    var color = function (v) { return v >= 80 ? '#10b981' : (v >= 50 ? '#f59e0b' : '#ef4444'); };
    var grid = [25, 50, 75, 100].map(function (lvl) {
      var pts = [0,1,2,3,4,5].map(function (i) { var p = pt(i, lvl); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="rgba(212,175,55,' + (0.12 + lvl / 100 * 0.18).toFixed(2) + ')" stroke-width="1"/>';
    }).join('');
    var spokes = [0,1,2,3,4,5].map(function (i) { var p = pt(i, 100); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="rgba(212,175,55,0.18)" stroke-width="1"/>'; }).join('');
    var vpts = axes.map(function (v, i) { var p = pt(i, v); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    var poly = '<polygon points="' + vpts + '" fill="rgba(212,175,55,0.22)" stroke="#d4af37" stroke-width="2"/>';
    var dots = axes.map(function (v, i) { var p = pt(i, v); return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (mini ? 2.6 : 3.5) + '" fill="#d4af37"/>'; }).join('');
    var labelTxt = '';
    if (!mini) {
      labelTxt = axes.map(function (v, i) {
        var lp = { x: cx + (R + 34) * Math.cos(ang(i)), y: cy + (R + 34) * Math.sin(ang(i)) };
        var vp = { x: lp.x, y: lp.y - 15 };
        return '<text x="' + lp.x.toFixed(1) + '" y="' + lp.y.toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--aube-text-primary,#f4e4c1)" dominant-baseline="middle">' + labels[i] + '</text>'
          + '<text x="' + vp.x.toFixed(1) + '" y="' + vp.y.toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + color(v) + '" dominant-baseline="middle">' + v + '</text>';
      }).join('');
    }
    return '<svg viewBox="0 0 ' + box + ' ' + box + '" width="' + size + '" height="' + size + '" style="max-width:100%;height:auto;" role="img" aria-label="Radar T360">' + grid + spokes + poly + dots + labelTxt + '</svg>';
  }

  function fmtCell(iso) {
    var lines = '';
    if (prefs.showDollar && cache.dailyDollar[iso] != null) {
      var p = cache.dailyDollar[iso].total_pnl;
      lines += '<div class="cell-pnl" style="font-size:0.9rem;">' + (p >= 0 ? '+' : '') + Math.round(p).toLocaleString('fr-FR') + '$</div>';
    }
    if (prefs.showR && cache.dailyR[iso] != null) {
      var r = cache.dailyR[iso]; var rc = r >= 0 ? 'text-green-700' : 'text-red-700';
      lines += '<div class="' + rc + '" style="font-size:0.8rem;font-weight:600;">' + (r > 0 ? '+' : '') + r.toFixed(1) + 'R</div>';
    }
    if (prefs.showPercent && cache.dailyPct[iso] != null) {
      var pc = cache.dailyPct[iso]; var cc = pc >= 0 ? 'text-green-700' : 'text-red-700';
      lines += '<div class="' + cc + '" style="font-size:0.8rem;font-weight:600;">' + (pc > 0 ? '+' : '') + pc.toFixed(2) + '%</div>';
    }
    if (prefs.showActionsErrors) {
      var a = cache.dailyActions[iso] || 0, e = cache.dailyErrors[iso] || 0;
      if (a > 0 || e > 0) {
        lines += '<div style="font-size:10px;margin-top:2px;">';
        if (a > 0) lines += '<span style="color:#10b981;font-weight:600;">✅' + a + '</span> ';
        if (e > 0) lines += '<span style="color:#ef4444;font-weight:600;">❌' + e + '</span>';
        lines += '</div>';
      }
    }
    return lines;
  }

  function renderCalendar() {
    var grid = document.getElementById('globalCalendarGrid');
    var label = document.getElementById('globalCalendarMonthYear');
    if (!grid) return;
    if (label) label.textContent = MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear();
    var y = calDate.getFullYear(), m = calDate.getMonth();
    var firstDow = new Date(y, m, 1).getDay();
    var nbDays = new Date(y, m + 1, 0).getDate();
    var html = '';
    for (var i = 0; i < firstDow; i++) html += '<div></div>';
    for (var d = 1; d <= nbDays; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var rec = cache.dailyDollar[iso];
      var cls = 'text-center py-3 rounded';
      var hasTrades = rec && rec.total_trades > 0;
      if (hasTrades) { var p = rec.total_pnl; cls += p > 0 ? ' bg-green-100 text-green-800' : (p < 0 ? ' bg-red-200 text-red-900' : ' bg-gray-100'); }
      else cls += ' text-gray-400';
      var inner = '<div class="font-semibold">' + d + '</div>' + (hasTrades || (cache.dailyActions[iso] || cache.dailyErrors[iso]) ? fmtCell(iso) : '');
      html += '<div class="' + cls + '">' + inner + '</div>';
    }
    grid.innerHTML = html;
  }

  async function loadPrefs() {
    try {
      var sb = window.supabaseClient, u = window.currentUser && window.currentUser.uuid;
      if (!sb || !u) return;
      var r = await sb.from('user_preferences').select('coach_calendar_display').eq('user_id', u).maybeSingle();
      if (!r.error && r.data && r.data.coach_calendar_display) prefs = Object.assign(prefs, r.data.coach_calendar_display);
    } catch (e) { /* defaults */ }
    ['showDollar', 'showR', 'showPercent', 'showActionsErrors'].forEach(function (k) {
      var el = document.getElementById('coach' + k.charAt(0).toUpperCase() + k.slice(1));
      if (el) el.checked = !!prefs[k];
    });
  }

  window.toggleCoachCalendarSettings = function (ev) {
    if (ev) ev.stopPropagation();
    var m = document.getElementById('coachCalendarSettings');
    if (!m) return;
    var open = m.style.display !== 'none';
    m.style.display = open ? 'none' : 'block';
    if (!open) {
      var close = function (e) { if (!e.target.closest('#coachCalendarSettings') && !e.target.closest('[onclick*="toggleCoachCalendarSettings"]')) { m.style.display = 'none'; document.removeEventListener('click', close); } };
      setTimeout(function () { document.addEventListener('click', close); }, 0);
    }
  };

  window.updateCoachCalendarDisplay = async function () {
    prefs.showDollar = !!(document.getElementById('coachShowDollar') || {}).checked;
    prefs.showR = !!(document.getElementById('coachShowR') || {}).checked;
    prefs.showPercent = !!(document.getElementById('coachShowPercent') || {}).checked;
    prefs.showActionsErrors = !!(document.getElementById('coachShowActionsErrors') || {}).checked;
    renderCalendar();
    try {
      var sb = window.supabaseClient, u = window.currentUser && window.currentUser.uuid;
      if (sb && u) await sb.from('user_preferences').upsert({ user_id: u, coach_calendar_display: prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (e) { console.warn('[COACH-DASH] save prefs', e); }
  };

  window.loadCoachDashboard = async function () {
    try {
      var sb = window.supabaseClient;
      var mKey = monthKey(calDate);
      await loadPrefs();

      cache = { dailyDollar: {}, dailyR: {}, dailyPct: {}, dailyActions: {}, dailyErrors: {} };
      var monthPnl = 0, monthTrades = 0, monthWins = 0, monthLosses = 0, monthGross = 0, monthLoss = 0;

      // $ : vue SQL agrégée
      if (sb) {
        var res = await sb.from('coach_daily_aggregate').select('*');
        if (!res.error && res.data) res.data.forEach(function (r) {
          cache.dailyDollar[r.trade_date] = r;
          if (String(r.trade_date).slice(0, 7) === mKey) {
            monthPnl += parseFloat(r.total_pnl) || 0; monthTrades += parseInt(r.total_trades) || 0;
            monthWins += parseInt(r.wins) || 0; monthLosses += parseInt(r.losses) || 0;
          }
        });
      }

      // Données par élève → R/% par jour + T360 + Win Rate moyen + PF mois + active students
      var students = (typeof window.getAllStudentsData === 'function') ? await window.getAllStudentsData() : [];
      var wrSum = 0, wrCount = 0, scoreSum = 0, scoreCount = 0, activeMonth = 0;
      var compAcc = { winRate: 0, profitFactor: 0, avgRatio: 0, consistency: 0, drawdown: 0, recovery: 0 };
      students.forEach(function (s) {
        var trades = (s.data && s.data.trades) || [];
        var accounts = (s.data && s.data.accounts) || [];
        var accById = {}; accounts.forEach(function (a) { accById[a.id] = a; });
        trades.forEach(function (t) {
          var d = dateOf(t); if (!d) return;
          var acc = accById[t.account_id];
          var risk = acc && acc.risk_per_trade ? parseFloat(acc.risk_per_trade) : 0;
          var initial = acc && acc.initial_balance ? parseFloat(acc.initial_balance) : 0;
          if (risk > 0) cache.dailyR[d] = (cache.dailyR[d] || 0) + pnlOf(t) / risk;
          if (initial > 0) cache.dailyPct[d] = (cache.dailyPct[d] || 0) + (pnlOf(t) / initial) * 100;
        });
        var monthT = trades.filter(function (t) { return tradeMonthKey(t) === mKey; });
        if (monthT.length > 0) {
          activeMonth++; wrSum += winRate(monthT); wrCount++;
          monthT.forEach(function (t) { var p = pnlOf(t); if (p > 0) monthGross += p; else if (p < 0) monthLoss += Math.abs(p); });
        }
        var sc = studentScore(trades, accounts);
        if (sc) { scoreSum += sc.global; scoreCount++; Object.keys(compAcc).forEach(function (k) { compAcc[k] += sc.components[k]; }); }
      });

      // Actions / Erreurs par jour (journal_entries, RLS coach)
      if (sb) {
        try {
          var jr = await sb.from('journal_entries').select('user_id, entry_date, positive_points, errors_committed');
          if (!jr.error && jr.data) jr.data.forEach(function (e) {
            var d = String(e.entry_date).slice(0, 10);
            if (Array.isArray(e.positive_points) && e.positive_points.length) cache.dailyActions[d] = (cache.dailyActions[d] || 0) + 1;
            if (Array.isArray(e.errors_committed) && e.errors_committed.length) cache.dailyErrors[d] = (cache.dailyErrors[d] || 0) + 1;
          });
        } catch (e) { /* journal optionnel */ }
      }

      renderCalendar();

      // KPIs
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      var fmt$ = function (v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      var heroEl = document.getElementById('coachHeroPnl');
      if (heroEl) { heroEl.textContent = fmt$(monthPnl); heroEl.style.color = monthPnl >= 0 ? '#10b981' : '#ef4444'; }
      set('coachHeroMonthLabel', MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear());
      set('coachHeroSub', activeMonth + ' élève' + (activeMonth > 1 ? 's' : '') + ' actif' + (activeMonth > 1 ? 's' : '') + ' ce mois');
      set('coachActiveStudents', activeMonth);

      var avgWR = wrCount > 0 ? Math.round(wrSum / wrCount) : 0;
      set('coachGlobalWinRate', avgWR + '%');
      var bar = document.getElementById('coachWinRateBar'); if (bar) bar.style.width = Math.min(100, avgWR) + '%';
      var pf = monthLoss > 0 ? (monthGross / monthLoss) : (monthGross > 0 ? 99.99 : 0);
      var pfStr = pf >= 99.99 ? '∞' : pf.toFixed(2);
      set('coachProfitFactor', pfStr);
      set('coachTotalTrades', monthTrades.toLocaleString('fr-FR'));
      set('coachTotalWins', monthWins); set('coachTotalLosses', monthLosses);
      var avgScore = scoreCount > 0 ? (scoreSum / scoreCount) : 0;
      set('coachT360Score', avgScore.toFixed(1));

      // 5 KPI mois sous calendrier
      set('coachMonthNetPnl', monthTrades > 0 ? fmt$(monthPnl) : '—');
      set('coachMonthWinRate', wrCount > 0 ? avgWR + '%' : '—');
      set('coachMonthPF', monthTrades > 0 ? pfStr : '—');
      set('coachMonthTrades', monthTrades > 0 ? monthTrades.toLocaleString('fr-FR') : '—');
      set('coachMonthAvg', monthTrades > 0 ? fmt$(monthPnl / monthTrades) : '—');

      // Radars (grand + mini)
      var comps = null;
      if (scoreCount > 0) { comps = {}; Object.keys(compAcc).forEach(function (k) { comps[k] = compAcc[k] / scoreCount; }); }
      var big = document.getElementById('coachT360Radar');
      if (big) big.innerHTML = comps ? radarSVG(comps, { mini: false }) : '<div style="color:var(--aube-text-secondary,rgba(255,255,255,0.6));padding:40px;">Aucune donnée élève</div>';
      var mini = document.getElementById('coachT360MiniRadar');
      if (mini) mini.innerHTML = comps ? radarSVG(comps, { mini: true }) : '';

      console.log('[COACH-DASH] ✅ ' + fmt$(monthPnl) + ' · WR ' + avgWR + '% · PF ' + pfStr + ' · T360 ' + avgScore.toFixed(1) + ' (' + scoreCount + ' élèves)');
    } catch (e) { console.error('[COACH-DASH] ❌', e); }
  };

  window.previousGlobalMonth = function () { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); window.loadCoachDashboard(); };
  window.nextGlobalMonth = function () { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); window.loadCoachDashboard(); };
})();
