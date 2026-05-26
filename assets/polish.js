/* Polish · JS — count-up P&L hero (easeOutExpo) + indicateur nav doré qui glisse.
   Vanilla pur. Garde-fous : body[data-animations="off"], prefers-reduced-motion.
   N'altère aucune logique existante (lecture seule du DOM + éléments injectés). */
(function () {
  'use strict';

  function animationsOff() { return document.body.dataset.animations === 'off'; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function motionOk() { return !animationsOff() && !reducedMotion(); }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  var NUM_RE = /-?\d[\d\s,]*(?:\.\d+)?/;

  // ---- 4. Count-up sur le P&L hero (#netPnlValue), une seule fois quand la vraie valeur arrive ----
  function countUp(el) {
    var text = el.textContent;
    var m = text.match(NUM_RE);
    if (!m) return;
    var numStr = m[0], idx = m.index;
    var clean = numStr.replace(/[\s,]/g, '');
    var value = parseFloat(clean);
    if (!isFinite(value) || value === 0) return;
    var decimals = (clean.split('.')[1] || '').length;
    var useGroup = /[,\s]\d{3}/.test(numStr);
    var prefix = text.slice(0, idx);          // garde $, -$, +$ …
    var suffix = text.slice(idx + numStr.length);
    var mag = Math.abs(value), dur = 1400, t0 = null;

    function fmt(v) {
      var s = v.toFixed(decimals);
      if (useGroup) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return prefix + s + suffix;
    }
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      el.textContent = fmt(mag * easeOutExpo(p));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = text;             // restaure le format exact d'origine
    }
    requestAnimationFrame(frame);
  }

  function watchPnl() {
    var el = document.getElementById('netPnlValue');
    if (!el || !motionOk()) return;            // si anims off : on laisse la valeur telle quelle
    var done = false;
    function maybe() {
      if (done) return;
      var m = el.textContent.match(NUM_RE);
      var v = m ? parseFloat(m[0].replace(/[\s,]/g, '')) : null;
      if (v !== null && isFinite(v) && v !== 0) { done = true; obs.disconnect(); countUp(el); }
    }
    var obs = new MutationObserver(maybe);
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    maybe();                                   // au cas où déjà peuplé
  }

  // ---- 6. Indicateur nav doré qui glisse sous l'onglet actif (sidebar verticale élève) ----
  function initNavIndicator() {
    var items = Array.prototype.slice.call(document.querySelectorAll('#mainApp .sidebar-item[data-section]'));
    if (!items.length) return;
    var container = items[0].parentElement;
    if (!container) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    var bar = document.createElement('div');
    bar.className = 'polish-nav-indicator';
    bar.setAttribute('aria-hidden', 'true');
    container.appendChild(bar);

    function moveTo(el, animate) {
      if (!el) return;
      if (!animate) bar.style.transition = 'none';
      bar.style.height = el.offsetHeight + 'px';
      bar.style.transform = 'translateY(' + el.offsetTop + 'px)';
      if (!animate) { void bar.offsetHeight; bar.style.transition = ''; } // reflow → réactive la transition
    }
    function active() { return document.querySelector('#mainApp .sidebar-item.active[data-section]') || items[0]; }

    moveTo(active(), false);
    items.forEach(function (it) {
      it.addEventListener('click', function () { moveTo(it, motionOk()); });
    });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { moveTo(active(), false); }, 200); });
  }

  function init() { watchPnl(); initNavIndicator(); }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
