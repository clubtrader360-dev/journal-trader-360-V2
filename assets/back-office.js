/**
 * LE BACK-OFFICE COACH (15/10) : la coquille, le routeur, et chaque ecran.
 *
 * Page a part (back-office.html), meme session Supabase que le journal (dans
 * l onglet), reservee aux coachs. Les lectures passent par
 * /api/coach/back-office (agregations en base) et /api/coach/membres (l ecran
 * Membres, rendu par supabase-coach-membres.js, inchange).
 *
 * ⚠️ Chaque ecran dit sa source ; un ecran dont le lot n est pas fait le dit
 * en clair plutot que de montrer du vide ou du faux.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const txt = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const eur = (n) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const nb = (n) => Number(n || 0).toLocaleString('fr-FR');
  const dateFr = (iso, heure) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + (heure ? ` à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '');
  };
  const moisFr = (ym) => { const [a, m] = String(ym).split('-'); const d = new Date(Number(a), Number(m) - 1, 1); return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); };
  // ⚠️ Les couleurs des graphiques se LISENT dans le theme au moment du trace :
  // en dur, un graphique dessine en sombre resterait sombre sur le theme clair.
  const sombre = () => document.body.classList.contains('dark-mode');
  const C = () => sombre()
    ? { OR: '#e8b84b', OR2: '#f3d585', ORD: '#b98a2e', GRIS: '#9c9b94', LIGNE: '#1e2128', FOND: '#0a0a0d', VIDE: '#2a2e37' }
    : { OR: '#b98a2e', OR2: '#d3a73c', ORD: '#8f6a1f', GRIS: '#6e685b', LIGNE: '#e2dbcc', FOND: '#f6f2ea', VIDE: '#d2c9b5' };
  let OR = '#e8b84b', OR2 = '#f3d585', ORD = '#b98a2e', GRIS = '#9c9b94', LIGNE = '#1e2128';
  function couleurs() { ({ OR, OR2, ORD, GRIS, LIGNE } = C()); }
  couleurs();

  /* ══ Le toast (supabase-coach-membres.js appelle window.showNotification) ══ */
  let _toastMinuteur = null;
  function dire(message, type) {
    const t = $('boToast');
    if (!t) return;
    t.textContent = message;
    t.classList.toggle('erreur', type === 'error');
    t.classList.add('on');
    clearTimeout(_toastMinuteur);
    _toastMinuteur = setTimeout(() => t.classList.remove('on'), 4200);
  }
  window.showNotification = dire;

  /* ══ L appel serveur ═══════════════════════════════════════════════════════ */
  const cli = () => window.supabaseClient;
  async function appeler(route, action, corps) {
    const { data: s } = await cli().auth.getSession();
    const jeton = s?.session?.access_token;
    if (!jeton) throw new Error('Session expirée, reconnecte-toi.');
    const r = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action, ...(corps || {}) }),
    });
    const c = await r.json().catch(() => ({}));
    if (!r.ok || !c.ok) throw new Error(c.motif || `réponse ${r.status}`);
    return c.resultat;
  }
  // ⚠️ Une seule route coach pour tout le back-office : le plan Hobby de Vercel
  // plafonne a 12 fonctions, voir api/coach/membres.js.
  const BO = (action, corps) => appeler('/api/coach/membres', action, corps);

  /* ══ Le cache par ecran : « Recharger » le vide ═══════════════════════════ */
  const _cache = new Map();
  async function lire(cle, f) {
    if (_cache.has(cle)) return _cache.get(cle);
    const v = await f();
    _cache.set(cle, v);
    return v;
  }

  /* ══ Les graphiques ═══════════════════════════════════════════════════════ */
  const _graphs = new Map();
  function graph(id, config) {
    const cv = $(id);
    if (!cv || !window.Chart) return;
    couleurs();
    if (_graphs.has(id)) { _graphs.get(id).destroy(); _graphs.delete(id); }
    Chart.defaults.color = GRIS;
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.borderColor = LIGNE;
    _graphs.set(id, new Chart(cv.getContext('2d'), config));
  }
  const axes = (extra) => ({
    x: { grid: { display: false }, ticks: { color: GRIS } },
    y: { grid: { color: LIGNE }, ticks: { color: GRIS }, beginAtZero: true, ...(extra || {}) },
  });

  /* ══ Le routeur ════════════════════════════════════════════════════════════ */
  const FILS = {
    'accueil': 'Accueil', 'academie/formations': 'Académie · Formations', 'academie/membres': 'Académie · Membres',
    'academie/evaluations': 'Académie · Évaluations', 'academie/diplomes': 'Académie · Diplômes',
    'marketing/tunnels': 'Marketing · Tunnels de vente', 'marketing/emails': 'Marketing · Emails marketing', 'marketing/webinaires': 'Marketing · Webinaires live',
    'crm': 'CRM', 'ventes/offres': 'Ventes · Offres', 'ventes/commandes': 'Ventes · Commandes & factures', 'ventes/comptabilite': 'Ventes · Comptabilité', 'ventes/affiliation': 'Ventes · Affiliation',
  };
  const CHARGEURS = {};
  let _ecranCourant = null;

  function lireHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [chemin, requete] = h.split('?');
    const ecran = FILS[chemin] ? chemin : 'accueil';
    return { ecran, params: new URLSearchParams(requete || '') };
  }
  async function router() {
    const { ecran, params } = lireHash();
    _ecranCourant = ecran;
    document.querySelectorAll('.bo-ecran').forEach((e) => { e.hidden = e.dataset.ecran !== ecran; });
    document.querySelectorAll('.bo-nav a').forEach((a) => { if (a.dataset.nav === ecran) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const fil = $('boFil'); if (fil) fil.textContent = FILS[ecran];
    document.title = `${FILS[ecran].replace(' · ', ' > ')} · Back-office Trader 360`;
    $('bo').classList.remove('barre-ouverte');
    window.scrollTo({ top: 0 });
    const f = CHARGEURS[ecran];
    if (f) { try { await f(params); } catch (e) { console.error('[BO]', ecran, e); dire(`Écran « ${FILS[ecran]} » : ${e.message}`, 'error'); } }
  }
  // Compatibilite : supabase-coach-membres.js appelle showCoachSection('coachMembres') pour ouvrir une fiche.
  window.showCoachSection = async (id) => { if (id === 'coachMembres' && _ecranCourant !== 'academie/membres') { location.hash = '#/academie/membres'; await new Promise((r) => setTimeout(r, 50)); } };

  /* ══ ACCUEIL ═══════════════════════════════════════════════════════════════ */
  const kpi = (ic, k, v, s, sous) => `<div class="bo-kpi"><div class="bo-kpi__ic"><i class="fas ${ic}"></i></div><div class="bo-kpi__k">${k}${sous ? `<b>${sous}</b>` : ''}</div><div class="bo-kpi__v">${v}</div>${s ? `<div class="bo-kpi__s">${s}</div>` : ''}</div>`;
  const total = () => (window.FormationDonnees && window.FormationDonnees.total()) || 0;

  CHARGEURS.accueil = async () => {
    const z = $('boAccueil');
    const a = await lire('accueil', () => BO('accueil'));
    const tl = total();
    const av = a.avancement || [];
    const seaux = [0, 0, 0, 0];
    av.forEach((x) => { const p = tl ? x.vues / tl : 0; seaux[p >= 1 ? 3 : p >= .5 ? 2 : p > 0 ? 1 : 0] += 1; });
    const moy = av.length && tl ? Math.round(av.reduce((s, x) => s + x.vues, 0) / av.length / tl * 100) : 0;
    z.innerHTML = `
      <div class="bo-kpis">
        ${kpi('fa-users', 'Élèves', nb(a.eleves), `${nb(a.comptes)} comptes · ${nb(a.learnybox_sans_compte)} LearnyBox sans compte`)}
        ${kpi('fa-graduation-cap', 'Accès formation', nb(a.formation_actifs), `${nb(a.journal_actifs)} accès journal · ${nb(a.demandes_journal)} demande${a.demandes_journal > 1 ? 's' : ''}`)}
        ${kpi('fa-bolt', 'Actifs dans la formation', nb(a.actifs_30j), `${nb(a.actifs_7j)} sur 7 jours · ${nb(a.connectes_30j)} connectés au journal`, '30 jours')}
        ${kpi('fa-play', 'Chapitres terminés', nb(a.chapitres_30j), `${nb(a.chapitres_7j)} sur 7 jours`, '30 jours')}
        ${kpi('fa-check-double', 'Quiz réussis', nb(a.quiz_reussis), `${nb(a.quiz_tentatives)} tentative${a.quiz_tentatives > 1 ? 's' : ''} · ${nb(a.notes)} note${a.notes > 1 ? 's' : ''}`)}
        ${kpi('fa-chart-line', 'Journal', nb(a.trades_30j), `trades · ${nb(a.entrees_journal_30j)} entrées de journal`, '30 jours')}
        ${kpi('fa-euro-sign', 'Chiffre d affaires', eur(a.ca_total), `${eur(a.ca_annee)} cette année · ${nb(a.nouveaux_clients_30j)} nouveau${a.nouveaux_clients_30j > 1 ? 'x' : ''} client${a.nouveaux_clients_30j > 1 ? 's' : ''} sur 30 jours`, 'total')}
        ${kpi('fa-percent', 'Avancement moyen', `${moy} %`, `${nb(av.length)} élèves avec une progression · ${seaux[3]} au bout`)}
      </div>
      <div class="bo-grille-3">
        <div class="bo-carte"><h2>Activité dans la formation <small>12 derniers mois</small></h2><div class="bo-graph"><canvas id="gActivite"></canvas></div>
          <div class="bo-legende"><span style="--c:${OR}">Chapitres terminés</span><span style="--c:${GRIS}">Élèves actifs</span></div></div>
        <div class="bo-carte"><h2>Répartition</h2><div class="bo-graph bo-graph--petit"><canvas id="gNiveaux"></canvas></div>
          <div class="bo-legende"><span style="--c:${ORD}">Débutant</span><span style="--c:${OR}">Intermédiaire</span><span style="--c:${OR2}">Confirmé</span></div>
          <h2 style="margin-top:18px">Avancement</h2><div class="bo-graph bo-graph--petit"><canvas id="gAvancement"></canvas></div></div>
      </div>
      <p class="bo-source">Sources : progression et quiz du journal, niveaux LearnyBox, transactions LearnyBox importées le 15/10.</p>`;
    const mois = [...new Set([...(a.chapitres_par_mois || []).map((x) => x.mois), ...(a.eleves_actifs_par_mois || []).map((x) => x.mois)])].sort();
    const serie = (liste) => mois.map((m) => { const x = (liste || []).find((y) => y.mois === m); return x ? Number(x.n) : 0; });
    graph('gActivite', { type: 'bar', data: { labels: mois.map(moisFr), datasets: [
      { label: 'Chapitres terminés', data: serie(a.chapitres_par_mois), backgroundColor: 'rgba(232,184,75,.75)', borderRadius: 6, yAxisID: 'y' },
      { label: 'Élèves actifs', data: serie(a.eleves_actifs_par_mois), type: 'line', borderColor: GRIS, backgroundColor: GRIS, tension: .35, pointRadius: 3, yAxisID: 'y2' },
    ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { ...axes(), y2: { position: 'right', grid: { display: false }, ticks: { color: GRIS }, beginAtZero: true } } } });
    const pn = a.par_niveau || {};
    graph('gNiveaux', { type: 'doughnut', data: { labels: ['Débutant', 'Intermédiaire', 'Confirmé'], datasets: [{ data: [pn.debutant || 0, pn.intermediaire || 0, pn.confirme || 0], backgroundColor: [ORD, OR, OR2], borderColor: C().FOND, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } } });
    graph('gAvancement', { type: 'bar', data: { labels: ['Rien', 'Moins de la moitié', 'Plus de la moitié', 'Terminé'], datasets: [{ data: seaux, backgroundColor: [C().VIDE, ORD, OR, OR2], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
  };

  /* ══ ACADEMIE · FORMATIONS ═════════════════════════════════════════════════ */
  CHARGEURS['academie/formations'] = async () => {
    const z = $('boFormations');
    const a = await lire('accueil', () => BO('accueil'));
    const M = (window.FormationDonnees && window.FormationDonnees.MODULES) || [];
    const modules = M.filter((m) => !m.introduction && m.lecons.length).length;
    z.innerHTML = `
      <div class="bo-carte">
        <div class="bo-carte__tete"><h2><b>1</b> Formation</h2><button type="button" class="bo-btn bo-btn--or" disabled title="Vient avec les offres (lot Ventes)"><i class="fas fa-plus"></i> Créer une formation</button></div>
        <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Formation</th><th>Contenu</th><th class="num">Accès actifs</th><th class="num">Actifs 30 j</th><th class="num">Chapitres 30 j</th><th>État</th></tr></thead>
        <tbody><tr><td><b>Trader 360</b><br><small style="color:var(--text-soft)">Niveaux Débutant, Intermédiaire, Confirmé ; certification au module 10</small></td><td>${modules} modules · ${total()} chapitres · ${window.FORMATION_QUIZ ? Object.keys(window.FORMATION_QUIZ).length : 0} quiz</td><td class="num">${nb(a.formation_actifs)}</td><td class="num">${nb(a.actifs_30j)}</td><td class="num">${nb(a.chapitres_30j)}</td><td><span class="bo-pill bo-pill--ok">En ligne</span></td></tr></tbody></table></div>
        <p class="bo-source">Le contenu vit dans assets/formation-donnees.js et les vidéos sur Vimeo. Une seconde formation (par exemple l'accès Discord en récurrent) se créera ici quand les offres existeront : une formation = un produit vendable.</p>
      </div>`;
  };

  /* ══ ACADEMIE · MEMBRES (supabase-coach-membres.js) ═══════════════════════ */
  CHARGEURS['academie/membres'] = async (params) => {
    if (!window.CoachMembres) return;
    await window.CoachMembres.charger();
    const fiche = params.get('fiche');
    if (fiche) { await window.CoachMembres.ouvrirFicheParEmail(fiche); history.replaceState(null, '', '#/academie/membres'); }
  };

  /* ══ ACADEMIE · EVALUATIONS ════════════════════════════════════════════════ */
  let _evalOuvert = null;
  let _evalFiltre = 'tous';
  CHARGEURS['academie/evaluations'] = async () => {
    const z = $('boEvaluations');
    const liste = await lire('evaluations', () => BO('evaluations'));
    const Q = window.FORMATION_QUIZ || {};
    const visibles = liste.filter((q) => _evalFiltre === 'tous' || (_evalFiltre === 'reussis' ? q.reussi : !q.reussi));
    const reussis = liste.filter((q) => q.reussi).length;
    const moyenne = liste.length ? Math.round(liste.reduce((s, q) => s + (q.total ? q.score / q.total : 0), 0) / liste.length * 100) : 0;
    z.innerHTML = `
      <div class="bo-kpis">
        ${kpi('fa-check-double', 'Tentatives', nb(liste.length), `${nb(reussis)} réussie${reussis > 1 ? 's' : ''} · ${nb(new Set(liste.map((q) => q.user_id)).size)} élève${liste.length > 1 ? 's' : ''}`)}
        ${kpi('fa-percent', 'Score moyen', `${moyenne} %`, 'toutes tentatives confondues')}
        ${kpi('fa-book', 'Quiz en service', nb(Object.keys(Q).length), 'un par module, 80 % pour réussir')}
      </div>
      <div class="bo-carte">
        <div class="bo-carte__tete"><h2><b>${nb(visibles.length)}</b> Évaluation${visibles.length > 1 ? 's' : ''}</h2>
          <div class="am-filtres"><button type="button" data-eval-filtre="tous" aria-pressed="${_evalFiltre === 'tous'}">Toutes</button><button type="button" data-eval-filtre="reussis" aria-pressed="${_evalFiltre === 'reussis'}">Réussies</button><button type="button" data-eval-filtre="ratees" aria-pressed="${_evalFiltre === 'ratees'}">Non réussies</button></div></div>
        ${visibles.length ? `<div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Élève</th><th>Évaluation</th><th>Date</th><th>État</th><th>Score</th><th></th></tr></thead><tbody>
          ${visibles.map((q, i) => {
            const def = Q[q.module_cle];
            const detail = _evalOuvert === q.id && def ? `<tr class="am-quiz-detail"><td colspan="6"><ol class="am-reponses">${(q.reponses || []).map((r) => { const qq = (def.questions || []).find((x) => x.id === r.id); if (!qq) return `<li>${txt(r.id)}</li>`; const ok = r.choisie === r.bonne; return `<li class="${ok ? 'ok' : 'ko'}"><b>${txt(qq.enonce)}</b><br>Réponse : ${txt(qq.options[r.choisie] != null ? qq.options[r.choisie] : '(aucune)')}${ok ? '' : `<br><em>Attendu : ${txt(qq.options[r.bonne])}</em>`}</li>`; }).join('')}</ol></td></tr>` : '';
            return `<tr><td><b>${txt(q.eleve.nom || 'Nom non renseigné')}</b><br><small style="color:var(--text-soft)">${txt(q.eleve.email)}</small></td><td>Quiz Trader 360 : Module ${txt(q.module_cle)}${def ? `<br><small style="color:var(--text-soft)">${txt(def.titre || '')}</small>` : ''}</td><td>${txt(dateFr(q.created_at, true))}</td><td><span class="bo-pill ${q.reussi ? 'bo-pill--ok' : 'bo-pill--non'}">${q.reussi ? 'Réussie' : 'Non réussie'}</span></td><td><b>${q.score} / ${q.total}</b> (${q.total ? Math.round(q.score / q.total * 100) : 0} %)</td><td><button type="button" class="bo-oeil" data-eval="${txt(q.id)}" title="Voir ses réponses">&#128065;</button></td></tr>${detail}`;
          }).join('')}</tbody></table></div>` : '<p class="bo-vide">Aucune évaluation dans ce filtre.</p>'}
        <p class="bo-source">Les quiz du journal remplacent les évaluations LearnyBox, qui ne sont pas reprises. L'œil déplie les réponses question par question.</p>
      </div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-eval], [data-eval-filtre]');
    if (!b) return;
    if (b.dataset.eval) _evalOuvert = _evalOuvert === b.dataset.eval ? null : b.dataset.eval;
    if (b.dataset.evalFiltre) _evalFiltre = b.dataset.evalFiltre;
    CHARGEURS['academie/evaluations']();
  });

  /* ══ ACADEMIE · DIPLOMES ═══════════════════════════════════════════════════ */
  let _diplFiltre = 'tous';
  function badgesDe(lecons) {
    const M = (window.FormationDonnees && window.FormationDonnees.MODULES) || [];
    const vus = new Set(lecons || []);
    const modules = M.filter((m) => !m.introduction && m.lecons.length).map((m) => ({ m, n: m.lecons.filter((l) => vus.has(l.id)).length, t: m.lecons.length }));
    const finis = modules.filter((x) => x.n === x.t);
    const cert = finis.some((x) => x.m.cle === '10');
    return { modules, finis, cert, vus: vus.size };
  }
  CHARGEURS['academie/diplomes'] = async () => {
    const z = $('boDiplomes');
    const eleves = await lire('progression', () => BO('progression'));
    const tl = total();
    const lignes = eleves.map((e) => ({ e, b: badgesDe(e.lecons) }));
    const certifies = lignes.filter((x) => x.b.cert).length;
    const avecBadges = lignes.filter((x) => x.b.finis.length).length;
    const visibles = lignes.filter((x) => _diplFiltre === 'tous' || (_diplFiltre === 'certifies' ? x.b.cert : _diplFiltre === 'non' ? !x.b.cert : x.b.finis.length > 0));
    z.innerHTML = `
      <div class="bo-kpis">
        ${kpi('fa-award', 'Certifiés Trader 360', nb(certifies), `${nb(lignes.length - certifies)} non certifiés`)}
        ${kpi('fa-medal', 'Élèves avec au moins un badge', nb(avecBadges), 'un badge par module terminé en entier')}
        ${kpi('fa-users', 'Élèves', nb(lignes.length), 'comptes actifs du journal')}
      </div>
      <div class="bo-carte">
        <div class="bo-carte__tete"><h2><b>${nb(visibles.length)}</b> Élève${visibles.length > 1 ? 's' : ''}</h2>
          <div class="am-filtres"><button type="button" data-dipl-filtre="tous" aria-pressed="${_diplFiltre === 'tous'}">Tous</button><button type="button" data-dipl-filtre="certifies" aria-pressed="${_diplFiltre === 'certifies'}">Certifiés</button><button type="button" data-dipl-filtre="non" aria-pressed="${_diplFiltre === 'non'}">Non certifiés</button><button type="button" data-dipl-filtre="badges" aria-pressed="${_diplFiltre === 'badges'}">Avec badges</button></div></div>
        <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Élève</th><th>Avancement</th><th>Badges</th><th>Certification</th><th></th></tr></thead><tbody>
          ${visibles.map(({ e, b }) => `<tr><td><b>${txt(e.nom || 'Nom non renseigné')}</b><br><small style="color:var(--text-soft)">${txt(e.email)}</small></td>
            <td><div class="bo-barre-prog"><i style="width:${tl ? Math.round(b.vus / tl * 100) : 0}%"></i></div><small style="color:var(--text-soft)">${b.vus} / ${tl} chapitres</small></td>
            <td>${b.finis.length ? b.finis.map((x) => `<span class="am-badge">${x.m.cle === '10' ? 'Certification' : `Module ${txt(x.m.numero)}`}</span>`).join(' ') : '<span style="color:var(--text-disabled)">aucun</span>'}</td>
            <td><span class="bo-pill ${b.cert ? 'bo-pill--ok' : ''}">${b.cert ? 'Certifié Trader 360' : 'Non certifié'}</span></td>
            <td><a class="bo-oeil" href="#/academie/membres?fiche=${encodeURIComponent(e.email)}" title="Ouvrir la fiche">&#128065;</a></td></tr>`).join('')}
        </tbody></table></div>
        <p class="bo-source">Un badge = un module terminé en entier (tous ses chapitres, quiz compris). La certification Trader 360 = le module 10 terminé ; il n'a pas encore de chapitres, personne n'est donc certifié pour l'instant. Le jour venu, un diplôme pourra aussi s'accorder ici à la main.</p>
      </div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dipl-filtre]');
    if (!b) return;
    _diplFiltre = b.dataset.diplFiltre;
    CHARGEURS['academie/diplomes']();
  });

  /* ══ MARKETING, CRM, AFFILIATION : ce qui vient, dit en clair ═══════════════ */
  const avenir = (cartes) => `<div class="bo-avenir">${cartes.map(([t, p]) => `<div class="bo-avenir__carte"><h3>${t}</h3><p>${p}</p></div>`).join('')}</div>`;
  CHARGEURS['marketing/tunnels'] = async () => {
    $('boTunnels').innerHTML = `<div class="bo-carte"><div class="bo-carte__tete"><h2><b>0</b> Tunnel</h2><button type="button" class="bo-btn bo-btn--or" disabled title="Lot Marketing, après les ventes"><i class="fas fa-plus"></i> Créer un tunnel</button></div>
      ${avenir([
        ['Une page d inscription', 'Créée ici, publiée sur trader360.fr, avec un lien à partager (le cas du webinaire avec REC).'],
        ['Les inscrits', 'Chaque inscription arrive dans le CRM et dans la liste Brevo choisie, et vous la voyez ici.'],
        ['Le replay', 'Après le direct, la même page donne accès au replay, aux inscrits seulement.'],
      ])}<p class="bo-source">Les candidatures, elles, passent déjà par le questionnaire du site.</p></div>`;
  };
  CHARGEURS['marketing/emails'] = async () => {
    const modeles = [
      ['Nouveauté dans la formation', 'Un chapitre ou un module ajouté : ce qu il apporte, et un bouton vers l espace membre.'],
      ['Replay d un live', 'Le résumé du live, trois points à retenir, le lien vers le replay.'],
      ['Relance douce', 'Pour un élève qu on n a pas vu depuis trois semaines : un mot, un chapitre à reprendre.'],
      ['Offre ou présentiel', 'Une date, un lieu, un prix, un bouton pour réserver.'],
      ['Brief marché', 'Le contexte du jour en quatre lignes, dans le style du brief existant.'],
      ['Félicitations', 'Module terminé, quiz réussi, certification : un mail qui marque le coup.'],
    ];
    $('boEmails').innerHTML = `<div class="bo-carte"><div class="bo-carte__tete"><h2>Modèles Trader 360</h2><span class="bo-pill">Envoi par Brevo, lot Marketing</span></div>
      <div class="bo-modeles">
        ${modeles.map(([t, p]) => `<div class="bo-modele"><div class="bo-modele__apercu"><i class="or"></i><i class="titre"></i><i></i><i style="width:85%"></i><i style="width:60%"></i><i class="btn"></i></div><div class="bo-modele__corps"><h3>${t}</h3><p>${p}</p><button type="button" class="bo-btn bo-btn--fantome" data-modele="${txt(t)}">Utiliser</button></div></div>`).join('')}
        <div class="bo-modele bo-modele--libre"><div class="bo-modele__apercu"><i class="fas fa-pen-nib"></i></div><div class="bo-modele__corps"><h3>Composer librement</h3><p>Une page blanche aux couleurs Trader 360 : logo, titre, texte, bouton.</p><button type="button" class="bo-btn bo-btn--fantome" data-modele="libre">Composer</button></div></div>
      </div>
      <p class="bo-source">Les modèles sont dessinés ; l'éditeur et l'envoi vers une liste Brevo arrivent avec le lot Marketing, après les ventes.</p></div>`;
  };
  CHARGEURS['marketing/webinaires'] = async () => {
    $('boWebinaires').innerHTML = `<div class="bo-carte"><div class="bo-carte__tete"><h2><b>0</b> Webinaire</h2><button type="button" class="bo-btn bo-btn--or" disabled title="À travailler plus tard"><i class="fas fa-plus"></i> Créer un webinaire</button></div>
      ${avenir([['Avant', 'Une date, un titre, une page d inscription (c est un tunnel), un rappel par mail.'], ['Pendant', 'Le lien du direct (YouTube ou autre), envoyé aux inscrits.'], ['Après', 'Le replay, et les retombées : inscrits, présents, candidatures qui en viennent.']])}</div>`;
  };
  CHARGEURS.crm = async () => {
    $('boCrm').innerHTML = `<div class="bo-carte"><div class="bo-carte__tete"><h2>Listes Brevo</h2><span class="bo-pill">Lot CRM, après les ventes</span></div>
      ${avenir([['Les listes', 'Toutes vos listes Brevo, avec leur nombre de contacts, lues en direct (la clé existe déjà côté serveur).'], ['Les contacts', 'Qui est dans quelle liste, et le lien vers sa fiche membre quand il en a une.'], ['Les mouvements', 'Un membre qui s inscrit ici entre dans la bonne liste là-bas, sans double saisie.']])}</div>`;
  };
  CHARGEURS['ventes/affiliation'] = async () => {
    $('boAffiliation').innerHTML = `<div class="bo-carte"><div class="bo-carte__tete"><h2><b>0</b> Affilié</h2><button type="button" class="bo-btn bo-btn--or" disabled title="Plus tard"><i class="fas fa-plus"></i> Créer un affilié</button></div>
      ${avenir([['Un lien par membre', 'Un membre qui parle de vous reçoit un lien personnel vers le questionnaire.'], ['La trace', 'Chaque candidature venue de ce lien lui est attribuée, et vous en êtes notifiés.'], ['Les retombées', 'Par affilié : candidatures, inscrits, ventes.']])}<p class="bo-source">Jamais utilisé sur LearnyBox ; à faire quand vous le déciderez.</p></div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modele]');
    if (b) dire('L éditeur de mails arrive avec le lot Marketing : le modèle est prêt, pas encore l envoi.');
  });

  /* ══ VENTES · OFFRES ═══════════════════════════════════════════════════════ */
  let _offreOuverte = null;
  let _offreOnglet = 'resume';
  const cleOffre = (t) => t.formulaire || t.produit || 'Sans offre';
  function offresDepuis(tx) {
    const parOffre = new Map();
    for (const t of tx) {
      if (t.etat !== 'Valide') continue;
      const k = cleOffre(t);
      if (!parOffre.has(k)) parOffre.set(k, { nom: k, tx: [], produits: new Set(), clients: new Set(), types: new Set() });
      const o = parOffre.get(k);
      o.tx.push(t); o.produits.add(t.produit || ''); o.clients.add(t.learnybox_id || String(t.email).toLowerCase()); o.types.add(t.type_paiement || '');
    }
    return [...parOffre.values()].map((o) => ({ ...o, montant: o.tx.reduce((s, t) => s + Number(t.montant || 0), 0), premiere: o.tx[o.tx.length - 1].date_transaction, derniere: o.tx[0].date_transaction })).sort((a, b) => b.montant - a.montant);
  }
  CHARGEURS['ventes/offres'] = async () => {
    const z = $('boOffres');
    const tx = await lire('transactions', () => BO('transactions'));
    const offres = offresDepuis(tx);
    if (_offreOuverte) {
      const o = offres.find((x) => x.nom === _offreOuverte);
      if (o) { z.innerHTML = pageOffre(o); return; }
      _offreOuverte = null;
    }
    z.innerHTML = `<div class="bo-carte">
      <div class="bo-carte__tete"><h2><b>${offres.length}</b> Offres</h2><button type="button" class="bo-btn bo-btn--or" disabled title="Avec les clés Stripe, lot Ventes"><i class="fas fa-plus"></i> Créer une offre</button></div>
      <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Nom</th><th>État</th><th class="num">Produits</th><th class="num">Clients</th><th class="num">Transactions</th><th class="num">Montant total</th><th>Première vente</th><th>Dernière vente</th><th></th></tr></thead><tbody>
        ${offres.map((o) => `<tr><td><b>${txt(o.nom)}</b><br><small style="color:var(--text-soft)">${[...o.types].filter(Boolean).map(txt).join(' · ')}</small></td><td><span class="bo-pill bo-pill--ok">Importée</span></td><td class="num">${o.produits.size}</td><td class="num">${o.clients.size}</td><td class="num">${o.tx.length}</td><td class="num"><b>${eur(o.montant)}</b></td><td>${txt(dateFr(o.premiere))}</td><td>${txt(dateFr(o.derniere))}</td><td><button type="button" class="bo-oeil" data-offre="${txt(o.nom)}" title="Ouvrir l offre">&#128065;</button></td></tr>`).join('')}
      </tbody></table></div>
      <p class="bo-source">Offres reconstituées depuis les 111 transactions LearnyBox (une offre = un formulaire de paiement). Créer une offre, l'encaisser par Stripe ou par virement, poser des bons de réduction : lot Ventes, dès que les clés Stripe sont dans Vercel.</p></div>`;
  };
  function pageOffre(o) {
    const ONGLETS = [['resume', 'Résumé'], ['statistiques', 'Statistiques'], ['produits', 'Produits'], ['paiement', 'Moyens de paiement'], ['clients', 'Clients'], ['ventes', 'Ventes'], ['paniers', 'Abandons de panier'], ['bons', 'Bons de réduction'], ['parametres', 'Paramètres']];
    const ht = o.tx.reduce((s, t) => s + Number(t.montant_ht || 0), 0);
    const nouveaux = o.tx.filter((t) => t.nouveau_client).length;
    const panier = o.clients.size ? o.montant / o.clients.size : 0;
    const parMois = new Map(); o.tx.forEach((t) => { const m = String(t.date_transaction || '').slice(0, 7); parMois.set(m, (parMois.get(m) || 0) + Number(t.montant || 0)); });
    const mois = [...parMois.keys()].sort();
    const clients = new Map(); o.tx.forEach((t) => { const k = t.learnybox_id || String(t.email).toLowerCase(); if (!clients.has(k)) clients.set(k, { email: t.email, id: t.learnybox_id, n: 0, montant: 0, premiere: t.date_transaction, derniere: t.date_transaction }); const c = clients.get(k); c.n += 1; c.montant += Number(t.montant || 0); if (t.date_transaction < c.premiere) c.premiere = t.date_transaction; if (t.date_transaction > c.derniere) c.derniere = t.date_transaction; });
    const produits = new Map(); o.tx.forEach((t) => { const k = t.produit || ''; if (!produits.has(k)) produits.set(k, { n: 0, montant: 0, prix: new Set() }); const p = produits.get(k); p.n += 1; p.montant += Number(t.montant || 0); p.prix.add(Number(t.montant || 0)); });
    const types = new Map(); o.tx.forEach((t) => { const k = t.type_paiement || ''; if (!types.has(k)) types.set(k, { n: 0, montant: 0, echeances: new Set() }); const p = types.get(k); p.n += 1; p.montant += Number(t.montant || 0); if (t.total_paiements) p.echeances.add(t.total_paiements); });
    let corps = '';
    if (_offreOnglet === 'resume') corps = `<div class="bo-grille-3"><div>
        <div class="bo-carte"><h2>Produits <small>${produits.size}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Produit</th><th>État</th><th class="num">Prix vus</th><th class="num">Ventes</th></tr></thead><tbody>${[...produits.entries()].map(([k, p]) => `<tr><td><b>${txt(k)}</b></td><td><span class="bo-pill bo-pill--ok">Activé</span></td><td class="num">${[...p.prix].sort((a, b) => a - b).map(eur).join(', ')}</td><td class="num">${p.n}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="bo-carte"><h2>Moyens de paiement <small>${types.size}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Moyen</th><th>Échéances</th><th class="num">Transactions</th><th class="num">Montant</th></tr></thead><tbody>${[...types.entries()].map(([k, p]) => `<tr><td><b>${txt(k || 'inconnu')}</b></td><td>${[...p.echeances].length ? [...p.echeances].map((n) => `${n} fois`).join(', ') : 'comptant'}</td><td class="num">${p.n}</td><td class="num">${eur(p.montant)}</td></tr>`).join('')}</tbody></table></div></div>
      </div><div>
        <div class="bo-kpi" style="margin-bottom:14px"><div class="bo-kpi__k">État</div><div><span class="bo-pill bo-pill--ok">Importée de LearnyBox</span></div></div>
        <div class="bo-kpi" style="margin-bottom:14px"><div class="bo-kpi__ic"><i class="fas fa-chart-line"></i></div><div class="bo-kpi__k">CA total réalisé par l offre</div><div class="bo-kpi__v">${eur(o.montant)}</div><div class="bo-kpi__s">${eur(ht)} HT</div></div>
        <div class="bo-kpi"><div class="bo-kpi__k">Clients</div><div class="bo-kpi__v">${o.clients.size}</div><div class="bo-kpi__s">${o.tx.length} transactions · panier moyen ${eur(panier)}</div></div>
      </div></div>`;
    else if (_offreOnglet === 'statistiques') corps = `<div class="bo-kpis">${kpi('fa-users', 'Clients', nb(o.clients.size), `${nb(nouveaux)} nouveaux clients`)}${kpi('fa-receipt', 'Transactions', nb(o.tx.length), 'valides')}${kpi('fa-shopping-basket', 'Panier moyen', eur(panier), 'par client')}${kpi('fa-percent', 'Taux de conversion', '·', 'les prospects (visites de la page) ne sont pas suivis : viendra avec les tunnels')}${kpi('fa-exclamation-triangle', 'Erreurs de paiement', '·', 'non suivies par LearnyBox dans l export')}</div>
      <div class="bo-carte"><h2>Montant par mois</h2><div class="bo-graph"><canvas id="gOffre"></canvas></div></div>`;
    else if (_offreOnglet === 'produits') corps = `<div class="bo-carte"><div class="bo-carte__tete"><h2>Produits <small>${produits.size}</small></h2><button type="button" class="bo-btn bo-btn--fantome" disabled>Ajouter un produit</button></div><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Produit</th><th>État</th><th class="num">Prix vus</th><th>Accès donné</th><th>Obligatoire</th></tr></thead><tbody>${[...produits.entries()].map(([k, p]) => `<tr><td><b>${txt(k)}</b></td><td><span class="bo-pill bo-pill--ok">Activé</span></td><td class="num">${[...p.prix].sort((a, b) => a - b).map(eur).join(', ')}</td><td>Formation Trader 360</td><td>Oui</td></tr>`).join('')}</tbody></table></div><p class="bo-source">Modifier un produit ou en ajouter : lot Ventes.</p></div>`;
    else if (_offreOnglet === 'paiement') corps = `<div class="bo-carte"><div class="bo-carte__tete"><h2>Moyens de paiement</h2><button type="button" class="bo-btn bo-btn--fantome" disabled title="Avec les clés Stripe">Ajouter un moyen de paiement</button></div><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Moyen</th><th>Échéances</th><th class="num">Transactions</th><th class="num">Montant</th><th>État</th></tr></thead><tbody>${[...types.entries()].map(([k, p]) => `<tr><td><b>${txt(k || 'inconnu')}</b></td><td>${[...p.echeances].length ? [...p.echeances].map((n) => `${n} fois`).join(', ') : 'comptant'}</td><td class="num">${p.n}</td><td class="num">${eur(p.montant)}</td><td><span class="bo-pill bo-pill--ok">Vu dans l export</span></td></tr>`).join('')}</tbody></table></div><p class="bo-source">À venir : Stripe (comptant et en plusieurs fois) avec vos clés, virement avec alerte et activation à la main.</p></div>`;
    else if (_offreOnglet === 'clients') corps = `<div class="bo-carte"><h2>Clients <small>${clients.size}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Client</th><th class="num">Transactions</th><th class="num">Montant</th><th>Première</th><th>Dernière</th><th></th></tr></thead><tbody>${[...clients.values()].sort((a, b) => b.montant - a.montant).map((c) => `<tr><td>${txt(c.email)}</td><td class="num">${c.n}</td><td class="num">${eur(c.montant)}</td><td>${txt(dateFr(c.premiere))}</td><td>${txt(dateFr(c.derniere))}</td><td><a class="bo-oeil" href="#/academie/membres?fiche=${encodeURIComponent(c.email)}" title="Fiche membre">&#128065;</a></td></tr>`).join('')}</tbody></table></div></div>`;
    else if (_offreOnglet === 'ventes') corps = tableTransactions(o.tx);
    else if (_offreOnglet === 'paniers') corps = `<div class="bo-carte"><h2>Abandons de panier</h2><p class="bo-vide">Non suivis pour l instant : l export LearnyBox ne porte que les transactions validées. Les paniers abandonnés se suivront avec les tunnels et Stripe.</p></div>`;
    else if (_offreOnglet === 'bons') corps = `<div class="bo-carte"><div class="bo-carte__tete"><h2>Bons de réduction</h2><button type="button" class="bo-btn bo-btn--fantome" disabled>Créer un bon</button></div><p class="bo-vide">Aucun bon. La création (code, montant ou pourcentage, dates, nombre d utilisations) vient avec le lot Ventes.</p></div>`;
    else corps = `<div class="bo-carte"><h2>Paramètres</h2><div class="am-creer__grille"><label>Nom de l offre <input value="${txt(o.nom)}" disabled></label><label>Lien d accès direct <input value="à venir avec le tunnel" disabled></label></div><p class="bo-source">Modifiables au lot Ventes.</p></div>`;
    return `<div class="am-fiche__tete"><button type="button" class="bo-btn bo-btn--fantome" data-offre-retour>&larr; Retour aux offres</button><span class="am-fiche__fil">Ventes · Offre</span></div>
      <div class="bo-tete"><h1>${txt(o.nom)}</h1><p>${o.tx.length} transactions · ${o.clients.size} clients · ${eur(o.montant)}</p></div>
      <nav class="am-onglets">${ONGLETS.map(([k, t]) => `<button type="button" data-offre-onglet="${k}" aria-selected="${_offreOnglet === k}">${t}</button>`).join('')}</nav>${corps}`;
  }
  function tableTransactions(tx, titre) {
    return `<div class="bo-carte"><h2>${titre || 'Ventes'} <small>${tx.length}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Date</th><th>Client</th><th>Produit</th><th>Moyen</th><th>Échéance</th><th class="num">Montant</th><th>État</th><th>Facture</th></tr></thead><tbody>
      ${tx.map((t) => `<tr><td>${txt(dateFr(t.date_transaction, true))}</td><td>${txt(t.email)}</td><td>${txt(t.produit)}</td><td>${txt(t.type_paiement)}</td><td>${t.total_paiements ? `${t.numero_paiement} / ${t.total_paiements}` : 'comptant'}</td><td class="num"><b>${eur(t.montant)}</b><br><small style="color:var(--text-soft)">${eur(t.montant_ht)} HT</small></td><td><span class="bo-pill ${t.etat === 'Valide' ? 'bo-pill--ok' : 'bo-pill--non'}">${txt(t.etat)}</span></td><td>${t.facture ? `n° ${txt(t.facture)}` : '<span style="color:var(--text-disabled)">·</span>'}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-offre], [data-offre-retour], [data-offre-onglet]');
    if (!b) return;
    if (b.dataset.offre) { _offreOuverte = b.dataset.offre; _offreOnglet = 'resume'; }
    if (b.hasAttribute('data-offre-retour')) _offreOuverte = null;
    if (b.dataset.offreOnglet) _offreOnglet = b.dataset.offreOnglet;
    CHARGEURS['ventes/offres']().then(() => {
      if (_offreOuverte && _offreOnglet === 'statistiques') {
        const tx = _cache.get('transactions') || [];
        const o = offresDepuis(tx).find((x) => x.nom === _offreOuverte);
        if (!o) return;
        const parMois = new Map(); o.tx.forEach((t) => { const m = String(t.date_transaction || '').slice(0, 7); parMois.set(m, (parMois.get(m) || 0) + Number(t.montant || 0)); });
        const mois = [...parMois.keys()].sort();
        graph('gOffre', { type: 'bar', data: { labels: mois.map(moisFr), datasets: [{ data: mois.map((m) => parMois.get(m)), backgroundColor: 'rgba(232,184,75,.75)', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes() } });
      }
      window.scrollTo({ top: 0 });
    });
  });

  /* ══ VENTES · COMMANDES & FACTURES ═════════════════════════════════════════ */
  let _cmdOnglet = 'tableau';
  CHARGEURS['ventes/commandes'] = async () => {
    const z = $('boCommandes');
    const [v, tx] = await Promise.all([lire('ventes', () => BO('ventes')), lire('transactions', () => BO('transactions'))]);
    const ONGLETS = [['tableau', 'Tableau de bord'], ['statistiques', 'Statistiques'], ['transactions', 'Transactions'], ['abonnements', 'Abonnements'], ['factures', 'Factures']];
    let corps = '';
    if (_cmdOnglet === 'tableau') corps = `<div class="bo-kpis">
        ${kpi('fa-coins', 'Montant total', eur(v.total), `${nb(v.nb)} transactions · ${eur(v.total_ht)} HT`)}
        ${kpi('fa-calendar', 'Année en cours', eur(v.annee.montant), `${nb(v.annee.nb)} transactions`, String(v.annee.annee))}
        ${kpi('fa-calendar-minus', 'Année précédente', eur(v.annee_precedente.montant), `${nb(v.annee_precedente.nb)} transactions`, String(v.annee_precedente.annee))}
        ${kpi('fa-calendar-day', 'Mois en cours', eur(v.mois.montant), `${nb(v.mois.nb)} transactions`, moisFr(v.mois.mois))}
        ${kpi('fa-calendar-check', 'Mois précédent', eur(v.mois_precedent.montant), `${nb(v.mois_precedent.nb)} transactions`, moisFr(v.mois_precedent.mois))}
        ${kpi('fa-hourglass-half', 'Restant à percevoir', eur(v.restant_a_percevoir), `${nb(v.abonnements_en_cours)} échéancier${v.abonnements_en_cours > 1 ? 's' : ''} en cours`, 'paiements en plusieurs fois')}
      </div>
      <div class="bo-carte"><h2>Statistiques <small>par mois</small></h2><div class="bo-graph" style="height:340px"><canvas id="gVentes"></canvas></div>
        <div class="bo-legende"><span style="--c:${OR}">Montant total</span><span style="--c:${OR2}">Transactions valides</span><span style="--c:${GRIS}">Nouveaux clients</span></div></div>`;
    else if (_cmdOnglet === 'statistiques') corps = `<div class="bo-grille-2">
        <div class="bo-carte"><h2>Par moyen de paiement</h2><div class="bo-graph bo-graph--petit"><canvas id="gTypes"></canvas></div></div>
        <div class="bo-carte"><h2>Par offre</h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Offre</th><th class="num">Clients</th><th class="num">Transactions</th><th class="num">Montant</th></tr></thead><tbody>${(v.par_offre || []).map((o) => `<tr><td>${txt(o.offre)}</td><td class="num">${o.clients}</td><td class="num">${o.nb}</td><td class="num"><b>${eur(o.montant)}</b></td></tr>`).join('')}</tbody></table></div></div>
      </div>`;
    else if (_cmdOnglet === 'transactions') corps = tableTransactions(tx, 'Transactions');
    else if (_cmdOnglet === 'abonnements') {
      const ab = new Map(); tx.filter((t) => t.abonnement).forEach((t) => { if (!ab.has(t.abonnement)) ab.set(t.abonnement, []); ab.get(t.abonnement).push(t); });
      const lignes = [...ab.entries()].map(([k, l]) => { l.sort((a, b) => String(a.date_transaction).localeCompare(String(b.date_transaction))); const d = l[l.length - 1]; return { k, email: d.email, produit: d.produit, paye: l.length, total: d.total_paiements, restants: d.paiements_restants, montant: l.reduce((s, t) => s + Number(t.montant || 0), 0), echeance: Number(d.montant || 0), derniere: d.date_transaction }; });
      corps = `<div class="bo-carte"><h2>Paiements en plusieurs fois <small>${lignes.length}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Client</th><th>Produit</th><th>Échéances</th><th class="num">Payé</th><th class="num">Reste</th><th>Dernière échéance</th><th>État</th></tr></thead><tbody>${lignes.sort((a, b) => b.restants - a.restants).map((l) => `<tr><td>${txt(l.email)}</td><td>${txt(l.produit)}</td><td>${l.paye} / ${l.total}</td><td class="num">${eur(l.montant)}</td><td class="num">${eur(l.echeance * l.restants)}</td><td>${txt(dateFr(l.derniere))}</td><td><span class="bo-pill ${l.restants > 0 ? '' : 'bo-pill--ok'}">${l.restants > 0 ? `${l.restants} restante${l.restants > 1 ? 's' : ''}` : 'Soldé'}</span></td></tr>`).join('')}</tbody></table></div><p class="bo-source">Reconstitué depuis les transactions : une ligne par abonnement LearnyBox.</p></div>`;
    } else corps = `<div class="bo-carte"><h2>Factures <small>${tx.filter((t) => t.facture).length}</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Produit</th><th class="num">HT</th><th class="num">TVA</th><th class="num">TTC</th><th></th></tr></thead><tbody>${tx.filter((t) => t.facture).sort((a, b) => Number(b.facture) - Number(a.facture)).map((t) => `<tr><td><b>${txt(t.facture)}</b></td><td>${txt(dateFr(t.date_transaction))}</td><td>${txt(t.email)}</td><td>${txt(t.produit)}</td><td class="num">${eur(t.montant_ht)}</td><td class="num">${eur(t.montant_tva)}</td><td class="num"><b>${eur(t.montant)}</b></td><td><button type="button" class="bo-btn bo-btn--fantome" disabled title="Le PDF vient avec le lot facturation (Qonto / Pennylane à voir avec Manu)">PDF</button></td></tr>`).join('')}</tbody></table></div><p class="bo-source">Numéros de facture LearnyBox tels qu'exportés ; ${tx.filter((t) => !t.facture).length} transactions n'en portent pas dans l'export. Revoir une facture et la télécharger en PDF : lot facturation.</p></div>`;
    z.innerHTML = `<nav class="am-onglets">${ONGLETS.map(([k, t]) => `<button type="button" data-cmd-onglet="${k}" aria-selected="${_cmdOnglet === k}">${t}</button>`).join('')}</nav>${corps}`;
    if (_cmdOnglet === 'tableau') {
      const pm = v.par_mois || [];
      graph('gVentes', { type: 'bar', data: { labels: pm.map((x) => moisFr(x.mois)), datasets: [
        { label: 'Montant total', data: pm.map((x) => Number(x.montant)), backgroundColor: 'rgba(232,184,75,.7)', borderRadius: 8, yAxisID: 'y' },
        { label: 'Transactions valides', data: pm.map((x) => Number(x.nb)), type: 'line', borderColor: OR2, backgroundColor: OR2, tension: .4, pointRadius: 3, yAxisID: 'y2' },
        { label: 'Nouveaux clients', data: pm.map((x) => Number(x.nouveaux)), type: 'line', borderColor: GRIS, backgroundColor: GRIS, tension: .4, pointRadius: 3, yAxisID: 'y2' },
      ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.dataset.yAxisID === 'y' ? ` ${eur(c.parsed.y)}` : ` ${c.dataset.label} : ${c.parsed.y}` } } }, scales: { ...axes({ ticks: { color: GRIS, callback: (val) => `${Math.round(val / 1000)}k` } }), y2: { position: 'right', grid: { display: false }, ticks: { color: GRIS, precision: 0 }, beginAtZero: true } } } });
    }
    if (_cmdOnglet === 'statistiques') {
      const pt = v.par_type || [];
      graph('gTypes', { type: 'doughnut', data: { labels: pt.map((x) => x.type), datasets: [{ data: pt.map((x) => Number(x.montant)), backgroundColor: [OR, OR2, ORD, GRIS, C().VIDE], borderColor: C().FOND, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'right', labels: { color: GRIS } }, tooltip: { callbacks: { label: (c) => ` ${c.label} : ${eur(c.parsed)}` } } } } });
    }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd-onglet]');
    if (!b) return;
    _cmdOnglet = b.dataset.cmdOnglet;
    CHARGEURS['ventes/commandes']();
  });

  /* ══ VENTES · COMPTABILITE (le classeur BUDGET, lecture seule) ══════════════ */
  let _cptOnglet = 'livre';
  const _cptFiltre = { q: '', categorie: '', via: '', mois: '', qui: '', type: '', special: '' };
  // Les cartes du haut menent au grand livre deja filtre (Nadir, 15/10 : « quand
  // on clique sur le cadre, ca nous amene sur la liste »).
  const FILTRES_CARTES = {
    entrees: { type: 'entrees', libelle: 'Toutes les entrées' },
    depenses: { type: 'depenses', libelle: 'Toutes les dépenses' },
    gln: { special: 'gln', libelle: 'Avancé par GLN' },
    compte_courant: { special: 'compte_courant', libelle: 'Compte courant de Manu' },
    justificatifs: { special: 'justificatifs', libelle: 'Justificatifs manquants' },
    tva_collectee: { type: 'entrees', libelle: 'Entrées avec TVA collectée' },
    is: { type: 'depenses', libelle: 'Dépenses avec gain d IS' },
    ambassadeurs: { special: 'ambassadeurs', libelle: 'Commissions ambassadeurs' },
    voiture: { special: 'voiture', libelle: 'Voiture' },
  };
  function poserFiltreCarte(cle) {
    const f = FILTRES_CARTES[cle];
    if (!f) return;
    Object.assign(_cptFiltre, { q: '', categorie: '', via: '', mois: '', qui: '', type: f.type || '', special: f.special || '' });
    _cptOnglet = 'livre';
  }
  const passeSpecial = (l) => {
    switch (_cptFiltre.special) {
      case 'gln': return avanceGln(l);
      case 'compte_courant': return compteCourant(l);
      case 'justificatifs': return /manquant/i.test(l.justificatif || '');
      case 'ambassadeurs': return /ambassad|commission/i.test(`${l.categorie} ${l.designation}`);
      case 'voiture': return voiture(l);
      default: return true;
    }
  };
  // Les colonnes MAN / NAD / GUI / SIE du classeur : qui est a l origine de la ligne.
  // ⚠️ Les codes sont ceux du classeur ; SIE est garde tel quel (non interprete).
  const QUI = [['man', 'MAN', 'Manu'], ['nad', 'NAD', 'Nadir'], ['gui', 'GUI', 'Guillaume'], ['sie', 'SIE', 'SIE']];
  const quiDe = (l) => QUI.filter(([k]) => l[k]).map(([, code]) => code);
  /**
   * ── ⚠️ CE QUI COMPTE, ET CE QUI NE COMPTE PAS (Nadir, 15/10) ─────────────
   * - « Capital / compte courant » n est ni une entree ni une depense : c est
   *   de l argent de Manu qui entre et qui ressort (les 40 k remis). Le classeur
   *   fait pareil (« hors compte courant »). Exclu de tous les totaux.
   * - GLN est la societe de Manu : une ligne « payee via GLN » est une depense
   *   de Trader 360 AVANCEE par GLN ; « REMB GLN = Oui » dit qu elle lui est due.
   * - La voiture est du cote de Manu : son amortissement vit dans son bloc.
   * - Le gain d IS d une depense = sa part HT x le taux d IS du classeur (25 %).
   *   Estimation maison, comme le classeur le dit lui-meme.
   */
  const compteCourant = (l) => /capital|compte courant/i.test(l.categorie || '');
  // La voiture (BYD ATTO 3) : achetee par la societe et amortie dans ses comptes,
  // mais a la charge de Manu (Nadir, 15/10). C est un investissement, pas une
  // charge du mois : hors des depenses, des coachs et du previsionnel ; elle vit
  // dans l onglet Vehicule avec son amortissement et la part de Manu.
  const voiture = (l) => /byd|atto/i.test(`${l.designation} ${l.remarque}`) || /v[ée]hicule|voiture|immobilisation|investissement/i.test(l.categorie || '');
  const horsTotaux = (l) => compteCourant(l) || voiture(l);
  const avanceGln = (l) => /^gln$/i.test(l.via || '');
  const duAGln = (l) => avanceGln(l) && /^oui$/i.test(l.remb_gln || '');
  const TAUX_IS = 0.25;
  const htDe = (l) => { if (!l.depense) return 0; const tva = l.tva_recuperee != null ? l.tva_recuperee : (/^oui$/i.test(l.tva_recuperable || '') && l.tva_facture != null ? l.tva_facture : 0); return Math.max(0, l.depense - tva); };
  const gainIs = (l) => (horsTotaux(l) ? 0 : htDe(l) * TAUX_IS);
  const depenseDe = (l) => (horsTotaux(l) ? 0 : (l.depense || 0));
  const entreeDe = (l) => (horsTotaux(l) ? 0 : (l.entree || 0));
  CHARGEURS['ventes/comptabilite'] = async () => {
    const z = $('boCompta');
    let c;
    try { c = await lire('comptabilite', () => BO('comptabilite')); }
    catch (e) {
      z.innerHTML = `<div class="bo-carte"><h2>Le classeur n a pas pu être lu</h2><p class="bo-erreur">${txt(e.message)}</p><p class="bo-source">Le back-office lit le classeur « BUDGET TRADER 360 · V2 » avec le compte de service déjà utilisé pour le suivi membres du tableur. Il doit être ajouté en « Lecteur » sur ce classeur (Partager, puis l adresse du compte de service, celle qui finit par iam.gserviceaccount.com, visible dans le partage du tableur membres).</p></div>`;
      return;
    }
    const livre = c.livre || [];
    const autres = (c.onglets || []).filter((o) => !/^budget$/i.test(o.titre));
    const ONGLETS = [['livre', 'Grand livre'], ['coachs', 'Par coach'], ['mois', 'Par mois'], ['categories', 'Par catégorie'], ['previsionnel', 'Prévisionnel'], ['is', 'IS estimé'], ['vehicule', 'Véhicule'], ...autres.map((o) => [`feuille:${o.gid}`, o.titre])];
    const entrees = livre.reduce((s, l) => s + entreeDe(l), 0);
    const depenses = livre.reduce((s, l) => s + depenseDe(l), 0);
    const gainIsTotal = livre.reduce((s, l) => s + gainIs(l), 0);
    const avanceGlnTotal = livre.filter(avanceGln).reduce((s, l) => s + depenseDe(l), 0);
    const duGlnTotal = livre.filter(duAGln).reduce((s, l) => s + depenseDe(l), 0);
    const compteCourantEntrees = livre.filter(compteCourant).reduce((s, l) => s + (l.entree || 0), 0);
    const compteCourantSorties = livre.filter(compteCourant).reduce((s, l) => s + (l.depense || 0), 0);
    const synth = (c.synthese || []);
    const trouve = (re) => synth.find((x) => re.test(x.libelle));
    const kpis = [
      ['fa-arrow-down', 'Entrées totales', trouve(/^Entrées totales/i), 'hors compte courant', 'entrees'],
      ['fa-arrow-up', 'Dépenses totales', trouve(/^Dépenses totales/i), 'hors compte courant', 'depenses'],
      ['fa-university', 'Solde réel Qonto', trouve(/^Solde réel Qonto/i), (trouve(/^Écart/i) || {}).valeur ? `écart ${trouve(/^Écart/i).valeur}` : '', 'mois'],
      ['fa-wallet', 'Cash réellement disponible', trouve(/^Cash réellement/i), 'après IS, TVA, dette GLN, frais fixes', 'previsionnel'],
      ['fa-percent', 'TVA collectée', trouve(/^TVA collectée/i), (trouve(/^TVA déjà reversée/i) || {}).valeur ? `reversée ${trouve(/^TVA déjà reversée/i).valeur}` : '', 'tva_collectee'],
      ['fa-undo', 'Reste à reverser', trouve(/^Reste à reverser/i), (trouve(/^TVA récupérable/i) || {}).valeur ? `TVA récupérable ${trouve(/^TVA récupérable/i).valeur}` : '', 'is_onglet'],
      ['fa-handshake', 'Commissions ambassadeurs', trouve(/^Commissions ambassadeurs/i), 'à devoir, HT', 'ambassadeurs'],
      ['fa-file-alt', 'Justificatifs manquants', trouve(/^Justificatifs manquants/i), 'lignes sans pièce', 'justificatifs'],
      ['fa-building', 'Avancé par GLN', { valeur: eur(avanceGlnTotal) }, `société de Manu · ${eur(duGlnTotal)} à lui rembourser`, 'gln'],
      ['fa-exchange-alt', 'Compte courant de Manu', { valeur: eur(compteCourantEntrees - compteCourantSorties) }, `${eur(compteCourantEntrees)} apportés · ${eur(compteCourantSorties)} remis · hors des totaux`, 'compte_courant'],
      ['fa-piggy-bank', 'Gain d IS estimé', { valeur: eur(gainIsTotal) }, `${Math.round(TAUX_IS * 100)} % des dépenses HT déductibles`, 'is'],
    ].filter((k) => k[2]);
    let corps = '';
    if (_cptOnglet === 'livre') {
      const categories = [...new Set(livre.map((l) => l.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
      const vias = [...new Set(livre.map((l) => l.via).filter(Boolean))].sort();
      const moisListe = [...new Set(livre.map((l) => l.date.slice(0, 7)))].sort().reverse();
      const q = _cptFiltre.q.trim().toLowerCase();
      const visibles = livre.filter((l) => (!q || `${l.designation} ${l.categorie} ${l.remarque} ${l.projet}`.toLowerCase().includes(q)) && (!_cptFiltre.categorie || l.categorie === _cptFiltre.categorie) && (!_cptFiltre.via || l.via === _cptFiltre.via) && (!_cptFiltre.mois || l.date.startsWith(_cptFiltre.mois)) && (!_cptFiltre.qui || (_cptFiltre.qui === 'aucun' ? !quiDe(l).length : l[_cptFiltre.qui])) && (!_cptFiltre.type || (_cptFiltre.type === 'entrees' ? l.entree != null : l.depense != null)) && passeSpecial(l)).sort((a, b) => b.date.localeCompare(a.date));
      const tE = visibles.reduce((s, l) => s + entreeDe(l), 0), tD = visibles.reduce((s, l) => s + depenseDe(l), 0), tIs = visibles.reduce((s, l) => s + gainIs(l), 0);
      const qui = (l) => quiDe(l).join(' ');
      corps = `<div class="bo-carte">
        <div class="bo-carte__tete"><h2><b>${nb(visibles.length)}</b> Ligne${visibles.length > 1 ? 's' : ''} <small>${eur(tE)} d entrées · ${eur(tD)} de dépenses · ${eur(tIs)} de gain d IS (hors compte courant)</small></h2>
          <div class="am-outils" style="margin:0">
            <input type="search" class="am-recherche" style="flex:1 1 200px" placeholder="Rechercher une désignation…" data-cpt-q value="${txt(_cptFiltre.q)}">
            <select class="bo-select" data-cpt-categorie><option value="">Toutes les catégories</option>${categories.map((x) => `<option ${_cptFiltre.categorie === x ? 'selected' : ''}>${txt(x)}</option>`).join('')}</select>
            <select class="bo-select" data-cpt-via><option value="">Payé via</option>${vias.map((x) => `<option ${_cptFiltre.via === x ? 'selected' : ''}>${txt(x)}</option>`).join('')}</select>
            <select class="bo-select" data-cpt-mois><option value="">Tous les mois</option>${moisListe.map((x) => `<option value="${x}" ${_cptFiltre.mois === x ? 'selected' : ''}>${txt(moisFr(x))}</option>`).join('')}</select>
            <select class="bo-select" data-cpt-type><option value="">Entrées et dépenses</option><option value="entrees" ${_cptFiltre.type === 'entrees' ? 'selected' : ''}>Entrées seulement</option><option value="depenses" ${_cptFiltre.type === 'depenses' ? 'selected' : ''}>Dépenses seulement</option></select>
            ${_cptFiltre.special ? `<button type="button" class="bo-btn bo-btn--fantome" data-cpt-special-off title="Retirer ce filtre">${txt((Object.values(FILTRES_CARTES).find((x) => x.special === _cptFiltre.special) || {}).libelle || _cptFiltre.special)} &times;</button>` : ''}
            <select class="bo-select" data-cpt-qui><option value="">Qui</option>${QUI.map(([k, code, nom]) => `<option value="${k}" ${_cptFiltre.qui === k ? 'selected' : ''}>${nom}${nom !== code ? ` (${code})` : ''}</option>`).join('')}<option value="aucun" ${_cptFiltre.qui === 'aucun' ? 'selected' : ''}>Personne de coché</option></select>
          </div></div>
        <div class="bo-enveloppe"><table class="bo-table bo-table--compact"><thead><tr><th>Date</th><th>Désignation</th><th>Catégorie</th><th>Via</th><th class="num">Entrée</th><th class="num">Dépense</th><th class="num">TVA</th><th class="num">Gain IS</th><th>Qui</th><th>Justificatif</th><th>Remarque</th></tr></thead><tbody>
          ${visibles.map((l) => `<tr class="${horsTotaux(l) ? 'bo-ligne--neutre' : ''}"><td class="mono" style="white-space:nowrap">${txt(l.date.split('-').reverse().join('/'))}</td><td><b>${txt(l.designation)}</b>${l.projet ? `<br><small style="color:var(--text-soft)">${txt(l.projet)}</small>` : ''}${compteCourant(l) ? '<br><small style="color:var(--text-soft)">compte courant, hors totaux</small>' : voiture(l) ? '<br><small style="color:var(--text-soft)">voiture, côté Manu, hors totaux (voir Véhicule)</small>' : ''}</td><td>${txt(l.categorie)}</td><td>${avanceGln(l) ? `<span class="bo-pill" title="Avancé par GLN, la société de Manu">GLN${duAGln(l) ? ' · à rembourser' : ''}</span>` : txt(l.via)}</td><td class="num" style="color:var(--gold)">${l.entree != null ? eur(l.entree) : ''}</td><td class="num">${l.depense != null ? eur(l.depense) : ''}</td><td class="num"><small>${l.tva_collectee != null ? `coll. ${eur(l.tva_collectee)}` : l.tva_facture != null ? `fact. ${eur(l.tva_facture)}` : txt(l.tva_recuperable)}</small></td><td class="num"><small>${gainIs(l) ? eur(gainIs(l)) : ''}</small></td><td><small>${txt(qui(l))}</small></td><td><span class="bo-pill ${/manquant/i.test(l.justificatif) ? 'bo-pill--non' : 'bo-pill--ok'}">${txt(l.justificatif || '·')}</span></td><td><small style="color:var(--text-soft)">${txt(l.remarque)}</small></td></tr>`).join('')}
        </tbody></table></div></div>`;
    } else if (_cptOnglet === 'coachs') {
      const parQui = QUI.map(([k, code, nom]) => {
        const lignes = livre.filter((l) => l[k] && !horsTotaux(l));
        const dep = lignes.reduce((s, l) => s + depenseDe(l), 0), ent = lignes.reduce((s, l) => s + entreeDe(l), 0);
        const is = lignes.reduce((s, l) => s + gainIs(l), 0);
        const gln = lignes.filter(avanceGln).reduce((s, l) => s + depenseDe(l), 0);
        const remb = lignes.filter(duAGln).reduce((s, l) => s + depenseDe(l), 0);
        const cats = new Map(); lignes.forEach((l) => { const c = l.categorie || 'Sans catégorie'; const x = cats.get(c) || { dep: 0, is: 0 }; x.dep += depenseDe(l); x.is += gainIs(l); cats.set(c, x); });
        const vias = new Map(); lignes.forEach((l) => { const v = avanceGln(l) ? 'GLN (société de Manu)' : (l.via || '·'); vias.set(v, (vias.get(v) || 0) + depenseDe(l)); });
        const justifManquants = lignes.filter((l) => /manquant/i.test(l.justificatif)).length;
        return { k, code, nom, lignes, dep, ent, is, gln, remb, cats: [...cats.entries()].sort((a, b) => b[1].dep - a[1].dep), vias: [...vias.entries()].sort((a, b) => b[1] - a[1]), justifManquants };
      });
      const sansQui = livre.filter((l) => !quiDe(l).length && !horsTotaux(l));
      const totalDep = depenses;
      corps = `<div class="bo-kpis">${parQui.map((p) => kpi('fa-user', p.nom, eur(p.dep), `${nb(p.lignes.length)} ligne${p.lignes.length > 1 ? 's' : ''} · ${totalDep ? Math.round(p.dep / totalDep * 100) : 0} % des dépenses · gain d IS ${eur(p.is)}${p.remb ? ` · ${eur(p.remb)} dus à GLN` : ''}${p.justifManquants ? ` · ${p.justifManquants} justificatif${p.justifManquants > 1 ? 's' : ''} manquant${p.justifManquants > 1 ? 's' : ''}` : ''}`, p.code !== p.nom ? p.code : '')).join('')}${kpi('fa-question', 'Personne de coché', eur(sansQui.reduce((s, l) => s + depenseDe(l), 0)), `${nb(sansQui.length)} lignes sans MAN / NAD / GUI / SIE`)}</div>
        <div class="bo-grille-3">
          <div class="bo-carte"><h2>Dépenses par mois et par coach</h2><div class="bo-graph" style="height:320px"><canvas id="gCptQuiMois"></canvas></div><div class="bo-legende">${QUI.map(([, code, nom], i) => `<span style="--c:${[OR, OR2, ORD, GRIS][i]}">${nom}</span>`).join('')}</div></div>
          <div class="bo-carte"><h2>Part de chacun</h2><div class="bo-graph bo-graph--petit"><canvas id="gCptQui"></canvas></div><div class="bo-legende">${QUI.map(([, code, nom], i) => `<span style="--c:${[OR, OR2, ORD, GRIS][i]}">${nom}</span>`).join('')}</div>
          <h2 style="margin-top:18px">Gain d IS par coach</h2><div class="bo-graph bo-graph--petit"><canvas id="gCptQuiIs"></canvas></div></div>
        </div>
        <div class="bo-grille-2">${parQui.map((p) => `<div class="bo-carte"><div class="bo-carte__tete"><h2>${p.nom} <small>${eur(p.dep)} de dépenses${p.ent ? ` · ${eur(p.ent)} d entrées` : ''}</small></h2><button type="button" class="bo-btn bo-btn--fantome" data-cpt-voir-qui="${p.k}">Voir ses lignes</button></div>
          <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Catégorie</th><th class="num">Dépenses</th><th class="num">Part</th><th class="num">Gain IS</th></tr></thead><tbody>${p.cats.filter(([, v]) => v.dep).slice(0, 8).map(([c, v]) => `<tr><td>${txt(c)}</td><td class="num">${eur(v.dep)}</td><td class="num">${p.dep ? Math.round(v.dep / p.dep * 100) : 0} %</td><td class="num">${eur(v.is)}</td></tr>`).join('') || '<tr><td colspan="4" class="bo-vide">Aucune dépense</td></tr>'}</tbody></table></div>
          <p class="bo-source">Payé via : ${p.vias.filter(([, v]) => v).map(([v, m]) => `${txt(v)} ${eur(m)}`).join(' · ') || '·'}${p.gln ? `. Avancé par GLN : ${eur(p.gln)}, dont ${eur(p.remb)} à rembourser.` : ''}</p></div>`).join('')}</div>
        <p class="bo-source">Qui est à l'origine de chaque ligne : les colonnes MAN, NAD, GUI et SIE du classeur, telles que cochées. Une ligne à plusieurs coches compte chez chacun. Le compte courant de Manu est hors de ces totaux. Le gain d IS d une dépense = sa part HT (TVA récupérée déduite) × ${Math.round(TAUX_IS * 100)} %, estimation maison.</p>`;
    } else if (_cptOnglet === 'mois') {
      corps = `<div class="bo-carte"><h2>Entrées et dépenses par mois</h2><div class="bo-graph" style="height:340px"><canvas id="gCptMois"></canvas></div><div class="bo-legende"><span style="--c:${OR}">Entrées</span><span style="--c:${GRIS}">Dépenses</span><span style="--c:${OR2}">Solde cumulé</span></div></div>`;
    } else if (_cptOnglet === 'categories') {
      const parCat = new Map(); livre.forEach((l) => { const k = l.categorie || 'Sans catégorie'; if (!parCat.has(k)) parCat.set(k, { entrees: 0, depenses: 0, is: 0, n: 0, cc: horsTotaux(l) }); const x = parCat.get(k); x.entrees += l.entree || 0; x.depenses += l.depense || 0; x.is += gainIs(l); x.n += 1; });
      const lignes = [...parCat.entries()].sort((a, b) => (b[1].entrees + b[1].depenses) - (a[1].entrees + a[1].depenses));
      corps = `<div class="bo-grille-2"><div class="bo-carte"><h2>Dépenses par catégorie</h2><div class="bo-graph"><canvas id="gCptCat"></canvas></div></div>
        <div class="bo-carte"><h2>Catégories</h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Catégorie</th><th class="num">Lignes</th><th class="num">Entrées</th><th class="num">Dépenses</th><th class="num">Gain IS</th></tr></thead><tbody>${lignes.map(([k, x]) => `<tr class="${x.cc ? 'bo-ligne--neutre' : ''}"><td>${txt(k)}${x.cc ? '<br><small style="color:var(--text-soft)">hors totaux</small>' : ''}</td><td class="num">${x.n}</td><td class="num" style="color:var(--gold)">${x.entrees ? eur(x.entrees) : ''}</td><td class="num">${x.depenses ? eur(x.depenses) : ''}</td><td class="num">${x.is ? eur(x.is) : ''}</td></tr>`).join('')}</tbody></table></div></div></div>`;
    } else if (_cptOnglet === 'previsionnel') {
      /**
       * ⚠️ LE PREVISIONNEL, C EST LES FRAIS FIXES (Nadir, 15/10 : « on a a peu
       * pres 800 euros de charges par mois »). La premiere version projetait
       * TOUTES les depenses, TVA reversee, commissions et achats compris : faux.
       * Ici : les lignes de categorie « Frais fixes », regroupees par
       * fournisseur (la designation, debarrassee de « (PAYE PAR GLN) » et des
       * numeros), moyenne mensuelle sur les six derniers mois pleins, projetee.
       * Les autres depenses sont montrees a part, par categorie, sans etre
       * projetees : elles ne reviennent pas tous les mois.
       */
      const moisTous = [...new Set(livre.map((l) => l.date.slice(0, 7)))].sort();
      const moisCourant = new Date().toISOString().slice(0, 7);
      const pleins = moisTous.filter((m) => m < moisCourant).slice(-6);
      const nbMois = pleins.length || 1;
      const fixe = (l) => !horsTotaux(l) && depenseDe(l) > 0 && /frais fixes/i.test(l.categorie || '');
      const fournisseur = (l) => String(l.designation || '').replace(/\(pay[ée] par gln\)/i, '').replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim().toUpperCase() || 'Sans désignation';
      const parF = new Map();
      livre.filter((l) => fixe(l) && pleins.includes(l.date.slice(0, 7))).forEach((l) => { const k = fournisseur(l); const x = parF.get(k) || { total: 0, n: 0, mois: new Set(), gln: 0, dernier: '' }; x.total += depenseDe(l); x.n += 1; x.mois.add(l.date.slice(0, 7)); if (avanceGln(l)) x.gln += depenseDe(l); if (l.date > x.dernier) x.dernier = l.date; parF.set(k, x); });
      const fixes = [...parF.entries()].map(([k, x]) => ({ k, mois: x.total / nbMois, an: x.total / nbMois * 12, presence: x.mois.size, n: x.n, gln: x.gln, dernier: x.dernier })).sort((a, b) => b.an - a.an);
      const totalMois = fixes.reduce((s, x) => s + x.mois, 0), totalAn = totalMois * 12;
      const parMoisFixe = moisTous.map((m) => Math.round(livre.filter((l) => fixe(l) && l.date.startsWith(m)).reduce((s, l) => s + depenseDe(l), 0)));
      const autres = new Map();
      livre.filter((l) => !horsTotaux(l) && depenseDe(l) > 0 && !fixe(l)).forEach((l) => { const k = l.categorie || 'Sans catégorie'; const x = autres.get(k) || { total: 0, n: 0, six: 0 }; x.total += depenseDe(l); x.n += 1; if (pleins.includes(l.date.slice(0, 7))) x.six += depenseDe(l); autres.set(k, x); });
      const autresL = [...autres.entries()].sort((a, b) => b[1].total - a[1].total);
      const entreesMois = livre.filter((l) => !horsTotaux(l) && pleins.includes(l.date.slice(0, 7))).reduce((s, l) => s + entreeDe(l), 0) / nbMois;
      const isLigne = (c.is || []).find((x) => /^IS estimé en cours/i.test(x.libelle || ''));
      const vehiculeLigne = ((c.vehicule && c.vehicule.lignes) || []).find((r) => /^2027$/.test(r[0] || ''));
      const amortAn = vehiculeLigne ? montantFr(vehiculeLigne[1]) : 0;
      corps = `<div class="bo-kpis">
          ${kpi('fa-calendar-alt', 'Frais fixes par mois', eur(totalMois), `moyenne des ${nbMois} derniers mois pleins (${pleins.map(moisFr).join(', ')})`)}
          ${kpi('fa-calendar', 'Frais fixes sur 12 mois', eur(totalAn), `${fixes.length} fournisseurs récurrents`)}
          ${kpi('fa-arrow-down', 'Entrées moyennes par mois', eur(entreesMois), `${eur(entreesMois * 12)} sur 12 mois au même rythme`)}
          ${kpi('fa-balance-scale', 'Marge mensuelle sur les frais fixes', eur(entreesMois - totalMois), 'entrées moins frais fixes, avant les autres charges et l IS')}
          ${isLigne ? kpi('fa-landmark', 'IS estimé en cours', txt(isLigne.valeur), 'bloc IS du classeur, exercice en cours') : ''}
          ${amortAn ? kpi('fa-car', 'Voiture : amortissement par an', eur(amortAn), 'côté Manu, bloc véhicule du classeur') : ''}
        </div>
        <div class="bo-grille-3">
          <div class="bo-carte"><h2>Frais fixes par fournisseur <small>par mois et sur 12 mois</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Fournisseur</th><th class="num">Par mois</th><th class="num">Sur 12 mois</th><th class="num">Mois vus / ${nbMois}</th><th>Dernier</th><th class="num">Gain IS / an</th></tr></thead><tbody>${fixes.map((x) => `<tr><td><b>${txt(x.k)}</b>${x.gln ? '<br><small style="color:var(--text-soft)">avancé par GLN</small>' : ''}</td><td class="num">${eur(x.mois)}</td><td class="num"><b>${eur(x.an)}</b></td><td class="num">${x.presence}</td><td>${txt(x.dernier.split('-').reverse().join('/'))}</td><td class="num">${eur(x.an / 1.2 * TAUX_IS)}</td></tr>`).join('')}<tr><td><b>Total frais fixes</b></td><td class="num"><b>${eur(totalMois)}</b></td><td class="num"><b>${eur(totalAn)}</b></td><td></td><td></td><td class="num"><b>${eur(totalAn / 1.2 * TAUX_IS)}</b></td></tr></tbody></table></div></div>
          <div class="bo-carte"><h2>Frais fixes mois par mois</h2><div class="bo-graph"><canvas id="gCptPrev"></canvas></div><div class="bo-legende"><span style="--c:${OR}">Mois retenus</span><span style="--c:${GRIS}">Autres mois</span><span style="--c:${OR2}">Moyenne</span></div></div>
        </div>
        <div class="bo-carte"><h2>Les autres charges <small>non récurrentes, pas projetées</small></h2><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Catégorie</th><th class="num">Lignes</th><th class="num">Depuis le début</th><th class="num">Sur les ${nbMois} derniers mois</th><th class="num">Soit par mois</th></tr></thead><tbody>${autresL.map(([k, x]) => `<tr><td>${txt(k)}</td><td class="num">${x.n}</td><td class="num">${eur(x.total)}</td><td class="num">${eur(x.six)}</td><td class="num">${eur(x.six / nbMois)}</td></tr>`).join('')}</tbody></table></div><p class="bo-source">TVA reversée, commissions, présentiels, achats : elles existent mais ne tombent pas tous les mois. Le prévisionnel ne retient que les frais fixes ; ces montants servent de repère.</p></div>
        <p class="bo-source">Estimation maison : la moyenne des frais fixes des derniers mois pleins, projetée sur douze mois. Le gain d IS suppose une TVA à 20 % récupérable et le taux d IS du classeur (${Math.round(TAUX_IS * 100)} %). Le cabinet reste la référence.</p>`;
    } else if (_cptOnglet === 'is') {
      const is = c.is || [];
      corps = `<div class="bo-carte"><h2>IS estimé · exercice en cours</h2><div class="bo-enveloppe"><table class="bo-table"><tbody>${is.filter((x) => !x.note).map((x) => `<tr><td>${txt(x.libelle)}</td><td class="num"><b>${txt(x.valeur)}</b></td></tr>`).join('')}</tbody></table></div>${is.find((x) => x.note) ? `<p class="bo-source">${txt(is.find((x) => x.note).note)}</p>` : ''}<p class="bo-source">Estimation maison du classeur, à valider par le cabinet (ADALTA).</p></div>`;
    } else if (_cptOnglet === 'vehicule') {
      const v = c.vehicule || { lignes: [] };
      const achats = livre.filter(voiture);
      const total = (v.lignes || []).find((r) => /^total$/i.test(r[0] || ''));
      const coutNet = (v.lignes || []).find((r) => /co[ûu]t net/i.test(r[0] || ''));
      corps = `<div class="bo-kpis">
          ${achats.length ? kpi('fa-car', 'Achat', eur(achats.reduce((s, l) => s + (l.depense || 0), 0)), `${achats.map((l) => `${l.date.split('-').reverse().join('/')} ${l.designation}`).join(' · ')}`) : ''}
          ${total ? kpi('fa-chart-line', 'Amortissement total', txt(total[1]), `dont déductible ${txt(total[2])} · IS économisé ${txt(total[4])}`) : ''}
          ${coutNet ? kpi('fa-user', 'Part de Manu', txt(coutNet.filter(Boolean).pop()), 'prix TTC moins l IS économisé par la société') : ''}
        </div>
        <div class="bo-carte"><h2>${txt(v.titre || 'Amortissement véhicule')}</h2><div class="bo-enveloppe"><table class="bo-table"><tbody>${(v.lignes || []).map((r) => `<tr>${r.map((cell, i) => `<td class="${i > 0 && /€|^\d/.test(cell) ? 'num' : ''}">${txt(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="bo-source">La voiture est achetée par la société et amortie dans ses comptes (d où l IS économisé), mais elle reste à la charge de Manu : sa part = le prix TTC moins l IS économisé. Pour cette raison, l achat n entre ni dans les dépenses, ni dans les coachs, ni dans le prévisionnel. Bloc repris tel quel du classeur.</p></div>`;
    } else if (_cptOnglet.startsWith('feuille:')) {
      const gid = _cptOnglet.slice(8);
      const f = autres.find((o) => String(o.gid) === gid);
      const lignes = (f && f.lignes) || [];
      const iEntete = lignes.findIndex((r) => r.filter((x) => String(x || '').trim()).length >= 2);
      const entete = iEntete >= 0 ? lignes[iEntete] : [];
      const corpsL = iEntete >= 0 ? lignes.slice(iEntete + 1).filter((r) => r.some((x) => String(x || '').trim())) : [];
      const large = Math.max(entete.length, ...corpsL.map((r) => r.length));
      corps = `<div class="bo-carte"><h2>${txt(f ? f.titre : '')} <small>${corpsL.length} lignes</small></h2><div class="bo-enveloppe"><table class="bo-table bo-table--compact"><thead><tr>${Array.from({ length: large }, (_, i) => `<th>${txt(entete[i] || '')}</th>`).join('')}</tr></thead><tbody>${corpsL.map((r) => `<tr>${Array.from({ length: large }, (_, i) => `<td class="${/^-?[\d\s ]+,\d{2}\s?€$/.test(String(r[i] || '')) ? 'num' : ''}">${txt(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="bo-source">Onglet lu tel quel, en lecture seule.</p></div>`;
    }
    z.innerHTML = `
      <div class="bo-carte__tete" style="margin-bottom:14px"><span class="bo-pill bo-pill--ok"><i class="fas fa-lock"></i> Lecture seule</span><span class="bo-pill">${txt(c.maj || 'Synchronisé Qonto')}</span><a class="bo-btn bo-btn--fantome" href="https://docs.google.com/spreadsheets/d/${txt(BUDGET_ID)}/edit" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Ouvrir le classeur</a></div>
      <div class="bo-kpis">${kpis.map(([ic, k, x, s, cible]) => `<button type="button" class="bo-kpi bo-kpi--btn" data-cpt-carte="${cible}" title="Voir le détail"><div class="bo-kpi__ic"><i class="fas ${ic}"></i></div><div class="bo-kpi__k">${k}</div><div class="bo-kpi__v">${txt(x.valeur)}</div>${s ? `<div class="bo-kpi__s">${s}</div>` : ''}<div class="bo-kpi__fleche"><i class="fas fa-arrow-right"></i></div></button>`).join('')}</div>
      <nav class="am-onglets">${ONGLETS.map(([k, t]) => `<button type="button" data-cpt-onglet="${txt(k)}" aria-selected="${_cptOnglet === k}">${txt(t)}</button>`).join('')}</nav>${corps}
      <p class="bo-source">Source : classeur « ${txt(c.titre)} », ${nb(livre.length)} lignes datées, ${eur(entrees)} d entrées et ${eur(depenses)} de dépenses sur le grand livre. Lu le ${txt(dateFr(c.lu_le, true))}.</p>`;
    if (_cptOnglet === 'mois') {
      const parMois = new Map(); livre.forEach((l) => { const m = l.date.slice(0, 7); if (!parMois.has(m)) parMois.set(m, { e: 0, d: 0 }); const x = parMois.get(m); x.e += entreeDe(l); x.d += depenseDe(l); });
      const mois = [...parMois.keys()].sort(); let cumul = 0; const solde = mois.map((m) => { cumul += parMois.get(m).e - parMois.get(m).d; return Math.round(cumul); });
      graph('gCptMois', { type: 'bar', data: { labels: mois.map(moisFr), datasets: [
        { label: 'Entrées', data: mois.map((m) => Math.round(parMois.get(m).e)), backgroundColor: 'rgba(232,184,75,.75)', borderRadius: 6 },
        { label: 'Dépenses', data: mois.map((m) => Math.round(parMois.get(m).d)), backgroundColor: GRIS, borderRadius: 6 },
        { label: 'Solde cumulé', data: solde, type: 'line', borderColor: OR2, backgroundColor: OR2, tension: .35, pointRadius: 3 },
      ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label} : ${eur(x.parsed.y)}` } } }, scales: axes({ ticks: { color: GRIS, callback: (v) => `${Math.round(v / 1000)}k` } }) } });
    }
    if (_cptOnglet === 'previsionnel') {
      const moisTous = [...new Set(livre.map((l) => l.date.slice(0, 7)))].sort();
      const moisCourant = new Date().toISOString().slice(0, 7);
      const pleins = moisTous.filter((m) => m < moisCourant).slice(-6);
      const fixe = (l) => !horsTotaux(l) && depenseDe(l) > 0 && /frais fixes/i.test(l.categorie || '');
      const charges = moisTous.map((m) => Math.round(livre.filter((l) => fixe(l) && l.date.startsWith(m)).reduce((s, l) => s + depenseDe(l), 0)));
      const moyenne = pleins.length ? Math.round(pleins.reduce((s, m) => s + charges[moisTous.indexOf(m)], 0) / pleins.length) : 0;
      graph('gCptPrev', { type: 'bar', data: { labels: moisTous.map(moisFr), datasets: [{ label: 'Frais fixes du mois', data: charges, backgroundColor: moisTous.map((m) => pleins.includes(m) ? 'rgba(232,184,75,.75)' : GRIS), borderRadius: 6 }, { label: 'Moyenne retenue', data: moisTous.map(() => moyenne), type: 'line', borderColor: OR2, borderDash: [6, 4], pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label} : ${eur(x.parsed.y)}` } } }, scales: axes() } });
    }
    if (_cptOnglet === 'coachs') {
      const mois = [...new Set(livre.map((l) => l.date.slice(0, 7)))].sort();
      const couleursQui = [OR, OR2, ORD, GRIS];
      graph('gCptQuiMois', { type: 'bar', data: { labels: mois.map(moisFr), datasets: QUI.map(([k, code, nom], i) => ({ label: nom, data: mois.map((m) => Math.round(livre.filter((l) => l[k] && l.date.startsWith(m)).reduce((s, l) => s + depenseDe(l), 0))), backgroundColor: couleursQui[i], borderRadius: 4, stack: 'dep' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label} : ${eur(x.parsed.y)}` } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { color: GRIS } }, y: { stacked: true, grid: { color: LIGNE }, ticks: { color: GRIS, callback: (v) => `${Math.round(v / 1000)}k` }, beginAtZero: true } } } });
      graph('gCptQui', { type: 'doughnut', data: { labels: QUI.map(([, , nom]) => nom), datasets: [{ data: QUI.map(([k]) => Math.round(livre.filter((l) => l[k]).reduce((s, l) => s + depenseDe(l), 0))), backgroundColor: couleursQui, borderColor: C().FOND, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.label} : ${eur(x.parsed)}` } } } } });
      graph('gCptQuiIs', { type: 'bar', data: { labels: QUI.map(([, , nom]) => nom), datasets: [{ data: QUI.map(([k]) => Math.round(livre.filter((l) => l[k]).reduce((s, l) => s + gainIs(l), 0))), backgroundColor: couleursQui, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${eur(x.parsed.y)}` } } }, scales: axes() } });
    }
    if (_cptOnglet === 'categories') {
      const parCat = new Map(); livre.forEach((l) => { if (!depenseDe(l)) return; const k = l.categorie || 'Sans catégorie'; parCat.set(k, (parCat.get(k) || 0) + depenseDe(l)); });
      const lignes = [...parCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      graph('gCptCat', { type: 'bar', data: { labels: lignes.map((x) => x[0]), datasets: [{ data: lignes.map((x) => Math.round(x[1])), backgroundColor: 'rgba(232,184,75,.75)', borderRadius: 6 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${eur(x.parsed.x)}` } } }, scales: { x: { grid: { color: LIGNE }, ticks: { color: GRIS, callback: (v) => `${Math.round(v / 1000)}k` } }, y: { grid: { display: false }, ticks: { color: GRIS } } } } });
    }
  };
  const BUDGET_ID = '1NgmzippM7Y6Mv8XxG-XdTm-B8r7wMRf_CNRWgNgvevk';
  function montantFr(v) { const t = String(v || '').replace(/[\u20ac\s\u00a0\u202f]/g, '').replace(/\./g, '').replace(',', '.').replace(/[\u2212\u2013]/g, '-'); const n = Number(t); return Number.isFinite(n) && t !== '' ? n : 0; }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cpt-onglet], [data-cpt-voir-qui], [data-cpt-carte], [data-cpt-special-off]');
    if (!b) return;
    if (b.dataset.cptVoirQui) { Object.assign(_cptFiltre, { q: '', categorie: '', via: '', mois: '', type: '', special: '' }); _cptFiltre.qui = b.dataset.cptVoirQui; _cptOnglet = 'livre'; }
    else if (b.hasAttribute('data-cpt-special-off')) _cptFiltre.special = '';
    else if (b.dataset.cptCarte) {
      const c = b.dataset.cptCarte;
      if (c === 'mois' || c === 'previsionnel') _cptOnglet = c;
      else if (c === 'is_onglet') _cptOnglet = 'is';
      else poserFiltreCarte(c);
    }
    else _cptOnglet = b.dataset.cptOnglet;
    CHARGEURS['ventes/comptabilite']();
    window.scrollTo({ top: 0 });
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-cpt-q]')) { _cptFiltre.q = t.value; clearTimeout(t._m); t._m = setTimeout(() => { const pos = t.selectionStart; CHARGEURS['ventes/comptabilite']().then(() => { const n = document.querySelector('[data-cpt-q]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); }, 250); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-cpt-categorie]')) _cptFiltre.categorie = t.value;
    else if (t.matches('[data-cpt-via]')) _cptFiltre.via = t.value;
    else if (t.matches('[data-cpt-mois]')) _cptFiltre.mois = t.value;
    else if (t.matches('[data-cpt-qui]')) _cptFiltre.qui = t.value;
    else if (t.matches('[data-cpt-type]')) _cptFiltre.type = t.value;
    else return;
    CHARGEURS['ventes/comptabilite']();
  });

  /* ══ LE DEMARRAGE ══════════════════════════════════════════════════════════ */
  async function demarrer() {
    const debut = Date.now();
    while (!window.supabaseClient && Date.now() - debut < 5000) await new Promise((r) => setTimeout(r, 50));
    if (!window.supabaseClient) { location.replace('/index.html'); return; }
    const { data: s } = await cli().auth.getSession();
    if (!s?.session) { location.replace('/index.html'); return; }
    // ⚠️ Le role se lit en base, comme is_coach() : pas d ecran coach sans lui.
    const { data: u } = await cli().from('users').select('role, status, name, email').eq('uuid', s.session.user.id).maybeSingle();
    if (!u || !['coach', 'admin'].includes(u.role) || !['active', 'approved'].includes(u.status)) { location.replace('/index.html'); return; }
    const c = $('boCoach'); if (c) c.textContent = u.name || u.email || '';
    $('bo').hidden = false;
    $('boVoile').hidden = true;
    window.addEventListener('hashchange', router);
    $('boBurger').addEventListener('click', () => $('bo').classList.toggle('barre-ouverte'));
    $('boRecharger').addEventListener('click', () => { _cache.clear(); router(); dire('Données relues.'); });
    // Le theme : memorise, et les graphiques se redessinent dans les bonnes couleurs.
    const majTheme = () => { const b = $('boTheme'); if (!b) return; const clair = !sombre(); b.querySelector('i').className = `fas ${clair ? 'fa-moon' : 'fa-sun'}`; b.querySelector('span').textContent = clair ? 'Thème sombre' : 'Thème clair'; };
    majTheme();
    $('boTheme').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      try { localStorage.setItem('t360.backOfficeTheme', sombre() ? 'sombre' : 'clair'); } catch { /* rien */ }
      majTheme();
      router();
    });
    $('boDeconnexion').addEventListener('click', async () => { try { await cli().auth.signOut({ scope: 'local' }); } catch { /* rien */ } location.href = '/index.html'; });
    if (!location.hash) location.hash = '#/accueil';
    await router();
  }
  demarrer().catch((e) => { console.error('[BO] demarrage', e); location.replace('/index.html'); });
})();
