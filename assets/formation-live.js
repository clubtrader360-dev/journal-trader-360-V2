/**
 * LES LIVES MEMBRES, CÔTÉ MEMBRE (29/10/2026, demande de Nadir).
 *
 * « La même chose que le webinaire, mais pour nos lives membres, dans l'espace
 * membre. » Une salle dans l'espace formation : la vidéo YouTube (non répertoriée,
 * lecteur intégré, aucun lien vers YouTube), le chat, la prise de parole en vidéo,
 * le sondage et la question à l'écran, l'écran de fin.
 *
 * ── D'OÙ VIENNENT LES DONNÉES ───────────────────────────────────────────────
 * Uniquement des fonctions de `migrations/06-lives-membres.sql`, appelées par
 * `window.supabaseClient.rpc(...)`. ⛔ Aucune lecture de table en direct : les
 * tables live_* n'ont AUCUNE politique RLS, et c'est voulu (un message ne doit
 * jamais exposer l'identifiant de son auteur). La barrière est dans chaque
 * fonction : `a_acces_formation()`, la même que les leçons.
 *
 * ── ⛔ LES PIÈGES DÉJÀ PAYÉS SUR CE DÉPÔT ───────────────────────────────────
 *  · Le client est `window.supabaseClient`, jamais `window.supabase` (la
 *    bibliothèque UMD). Résolu à chaque appel.
 *  · `rpc()` ne lève pas : il rend `{ data, error }`. Chaque appel teste `error`.
 *  · Masquer passe par une CLASSE (display posé par la feuille), jamais par
 *    l'attribut `hidden` seul : une règle d'auteur sur `display` l'emporte.
 *  · Tout texte écrit par un membre passe par `textContent`. Seuls les messages
 *    de Trader 360 rendent leurs liens cliquables, et en https seulement.
 *  · Une iframe déplacée dans la page se RECHARGE : la fenêtre « Ta caméra » est
 *    posée une fois et n'est jamais redessinée (essai du webinaire, 29/10).
 *
 * Branché par `supabase-formation.js` : `aller('live')` appelle `ouvrir()`.
 */
