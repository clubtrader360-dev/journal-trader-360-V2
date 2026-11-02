/**
 * ACADÉMIE · LIVES MEMBRES : LA RÉGIE (29/10/2026, demande de Nadir).
 *
 * La même régie que le webinaire du site, pour les lives de l'espace membre :
 *   - la liste des lives : créer, modifier, publier (titre, date, lien YouTube) ;
 *   - la régie d'un live : chiffres, « Je diffuse » / « Je rejoins le live », la
 *     prise de parole (interrupteur, file, deux places), la question à l'écran, le
 *     sondage, le chat modéré, « Terminer le live », et les deux liens OBS.
 *
 * ⛔ Tout passe par les fonctions `live_*` de migrations/06-lives-membres.sql, qui
 * exigent is_coach(). Aucune table lue en direct (elles n'ont aucune politique).
 * ⛔ `rpc()` ne lève pas : chaque appel teste `error`.
 *
 * ⚠️ « Je diffuse » et « Je rejoins le live » s'ouvrent DANS la régie, pas dans un
 * nouvel onglet : la session est gardée par onglet (sessionStorage, voir
 * supabase-config.js), un onglet neuf ouvert en `noopener` arriverait déconnecté.
 *
 * Branché par back-office.js : CHARGEURS['academie/lives'] → LivesRegie.charger().
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // ⚠️ Échappe aussi les guillemets : le texte va dans des attributs (value="…", data-copier="…").
  // Sans cela, un titre « Revue "NFP" » s'affichait tronqué et se réenregistrait tronqué (revue du 29/10).
  const txt = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const el = (tag, cls, texte) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; };
  const dire = (m, t) => (window.showNotification ? window.showNotification(m, t) : console.log(m));
  const PARIS = 'Europe/Paris';
  const heure = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: PARIS });
  const dateFr = (iso) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PARIS });
  const vdo = (p) => 'https://vdo.ninja/?' + p.map(([k, v]) => (v === undefined ? k : `${k}=${encodeURIComponent(v)}`)).join('&');

  async function rpc(nom, args) {
    const c = window.supabaseClient;
    if (!c) throw new Error('connexion indisponible, recharge la page');
    const { data, error } = await c.rpc(nom, args || {});
    if (error) throw new Error(error.message || 'action non enregistrée');
    return data;
  }

  /** L'identifiant YouTube depuis n'importe quel lien (live, watch, youtu.be, embed) ou l'identifiant seul. */
  function youtubeId(brut) {
    const s = String(brut || '').trim();
    if (!s) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
      const h = u.hostname.replace(/^www\.|^m\./, '');
      if (h === 'youtu.be') return u.pathname.slice(1, 12);
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
        if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
        const m = u.pathname.match(/\/(?:live|embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
      }
    } catch { /* pas une adresse */ }
    return null;
  }
  /** datetime-local (heure de l'ordinateur, en France : Paris) ↔ ISO. */
  const versChamp = (iso) => { if (!iso) return ''; const d = new Date(iso); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };

  let R = null; // la régie ouverte

  /**
   * ── MA SCÈNE : « Je diffuse » / « Je rejoins le live » ─────────────────────
   * ⛔ Une fenêtre FLOTTANTE posée sur la page, hors de l'écran de la régie (revue du
   * 29/10). Posée dans l'écran, elle restait active quand le coach allait voir le CRM
   * (l'écran est seulement masqué), mais son battement s'arrêtait : sa caméra sortait
   * de la colonne OBS au bout de 45 s alors qu'il se croyait à l'antenne. Ici, la
   * scène et son battement vivent ensemble, jusqu'à « Quitter la scène ».
   */
  const SC = { el: null, ifr: null, titre: null, battement: 0, live: null, role: null };
  function poserScene() {
    if (SC.el) return;
    SC.el = el('div', 'bo-live-flottant'); SC.el.setAttribute('role', 'region'); SC.el.setAttribute('aria-label', 'Ta scène');
    const tete = el('div', 'bo-live-flottant__tete'); SC.titre = el('b');
    const q = el('button', 'bo-btn bo-btn--fantome', 'Quitter la scène'); q.type = 'button'; q.addEventListener('click', quitterScene);
    tete.append(SC.titre, q);
    const cadre = el('div', 'bo-live-flottant__cadre');
    SC.ifr = document.createElement('iframe'); SC.ifr.title = 'Ta scène'; SC.ifr.allow = 'autoplay; camera; microphone; fullscreen; display-capture';
    cadre.append(SC.ifr); SC.el.append(tete, cadre);
    document.body.append(SC.el);
  }
  function entrerScene(live, role, lien, titreLive) {
    poserScene();
    if (SC.live === live && SC.role === role) return;
    clearInterval(SC.battement);
    SC.live = live; SC.role = role; SC.ifr.src = lien;
    SC.titre.textContent = `${role === 'animateur' ? 'Tu diffuses' : 'Tu es dans le live'} · ${titreLive}`;
    SC.el.classList.add('on');
    // Le co-animateur n'apparaît dans la colonne OBS que tant que cette fenêtre bat (45 s).
    if (role === 'coanimateur') {
      const bat = () => rpc('live_commande', { p_live: live, p: { coanim: true } }).catch(() => null);
      bat(); SC.battement = window.setInterval(bat, 20000);
    }
  }
  function quitterScene() {
    clearInterval(SC.battement); SC.battement = 0; SC.live = null; SC.role = null;
    if (SC.ifr) SC.ifr.src = 'about:blank';
    if (SC.el) SC.el.classList.remove('on');
  }

  function arreter() {
    if (!R) return;
    clearTimeout(R.minuteur);
    R = null;
  }
  const surCetEcran = () => /^#\/academie\/lives/.test(location.hash);

  /* ══ LA LISTE ══════════════════════════════════════════════════════════════ */
  async function liste(z) {
    arreter();
    z.innerHTML = '<p class="bo-vide">Chargement…</p>';
    const lives = await rpc('live_lister');
    // ⛔ « Terminé » n'est pas une alerte : pas de rouge (réservé aux alertes).
    const etat = (l) => (l.fin ? ['Terminé', 'neutre'] : l.publie ? ['Publié', 'ok'] : ['Brouillon', 'neutre']);
    z.innerHTML = `
      <div class="bo-carte">
        <div class="bo-carte__tete"><h2>Les lives</h2><button type="button" class="bo-btn bo-btn--or" data-live-nouveau><i class="fas fa-plus"></i> Nouveau live</button></div>
        <p class="bo-live-aide">Un live publié apparaît dans l'espace membre, onglet « Live », pour tous les membres dont l'accès formation est actif. La salle s'ouvre 30 minutes avant le début.</p>
        <div data-live-form></div>
        ${lives.length ? `<div class="bo-live-defile"><table class="bo-table"><thead><tr><th>Date</th><th>Titre</th><th>État</th><th>Présents</th><th>Messages</th><th></th></tr></thead><tbody>
          ${lives.map((l) => { const [e, c] = etat(l); return `<tr>
            <td class="bo-live-num">${txt(dateFr(l.debut))}</td><td>${txt(l.titre)}${l.youtube_id ? '' : ' <span class="bo-live-manque">lien YouTube à poser</span>'}</td>
            <td><span class="bo-pill bo-pill--${c}">${e}</span></td><td class="bo-live-num">${l.presents}</td><td class="bo-live-num">${l.messages}</td>
            <td class="bo-live-actions"><a class="bo-btn bo-btn--or" href="#/academie/lives?id=${l.id}">Régie</a><button type="button" class="bo-btn bo-btn--fantome" data-live-modifier="${l.id}">Modifier</button></td></tr>`; }).join('')}
        </tbody></table></div>` : '<p class="bo-vide">Aucun live pour l\'instant. « Nouveau live » pour préparer le premier.</p>'}
      </div>`;
    const zf = z.querySelector('[data-live-form]');
    z.querySelector('[data-live-nouveau]').addEventListener('click', () => formulaire(zf, null, () => liste(z)));
    z.querySelectorAll('[data-live-modifier]').forEach((b) => b.addEventListener('click', () => formulaire(zf, lives.find((l) => String(l.id) === b.dataset.liveModifier), () => liste(z))));
  }

  /** Créer ou modifier un live. */
  function formulaire(zf, l, apres) {
    zf.innerHTML = `
      <form class="bo-live-form">
        <label>Titre<input name="titre" maxlength="160" required value="${txt(l ? l.titre : '')}" placeholder="Live du jeudi : revue de la semaine"></label>
        <label>Début (heure de Paris)<input name="debut" type="datetime-local" required value="${txt(l ? versChamp(l.debut) : '')}"></label>
        <label class="bo-live-large">Lien du direct YouTube <small>non répertorié ; peut se poser plus tard, jusqu'au début du live</small><input name="youtube" value="${txt(l && l.youtube_id ? `https://youtube.com/live/${l.youtube_id}` : '')}" placeholder="https://youtube.com/live/…"></label>
        <label class="bo-live-case"><input type="checkbox" name="publie" ${!l || l.publie ? 'checked' : ''}> Publié : visible dans l'espace membre</label>
        <div class="bo-live-form-bas"><button type="submit" class="bo-btn bo-btn--or">${l ? 'Enregistrer' : 'Créer le live'}</button><button type="button" class="bo-btn bo-btn--fantome" data-annuler>Annuler</button><span class="bo-erreur" data-err></span></div>
      </form>`;
    const f = zf.querySelector('form');
    zf.querySelector('[data-annuler]').addEventListener('click', () => { zf.innerHTML = ''; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = zf.querySelector('[data-err]'); err.textContent = '';
      const yt = youtubeId(f.youtube.value);
      if (yt === null) { err.textContent = 'Lien YouTube non reconnu : colle le lien du direct (youtube.com/live/… ou youtu.be/…).'; return; }
      const debut = new Date(f.debut.value);
      if (Number.isNaN(debut.getTime())) { err.textContent = 'Date de début à remplir.'; return; }
      try {
        await rpc('live_enregistrer', { p: { ...(l ? { id: l.id } : {}), titre: f.titre.value.trim(), debut: debut.toISOString(), youtube_id: yt, publie: f.publie.checked } });
        dire(l ? 'Live enregistré.' : 'Live créé.'); apres();
      } catch (x) { err.textContent = x.message; }
    });
    f.titre.focus();
  }

  /* ══ LA RÉGIE D'UN LIVE ════════════════════════════════════════════════════ */
  async function regie(z, id) {
    arreter();
    z.innerHTML = '<p class="bo-vide">Chargement de la régie…</p>';
    let d;
    try { d = await rpc('live_regie', { p_live: id }); }
    catch (e) { z.innerHTML = `<p class="bo-erreur">${txt(e.message)}</p><p><a class="bo-btn bo-btn--fantome" href="#/academie/lives">Retour aux lives</a></p>`; return; }
    const site = location.origin;
    const lienObs = (p) => `${site}/live-obs.html?p=${p}&k=${d.cle_obs}`;
    z.innerHTML = `
      <div class="bo-live-tete">
        <a class="bo-btn bo-btn--fantome" href="#/academie/lives"><i class="fas fa-arrow-left"></i> Les lives</a>
        <div><h2>${txt(d.titre)}</h2><p class="bo-live-aide">${txt(dateFr(d.debut))}${d.publie ? '' : ' · <b>brouillon, invisible des membres</b>'}${d.youtube ? '' : ' · <b>lien YouTube à poser</b>'}</p></div>
      </div>
      <div class="bo-kpis bo-live-kpis">
        <div class="bo-kpi"><div class="bo-kpi__k">Connectés</div><div class="bo-kpi__v" data-k="connectes">…</div></div>
        <div class="bo-kpi"><div class="bo-kpi__k">Présents</div><div class="bo-kpi__v" data-k="presents">…</div></div>
        <div class="bo-kpi"><div class="bo-kpi__k">Minutes en moyenne</div><div class="bo-kpi__v" data-k="minutes">…</div></div>
        <div class="bo-kpi"><div class="bo-kpi__k">Messages</div><div class="bo-kpi__v" data-k="messages">…</div></div>
      </div>
      <div class="bo-live-grille">
        <div class="bo-live-col">
          <div class="bo-carte">
            <h2>Les boutons du live</h2>
            <div class="bo-live-boutons">
              <button type="button" class="bo-live-gros" data-role="animateur"><b>Je diffuse</b><span>Tu es sur OBS. Ta scène s'ouvre ici : les invités t'entendent en direct. Garde un casque.</span></button>
              <button type="button" class="bo-live-gros" data-role="coanimateur"><b>Je rejoins le live</b><span>Tu n'es pas sur OBS : ta caméra et ton micro arrivent dans le direct.</span></button>
            </div>
            <div class="bo-live-inter" data-inter-parole>
              <div><b data-parole-etat>Prise de parole fermée</b><span data-parole-aide>Le bouton « Demander la parole » n'apparaît pas chez les membres.</span></div>
              <button type="button" class="bo-live-bascule" data-bascule-parole role="switch" aria-checked="false" aria-label="Ouvrir la prise de parole"></button>
            </div>
            <div class="bo-live-inter" data-fin-live>
              <div><b data-fin-etat>Le live est en cours</b><span data-fin-aide>Quand tu coupes le direct dans OBS, clique ici : chez les membres, la vidéo s'arrête et l'écran de fin s'affiche.</span></div>
              <button type="button" class="bo-btn bo-btn--fantome" data-fin-bouton>Terminer le live</button>
            </div>
          </div>
          <div class="bo-carte">
            <h2>La scène <small class="bo-live-aide">2 places</small></h2>
            <div class="bo-live-deux">
              <div><p class="bo-live-mini">En attente</p><ol class="bo-live-file" data-attente></ol></div>
              <div><p class="bo-live-mini">Sur scène</p><ol class="bo-live-file" data-places></ol></div>
            </div>
            <details class="bo-live-obs">
              <summary>Régler OBS, une seule fois</summary>
              <ol>
                <li>Dans OBS, Sources, +, « Navigateur ». Nomme-la « Intervenants (membres) ». Colle le premier lien, largeur 480, hauteur 1080, coche « Contrôler l'audio via OBS ». Place-la sous ta caméra.</li>
                <li>Pour le replay avec le chat : dans la scène « Enregistrement » seulement, une source « Navigateur » avec le second lien, 600 × 1080, sur le côté droit.</li>
              </ol>
              <p class="bo-live-aide">Les liens ne changent jamais : ils suivent le live du jour. Personne sur scène : la source est transparente. Ces liens sont propres aux lives membres, différents de ceux des webinaires du site.</p>
              <div class="bo-live-lien"><b>Intervenants</b><code>${txt(lienObs('colonne'))}</code><button type="button" class="bo-btn bo-btn--fantome" data-copier="${txt(lienObs('colonne'))}">Copier</button></div>
              <div class="bo-live-lien"><b>Chat pour le replay</b><code>${txt(lienObs('chat'))}</code><button type="button" class="bo-btn bo-btn--fantome" data-copier="${txt(lienObs('chat'))}">Copier</button></div>
            </details>
          </div>
          <div class="bo-carte">
            <h2>Ce que voient les membres <small class="bo-live-aide">son coupé ici</small></h2>
            <div class="bo-live-cadre">${d.youtube ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.youtube)}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1" title="Aperçu" allow="autoplay; encrypted-media; picture-in-picture"></iframe>` : '<p>Pose le lien YouTube du direct (« Modifier » dans la liste des lives) pour voir la vidéo ici.</p>'}
              <div class="bo-live-bandeau" data-bandeau><small data-bandeau-auteur></small><p data-bandeau-texte></p></div></div>
          </div>
          <div class="bo-live-deux">
            <div class="bo-carte"><h2>Question à l'écran</h2><div data-q-ecran></div></div>
            <div class="bo-carte"><h2>Sondage</h2><div data-sondage-zone></div>
              <form class="bo-live-sondage-form" data-sondage-form>
                <input name="question" maxlength="200" placeholder="La question" required>
                <input name="c0" maxlength="80" placeholder="Réponse 1" required><input name="c1" maxlength="80" placeholder="Réponse 2" required>
                <input name="c2" maxlength="80" placeholder="Réponse 3 (facultative)"><input name="c3" maxlength="80" placeholder="Réponse 4 (facultative)">
                <button class="bo-btn bo-btn--or" type="submit">Lancer le sondage</button>
              </form></div>
          </div>
        </div>
        <aside class="bo-carte bo-live-chat">
          <div class="bo-live-chat-tete"><h2>Le chat</h2><div class="bo-live-filtres"><button type="button" class="on" data-filtre="tout">Tout</button><button type="button" data-filtre="question">Questions</button></div></div>
          <div class="bo-live-epingle" data-epingle></div>
          <ol class="bo-live-liste" data-liste aria-live="polite"></ol>
          <form class="bo-live-ecrire" data-ecrire>
            <textarea rows="2" maxlength="400" placeholder="Écrire au nom de Trader 360…" required></textarea>
            <div><button class="bo-btn bo-btn--or" type="submit">Envoyer</button></div>
            <span class="bo-live-aide" data-aide></span>
          </form>
        </aside>
      </div>`;

    R = { id, minuteur: 0, sig: '', sigScene: '', filtre: 'tout', question: null, fin: null, parole: false };
    const moi = R;
    const q = (s) => z.querySelector(s);
    const aide = q('[data-aide]');
    // Rend vrai si la commande est passée : un refus ne doit pas effacer ce que le coach préparait.
    const agir = (p, ok) => rpc('live_commande', { p_live: id, p }).then(() => { if (ok) aide.textContent = ok; tirer(); return true; }).catch((e) => { aide.textContent = e.message; dire(e.message, 'error'); return false; });

    /* ── Ma scène : « Je diffuse » / « Je rejoins le live », dans une fenêtre flottante ── */
    // ⛔ Les noms de flux viennent du serveur (live_vdo_coach) : jamais déduits ici, et jamais
    // rendus à un membre, pour qu'un ancien invité ne puisse pas prendre la place d'un coach.
    const v = d.vdo;
    const liens = {
      animateur: vdo([['room', v.room], ['password', v.password], ['push', v.animateur], ['label', 'Animateur'], ['webcam'], ['videodevice', '0'], ['autostart'], ['cleanish']]),
      coanimateur: vdo([['room', v.room], ['password', v.password], ['push', v.coanimateur], ['label', 'Co-animateur'], ['webcam'], ['autostart'], ['cleanish']]),
    };
    z.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => entrerScene(id, b.dataset.role, liens[b.dataset.role], d.titre)));

    /* ── Interrupteurs ── */
    q('[data-bascule-parole]').addEventListener('click', () => agir({ parole_on: !moi.parole }));
    q('[data-fin-bouton]').addEventListener('click', () => {
      const fin = !moi.fin;
      if (fin && !window.confirm('Terminer le live pour tous les membres ? La vidéo s\'arrête chez eux et l\'écran de fin s\'affiche.')) return;
      agir({ fin }, fin ? 'Live terminé : les membres voient l\'écran de fin.' : 'Live rouvert.');
    });
    z.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copier); dire('Lien copié.'); } catch { dire('Copie impossible : sélectionne le lien à la main.', 'error'); } }));
    z.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => {
      z.querySelectorAll('[data-filtre]').forEach((x) => x.classList.remove('on')); b.classList.add('on'); moi.filtre = b.dataset.filtre; moi.sig = ''; tirer();
    }));
    q('[data-sondage-form]').addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.currentTarget; const val = (n) => f.elements.namedItem(n).value;
      agir({ sondage: { question: val('question'), choix: [val('c0'), val('c1'), val('c2'), val('c3')] } }, 'Sondage lancé.').then((passe) => { if (passe) f.reset(); });
    });
    const fe = q('[data-ecrire]'); const ta = fe.querySelector('textarea');
    fe.addEventListener('submit', async (e) => {
      e.preventDefault(); const t = ta.value.trim(); if (!t) return;
      try { await rpc('live_ecrire', { p_live: id, p_texte: t }); ta.value = ''; aide.textContent = ''; moi.sig = ''; await tirer(); } catch (x) { aide.textContent = x.message; }
    });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fe.requestSubmit(); } });

    /* ── Rendu ── */
    const estQuestion = (m) => !m.coach && /\?\s*$/.test(m.texte);
    function rendre(r) {
      for (const [k, val] of Object.entries(r.stats || {})) { const n = z.querySelector(`[data-k="${k}"]`); if (n) n.textContent = Number(val).toLocaleString('fr-FR'); }
      moi.parole = !!r.parole_on; moi.fin = r.fin || null; moi.question = r.question ? r.question.id : null;
      q('[data-inter-parole]').classList.toggle('on', moi.parole);
      q('[data-bascule-parole]').setAttribute('aria-checked', String(moi.parole));
      q('[data-parole-etat]').textContent = moi.parole ? 'Prise de parole ouverte' : 'Prise de parole fermée';
      q('[data-parole-aide]').textContent = moi.parole ? 'Les membres voient « Demander la parole » sous le chat. Clique pour le retirer.' : 'Le bouton « Demander la parole » n\'apparaît pas chez les membres.';
      q('[data-fin-live]').classList.toggle('on', !!moi.fin);
      q('[data-fin-etat]').textContent = moi.fin ? `Live terminé à ${heure(moi.fin)}` : 'Le live est en cours';
      q('[data-fin-aide]').textContent = moi.fin ? 'Les membres voient l\'écran de fin, le chat est fermé. Un clic de trop ? Rouvre le live.' : 'Quand tu coupes le direct dans OBS, clique ici : chez les membres, la vidéo s\'arrête et l\'écran de fin s\'affiche.';
      q('[data-fin-bouton]').textContent = moi.fin ? 'Rouvrir le live' : 'Terminer le live';
      // Bandeau de l'aperçu
      const band = q('[data-bandeau]'); band.classList.toggle('on', !!r.question);
      if (r.question) { q('[data-bandeau-auteur]').textContent = `Question de ${r.question.auteur}`; q('[data-bandeau-texte]').textContent = r.question.texte; }
      // Question à l'écran
      const zq = q('[data-q-ecran]'); zq.replaceChildren();
      if (r.question) {
        zq.append(el('small', 'bo-live-mini', r.question.auteur), el('p', 'bo-live-q', r.question.texte));
        const b = el('button', 'bo-btn bo-btn--fantome', 'Retirer de l\'écran'); b.type = 'button'; b.addEventListener('click', () => agir({ ecran: null })); zq.append(b);
      } else zq.append(el('p', 'bo-live-aide', 'Aucune. Dans le chat, « À l\'écran » sur une question l\'affiche sur la vidéo chez tous les membres.'));
      // Sondage
      const zs = q('[data-sondage-zone]'); zs.replaceChildren();
      const s = r.sondage;
      if (s) {
        zs.append(el('small', 'bo-live-mini', s.clos ? 'Clos' : 'En cours'), el('p', 'bo-live-q', s.question));
        s.choix.forEach((c, k) => {
          const pc = s.total ? Math.round((s.resultats[k] * 100) / s.total) : 0;
          const l = el('div', 'bo-live-choix'); const i = el('i'); i.style.width = `${pc}%`;
          l.append(i, el('span', '', c), el('em', 'bo-live-num', `${pc} % · ${s.resultats[k]}`)); zs.append(l);
        });
        if (!s.clos) { const b = el('button', 'bo-btn bo-btn--fantome', 'Clore le sondage'); b.type = 'button'; b.addEventListener('click', () => agir({ clore: true })); zs.append(b); }
      }
      // Scène
      const sigS = JSON.stringify([r.attente.map((p) => p.id), r.scene.map((p) => [p.id, p.place, p.rejoint])]);
      if (sigS !== moi.sigScene) {
        moi.sigScene = sigS;
        const za = q('[data-attente]'); za.replaceChildren();
        if (!r.attente.length) za.append(el('li', 'bo-live-aide', 'Personne.'));
        r.attente.forEach((p, k) => {
          const li = el('li', 'bo-live-ligne'); li.append(el('span', 'bo-live-rang bo-live-num', String(k + 1)), el('b', '', p.auteur), el('span', 'bo-live-aide bo-live-num', heure(p.demande_le)));
          const act = el('span', 'bo-live-act');
          const b1 = el('button', 'bo-btn bo-btn--or', 'Inviter'); b1.type = 'button'; b1.addEventListener('click', () => agir({ inviter: p.id }, `${p.auteur} est invité. Sa caméra s'ajoute à la colonne OBS dès qu'il clique « Rejoindre ».`));
          const b2 = el('button', 'bo-btn bo-btn--fantome', 'Refuser'); b2.type = 'button'; b2.addEventListener('click', () => agir({ refuser: p.id }));
          act.append(b1, b2); li.append(act); za.append(li);
        });
        const zp = q('[data-places]'); zp.replaceChildren();
        for (const n of [1, 2]) {
          const p = r.scene.find((x) => x.place === n);
          const li = el('li', `bo-live-ligne${p ? ' bo-live-ligne--scene' : ''}`); li.append(el('span', 'bo-live-rang bo-live-num', `P${n}`));
          if (!p) { li.append(el('span', 'bo-live-aide', 'libre')); zp.append(li); continue; }
          li.append(el('b', '', p.auteur), el('span', 'bo-live-aide', p.rejoint ? 'à l\'antenne' : `invité à ${heure(p.invite_le)}, pas encore entré`));
          const b = el('button', 'bo-btn bo-btn--fantome', 'Terminer'); b.type = 'button'; b.addEventListener('click', () => agir({ terminer: p.id }, `${p.auteur} quitte la colonne.`));
          const act = el('span', 'bo-live-act'); act.append(b); li.append(act); zp.append(li);
        }
      }
      // Chat
      const sig = JSON.stringify([r.messages.map((m) => m.id), r.epingle && r.epingle.id, moi.question, moi.filtre]);
      if (sig !== moi.sig) {
        moi.sig = sig;
        const liste = q('[data-liste]');
        const enBas = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 60;
        liste.replaceChildren(...r.messages.filter((m) => moi.filtre !== 'question' || estQuestion(m)).map((m) => {
          const li = el('li', `bo-live-msg${m.coach ? ' bo-live-msg--coach' : ''}${estQuestion(m) ? ' bo-live-msg--question' : ''}${moi.question === m.id ? ' bo-live-msg--ecran' : ''}`);
          const t = el('div', 'bo-live-auteur'); t.append(el('b', '', m.auteur), el('span', 'bo-live-num', heure(m.at)));
          const act = el('div', 'bo-live-msg-act');
          const btn = (lib, p) => { const b = el('button', '', lib); b.type = 'button'; b.addEventListener('click', () => agir(p)); act.append(b); };
          if (!m.coach) btn(moi.question === m.id ? 'Retirer de l\'écran' : 'À l\'écran', { ecran: moi.question === m.id ? null : m.id });
          btn('Épingler', { epingler: m.id }); btn('Masquer', { masquer: m.id });
          li.append(t, el('p', '', m.texte), act); return li;
        }));
        if (!liste.childElementCount) liste.append(el('li', 'bo-live-aide', 'Pas encore de message.'));
        if (enBas) liste.scrollTop = liste.scrollHeight;
        const ep = q('[data-epingle]'); ep.classList.toggle('on', !!r.epingle); ep.replaceChildren();
        if (r.epingle) {
          ep.append(el('small', 'bo-live-mini', 'Épinglé'), el('p', '', r.epingle.texte));
          const b = el('button', 'bo-btn bo-btn--fantome', 'Retirer'); b.type = 'button'; b.addEventListener('click', () => agir({ desepingler: true })); ep.append(b);
        }
      }
    }
    async function tirer() {
      if (R !== moi) return;
      if (!surCetEcran()) { arreter(); return; }
      try { rendre(await rpc('live_regie', { p_live: id })); } catch (e) { aide.textContent = e.message; }
    }
    const boucle = () => { if (R !== moi) return; clearTimeout(moi.minuteur); tirer(); moi.minuteur = window.setTimeout(boucle, document.hidden ? 10000 : 3000); };
    rendre(d);
    moi.minuteur = window.setTimeout(boucle, 3000);
  }

  async function charger(params, z) {
    const id = Number(params && params.get('id'));
    if (Number.isInteger(id) && id > 0) return regie(z, id);
    return liste(z);
  }
  window.addEventListener('hashchange', () => { if (!surCetEcran()) arreter(); });
  window.LivesRegie = { charger, youtubeId, _txt: txt };
})();
