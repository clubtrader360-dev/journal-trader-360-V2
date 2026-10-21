/**
 * L EXAMEN DE CERTIFICATION TRADER 360 : les ecrans, les graphiques, la notation.
 *
 * ── ⛔ CE QUE CE FICHIER FAIT, ET CE QU IL NE FAIT PAS ─────────────────────
 * Il rend les ecrans de l examen dans la zone `#quizZone` du module 10 (les
 * vingt questions, puis les quatre exercices sur graphique), calcule le
 * resultat et le rend. ⚠️ Il n ecrit RIEN en base et ne connait ni Supabase ni
 * la progression : `supabase-formation.js` lui passe les donnees et un
 * `onValider(resultat)` qui ecrit, puis le rappelle pour l ecran de resultat.
 * ⛔ Les attributs de clic sont prefixes `data-ex-` : la delegation globale de
 * l espace formation reagit a `data-rep`, `data-quiz-suiv`..., et ne doit pas
 * attraper les siens. Elle garde `data-open` / `data-seek` (revoir une video)
 * et `data-quiz-scene` / `data-quiz-commencer` / `data-quiz-reecrire`, que
 * l ecran de resultat lui laisse volontairement.
 *
 * ── ⚠️ LES GRAPHIQUES SONT RECONSTITUES, DETERMINISTES ─────────────────────
 * `certification-exercices.json` (via FORMATION_CERTIFICATION) donne un chemin
 * de prix et les bougies cles posees a la main ; le reste est engendre par un
 * generateur a graine : deux rendus donnent la meme image, sur tout appareil.
 * Un exercice peut aussi porter `image: { src, haut, bas }` (une capture reelle
 * avec son echelle de prix) : alors la capture remplace les bougies, et les
 * coordonnees des reponses restent en prix. ⚠️ Aucune capture n est fournie
 * aujourd hui, c est l arbitrage ouvert du 15/10.
 *
 * ── ⛔ LA NOTATION ──────────────────────────────────────────────────────────
 *   question    1 point, bonne ou fausse
 *   zone        5 points si |centre de la bande - centre attendu| <= marge
 *   entrees     5 points si les candidats coches sont EXACTEMENT les bons
 *   reussi      score >= 80 % du total ET au moins `exercices_minimum` exercices
 * Les deux « ET » viennent du cadrage du 14/10 (specification-quiz.md, 8) et de
 * `certification-t360.md`, ou ils sont marques [À VALIDER].
 */
