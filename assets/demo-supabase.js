/**
 * MODE DÉMO DU JOURNAL : un faux Supabase, en mémoire, peuplé de données FICTIVES.
 *
 * Chargé par `demo-journal.html` À LA PLACE de la bibliothèque supabase-js. Le reste
 * de l'application est le VRAI code du journal, inchangé : mêmes écrans, mêmes
 * calculs, mêmes messages. Seule la source des données change.
 *
 * ── ⛔ CE QUE CE FICHIER GARANTIT ─────────────────────────────────────────────
 *   1. AUCUN appel à la base : `window.supabase` est remplacé avant que
 *      `supabase-config.js` ne crée son client, la vraie bibliothèque n'est jamais
 *      chargée. Aucune donnée d'élève ne peut s'afficher, il n'y en a pas.
 *   2. Les appels `/api/…` du journal sont interceptés et répondent à vide.
 *   3. Ce qu'on saisit pendant la démo (trade, note, import CSV) vit en mémoire et
 *      disparaît au rechargement : la démo repart toujours du même état.
 *   4. Les boîtes `alert()` / `confirm()` du journal ne s'ouvrent pas : en
 *      tournage, une boîte modale gèle la page et l'outil de capture avec elle.
 *
 * ── TROIS PROFILS, POUR TROIS PRISES DE VUE (`?profil=`) ──────────────────────
 *   alex  (défaut)  le bon élève : discipliné, peu de trades, protections solides.
 *   sam             surtrading et revenge trading : journées à 5 ou 6 trades,
 *                   ré-entrées dans les cinq minutes après une grosse perte,
 *                   série de pertes, trades hors méthode et sans protection.
 *   lea             la protection « clôture de la veille » seule, qui perd, et
 *                   des RR1 atteints puis clôturés au break-even.
 * Les trois partagent le même historique sain (deux mois avant les 30 derniers
 * jours), pour que les « Points à surveiller » puissent se comparer à une norme.
 *
 * ⚠️ LES « POINTS À SURVEILLER » N'EN AFFICHENT QUE CINQ, triés par gravité. Chaque
 * profil est donc réglé pour que les cinq qui sortent soient ceux qu'on veut
 * montrer, et pas une alerte parasite (taux de réussite par instrument, par
 * protection, contre-tendance, trades courts, séances tardives). Vérifié par
 * `outils/demo-journal-verifier.mjs`, qui fait tourner la VRAIE fonction du journal.
 */
