/* "Bourse à l'Aube" · couches de fond 3 & 4 — ticker de paires + particules dorées.
   Vanilla. Garde-fous : body[data-animations="off"], prefers-reduced-motion, candles_bg_enabled.
   Particules : 3-5 visibles, mouvement brownien lent, opacité ≤0.4, lifetime ~30s, pause si onglet inactif. */
(function () {
  'use strict';

  function animationsOff() { return document.body.dataset.animations === 'off'; }
  function ambianceEnabled() { return window.DS_PREFS ? window.DS_PREFS.candles_bg_enabled !== false : true; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // ---- Couche 3 : ticker de paires (texture, pas distraction) ----
  function buildTicker() {
    if (document.getElementById('aube-ticker')) return;
    var pairs = [
      ['EUR/USD', 1.0842, 0.12], ['GBP/USD', 1.2716, -0.08], ['BTC/USD', 67432, 1.34],
      ['GOLD', 2384.5, 0.46], ['SP500', 5487.0, 0.21], ['NASDAQ', 19023, -0.33],
      ['USD/JPY', 157.21, 0.05], ['ES', 5491.25, 0.18], ['NQ', 19210.5, -0.22], ['CL', 78.94, 0.61]
    ];
    var row = pairs.concat(pairs).map(function (p) {
      var cls = p[2] >= 0 ? 'up' : 'down';
      var sign = p[2] >= 0 ? '▲' : '▼';
      return '<span style="padding:0 22px">' + p[0] + ' <span class="' + cls + '">' + p[1] +
             ' ' + sign + ' ' + Math.abs(p[2]).toFixed(2) + '%</span></span>';
    }).join('');
    var el = document.createElement('div');
    el.id = 'aube-ticker';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="aube-ticker-row">' + row + '</div>';
    document.body.appendChild(el);
  }

  // ---- Couche 4 : particules dorées ----
  function buildParticles() {
    if (document.getElementById('aube-particles')) return;
    var canvas = document.createElement('canvas');
    canvas.id = 'aube-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], raf = null, MAX = 5;

    function resize() { W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function spawn() {
      return { x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
        r: 1 + Math.random() * 1.8, life: 0, max: 1500 + Math.random() * 1500, // ~25-50s @60fps
        a: 0 };
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      while (parts.length < MAX) parts.push(spawn());
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        p.vx += (Math.random() - 0.5) * 0.01; p.vy += (Math.random() - 0.5) * 0.01; // brownien
        var t = p.life / p.max;
        p.a = Math.sin(Math.min(t, 1) * Math.PI) * 0.4;                              // fade in/out, max 0.4
        if (p.life >= p.max || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) { parts.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = 'rgba(212,175,55,' + p.a.toFixed(3) + ')';
        ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(212,175,55,0.6)';
        ctx.fill(); ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(resize, 200); });
    resize(); start();
  }

  function init() {
    if (animationsOff() || !ambianceEnabled()) return;
    buildTicker();
    if (!reducedMotion()) buildParticles(); // particules = mouvement pur → off si reduced-motion
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
