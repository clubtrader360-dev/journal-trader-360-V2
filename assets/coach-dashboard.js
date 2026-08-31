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
  // #33 commit 4 — réutilisé par la table élèves premium (T360 Score par élève).
  window.coachStudentScore = studentScore;

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
      // Compteur cliquable → liste des élèves du jour. Uniquement quand il existe :
      // un jour sans trade n'a rien à ouvrir.
      if (hasTrades && rec.active_students) {
        inner += '<div class="coach-cal-students coach-cal-students--link" role="button" tabindex="0"'
          + ' title="Voir les élèves ayant tradé ce jour"'
          + ' onclick="event.stopPropagation();openCoachDayStudents(\'' + iso + '\')"'
          + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openCoachDayStudents(\'' + iso + '\');}"'
          + ' style="font-size:11px;font-weight:700;">'
          + rec.active_students + ' élève' + (rec.active_students > 1 ? 's' : '') + '</div>';
      }
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

      // Actions/Erreurs + Engagement par jour (journal_entries, RLS coach).
      // ⚠️ SCOPÉ au mois affiché : sans filtre, Supabase plafonne à 1000 lignes (les plus anciennes)
      // → le mois courant manquait (bug 2b-iv : ~3 élèves au lieu de ~22).
      var dailyJournal = {}, dailyChecklist = {};
      if (sb) {
        var mStart = mKey + '-01';
        var nextM = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
        var mEnd = nextM.getFullYear() + '-' + String(nextM.getMonth() + 1).padStart(2, '0') + '-01';
        try {
          var jr = await sb.from('journal_entries').select('user_id, entry_date, positive_points, errors_committed').gte('entry_date', mStart).lt('entry_date', mEnd);
          if (!jr.error && jr.data) {
            var seenJ = {}; // distinct user par jour
            jr.data.forEach(function (e) {
              var d = String(e.entry_date).slice(0, 10);
              if (Array.isArray(e.positive_points) && e.positive_points.length) cache.dailyActions[d] = (cache.dailyActions[d] || 0) + 1;
              if (Array.isArray(e.errors_committed) && e.errors_committed.length) cache.dailyErrors[d] = (cache.dailyErrors[d] || 0) + 1;
              var k = d + '|' + e.user_id; if (!seenJ[k]) { seenJ[k] = 1; dailyJournal[d] = (dailyJournal[d] || 0) + 1; }
            });
          }
        } catch (e) { console.warn('[COACH-DASH] journal fetch', e); }
        // Validations checklist (table dédiée #33, RLS coach). PK (user_id, validation_date)
        // → 1 ligne max / élève / jour, pas de dédup nécessaire. Historique vide avant le
        // déploiement de la persistance (normal) puis s'enrichit dès aujourd'hui.
        try {
          var cv = await sb.from('checklist_validations').select('user_id, validation_date').gte('validation_date', mStart).lt('validation_date', mEnd);
          if (!cv.error && cv.data) {
            cv.data.forEach(function (e) {
              var d = String(e.validation_date).slice(0, 10);
              dailyChecklist[d] = (dailyChecklist[d] || 0) + 1;
            });
          }
        } catch (e) { console.warn('[COACH-DASH] checklist fetch', e); }
      }

      renderCalendar();
      // Réévalue l'état des flèches après CHAQUE rendu : au premier chargement,
      // calDate vaut le mois courant, le bouton › doit donc être désactivé d'emblée.
      if (window.updateCoachCalNavState) window.updateCoachCalNavState();

      // KPIs
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      var fmt$ = function (v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      var heroEl = document.getElementById('coachHeroPnl');
      if (heroEl) { heroEl.textContent = fmt$(monthPnl); heroEl.style.color = monthPnl >= 0 ? '#10b981' : '#ef4444'; }
      set('coachHeroMonthLabel', MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear());
      set('coachHeroSub', activeMonth + ' élève' + (activeMonth > 1 ? 's' : '') + ' actif' + (activeMonth > 1 ? 's' : '') + ' ce mois');
      set('coachActiveStudents', activeMonth + ' / ' + students.length);

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

      // P&L global ALL-TIME (somme de l'agrégat journalier complet)
      var allTimePnl = 0; Object.keys(cache.dailyDollar).forEach(function (k) { allTimePnl += parseFloat(cache.dailyDollar[k].total_pnl) || 0; });
      var gp = document.getElementById('coachGlobalPnl');
      if (gp) { gp.textContent = fmt$(allTimePnl); gp.style.color = allTimePnl >= 0 ? '#10b981' : '#ef4444'; }

      // Grand radar T360 dans la card dédiée (FIX B 2b-iii)
      var comps = null;
      if (scoreCount > 0) { comps = {}; Object.keys(compAcc).forEach(function (k) { comps[k] = compAcc[k] / scoreCount; }); }
      var big = document.getElementById('coachT360Radar');
      if (big) big.innerHTML = comps ? radarSVG(comps, { mini: false }) : '<div style="color:var(--aube-text-secondary,rgba(255,255,255,0.6));padding:30px;">Aucune donnée élève</div>';

      // Charts secondaires + régularité + protections + alertes (agrégation front)
      renderSecondary(students, mKey, comps ? comps.consistency : 0);
      window.renderCoachEngagement(dailyJournal, dailyChecklist);

      console.log('[COACH-DASH] ✅ all-time ' + fmt$(allTimePnl) + ' · mois ' + fmt$(monthPnl) + ' · WR ' + avgWR + '% · T360 ' + avgScore.toFixed(1) + ' (' + scoreCount + ' élèves)');
    } catch (e) { console.error('[COACH-DASH] ❌', e); }
  };

  // ===== Charts secondaires (Chart.js) + régularité + protections + Points à surveiller =====
  var charts = {};
  function destroyChart(k) { if (charts[k]) { try { charts[k].destroy(); } catch (e) {} charts[k] = null; } }

  // entry_time/exit_time sont des TIMESTAMP ("YYYY-MM-DDTHH:MM:SS") en DB → extraire "HH:MM:SS".
  function timeStr(v) { v = String(v || ''); if (v.indexOf('T') >= 0) v = v.split('T')[1]; return v; }
  function hourOf(t) { var s = timeStr(t.entry_time); return s ? parseInt(s.split(':')[0], 10) : NaN; }
  function durationMin(t) {
    var e = timeStr(t.entry_time), x = timeStr(t.exit_time); if (!e || !x) return null;
    var ep = e.split(':'), xp = x.split(':');
    var d = ((parseInt(xp[0]) || 0) * 60 + (parseInt(xp[1]) || 0)) - ((parseInt(ep[0]) || 0) * 60 + (parseInt(ep[1]) || 0));
    if (d < 0) d += 1440; return d;
  }
  function dirOf(t) { return String(t.direction || t.trade_type || '').toUpperCase(); }

  function renderSecondary(students, mKey, avgConsistencyScore) {
    var allTrades = [];
    students.forEach(function (s) { ((s.data && s.data.trades) || []).forEach(function (t) { allTrades.push(t); }); });

    // 1) Régularité (concentration moyenne = 100 - score moyen ; plus bas = mieux)
    var ratio = Math.max(0, Math.round(100 - (avgConsistencyScore || 0)));
    var rEl = document.getElementById('globalConsistencyRatio'); if (rEl) rEl.textContent = ratio + '%';
    var bar = document.getElementById('globalConsistencyBar'); if (bar) bar.style.width = Math.min(100, ratio) + '%';
    var lbl = document.getElementById('globalConsistencyLabel'), desc = document.getElementById('globalConsistencyDesc');
    if (lbl && desc) {
      if (ratio <= 40) { lbl.textContent = 'Excellent'; desc.textContent = 'Profits bien répartis chez les élèves'; }
      else if (ratio <= 60) { lbl.textContent = 'Correct'; desc.textContent = 'Régularité moyenne'; }
      else { lbl.textContent = 'À surveiller'; desc.textContent = 'Profits trop concentrés sur peu de jours'; }
    }
    // Colorisation de la carte — PORTÉE depuis /coach-dashboard.js avant sa suppression.
    // C'était la SEULE chose que le legacy faisait et qu'assets ne faisait pas. Elle était
    // déjà inopérante (son unique point d'entrée, le loadCoachDashboard du legacy, était
    // écrasé par celui-ci), mais on la porte plutôt que de la perdre au passage.
    var interp = document.getElementById('globalConsistencyInterpretation');
    if (interp || rEl) {
      var tone = ratio <= 40 ? { bg: '#f0fdf4', border: '#10b981', text: '#10b981' }
        : ratio <= 60 ? { bg: '#fefce8', border: '#84cc16', text: '#84cc16' }
        : ratio <= 80 ? { bg: '#fff7ed', border: '#f59e0b', text: '#f59e0b' }
        : { bg: '#fef2f2', border: '#ef4444', text: '#ef4444' };
      if (interp) { interp.style.backgroundColor = tone.bg; interp.style.borderLeftColor = tone.border; }
      if (rEl) rEl.style.color = tone.text;
    }

    if (!window.Chart) return;
    var axisColor = 'rgba(244,228,193,0.7)', gridColor = 'rgba(255,255,255,0.06)';

    // 2) Performance par Heure (BAR, P&L TOTAL par heure) — FIX A
    var hLabels = [], hTotals = [], hCounts = [];
    for (var hh = 0; hh <= 23; hh++) {
      var arr = allTrades.filter(function (t) { return hourOf(t) === hh; });
      hLabels.push(hh + 'h'); hCounts.push(arr.length);
      hTotals.push(Math.round(arr.reduce(function (a, t) { return a + (parseFloat(t.pnl) || 0); }, 0)));
    }
    var hc = document.getElementById('globalHourlyChart');
    if (hc) {
      destroyChart('hourly');
      charts.hourly = new Chart(hc.getContext('2d'), {
        type: 'bar',
        data: { labels: hLabels, datasets: [{ data: hTotals, backgroundColor: hTotals.map(function (v) { return v >= 0 ? '#10b98188' : '#ef444488'; }), borderColor: hTotals.map(function (v) { return v >= 0 ? '#10b981' : '#ef4444'; }), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
            tooltip: { callbacks: { label: function (ctx) { var v = ctx.parsed.y; return 'P&L total : ' + (v >= 0 ? '+' : '') + v.toLocaleString('fr-FR') + ' $ · ' + (hCounts[ctx.dataIndex] || 0) + ' trades'; } } } },
          scales: { x: { title: { display: true, text: 'Heure', color: axisColor }, ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: 'P&L total ($)', color: axisColor }, ticks: { color: axisColor }, grid: { color: gridColor } } } }
      });
    }

    // 3) Performance par Durée (bar par bucket)
    var buckets = [{ l: '<15min', min: 0, max: 15 }, { l: '15-60', min: 15, max: 60 }, { l: '1-4h', min: 60, max: 240 }, { l: '>4h', min: 240, max: 1e9 }];
    var bvals = buckets.map(function (b) {
      var arr = allTrades.filter(function (t) { var d = durationMin(t); return d != null && d >= b.min && d < b.max; }).map(function (t) { return parseFloat(t.pnl) || 0; });
      return Math.round(arr.reduce(function (a, c) { return a + c; }, 0)); // FIX C : P&L TOTAL par bucket
    });
    var dc = document.getElementById('globalDurationChart');
    if (dc) {
      destroyChart('duration');
      charts.duration = new Chart(dc.getContext('2d'), {
        type: 'bar',
        data: { labels: buckets.map(function (b) { return b.l; }), datasets: [{ data: bvals, backgroundColor: bvals.map(function (v) { return v >= 0 ? '#10b98188' : '#ef444488'; }), borderColor: bvals.map(function (v) { return v >= 0 ? '#10b981' : '#ef4444'; }), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: axisColor }, grid: { color: gridColor } }, y: { title: { display: true, text: 'P&L total ($)', color: axisColor }, ticks: { color: axisColor }, grid: { color: gridColor } } } }
      });
    }

    // 4) P&L cumulé (line) — depuis l'agrégat journalier trié
    var days = Object.keys(cache.dailyDollar).sort();
    var cum = 0; var cumData = days.map(function (d) { cum += parseFloat(cache.dailyDollar[d].total_pnl) || 0; return cum; });
    var ddc = document.getElementById('globalDrawdownChart');
    if (ddc) {
      destroyChart('drawdown');
      charts.drawdown = new Chart(ddc.getContext('2d'), {
        type: 'line',
        data: { labels: days, datasets: [{ data: cumData, borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.12)', fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { x: { ticks: { display: false }, grid: { display: false } }, y: { title: { display: true, text: 'P&L cumulé ($)', color: axisColor }, ticks: { color: axisColor }, grid: { color: gridColor } } } }
      });
    }

    function pctRow(label, v) { return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;"><span>' + label + '</span><span style="font-weight:700;color:var(--color-gold,#d4af37);">' + v + '%</span></div><div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-bottom:4px;"><div style="height:100%;width:' + v + '%;background:#d4af37;"></div></div>'; }
    function parseProt(t) { var p = t.protections; if (!p) return []; if (Array.isArray(p)) return p; try { var a = JSON.parse(p); return Array.isArray(a) ? a : []; } catch (e) { return String(p).split(',').map(function (s) { return s.trim(); }).filter(Boolean); } }

    // 5a) Discipline de sortie (% SL / TP / protections cochées) — all-time. Hit-rate SL vs TP = Phase 2 (pas d'exit_reason).
    var disc = document.getElementById('globalDisciplineContainer');
    if (disc) {
      var n = allTrades.length || 1;
      var slPct = Math.round(allTrades.filter(function (t) { return t.stop_loss != null && t.stop_loss !== ''; }).length / n * 100);
      var tpPct = Math.round(allTrades.filter(function (t) { return t.take_profit != null && t.take_profit !== ''; }).length / n * 100);
      var protPct = Math.round(allTrades.filter(function (t) { return parseProt(t).length > 0; }).length / n * 100);
      disc.innerHTML = pctRow('Trades avec Stop Loss placé', slPct) + pctRow('Trades avec Take Profit placé', tpPct) + pctRow('Trades avec protections renseignées', protPct)
        + '<div style="font-size:11px;color:var(--aube-text-secondary,rgba(255,255,255,0.55));font-style:italic;margin-top:6px;">Hit-rate SL vs TP : Phase 2 (nécessite exit_reason).</div>';
    }

    // 5b) Analyse des Protections — répartition des types réels (parse trades.protections JSON, mois affiché)
    var pt = document.getElementById('globalProtTypesContainer');
    if (pt) {
      var monthTrades = allTrades.filter(function (t) { return String(t.trade_date || t.date || '').slice(0, 7) === mKey; });
      var typeCount = {}, withProt = 0;
      monthTrades.forEach(function (t) { var arr = parseProt(t); if (arr.length) withProt++; arr.forEach(function (x) { typeCount[x] = (typeCount[x] || 0) + 1; }); });
      var entries = Object.keys(typeCount).map(function (k) { return [k, typeCount[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
      if (entries.length && withProt > 0) {
        pt.innerHTML = entries.map(function (e) { return pctRow(e[0], Math.round(e[1] / withProt * 100)); }).join('')
          + '<div style="font-size:11px;color:var(--aube-text-secondary,rgba(255,255,255,0.55));margin-top:4px;">% des trades protégés (' + withProt + ') utilisant ce type.</div>';
      } else {
        pt.innerHTML = '<div class="text-center text-gray-500 py-6 text-sm">Aucune protection renseignée ce mois</div>';
      }
    }

    // 6) Points à surveiller agrégés (communauté, mois affiché) + cache élèves concernés (drill-down FIX F)
    alertCache = { surtrading: [], revenge: [], streak: [], late: [] };
    students.forEach(function (s) {
      var name = (s.user && (s.user.name || s.user.email)) || 'Élève';
      var trades = ((s.data && s.data.trades) || []).filter(function (t) { return String(t.trade_date || t.date || '').slice(0, 7) === mKey; });
      if (!trades.length) return;
      var monthPnl = trades.reduce(function (a, t) { return a + (parseFloat(t.pnl) || 0); }, 0);
      var byDay = {}; trades.forEach(function (t) { var d = String(t.trade_date || t.date).slice(0, 10); (byDay[d] = byDay[d] || []).push(t); });
      var overDays = Object.keys(byDay).filter(function (d) { return byDay[d].length > 4; });
      if (overDays.length >= 1) alertCache.surtrading.push({ name: name, pnl: monthPnl, n: overDays.length, unit: 'journée(s) >4 trades' });
      var sorted = trades.slice().sort(function (a, b) { return (String(a.trade_date) + (a.entry_time || '')).localeCompare(String(b.trade_date) + (b.entry_time || '')); });
      var lossesArr = sorted.filter(function (t) { return (parseFloat(t.pnl) || 0) < 0; });
      var avgLoss = lossesArr.length ? lossesArr.reduce(function (a, t) { return a + Math.abs(parseFloat(t.pnl) || 0); }, 0) / lossesArr.length : 0;
      var revN = 0, cur = 0, maxStreak = 0;
      for (var i = 0; i < sorted.length; i++) {
        var p = parseFloat(sorted[i].pnl) || 0;
        if (p < 0) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0;
        if (i < sorted.length - 1 && avgLoss > 0 && p < 0 && Math.abs(p) > avgLoss * 1.5) {
          var nx = sorted[i + 1];
          if (String(sorted[i].trade_date).slice(0,10) === String(nx.trade_date).slice(0,10) && sorted[i].exit_time && nx.entry_time) {
            var ex = timeStr(sorted[i].exit_time).split(':'), en = timeStr(nx.entry_time).split(':');
            var gapM = ((parseInt(en[0]) || 0) * 60 + (parseInt(en[1]) || 0)) - ((parseInt(ex[0]) || 0) * 60 + (parseInt(ex[1]) || 0));
            if (gapM >= 0 && gapM <= 5) revN++;
          }
        }
      }
      if (revN > 0) alertCache.revenge.push({ name: name, pnl: monthPnl, n: revN, unit: 'ré-entrée(s) <5min' });
      if (maxStreak >= 5) alertCache.streak.push({ name: name, pnl: monthPnl, n: maxStreak, unit: 'pertes consécutives' });
      var lateN = trades.filter(function (t) { var h = hourOf(t); return isFinite(h) && h >= 17; }).length;
      if (lateN >= 3) alertCache.late.push({ name: name, pnl: monthPnl, n: lateN, unit: 'trades ≥17h' });
    });
    alertMeta = {
      surtrading: { sev: '#ef4444', icon: '🔥', title: 'Surtrading', crit: 'Au moins une journée avec plus de 4 trades.' },
      revenge: { sev: '#ef4444', icon: '😡', title: 'Revenge trading', crit: 'Ré-entrée moins de 5 min après une perte supérieure au R habituel.' },
      streak: { sev: '#f59e0b', icon: '🔻', title: 'Séries de pertes', crit: '5 pertes consécutives ou plus.' },
      late: { sev: '#f59e0b', icon: '🌙', title: 'Sessions tardives', crit: 'Au moins 3 trades pris après 17h.' }
    };
    // Expose la data des alertes sur window (zéro ambiguïté de scope pour le handler)
    window.__coachAlerts = { cache: alertCache, meta: alertMeta };
    var order = ['surtrading', 'revenge', 'streak', 'late'];
    var banner = document.getElementById('coachWarningsBanner'), cont = document.getElementById('coachWarningsContainer');
    if (banner && cont) {
      var shown = order.filter(function (k) { return alertCache[k].length > 0; });
      if (shown.length) {
        banner.style.display = 'block';
        cont.innerHTML = shown.map(function (k) {
          var m = alertMeta[k];
          return '<div class="clickable" data-alert="' + k + '" onclick="window.openCoachAlertDetail(\'' + k + '\')" style="background:rgba(255,255,255,0.04);border-left:4px solid ' + m.sev + ';border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;">'
            + '<span style="font-size:20px;pointer-events:none;">' + m.icon + '</span><span style="font-weight:500;flex:1;pointer-events:none;">' + alertCache[k].length + ' élève(s) — ' + m.title + ' ce mois</span>'
            + '<span style="color:var(--color-gold,#d4af37);font-size:12px;pointer-events:none;">détail ›</span></div>';
        }).join('');
      } else { banner.style.display = 'none'; }
    }
  }

  // FIX F — modale drill-down d'une alerte
  var alertCache = {}, alertMeta = {};
  window.openCoachAlertDetail = function (key) {
    var data = window.__coachAlerts || { cache: alertCache, meta: alertMeta };
    var m = data.meta[key], list = data.cache[key] || [];
    var modal = document.getElementById('alertDetailModal');
    if (!modal || !m) return;
    document.getElementById('alertDetailTitle').textContent = m.title + ' — ' + (list.length) + ' élève(s)';
    document.getElementById('alertDetailDesc').textContent = m.crit;
    var fmt$ = function (v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 }); };
    var rows = list.slice().sort(function (a, b) { return b.n - a.n; }).map(function (e) {
      var pc = e.pnl >= 0 ? '#10b981' : '#ef4444';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid rgba(212,175,55,0.12);">'
        + '<span style="flex:1;font-weight:600;">' + e.name + '</span>'
        + '<span style="font-family:\'JetBrains Mono\',monospace;color:' + pc + ';min-width:90px;text-align:right;">' + fmt$(e.pnl) + '</span>'
        + '<span style="min-width:130px;text-align:right;color:var(--aube-text-secondary,rgba(255,255,255,0.6));font-size:12px;">' + e.n + ' ' + e.unit + '</span>'
        + '<button class="trader-btn-secondary" disabled title="Bientôt (#80 impersonation coach)" style="opacity:0.4;cursor:not-allowed;font-size:11px;padding:4px 8px;">Voir journal</button></div>';
    }).join('');
    document.getElementById('alertDetailList').innerHTML = rows || '<div style="padding:20px;text-align:center;color:var(--aube-text-secondary,rgba(255,255,255,0.6));">Aucun élève</div>';
    // Portal défensif : on garantit que la modale est enfant direct de <body> (future-proof
    // si un refactor la déplaçait sous un conteneur à stacking context). Idempotent.
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.style.display = 'block';
    modal.style.visibility = 'visible'; // visibility est héritée → on la force (cf 2b-ix)
    modal.setAttribute('aria-hidden', 'false');
  };
  window.closeAlertDetailModal = function () { var m = document.getElementById('alertDetailModal'); if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); } };

  // FIX E — délégation de clic (robuste vs re-render) : ouvre la modale au clic sur un item alerte
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('#coachWarningsContainer [data-alert]') : null;
    if (el) window.openCoachAlertDetail(el.getAttribute('data-alert'));
  });

  // FIX G — card "Engagement quotidien" (checklist + journal par jour du mois)
  // dailyEngage : { 'YYYY-MM-DD': { checklist: Set, journal: Set } } construit depuis journal_entries.
  window.renderCoachEngagement = function (dailyJournal, dailyChecklist) {
    if (!window.Chart) return;
    dailyChecklist = dailyChecklist || {};
    var y = calDate.getFullYear(), m = calDate.getMonth();
    var nbDays = new Date(y, m + 1, 0).getDate();
    var labels = [], jr = [], cl = [];
    for (var d = 1; d <= nbDays; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      labels.push(String(d));
      jr.push(dailyJournal[iso] || 0);
      cl.push(dailyChecklist[iso] || 0);
    }
    var c = document.getElementById('coachEngagementChart');
    if (!c) return;
    destroyChart('engage');
    var axisColor = 'rgba(244,228,193,0.7)', gridColor = 'rgba(255,255,255,0.06)';
    // Checklist (or) = vrai critère : clic "Valider la checklist" persisté en base
    // (table checklist_validations, #33). Journal (bleu) = élèves ayant rempli leur journal.
    charts.engage = new Chart(c.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: [
        { label: 'Checklist validée', data: cl, backgroundColor: '#d4af3799', borderColor: '#d4af37', borderWidth: 1 },
        { label: 'Journal rempli', data: jr, backgroundColor: '#3b82f699', borderColor: '#3b82f6', borderWidth: 1 }
      ] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: axisColor } },
          tooltip: { callbacks: { title: function (it) { return 'Jour ' + it[0].label; }, label: function (ctx) { return ctx.dataset.label + ' : ' + ctx.parsed.y + ' élève(s)'; } } } },
        scales: { x: { ticks: { color: axisColor, maxRotation: 0, autoSkip: true }, grid: { display: false } },
                  y: { beginAtZero: true, title: { display: true, text: "Nb d'élèves", color: axisColor }, ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor } } } }
    });
  };

  /* ==========================================================================
     LISTE DES ÉLÈVES AYANT TRADÉ UN JOUR DONNÉ
     --------------------------------------------------------------------------
     COHÉRENCE DU COMPTE. Le chiffre de la case vient de la vue
     coach_daily_aggregate : count(DISTINCT user_id) FROM trades, SANS filtre de
     rôle ni de statut (définition relue en base). La liste est donc construite
     depuis la MÊME table trades, et surtout PAS depuis getAllStudentsData(), qui
     ne charge que role='student' AND status='active'. Les comptes révoqués ayant
     tradé comptent dans le chiffre : les omettre donnerait une liste plus courte
     que le compteur, soit un bug visible.
     La vue est security_invoker : RLS identique entre elle et notre requête.
     ========================================================================== */

  var dayModalToken = 0; // invalide les réponses d'une ouverture précédente

  // Réutilise coachMoney (index.html) pour que la liste et la fiche affichent le MÊME
  // format. L'ancienne version donnait +$1 234,56 (2 décimales, tiret ASCII) là où la
  // fiche donne +$1 234 (0 décimale, signe moins typographique) : deux formats pour le
  // même montant selon l'écran. Repli à l'identique si la fonction n'est pas exposée.
  function fmtMoney(v) {
    if (typeof window.coachMoney === 'function') return window.coachMoney(v);
    return (v >= 0 ? '+$' : '\u2212$') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }
  function frDate(iso) {
    var p = String(iso).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function esc(s) {
    return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
  }

  // Agrège les trades du jour par user_id. Une seule requête grâce à la FK
  // trades_user_id_fkey -> public.users(uuid), vérifiée en base ; repli sur deux
  // requêtes si l'embed PostgREST échoue (relation ambiguë, RLS sur users...).
  async function fetchDayStudents(iso) {
    var sb = window.supabaseClient;
    if (!sb) throw new Error('Client Supabase indisponible');

    var rows = null, embedded = true;
    var r = await sb.from('trades').select('user_id, pnl, users(name, email)').eq('trade_date', iso);
    if (r.error) {
      embedded = false;
      var r2 = await sb.from('trades').select('user_id, pnl').eq('trade_date', iso);
      if (r2.error) throw r2.error;
      rows = r2.data || [];
    } else {
      rows = r.data || [];
    }

    var byUser = {};
    rows.forEach(function (t) {
      var id = t.user_id;
      if (!id) return;
      if (!byUser[id]) byUser[id] = { uuid: id, pnl: 0, trades: 0, name: null, email: null };
      byUser[id].pnl += parseFloat(t.pnl) || 0;
      byUser[id].trades += 1;
      if (embedded && t.users) {
        byUser[id].name = t.users.name || byUser[id].name;
        byUser[id].email = t.users.email || byUser[id].email;
      }
    });
    var list = Object.keys(byUser).map(function (k) { return byUser[k]; });

    if (!embedded && list.length) {
      try {
        var u = await sb.from('users').select('uuid, name, email').in('uuid', list.map(function (x) { return x.uuid; }));
        if (!u.error && u.data) {
          var map = {};
          u.data.forEach(function (x) { map[x.uuid] = x; });
          list.forEach(function (x) { var m = map[x.uuid]; if (m) { x.name = m.name; x.email = m.email; } });
        }
      } catch (e) { console.warn('[COACH-DAY] resolution des noms echouee:', e); }
    }

    // Tri par P&L décroissant : un coach veut les extrêmes, pas l'ordre alphabétique.
    list.sort(function (a, b) { return b.pnl - a.pnl; });
    return list;
  }

  // Résout l'index d'un uuid dans coachStudentsRows. openCoachStudentDetail attend un
  // INDEX ; on le résout AU CLIC et non au rendu, pour que l'affordance ne dépende plus
  // de l'état d'un tableau chargé ailleurs.
  function idxForUuid(uuid) {
    var rows = window.coachStudentsRows || [];
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].uuid === uuid) return i;
    return -1;
  }

  function renderDayStudents(list) {
    var sub = document.getElementById('coachDayStudentsSub');
    var box = document.getElementById('coachDayStudentsList');
    if (sub) sub.textContent = list.length + ' élève' + (list.length > 1 ? 's' : '') + ' ayant tradé';
    if (!box) return;
    if (!list.length) { box.innerHTML = '<div style="opacity:.7;font-size:.9rem;">Aucun élève sur cette journée.</div>'; return; }

    // Bandeau si la table élèves n'a pas pu être chargée : sans lui, TOUTES les lignes
    // seraient inertes sans que rien ne l'explique — le défaut corrigé ici.
    var banner = '';
    if (!(window.coachStudentsRows || []).length) {
      console.warn('[COACH-DAY] coachStudentsRows vide après tentative de chargement — fiches indisponibles');
      banner = '<div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);'
        + 'border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.82rem;">'
        + 'Liste des élèves indisponible : les fiches ne peuvent pas être ouvertes depuis ici.</div>';
    }

    // TOUTES les lignes porteuses d'un uuid sont cliquables. L'index n'est plus une
    // condition d'affordance : c'est un détail résolu au clic.
    box.innerHTML = banner + list.map(function (s) {
      var label = s.name || s.email || ('Compte ' + String(s.uuid).slice(0, 8) + '…');
      var pnlColor = s.pnl >= 0 ? '#10b981' : '#ef4444';
      var clickable = !!s.uuid;
      return '<div class="coach-day-row"'
        + (clickable ? ' data-uuid="' + esc(s.uuid) + '" data-label="' + esc(label) + '" role="button" tabindex="0"' : '')
        + ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:8px;margin-bottom:6px;background:rgba(212,175,55,0.06);'
        + (clickable ? 'cursor:pointer;' : 'opacity:.72;') + '">'
        + '<div style="min-width:0;pointer-events:none;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(label) + '</div>'
        + (s.name && s.email ? '<div style="font-size:.75rem;opacity:.6;">' + esc(s.email) + '</div>' : '')
        + '</div>'
        + '<div style="text-align:right;white-space:nowrap;pointer-events:none;"><div style="font-weight:700;color:' + pnlColor + ';">' + fmtMoney(s.pnl) + '</div>'
        + '<div style="font-size:.75rem;opacity:.7;">' + s.trades + ' trade' + (s.trades > 1 ? 's' : '') + '</div></div>'
        + '</div>';
    }).join('');
  }

  // Ouvre la fiche d'un élève depuis la liste du jour. AUCUN chemin silencieux : chaque
  // sortie journalise sa raison, et l'utilisateur est notifié quand rien ne peut s'ouvrir.
  window.coachDayOpenStudentByUuid = async function (uuid, label) {
    if (!uuid) { console.warn('[COACH-DAY] clic sans uuid — ligne ignorée'); return; }

    if (typeof window.openCoachStudentDetail !== 'function') {
      console.warn('[COACH-DAY] window.openCoachStudentDetail absente — fiche impossible pour', uuid);
      if (window.showNotification) window.showNotification("Fiche élève indisponible sur cette page.", 'error');
      return;
    }

    var idx = idxForUuid(uuid);

    // Index introuvable : on tente un rechargement AVANT d'abandonner.
    if (idx < 0 && typeof window.loadCoachStudents === 'function') {
      console.warn('[COACH-DAY] index introuvable pour', uuid, '— rechargement de la table élèves');
      try { await window.loadCoachStudents(); } catch (e) { console.warn('[COACH-DAY] loadCoachStudents a échoué:', e); }
      idx = idxForUuid(uuid);
    }

    if (idx < 0) {
      console.warn('[COACH-DAY] uuid absent de coachStudentsRows après rechargement:', uuid,
        '| taille du tableau =', (window.coachStudentsRows || []).length);
      if (window.showNotification) {
        window.showNotification('Fiche indisponible pour ' + (label || 'cet élève') + " (hors de la liste des élèves actifs).", 'error');
      }
      return;
    }

    window.openCoachStudentDetail(idx);
  };

  // Délégation : un seul listener, posé une fois, qui survit aux réécritures de innerHTML.
  // L'ancienne version posait des onclick inline au rendu — absents dès qu'une ligne
  // était jugée non cliquable, d'où un clic sans effet ET sans message.
  (function bindDayRowDelegation() {
    var box = document.getElementById('coachDayStudentsList');
    if (!box) {
      // Le modal est plus bas dans le DOM que ce script defer dans certains cas :
      // on réessaie une fois le document prêt.
      document.addEventListener('DOMContentLoaded', bindDayRowDelegation, { once: true });
      return;
    }
    if (box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    box.addEventListener('click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('.coach-day-row[data-uuid]') : null;
      if (!row) return;
      window.coachDayOpenStudentByUuid(row.getAttribute('data-uuid'), row.getAttribute('data-label'));
    });
    box.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var row = ev.target && ev.target.closest ? ev.target.closest('.coach-day-row[data-uuid]') : null;
      if (!row) return;
      ev.preventDefault();
      window.coachDayOpenStudentByUuid(row.getAttribute('data-uuid'), row.getAttribute('data-label'));
    });
  })();

  window.openCoachDayStudents = async function (iso) {
    var modal = document.getElementById('coachDayStudentsModal');
    if (!modal) return;
    var token = ++dayModalToken;

    var title = document.getElementById('coachDayStudentsTitle');
    var sub = document.getElementById('coachDayStudentsSub');
    var box = document.getElementById('coachDayStudentsList');
    if (title) title.textContent = frDate(iso);
    if (sub) sub.textContent = 'Chargement…';
    // Le modal s'ouvre AVANT la réponse : sans état d'attente, une liste vide se
    // lirait comme « aucun élève » alors que la requête est en cours.
    if (box) box.innerHTML = '<div style="opacity:.7;font-size:.9rem;padding:8px 0;">Chargement des élèves…</div>';
    modal.style.display = 'block';

    try {
      // coachStudentsRows n'existe qu'après l'ouverture de l'onglet élèves. Sans lui,
      // AUCUNE ligne ne serait cliquable pour un coach venu droit au calendrier.
      if (!(window.coachStudentsRows || []).length && typeof window.loadCoachStudents === 'function') {
        try { await window.loadCoachStudents(); } catch (e) { console.warn('[COACH-DAY] loadCoachStudents:', e); }
      }
      var list = await fetchDayStudents(iso);
      if (token !== dayModalToken) return; // une autre journée a été ouverte entre-temps
      renderDayStudents(list);
    } catch (e) {
      console.error('[COACH-DAY] Chargement échoué:', e);
      if (token !== dayModalToken) return;
      if (sub) sub.textContent = '';
      if (box) box.innerHTML = '<div style="color:#ef4444;font-size:.9rem;">Chargement impossible : ' + esc(e.message || e) + '</div>';
    }
  };

  window.closeCoachDayStudents = function () {
    dayModalToken++; // toute réponse encore en vol devient obsolète
    var m = document.getElementById('coachDayStudentsModal');
    if (m) m.style.display = 'none';
  };

  // Conservé pour compatibilité : ouverture par index si un appelant externe l'utilise.
  window.coachDayOpenStudent = function (idx) {
    if (typeof window.openCoachStudentDetail === 'function') { window.openCoachStudentDetail(idx); return; }
    console.warn('[COACH-DAY] window.openCoachStudentDetail absente — index', idx);
  };

  // Fermeture par clic sur le fond.
  document.addEventListener('click', function (ev) {
    var m = document.getElementById('coachDayStudentsModal');
    if (m && m.style.display === 'block' && ev.target === m) window.closeCoachDayStudents();
  });

  // ---- Escape, en phase CAPTURE ----
  // index.html (~l.8187) enregistre au parsing un handler générique qui ferme la PREMIÈRE
  // modale visible dans l'ordre du DOM, via closeModal(). Or coachDayStudentsModal précède
  // coachStudentDetailModal dans le document, et openCoachStudentDetail fait un
  // appendChild(document.body) qui repousse la fiche encore plus loin. Avec les deux
  // ouvertes, le générique fermait donc la LISTE et laissait la fiche — l'inverse du
  // comportement voulu. Il ne passait pas non plus par closeCoachDayStudents(), donc
  // dayModalToken n'était jamais incrémenté.
  // La capture s'exécute avant TOUT listener bubble du même nœud, quel que soit l'ordre
  // d'enregistrement : c'est le seul moyen de passer devant un handler déjà en place.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var list = document.getElementById('coachDayStudentsModal');
    var sheet = document.getElementById('coachStudentDetailModal');
    var listOpen = !!(list && list.style.display === 'block');
    var sheetOpen = !!(sheet && sheet.style.display === 'block');
    // Aucune des deux : on ne touche à rien, le générique garde son comportement.
    if (!listOpen && !sheetOpen) return;

    if (sheetOpen) {
      if (typeof window.closeCoachStudentDetail === 'function') window.closeCoachStudentDetail();
      else sheet.style.display = 'none';
    } else {
      window.closeCoachDayStudents();
    }
    ev.stopImmediatePropagation();
    ev.preventDefault();
  }, true);

  /* ==========================================================================
     NAVIGATION MENSUELLE DU CALENDRIER COACH
     --------------------------------------------------------------------------
     Ces fonctions vivaient dans /coach-dashboard.js, supprimé ici : sans elles, les
     boutons ‹ › lèveraient une ReferenceError. Elles pilotent désormais calDate, le
     véritable état du calendrier affiché, et rechargent les données du mois.
     ========================================================================== */

  // Rechargement en cours : garde anti-clics multiples. loadCoachDashboard()
  // refait toutes les requêtes ; empiler les appels produirait des rendus
  // concurrents dont le dernier arrivé ne serait pas forcément le dernier demandé.
  var calNavBusy = false;

  function sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  // Le mois courant est la borne haute : un mois futur serait nécessairement vide
  // et passerait pour un bug.
  function isCurrentMonth() {
    return sameMonth(calDate, new Date());
  }

  function setCalNavState(busy) {
    var prev = document.getElementById('coachCalPrev');
    var next = document.getElementById('coachCalNext');
    var grid = document.getElementById('globalCalendarGrid');
    var label = document.getElementById('globalCalendarMonthYear');

    // Grille atténuée pendant le rechargement : sans ce retour, un clic donne
    // l'impression que rien ne se passe — précisément le défaut corrigé ici.
    if (grid) {
      grid.style.transition = 'opacity .15s';
      grid.style.opacity = busy ? '0.45' : '';
      grid.style.pointerEvents = busy ? 'none' : '';
    }
    if (label) label.style.opacity = busy ? '0.5' : '';

    var atCurrent = isCurrentMonth();
    if (prev) {
      prev.disabled = busy;
      prev.style.opacity = busy ? '0.4' : '';
      prev.style.cursor = busy ? 'not-allowed' : '';
    }
    if (next) {
      // Désactivé si on recharge OU si on est déjà sur le mois courant.
      var lock = busy || atCurrent;
      next.disabled = lock;
      next.style.opacity = lock ? '0.35' : '';
      next.style.cursor = lock ? 'not-allowed' : '';
      next.title = atCurrent ? 'Mois courant — pas de navigation vers le futur' : '';
    }
  }
  // Exposé : l'état du bouton › doit être réévalué après chaque rendu.
  window.updateCoachCalNavState = function () { setCalNavState(false); };

  // delta : -1 (mois précédent) | +1 (mois suivant).
  // new Date(année, mois ± 1, 1) plutôt que setMonth() sur l'objet existant :
  // partir du 1er évite les débordements (31 janvier + 1 mois → 3 mars).
  // Le passage d'année est géré nativement (mois -1 → décembre de l'an passé).
  async function shiftMonth(delta) {
    if (calNavBusy) return;                       // clics multiples ignorés
    if (delta > 0 && isCurrentMonth()) return;    // borne haute : pas de futur

    var target = new Date(calDate.getFullYear(), calDate.getMonth() + delta, 1);
    // Ceinture : même si l'appel venait d'ailleurs que du bouton.
    if (target > new Date(new Date().getFullYear(), new Date().getMonth(), 1)) return;

    calNavBusy = true;
    calDate = target;
    setCalNavState(true);
    try {
      // loadCoachDashboard() et non renderCalendar() seul : les données
      // (dailyDollar, dailyR, dailyPct, dailyActions, dailyErrors, dailyJournal,
      // dailyChecklist) sont scopées au mois via mKey et doivent être rechargées.
      await window.loadCoachDashboard();
    } catch (e) {
      console.error('[COACH CAL] Rechargement du mois échoué:', e);
    } finally {
      calNavBusy = false;
      setCalNavState(false);
    }
  }

  window.previousGlobalMonth = function () { return shiftMonth(-1); };
  window.nextGlobalMonth = function () { return shiftMonth(1); };
})();