(function () {
  'use strict';

  const cli = () => window.supabaseClient;
  const $f = () => document.getElementById('formation');
  const el = (tag, cls, texte) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; };
  const PARIS = 'Europe/Paris';
  const heure = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: PARIS });
  const jourHeure = (iso) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: PARIS }).replace(':', ' h ');

  async function rpc(nom, args) {
    const c = cli();
    if (!c) throw new Error('connexion indisponible, recharge la page');
    const { data, error } = await c.rpc(nom, args || {});
    if (error) throw new Error(error.message || 'action non enregistrée, réessaie');
    return data;
  }

  /** Une adresse VDO.Ninja. Les paramètres sans valeur s'écrivent nus. */
  const vdo = (p) => 'https://vdo.ninja/?' + p.map(([k, v]) => (v === undefined ? k : `${k}=${encodeURIComponent(v)}`)).join('&');

  function texteEn(parent, texte, liens) {
    if (!liens) { parent.textContent = texte; return; }
    for (const morceau of String(texte).split(/(https:\/\/[^\s]+)/g)) {
      if (/^https:\/\/[^\s]+$/.test(morceau)) {
        const a = document.createElement('a'); a.href = morceau; a.textContent = morceau.replace(/^https:\/\//, ''); a.target = '_blank'; a.rel = 'noopener';
        parent.append(a);
      } else parent.append(document.createTextNode(morceau));
    }
  }

  /* ══ LE POINT « EN DIRECT » DANS LA BARRE ══════════════════════════════════ */
  // Relu toutes les 60 s tant que l'espace formation est ouvert : un membre qui est
  // sur ses modules voit que le live commence.
  let _veille = 0;
  async function veiller() {
    const app = document.getElementById('formationApp');
    const btns = document.querySelectorAll('#formationApp .top [data-go="live"]');
    if (!app || !btns.length || getComputedStyle(app).display === 'none') return;
    try {
      const d = await rpc('live_courant');
      const direct = !!(d && d.live && d.live.etat === 'direct');
      btns.forEach((b) => {
        b.classList.toggle('nav-live--direct', direct);
        b.setAttribute('aria-label', direct ? 'Live, en direct maintenant' : 'Live');
      });
    } catch { /* le passage suivant réessaie */ }
  }
  function demarrerVeille() { if (_veille) { veiller(); return; } veiller(); _veille = window.setInterval(veiller, 60000); }

  /* ══ LA PAGE ═══════════════════════════════════════════════════════════════ */
  let S = null; // l'état de la page ouverte, ou null
  /**
   * ⛔ LA GÉNÉRATION (revue du 29/10). `ouvrir()` attend le serveur : deux clics
   * rapides, ou un compte à rebours qui rouvre, lançaient deux pages en parallèle.
   * Chaque ouverture prend un numéro ; après chaque attente, une ouverture qui n'est
   * plus la dernière s'arrête là.
   */
  let _generation = 0;
  /** Écart entre l'horloge du serveur et celle du membre (ms) : un compte à rebours juste même si son ordinateur dérive. */
  let _decalage = 0;
  const maintenant = () => Date.now() + _decalage;

  function fermer() {
    if (!S) return;
    clearTimeout(S.minuteur); clearInterval(S.pouls); clearInterval(S.compte);
    if (S.sortir) S.sortir();
    if (S.surVisibilite) document.removeEventListener('visibilitychange', S.surVisibilite);
    if (S.surPleinEcran) document.removeEventListener('fullscreenchange', S.surPleinEcran);
    S = null;
  }

  /** La page « Live » : le live courant, ou le prochain, ou rien de prévu. */
  async function ouvrir() {
    fermer();
    const gen = ++_generation;
    const f = $f(); if (!f) return;
    f.innerHTML = '<section class="live"><p class="live__charge">Chargement du live…</p></section>';
    let d;
    try { d = await rpc('live_courant'); }
    catch (e) { if (gen === _generation) f.replaceChildren(pageVide('Le live est indisponible pour le moment.', e.message)); return; }
    if (gen !== _generation || !document.contains(f)) return;
    if (d && d.maintenant) _decalage = new Date(d.maintenant).getTime() - Date.now();
    if (!d || !d.live) { f.replaceChildren(pageAttente(null, d ? d.prochains : [])); return; }
    if (d.live.etat === 'bientot') { f.replaceChildren(pageAttente(d.live, d.prochains)); return; }
    salle(d.live);
  }

  function pageVide(titre, texte) {
    const s = el('section', 'live live--vide');
    s.append(el('p', 'eyebrow', 'Live membres'), el('h2', 'live__titre', titre));
    if (texte) s.append(el('p', 'live__texte', texte));
    return s;
  }

  function listeProchains(prochains) {
    const ul = el('ul', 'live__prochains');
    for (const p of prochains || []) {
      const li = el('li'); li.append(el('b', '', p.titre), el('span', 'mono', jourHeure(p.debut)));
      ul.append(li);
    }
    return ul;
  }

  /** Avant l'ouverture (plus de 30 min avant le début), ou rien de prévu. */
  function pageAttente(live, prochains) {
    const s = el('section', 'live live--attente');
    s.append(el('p', 'eyebrow', 'Live membres'));
    if (live) {
      s.append(el('h2', 'live__titre', live.titre), el('p', 'live__quand', `${jourHeure(live.debut)}, heure de Paris`));
      const c = el('p', 'live__compte mono'); s.append(c);
      s.append(el('p', 'live__texte', 'La salle ouvre 30 minutes avant le début. Reviens ici, ou garde l’onglet ouvert : elle s’ouvre toute seule.'));
      let rouvert = false;
      const maj = () => {
        const ms = new Date(live.debut).getTime() - 30 * 60000 - maintenant();
        // Une seule réouverture : la suivante n'a lieu que si le serveur dit encore « bientôt ».
        if (ms <= 0) { if (!rouvert) { rouvert = true; ouvrir(); } return; }
        const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
        c.textContent = `Ouverture dans ${h ? `${h} h ` : ''}${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s`;
      };
      maj();
      const moi = { compte: 0 };
      // ⛔ Le minuteur ne ferme que SA page : jamais une salle ouverte entre-temps.
      moi.compte = window.setInterval(() => { if (S !== moi) { clearInterval(moi.compte); return; } if (!document.contains(c)) { fermer(); return; } maj(); }, 1000);
      S = moi;
    } else {
      s.append(el('h2', 'live__titre', 'Pas de live prévu pour l’instant.'),
        el('p', 'live__texte', 'Les prochains lives s’afficheront ici, avec leur date et leur heure.'));
    }
    if (prochains && prochains.length) { s.append(el('p', 'live__sous', 'Les prochains lives'), listeProchains(prochains)); }
    return s;
  }

  /* ══ LA SALLE ══════════════════════════════════════════════════════════════ */
  function salle(live) {
    const f = $f();
    const sec = el('section', 'live live--salle');
    const sur = el('p', 'eyebrow live__sur'); sur.append(el('span', 'live__point'), document.createTextNode(' Live · '), el('span', 'mono', heure(live.debut)));
    sec.append(sur, el('h2', 'live__titre', live.titre));

    const scene = el('div', 'live__scene');
    // ── La vidéo ──
    const colV = el('div', 'live__video');
    const cadre = el('div', 'live__cadre');
    let iframe = null;
    if (live.youtube) {
      iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(live.youtube)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      iframe.title = live.titre;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.setAttribute('allowfullscreen', '');
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      cadre.append(iframe);
    } else {
      cadre.append(el('p', 'live__cadre-vide', 'La vidéo arrive : elle s’affiche ici dès que le direct démarre.'));
    }
    const bandeau = el('div', 'live__bandeau'); const bandAuteur = el('small'); const bandTexte = el('p'); bandeau.append(bandAuteur, bandTexte);
    const fin = el('div', 'live__fin'); fin.setAttribute('aria-live', 'polite');
    const retour = el('button', 'btn btn-gold live__fin-bouton', 'Revenir à mon parcours'); retour.type = 'button'; retour.dataset.go = 'accueil';
    fin.append(el('p', 'live__fin-sur', 'Le live est terminé'), el('h3', 'live__fin-titre', 'Merci d’avoir été là.'),
      el('p', 'live__fin-texte', 'Le replay sera mis en ligne dans ton espace. À très vite pour le prochain live.'), retour);
    cadre.append(bandeau, fin);
    const bas = el('div', 'live__bas');
    const plein = el('button', 'btn btn-ghost live__plein'); plein.type = 'button';
    const pleinTxt = el('span', '', 'Plein écran avec le chat');
    plein.append(el('span', '', '⛶'), pleinTxt);
    bas.append(plein);
    colV.append(cadre, bas, el('p', 'live__risque', 'Le trading comporte un risque de perte en capital.'));

    // ── Le chat ──
    const chat = el('aside', 'live__chat'); chat.setAttribute('aria-label', 'Le chat du live');
    const tete = el('div', 'live__chat-tete'); const etat = el('span', 'live__chat-etat'); tete.append(el('h3', '', 'Le chat'), etat);
    const epingle = el('div', 'live__epingle');
    const sondage = el('div', 'live__sondage');
    const liste = el('ol', 'live__liste'); liste.setAttribute('aria-live', 'polite');
    const parole = el('div', 'live__parole'); parole.setAttribute('aria-live', 'polite');
    // ⛔ HORS du bloc « parole », qui est redessiné : posé une fois, jamais déplacé.
    const maCam = el('div', 'live__ma-camera');
    const maCamCadre = el('div', 'live__ma-camera-cadre');
    const maVideo = document.createElement('video'); maVideo.autoplay = true; maVideo.muted = true; maVideo.playsInline = true;
    const monFlux = document.createElement('iframe'); monFlux.title = 'Ta caméra dans le live'; monFlux.allow = 'autoplay; camera; microphone';
    maCamCadre.append(maVideo, monFlux); maCam.append(el('small', 'live__ma-camera-titre', 'Ta caméra · tu es dans le live'), maCamCadre);
    const form = el('form', 'live__form');
    const zone = document.createElement('textarea'); zone.rows = 2; zone.maxLength = 400; zone.required = true;
    zone.placeholder = 'Ta question…'; zone.setAttribute('aria-label', 'Ton message');
    const ligne = el('div', 'live__form-bas'); const aide = el('span', 'live__aide', 'Entrée pour envoyer');
    const envoyer = el('button', 'btn btn-gold live__petit', 'Envoyer'); envoyer.type = 'submit';
    ligne.append(aide, envoyer); form.append(zone, ligne);
    chat.append(tete, epingle, sondage, liste, parole, maCam, form);

    scene.append(colV, chat);
    sec.append(scene);
    f.replaceChildren(sec);

    /* ── L'état local ── */
    S = { id: live.id, minuteur: 0, pouls: 0, compte: 0, signature: '', locaux: [], sigSondage: '', sigParole: '', finAppliquee: false,
      paroleStatut: 'aucune', surScene: '', apercu: null, srcVideo: iframe ? iframe.src : '', votes: {}, dernierCourant: Date.now() };
    try { S.votes = JSON.parse(sessionStorage.getItem('t360.liveVotes') || '{}'); } catch { /* stockage indisponible */ }
    const moi = S;

    /* ── Le chat ── */
    function ligneMsg(m) {
      const li = el('li', `live__msg${m.coach ? ' live__msg--coach' : ''}`);
      const t = el('div', 'live__auteur'); t.append(el('b', '', m.auteur), el('span', 'mono', heure(m.at)));
      const p = el('p'); texteEn(p, m.texte, m.coach);
      li.append(t, p); return li;
    }
    function rendreChat(d) {
      // Un message envoyé s'affiche tout de suite, puis le serveur fait foi : rendu par lui, ou
      // retiré au bout de 15 s (masqué par la régie entre-temps, il ne doit pas rester chez son auteur).
      moi.locaux = moi.locaux.filter((l) => !d.messages.some((m) => m.id === l.id) && Date.now() - new Date(l.at).getTime() < 15000);
      const tous = [...d.messages, ...moi.locaux];
      const sig = JSON.stringify([tous.map((m) => m.id), d.epingle && d.epingle.id]);
      if (sig === moi.signature) return;
      // ⚠️ Collé en bas au premier rendu, puis seulement si le membre y était déjà :
      // on ne l'arrache pas à un message plus haut qu'il est en train de lire.
      const enBas = !moi.signature || liste.scrollHeight - liste.scrollTop - liste.clientHeight < 60;
      moi.signature = sig;
      liste.replaceChildren(...tous.map(ligneMsg));
      if (!tous.length) liste.append(el('li', 'live__vide', 'Pas encore de message. Pose ta question, on y répond en direct.'));
      moi.collerEnBas = enBas;
      epingle.classList.toggle('on', !!d.epingle); epingle.replaceChildren();
      if (d.epingle) { epingle.append(el('span', 'live__epingle-titre', 'Épinglé par Trader 360')); const p = el('p'); texteEn(p, d.epingle.texte, d.epingle.coach); epingle.append(p); }
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texte = zone.value.trim(); if (!texte) return;
      envoyer.disabled = true;
      try {
        const m = await rpc('live_ecrire', { p_live: moi.id, p_texte: texte });
        zone.value = ''; aide.textContent = 'Entrée pour envoyer';
        // Affiché tout de suite : l'appel suivant le confirme.
        moi.locaux.push(m); moi.signature = 'force'; await tirer(); liste.scrollTop = liste.scrollHeight;
      } catch (err) { aide.textContent = err.message; }
      finally { envoyer.disabled = false; zone.focus(); }
    });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

    /* ── Le sondage ── */
    function rendreSondage(d) {
      const s = d.sondage;
      const sig = JSON.stringify([s && s.id, s && s.resultats, s && s.clos, s && moi.votes[s.id]]);
      if (sig === moi.sigSondage) return; moi.sigSondage = sig;
      sondage.classList.toggle('on', !!s); sondage.replaceChildren(); if (!s) return;
      const voir = s.clos || moi.votes[s.id] != null;
      sondage.append(el('small', 'live__sondage-titre', s.clos ? 'Résultats du sondage' : 'Sondage'), el('p', 'live__sondage-q', s.question));
      s.choix.forEach((c, k) => {
        const pc = s.total ? Math.round((s.resultats[k] * 100) / s.total) : 0;
        const b = el('button', `live__choix${moi.votes[s.id] === k ? ' live__choix--moi' : ''}`); b.type = 'button'; b.disabled = voir;
        const barre = el('i'); barre.style.width = voir ? `${pc}%` : '0';
        b.append(barre, el('span', '', c)); if (voir) b.append(el('em', 'mono', `${pc} %`));
        b.addEventListener('click', async () => {
          moi.votes[s.id] = k; try { sessionStorage.setItem('t360.liveVotes', JSON.stringify(moi.votes)); } catch { /* rien */ }
          moi.sigSondage = ''; rendreSondage(d);
          try { await rpc('live_voter', { p_sondage: s.id, p_choix: k }); await tirer(); } catch (err) { delete moi.votes[s.id]; moi.sigSondage = ''; aide.textContent = err.message; }
        });
        sondage.append(b);
      });
      if (voir) sondage.append(el('span', 'live__sondage-total mono', `${s.total} réponse${s.total > 1 ? 's' : ''}`));
    }

    /* ── La prise de parole ── */
    function sourdine(on) {
      if (!iframe || moi.finAppliquee) return;
      const voulu = on ? (/[?&]mute=1/.test(moi.srcVideo) ? moi.srcVideo : `${moi.srcVideo}&mute=1`) : moi.srcVideo;
      if (iframe.src !== voulu) iframe.src = voulu;
    }
    function entrer(lien) {
      if (moi.surScene === lien) return;
      moi.surScene = lien; maCam.classList.add('on'); sourdine(true);
      monFlux.src = lien;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then((m) => {
            // ⛔ Accordé APRÈS « Quitter », la fin du live ou un changement de page : on coupe
            // tout de suite, sinon la caméra resterait allumée sans que rien ne la montre.
            if (S !== moi || moi.surScene !== lien) { m.getTracks().forEach((tr) => tr.stop()); return; }
            moi.apercu = m; maVideo.srcObject = m;
          })
          .catch(() => { /* l'aperçu est un confort : le flux part par l'iframe quoi qu'il arrive */ });
      }
    }
    function sortir() {
      if (!moi.surScene) return;
      moi.surScene = '';
      if (moi.apercu) moi.apercu.getTracks().forEach((tr) => tr.stop()); moi.apercu = null;
      maVideo.srcObject = null; monFlux.src = 'about:blank'; maCam.classList.remove('on');
      sourdine(false);
    }
    moi.sortir = sortir;
    function lienInvite(p) {
      const v = p.vdo;
      // `novideo` : il ne reçoit pas la vidéo des autres (il regarde le live), seulement leur son.
      return vdo([['room', v.room], ['password', v.password], ['push', v.flux], ['label', p.auteur || 'Membre'], ['webcam'], ['autostart'], ['cleanish'], ['novideo']]);
    }
    async function agirParole(quoi) {
      try { rendreParole(await rpc('live_parole_membre', { p_live: moi.id, p_quoi: quoi }), moi.paroleOuverte); }
      catch (e) { aide.textContent = e.message; moi.sigParole = ''; rendreParole({ statut: moi.paroleStatut }, moi.paroleOuverte); }
    }
    function rendreParole(p, ouverte) {
      moi.paroleStatut = p.statut; moi.paroleOuverte = ouverte;
      const sig = JSON.stringify([p, ouverte, moi.finAppliquee, moi.surScene]); if (sig === moi.sigParole) return; moi.sigParole = sig;
      if (p.statut !== 'invite') sortir();
      const visible = !moi.finAppliquee && (ouverte || p.statut === 'attente' || p.statut === 'invite');
      parole.classList.toggle('on', visible); parole.classList.toggle('live__parole--scene', p.statut === 'invite');
      parole.replaceChildren(); if (!visible) return;
      const bouton = (libelle, cls, quoi) => { const b = el('button', `btn ${cls} live__petit`, libelle); b.type = 'button'; b.addEventListener('click', () => { b.disabled = true; agirParole(quoi); }); return b; };
      if (p.statut === 'attente') {
        parole.append(el('span', '', `Demande envoyée. Tu es ${p.rang === 1 ? 'le prochain' : `n° ${p.rang}`} dans la file.`), bouton('Annuler', 'btn-ghost', 'annuler'));
        return;
      }
      if (p.statut === 'invite' && p.vdo) {
        const lien = lienInvite(p);
        parole.append(el('b', 'live__parole-titre', moi.surScene ? 'Tu es dans le live.' : 'Les coachs t’invitent à prendre la parole.'));
        if (!moi.surScene) {
          parole.append(el('span', '', 'Clique sur « Rejoindre », puis autorise caméra et micro. Tu continues à voir le live.'));
          const b = el('button', 'btn btn-gold live__petit', 'Rejoindre'); b.type = 'button';
          b.addEventListener('click', () => { entrer(lien); rpc('live_parole_membre', { p_live: moi.id, p_quoi: 'rejoindre' }).catch(() => null); moi.sigParole = ''; rendreParole(p, ouverte); });
          parole.append(b);
        } else {
          parole.append(el('span', 'live__discret', 'La vidéo est en sourdine pour éviter l’écho : tu entends les coachs en direct dans ta fenêtre.'));
        }
        parole.append(bouton('Quitter', 'btn-ghost', 'annuler'));
        return;
      }
      const mots = {
        termine: 'Merci ! Ta caméra est coupée et le son du live revient.',
        refuse: 'Pas de prise de parole cette fois. Écris ta question dans le chat, on y répond.',
        annule: 'C’est noté. Tu peux redemander la parole quand tu veux.',
      };
      parole.append(bouton('Demander la parole', 'btn-ghost', 'demander'), el('span', 'live__discret', mots[p.statut] || 'Pour poser ta question à l’oral, en vidéo.'));
    }

    /* ── L'écran de fin ── */
    function appliquerFin(estFini) {
      if (!!estFini === moi.finAppliquee) return;
      if (estFini) {
        sortir();
        moi.finAppliquee = true;
        if (iframe) { iframe.src = 'about:blank'; iframe.style.setProperty('visibility', 'hidden', 'important'); }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => null);
      } else {
        moi.finAppliquee = false;
        if (iframe) { iframe.src = moi.srcVideo; iframe.style.removeProperty('visibility'); }
      }
      fin.classList.toggle('on', !!estFini);
      moi.sigParole = '';
    }

    /* ── Plein écran DE LA SCÈNE (vidéo + chat). iPhone : mode immersif. ── */
    const etiquette = (on) => { pleinTxt.textContent = on ? 'Quitter le plein écran' : 'Plein écran avec le chat'; };
    plein.addEventListener('click', async () => {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      if (scene.classList.contains('immersif')) { scene.classList.remove('immersif'); etiquette(false); return; }
      if (scene.requestFullscreen) { try { await scene.requestFullscreen(); return; } catch { /* iPhone : refusé */ } }
      scene.classList.add('immersif'); etiquette(true);
    });
    moi.surPleinEcran = () => etiquette(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', moi.surPleinEcran);

    /* ── La boucle ── */
    async function tirer() {
      // ⛔ La page a été remplacée (le membre est allé sur ses modules) : on s'arrête.
      if (S !== moi || !document.contains(sec)) { if (S === moi) fermer(); return; }
      try {
        const d = await rpc('live_salle', { p_live: moi.id });
        if (S !== moi) return;
        appliquerFin(!!d.fin);
        bandeau.classList.toggle('on', !!d.question && !d.fin);
        if (d.question) { bandAuteur.textContent = `Question de ${d.question.auteur}`; bandTexte.textContent = d.question.texte; }
        etat.textContent = d.ouvert ? 'ouvert' : 'fermé';
        zone.disabled = !d.ouvert;
        if (!d.ouvert) aide.textContent = d.fin ? 'Le live est terminé, merci pour tes messages.' : 'Le chat ouvre 30 minutes avant le début.';
        else if (/terminé, merci|ouvre 30/.test(aide.textContent)) aide.textContent = 'Entrée pour envoyer';
        rendreChat(d); rendreSondage(d);
        rendreParole(d.ma_parole || { statut: 'aucune' }, !!d.parole);
        // Après le sondage et la parole, qui changent la hauteur de la liste.
        if (moi.collerEnBas) { liste.scrollTop = liste.scrollHeight; moi.collerEnBas = false; }
        // La vidéo n'était pas posée à l'ouverture : on relit le live toutes les 30 s et on pose
        // le lecteur dès qu'elle arrive, SANS reconstruire la salle (message en cours, caméra).
        if (!iframe && !d.fin && Date.now() - (moi.dernierCourant || 0) > 30000) {
          moi.dernierCourant = Date.now();
          rpc('live_courant').then((c) => {
            if (S !== moi || iframe || !c || !c.live || c.live.id !== moi.id || !c.live.youtube) return;
            iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(c.live.youtube)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
            iframe.title = live.titre;
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.setAttribute('allowfullscreen', '');
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            moi.srcVideo = iframe.src;
            const vide = cadre.querySelector('.live__cadre-vide'); if (vide) vide.remove();
            cadre.prepend(iframe);
            if (moi.surScene) sourdine(true);
          }).catch(() => null);
        }
      } catch (e) { if (/introuvable/.test(e.message) && S === moi) ouvrir(); }
    }
    const boucle = () => { if (S !== moi) return; clearTimeout(moi.minuteur); tirer(); moi.minuteur = window.setTimeout(boucle, document.hidden ? 10000 : 2500); };
    moi.surVisibilite = boucle;
    document.addEventListener('visibilitychange', moi.surVisibilite);
    boucle();
    // Le pouls : présence et durée de visionnage, toutes les 45 s, onglet visible ou non.
    const pouls = () => { if (S === moi && !moi.finAppliquee) rpc('live_pouls', { p_live: moi.id }).catch(() => null); };
    pouls(); moi.pouls = window.setInterval(pouls, 45000);
  }

  window.FormationLive = { ouvrir, fermer, demarrerVeille, _veiller: veiller };
})();