(function () {
  'use strict';
  const racine = typeof window !== 'undefined' ? window : globalThis;

  /* ── Outils ─────────────────────────────────────────────────────────── */
  const txt = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const prixFr = (p) => Number(p).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tick = (p) => Math.round(p * 4) / 4;
  const I = {
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    croix: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  };
  const melanger = (n, alea) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) { const j = Math.floor(alea() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  /** Generateur a graine (mulberry32) : la meme graine rend la meme suite. */
  function graine(s) {
    let a = s >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ── Les bougies d un exercice ──────────────────────────────────────── */
  function bougiesDe(ex) {
    const alea = graine(ex.graine || 1);
    const chemin = ex.chemin;
    const prixA = (i) => {
      let k = 0;
      while (k < chemin.length - 2 && chemin[k + 1][1] < i) k += 1;
      const [p0, i0] = chemin[k]; const [p1, i1] = chemin[k + 1];
      if (i1 === i0) return p1;
      const t = Math.min(1, Math.max(0, (i - i0) / (i1 - i0)));
      return p0 + (p1 - p0) * t;
    };
    const out = [];
    let prev = tick(prixA(0));
    for (let i = 0; i < ex.n; i += 1) {
      const base = prixA(i);
      const c = tick(base + (alea() - 0.5) * 0.8);
      const o = i === 0 ? tick(base + (alea() - 0.5) * 0.5) : prev;
      const h = tick(Math.max(o, c) + alea() * 0.75);
      const l = tick(Math.min(o, c) - alea() * 0.75);
      out.push({ o, h, l, c });
      prev = c;
    }
    // ⛔ Les bougies cles, posees a la main : elles portent la reponse. La
    // bougie suivante ouvre sur leur cloture, sinon un trou trahirait la pose.
    Object.entries(ex.bougies || {}).forEach(([i, b]) => { const k = +i; out[k] = { o: b.o, h: b.h, l: b.l, c: b.c }; if (out[k + 1]) out[k + 1].o = b.c; });
    // La bougie d apres une bougie cle garde sa coherence meche / corps.
    out.forEach((b) => { b.h = Math.max(b.h, b.o, b.c); b.l = Math.min(b.l, b.o, b.c); });
    return out;
  }
  const mm20 = (B) => B.map((_, i) => { const d = B.slice(Math.max(0, i - 19), i + 1); return d.reduce((s, b) => s + b.c, 0) / d.length; });
  /** Bandes de Bollinger : MM20 plus ou moins deux ecarts types des clotures (3.2). */
  const bollinger = (B) => B.map((_, i) => { const d = B.slice(Math.max(0, i - 19), i + 1); const m = d.reduce((s, b) => s + b.c, 0) / d.length; const v = d.reduce((s, b) => s + (b.c - m) ** 2, 0) / d.length; const e = Math.sqrt(v); return { m, h: m + 2 * e, b: m - 2 * e }; });
  /** VWAP : prix moyen pondere par un volume engendre (plus fort sur les grandes bougies), cumule depuis la premiere bougie. */
  const vwap = (B, ex) => { const alea = graine((ex.graine || 1) + 101); let pv = 0, vv = 0; return B.map((b) => { const t = (b.h + b.l + b.c) / 3; const vol = 50 + Math.round(alea() * 60) + Math.round(Math.abs(b.c - b.o) * 40); pv += t * vol; vv += vol; return pv / vv; }); };
  /** Les indicateurs a tracer : ceux demandes, ou la MM20 seule pour un exercice d entrees. */
  const indicateursDe = (ex) => (ex.indicateurs ? ex.indicateurs : (ex.type === 'entrees' ? ['mm20'] : []));
  const NOMS_IND = { mm20: 'Moyenne mobile 20', bollinger: 'Bandes de Bollinger', vwap: 'VWAP', pivot: 'Point pivot', cv: 'Clôture de la veille', mm100: 'Moyenne mobile 100' };
  const mm100 = (B) => B.map((_, i) => { const d = B.slice(Math.max(0, i - 99), i + 1); return d.reduce((s, b) => s + b.c, 0) / d.length; });

  /* ── Le graphique en SVG ────────────────────────────────────────────── */
  /**
   * @param ex       l exercice
   * @param opts     { largeur, bande (prix du centre, type zone), coches (Set de i, type entrees),
   *                   correction: { attendu, bande } | { candidats } , interactif }
   */
  function graphique(ex, opts) {
    const B = bougiesDe(ex);
    const W = Math.max(320, Math.round(opts.largeur || 680));
    const H = Math.round(Math.min(400, Math.max(260, W * 0.52)));
    const M = { g: 10, d: 64, h: 18, b: 26 };
    const pw = W - M.g - M.d, ph = H - M.h - M.b;
    let haut = Math.max(...B.map((b) => b.h)), bas = Math.min(...B.map((b) => b.l));
    if (ex.cv != null) { haut = Math.max(haut, ex.cv); bas = Math.min(bas, ex.cv); }
    if (ex.zone) { haut = Math.max(haut, ex.zone.haut); bas = Math.min(bas, ex.zone.bas); }
    if (ex.bande) { haut = Math.max(haut, ex.bande.depart + ex.bande.hauteur / 2); bas = Math.min(bas, ex.bande.depart - ex.bande.hauteur / 2); }
    const marge = Math.max(2, (haut - bas) * 0.08);
    haut += marge; bas -= marge;
    const y = (p) => M.h + (haut - p) / (haut - bas) * ph;
    const pDe = (py) => haut - (py - M.h) / ph * (haut - bas);
    const pas = pw / ex.n;
    const x = (i) => M.g + pas * (i + 0.5);
    const lc = Math.max(2, Math.min(9, pas * 0.62));
    // Graduation : un pas « rond » qui donne 4 a 7 lignes.
    const etendue = haut - bas;
    const pasG = [1, 2, 2.5, 5, 10, 20, 25, 50].find((g) => etendue / g <= 7) || 100;
    const grads = [];
    for (let p = Math.ceil(bas / pasG) * pasG; p <= haut; p += pasG) grads.push(p);
    const S = [];
    // ⚠️ `peau` : 'maison' (noir et or, defaut) ou 'tradingview' (fond ardoise, bougies
    // vertes et rouges, l aspect de la plateforme que les eleves ont sous les yeux).
    // Demande de Nadir du 15/10 : un exemple « comme un graphique TradingView ».
    const peau = opts.peau || ex.peau || 'tradingview';
    S.push(`<svg class="ex__svg ${peau === 'tradingview' ? 'ex__svg--tv' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Graphique ${txt(ex.ut)} ${txt(ex.symbole)}" style="touch-action:none">`);
    S.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="14" class="ex__fond"/>`);
    grads.forEach((p) => S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(p).toFixed(1)}" y2="${y(p).toFixed(1)}" class="ex__grille"/><text x="${W - M.d + 8}" y="${(y(p) + 4).toFixed(1)}" class="ex__axe">${prixFr(p)}</text>`));
    // Heures : trois reperes.
    [0, Math.floor(ex.n / 2), ex.n - 1].forEach((i, k) => S.push(`<text x="${x(i).toFixed(1)}" y="${H - 8}" class="ex__axe" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}">${k === 0 ? txt(ex.heure_debut || '') : k === 2 ? txt(ex.ut) : ''}</text>`));
    // La zone du plan (type entrees) : bande doree.
    // ⚠️ L etiquette de la zone porte un fond : posee au bord du graphique, elle
    // croisait les bougies et devenait illisible (vu sur l apercu du 15/10).
    const chip = (texte, cx, cy, ancre) => { const l = texte.length * 7.1 + 16; const x0 = ancre === 'end' ? cx - l : cx; return `<g class="ex__chip-svg"><rect x="${x0.toFixed(1)}" y="${(cy - 12).toFixed(1)}" width="${l.toFixed(1)}" height="17" rx="8"/><text x="${(x0 + 7).toFixed(1)}" y="${cy.toFixed(1)}" class="ex__etiq ex__etiq--or">${txt(texte)}</text></g>`; };
    if (ex.zone) S.push(`<rect x="${M.g}" y="${y(ex.zone.haut).toFixed(1)}" width="${pw}" height="${(y(ex.zone.bas) - y(ex.zone.haut)).toFixed(1)}" class="ex__zone ${ex.sens === 'vente' ? 'ex__zone--vente' : ''}"/>${chip(`Zone ${ex.sens === 'vente' ? 'de vente' : 'd’achat'} du plan · ${prixFr(ex.zone.bas)} à ${prixFr(ex.zone.haut)}`, M.g + 6, ex.sens === 'vente' ? y(ex.zone.bas) + 16 : y(ex.zone.haut) - 8, 'start')}`);
    // La cloture de la veille (etiquetee, sauf quand c est elle qu il faut reperer).
    const muet = ex.type === 'reperer';
    if (ex.cv != null) S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(ex.cv).toFixed(1)}" y2="${y(ex.cv).toFixed(1)}" class="ex__cv"/>${muet ? '' : `<text x="${W - M.d - 6}" y="${(y(ex.cv) - 5).toFixed(1)}" class="ex__etiq" text-anchor="end">CV ${prixFr(ex.cv)}</text>`}`);
    if (ex.pivot != null) S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(ex.pivot).toFixed(1)}" y2="${y(ex.pivot).toFixed(1)}" class="ex__pivot"/>${muet ? '' : `<text x="${W - M.d - 6}" y="${(y(ex.pivot) + 13).toFixed(1)}" class="ex__etiq" text-anchor="end">Pivot ${prixFr(ex.pivot)}</text>`}`);
    // L annonce.
    if (ex.annonce) S.push(`<line x1="${x(ex.annonce.i).toFixed(1)}" x2="${x(ex.annonce.i).toFixed(1)}" y1="${M.h}" y2="${H - M.b}" class="ex__annonce"/>${chip(ex.annonce.texte, x(ex.annonce.i) + 6, H - M.b - 8, 'start')}`);
    // Les indicateurs traces : chacun garde son y de fin, pour y poser une lettre (type reperer).
    const trace = (serie, classe) => `<path d="${serie.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}" class="${classe}"/>`;
    const finDe = {};
    const inds = indicateursDe(ex);
    if (inds.includes('bollinger')) { const bb = bollinger(B); S.push(trace(bb.map((v) => v.h), 'ex__bb ex__bb--haute')); S.push(trace(bb.map((v) => v.b), 'ex__bb ex__bb--basse')); finDe.bollinger = y(bb[bb.length - 1].h); }
    if (inds.includes('mm100')) { const m = mm100(B); S.push(trace(m, 'ex__mm100')); finDe.mm100 = y(m[m.length - 1]); }
    if (inds.includes('mm20')) { const m = mm20(B); S.push(trace(m, 'ex__mm20')); finDe.mm20 = y(m[m.length - 1]); }
    if (inds.includes('vwap')) { const v = vwap(B, ex); S.push(trace(v, 'ex__vwap')); finDe.vwap = y(v[v.length - 1]); }
    if (ex.cv != null) finDe.cv = y(ex.cv);
    if (ex.pivot != null) finDe.pivot = y(ex.pivot);
    // Les bougies.
    B.forEach((b, i) => {
      const up = b.c >= b.o;
      const yo = y(b.o), yc = y(b.c);
      S.push(`<g class="ex__bougie ${up ? 'ex__bougie--h' : 'ex__bougie--b'}"><line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${y(b.h).toFixed(1)}" y2="${y(b.l).toFixed(1)}"/><rect x="${(x(i) - lc / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${lc.toFixed(1)}" height="${Math.max(1.2, Math.abs(yo - yc)).toFixed(1)}"/></g>`);
    });
    // Les candidats (type entrees) : une pastille lettree sous ou sur la bougie.
    if (ex.type === 'entrees') {
      ex.candidats.forEach((c) => {
        const b = B[c.i];
        const dessous = ex.sens === 'achat';
        const cy = dessous ? y(b.l) + 18 : y(b.h) - 18;
        const coche = opts.coches && opts.coches.has(c.i);
        let classe = 'ex__cand';
        if (coche) classe += ' ex__cand--coche';
        if (opts.correction) classe += c.bon ? ' ex__cand--bon' : ' ex__cand--faux';
        S.push(`<g class="${classe}" ${opts.interactif ? `role="checkbox" tabindex="0" aria-checked="${coche ? 'true' : 'false'}" data-ex-cand="${c.i}"` : ''} aria-label="Candidat ${txt(c.lettre)}"><line x1="${x(c.i).toFixed(1)}" x2="${x(c.i).toFixed(1)}" y1="${(dessous ? y(b.l) + 2 : y(b.h) - 2).toFixed(1)}" y2="${(dessous ? cy - 11 : cy + 11).toFixed(1)}"/><circle cx="${x(c.i).toFixed(1)}" cy="${cy.toFixed(1)}" r="11"/><text x="${x(c.i).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle">${txt(c.lettre)}</text></g>`);
      });
    }
    // Les reperes (type reperer) : une lettre au bout de chaque trace, a cliquer.
    if (ex.type === 'reperer') {
      // ⚠️ Deux lettres au meme y se chevaucheraient : on les ecarte d au moins 24 px, dans l ordre du y.
      const places = ex.reperes.map((r) => ({ r, cy: finDe[r.cle] != null ? finDe[r.cle] : H / 2 })).sort((a, b) => a.cy - b.cy);
      for (let k = 1; k < places.length; k += 1) if (places[k].cy - places[k - 1].cy < 24) places[k].cy = places[k - 1].cy + 24;
      places.forEach(({ r, cy }) => {
        const cx = W - M.d - 14;
        const choisi = opts.choix === r.cle;
        let classe = 'ex__cand ex__rep';
        if (choisi) classe += ' ex__cand--coche';
        if (opts.correction) classe += r.cle === ex.cible ? ' ex__cand--bon' : ' ex__cand--faux';
        S.push(`<g class="${classe}" ${opts.interactif ? `role="radio" tabindex="0" aria-checked="${choisi ? 'true' : 'false'}" data-ex-ind="${txt(r.cle)}"` : ''} aria-label="Repère ${txt(r.lettre)}"><line x1="${(cx - 11).toFixed(1)}" x2="${(cx - 30).toFixed(1)}" y1="${cy.toFixed(1)}" y2="${(finDe[r.cle] != null ? finDe[r.cle] : cy).toFixed(1)}"/><circle cx="${cx}" cy="${cy.toFixed(1)}" r="11"/><text x="${cx}" y="${(cy + 4).toFixed(1)}" text-anchor="middle">${txt(r.lettre)}</text></g>`);
      });
    }
    // La bande (type zone) : celle de l eleve, et en correction celle attendue.
    if (ex.type === 'zone') {
      const h2 = ex.bande.hauteur / 2;
      if (opts.correction) {
        const a = opts.correction.attendu;
        S.push(`<rect x="${M.g}" y="${y(a + h2).toFixed(1)}" width="${pw}" height="${(y(a - h2) - y(a + h2)).toFixed(1)}" class="ex__bande ex__bande--attendue"/><text x="${M.g + 8}" y="${(y(a + h2) - 5).toFixed(1)}" class="ex__etiq ex__etiq--or">Zone attendue · ${prixFr(a - h2)} à ${prixFr(a + h2)}</text>`);
        (ex.pieges || []).forEach((p) => S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(p.prix).toFixed(1)}" y2="${y(p.prix).toFixed(1)}" class="ex__piege"/>`));
      }
      if (opts.bande != null) {
        const c = opts.bande;
        const ok = opts.correction ? (opts.correction.ok ? 'ex__bande--ok' : 'ex__bande--rate') : '';
        S.push(`<g class="ex__bande-g" ${opts.interactif ? 'data-ex-bande tabindex="0" role="slider" aria-valuemin="' + bas.toFixed(2) + '" aria-valuemax="' + haut.toFixed(2) + '" aria-valuenow="' + c.toFixed(2) + '" aria-label="Bande à glisser"' : ''}><rect x="${M.g}" y="${y(c + h2).toFixed(1)}" width="${pw}" height="${(y(c - h2) - y(c + h2)).toFixed(1)}" class="ex__bande ${ok}"/><text x="${W - M.d - 6}" y="${(y(c) + 4).toFixed(1)}" class="ex__etiq ex__etiq--bande" text-anchor="end">${opts.correction ? 'Ta bande' : 'Ta zone'} · ${prixFr(c - h2)} à ${prixFr(c + h2)}</text></g>`);
      }
    }
    S.push('</svg>');
    return { html: S.join(''), y, pDe, W, H, bas, haut, M };
  }

  /* ── La notation ────────────────────────────────────────────────────── */
  function noterExercice(ex, rep) {
    if (ex.type === 'zone') {
      const c = rep && rep.bande != null ? rep.bande : null;
      const ok = c != null && Math.abs(c - ex.attendu.centre) <= ex.attendu.marge;
      return { ok, bande: c, attendu: ex.attendu.centre, ecart: c != null ? Math.abs(c - ex.attendu.centre) : null };
    }
    if (ex.type === 'reperer') {
      const choix = rep && rep.choix != null ? rep.choix : null;
      return { ok: choix === ex.cible, choix, cible: ex.cible };
    }
    const coches = new Set((rep && rep.coches) || []);
    const bons = new Set(ex.candidats.filter((c) => c.bon).map((c) => c.i));
    const ok = coches.size === bons.size && [...bons].every((i) => coches.has(i));
    return { ok, coches: [...coches], bons: [...bons] };
  }
  function noter(D, etat) {
    const questions = D.questions.map((q) => ({ id: q.id, choisie: etat.choix[q.id] == null ? null : etat.choix[q.id], bonne: q.bonne }));
    const exercices = D.exercices.map((ex) => ({ id: ex.id, type: ex.type, ...noterExercice(ex, etat.reponses[ex.id]) }));
    const pq = questions.filter((r) => r.choisie === r.bonne).length;
    const pe = exercices.filter((r) => r.ok).length;
    const total = D.questions.length + D.exercices.length * D.points_par_exercice;
    const score = pq + pe * D.points_par_exercice;
    const seuil = Math.ceil(total * (D.seuil || 0.8));
    const reussi = score >= seuil && pe >= (D.exercices_minimum || 0);
    return { score, total, seuil, reussi, points_questions: pq, exercices_reussis: pe, reponses: { questions, exercices } };
  }

  /* ── L examen en cours ──────────────────────────────────────────────── */
  let _etat = null; // { zone, D, opts, partie, i, choix, reponses, perms, nettoyer }

  /**
   * ⛔ UN QUIZ ILLUSTRE SANS EXERCICE PASSE AUSSI PAR CE MOTEUR (supabase-formation.js,
   * `moteur = nbEx > 0 || illustration`). Les quiz 01, 04, 06, 07 et 07bis n ont ni
   * `exercices`, ni `points_par_exercice`, ni `exercices_minimum` : `D.exercices.forEach`
   * levait une TypeError au clic sur « Commencer le quiz », et le quiz ne se lancait pour
   * personne (constate le 21/10/2026). On complete les champs absents, une fois, ici :
   * tout le reste du moteur lit `_etat.D`.
   */
  function normaliser(D) {
    if (!D) return D;
    return {
      ...D,
      exercices: Array.isArray(D.exercices) ? D.exercices : [],
      points_par_exercice: D.points_par_exercice || 0,
      exercices_minimum: D.exercices_minimum || 0,
    };
  }

  function commencer(zone, opts) {
    const D = normaliser(opts.donnees);
    if (!zone || !D) return;
    if (_etat && _etat.nettoyer) _etat.nettoyer();
    const alea = graine(Date.now() % 100000 + 7);
    _etat = { zone, D, opts, partie: 'questions', i: 0, choix: {}, reponses: {}, perms: D.questions.map((q) => melanger(q.options.length, alea)) };
    D.exercices.forEach((ex) => { _etat.reponses[ex.id] = ex.type === 'zone' ? { bande: ex.bande.depart } : ex.type === 'reperer' ? { choix: null } : { coches: [] }; });
    brancher(zone);
    rendre();
  }

  function brancher(zone) {
    const e = _etat;
    const surClic = (ev) => {
      const t = ev.target.closest('[data-ex-rep],[data-ex-suiv],[data-ex-prec],[data-ex-cand],[data-ex-chip],[data-ex-ind],[data-ex-haut],[data-ex-bas]');
      if (!t || !zone.contains(t)) return;
      if (t.dataset.exRep != null) { repondre(Number(t.dataset.exRep)); return; }
      if (t.dataset.exInd != null) { choisirRepere(t.dataset.exInd); return; }
      if (t.hasAttribute('data-ex-suiv')) { suivant(); return; }
      if (t.hasAttribute('data-ex-prec')) { precedent(); return; }
      if (t.dataset.exCand != null) { basculerCandidat(Number(t.dataset.exCand)); return; }
      if (t.dataset.exChip != null) { basculerCandidat(Number(t.dataset.exChip)); return; }
      if (t.hasAttribute('data-ex-haut')) { deplacerBande(ev.shiftKey ? 1 : 0.25); return; }
      if (t.hasAttribute('data-ex-bas')) { deplacerBande(ev.shiftKey ? -1 : -0.25); }
    };
    const surTouche = (ev) => {
      const t = ev.target.closest('[data-ex-bande],[data-ex-cand],[data-ex-ind]');
      if (!t || !zone.contains(t)) return;
      if (t.hasAttribute('data-ex-bande')) {
        if (ev.key === 'ArrowUp') { ev.preventDefault(); deplacerBande(ev.shiftKey ? 1 : 0.25); }
        if (ev.key === 'ArrowDown') { ev.preventDefault(); deplacerBande(ev.shiftKey ? -1 : -0.25); }
      } else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); if (t.dataset.exInd != null) choisirRepere(t.dataset.exInd); else basculerCandidat(Number(t.dataset.exCand)); }
    };
    // ⚠️ Le glisser : pointeur unifie, souris et doigt. On attrape la bande
    // la ou on appuie, ou on l amene sous le doigt si on appuie a cote.
    let glisse = null;
    const surAppui = (ev) => {
      const svg = ev.target.closest('.ex__svg');
      if (!svg || !zone.contains(svg) || !e || e.partie !== 'exercices') return;
      const ex = e.D.exercices[e.i];
      if (!ex || ex.type !== 'zone' || !e.geo) return;
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      const py = (ev.clientY - r.top) * (e.geo.H / r.height);
      const prix = e.geo.pDe(py);
      const centre = e.reponses[ex.id].bande;
      const h2 = ex.bande.hauteur / 2;
      const surBande = prix <= centre + h2 + 0.5 && prix >= centre - h2 - 0.5;
      glisse = { svg, decalage: surBande ? centre - prix : 0 };
      if (!surBande) poserBande(tick(prix));
      try { svg.setPointerCapture(ev.pointerId); } catch { /* rien */ }
    };
    const surMouvement = (ev) => {
      if (!glisse || !e || !e.geo) return;
      ev.preventDefault();
      const r = glisse.svg.getBoundingClientRect();
      const py = (ev.clientY - r.top) * (e.geo.H / r.height);
      poserBande(tick(e.geo.pDe(py) + glisse.decalage));
    };
    const surLacher = () => { glisse = null; };
    const surRedim = () => { if (_etat === e && e.partie === 'exercices') rendre(); };
    zone.addEventListener('click', surClic);
    zone.addEventListener('keydown', surTouche);
    zone.addEventListener('pointerdown', surAppui);
    zone.addEventListener('pointermove', surMouvement);
    zone.addEventListener('pointerup', surLacher);
    zone.addEventListener('pointercancel', surLacher);
    window.addEventListener('resize', surRedim);
    e.nettoyer = () => {
      zone.removeEventListener('click', surClic);
      zone.removeEventListener('keydown', surTouche);
      zone.removeEventListener('pointerdown', surAppui);
      zone.removeEventListener('pointermove', surMouvement);
      zone.removeEventListener('pointerup', surLacher);
      zone.removeEventListener('pointercancel', surLacher);
      window.removeEventListener('resize', surRedim);
    };
  }

  const nbEtapes = (e) => e.D.questions.length + e.D.exercices.length;
  const etapeCourante = (e) => (e.partie === 'questions' ? e.i : e.D.questions.length + e.i);

  function rendre() {
    const e = _etat;
    if (!e) return;
    if (e.partie === 'questions') rendreQuestion(); else rendreExercice();
    const r = e.zone.getBoundingClientRect();
    if (r.top < 0) e.zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function rendreQuestion() {
    const e = _etat;
    const n = nbEtapes(e);
    const q = e.D.questions[e.i];
    const perm = e.perms[e.i];
    const choisi = e.choix[q.id];
    const lecon = e.opts.leconDe ? e.opts.leconDe(q.renvoi.lecon) : null;
    e.zone.innerHTML = `
      <div class="quiz__barre" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${etapeCourante(e) + 1}"><i style="width:${(etapeCourante(e) / n) * 100}%"></i></div>
      <div class="quiz__sur">Question ${e.i + 1} sur ${e.D.questions.length}${lecon ? ` · <span>${txt(lecon.titre)}</span>` : ''}</div>
      <h3 class="quiz__enonce">${txt(q.enonce)}</h3>
      ${q.illustration ? `<div class="ex__graph ex__illu">${illustrer(q.illustration, Math.max(300, Math.min(640, e.zone.clientWidth - 52)))}</div>` : ''}
      <div class="quiz__opts" role="radiogroup" aria-label="Réponses">
        ${perm.map((k, pos) => `<button type="button" class="quiz__opt" role="radio" data-ex-rep="${k}" aria-checked="${choisi === k ? 'true' : 'false'}"><span class="quiz__lettre mono">${String.fromCharCode(65 + pos)}</span><span>${txt(q.options[k])}</span></button>`).join('')}
      </div>
      <div class="quiz__pied">
        ${e.i > 0 ? `<button type="button" class="btn btn-ghost" data-ex-prec>${I.back} Précédent</button>` : '<span></span>'}
        <button type="button" class="btn btn-gold" data-ex-suiv ${choisi == null ? 'disabled' : ''}>${e.i === e.D.questions.length - 1 ? (e.D.exercices.length ? 'Passer aux exercices' : 'Valider mon quiz') : 'Suivant'} ${I.arrow}</button>
      </div>`;
  }

  function rendreExercice() {
    const e = _etat;
    const n = nbEtapes(e);
    const ex = e.D.exercices[e.i];
    const rep = e.reponses[ex.id];
    const largeur = Math.max(320, Math.min(760, e.zone.clientWidth - 52));
    const g = graphique(ex, { largeur, bande: ex.type === 'zone' ? rep.bande : null, coches: ex.type === 'entrees' ? new Set(rep.coches) : null, choix: ex.type === 'reperer' ? rep.choix : null, interactif: true });
    e.geo = g;
    const dernier = e.i === e.D.exercices.length - 1;
    const complet = ex.type === 'zone' || (ex.type === 'reperer' ? rep.choix != null : rep.coches.length > 0);
    e.zone.innerHTML = `
      <div class="quiz__barre" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${etapeCourante(e) + 1}"><i style="width:${(etapeCourante(e) / n) * 100}%"></i></div>
      <div class="quiz__sur">Exercice ${e.i + 1} sur ${e.D.exercices.length} · <span>${txt(ex.symbole)} · ${txt(ex.ut)}</span></div>
      <h3 class="quiz__enonce">${txt(ex.titre)}</h3>
      <p class="ex__consigne">${txt(ex.consigne)}</p>
      <div class="ex__graph" id="exGraph">${g.html}</div>
      ${ex.type === 'zone'
        ? `<div class="ex__outils"><span class="ex__aide">Glisse la bande avec la souris ou le doigt, ou appuie là où tu veux la poser.</span><span class="ex__fins"><button type="button" class="btn btn-ghost ex__fin" data-ex-haut aria-label="Monter la bande d’un quart de point">▲</button><button type="button" class="btn btn-ghost ex__fin" data-ex-bas aria-label="Descendre la bande d’un quart de point">▼</button></span></div>`
        : ex.type === 'reperer'
          ? `<div class="ex__chips" role="radiogroup" aria-label="Repères">${ex.reperes.map((r) => `<button type="button" class="ex__chip ${rep.choix === r.cle ? 'ex__chip--coche' : ''}" data-ex-ind="${txt(r.cle)}" role="radio" aria-checked="${rep.choix === r.cle ? 'true' : 'false'}"><b>${txt(r.lettre)}</b> ${rep.choix === r.cle ? 'c’est celle-là' : 'celle-là ?'}</button>`).join('')}</div>`
          : `<div class="ex__chips" role="group" aria-label="Candidats">${ex.candidats.map((c) => `<button type="button" class="ex__chip ${rep.coches.includes(c.i) ? 'ex__chip--coche' : ''}" data-ex-chip="${c.i}" aria-pressed="${rep.coches.includes(c.i) ? 'true' : 'false'}"><b>${txt(c.lettre)}</b> ${rep.coches.includes(c.i) ? 'je prends' : 'je passe'}</button>`).join('')}</div>`}
      <div class="quiz__pied">
        <button type="button" class="btn btn-ghost" data-ex-prec>${I.back} Précédent</button>
        <button type="button" class="btn btn-gold" data-ex-suiv ${complet ? '' : 'disabled'}>${dernier ? 'Valider mon examen' : 'Suivant'} ${I.arrow}</button>
      </div>`;
  }

  function repondre(k) {
    const e = _etat;
    if (!e || e.partie !== 'questions') return;
    const q = e.D.questions[e.i];
    e.choix[q.id] = k;
    e.zone.querySelectorAll('.quiz__opt').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.exRep) === k ? 'true' : 'false'));
    const s = e.zone.querySelector('[data-ex-suiv]');
    if (s) s.disabled = false;
  }
  function poserBande(centre) {
    const e = _etat;
    if (!e || e.partie !== 'exercices') return;
    const ex = e.D.exercices[e.i];
    if (ex.type !== 'zone' || !e.geo) return;
    const h2 = ex.bande.hauteur / 2;
    const c = Math.min(e.geo.haut - h2, Math.max(e.geo.bas + h2, centre));
    e.reponses[ex.id].bande = tick(c);
    // ⚠️ Seule la bande bouge : on redessine le SVG entier (leger), sans
    // toucher au reste de l ecran, pour garder le focus et le pointeur.
    const zoneG = e.zone.querySelector('#exGraph');
    if (zoneG) { const g = graphique(ex, { largeur: e.geo.W, bande: e.reponses[ex.id].bande, interactif: true }); e.geo = g; zoneG.innerHTML = g.html; }
  }
  function deplacerBande(d) {
    const e = _etat;
    if (!e || e.partie !== 'exercices') return;
    const ex = e.D.exercices[e.i];
    if (ex.type !== 'zone') return;
    poserBande(e.reponses[ex.id].bande + d);
  }
  function choisirRepere(cle) {
    const e = _etat;
    if (!e || e.partie !== 'exercices') return;
    const ex = e.D.exercices[e.i];
    if (ex.type !== 'reperer' || !ex.reperes.some((r) => r.cle === cle)) return;
    e.reponses[ex.id].choix = cle;
    rendreExercice();
  }
  function basculerCandidat(i) {
    const e = _etat;
    if (!e || e.partie !== 'exercices') return;
    const ex = e.D.exercices[e.i];
    if (ex.type !== 'entrees') return;
    const r = e.reponses[ex.id];
    r.coches = r.coches.includes(i) ? r.coches.filter((x) => x !== i) : [...r.coches, i];
    rendreExercice();
  }
  function suivant() {
    const e = _etat;
    if (!e) return;
    if (e.partie === 'questions') {
      const q = e.D.questions[e.i];
      if (e.choix[q.id] == null) return;
      if (e.i < e.D.questions.length - 1) { e.i += 1; rendre(); return; }
      /**
       * ⛔ SANS EXERCICE, LA DERNIERE QUESTION VALIDE. Le correctif du 21/10 (normaliser)
       * laissait `exercices` vide, mais cette ligne passait quand meme a la partie
       * « exercices » : `rendreExercice` lisait `exercices[0]`, absent, et levait au clic
       * sur la derniere question. Les quiz 01, 04, 06, 07, 7 bis et 09 demarraient, mais
       * ne se validaient pour personne. Trouve par le banc qui parcourt TOUS les quiz
       * (outils/formation-tous-les-quiz-banc.mjs), pas par un essai a la main. Manu a pose
       * la meme ligne en parallele (commit 4c26041) : les deux correctifs ont ete fondus ici.
       */
      if (!e.D.exercices.length) { valider(); return; }
      e.partie = 'exercices'; e.i = 0; rendre(); return;
    }
    const ex = e.D.exercices[e.i];
    if (ex.type === 'entrees' && !e.reponses[ex.id].coches.length) return;
    if (ex.type === 'reperer' && e.reponses[ex.id].choix == null) return;
    if (e.i < e.D.exercices.length - 1) { e.i += 1; rendre(); return; }
    valider();
  }
  function precedent() {
    const e = _etat;
    if (!e) return;
    if (e.partie === 'questions') { if (e.i > 0) { e.i -= 1; rendre(); } return; }
    if (e.i > 0) { e.i -= 1; rendre(); return; }
    e.partie = 'questions'; e.i = e.D.questions.length - 1; rendre();
  }

  async function valider() {
    const e = _etat;
    if (!e) return;
    const resultat = noter(e.D, e);
    e.zone.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const contexte = await e.opts.onValider(resultat);
    if (e.nettoyer) e.nettoyer();
    _etat = null;
    rendreResultat(e.zone, { donnees: e.D, resultat, perms: e.perms, ...(contexte || {}) });
  }

  /* ── L ecran de resultat ────────────────────────────────────────────── */
  /**
   * @param zone   #quizZone
   * @param ctx    { donnees, resultat, ok (ecrit en base), dejaFini, badge, leconDe(id), ouDe(id) -> [mi,ci] }
   */
  function rendreResultat(zone, ctx) {
    const D = normaliser(ctx.donnees);
    const r = ctx.resultat;
    const largeur = Math.max(300, Math.min(640, zone.clientWidth - 52));
    const fautes = r.reponses.questions.filter((x) => x.choisie !== x.bonne).map((x) => {
      const q = D.questions.find((y) => y.id === x.id);
      const lecon = ctx.leconDe ? ctx.leconDe(q.renvoi.lecon) : null;
      const ou = ctx.ouDe ? ctx.ouDe(q.renvoi.lecon) : null;
      return `<li class="quiz__faute">
        <p class="quiz__faute-q">${txt(q.enonce)}</p>
        ${q.illustration ? `<div class="ex__graph ex__illu ex__illu--petite">${illustrer(q.illustration, Math.min(420, largeur))}</div>` : ''}
        <p class="quiz__faute-r"><span>Ta réponse</span>${x.choisie == null ? 'Sans réponse' : txt(q.options[x.choisie])}</p>
        <p class="quiz__faute-b"><span>La bonne</span>${txt(q.options[q.bonne])}</p>
        <p class="quiz__faute-c">${txt(q.conseil)}</p>
        ${lecon && ou ? `<button type="button" class="quiz__revoir" data-open="${ou[0]},${ou[1]}" data-seek="${q.renvoi.de * 60}">${I.play} Revoir « ${txt(lecon.titre)} », entre ${q.renvoi.de} et ${q.renvoi.a} min</button>` : ''}
      </li>`;
    });
    const exercices = r.reponses.exercices.map((x) => {
      const ex = D.exercices.find((y) => y.id === x.id);
      const g = ex.type === 'zone'
        ? graphique(ex, { largeur, bande: x.bande, correction: { attendu: x.attendu, ok: x.ok } })
        : ex.type === 'reperer'
          ? graphique(ex, { largeur, choix: x.choix, correction: { cible: ex.cible } })
          : graphique(ex, { largeur, coches: new Set(x.coches), correction: { candidats: true } });
      const detail = ex.type === 'zone'
        ? `<p class="ex__expl">${txt(ex.explication)}</p>${x.ok ? '' : `<p class="ex__expl ex__expl--toi">Ta bande était à ${x.ecart != null ? prixFr(x.ecart) : '·'} point${x.ecart > 1 ? 's' : ''} du centre attendu, pour une marge de ${prixFr(ex.attendu.marge)}.</p>`}<ul class="ex__pieges">${(ex.pieges || []).map((p) => `<li><b>${prixFr(p.prix)}</b> ${txt(p.texte)}</li>`).join('')}</ul>`
        : ex.type === 'reperer'
          ? `<p class="ex__expl">${txt(ex.explication || '')}</p><ul class="ex__cands">${ex.reperes.map((r) => `<li class="${r.cle === ex.cible ? 'ex__cands--bon' : 'ex__cands--faux'} ${(x.choix === r.cle) !== (r.cle === ex.cible) ? 'ex__cands--erreur' : ''}"><span class="ex__cands-lettre">${txt(r.lettre)}</span><span class="ex__cands-verdict">${txt(NOMS_IND[r.cle] || r.cle)}${r.cle === ex.cible ? ' · la bonne' : ''}${x.choix === r.cle && r.cle !== ex.cible ? ' · ton choix' : ''}</span><span>${txt(r.texte || '')}</span></li>`).join('')}</ul>`
          : `<ul class="ex__cands">${ex.candidats.map((c) => { const coche = x.coches.includes(c.i); return `<li class="${c.bon ? 'ex__cands--bon' : 'ex__cands--faux'} ${coche === c.bon ? '' : 'ex__cands--erreur'}"><span class="ex__cands-lettre">${txt(c.lettre)}</span><span class="ex__cands-verdict">${c.bon ? 'à prendre' : 'à laisser'}${coche === c.bon ? '' : (coche ? ' · tu l’as pris' : ' · tu l’as laissé')}</span><span>${txt(c.texte)}</span></li>`; }).join('')}</ul>`;
      return `<li class="ex__corr ${x.ok ? 'ex__corr--ok' : 'ex__corr--rate'}">
        <div class="ex__corr-tete"><span class="ex__corr-verdict">${x.ok ? I.check : I.croix}</span><h4>${txt(ex.titre)} <small>${x.ok ? `${D.points_par_exercice} / ${D.points_par_exercice}` : `0 / ${D.points_par_exercice}`}</small></h4></div>
        <div class="ex__graph ex__graph--corr">${g.html}</div>
        ${detail}
      </li>`;
    });
    const nonEcrit = ctx.ok === false ? `<p class="quiz__non-ecrit">⚠️ Ce résultat n’a pas pu être enregistré. Vérifie ta connexion, puis <button type="button" class="quiz__lien" data-quiz-reecrire>réessaie l’enregistrement</button>.</p>` : '';
    const cert = !!ctx.certification;
    const bilan = `<p class="ex__bilan">Questions : <b>${r.points_questions} / ${D.questions.length}</b> · Exercices : <b>${r.exercices_reussis} / ${D.exercices.length}</b> réussis · Il faut ${r.seuil} points sur ${r.total}${D.exercices_minimum ? ` et ${D.exercices_minimum} exercices` : ''}.</p>`;
    if (r.reussi) {
      zone.innerHTML = `
        <div class="quiz__resultat quiz__resultat--ok">
          <div class="quiz__score"><strong class="mono">${r.score}<small>/ ${r.total}</small></strong><span>${cert ? 'Certifié' : 'Réussi'}</span></div>
          <h3>${cert ? (ctx.dejaFini ? 'Toujours certifié.' : 'Trader 360 certifié.') : (ctx.dejaFini ? 'Toujours là.' : `Module ${txt(ctx.numero || '')} validé.`)}</h3>
          <p>${cert
            ? (ctx.dejaFini ? 'Ton certificat, ton badge et tes XP étaient déjà acquis : ce passage comptait pour réviser.' : 'La méthode entière, questions et graphiques. Ton badge de certification et tes XP t’attendent.')
            : (ctx.dejaFini ? 'Ton badge et tes XP étaient déjà acquis : ce passage comptait pour réviser.' : `Il fallait ${r.seuil} points, tu en as ${r.score}. Ton badge t’attend.`)}</p>
          ${bilan}${nonEcrit}
          <div class="row">
            ${!ctx.dejaFini && ctx.ok !== false ? `<button type="button" class="btn btn-gold" data-quiz-scene>Récupérer mes XP ${I.arrow}</button>` : `<button type="button" class="btn btn-gold" data-go="modules">Tous les modules ${I.arrow}</button>`}
          </div>
          <details class="quiz__details"><summary>Le détail des exercices</summary><ul class="ex__corrs">${exercices.join('')}</ul></details>
          ${fautes.length ? `<details class="quiz__details"><summary>${fautes.length} question${fautes.length > 1 ? 's' : ''} à revoir quand même</summary><ul class="quiz__fautes">${fautes.join('')}</ul></details>` : ''}
        </div>`;
    } else {
      zone.innerHTML = `
        <div class="quiz__resultat quiz__resultat--rate">
          <div class="quiz__score"><strong class="mono">${r.score}<small>/ ${r.total}</small></strong><span>Pas encore</span></div>
          <h3>${r.score >= r.seuil ? `Il fallait ${D.exercices_minimum} exercices réussis sur ${D.exercices.length}.` : `Il fallait ${r.seuil} points.`}</h3>
          <p>${r.score >= r.seuil ? '' : `Il t’en manque ${r.seuil - r.score}. `}Rien n’est perdu : chaque exercice est corrigé ci-dessous, graphique à l’appui, et chaque question te renvoie au passage de la vidéo. Revois, puis réessaie.</p>
          ${bilan}${nonEcrit}
          <ul class="ex__corrs">${exercices.join('')}</ul>
          ${fautes.length ? `<ul class="quiz__fautes">${fautes.join('')}</ul>` : ''}
          <div class="row">
            <button type="button" class="btn btn-gold" data-quiz-commencer>Réessayer ${I.arrow}</button>
            <button type="button" class="btn btn-ghost" data-go="modules">Tous les modules</button>
          </div>
        </div>`;
    }
    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Les illustrations des questions ───────────────────────────────── */
  /**
   * Une question peut porter un dessin : `illustration: { type, ... }`.
   *   bougies    { bougies: [{o,h,l,c}], surligne: [indices], etiquettes: [{i, texte}], niveau: prix, legende }
   *              quelques chandeliers, grands, pour lire une forme (marteau, doji, continuation).
   *   graphique  { ...un exercice sans interaction : chemin, n, graine, bougies, indicateurs, cv, pivot, zone }
   *              le meme moteur que les exercices, en lecture seule (bandes qui se resserrent, retest).
   *   courbe     { points: [valeurs], etapes: [{i, texte}], legende }
   *              une courbe de capital, pour la psychologie (le trade revanchard, la serie).
   */
  function illustrer(il, largeur) {
    const W = Math.max(280, Math.round(largeur || 520));
    if (il.type === 'graphique') return graphique({ type: 'illustration', n: il.n, graine: il.graine, chemin: il.chemin, bougies: il.bougies, indicateurs: il.indicateurs, cv: il.cv, pivot: il.pivot, zone: il.zone, sens: il.sens, ut: il.ut || '', symbole: il.symbole || '', heure_debut: il.heure_debut || '' }, { largeur: W }).html + (il.legende ? `<p class="ex__legende">${txt(il.legende)}</p>` : '');
    if (il.type === 'bougies') {
      const B = il.bougies;
      const H = 220, M = { g: 16, d: 16, h: 18, b: 22 };
      const pw = W - M.g - M.d, ph = H - M.h - M.b;
      let haut = Math.max(...B.map((b) => b.h)), bas = Math.min(...B.map((b) => b.l));
      if (il.niveau != null) { haut = Math.max(haut, il.niveau); bas = Math.min(bas, il.niveau); }
      if (il.bande) { haut = Math.max(haut, il.bande.haut); bas = Math.min(bas, il.bande.bas); }
      const marge = (haut - bas) * 0.12 || 1; haut += marge; bas -= marge;
      const y = (p) => M.h + (haut - p) / (haut - bas) * ph;
      const pas = pw / B.length, x = (i) => M.g + pas * (i + 0.5), lc = Math.min(28, pas * 0.5);
      const S = [`<svg class="ex__svg ${(il.peau || 'tradingview') === 'tradingview' ? 'ex__svg--tv' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${txt(il.legende || 'Chandeliers')}"><rect x="0" y="0" width="${W}" height="${H}" rx="14" class="ex__fond"/>`];
      if (il.bande) S.push(`<rect x="${M.g}" y="${y(il.bande.haut).toFixed(1)}" width="${pw}" height="${Math.max(2, y(il.bande.bas) - y(il.bande.haut)).toFixed(1)}" class="ex__zone"/>${il.bande.texte ? `<text x="${M.g + 6}" y="${(y(il.bande.haut) - 5).toFixed(1)}" class="ex__etiq">${txt(il.bande.texte)}</text>` : ''}`);
      if (il.niveau != null) S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(il.niveau).toFixed(1)}" y2="${y(il.niveau).toFixed(1)}" class="ex__cv"/>${il.niveau_texte ? `<text x="${W - M.d - 4}" y="${(y(il.niveau) - 5).toFixed(1)}" class="ex__etiq" text-anchor="end">${txt(il.niveau_texte)}</text>` : ''}`);
      B.forEach((b, i) => {
        const up = b.c >= b.o, yo = y(b.o), yc = y(b.c);
        const sur = (il.surligne || []).includes(i);
        S.push(`<g class="ex__bougie ${up ? 'ex__bougie--h' : 'ex__bougie--b'} ${sur ? 'ex__bougie--sur' : ''}"><line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${y(b.h).toFixed(1)}" y2="${y(b.l).toFixed(1)}"/><rect x="${(x(i) - lc / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${lc.toFixed(1)}" height="${Math.max(2, Math.abs(yo - yc)).toFixed(1)}"/></g>`);
        if (sur) S.push(`<circle cx="${x(i).toFixed(1)}" cy="${(y(b.h) - 12).toFixed(1)}" r="4" class="ex__point"/>`);
      });
      (il.etiquettes || []).forEach((t) => S.push(`<text x="${x(t.i).toFixed(1)}" y="${H - 8}" class="ex__etiq ex__etiq--or" text-anchor="middle">${txt(t.texte)}</text>`));
      S.push('</svg>');
      return S.join('') + (il.legende ? `<p class="ex__legende">${txt(il.legende)}</p>` : '');
    }
    if (il.type === 'courbe') {
      const P = il.points;
      const H = 220, M = { g: 16, d: 16, h: 18, b: 30 };
      const pw = W - M.g - M.d, ph = H - M.h - M.b;
      const suiveuse = il.suiveur ? P.map((_, i) => Math.max(...P.slice(0, i + 1)) - il.suiveur) : null;
      const plancher = il.plancher != null ? il.plancher : null;
      const tous = [...P, ...(suiveuse || []), ...(plancher != null ? [plancher] : [])];
      const haut = Math.max(...tous) + (Math.max(...tous) - Math.min(...tous)) * 0.08 + 1, bas = Math.min(...tous) - (Math.max(...tous) - Math.min(...tous)) * 0.08 - 1;
      const y = (v) => M.h + (haut - v) / (haut - bas) * ph;
      const x = (i) => M.g + (pw * i) / Math.max(1, P.length - 1);
      const S = [`<svg class="ex__svg ${(il.peau || 'tradingview') === 'tradingview' ? 'ex__svg--tv' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${txt(il.legende || 'Courbe')}"><rect x="0" y="0" width="${W}" height="${H}" rx="14" class="ex__fond"/>`];
      if (il.base != null) S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(il.base).toFixed(1)}" y2="${y(il.base).toFixed(1)}" class="ex__grille"/>`);
      if (suiveuse) S.push(`<path d="${suiveuse.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}" class="ex__suiveur"/><text x="${W - M.d - 4}" y="${(y(suiveuse[suiveuse.length - 1]) + 14).toFixed(1)}" class="ex__etiq" text-anchor="end">${txt(il.suiveur_texte || 'perte maximale')}</text>`);
      if (plancher != null) S.push(`<line x1="${M.g}" x2="${W - M.d}" y1="${y(plancher).toFixed(1)}" y2="${y(plancher).toFixed(1)}" class="ex__suiveur"/><text x="${W - M.d - 4}" y="${(y(plancher) + 14).toFixed(1)}" class="ex__etiq" text-anchor="end">${txt(il.plancher_texte || 'perte maximale')}</text>`);
      S.push(`<path d="${P.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}" class="ex__courbe"/>`);
      (il.etapes || []).forEach((t, k) => { S.push(`<circle cx="${x(t.i).toFixed(1)}" cy="${y(P[t.i]).toFixed(1)}" r="5" class="ex__point ${t.rouge ? 'ex__point--mal' : ''}"/><text x="${x(t.i).toFixed(1)}" y="${(k % 2 ? y(P[t.i]) + 20 : y(P[t.i]) - 12).toFixed(1)}" class="ex__etiq ${t.rouge ? '' : 'ex__etiq--or'}" text-anchor="${t.i === 0 ? 'start' : t.i === P.length - 1 ? 'end' : 'middle'}">${txt(t.texte)}</text>`); });
      S.push('</svg>');
      return S.join('') + (il.legende ? `<p class="ex__legende">${txt(il.legende)}</p>` : '');
    }
    return '';
  }

  /** L ecran d entree, rendu par supabase-formation.js dans sa carte. `ctx.certification` change le registre. */
  function entree(ctx) {
    const D = ctx.donnees;
    const nbEx = (D.exercices || []).length;
    const total = D.questions.length + nbEx * (D.points_par_exercice || 0);
    const seuil = Math.ceil(total * (D.seuil || 0.8));
    const mini = D.exercices_minimum || 0;
    const titre = nbEx ? `${D.questions.length} questions et ${nbEx} exercice${nbEx > 1 ? 's' : ''} sur graphique, ${seuil} points sur ${total} pour ${ctx.certification ? 'être certifié' : 'valider'}.` : `${D.questions.length} questions, ${seuil} bonnes réponses pour valider.`;
    const corps = ctx.certification
      ? `C’est l’examen de sortie : il porte sur toute la méthode. Les questions te mettent en situation de séance ; les exercices te donnent un graphique, et c’est toi qui poses la zone ou qui choisis l’entrée. Il faut 80 % des points${mini ? ` et au moins ${mini} exercices réussis sur ${nbEx}` : ''}. Tu peux le repasser autant de fois que tu veux, et chaque exercice est corrigé graphique à l’appui.`
      : `C’est 80 %. Une question par écran${nbEx ? `, puis ${nbEx > 1 ? 'les exercices' : 'l’exercice'} sur graphique` : ''}, et tu valides à la fin. Pour chaque mauvaise réponse tu auras le conseil et le passage de la vidéo à revoir${nbEx ? ', et chaque exercice est corrigé graphique à l’appui' : ''}. Tu peux le repasser autant de fois que tu veux.`;
    return `
      <div class="quiz__entree">
        <h3>${titre}</h3>
        <p>${corps}</p>
        ${ctx.dernier ? `<p class="quiz__dernier">Dernier essai : <b>${ctx.dernier.score} / ${ctx.dernier.total}</b>${ctx.dernier.date ? `, le ${txt(ctx.dernier.date)}` : ''}.</p>` : ''}
        <button type="button" class="btn btn-gold" data-quiz-commencer>${ctx.certification ? 'Commencer l’examen' : ctx.refaire ? 'Refaire le quiz' : 'Commencer le quiz'} <span class="mono" style="opacity:.75">+${ctx.xp || 0} XP</span></button>
      </div>`;
  }

  function arreter() { if (_etat && _etat.nettoyer) _etat.nettoyer(); _etat = null; }

  racine.FormationExamen = { commencer, rendreResultat, entree, arreter, illustrer, _calcul: { bougiesDe, graphique, noter, noterExercice, mm20, bollinger, vwap } };
})();
