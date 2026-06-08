/* "Bourse à l'Aube" · JS — count-up (GSAP ou vanilla) + indicateur nav + horloge de Paris vivante
   + primitives de micro-célébration. Garde-fous : data-animations="off", prefers-reduced-motion. */
(function () {
  'use strict';

  function animationsOff() { return document.body.dataset.animations === 'off'; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function motionOk() { return !animationsOff() && !reducedMotion(); }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  var NUM_RE = /-?\d[\d\s,]*(?:\.\d+)?/;

  // ---- Count-up sur le P&L hero (#netPnlValue), 1× quand la vraie valeur arrive ----
  function countUp(el) {
    var text = el.textContent, m = text.match(NUM_RE);
    if (!m) return;
    var numStr = m[0], clean = numStr.replace(/[\s,]/g, ''), value = parseFloat(clean);
    if (!isFinite(value) || value === 0) return;
    var decimals = (clean.split('.')[1] || '').length, useGroup = /[,\s]\d{3}/.test(numStr);
    var prefix = text.slice(0, m.index), suffix = text.slice(m.index + numStr.length), mag = Math.abs(value);
    function fmt(v) {
      var s = v.toFixed(decimals);
      if (useGroup) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return prefix + s + suffix;
    }
    if (window.gsap) {                                   // GSAP installé/autorisé → tween propre
      var o = { v: 0 };
      window.gsap.to(o, { v: mag, duration: 1.4, ease: 'expo.out',
        onUpdate: function () { el.textContent = fmt(o.v); },
        onComplete: function () { el.textContent = text; } });
    } else {                                             // fallback vanilla
      var t0 = null;
      var frame = function (ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / 1400, 1);
        el.textContent = fmt(mag * easeOutExpo(p));
        if (p < 1) requestAnimationFrame(frame); else el.textContent = text;
      };
      requestAnimationFrame(frame);
    }
  }
  function watchPnl() {
    var el = document.getElementById('netPnlValue');
    if (!el || !motionOk()) return;
    var done = false;
    function maybe() {
      if (done) return;
      var m = el.textContent.match(NUM_RE), v = m ? parseFloat(m[0].replace(/[\s,]/g, '')) : null;
      if (v !== null && isFinite(v) && v !== 0) { done = true; obs.disconnect(); countUp(el); }
    }
    var obs = new MutationObserver(maybe); obs.observe(el, { childList: true, characterData: true, subtree: true }); maybe();
  }

  // ---- Indicateur nav doré qui glisse ----
  function initNavIndicator() {
    var items = Array.prototype.slice.call(document.querySelectorAll('#mainApp .sidebar-item[data-section]'));
    if (!items.length) return;
    var container = items[0].parentElement; if (!container) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    var bar = document.createElement('div'); bar.className = 'aube-nav-indicator'; bar.setAttribute('aria-hidden', 'true');
    container.appendChild(bar);
    function moveTo(el, animate) {
      if (!el) return;
      if (!animate) bar.style.transition = 'none';
      bar.style.height = el.offsetHeight + 'px';
      bar.style.transform = 'translateY(' + el.offsetTop + 'px)';
      if (!animate) { void bar.offsetHeight; bar.style.transition = ''; }
    }
    function active() { return document.querySelector('#mainApp .sidebar-item.active[data-section]') || items[0]; }
    moveTo(active(), false);
    items.forEach(function (it) { it.addEventListener('click', function () { moveTo(it, motionOk()); }); });
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { moveTo(active(), false); }, 200); });
  }

  // ---- Horloge de Paris vivante (tick à la seconde, marque le temps qui passe) ----
  function initParisClock() {
    if (document.querySelector('.aube-clock')) return;
    var el = document.createElement('div');
    el.className = 'aube-clock'; el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;right:16px;bottom:24px;z-index:5;';
    document.body.appendChild(el);
    function tick() {
      var s = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour12: false });
      el.textContent = s + ' Paris';
    }
    tick(); setInterval(tick, 1000);
  }

  // ---- Primitives de micro-célébration (exposées ; non auto-câblées, cf debrief) ----
  window.Aube = window.Aube || {};
  window.Aube.celebrateTop = function () {
    if (!motionOk()) return;
    document.body.classList.add('aube-celebrate-top');
    setTimeout(function () { document.body.classList.remove('aube-celebrate-top'); }, 450);
  };
  window.Aube.burst = function (anchor, n) {
    if (!motionOk() || !anchor) return;
    var r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < (n || 7); i++) {
      var d = document.createElement('div'); var ang = Math.random() * 6.283, dist = 24 + Math.random() * 40;
      d.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + cy + 'px;width:6px;height:6px;border-radius:50%;' +
        'background:radial-gradient(circle,#f4e4c1,#d4af37);box-shadow:0 0 8px #d4af37;pointer-events:none;z-index:9999;' +
        'transition:transform 600ms cubic-bezier(0.16,1,0.3,1),opacity 600ms ease;';
      document.body.appendChild(d);
      requestAnimationFrame(function (el, a, dd) {
        return function () { el.style.transform = 'translate(' + Math.cos(a) * dd + 'px,' + Math.sin(a) * dd + 'px) scale(0.2)'; el.style.opacity = '0'; };
      }(d, ang, dist));
      setTimeout(function (el) { return function () { el.remove(); }; }(d), 650);
    }
  };

  // ---- Login : toggle œil show/hide + trust badges (injection additive, idempotente) ----
  var SVG = {
    eye: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    trend: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
  };
  function initLogin() {
    var card = document.querySelector('#authScreen .auth-card');
    if (!card) return;
    // Toggle œil sur chaque champ password
    card.querySelectorAll('.form-group input[type="password"]').forEach(function (inp) {
      if (inp.parentNode && inp.parentNode.classList && inp.parentNode.classList.contains('aube-pw-wrap')) return;
      // Wrapper relatif autour du SEUL input → l'œil se centre sur l'input (pas sur le form-group label+input)
      var wrap = document.createElement('div'); wrap.className = 'aube-pw-wrap';
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'aube-eye'; btn.setAttribute('aria-label', 'Afficher le mot de passe');
      btn.innerHTML = SVG.eye;
      btn.addEventListener('click', function () {
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.innerHTML = show ? SVG.eyeOff : SVG.eye;
        btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });
      wrap.appendChild(btn);
    });
    // Trust badges → BANDEAU fixe en bas de page (hors card, plein largeur)
    var screen = document.getElementById('authScreen');
    if (screen && !document.querySelector('.aube-trust')) {
      var data = [
        [SVG.shield, 'Sécurité avancée', 'Vos données chiffrées et protégées, jamais partagées'],
        [SVG.trend, 'Analyse & Performance', 'Suivez, analysez et améliorez vos performances'],
        [SVG.target, 'Discipline & Réussite', 'Un journal, une méthode, des résultats durables']
      ];
      var row = document.createElement('div'); row.className = 'aube-trust'; row.setAttribute('aria-hidden', 'true');
      row.innerHTML = data.map(function (d) {
        return '<div><span class="aube-trust-ic">' + d[0] + '</span>' +
               '<div class="aube-trust-t">' + d[1] + '</div>' +
               '<div class="aube-trust-d">' + d[2] + '</div></div>';
      }).join('');
      screen.appendChild(row);
    }
  }

  // ---- Sparklines sur les 8 KPI cards du head (Dashboard) : VRAIES données 30j ----
  // Séries calculées depuis window.trades (déjà en mémoire, mêmes comptes filtrés que
  // les KPI affichés) : valeur CUMULÉE du KPI jour après jour sur les ~30 derniers jours
  // de trading → courbe de tendance lisse. Couleur = tendance réelle début→fin de fenêtre.
  // Animation GSAP (tracé gauche→droite) jouée UNE seule fois au 1er rendu réel.
  var SPARK_WINDOW = 30;                       // nb max de jours de trading affichés
  var SPARK_GREEN = '#10b981', SPARK_RED = '#ef4444';
  var SPARK_INVERTED = { 7: true };            // KPI dont la hausse est négative : Hors Méthode
  function sparkGold() { return document.body.classList.contains('dark-mode') ? '#cf8e3c' : '#7b6018'; }

  // Trades filtrés par comptes actifs (mêmes que les valeurs KPI affichées).
  function sparkTrades() {
    try { if (typeof window.getFilteredTrades === 'function') return window.getFilteredTrades() || []; }
    catch (e) {}
    return window.trades || [];
  }

  // Construit les 8 séries cumulées (ordre = mapping idx → KPI du #dashboard).
  // Retourne null si < 2 jours de données → fallback géré par buildSparkline.
  function computeKpiSeries() {
    var trades = sparkTrades();
    if (!Array.isArray(trades) || trades.length === 0) return null;

    var byDay = {};
    trades.forEach(function (t) {
      var d = t && t.date; if (!d) return;
      (byDay[d] || (byDay[d] = [])).push(t);
    });
    var days = Object.keys(byDay).sort();       // chronologique
    if (days.length < 2) return null;
    days = days.slice(-SPARK_WINDOW);           // 30 derniers jours de trading

    var cumProfit = 0, cumLoss = 0, cumWins = 0, cumLossCnt = 0, cumDecided = 0,
        cumWinDays = 0, cumDays = 0, cumPnl = 0, cumRR = 0, cumMeth = 0, cumHors = 0;
    var netPnl = [], tradeWin = [], dayWin = [], pf = [], awl = [], rr = [], meth = [], hors = [];

    days.forEach(function (d) {
      var dayPnl = 0;
      byDay[d].forEach(function (t) {
        var pnl = parseFloat(t.pnl) || 0;
        cumPnl += pnl; dayPnl += pnl;
        if (pnl > 0) { cumProfit += pnl; cumWins++; cumDecided++; }
        else if (pnl < 0) { cumLoss += Math.abs(pnl); cumLossCnt++; cumDecided++; }
        if (t.type && t.type.indexOf('RR1 atteint') !== -1) cumRR++;
        if (t.type && t.type.indexOf('RR2 atteint') !== -1) cumRR++;
        if (t.is_methode === true) cumMeth++;
        if (t.is_hors_methode === true) cumHors++;
      });
      cumDays++;
      if (dayPnl > 0) cumWinDays++;

      var avgWin = cumWins > 0 ? cumProfit / cumWins : 0;
      var avgLoss = cumLossCnt > 0 ? cumLoss / cumLossCnt : 0;

      netPnl.push(cumPnl);
      tradeWin.push(cumDecided > 0 ? (cumWins / cumDecided) * 100 : 0);
      dayWin.push(cumDays > 0 ? (cumWinDays / cumDays) * 100 : 0);
      pf.push(cumLoss > 0 ? cumProfit / cumLoss : (cumProfit > 0 ? 99.99 : 0));
      awl.push(avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 99.99 : 0));
      rr.push(cumRR);
      meth.push(cumMeth);
      hors.push(cumHors);
    });

    return [netPnl, tradeWin, dayWin, pf, awl, rr, meth, hors];
  }

  function buildSparkline(card, idx, series, animate) {
    var old = card.querySelector('.aube-spark');
    if (old) old.remove();                      // re-render propre (changement de comptes, etc.)

    var raw = series && series[idx];
    var W = 100, H = 34, pts, color;

    if (raw && raw.length >= 2) {
      var min = Math.min.apply(null, raw), max = Math.max.apply(null, raw), span = max - min;
      pts = raw.map(function (v) { return span > 0 ? (v - min) / span : 0.5; });
      var delta = raw[raw.length - 1] - raw[0];
      var eps = span > 0 ? span * 0.02 : 0;     // seuil neutre : 2% de l'amplitude
      var up = delta > eps, down = delta < -eps;
      if (SPARK_INVERTED[idx]) { var sw = up; up = down; down = sw; }
      color = up ? SPARK_GREEN : down ? SPARK_RED : sparkGold();
    } else {
      pts = [0.5, 0.5];                         // fallback honnête : ligne plate dorée (pas de fausse tendance)
      color = sparkGold();
    }

    var N = pts.length;
    var X = function (i) { return (i / (N - 1)) * W; }, Y = function (p) { return H - p * (H - 4) - 2; };
    var line = 'M' + pts.map(function (p, i) { return X(i).toFixed(1) + ' ' + Y(p).toFixed(1); }).join(' L');
    var area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    var gid = 'aubeSpark' + idx;
    var svg = '<svg class="aube-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity="0.2"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path class="aube-spark-line" d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    card.insertAdjacentHTML('beforeend', svg);

    if (animate) {
      var path = card.querySelector('.aube-spark-line');
      if (path && motionOk() && window.gsap) {
        var len = path.getTotalLength();
        if (len > 0) {
          window.gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          window.gsap.to(path, { strokeDashoffset: 0, duration: 1, ease: 'power3.out', delay: 0.1 + idx * 0.04 });
        }
      }
    }
  }

  var _sparkAnimated = false;                   // le tracé G→D ne s'anime qu'une fois
  function renderSparklines() {
    var cards = document.querySelectorAll('#dashboard .traderzella-banner .metric-item');
    if (!cards.length) return;
    var series = computeKpiSeries();
    var animate = !_sparkAnimated && !!series;  // anime au 1er rendu où on a de vraies données
    cards.forEach(function (c, i) { if (i < 8) buildSparkline(c, i, series, animate); });
    if (animate) _sparkAnimated = true;
  }
  window.aubeRenderSparklines = renderSparklines;   // exposé si besoin d'un re-render externe

  function initSparklines() {
    renderSparklines();                         // 1er passage (souvent fallback : trades pas encore chargés)
    // Re-render quand les KPI changent (chargement trades, filtre comptes) — découplé du
    // monolithe (pas d'édition des fonctions update*). 1er rendu réel immédiat, suivants debouncés.
    var anchor = document.getElementById('netPnlValue');
    if (!anchor) return;
    var rt;
    var obs = new MutationObserver(function () {
      if (!_sparkAnimated) { renderSparklines(); return; }
      clearTimeout(rt); rt = setTimeout(renderSparklines, 120);
    });
    obs.observe(anchor, { childList: true, characterData: true, subtree: true });
  }

  function init() { watchPnl(); initNavIndicator(); initParisClock(); initLogin(); initSparklines(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