(() => {
  'use strict';

  const PROFILS = {
    alex: { nom: 'Alex Martin', email: 'alex.martin@exemple.fr', mantra: 'Le plan avant le clic. Toujours.' },
    sam: { nom: 'Sam Durand', email: 'sam.durand@exemple.fr', mantra: 'Une perte n\'appelle pas un trade.' },
    lea: { nom: 'Léa Petit', email: 'lea.petit@exemple.fr', mantra: 'Une protection seule ne suffit pas.' },
  };
  const demande = (() => { try { return new URLSearchParams(location.search).get('profil'); } catch { return null; } })();
  const PROFIL = PROFILS[demande] ? demande : 'alex';
  const P = PROFILS[PROFIL];

  // Générateur à GRAINE FIXE : chaque profil s'ouvre toujours à l'identique.
  let graine = 360360;
  const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const entre = (a, b) => a + alea() * (b - a);
  const choisir = (t) => t[Math.floor(alea() * t.length)];

  const UID = 'd3m0d3m0-0000-4000-8000-000000000360';
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const maintenant = () => new Date().toISOString();

  // Jours ouvrés jusqu'à la veille du jour d'ouverture, du plus ancien au plus récent.
  function joursOuvres(n) {
    const out = [];
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1);
    while (out.length < n) {
      if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(new Date(d));
      d.setDate(d.getDate() - 1);
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  // LES DONNÉES
  // ════════════════════════════════════════════════════════════════════════
  const T = {};
  T.users = [{ id: 9360, uuid: UID, email: P.email, name: P.nom, role: 'student', status: 'active',
    created_at: '2026-06-02T09:00:00', updated_at: '2026-06-02T09:00:00', legal_accepted_at: '2026-06-02T09:05:00+00:00' }];
  // Les deux droits, pour que le bouton « Formation » du menu existe dans la démo.
  // L'élève entre quand même directement dans le journal : la page de démo pose
  // « dernier espace = journal » dans son stockage isolé (voir demo-journal.html).
  T.acces_membre = [{ user_id: UID, formation_actif: true, journal_actif: true, formation_fin: null, journal_fin: null,
    journal_demande_le: null, journal_retire_le: null, niveau: null, created_at: maintenant(), updated_at: maintenant() }];
  T.accounts = [
    { id: 36001, user_id: UID, name: 'Topstep 50K Funded', type: 'funded', initial_balance: 50000, current_balance: 50000,
      protection_enabled: true, max_daily_loss: 1000, max_total_loss: 2000, active: true, risk_per_trade: 250, created_at: '2026-07-01T10:00:00' },
    { id: 36002, user_id: UID, name: 'Apex 50K Évaluation', type: 'challenge', initial_balance: 50000, current_balance: 50000,
      protection_enabled: true, max_daily_loss: null, max_total_loss: 2500, active: true, risk_per_trade: 250, created_at: '2026-08-12T10:00:00' },
  ];
  T.user_preferences = [{ user_id: UID, animations_enabled: true, sounds_enabled: false, popups_enabled: false,
    candles_bg_enabled: true, theme: 'dark', accent_color: null, dashboard_layout: null, alerts_config: null,
    overtrading_threshold: 4, session_definitions: null, vacation_mode: false, coach_calendar_display: null,
    coach_dashboard_layout: null, mantra_texte: P.mantra, mantra_auteur: P.nom.split(' ')[0],
    created_at: maintenant(), updated_at: maintenant() }];
  T.user_motivation = [{ id: 1, user_id: UID, motivation_image_url: null, show_on_login: false, last_shown_date: null,
    motivation_text: { alex: 'Vivre de mon trading en gardant mon emploi le temps qu\'il faut. Pas de raccourci.', sam: 'Arrêter de trader pour me refaire. Je trade mon plan, ou je ne trade pas.', lea: 'Construire une méthode qui tient dans la durée, une séance après l\'autre.' }[PROFIL],
    created_at: maintenant(), updated_at: maintenant() }];

  // ── Les trades ───────────────────────────────────────────────────────────
  T.trades = [];
  let idTrade = 900000;
  // Un niveau de prix par famille : le NQ ne cote pas comme le ES.
  const PRIX = { ES: 7310, NQ: 25480, GC: 4080 };
  const FAMILLE = { ES: 'ES', MES: 'ES', NQ: 'NQ', MNQ: 'NQ', GC: 'GC', MGC: 'GC' };
  const VALEUR = { ES: 50, MES: 5, NQ: 20, MNQ: 2, GC: 100, MGC: 10 };
  const FRAIS = { ES: 4.5, MES: 1.4, GC: 4.8, MGC: 1.6, NQ: 4.5, MNQ: 1.4 };

  /**
   * Un trade. `pnl` est le résultat NET voulu ; les prix en sont déduits, pour que
   * l'écart entrée/sortie soit cohérent avec le P&L (le détecteur de break-even
   * lit l'écart en points, pas le P&L).
   */
  function trade(jour, o) {
    const inst = o.inst || 'ES';
    const qte = o.qte || (inst === 'MES' ? 5 : 1);
    const frais = +(FRAIS[inst] * qte).toFixed(2);
    const pas = inst === 'GC' || inst === 'MGC' ? 0.1 : 0.25;
    let ecart = Math.round(((o.pnl || 0) + frais) / (qte * VALEUR[inst]) / pas) * pas;
    if (o.be) ecart = pas; // break-even : une graduation, sous le seuil du détecteur
    const sens = o.sens || (alea() < 0.6 ? 'LONG' : 'SHORT');
    const fam = FAMILLE[inst];
    const base = (PRIX[fam] += entre(-12, 14) * (fam === 'NQ' ? 3.5 : fam === 'GC' ? 0.6 : 1));
    const entree = +(Math.round(base / pas) * pas).toFixed(2);
    const sortie = +(sens === 'LONG' ? entree + ecart : entree - ecart).toFixed(2);
    const [h, m] = o.h.split(':').map(Number);
    const debut = new Date(jour); debut.setHours(h, m, 0, 0);
    const fin = new Date(jour); fin.setHours(h, m + (o.duree || 40), 0, 0);
    const ts = (d) => `${iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
    const pnlNet = o.be ? +(ecart * qte * VALEUR[inst] - frais).toFixed(2) : +o.pnl.toFixed(2);
    const libelle = sens === 'LONG' ? 'Long' : 'Short';
    T.trades.push({
      id: ++idTrade, user_id: UID, account_id: o.compte || 36001, instrument: inst, symbol: null, trade_type: null,
      direction: sens, quantity: qte, entry_price: entree, exit_price: sortie,
      entry_time: ts(debut), exit_time: ts(fin), commissions: 0, fees: frais, manual_pnl: pnlNet, pnl: pnlNet,
      trade_date: iso(jour), stop_loss: null, take_profit: null,
      setup: o.setup || choisir(['Pullback', 'Reversal', 'Pullback', 'Breakout']),
      protections: o.prot === null ? null : JSON.stringify(o.prot || ['Liquidité 30m/H1/H4']),
      type: o.rr ? `${libelle} (${o.rr} atteint)` : libelle,
      trade_trend_type: o.tendance || 'Tendance',
      is_break_even: !!o.be, is_methode: !o.hm, is_hors_methode: !!o.hm,
      notes: o.note || '', source: 'manual', external_id: null,
      created_at: ts(fin), updated_at: ts(fin),
    });
  }

  const jours = joursOuvres(62);            // ~3 mois
  const ancien = jours.slice(0, 40);         // historique sain, commun aux trois profils
  const r = jours.slice(40);                 // les 22 derniers jours ouvrés (≈ 30 jours)

  // Historique : discipline correcte. La clôture de la veille y fonctionne bien,
  // pour que sa dégradation récente (profil lea) ressorte par contraste.
  ancien.forEach((j, i) => {
    if (i % 7 === 5) return;
    const n = 1 + Math.floor(alea() * 2);
    ['15:34', '16:12'].slice(0, n).forEach((h, k) => {
      const gagnant = alea() < 0.55;
      const prot = i % 3 === 0 && k === 0 ? ['Clôture veille', 'Liquidité 30m/H1/H4']
        : choisir([['Liquidité 30m/H1/H4'], ['VWAP', 'Liquidité 30m/H1/H4'], ['Pivot', 'Liquidité 30m/H1/H4'], ['MM20', 'VWAP']]);
      trade(j, { h, prot, compte: i < 18 ? 36001 : choisir([36001, 36002]),
        pnl: gagnant ? entre(200, 340) : -entre(150, 230), rr: gagnant && alea() < 0.45 ? choisir(['RR1', 'RR2']) : null,
        inst: alea() < 0.15 ? 'MES' : 'ES' });
    });
  });

  // Une bonne séance ordinaire (VWAP + liquidité), et une petite perte propre.
  const bon = (j, h, compte) => trade(j, { h, prot: ['VWAP', 'Liquidité 30m/H1/H4'], pnl: entre(230, 380), rr: choisir(['RR1', 'RR2']), compte: compte || 36002 });
  const perteSaine = (j, h) => trade(j, { h, prot: ['Liquidité 30m/H1/H4'], pnl: -entre(160, 220), compte: 36002 });

  const SEANCES_TILT = { sam: [6, 13, 20], alex: [], lea: [] }[PROFIL];

  if (PROFIL === 'alex') {
    // Le bon élève : 1 à 2 trades, protections solides, pertes contenues.
    r.forEach((j, x) => {
      if (x % 6 === 4) return; // une journée sans trade de temps en temps
      if (x % 3 === 1) perteSaine(j, '15:33'); else bon(j, '15:33');
      if (x % 4 === 0) bon(j, '16:15', 36001);
    });
  }

  if (PROFIL === 'sam') {
    // Journées ordinaires plutôt bonnes, entre les séances qui dérapent.
    r.forEach((j, x) => { if (!SEANCES_TILT.includes(x) && x % 5 !== 2) bon(j, '15:35'); });
    // Sans protection, en dehors des séances de tilt.
    [2, 9, 16].forEach((x) => trade(r[x], { h: '15:40', prot: null, pnl: -entre(180, 230), setup: 'Breakout', compte: 36001, tendance: 'Non spécifié' }));
    // La séance qui dérape : une perte au-delà du R (250 $), puis des ré-entrées
    // trois minutes après chaque sortie. ⚠️ Un instrument différent par séance, et
    // jamais le ES : le journal alerte sur le taux de réussite d'un instrument dès
    // 10 trades, et cette alerte parasite chassait le surtrading des cinq affichées.
    SEANCES_TILT.forEach((x, s) => {
      const nb = [6, 6, 5][s];
      const inst = ['MES', 'MNQ', 'NQ'][s];
      let minutes = 14 * 60 + 31;
      const heure = () => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
      for (let k = 0; k < nb; k++) {
        const grosse = k % 2 === 0;
        trade(r[x], { h: heure(), duree: 30, inst, qte: inst === 'NQ' ? 1 : 5, compte: 36001, tendance: 'Non spécifié',
          prot: k === 0 ? ['Liquidité 30m/H1/H4'] : null, hm: k >= 2, setup: 'Reversal',
          pnl: k === nb - 1 ? 180 : (grosse ? -entre(300, 380) : -entre(160, 220)),
          note: k === 0 ? 'Stop déplacé, perte au-delà du R.' : (k === 1 ? 'Ré-entrée tout de suite pour me refaire.' : '') });
        minutes += 33;
      }
    });
  }

  if (PROFIL === 'lea') {
    r.forEach((j, x) => { if (x % 2 === 0) bon(j, '15:35'); else if (x % 5 === 1) perteSaine(j, '16:10'); });
    // La clôture de la veille SEULE : 7 trades, 1 gagnant.
    [1, 3, 5, 8, 11, 14, 17].forEach((x, i) => trade(r[x], { h: '15:31', prot: ['Clôture veille'], compte: 36001,
      pnl: i === 3 ? 290 : -entre(190, 240), note: i === 0 ? 'Entrée sur la CV seule, sans autre confluence.' : '' }));
    // RR1 atteint, stop remonté, sorti au break-even : 4 trades.
    [4, 9, 15, 19].forEach((x) => trade(r[x], { h: '16:02', prot: ['VWAP', 'Liquidité 30m/H1/H4'], be: true, rr: 'RR1', compte: 36002,
      note: 'RR1 touché, stop remonté au BE, sorti au BE.' }));
  }

  // ── Capture de graphique FICTIVE, dessinée ici en SVG ───────────────────
  // ⛔ Aucune vraie capture : une capture d'élève peut porter son nom ou son compte.
  // Le graphique est fabriqué de toutes pièces et le dit, en bas à droite.
  function graphique(modele, graineGraph) {
    let g = graineGraph;
    const hasard = () => { g = (g * 1103515245 + 12345) % 2147483648; return g / 2147483648; };
    const L = 960, H = 440, n = 48, marge = 40;
    let prix = 100, bougies = [];
    const pente = modele === 'cv' ? -0.35 : modele === 'tilt' ? -0.15 : 0.28;
    for (let i = 0; i < n; i++) {
      const o = prix, c = o + pente + (hasard() - 0.5) * 2.4;
      bougies.push({ o, c, h: Math.max(o, c) + hasard() * 1.2, l: Math.min(o, c) - hasard() * 1.2 });
      prix = c;
    }
    const hauts = bougies.map((b) => b.h), bas = bougies.map((b) => b.l);
    const max = Math.max(...hauts) + 1, min = Math.min(...bas) - 1;
    const y = (v) => marge + (max - v) / (max - min) * (H - 2 * marge);
    const lx = (L - 2 * marge) / n;
    let vwap = 0, somme = 0;
    const pointsVwap = bougies.map((b, i) => { somme += (b.h + b.l + b.c) / 3; vwap = somme / (i + 1); return `${(marge + i * lx + lx / 2).toFixed(1)},${y(vwap).toFixed(1)}`; }).join(' ');
    const corps = bougies.map((b, i) => {
      const x = marge + i * lx, haut = b.c >= b.o, coul = haut ? '#2bbf8a' : '#e0525a';
      return `<line x1="${(x + lx / 2).toFixed(1)}" y1="${y(b.h).toFixed(1)}" x2="${(x + lx / 2).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${coul}" stroke-width="1.4"/>`
        + `<rect x="${(x + lx * 0.18).toFixed(1)}" y="${y(Math.max(b.o, b.c)).toFixed(1)}" width="${(lx * 0.64).toFixed(1)}" height="${Math.max(1.5, Math.abs(y(b.o) - y(b.c))).toFixed(1)}" fill="${coul}"/>`;
    }).join('');
    const iE = modele === 'tilt' ? 14 : 18, bE = bougies[iE];
    const xE = marge + iE * lx + lx / 2;
    const niveau = modele === 'cv' ? bougies[16].h : vwap;
    const ligneNiveau = modele === 'cv'
      ? `<line x1="${marge}" x2="${L - marge}" y1="${y(bougies[16].h).toFixed(1)}" y2="${y(bougies[16].h).toFixed(1)}" stroke="#d4af37" stroke-dasharray="7 6" stroke-width="1.6"/><text x="${L - marge - 6}" y="${(y(bougies[16].h) - 7).toFixed(1)}" fill="#d4af37" font-size="15" text-anchor="end">Clôture veille</text>`
      : `<polyline points="${pointsVwap}" fill="none" stroke="#f29d38" stroke-width="2.2"/><text x="${L - marge - 6}" y="${marge + 16}" fill="#f29d38" font-size="15" text-anchor="end">VWAP</text>`;
    const fleches = (modele === 'tilt' ? [14, 21, 27, 33] : [iE]).map((k) => {
      const xb = marge + k * lx + lx / 2, yb = y(bougies[k].l) + 20;
      return `<path d="M${xb.toFixed(1)} ${(yb - 8).toFixed(1)} l-8 14 h16 z" fill="#d4af37"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">`
      + `<rect width="${L}" height="${H}" fill="#0b0c10"/>`
      + Array.from({ length: 6 }, (_, k) => `<line x1="${marge}" x2="${L - marge}" y1="${marge + k * (H - 2 * marge) / 5}" y2="${marge + k * (H - 2 * marge) / 5}" stroke="#1c1f26"/>`).join('')
      + ligneNiveau + corps + fleches
      + `<text x="${marge}" y="26" fill="#c9c4b8" font-family="Arial" font-size="16" font-weight="700">ES · 5 min</text>`
      + `<text x="${L - marge}" y="${H - 12}" fill="#6e6a60" font-family="Arial" font-size="13" text-anchor="end">Exemple fictif · démo Trader 360</text>`
      + `</svg>`;
    void niveau; void xE; void bE;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ── Journal quotidien ────────────────────────────────────────────────────
  const POSITIFS = ['Patient avant l\'entrée', 'Respecté mon plan de trading à 100%', 'Resté calme et discipliné',
    'Sorti sur mon objectif (RR1/RR2)', 'Bonne lecture du marché', 'Accepté la perte sereinement'];
  const ERREURS_TILT = ['Overtrading (trop de trades)', 'Revenge trading', 'Déplacé mon stop loss', 'Trade en tilt émotionnel'];
  T.journal_entries = [];
  let idJ = 700;
  r.forEach((j, x) => {
    const tilt = SEANCES_TILT.includes(x);
    const aTrade = T.trades.some((t) => t.trade_date === iso(j));
    T.journal_entries.push({
      id: ++idJ, user_id: UID, entry_date: iso(j),
      content: !aTrade ? 'Pas de configuration propre aujourd\'hui, je ne force pas.'
        : tilt ? 'Première perte au-delà du R, puis j\'ai voulu me refaire tout de suite. Cinq ou six trades au lieu de deux. À relire avant la prochaine séance.'
          : choisir(['Séance propre : j\'ai attendu ma zone, entrée sur la VWAP avec la liquidité 30 min derrière.',
            'Marché en range le matin, j\'ai patienté jusqu\'à la cassure. Conforme au plan.',
            'Bonne lecture du contexte H1. Sortie au RR1, je laisse le reste.']),
      mood: null, emotion_before: tilt ? 'Nerveux' : choisir(['Calme', 'Confiant', 'Neutre']),
      emotion_after: tilt ? 'Frustré' : choisir(['Satisfait', 'Calme', 'Confiant']),
      session_rating: tilt ? 2 : choisir([4, 4, 5, 3]),
      // Une capture sur les journées marquantes : la séance de tilt, la perte sur la CV seule, et une séance propre sur deux.
      image_url: !aTrade ? null : tilt ? graphique('tilt', 900 + x) : (PROFIL === 'lea' && [1, 3, 5, 8, 11, 14, 17].includes(x)) ? graphique('cv', 700 + x) : (x % 2 === 0 ? graphique('vwap', 500 + x) : null),
      image_url_2: null, no_trade: !aTrade,
      positive_points: tilt ? [] : [choisir(POSITIFS), choisir(POSITIFS)].filter((v, i, a) => a.indexOf(v) === i),
      errors_committed: tilt ? ERREURS_TILT : [],
      checklist_completed: !tilt, checklist: null,
      created_at: `${iso(j)}T21:00:00`, updated_at: `${iso(j)}T21:00:00`,
    });
  });
  T.checklist_validations = r.filter((_, x) => !SEANCES_TILT.includes(x)).map((j) => ({
    user_id: UID, validation_date: iso(j), items_checked: 7, total_items: 7, completion_rate: 100, validated_at: `${iso(j)}T14:50:00+00:00` }));

  // ── Comptabilité ─────────────────────────────────────────────────────────
  T.account_costs = [
    { id: 1, user_id: UID, account_id: 36001, account_name: 'Topstep 50K Funded', date: iso(jours[0]), cost: 41.65, notes: 'Trading Combine 50K (code TS-…, -15 %)' },
    { id: 2, user_id: UID, account_id: 36001, account_name: 'Topstep 50K Funded', date: iso(jours[14]), cost: 149, notes: 'Activation du compte financé' },
    { id: 3, user_id: UID, account_id: 36002, account_name: 'Apex 50K Évaluation', date: iso(jours[18]), cost: 17.70, notes: 'Évaluation 50K (code TRADER360)' },
  ];
  T.payouts = [
    { id: 1, user_id: UID, account_id: 36001, account_name: 'Topstep 50K Funded', date: iso(jours[33]), amount: 500, notes: 'Premier retrait' },
  ];
  T.daily_fees = [];

  // ── Replays ──────────────────────────────────────────────────────────────
  // ⚠️ TITRES FICTIFS. La vidéo associée est une vidéo de la formation (bonus
  // APEX), choisie parce qu'elle ne montre aucun membre : un vrai replay de live
  // peut montrer le chat, donc des noms d'élèves.
  T.replays = jours.slice(-10).map((j, i) => ({
    id: 5000 + i, title: `Live du ${j.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    description: 'Préparation de séance, lecture des niveaux, trades commentés en direct.',
    vimeo_video_id: '1240988486', vimeo_hash: 'a7131ad422', replay_date: iso(j), duration_seconds: 5400 + i * 60,
    thumbnail_url: null, created_by: null, created_at: `${iso(j)}T19:00:00+00:00`, updated_at: `${iso(j)}T19:00:00+00:00`,
  }));
  T.replay_views = [{ id: 1, replay_id: 5008, user_id: UID, first_watched_at: maintenant(), last_watched_at: maintenant(), progress_seconds: 2400, completed: false }];

  ['formation_progression', 'formation_notes', 'formation_quiz_resultats', 'formation_parcours_vu', 'formation_videos', 'formation_niveau_learnybox'].forEach((t) => { T[t] = []; });

  // ════════════════════════════════════════════════════════════════════════
  // LE FAUX CLIENT
  // ════════════════════════════════════════════════════════════════════════
  const copie = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const egal = (a, b) => String(a) === String(b);
  let compteur = 1;
  const SANS_CLE_USER = ['trades', 'journal_entries', 'payouts', 'account_costs', 'daily_fees', 'replay_views', 'formation_notes', 'formation_progression', 'formation_quiz_resultats'];

  function requete(table) {
    if (!T[table]) T[table] = [];
    const etat = { op: 'select', filtres: [], tri: [], debut: null, fin: null, unique: null, valeurs: null,
      colonnes: '*', compter: false, tete: false, renvoyer: false, conflit: null };
    const filtre = (f) => { etat.filtres.push(f); return api; };
    const api = {
      select(col, opts) { if (etat.op === 'select') etat.colonnes = col || '*'; else etat.renvoyer = true; if (opts) { etat.compter = !!opts.count; etat.tete = !!opts.head; } return api; },
      insert(v) { etat.op = 'insert'; etat.valeurs = Array.isArray(v) ? v : [v]; return api; },
      upsert(v, o) { etat.op = 'upsert'; etat.valeurs = Array.isArray(v) ? v : [v]; etat.conflit = o && o.onConflict; return api; },
      update(v) { etat.op = 'update'; etat.valeurs = v; return api; },
      delete() { etat.op = 'delete'; return api; },
      eq: (c, v) => filtre((l) => egal(l[c], v)),
      neq: (c, v) => filtre((l) => !egal(l[c], v)),
      gt: (c, v) => filtre((l) => l[c] > v), gte: (c, v) => filtre((l) => l[c] >= v),
      lt: (c, v) => filtre((l) => l[c] < v), lte: (c, v) => filtre((l) => l[c] <= v),
      in: (c, t) => filtre((l) => (t || []).some((v) => egal(l[c], v))),
      is: (c, v) => filtre((l) => (v === null ? l[c] == null : l[c] === v)),
      not: (c, op, v) => filtre((l) => (op === 'is' && v === null ? l[c] != null : !egal(l[c], v))),
      ilike: (c, p) => {
        const re = new RegExp('^' + String(p).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
        return filtre((l) => re.test(String(l[c] ?? '')));
      },
      like(c, p) { return api.ilike(c, p); },
      match: (o) => filtre((l) => Object.entries(o).every(([c, v]) => egal(l[c], v))),
      filter: (c, op, v) => filtre((l) => (op === 'eq' ? egal(l[c], v) : op === 'gte' ? l[c] >= v : op === 'lte' ? l[c] <= v : true)),
      contains: () => api, or: () => api, textSearch: () => api, abortSignal: () => api, throwOnError: () => api, returns: () => api,
      order(c, o) { etat.tri.push([c, !(o && o.ascending === false)]); return api; },
      limit(n) { etat.debut = 0; etat.fin = n - 1; return api; },
      range(a, b) { etat.debut = a; etat.fin = b; return api; },
      single() { etat.unique = 'single'; return api; },
      maybeSingle() { etat.unique = 'maybe'; return api; },
      then(ok, ko) { return Promise.resolve(executer()).then(ok, ko); },
      catch(ko) { return Promise.resolve(executer()).catch(ko); },
    };
    const garde = (l) => etat.filtres.every((f) => f(l));
    const projeter = (l) => {
      if (!l || etat.colonnes === '*' || !etat.colonnes) return copie(l);
      const o = {};
      etat.colonnes.split(',').map((s) => s.trim()).forEach((c) => { o[c] = l[c] === undefined ? null : copie(l[c]); });
      return o;
    };
    function executer() {
      const t = T[table];
      let lignes;
      if (etat.op === 'insert' || etat.op === 'upsert') {
        lignes = etat.valeurs.map((v) => {
          const cle = etat.conflit ? etat.conflit.split(',').map((s) => s.trim())
            : (v.id != null ? ['id'] : (v.user_id && !SANS_CLE_USER.includes(table) ? ['user_id'] : null));
          const existant = etat.op === 'upsert' && cle ? t.find((l) => cle.every((c) => egal(l[c], v[c]))) : null;
          if (existant) { Object.assign(existant, copie(v), { updated_at: maintenant() }); return existant; }
          const neuf = Object.assign({ id: Date.now() + compteur++, created_at: maintenant(), updated_at: maintenant() }, copie(v));
          t.push(neuf);
          return neuf;
        });
      } else if (etat.op === 'update') {
        lignes = t.filter(garde);
        lignes.forEach((l) => Object.assign(l, copie(etat.valeurs), { updated_at: maintenant() }));
      } else if (etat.op === 'delete') {
        lignes = t.filter(garde);
        T[table] = t.filter((l) => !garde(l));
      } else {
        lignes = t.filter(garde);
      }
      if (etat.tri.length) {
        lignes = lignes.slice().sort((a, b) => {
          for (const [c, asc] of etat.tri) { if (a[c] === b[c]) continue; const s = (a[c] ?? '') > (b[c] ?? '') ? 1 : -1; return asc ? s : -s; }
          return 0;
        });
      }
      const total = lignes.length;
      if (etat.debut != null) lignes = lignes.slice(etat.debut, etat.fin + 1);
      let data = etat.op !== 'select' && !etat.renvoyer ? null : lignes.map(projeter);
      if (etat.unique) {
        if (data && data.length >= 1) data = data[0];
        else if (etat.unique === 'maybe') data = null;
        else return { data: null, error: { code: 'PGRST116', message: 'Aucune ligne (démo)' }, count: null };
      }
      if (etat.tete) data = null;
      return { data, error: null, count: etat.compter ? total : null, status: 200 };
    }
    return api;
  }

  const session = { access_token: 'demo', token_type: 'bearer', user: { id: UID, email: P.email } };
  const client = {
    from: requete,
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel: () => {},
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session.user }, error: null }),
      signInWithPassword: async () => ({ data: { session, user: session.user }, error: null }),
      signUp: async () => ({ data: { session, user: session.user }, error: null }),
      // ⚠️ Pas de déconnexion dans la démo : il n'y a pas d'autre compte où aller.
      signOut: async () => ({ error: null }),
      onAuthStateChange: (cb) => { setTimeout(() => cb('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      updateUser: async () => ({ data: { user: session.user }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      resend: async () => ({ data: {}, error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
    },
    storage: {
      from: () => ({
        // Une image ajoutée pendant la démo s'affiche, mais ne quitte pas l'onglet.
        upload: async (chemin, fichier) => { client.__fichiers[chemin] = URL.createObjectURL(fichier); return { data: { path: chemin }, error: null }; },
        getPublicUrl: (chemin) => ({ data: { publicUrl: client.__fichiers[chemin] || '' } }),
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async (chemin) => ({ data: { signedUrl: client.__fichiers[chemin] || '' }, error: null }),
      }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
    __fichiers: {},
    __tables: T,
  };

  window.supabase = { createClient: () => client };
  window.__DEMO_JOURNAL__ = { profil: PROFIL, profils: PROFILS };

  // Pas de boîte modale en tournage : elle gèle la page.
  window.alert = (m) => console.log('[DÉMO] alert :', m);
  window.confirm = (m) => { console.log('[DÉMO] confirm :', m); return true; };
  window.prompt = () => null;

  // Les routes /api du journal répondent à vide ; la base n'est jamais jointe.
  const fetchReel = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    const u = String(url && url.url ? url.url : url);
    if (/^\/api\/|journaltrader360\.fr\/api\//.test(u)) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, demo: true, data: [], membres: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (/supabase\.co/.test(u)) return Promise.reject(new Error('Base coupée en mode démo'));
    return fetchReel(url, opts);
  };

  // L'URL ne bouge pas pendant la démo : le journal pousse /dashboard, /tradelog…
  // dans l'historique, et un rechargement sur ces adresses ouvrirait le VRAI journal.
  const garderUrl = (fn) => function (etat, titre) { return fn.call(history, etat, titre, location.href); };
  history.pushState = garderUrl(history.pushState);
  history.replaceState = garderUrl(history.replaceState);

  console.log(`[DÉMO] Profil « ${PROFIL} » : ${T.trades.length} trades fictifs, aucun appel à la base.`);
})();
