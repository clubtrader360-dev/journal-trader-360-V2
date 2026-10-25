/**
 * LE CERTIFICAT DE RÉUSSITE TRADER 360 (P2, tâche 17, 25/10/2026).
 *
 *   FormationDiplome.dessiner(canvas, d)   → dessine le certificat (A4 paysage, 300 dpi)
 *   FormationDiplome.pdf(d)                → Promise<Blob> du PDF, prêt à télécharger
 *   FormationDiplome.telecharger(d)        → déclenche le téléchargement
 *
 *   d = { prenom, nom, date (ISO), score, total, numero, logo (URL ou data:) }
 *
 * POURQUOI DANS LE NAVIGATEUR. Le certificat se dessine avec les polices que la page a
 * déjà chargées (Fraunces, Inter, JetBrains Mono) : le rendu est celui de l'espace
 * membre, au pixel. Le serveur n'a ni Fraunces en TTF ni de quoi écrire un PDF, et le
 * plan Hobby n'a plus de fonction libre. Le PDF est écrit ici à la main : une page,
 * une image JPEG (300 dpi). C'est le format PDF le plus simple qui soit, lu partout.
 *
 * ⛔ « CERTIFICAT », PAS « DIPLÔME » : le document atteste un parcours de formation
 * privée. Le mot « diplôme » laisse croire à un titre reconnu par l'État ; la mention
 * de bas de page le dit noir sur blanc.
 * ⚠️ Textes proposés au nom des coachs : validés par Nadir.
 */
