/* Polish · Item 1 — Fond animé : bougies de trading en arrière-plan.
   Canvas full-viewport fixed, z-index négatif, opacité basse (~0.08). Pause si onglet inactif.
   Garde-fous : body[data-animations="off"], prefers-reduced-motion, candles_bg_enabled. */
(function () {
  'use strict';

  function animationsOff() { return document.body.dataset.animations === 'off'; }
  function candlesEnabled() {
    // user_preferences.candles_bg_enabled via window.DS_PREFS ; fallback true si non chargé
    return window.DS_PREFS ? window.DS_PREFS.candles_bg_enabled !== false : true;
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function init() {
    if (animationsOff() || !candlesEnabled() || reducedMotion()) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'candles-bg';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0.08;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR pour le FPS
    var W = 0, H = 0, candles = [], raf = null;
    var COUNT = 18, GREEN = '#10b981', RED = '#ef4444';

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function makeCandle(x) {
      return {
        x: x, y: Math.random() * (H - 200) + 60,
        w: 8 + Math.random() * 6,
        bodyH: 24 + Math.random() * 90,
        wick: 10 + Math.random() * 40,
        up: Math.random() > 0.5,
        speed: 0.15 + Math.random() * 0.35   // lent
      };
    }
    function seed() { candles = []; for (var i = 0; i < COUNT; i++) candles.push(makeCandle(Math.random() * W)); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < candles.length; i++) {
        var c = candles[i];
        c.x -= c.speed;
        if (c.x < -20) { candles[i] = makeCandle(W + 20); continue; }
        var color = c.up ? GREEN : RED;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath();                                   // mèche
        ctx.moveTo(c.x + c.w / 2, c.y - c.wick);
        ctx.lineTo(c.x + c.w / 2, c.y + c.bodyH + c.wick);
        ctx.stroke();
        ctx.fillRect(c.x, c.y, c.w, c.bodyH);              // corps
      }
    }
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    function start() { if (!raf) loop(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { resize(); seed(); }, 200); });

    resize(); seed(); start();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
