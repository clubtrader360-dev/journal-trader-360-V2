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
      var grp = inp.closest('.form-group');
      if (!grp || grp.querySelector('.aube-eye')) return;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'aube-eye'; btn.setAttribute('aria-label', 'Afficher le mot de passe');
      btn.innerHTML = SVG.eye;
      btn.addEventListener('click', function () {
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.innerHTML = show ? SVG.eyeOff : SVG.eye;
        btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });
      grp.appendChild(btn);
    });
    // Trust badges (3 colonnes) — une seule fois
    if (!card.querySelector('.aube-trust')) {
      var data = [[SVG.shield, 'Sécurité avancée'], [SVG.trend, 'Analyse & Performance'], [SVG.target, 'Discipline & Réussite']];
      var row = document.createElement('div'); row.className = 'aube-trust';
      row.innerHTML = data.map(function (d) {
        return '<div><span class="aube-trust-ic">' + d[0] + '</span><div class="aube-trust-t">' + d[1] + '</div></div>';
      }).join('');
      card.appendChild(row);
    }
  }

  function init() { watchPnl(); initNavIndicator(); initParisClock(); initLogin(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