(function () {
  'use strict';

  const L = 3508; const H = 2480;           // A4 paysage à 300 dpi
  const C = {
    papier: '#fbf7ee', papier2: '#f4ecd9', encre: '#0b1630', doux: '#5b6275',
    or: '#b8902f', orClair: '#d9b45a', orFonce: '#8a6a1f',
  };
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFr = (iso) => { const t = new Date(iso); return Number.isNaN(t.getTime()) ? '' : `${t.getDate()} ${MOIS[t.getMonth()]} ${t.getFullYear()}`; };

  function chargerImage(src) {
    return new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ko(new Error('logo illisible')); i.src = src; });
  }

  /** ⛔ Sans cette attente, le canvas dessine en police de repli, sans la moindre erreur. */
  async function polices() {
    if (!document.fonts) return;
    await Promise.all([
      document.fonts.load('italic 600 160px Fraunces'),
      document.fonts.load('italic 400 80px Fraunces'),
      document.fonts.load('600 60px Inter'),
      document.fonts.load('700 60px Inter'),
      document.fonts.load('400 60px Inter'),
      document.fonts.load('500 50px "JetBrains Mono"'),
    ]);
  }

  function texteCentre(ctx, t, y, police, couleur, espacement) {
    ctx.font = police; ctx.fillStyle = couleur; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = espacement || '0px';
    ctx.fillText(t, L / 2, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  /** Réduit la police tant que le texte dépasse la largeur permise (noms longs). */
  function ajuster(ctx, t, taille, gabarit, largeurMax) {
    let s = taille;
    do { ctx.font = gabarit.replace('{t}', s); s -= 4; } while (ctx.measureText(t).width > largeurMax && s > 40);
    return ctx.font;
  }

  function filet(ctx, x1, y, x2, couleur, ep) {
    ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  }

  function losange(ctx, x, y, r, couleur) {
    ctx.fillStyle = couleur; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
  }

  /** Le sceau : un hexagone double, comme le badge de certification de l'espace membre. */
  function sceau(ctx, x, y, r) {
    const hex = (rr) => { ctx.beginPath(); for (let i = 0; i < 6; i += 1) { const a = Math.PI / 6 + (i * Math.PI) / 3; const px = x + rr * Math.cos(a); const py = y + rr * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); };
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, C.orClair); g.addColorStop(0.5, C.or); g.addColorStop(1, C.orFonce);
    hex(r); ctx.fillStyle = C.encre; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = g; ctx.stroke();
    hex(r * 0.84); ctx.lineWidth = 4; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 34px "JetBrains Mono", monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText('CERTIFIÉ', x, y - 46);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = 'italic 600 120px Fraunces, Georgia, serif';
    ctx.fillText('360', x, y + 22);
    ctx.textBaseline = 'alphabetic';
  }

  async function dessiner(canvas, d) {
    await polices();
    canvas.width = L; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Le papier : crème, à peine nuancé vers les bords.
    const fond = ctx.createRadialGradient(L / 2, H / 2, H * 0.2, L / 2, H / 2, L * 0.75);
    fond.addColorStop(0, C.papier); fond.addColorStop(1, C.papier2);
    ctx.fillStyle = fond; ctx.fillRect(0, 0, L, H);

    // Le double cadre or, coins marqués.
    ctx.strokeStyle = C.or; ctx.lineWidth = 14; ctx.strokeRect(110, 110, L - 220, H - 220);
    ctx.lineWidth = 4; ctx.strokeRect(150, 150, L - 300, H - 300);
    for (const [x, y] of [[150, 150], [L - 150, 150], [150, H - 150], [L - 150, H - 150]]) losange(ctx, x, y, 26, C.or);

    // Le logo.
    if (d.logo) {
      try {
        const img = await chargerImage(d.logo);
        const lw = 900; const lh = (img.height / img.width) * lw;
        ctx.drawImage(img, (L - lw) / 2, 290, lw, lh);
      } catch (e) { /* sans logo, le certificat reste valable */ }
    }

    texteCentre(ctx, 'CERTIFICAT DE RÉUSSITE', 640, '500 58px "JetBrains Mono", monospace', C.or, '18px');
    filet(ctx, L / 2 - 520, 700, L / 2 - 60, C.or, 3); losange(ctx, L / 2, 700, 14, C.or); filet(ctx, L / 2 + 60, 700, L / 2 + 520, C.or, 3);
    texteCentre(ctx, 'Formation Trader 360', 860, '600 128px Inter, Arial, sans-serif', C.encre, '-2px');

    texteCentre(ctx, 'décerné à', 1030, '400 62px Inter, Arial, sans-serif', C.doux);
    const nom = `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Trader 360';
    const police = ajuster(ctx, nom, 230, 'italic 600 {t}px Fraunces, Georgia, serif', L - 900);
    texteCentre(ctx, nom, 1290, police, C.encre);
    filet(ctx, L / 2 - 900, 1360, L / 2 + 900, C.orClair, 3);

    texteCentre(ctx, 'pour avoir suivi l’intégralité de la formation Trader 360 et réussi l’examen final', 1500, '400 66px Inter, Arial, sans-serif', C.encre);
    texteCentre(ctx, 'de certification : questions de méthode et exercices sur graphique.', 1600, '400 66px Inter, Arial, sans-serif', C.encre);
    if (d.score != null && d.total) texteCentre(ctx, `Score obtenu : ${d.score} / ${d.total}`, 1730, '500 58px "JetBrains Mono", monospace', C.or);

    // Bas : date à gauche, sceau au centre, signatures à droite.
    const yb = 2050;
    ctx.textAlign = 'center';
    ctx.font = 'italic 400 76px Fraunces, Georgia, serif'; ctx.fillStyle = C.encre; ctx.fillText(dateFr(d.date), 760, yb);
    filet(ctx, 430, yb + 40, 1090, C.or, 3);
    ctx.font = '400 46px Inter, Arial, sans-serif'; ctx.fillStyle = C.doux; ctx.fillText('Date de certification', 760, yb + 110);

    sceau(ctx, L / 2, yb - 90, 200);

    ctx.font = 'italic 400 76px Fraunces, Georgia, serif'; ctx.fillStyle = C.encre; ctx.fillText('Nadir Kasmi · Emmanuel Galiano', L - 760, yb);
    filet(ctx, L - 1180, yb + 40, L - 340, C.or, 3);
    ctx.font = '400 46px Inter, Arial, sans-serif'; ctx.fillStyle = C.doux; ctx.fillText('Les coachs Trader 360', L - 760, yb + 110);

    // Numéro et mention.
    ctx.textAlign = 'left'; ctx.font = '500 38px "JetBrains Mono", monospace'; ctx.fillStyle = C.doux;
    ctx.fillText(`N° ${d.numero || ''}`, 240, H - 215);
    ctx.textAlign = 'right'; ctx.font = '400 36px Inter, Arial, sans-serif';
    ctx.fillText('Certificat de formation privée Trader 360, trader360.fr. Il ne constitue ni un diplôme d’État ni une habilitation professionnelle.', L - 240, H - 215);
    ctx.textAlign = 'left';
    return canvas;
  }

  /** Un PDF d'une page, l'image JPEG en pleine page (A4 paysage : 842 × 595 points). */
  function pdfDeJpeg(octets, largeurPx, hauteurPx) {
    const W = 841.89; const Hp = 595.28;
    const enc = new TextEncoder();
    const morceaux = []; const decalages = []; let taille = 0;
    const pousser = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; morceaux.push(b); taille += b.length; };
    const objet = (n, corps) => { decalages[n] = taille; pousser(`${n} 0 obj\n`); for (const c of corps) pousser(c); pousser('\nendobj\n'); };
    pousser('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objet(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    objet(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
    objet(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${Hp}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
    objet(4, [`<< /Type /XObject /Subtype /Image /Width ${largeurPx} /Height ${hauteurPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${octets.length} >>\nstream\n`, octets, '\nendstream']);
    const contenu = `q ${W} 0 0 ${Hp} 0 0 cm /Im0 Do Q`;
    objet(5, [`<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`]);
    objet(6, [`<< /Title (Certificat Trader 360) /Producer (Trader 360) >>`]);
    const xref = taille;
    let table = `xref\n0 7\n0000000000 65535 f \n`;
    for (let n = 1; n <= 6; n += 1) table += `${String(decalages[n]).padStart(10, '0')} 00000 n \n`;
    pousser(table);
    pousser(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(morceaux, { type: 'application/pdf' });
  }

  async function pdf(d) {
    const canvas = document.createElement('canvas');
    await dessiner(canvas, d);
    const jpeg = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
    if (!jpeg) throw new Error('certificat : image non produite');
    return pdfDeJpeg(new Uint8Array(await jpeg.arrayBuffer()), L, H);
  }

  async function telecharger(d) {
    const blob = await pdf(d);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Certificat-Trader-360-${`${d.prenom || ''}-${d.nom || ''}`.replace(/[^A-Za-zÀ-ÿ0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * LA FUSÉE DE LA CERTIFICATION. Plein écran, environ quatre secondes : la fusée or
   * décolle du bas, traverse le ciel, éclate en étincelles, et le certificat arrive.
   * ⛔ `prefers-reduced-motion` : aucun mouvement, la carte du certificat directement.
   * Easing unique de la charte : cubic-bezier(0.16, 1, 0.3, 1).
   */
  const FUSEE = `<svg viewBox="0 0 120 260" aria-hidden="true">
    <defs><linearGradient id="fdOr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d585"/><stop offset=".55" stop-color="#e8b84b"/><stop offset="1" stop-color="#a87b22"/></linearGradient></defs>
    <path d="M60 8C84 34 92 74 92 120v62H28v-62C28 74 36 34 60 8Z" fill="#0d0f13" stroke="url(#fdOr)" stroke-width="5"/>
    <circle cx="60" cy="96" r="17" fill="none" stroke="url(#fdOr)" stroke-width="5"/>
    <circle cx="60" cy="96" r="7" fill="url(#fdOr)" opacity=".5"/>
    <path d="M28 140 6 182v22l22-12M92 140l22 42v22l-22-12" fill="#0d0f13" stroke="url(#fdOr)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M44 182h32l-6 18H50Z" fill="url(#fdOr)"/>
    <g class="fd-flamme"><path d="M48 202c4 26 8 40 12 52 4-12 8-26 12-52Z" fill="#e8b84b"/><path d="M54 202c2 16 4 24 6 32 2-8 4-16 6-32Z" fill="#fff6dc"/></g>
  </svg>`;

  function styles() {
    if (document.getElementById('fdStyles')) return;
    const s = document.createElement('style'); s.id = 'fdStyles';
    s.textContent = `
      .fd-scene{position:fixed;inset:0;z-index:10000;background:radial-gradient(ellipse 120% 90% at 50% 100%,#15161b,#050506 70%);overflow:hidden;opacity:0;transition:opacity .5s cubic-bezier(.16,1,.3,1);font-family:Inter,system-ui,sans-serif}
      .fd-scene.fd-on{opacity:1}
      .fd-scene canvas{position:absolute;inset:0;width:100%;height:100%}
      .fd-fusee{position:absolute;left:50%;bottom:-280px;width:92px;margin-left:-46px;filter:drop-shadow(0 0 18px rgba(232,184,75,.45));animation:fdMonte 2.4s cubic-bezier(.55,0,.75,.35) .35s forwards}
      .fd-fusee svg{width:100%;height:auto;display:block}
      .fd-flamme{transform-origin:60px 202px;animation:fdFlamme .09s ease-in-out infinite alternate}
      @keyframes fdFlamme{from{transform:scaleY(.82)}to{transform:scaleY(1.12)}}
      @keyframes fdMonte{0%{transform:translateY(0) rotate(0)}12%{transform:translateY(-40px) rotate(-1deg)}100%{transform:translateY(calc(-100vh - 420px)) rotate(2deg)}}
      .fd-carte{position:absolute;left:50%;top:50%;width:min(560px,90vw);transform:translate(-50%,-44%) scale(.92);opacity:0;text-align:center;color:#f2efe6;transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
      .fd-carte.fd-on{opacity:1;transform:translate(-50%,-50%) scale(1)}
      .fd-carte .fd-sur{font:500 13px/1 "JetBrains Mono",monospace;letter-spacing:.32em;color:#e8b84b;text-transform:uppercase}
      .fd-carte h2{font:700 clamp(32px,5.6vw,50px)/1.08 Inter,system-ui,sans-serif;letter-spacing:-.02em;margin:14px 0 10px;background:linear-gradient(135deg,#f3d585,#e8b84b 55%,#a87b22);-webkit-background-clip:text;background-clip:text;color:transparent}
      .fd-carte p{color:#bdbcb6;font-size:16px;line-height:1.55;margin:0 0 24px}
      .fd-carte img{width:100%;border-radius:6px;box-shadow:0 18px 60px rgba(0,0,0,.6),0 0 0 1px rgba(232,184,75,.35);margin:0 0 24px}
      .fd-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
      .fd-btn{border:0;border-radius:999px;padding:13px 22px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s cubic-bezier(.16,1,.3,1)}
      .fd-btn:hover{transform:translateY(-1px)}
      .fd-btn--or{background:linear-gradient(135deg,#f3d585,#e8b84b 55%,#c9962f);color:#0d0f13}
      .fd-btn--fantome{background:transparent;color:#f2efe6;box-shadow:inset 0 0 0 1px rgba(242,239,230,.25)}
      @media (prefers-reduced-motion:reduce){.fd-fusee{display:none}.fd-scene,.fd-carte{transition:none}}
    `;
    document.head.appendChild(s);
  }

  /** Étincelles et étoiles sur un canvas : rien d'importé, rien d'externe. */
  function ciel(canvas, finFusee) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const taille = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    taille();
    const etoiles = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
    const parts = []; let eclate = false; let t0 = performance.now(); let vivant = true;
    const or = ['#f3d585', '#e8b84b', '#c9962f', '#fff6dc'];
    function eclater() {
      eclate = true;
      const cx = canvas.width / 2; const cy = canvas.height * 0.32;
      for (let i = 0; i < 160; i += 1) {
        const a = Math.random() * Math.PI * 2; const v = (Math.random() * 6 + 2) * dpr;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, c: or[i % or.length], r: (Math.random() * 2 + 1) * dpr });
      }
    }
    function image(t) {
      if (!vivant) return;
      const e = (t - t0) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of etoiles) {
        ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(e * 1.6 + s.p));
        ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r * dpr, 0, Math.PI * 2); ctx.fill();
      }
      // La traînée de la fusée, tant qu'elle monte.
      if (!eclate && e > 0.35 && e < 2.75) {
        const p = Math.min(1, (e - 0.35) / 2.4); const y = canvas.height + 140 * dpr - Math.pow(p, 2.2) * (canvas.height + 560 * dpr);
        for (let i = 0; i < 4; i += 1) parts.push({ x: canvas.width / 2 + (Math.random() - 0.5) * 16 * dpr, y: y + 120 * dpr, vx: (Math.random() - 0.5) * 1.2 * dpr, vy: (Math.random() * 2 + 1.5) * dpr, vie: 0.8, c: or[(Math.random() * 4) | 0], r: (Math.random() * 2.2 + 0.8) * dpr });
      }
      if (!eclate && e > 2.55) { eclater(); finFusee(); }
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const q = parts[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.06 * dpr; q.vx *= 0.985; q.vie -= 0.012;
        if (q.vie <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, q.vie); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(image);
    }
    requestAnimationFrame(image);
    addEventListener('resize', taille);
    return () => { vivant = false; removeEventListener('resize', taille); };
  }

  /**
   * celebrer({ certificat: d, titre?, texte? }) → Promise résolue à la fermeture.
   * La carte montre l'aperçu du certificat et le bouton de téléchargement.
   */
  async function celebrer(o) {
    styles();
    const calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = document.createElement('div'); scene.className = 'fd-scene'; scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true'); scene.setAttribute('aria-label', 'Certification Trader 360');
    const toile = document.createElement('canvas'); scene.appendChild(toile);
    const fusee = document.createElement('div'); fusee.className = 'fd-fusee'; fusee.innerHTML = FUSEE; scene.appendChild(fusee);
    const carte = document.createElement('div'); carte.className = 'fd-carte';
    carte.innerHTML = `<div class="fd-sur">Examen réussi</div><h2>${o.titre || 'Trader 360 certifié.'}</h2>
      <p>${o.texte || 'Tu as traversé toute la méthode, questions et graphiques. Ton certificat est prêt.'}</p>
      <img alt="Ton certificat Trader 360" hidden>
      <div class="fd-actions"><button type="button" class="fd-btn fd-btn--or" data-fd-telecharger>Télécharger mon certificat</button><button type="button" class="fd-btn fd-btn--fantome" data-fd-fermer>Continuer</button></div>`;
    scene.appendChild(carte);
    document.body.appendChild(scene);
    requestAnimationFrame(() => scene.classList.add('fd-on'));

    // L'aperçu du certificat se prépare pendant le vol.
    const apercu = (async () => { const c = document.createElement('canvas'); await dessiner(c, o.certificat); const img = carte.querySelector('img'); img.src = c.toDataURL('image/jpeg', 0.85); img.hidden = false; })().catch(() => null);

    let arreter = () => {};
    const montrer = () => { apercu.finally(() => carte.classList.add('fd-on')); };
    if (calme) montrer(); else { arreter = ciel(toile, () => setTimeout(montrer, 450)); }

    return new Promise((fin) => {
      const fermer = () => { arreter(); scene.classList.remove('fd-on'); setTimeout(() => { scene.remove(); fin(); }, 500); document.removeEventListener('keydown', echap); };
      const echap = (e) => { if (e.key === 'Escape') fermer(); };
      document.addEventListener('keydown', echap);
      scene.addEventListener('click', async (e) => {
        if (e.target.closest('[data-fd-fermer]')) fermer();
        const b = e.target.closest('[data-fd-telecharger]');
        if (b) { b.disabled = true; b.textContent = 'Préparation…'; try { await telecharger(o.certificat); b.textContent = 'Téléchargé'; } catch (er) { b.textContent = 'Réessayer'; } b.disabled = false; }
      });
    });
  }

  window.FormationDiplome = { dessiner, pdf, telecharger, pdfDeJpeg, dateFr, celebrer };
})();
