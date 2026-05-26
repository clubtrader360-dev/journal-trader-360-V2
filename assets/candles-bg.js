/* Polish · Fond LIVE MARKET — bougies qui se forment tick par tick (Bloomberg × Linear).
   Moteur : ~28 bougies plein écran ; la bougie active (droite) se forme sur ~80 ticks/2s
   (open fixé, close oscille, mèches haute/basse s'étendent), puis se fige et tout glisse
   doucement vers la gauche tandis qu'une nouvelle commence (open = close précédente).
   Rendu : opacité 0.22, mix-blend-mode screen (illumine sans assombrir), glow shadowBlur 12.
   Garde-fous : body[data-animations="off"], prefers-reduced-motion, candles_bg_enabled.
   Perf : DPR capé à 2, pause si onglet inactif, resize debounce 200ms. */
(function () {
  'use strict';

  function animationsOff() { return document.body.dataset.animations === 'off'; }
  function candlesEnabled() { return window.DS_PREFS ? window.DS_PREFS.candles_bg_enabled !== false : true; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function init() {
    if (animationsOff() || !candlesEnabled() || reducedMotion()) return;

    // Fix visibilité : le bg du body part vers <html>, body transparent (le canvas screen illumine le fond).
    try {
      var bodyBg = getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
        document.documentElement.style.backgroundColor = bodyBg;
      }
      document.body.style.backgroundColor = 'transparent';
    } catch (e) { /* noop */ }

    var canvas = document.createElement('canvas');
    canvas.id = 'candles-bg';
    canvas.setAttribute('aria-hidden', 'true');
    // mix-blend-mode piloté par aube.css (screen en dark / multiply en light, dual-theme)
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0.22;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var GREEN = '#10b981', RED = '#ef4444', WICK = 'rgba(255,255,255,0.6)';
    var COUNT = 28, MARGIN = 70;
    var SPACING = 40, CW = 12, rightX = 0;
    var FORM_MS = 2000, TICKS = 80, TICK_MS = FORM_MS / TICKS;
    var candles = [], active = null, lastTick = 0, raf = null;

    function clampY(y) { return Math.max(MARGIN, Math.min(H - MARGIN, y)); }
    function newActive(openY, x) {
      return { x: x, tx: x, openY: openY, closeY: openY, highY: openY, lowY: openY, ticks: 0 };
    }
    function tick(c) {
      c.closeY = clampY(c.closeY + (Math.random() - 0.5) * (H * 0.012));
      if (c.closeY < c.highY) c.highY = c.closeY;
      if (c.closeY > c.lowY) c.lowY = c.closeY;
      c.ticks++;
    }
    function freeze() {
      candles.push(active);
      for (var i = 0; i < candles.length; i++) candles[i].tx -= SPACING;
      while (candles.length && candles[0].tx < -SPACING) candles.shift();
      active = newActive(active.closeY, rightX);
    }

    function metrics() {
      SPACING = W / COUNT;
      CW = Math.max(6, Math.min(14, SPACING * 0.45));
      rightX = (COUNT - 1) * SPACING;
    }
    function seed() {
      candles = [];
      var y = H / 2 + (Math.random() - 0.5) * H * 0.2;
      for (var i = 0; i < COUNT - 1; i++) {
        var openY = y, closeY = clampY(y + (Math.random() - 0.5) * H * 0.07);
        candles.push({
          x: i * SPACING, tx: i * SPACING, openY: openY, closeY: closeY,
          highY: clampY(Math.min(openY, closeY) - Math.random() * 28),
          lowY: clampY(Math.max(openY, closeY) + Math.random() * 28)
        });
        y = closeY;
      }
      active = newActive(y, rightX);
      lastTick = 0;
    }
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      metrics();
    }

    function drawCandle(c) {
      var color = c.closeY <= c.openY ? GREEN : RED;
      var bt = Math.min(c.openY, c.closeY), bb = Math.max(c.openY, c.closeY);
      ctx.shadowBlur = 0;                                   // mèche (pas de glow)
      ctx.strokeStyle = WICK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x + CW / 2, c.highY); ctx.lineTo(c.x + CW / 2, c.lowY); ctx.stroke();
      ctx.shadowBlur = 12; ctx.shadowColor = color;        // corps (glow)
      ctx.fillStyle = color; ctx.fillRect(c.x, bt, CW, Math.max(2, bb - bt));
    }

    function frame(ts) {
      if (!lastTick) lastTick = ts;
      while (ts - lastTick >= TICK_MS) {
        tick(active); lastTick += TICK_MS;
        if (active.ticks >= TICKS) freeze();
      }
      for (var i = 0; i < candles.length; i++) candles[i].x += (candles[i].tx - candles[i].x) * 0.12;
      ctx.clearRect(0, 0, W, H);
      for (var j = 0; j < candles.length; j++) drawCandle(candles[j]);
      drawCandle(active);
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { lastTick = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { resize(); seed(); }, 200); });

    resize(); seed(); start();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
