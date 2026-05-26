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

  function init() { watchPnl(); initNavIndicator(); initParisClock(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
