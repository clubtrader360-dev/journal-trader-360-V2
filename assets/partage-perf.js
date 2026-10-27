/**
 * PARTAGER MES PERFORMANCES, la scène noir et or (27/10/2026, demande de Nadir).
 *
 * Remplace la carte bleu nuit de #35. Une seule fonction dessine la scène à
 * l'instant t (`dessiner(ctx, m, t)`) : l'aperçu animé, l'image PNG (dernière image
 * de la scène) et la vidéo (la scène enregistrée image par image) en sortent tous les
 * trois. Rien ne peut donc différer entre ce qu'on voit et ce qu'on télécharge.
 *
 *   window.PartagePerf.ouvrir(metrics)   la fenêtre : aperçu qui joue, « Image », « Vidéo »
 *   window.PartagePerf.dessiner(...)     la scène, pour les bancs
 *
 * Règles de la charte : fond noir chaud et halo d'or, or en accent, chiffres en
 * JetBrains Mono (tnum), easing unique cubic-bezier(0.16, 1, 0.3, 1).
 * ⛔ Pas de nombre de trades (demande de Nadir). Rappel du risque toujours présent.
 * Le rouge ne sert qu'à une perte (indicateur de résultat), jamais au décor.
 */
(function () {
  'use strict';

  const W = 1080, H = 1350, FPS = 30;
  const DUREE = 7.2;            // secondes ; l'image fixe est la dernière
  const C = {
    noir: '#0a0a0d', noir2: '#101014', or: '#E8B84B', or2: '#F3D585', orFonce: '#B98A2E',
    encre: '#F7F6F3', encreDouce: '#A6A6A1', encrePale: '#7E7E77', ligne: 'rgba(232,184,75,0.28)',
    perte: '#f2766d',
  };
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const SANS = 'Inter, system-ui, sans-serif';

  /* ── Le temps : easing unique de la charte, cubic-bezier(0.16, 1, 0.3, 1) ── */
  function bezier(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const x = (t) => ((ax * t + bx) * t + cx) * t;
    const y = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (u) => {
      if (u <= 0) return 0; if (u >= 1) return 1;
      let t = u;
      for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (x(t) - u) / d; }
      return y(Math.min(1, Math.max(0, t)));
    };
  }
  const ease = bezier(0.16, 1, 0.3, 1);
  /** Avancement 0 → 1 d'une étape qui commence à `debut` et dure `duree`. */
  const etape = (t, debut, duree) => ease((t - debut) / duree);

  /* ── Outils de dessin ── */
  function rond(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function espace(ctx, texte, x, y, ecart) {
    const lettres = [...String(texte)];
    const largeurs = lettres.map((l) => ctx.measureText(l).width);
    const total = largeurs.reduce((a, b) => a + b, 0) + ecart * (lettres.length - 1);
    let cx = x - total / 2;
    const align = ctx.textAlign; ctx.textAlign = 'left';
    lettres.forEach((l, i) => { ctx.fillText(l, cx, y); cx += largeurs[i] + ecart; });
    ctx.textAlign = align;
  }
  const montant = (v) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v)).toLocaleString('fr-FR').replace(/ /g, ' ');
  function degradeOr(ctx, x0, x1) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, C.orFonce); g.addColorStop(0.45, C.or2); g.addColorStop(0.7, C.or); g.addColorStop(1, C.orFonce);
    return g;
  }
  /** Générateur pseudo-aléatoire à graine : la même scène à chaque rendu. */
  function graine(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* ── Le décor : noir chaud, halo d'or, bougies fantômes, poussière d'or ── */
  function decor(ctx, t) {
    ctx.fillStyle = C.noir; ctx.fillRect(0, 0, W, H);
    const respire = 0.9 + 0.1 * Math.sin(t * 1.3);
    let g = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 900);
    g.addColorStop(0, `rgba(232,184,75,${0.22 * respire})`); g.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W / 2, H + 80, 40, W / 2, H + 80, 760);
    g.addColorStop(0, 'rgba(232,184,75,0.12)'); g.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Bougies fantômes qui montent derrière la scène (décor, pas une donnée).
    const r = graine(7);
    const apparition = etape(t, 0, 2.4);
    let p = 0.62;
    for (let i = 0; i < 26; i++) {
      const x = 70 + i * 36, o = p; p = Math.min(0.9, Math.max(0.25, p + (r() - 0.45) * 0.09));
      const haut = H * (1 - Math.max(o, p)) , bas = H * (1 - Math.min(o, p));
      const visible = Math.min(1, Math.max(0, apparition * 26 - i));
      if (visible <= 0) continue;
      ctx.globalAlpha = 0.07 * visible;
      ctx.fillStyle = C.or; ctx.fillRect(x - 7, haut, 14, Math.max(3, bas - haut));
      ctx.fillRect(x - 1, haut - 18 - r() * 30, 2, bas - haut + 36 + r() * 40);
    }
    ctx.globalAlpha = 1;

    // Poussière d'or qui dérive lentement.
    const s = graine(42);
    for (let i = 0; i < 46; i++) {
      const bx = s() * W, by = s() * H, v = 8 + s() * 18, taille = 0.8 + s() * 2.2;
      const y = (by - t * v + H) % H, x = bx + Math.sin(t * 0.6 + i) * 8;
      ctx.globalAlpha = (0.15 + 0.35 * s()) * Math.min(1, t / 1.2);
      ctx.fillStyle = C.or2; ctx.beginPath(); ctx.arc(x, y, taille, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Le cadre doré qui se trace autour de la scène. */
  function cadre(ctx, t) {
    const k = etape(t, 0.1, 1.1);
    if (k <= 0) return;
    const x = 34, y = 34, w = W - 68, h = H - 68, perim = 2 * (w + h);
    ctx.save();
    ctx.strokeStyle = C.ligne; ctx.lineWidth = 2;
    ctx.setLineDash([perim * k, perim]);
    ctx.lineDashOffset = 0;
    rond(ctx, x, y, w, h, 26); ctx.stroke();
    ctx.restore();
  }

  function carte(ctx, x, y, w, h, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.045)'); g.addColorStop(1, 'rgba(255,255,255,0.015)');
    ctx.fillStyle = g; rond(ctx, x, y, w, h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(232,184,75,0.30)'; ctx.lineWidth = 1.5; rond(ctx, x, y, w, h, 22); ctx.stroke();
    ctx.restore();
  }

  /* ── La scène complète à l'instant t ── */
  function dessiner(ctx, m, t, logo) {
    decor(ctx, t);
    cadre(ctx, t);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    // Logo
    const kLogo = etape(t, 0.3, 1.0);
    if (logo && kLogo > 0) {
      ctx.globalAlpha = kLogo;
      const lw = 380, lh = lw * (logo.height / logo.width || 0.185);
      ctx.drawImage(logo, (W - lw) / 2, 112 - (1 - kLogo) * 16, lw, lh);
      ctx.globalAlpha = 1;
    }

    // Titre et période
    const kTitre = etape(t, 0.8, 0.9);
    ctx.globalAlpha = kTitre;
    ctx.fillStyle = C.or; ctx.font = `600 26px ${SANS}`;
    espace(ctx, m.label.toUpperCase(), W / 2, 262 + (1 - kTitre) * 14, 26 * 0.22);
    ctx.fillStyle = C.encreDouce; ctx.font = `400 21px ${SANS}`;
    ctx.fillText(m.dateRange, W / 2, 302 + (1 - kTitre) * 14);
    ctx.globalAlpha = 1;

    // Le résultat : compteur, puis reflet d'or
    const kPnl = etape(t, 1.3, 1.9);
    if (t >= 1.2) {
      const gain = m.netPnl >= 0;
      ctx.fillStyle = C.encrePale; ctx.font = `600 19px ${SANS}`;
      ctx.globalAlpha = etape(t, 1.2, 0.6);
      espace(ctx, 'RÉSULTAT NET', W / 2, 400, 19 * 0.28);
      ctx.globalAlpha = 1;
      const valeur = m.netPnl * kPnl;
      ctx.font = `700 150px ${MONO}`;
      const texte = `${montant(valeur)} $`;
      const largeur = ctx.measureText(texte).width;
      ctx.fillStyle = gain ? degradeOr(ctx, W / 2 - largeur / 2, W / 2 + largeur / 2) : C.perte;
      ctx.save();
      ctx.shadowColor = gain ? 'rgba(232,184,75,0.35)' : 'rgba(242,118,109,0.25)'; ctx.shadowBlur = 40 * kPnl;
      ctx.fillText(texte, W / 2, 560);
      ctx.restore();
      // Reflet qui traverse le chiffre une fois arrivé.
      const kReflet = (t - 3.3) / 0.9;
      if (gain && kReflet > 0 && kReflet < 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(W / 2 - largeur / 2, 420, largeur, 170); ctx.clip();
        const rx = W / 2 - largeur / 2 + kReflet * (largeur + 240) - 120;
        const rg = ctx.createLinearGradient(rx - 80, 0, rx + 80, 0);
        rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, 'rgba(255,248,220,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = rg; ctx.fillText(texte, W / 2, 560);
        ctx.restore();
      }
    }

    // Le R, en pastille
    const kR = etape(t, 2.6, 0.8);
    if (kR > 0 && m.netPnlInR !== null && m.netPnlInR !== undefined) {
      const txt = `${m.netPnlInR >= 0 ? '+' : '−'}${Math.abs(m.netPnlInR).toFixed(1)} R`;
      ctx.font = `600 30px ${MONO}`;
      const tw = ctx.measureText(txt).width + 56, th = 54, x = W / 2 - tw / 2, y = 600;
      ctx.save(); ctx.globalAlpha = kR;
      ctx.translate(W / 2, y + th / 2); ctx.scale(0.85 + 0.15 * kR, 0.85 + 0.15 * kR); ctx.translate(-W / 2, -(y + th / 2));
      ctx.fillStyle = 'rgba(232,184,75,0.10)'; rond(ctx, x, y, tw, th, th / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(232,184,75,0.55)'; ctx.lineWidth = 1.5; rond(ctx, x, y, tw, th, th / 2); ctx.stroke();
      ctx.fillStyle = m.netPnlInR >= 0 ? C.or2 : C.perte; ctx.fillText(txt, W / 2, y + 38);
      ctx.restore();
    }

    // Les trois indicateurs (jamais le nombre de trades)
    const pf = m.profitFactor === null || m.profitFactor === undefined ? (m.winRate === 100 ? '∞' : '·') : m.profitFactor.toFixed(2).replace('.', ',');
    const troisieme = m.timeframe === 'day'
      ? { k: 'MEILLEUR TRADE', v: m.bestTrade !== null && m.bestTrade !== undefined ? `${montant(m.bestTrade)} $` : '·', perte: (m.bestTrade || 0) < 0 }
      : { k: 'MEILLEUR JOUR', v: m.meilleurJour ? `${montant(m.meilleurJour.pnl)} $` : '·', perte: m.meilleurJour ? m.meilleurJour.pnl < 0 : false };
    const kpis = [{ k: 'TAUX DE RÉUSSITE', v: `${m.winRate} %` }, { k: 'PROFIT FACTOR', v: pf }, troisieme];
    const cw = 296, ch = 150, gap = 24, x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = 700;
    kpis.forEach((kp, i) => {
      const k = etape(t, 3.0 + i * 0.16, 0.9);
      if (k <= 0) return;
      const x = x0 + i * (cw + gap), y = y0 + (1 - k) * 40;
      carte(ctx, x, y, cw, ch, k);
      ctx.globalAlpha = k;
      ctx.fillStyle = C.encrePale; ctx.font = `600 15px ${SANS}`; espace(ctx, kp.k, x + cw / 2, y + 52, 15 * 0.2);
      ctx.fillStyle = kp.perte ? C.perte : C.encre; ctx.font = `600 ${kp.v.length > 9 ? 38 : 48}px ${MONO}`;
      ctx.fillText(kp.v, x + cw / 2, y + 112);
      ctx.globalAlpha = 1;
    });

    // Le détail : courbe du jour, barres de la semaine, calendrier du mois
    const zone = { x: x0, y: 880, w: cw * 3 + gap * 2, h: 250 };
    const kZone = etape(t, 3.6, 0.8);
    if (kZone > 0) {
      carte(ctx, zone.x, zone.y, zone.w, zone.h, kZone);
      if (m.timeframe === 'day') courbe(ctx, m, t, zone);
      else if (m.timeframe === 'week') barres(ctx, m, t, zone);
      else calendrier(ctx, m, t, zone);
    }

    // Le rappel du risque et la signature
    const kPied = etape(t, 4.8, 0.9);
    ctx.globalAlpha = kPied;
    ctx.fillStyle = C.encrePale; ctx.font = `italic 400 17px ${SANS}`;
    ctx.fillText('Le trading comporte un risque de perte en capital. Résultat individuel, non représentatif.', W / 2, 1186);
    const lg = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
    lg.addColorStop(0, 'rgba(232,184,75,0)'); lg.addColorStop(0.5, 'rgba(232,184,75,0.7)'); lg.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = lg; ctx.fillRect(W / 2 - 300 * kPied, 1220, 600 * kPied, 1);
    ctx.fillStyle = C.or; ctx.font = `600 24px ${SANS}`;
    espace(ctx, '@trader360_officiel', W / 2, 1268, 24 * 0.16);
    ctx.fillStyle = C.encrePale; ctx.font = `400 17px ${SANS}`;
    ctx.fillText('trader360.fr', W / 2, 1300);
    ctx.globalAlpha = 1;
  }

  /** La courbe de la journée : le cumul des résultats, tracé de gauche à droite. */
  function courbe(ctx, m, t, z) {
    const pts = m.courbe && m.courbe.length ? [0, ...m.courbe] : [0, m.netPnl];
    const min = Math.min(0, ...pts), max = Math.max(0, ...pts), amp = max - min || 1;
    const px = (i) => z.x + 50 + (i / (pts.length - 1)) * (z.w - 100);
    const py = (v) => z.y + z.h - 50 - ((v - min) / amp) * (z.h - 110);
    ctx.fillStyle = C.encrePale; ctx.font = `600 15px ${SANS}`;
    espace(ctx, 'LA JOURNÉE', z.x + z.w / 2, z.y + 40, 15 * 0.2);
    // Ligne du zéro
    ctx.strokeStyle = 'rgba(247,246,243,0.10)'; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(z.x + 40, py(0)); ctx.lineTo(z.x + z.w - 40, py(0)); ctx.stroke(); ctx.setLineDash([]);
    const k = etape(t, 3.9, 1.6), n = (pts.length - 1) * k;
    const fin = Math.floor(n), frac = n - fin;
    ctx.beginPath(); ctx.moveTo(px(0), py(pts[0]));
    for (let i = 1; i <= fin; i++) ctx.lineTo(px(i), py(pts[i]));
    let bx = px(fin), by = py(pts[fin]);
    if (fin < pts.length - 1) { bx = px(fin) + (px(fin + 1) - px(fin)) * frac; by = py(pts[fin]) + (py(pts[fin + 1]) - py(pts[fin])) * frac; ctx.lineTo(bx, by); }
    ctx.strokeStyle = m.netPnl >= 0 ? C.or : C.perte; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    // Remplissage doux sous la courbe
    ctx.lineTo(bx, py(0)); ctx.lineTo(px(0), py(0)); ctx.closePath();
    const g = ctx.createLinearGradient(0, z.y + 60, 0, z.y + z.h - 40);
    g.addColorStop(0, m.netPnl >= 0 ? 'rgba(232,184,75,0.22)' : 'rgba(242,118,109,0.18)'); g.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = g; ctx.fill();
    // Point lumineux en tête de courbe
    if (k > 0) {
      ctx.save(); ctx.shadowColor = C.or2; ctx.shadowBlur = 24;
      ctx.fillStyle = C.or2; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  /** La semaine : cinq barres qui poussent, or pour un jour positif. */
  function barres(ctx, m, t, z) {
    const jours = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
    const b = (m.dailyBars || []).slice(0, 5);
    const maxAbs = Math.max(1, ...b.map((x) => Math.abs(x.pnl)));
    const bw = 92, gap = (z.w - bw * 5) / 6, base = z.y + z.h - 70, hautMax = z.h - 120;
    jours.forEach((j, i) => {
      const d = b[i] || { pnl: 0 };
      const k = etape(t, 3.9 + i * 0.12, 1.0);
      const x = z.x + gap + i * (bw + gap), h = Math.max(3, (Math.abs(d.pnl) / maxAbs) * hautMax * k);
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      if (d.pnl >= 0) { g.addColorStop(0, C.or2); g.addColorStop(1, C.orFonce); } else { g.addColorStop(0, C.perte); g.addColorStop(1, 'rgba(242,118,109,0.4)'); }
      ctx.fillStyle = d.pnl === 0 ? 'rgba(247,246,243,0.12)' : g;
      rond(ctx, x, base - h, bw, h, 8); ctx.fill();
      ctx.globalAlpha = k;
      if (d.pnl !== 0) { ctx.fillStyle = C.encre; ctx.font = `600 18px ${MONO}`; ctx.fillText(montant(d.pnl), x + bw / 2, base - h - 12); }
      ctx.fillStyle = C.encrePale; ctx.font = `600 15px ${SANS}`; ctx.fillText(j, x + bw / 2, base + 30);
      ctx.globalAlpha = 1;
    });
  }

  /** Le mois : le calendrier qui s'allume jour après jour. */
  function calendrier(ctx, m, t, z) {
    const ref = m.reference ? new Date(m.reference + 'T00:00:00') : new Date();
    const premier = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const col0 = (premier.getDay() + 6) % 7, nb = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const parJour = {}; (m.dailyBars || []).forEach((d) => { parJour[Number(d.date.slice(8, 10))] = d.pnl; });
    const maxAbs = Math.max(1, ...Object.values(parJour).map(Math.abs));
    const cw = 118, ch = 30, gap = 6, x0 = z.x + (z.w - (cw * 7 + gap * 6)) / 2, y0 = z.y + 22;
    for (let d = 1; d <= nb; d++) {
      const c = (col0 + d - 1) % 7, r = Math.floor((col0 + d - 1) / 7);
      const k = etape(t, 3.8 + d * 0.035, 0.6);
      const x = x0 + c * (cw + gap), y = y0 + r * (ch + gap), v = parJour[d];
      ctx.globalAlpha = 0.25 + 0.75 * k;
      if (v) {
        const a = 0.25 + 0.75 * Math.min(1, Math.abs(v) / maxAbs);
        ctx.fillStyle = v > 0 ? `rgba(232,184,75,${a * k})` : `rgba(242,118,109,${a * k})`;
      } else ctx.fillStyle = 'rgba(247,246,243,0.05)';
      rond(ctx, x, y, cw, ch, 6); ctx.fill();
      if (v && k > 0.5) {
        ctx.fillStyle = v > 0 ? C.noir : C.encre; ctx.font = `600 14px ${MONO}`; ctx.textBaseline = 'middle';
        ctx.fillText(montant(v), x + cw / 2, y + ch / 2 + 1); ctx.textBaseline = 'alphabetic';
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ── Sorties : image, vidéo ── */
  function chargerLogo() {
    return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/assets/marque/t360-logo-or.png'; });
  }
  async function pretAPeindre() {
    try { if (document.fonts) { await document.fonts.load(`700 150px ${MONO}`); await document.fonts.load(`600 26px ${SANS}`); await document.fonts.ready; } } catch { /* rien */ }
    return chargerLogo();
  }
  function nomFichier(m, ext) { return `trader360-performance-${m.timeframe}-${new Date().toISOString().slice(0, 10)}.${ext}`; }
  function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function image(m, logo) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    dessiner(c.getContext('2d'), m, DUREE, logo);
    return new Promise((ok) => c.toBlob(ok, 'image/png'));
  }
  /** Le format vidéo : MP4 quand le navigateur sait l'enregistrer (Chrome récent, Safari), sinon WebM. */
  function formatVideo() {
    const essais = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    return (window.MediaRecorder && essais.find((f) => MediaRecorder.isTypeSupported(f))) || null;
  }
  async function video(m, logo, progression) {
    const format = formatVideo();
    if (!format) throw new Error('ce navigateur ne sait pas enregistrer de vidéo : utilise Chrome ou Safari');
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    dessiner(ctx, m, 0, logo);
    const flux = c.captureStream(FPS);
    const rec = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 8_000_000 });
    const morceaux = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) morceaux.push(e.data); };
    const fini = new Promise((ok) => { rec.onstop = ok; });
    rec.start(250);
    const debut = performance.now(), fin = DUREE + 1.2; // on tient la dernière image un peu
    await new Promise((ok) => {
      const pas = () => {
        const t = (performance.now() - debut) / 1000;
        dessiner(ctx, m, Math.min(t, DUREE), logo);
        if (progression) progression(Math.min(1, t / fin));
        if (t < fin) requestAnimationFrame(pas); else ok();
      };
      requestAnimationFrame(pas);
    });
    rec.stop(); await fini;
    return { blob: new Blob(morceaux, { type: format.split(';')[0] }), ext: format.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }

  /* ── La fenêtre de partage : l'aperçu joue la scène en boucle ── */
  let ouverte = null;
  async function ouvrir(m) {
    fermer();
    const fond = document.createElement('div');
    fond.className = 'pp-fond';
    fond.innerHTML = `<style>
      .pp-fond{position:fixed;inset:0;z-index:10000;background:rgba(5,5,6,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;animation:pp-in .4s cubic-bezier(.16,1,.3,1)}
      @keyframes pp-in{from{opacity:0}to{opacity:1}}
      .pp-boite{display:grid;gap:14px;justify-items:center;max-height:100%}
      .pp-boite canvas{height:min(72vh,780px);width:auto;aspect-ratio:1080/1350;border-radius:18px;box-shadow:0 30px 80px -20px rgba(232,184,75,.35),0 0 0 1px rgba(232,184,75,.3)}
      .pp-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
      .pp-btn{display:inline-flex;align-items:center;gap:8px;border-radius:40px;padding:11px 20px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(232,184,75,.45);background:rgba(255,255,255,.03);color:#F7F6F3;transition:border-color .2s cubic-bezier(.16,1,.3,1),color .2s cubic-bezier(.16,1,.3,1)}
      .pp-btn:hover{border-color:#E8B84B;color:#E8B84B}
      .pp-btn--or{background:linear-gradient(180deg,#F3D585,#E8B84B);color:#120E07;border-color:transparent}
      .pp-btn--or:hover{color:#120E07}
      .pp-btn:disabled{opacity:.55;cursor:wait}
      .pp-etat{min-height:18px;color:#A6A6A1;font:400 13px Inter,system-ui,sans-serif;text-align:center}
    </style>
    <div class="pp-boite" role="dialog" aria-label="Partager mes performances">
      <canvas width="${W}" height="${H}"></canvas>
      <div class="pp-actions">
        <button type="button" class="pp-btn pp-btn--or" data-pp="video"><i class="fas fa-film"></i> Télécharger la vidéo</button>
        <button type="button" class="pp-btn" data-pp="image"><i class="fas fa-image"></i> Télécharger l'image</button>
        <button type="button" class="pp-btn" data-pp="rejouer"><i class="fas fa-redo"></i> Rejouer</button>
        <button type="button" class="pp-btn" data-pp="fermer">Fermer</button>
      </div>
      <p class="pp-etat" data-pp-etat></p>
    </div>`;
    document.body.appendChild(fond);
    const canvas = fond.querySelector('canvas'), ctx = canvas.getContext('2d'), etat = fond.querySelector('[data-pp-etat]');
    const logo = await pretAPeindre();
    let debut = performance.now(), anim = 0;
    const jouer = () => {
      const t = (performance.now() - debut) / 1000;
      dessiner(ctx, m, Math.min(t, DUREE), logo);
      anim = requestAnimationFrame(jouer);
    };
    jouer();
    const occupe = (b) => fond.querySelectorAll('.pp-btn').forEach((x) => { x.disabled = b; });
    fond.addEventListener('click', async (e) => {
      if (e.target === fond) return fermer();
      const b = e.target.closest('[data-pp]'); if (!b) return;
      const quoi = b.dataset.pp;
      if (quoi === 'fermer') return fermer();
      if (quoi === 'rejouer') { debut = performance.now(); return; }
      if (quoi === 'image') { telecharger(await image(m, logo), nomFichier(m, 'png')); etat.textContent = 'Image téléchargée.'; return; }
      if (quoi === 'video') {
        occupe(true);
        try {
          const r = await video(m, logo, (p) => { etat.textContent = `Enregistrement de la vidéo… ${Math.round(p * 100)} %`; });
          telecharger(r.blob, nomFichier(m, r.ext));
          etat.textContent = r.ext === 'mp4' ? 'Vidéo téléchargée (MP4), prête pour Instagram.' : 'Vidéo téléchargée (WebM). Pour Instagram, Chrome récent ou Safari donnent directement du MP4.';
        } catch (err) { etat.textContent = err.message; }
        occupe(false);
      }
    });
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);
    ouverte = { fond, arreter: () => { cancelAnimationFrame(anim); document.removeEventListener('keydown', echap); } };
  }
  function fermer() { if (ouverte) { ouverte.arreter(); ouverte.fond.remove(); ouverte = null; } }

  window.PartagePerf = { ouvrir, fermer, dessiner, DUREE, W, H, ease };
})();
