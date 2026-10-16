/**
 * LE BACK-OFFICE DES MEMBRES, COTE COACH (tache #54). Ecran `#coachMembres`.
 *
 * Ce que le coach y fait, et rien d autre :
 *   - voir chaque compte : droits, niveau, avancement, quiz, derniere visite ;
 *   - ouvrir ou fermer la formation et le journal, d un interrupteur ;
 *   - poser le niveau (ou laisser celui de LearnyBox) ;
 *   - creer un compte, qui recoit son mail de premiere connexion ;
 *   - renvoyer ce mail ;
 *   - ouvrir le journal d un eleve en lecture seule (coach view #80, existante).
 *
 * ⛔ TOUTE ECRITURE PASSE PAR `/api/coach/membres` : voir l en-tete de la route.
 * Ce fichier ne touche jamais `acces_membre` directement, il n en a pas le droit,
 * et c est voulu.
 * ⚠️ Chaque appel est juge sur `r.ok` ET `c.ok` : un 403 arrive sans lever.
 */
(function () {
  'use strict';

  const cli = () => {
    const c = window.supabaseClient;
    if (!c) console.error('[MEMBRES] ⛔ window.supabaseClient manquant');
    return c;
  };
  const txt = (s) => {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  };
  const $ = (id) => document.getElementById(id);

  const NIVEAUX = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé' };
  const STATUTS = {
    active: { t: 'Actif', c: 'ok' }, approved: { t: 'Actif', c: 'ok' },
    pending: { t: 'En attente', c: 'attend' }, revoked: { t: 'Révoqué', c: 'non' },
    sans_profil: { t: 'Sans profil', c: 'attend' },
    // ⚠️ Un membre LearnyBox qui n a pas encore de compte dans le journal
    // (retour de Nadir du 15/10 : ils doivent etre dans ce tableau).
    sans_compte: { t: 'Sans compte', c: 'attend' },
  };

  let _membres = [];
  let _filtre = 'tous';
  let _recherche = '';
  let _chargement = null;
  /** Le tri : la colonne, et le sens (1 croissant, -1 decroissant). Par defaut, le nom. */
  let _tri = { cle: 'nom', sens: 1 };

  /* ══ L APPEL ═══════════════════════════════════════════════════════════════ */
  async function appeler(action, corps) {
    const { data: s } = await cli().auth.getSession();
    const jeton = s?.session?.access_token;
    if (!jeton) throw new Error('Session expirée, reconnecte-toi.');
    const r = await fetch('/api/coach/membres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action, ...(corps || {}) }),
    });
    const c = await r.json().catch(() => ({}));
    if (!r.ok || !c.ok) throw new Error(c.motif || `réponse ${r.status}`);
    return c.resultat;
  }

  function dire(message, type) {
    if (window.showNotification) window.showNotification(message, type || 'success');
    else console.log('[MEMBRES]', message);
  }

  /* ══ LES MESURES ═══════════════════════════════════════════════════════════ */
  const totalLecons = () => (window.FormationDonnees && window.FormationDonnees.total()) || 0;
  const totalQuiz = () => (window.FORMATION_QUIZ ? Object.keys(window.FORMATION_QUIZ).length : 0);

  function depuis(iso) {
    if (!iso) return { t: 'jamais', absent: true };
    const jours = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (jours >= 21) return { t: `il y a ${jours} j`, absent: true };
    if (jours >= 2) return { t: `il y a ${jours} j`, absent: false };
    if (jours === 1) return { t: 'hier', absent: false };
    return { t: "aujourd'hui", absent: false };
  }

  function niveauEffectif(m) {
    if (m.niveau_coach) return { cle: m.niveau_coach, source: 'coach' };
    if (m.niveau_learnybox) return { cle: m.niveau_learnybox, source: 'learnybox' };
    return { cle: null, source: null };
  }

  /* ══ LE FILTRE ═════════════════════════════════════════════════════════════ */
  function visibles() {
    const q = _recherche.trim().toLowerCase();
    return _membres.filter((m) => {
      if (q && !`${m.nom} ${m.email}`.toLowerCase().includes(q)) return false;
      if (_filtre === 'coachs') return m.role !== 'student';
      if (m.role !== 'student') return false;
      if (_filtre === 'sans_compte') return !!m.sans_compte;
      // ⚠️ « Sans journal » / « Sans formation » parlent des droits d un compte :
      // un membre sans compte n a pas de droits a montrer, il a son propre filtre.
      if ((_filtre === 'sans_journal' || _filtre === 'sans_formation' || _filtre === 'demandes') && m.sans_compte) return false;
      if (_filtre === 'sans_journal' && m.journal) return false;
      if (_filtre === 'sans_formation' && m.formation) return false;
      if (_filtre === 'demandes' && !m.journal_demande_le) return false;
      if (_filtre === 'absents' && !depuis(m.derniere_activite).absent) return false;
      return true;
    });
  }

  /* ══ LE TRI ════════════════════════════════════════════════════════════════
   * Demande de Nadir du 15/10 : « des flèches pour trier par niveau, débutants
   * en haut et confirmés en bas ou l inverse ; pareil pour les accès,
   * l avancement et les dernières visites ». Chaque colonne a sa cle de tri,
   * une valeur par membre, comparable. Les membres sans compte se classent
   * avec leur pourcentage LearnyBox pour l avancement. */
  const RANG_NIVEAU = { debutant: 1, intermediaire: 2, confirme: 3 };
  const CLES_TRI = {
    nom: (m) => String(m.nom || m.email || '').toLowerCase(),
    niveau: (m) => RANG_NIVEAU[niveauEffectif(m).cle] || 0,
    acces: (m) => (m.sans_compte ? -1 : (m.formation ? 1 : 0) + (m.journal ? 2 : 0)),
    avancement: (m) => (m.sans_compte ? (m.learnybox_pct || 0) / 100 : (totalLecons() ? m.lecons_vues / totalLecons() : 0)),
    quiz: (m) => m.quiz_reussis.length,
    visite: (m) => (m.derniere_activite ? Date.parse(m.derniere_activite) : 0),
  };
  const TITRES = [
    ['nom', 'Membre'], ['niveau', 'Niveau'], ['acces', 'Accès'], ['avancement', 'Avancement'],
    ['quiz', 'Quiz'], ['visite', 'Dernière visite'],
  ];
  function trier(liste) {
    const f = CLES_TRI[_tri.cle] || CLES_TRI.nom;
    const nomDe = CLES_TRI.nom;
    return liste.slice().sort((a, b) => {
      const x = f(a); const y = f(b);
      let c = typeof x === 'string' ? x.localeCompare(y, 'fr') : (x - y);
      if (c === 0) c = nomDe(a).localeCompare(nomDe(b), 'fr');
      return c * _tri.sens;
    });
  }
  function enTete() {
    return TITRES.map(([cle, titre]) => {
      const actif = _tri.cle === cle;
      const sens = actif ? (_tri.sens === 1 ? 'ascending' : 'descending') : 'none';
      return `<th aria-sort="${sens}"><button type="button" class="am-tri ${actif ? 'am-tri--actif' : ''}" data-tri="${cle}" title="Trier par ${titre.toLowerCase()}">
        <span>${titre}</span><i class="am-tri__fleches" aria-hidden="true"><b class="${actif && _tri.sens === 1 ? 'on' : ''}">&#9650;</b><b class="${actif && _tri.sens === -1 ? 'on' : ''}">&#9660;</b></i></button></th>`;
    }).join('') + '<th></th>';
  }

  /* ══ LE RENDU ══════════════════════════════════════════════════════════════ */
  /**
   * Les signalements coach (audit du 16/10) : une pastille par signalement,
   * et sa note en infobulle. Rembourse et revoque en gris, gele en or, doublon
   * et note en neutre : ce sont des etats administratifs, pas des resultats.
   */
  const SIGNAUX = { rembourse: ['Remboursé', 'non'], gele: ['Gelé', 'attend'], revoque: ['Révoqué', 'non'], offert: ['Offert', 'ok'], doublon: ['Doublon', 'attend'], note: ['Note', 'attend'] };
  const pastillesSignalement = (liste) => (liste || []).map((x) => { const [t, c] = SIGNAUX[x.type] || [x.type, 'attend']; return `<small class="am-statut am-statut--${c} am-signal" title="${txt(x.note || '')}${x.reference_email ? ` · ${txt(x.reference_email)}` : ''}">${t}${x.montant ? ` · ${txt(Number(x.montant).toLocaleString('fr-FR'))} €` : ''}</small>`; }).join('');
  /** La ligne d un membre LearnyBox sans compte : ce qu on sait, et le bouton. */
  function ligneSansCompte(m) {
    const d = depuis(m.derniere_activite);
    return `<tr data-lb="${txt(m.learnybox_id || '')}" data-email="${txt(m.email)}" class="am-sans-compte">
      <td class="am-qui">
        <b>${txt(m.nom || 'Nom non renseigné')}</b>
        <span>${txt(m.email)}</span>
        <small class="am-statut am-statut--attend">${m.signale_seulement ? 'Hors LearnyBox, sans compte' : `Sans compte${m.learnybox_actif === false ? ' · inactif LearnyBox' : ''}`}</small>
        ${pastillesSignalement(m.signalements)}
      </td>
      <td class="am-niveau">
        <span class="am-niveau-fixe">${m.niveau_learnybox ? txt(NIVEAUX[m.niveau_learnybox] || m.niveau_learnybox) : 'Non posé'}</span>
        <small>LearnyBox${m.learnybox_pct != null ? ` · ${m.learnybox_pct} %` : ''}</small>
      </td>
      <td class="am-droit"><small>Aucun compte dans le journal : ses droits se posent à la création.</small></td>
      <td class="am-avance"><small>Sa progression LearnyBox sera reportée à la création du compte.</small></td>
      <td class="am-quiz">·</td>
      <td class="am-visite ${d.absent ? 'am-absent' : ''}">${txt(d.t)}</td>
      <td class="am-actions">
        <button type="button" data-fiche title="Ouvrir la fiche du membre" aria-label="Fiche">&#128065;</button>
        ${m.signale_seulement || (m.signalements || []).some((x) => x.type === 'doublon') ? '' : '<button type="button" class="am-actions__or" data-creer-depuis title="Créer son compte à partir de LearnyBox">Créer le compte</button>'}
      </td>
    </tr>`;
  }

  function ligne(m) {
    if (m.sans_compte) return ligneSansCompte(m);
    const st = STATUTS[m.statut] || { t: m.statut, c: 'attend' };
    const niv = niveauEffectif(m);
    const tl = totalLecons();
    const pct = tl ? Math.round((m.lecons_vues / tl) * 100) : 0;
    const tq = totalQuiz();
    const d = depuis(m.derniere_activite);
    const eleve = m.role === 'student';
    const options = [
      `<option value="" ${m.niveau_coach ? '' : 'selected'}>${m.niveau_learnybox ? `LearnyBox : ${NIVEAUX[m.niveau_learnybox] || m.niveau_learnybox}` : 'Non posé'}</option>`,
      ...Object.entries(NIVEAUX).map(([k, v]) => `<option value="${k}" ${m.niveau_coach === k ? 'selected' : ''}>${v}</option>`),
    ].join('');
    return `<tr data-uid="${txt(m.user_id)}" class="${eleve ? '' : 'am-coach'}">
      <td class="am-qui">
        <b>${txt(m.nom || 'Nom non renseigné')}</b>
        <span>${txt(m.email)}</span>
        <small class="am-statut am-statut--${st.c}">${txt(st.t)}${eleve ? '' : ' · coach'}</small>
        ${m.learnybox_actif === false ? '<small class="am-statut am-statut--non am-signal" title="Désactivé dans LearnyBox : formation et journal fermés à l import. Les cases ci-contre les rouvrent.">Désactivé LearnyBox</small>' : ''}
        ${pastillesSignalement(m.signalements)}
      </td>
      <td class="am-niveau">
        <select aria-label="Niveau" data-niveau ${eleve ? '' : 'disabled'}>${options}</select>
        ${niv.source === 'coach' ? '<small>posé par le coach</small>' : niv.source === 'learnybox' ? `<small>LearnyBox${m.learnybox_pct != null ? ` · ${m.learnybox_pct} %` : ''}</small>` : '<small>aucune source</small>'}
      </td>
      <td class="am-droit">
        <label class="am-switch"><input type="checkbox" data-droit="formation" ${m.formation ? 'checked' : ''}><i></i><span>Formation</span></label>
        <label class="am-switch"><input type="checkbox" data-droit="journal" ${m.journal ? 'checked' : ''}><i></i><span>Journal</span></label>
        ${m.journal_demande_le ? `<small class="am-demande">demande ${txt(depuis(m.journal_demande_le).t)}</small>` : ''}
        ${!m.journal && m.journal_retire_le ? `<small>retiré ${txt(depuis(m.journal_retire_le).t)}</small>` : ''}
      </td>
      <td class="am-avance">
        <div class="am-barre"><i style="width:${pct}%"></i></div>
        <span>${m.lecons_vues}${tl ? ` / ${tl}` : ''} · ${pct} %</span>
      </td>
      <td class="am-quiz"><b>${m.quiz_reussis.length}</b>${tq ? ` / ${tq}` : ''}</td>
      <td class="am-visite ${d.absent ? 'am-absent' : ''}">${txt(d.t)}</td>
      <td class="am-actions">
        <button type="button" data-fiche title="Ouvrir la fiche du membre" aria-label="Fiche">&#128065;</button>
        ${m.journal && eleve ? `<button type="button" data-voir title="Ouvrir son journal en lecture seule">Journal</button>` : ''}
        <button type="button" data-mail title="Renvoyer le mail de première connexion">Mail</button>
      </td>
    </tr>`;
  }

  function rendre() {
    const zone = $('coachMembresListe');
    if (!zone) return;
    const liste = trier(visibles());
    const compteur = $('coachMembresCompte');
    const eleves = _membres.filter((m) => m.role === 'student');
    const sansCompte = eleves.filter((m) => m.sans_compte).length;
    if (compteur) compteur.textContent = `${liste.length} sur ${eleves.length} membres${sansCompte ? ` (${sansCompte} sans compte)` : ''}`;
    const bm = $('coachMembresCreerManquants');
    if (bm) { const n = eleves.filter((m) => m.sans_compte && m.learnybox_actif !== false).length; bm.hidden = n === 0; bm.querySelector('span').textContent = String(n); }
    if (!liste.length) {
      zone.innerHTML = '<p class="am-vide">Personne ne correspond.</p>';
      return;
    }
    zone.innerHTML = `<div class="am-enveloppe"><table class="am-table">
      <thead><tr>${enTete()}</tr></thead>
      <tbody>${liste.map(ligne).join('')}</tbody></table></div>`;
  }

  /* ══ LES ACTIONS ═══════════════════════════════════════════════════════════ */
  function membreDe(el) {
    const tr = el.closest('tr[data-uid]');
    if (tr) return _membres.find((m) => m.user_id === tr.dataset.uid) || null;
    // ⚠️ Dans la fiche, pas de ligne : le membre est celui de la fiche ouverte.
    if (el.closest('#coachMembreFiche')) return membreDeLaFiche();
    return null;
  }

  async function changerDroit(input) {
    const m = membreDe(input);
    if (!m) return;
    const quoi = input.dataset.droit;
    const oui = input.checked;
    if (!oui) {
      const ok = window.confirm(`Fermer ${quoi === 'journal' ? 'le journal' : 'la formation'} à ${m.nom || m.email} ? Cette personne ne pourra plus y entrer.`);
      if (!ok) { input.checked = true; return; }
    }
    input.disabled = true;
    try {
      await appeler('droits', { user_id: m.user_id, [quoi]: oui });
      m[quoi] = oui;
      if (quoi === 'journal') { m.journal_demande_le = null; m.journal_retire_le = oui ? null : new Date().toISOString(); }
      dire(`${quoi === 'journal' ? 'Journal' : 'Formation'} ${oui ? 'ouvert' : 'fermé'}${quoi === 'formation' ? 'e' : ''} pour ${m.nom || m.email}.`);
      rendre();
      if (_fiche && _fiche.acces) { _fiche.acces[quoi === 'journal' ? 'journal_actif' : 'formation_actif'] = oui; rendreFiche(); }
      if (window.DemandesJournal) window.DemandesJournal.majCompteur();
    } catch (e) {
      input.checked = !oui;
      dire(`Le droit n a pas été changé : ${e.message}`, 'error');
    } finally { input.disabled = false; }
  }

  async function changerNiveau(select) {
    const m = membreDe(select);
    if (!m) return;
    const n = select.value || null;
    select.disabled = true;
    try {
      await appeler('niveau', { user_id: m.user_id, niveau: n });
      m.niveau_coach = n;
      dire(n ? `Niveau ${NIVEAUX[n]} posé pour ${m.nom || m.email}.` : `Niveau rendu à LearnyBox pour ${m.nom || m.email}.`);
      rendre();
    } catch (e) {
      dire(`Le niveau n a pas été changé : ${e.message}`, 'error');
      rendre();
    }
  }

  async function renvoyerMail(bouton) {
    const m = membreDe(bouton);
    if (!m) return;
    if (!window.confirm(`Envoyer à ${m.email} le mail de première connexion (lien pour choisir un mot de passe) ?`)) return;
    bouton.disabled = true;
    try {
      await appeler('renvoyer_mail', { user_id: m.user_id });
      dire(`Mail envoyé à ${m.email}.`);
    } catch (e) {
      dire(`Le mail n est pas parti : ${e.message}`, 'error');
    } finally { bouton.disabled = false; }
  }

  function voirJournal(bouton) {
    const m = membreDe(bouton);
    if (!m) return;
    if (window.CoachView && typeof window.CoachView.enter === 'function') window.CoachView.enter(m.user_id, m.nom || m.email);
    else dire('La vue coach n est pas disponible.', 'error');
  }

  /* ══ LA CREATION ═══════════════════════════════════════════════════════════ */
  /**
   * @param {object} [depuis] un membre LearnyBox sans compte : le formulaire
   *   part de ce qu on sait de lui (prenom, nom, email, niveau), rien a resaisir.
   */
  function ouvrirCreation(depuis) {
    const f = $('coachMembreCreer');
    if (!f) return;
    f.hidden = false;
    const form = f.querySelector('form');
    form.reset();
    if (depuis) {
      form.elements.prenom.value = depuis.prenom || '';
      form.elements.nom.value = depuis.nom_famille || '';
      form.elements.email.value = depuis.email || '';
      // ⚠️ Le niveau reste « Non posé » : LearnyBox le fournit par l email, et
      // un niveau pose ici l emporterait sur lui pour toujours.
      form.elements.niveau.value = '';
    }
    f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const e = form.elements[depuis ? 'email' : 'prenom'];
    if (e) setTimeout(() => e.focus(), 30);
  }
  function fermerCreation() { const f = $('coachMembreCreer'); if (f) f.hidden = true; }

  async function creer(form) {
    const d = new FormData(form);
    const corps = {
      prenom: String(d.get('prenom') || '').trim(),
      nom: String(d.get('nom') || '').trim(),
      email: String(d.get('email') || '').trim(),
      niveau: String(d.get('niveau') || '') || null,
      formation: d.get('formation') === 'on',
      journal: d.get('journal') === 'on',
      envoyer_mail: d.get('envoyer_mail') === 'on',
    };
    if (!corps.prenom || !corps.email) { dire('Prénom et email sont nécessaires.', 'error'); return; }
    const b = form.querySelector('[type=submit]');
    b.disabled = true; b.textContent = 'Création…';
    try {
      const r = await appeler('creer', corps);
      const prog = r.progression && r.progression.chapitres_coches != null ? `, progression LearnyBox reportée` : '';
      dire(`Compte créé pour ${r.email}${r.mail_envoye ? ', mail de connexion envoyé' : ', sans mail'}${prog}.`);
      fermerCreation();
      await charger(true);
    } catch (e) {
      dire(`Le compte n a pas été créé : ${e.message}`, 'error');
    } finally { b.disabled = false; b.textContent = 'Créer le compte'; }
  }

  /* ══ TOUS LES COMPTES MANQUANTS D UN COUP ══════════════════════════════════ */
  async function creerManquants(bouton) {
    const n = _membres.filter((m) => m.sans_compte && m.learnybox_actif !== false).length;
    if (!n) { dire('Tout le monde a déjà un compte.'); return; }
    const ok = window.confirm(`Créer ${n} compte${n > 1 ? 's' : ''} pour les membres LearnyBox actifs qui n en ont pas ?\n\nFormation ouverte, progression LearnyBox reportée, journal ouvert seulement à ceux qui ont vu le chapitre 5.10, AUCUN mail envoyé : tu les préviens quand tu veux.`);
    if (!ok) return;
    bouton.disabled = true;
    try {
      const r = await appeler('creer_manquants', {});
      dire(`${r.crees.length} compte${r.crees.length > 1 ? 's' : ''} créé${r.crees.length > 1 ? 's' : ''}${r.echecs.length ? `, ${r.echecs.length} échec${r.echecs.length > 1 ? 's' : ''} (voir la console)` : ''}.`, r.echecs.length ? 'error' : 'success');
      if (r.echecs.length) console.warn('[MEMBRES] échecs de création :', r.echecs);
      await charger(true);
    } catch (e) {
      dire(`La création n a pas abouti : ${e.message}`, 'error');
    } finally { bouton.disabled = false; }
  }

  /* ══ LE CHARGEMENT ═════════════════════════════════════════════════════════ */
  async function charger(force) {
    const zone = $('coachMembresListe');
    if (!zone) return;
    if (_chargement && !force) return _chargement;
    zone.innerHTML = '<p class="am-vide">Chargement…</p>';
    _chargement = (async () => {
      try {
        _membres = await appeler('lister');
        rendre();
      } catch (e) {
        console.error('[MEMBRES] ⚠️ liste impossible :', e.message);
        zone.innerHTML = `<p class="am-vide am-erreur">La liste n a pas pu être lue : ${txt(e.message)}</p>`;
      }
    })();
    return _chargement;
  }

  /* ══ LE CABLAGE ════════════════════════════════════════════════════════════ */
  function brancher() {
    const racine = $('coachMembres');
    if (!racine || racine.dataset.branche) return;
    racine.dataset.branche = '1';
    racine.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-droit]')) changerDroit(t);
      else if (t.matches('[data-niveau]')) changerNiveau(t);
    });
    racine.addEventListener('click', (e) => {
      const t = e.target.closest('button, [data-filtre]');
      if (!t) return;
      if (t.matches('[data-fiche]')) {
        const tr = t.closest('tr');
        const m = tr && tr.dataset.uid ? _membres.find((x) => x.user_id === tr.dataset.uid)
          : tr && tr.dataset.lb ? _membres.find((x) => x.sans_compte && String(x.learnybox_id) === tr.dataset.lb)
          : tr && tr.dataset.email ? _membres.find((x) => x.sans_compte && String(x.email).toLowerCase() === tr.dataset.email.toLowerCase()) : null;
        if (m) ouvrirFiche(m.user_id ? { user_id: m.user_id } : { email: m.email });
      } else if (t.matches('[data-fermer-fiche]')) fermerFiche();
      else if (t.matches('[data-onglet]')) { _ongletFiche = t.dataset.onglet; rendreFiche(); }
      else if (t.matches('[data-quiz-detail]')) { const i = Number(t.dataset.quizDetail); _quizOuvert = _quizOuvert === i ? null : i; rendreFiche(); }
      else if (t.matches('[data-fiche-mail]')) renvoyerMailFiche(t);
      else if (t.matches('[data-fiche-mdp]')) poserMotDePasse(t);
      else if (t.matches('[data-fiche-journal]')) voirJournalFiche();
      else if (t.matches('[data-mail]')) renvoyerMail(t);
      else if (t.matches('[data-voir]')) voirJournal(t);
      else if (t.matches('[data-creer-depuis]')) {
        const tr = t.closest('tr[data-lb]');
        const m = tr ? _membres.find((x) => x.sans_compte && String(x.learnybox_id) === tr.dataset.lb) : null;
        if (m) ouvrirCreation(m);
      }
      else if (t.matches('[data-tri]')) {
        // ⚠️ Un clic sur la colonne deja triee inverse le sens ; une autre
        // colonne part en croissant (debutants en haut, les moins avances en haut).
        const cle = t.dataset.tri;
        _tri = _tri.cle === cle ? { cle, sens: -_tri.sens } : { cle, sens: 1 };
        rendre();
      } else if (t.matches('[data-filtre]')) {
        _filtre = t.dataset.filtre;
        racine.querySelectorAll('[data-filtre]').forEach((b) => b.setAttribute('aria-pressed', b === t ? 'true' : 'false'));
        rendre();
      } else if (t.matches('[data-ouvrir-creation]')) ouvrirCreation();
      else if (t.matches('[data-creer-manquants]')) creerManquants(t);
      else if (t.matches('[data-fermer-creation]')) fermerCreation();
      else if (t.matches('[data-recharger]')) charger(true);
    });
    const rech = $('coachMembresRecherche');
    if (rech) rech.addEventListener('input', () => { _recherche = rech.value; rendre(); });
    const form = racine.querySelector('#coachMembreCreer form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); creer(form); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();

  /* ══ LA FICHE MEMBRE ═══════════════════════════════════════════════════════
   * Demande de Nadir du 15/10 : « un écran comme sur LearnyBox : son adresse
   * mail, toutes ses infos, et les onglets ». Elle remplace la liste tant
   * qu elle est ouverte ; « Retour à la liste » la ferme. Les donnees viennent
   * de `/api/coach/membres` (action `fiche`) ; chaque onglet dit sa source, et
   * ce qui n est pas importe le dit au lieu de rester vide. */
  const ONGLETS = [
    ['infos', 'Infos'], ['activites', 'Activités'], ['emails', 'Emails'], ['formation', 'Formation'],
    ['transactions', 'Transactions'], ['affiliation', 'Affiliation'], ['questionnaires', 'Questionnaires'],
  ];
  let _fiche = null;
  let _ficheCible = null;
  let _ongletFiche = 'infos';
  let _quizOuvert = null;

  const dateFr = (iso, heure) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + (heure ? ` à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '');
  };
  const duree = (s) => { const h = Math.floor((s || 0) / 3600); const m = Math.floor(((s || 0) % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
  const initiales = (nom, email) => { const n = String(nom || '').trim(); const parts = n ? n.split(/\s+/) : [String(email || '?')]; return parts.slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?'; };

  async function ouvrirFiche(cible) {
    _ficheCible = cible; _fiche = null; _ongletFiche = 'infos'; _quizOuvert = null;
    const racine = $('coachMembres');
    if (racine) racine.classList.add('am-fiche-ouverte');
    rendreFiche();
    try {
      _fiche = await appeler('fiche', cible);
      rendreFiche();
    } catch (e) {
      const z = $('coachMembreFiche');
      if (z) z.innerHTML = `<div class="am-fiche__tete"><button type="button" class="am-btn am-btn--fantome" data-fermer-fiche>&larr; Retour à la liste</button></div><p class="am-vide am-erreur">La fiche n a pas pu être lue : ${txt(e.message)}</p>`;
    }
  }
  function fermerFiche() {
    _fiche = null; _ficheCible = null;
    const racine = $('coachMembres');
    if (racine) racine.classList.remove('am-fiche-ouverte');
    const z = $('coachMembreFiche');
    if (z) z.innerHTML = '';
  }
  /** Ouvrir la fiche depuis un autre ecran (le suivi membres du tableur) : par email. */
  async function ouvrirFicheParEmail(email) {
    if (!email) return;
    if (window.showCoachSection) await window.showCoachSection('coachMembres');
    if (!_membres.length) await charger();
    const m = _membres.find((x) => String(x.email || '').toLowerCase() === String(email).toLowerCase());
    ouvrirFiche(m && m.user_id ? { user_id: m.user_id } : { email: String(email).toLowerCase() });
  }

  function membreDeLaFiche() {
    if (!_fiche) return null;
    const f = _fiche;
    const email = (f.compte && f.compte.email) || (f.learnybox && f.learnybox.email) || (_ficheCible && _ficheCible.email) || '';
    return _membres.find((x) => String(x.email || '').toLowerCase() === String(email).toLowerCase()) || null;
  }

  function rendreFiche() {
    const z = $('coachMembreFiche');
    if (!z) return;
    if (!_fiche) { z.innerHTML = `<div class="am-fiche__tete"><button type="button" class="am-btn am-btn--fantome" data-fermer-fiche>&larr; Retour à la liste</button></div><p class="am-vide">Chargement de la fiche…</p>`; return; }
    const f = _fiche;
    const lb = f.learnybox || {};
    const lp = f.learnybox_profil || {};
    const nom = (f.profil && f.profil.name) || [lb.prenom, lb.nom].filter(Boolean).join(' ') || '';
    const email = (f.compte && f.compte.email) || lb.email || (_ficheCible && _ficheCible.email) || '';
    const m = membreDeLaFiche();
    const niv = m ? niveauEffectif(m) : { cle: lb.niveau || null, source: lb.niveau ? 'learnybox' : null };
    const st = f.compte ? (STATUTS[(f.profil && f.profil.status) || 'sans_profil'] || STATUTS.sans_profil) : STATUTS.sans_compte;
    const derniere = f.compte && f.compte.derniere_connexion ? f.compte.derniere_connexion : (lb.derniere_activite || null);
    const d = depuis(derniere);
    const tl = totalLecons();
    const vues = f.formation.progression.filter((p) => p.vue).length;
    const pct = tl ? Math.round((vues / tl) * 100) : 0;

    const tete = `
      <div class="am-fiche__tete">
        <button type="button" class="am-btn am-btn--fantome" data-fermer-fiche>&larr; Retour à la liste</button>
        <span class="am-fiche__fil">Accès membres formation · Fiche</span>
      </div>`;
    const carte = `
      <aside class="am-fiche__carte">
        <div class="am-fiche__avatar">${txt(initiales(nom, email))}</div>
        <h2 class="am-fiche__nom">${txt(nom || 'Nom non renseigné')}</h2>
        <a class="am-fiche__email" href="mailto:${txt(email)}">${txt(email)}</a>
        <div class="am-fiche__pills">
          <span class="am-statut am-statut--${st.c}">${txt(st.t)}</span>
          ${niv.cle ? `<span class="am-statut am-statut--ok">${txt(NIVEAUX[niv.cle] || niv.cle)}</span>` : ''}
          ${lb.actif === false ? '<span class="am-statut am-statut--non">Inactif LearnyBox</span>' : ''}
        </div>
        ${(f.signalements || []).length ? `<div class="am-fiche__signalements">${f.signalements.map((x) => { const [t, c] = SIGNAUX[x.type] || [x.type, 'attend']; return `<p><span class="am-statut am-statut--${c}">${t}${x.montant ? ` · ${txt(Number(x.montant).toLocaleString('fr-FR'))} €` : ''}</span> ${txt(x.note || '')}${x.reference_email ? ` <em>(${txt(x.reference_email)})</em>` : ''}${x.depuis ? ` <small>${txt(dateFr(x.depuis))}</small>` : ''}</p>`; }).join('')}</div>` : ''}
        <p class="am-fiche__actif ${d.absent ? 'am-absent' : ''}">${derniere ? `Actif ${txt(d.t)}` : 'Jamais venu'}</p>
        <div class="am-fiche__actions">
          ${f.compte ? `<button type="button" class="am-btn am-btn--fantome" data-fiche-mail title="Renvoyer le mail de première connexion"><i class="fas fa-envelope"></i> Mail</button><button type="button" class="am-btn am-btn--fantome" data-fiche-mdp title="Poser un mot de passe provisoire, à transmettre toi-même"><i class="fas fa-key"></i> Mot de passe</button>` : ''}
          ${f.compte && f.acces && f.acces.journal_actif ? `<button type="button" class="am-btn am-btn--fantome" data-fiche-journal title="Ouvrir son journal en lecture seule"><i class="fas fa-book"></i> Journal</button>` : ''}
        </div>
        ${m && !m.sans_compte ? `
        <div class="am-fiche__droits">
          <label class="am-switch"><input type="checkbox" data-droit="formation" ${m.formation ? 'checked' : ''}><i></i><span>Formation</span></label>
          <label class="am-switch"><input type="checkbox" data-droit="journal" ${m.journal ? 'checked' : ''}><i></i><span>Journal</span></label>
        </div>` : ''}
        <dl class="am-fiche__stats">
          ${lp.telephone ? `<div><dt>Téléphone</dt><dd>${txt(lp.telephone)}</dd></div>` : ''}
          <div><dt>Progression</dt><dd>${f.compte ? `${pct} %` : (lb.progression_pct != null ? `${lb.progression_pct} % (LearnyBox)` : '·')}</dd></div>
          ${lp.temps_passe_s ? `<div><dt>Temps passé (LearnyBox)</dt><dd>${txt(duree(lp.temps_passe_s))}</dd></div>` : ''}
          ${lb.inscrit_le ? `<div><dt>Inscrit le</dt><dd>${txt(dateFr(lb.inscrit_le))}</dd></div>` : ''}
          ${f.compte ? `<div><dt>Compte journal créé le</dt><dd>${txt(dateFr(f.compte.cree_le))}</dd></div>` : '<div><dt>Compte journal</dt><dd>Aucun</dd></div>'}
          ${f.compte && f.compte.derniere_connexion ? `<div><dt>Dernière connexion</dt><dd>${txt(dateFr(f.compte.derniere_connexion, true))}</dd></div>` : ''}
        </dl>
      </aside>`;
    const onglets = `<nav class="am-onglets" aria-label="Fiche">${ONGLETS.map(([k, t]) => `<button type="button" data-onglet="${k}" aria-selected="${_ongletFiche === k ? 'true' : 'false'}">${t}${pointOnglet(k, f) ? '<i></i>' : ''}</button>`).join('')}</nav>`;
    z.innerHTML = `${tete}<div class="am-fiche"><div class="am-fiche__gauche">${carte}</div><div class="am-fiche__droite">${onglets}<div class="am-onglet">${rendreOnglet(_ongletFiche, f, m)}</div></div></div>`;
  }

  function pointOnglet(k, f) {
    if (k === 'formation') return f.formation.progression.length > 0 || !!f.learnybox;
    if (k === 'transactions') return f.transactions.lignes.length > 0;
    if (k === 'questionnaires') return f.formation.quiz.length > 0;
    if (k === 'emails') return f.mails.length > 0;
    return false;
  }

  const bloc = (titre, corps, n) => `<section class="am-bloc"><h3>${n != null ? `<b>${n}</b> ` : ''}${titre}</h3>${corps}</section>`;
  const ligneInfo = (ic, k, v) => `<div class="am-info"><span class="am-info__ic"><i class="fas ${ic}"></i></span><span class="am-info__k">${k}</span><span class="am-info__v">${v || '<em>non renseigné</em>'}</span></div>`;

  function rendreOnglet(k, f, m) {
    const lb = f.learnybox || {}; const lp = f.learnybox_profil || {};
    if (k === 'infos') {
      const adresse = [lp.adresse, [lp.code_postal, lp.ville].filter(Boolean).join(' '), lp.pays].filter(Boolean).map(txt).join('<br>');
      return bloc('Informations générales', `
        ${ligneInfo('fa-phone', 'Téléphone', txt(lp.telephone))}
        ${ligneInfo('fa-map-marker-alt', 'Adresse postale', adresse)}
        ${ligneInfo('fa-briefcase', 'Société / profession', txt([lp.societe, lp.profession].filter(Boolean).join(' · ')))}
        ${ligneInfo('fa-bullhorn', 'Prospection directe', lp.prospection_directe == null ? '' : (lp.prospection_directe ? 'Oui' : 'Non'))}
        ${ligneInfo('fa-handshake', 'Prospection partenaires', lp.prospection_partenaires == null ? '' : (lp.prospection_partenaires ? 'Oui' : 'Non'))}
        ${ligneInfo('fa-file-signature', 'Conditions acceptées', f.profil && f.profil.legal_accepted_at ? txt(dateFr(f.profil.legal_accepted_at)) : (f.compte ? 'Pas encore' : ''))}
        ${ligneInfo('fa-comment', 'Commentaire LearnyBox', txt(lp.commentaire))}
        <p class="am-source">Téléphone, adresse et prospection : export LearnyBox du 13/10/2026. Notification par email et adresse IP : non reprises de LearnyBox.</p>`);
    }
    if (k === 'activites') {
      if (!f.activites.length) return bloc('Activités', '<p class="am-vide">Aucune activité connue.</p>', 0);
      const IC = { chapitre: 'fa-play', quiz: 'fa-check-double', note: 'fa-pen', trades: 'fa-chart-line', journal: 'fa-book', connexion: 'fa-sign-in-alt', compte: 'fa-user-plus', mail: 'fa-envelope', transaction: 'fa-euro-sign', learnybox: 'fa-graduation-cap' };
      const LIB = { chapitre: 'Chapitre terminé', quiz: 'Quiz', note: 'Note écrite', trades: 'Trades enregistrés', journal: 'Journal', connexion: 'Connexion', compte: 'Compte', mail: 'Mail envoyé', transaction: 'Transaction', learnybox: 'LearnyBox' };
      const parJour = new Map();
      for (const a of f.activites) { const j = String(a.quand).slice(0, 10); if (!parJour.has(j)) parJour.set(j, []); parJour.get(j).push(a); }
      const lecon = (id) => (window.FormationDonnees && window.FormationDonnees.lecon(id)) || null;
      return bloc('Activités', Array.from(parJour.entries()).map(([j, liste]) => `
        <h4 class="am-jour">${txt(dateFr(j + 'T12:00:00Z'))}</h4>
        ${liste.map((a) => { const l = a.type === 'chapitre' || a.type === 'note' ? lecon(a.detail) : null;
          return `<div class="am-activite"><span class="am-activite__ic"><i class="fas ${IC[a.type] || 'fa-circle'}"></i></span><span class="am-activite__h">${String(a.quand).includes('T12:00:00Z') ? '' : txt(new Date(a.quand).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}</span><span class="am-activite__t"><b>${LIB[a.type] || a.type}</b> ${txt(l ? l.titre : a.detail)}</span></div>`; }).join('')}`).join(''), f.activites.length);
    }
    if (k === 'emails') {
      const lignes = f.mails.map((e) => `<tr><td><span class="am-statut ${e.erreur ? 'am-statut--non' : 'am-statut--ok'}">${e.erreur ? 'Échec' : 'Transactionnel'}</span></td><td>${txt(e.sujet)}</td><td>${txt(dateFr(e.envoye_le, true))}</td><td>${txt(e.envoye_par || '')}</td></tr>`).join('');
      return bloc('Emails', `${f.mails.length ? `<table class="am-table am-table--simple"><thead><tr><th>Type</th><th>Sujet</th><th>Date d envoi</th><th>Par</th></tr></thead><tbody>${lignes}</tbody></table>` : '<p class="am-vide">Aucun mail envoyé depuis le journal.</p>'}<p class="am-source">Mails envoyés par le journal (Resend). Les mails envoyés par LearnyBox ne sont pas repris.</p>`, f.mails.length);
    }
    if (k === 'formation') {
      const M = (window.FormationDonnees && window.FormationDonnees.MODULES) || [];
      const vus = new Set(f.formation.progression.filter((p) => p.vue).map((p) => p.lecon_id));
      const modules = M.filter((x) => !x.introduction && x.lecons.length).map((x) => { const n = x.lecons.filter((l) => vus.has(l.id)).length; const t = x.lecons.length; const fini = n === t; return { x, n, t, fini }; });
      const finis = modules.filter((r) => r.fini);
      const quizOk = new Set(f.formation.quiz.filter((q) => q.reussi).map((q) => q.module_cle));
      const tl = totalLecons(); const vuesN = vus.size; const pct = tl ? Math.round((vuesN / tl) * 100) : 0;
      const demarrage = lb.inscrit_le || (f.compte && f.compte.cree_le) || null;
      const cert = M.find((x) => x.cle === '10');
      const certOk = cert && modules.find((r) => r.x === cert) && modules.find((r) => r.x === cert).fini;
      return bloc('Formation', `
        <table class="am-table am-table--simple"><thead><tr><th>Formation</th><th>Date de démarrage</th><th>Niveau</th><th>Progression</th><th>État</th></tr></thead>
        <tbody><tr><td><b>Trader 360</b></td><td>${txt(dateFr(demarrage))}</td><td>${m ? txt(NIVEAUX[niveauEffectif(m).cle] || '·') : txt(NIVEAUX[lb.niveau] || '·')}</td>
        <td><div class="am-barre" style="width:120px;display:inline-block;vertical-align:middle"><i style="width:${pct}%"></i></div> ${pct} % <small>(${vuesN} / ${tl} chapitres)</small></td>
        <td>${m && !m.sans_compte ? `<label class="am-switch"><input type="checkbox" data-droit="formation" ${m.formation ? 'checked' : ''}><i></i><span>${m.formation ? 'Actif' : 'Fermé'}</span></label>` : '<span class="am-statut am-statut--attend">Sans compte</span>'}</td></tr></tbody></table>
        ${!f.compte && lb.progression_pct != null ? `<p class="am-source">Sans compte dans le journal : progression LearnyBox ${lb.progression_pct} %, reportée à la création du compte.</p>` : ''}`, 1)
      + bloc('Modules', `<div class="am-modules">${modules.map((r) => `<div class="am-module ${r.fini ? 'done' : ''}"><span class="am-module__num">${r.x.bonus ? 'Bonus' : r.x.cle === '10' ? 'Certif.' : `Module ${txt(r.x.numero)}`}</span><span class="am-barre"><i style="width:${r.t ? Math.round((r.n / r.t) * 100) : 0}%"></i></span><span class="am-module__n">${r.n} / ${r.t}${quizOk.has(r.x.cle) ? ' · quiz réussi' : ''}</span></div>`).join('')}</div>`)
      + bloc('Badges', finis.length ? `<div class="am-badges">${finis.map((r) => `<span class="am-badge">${r.x.cle === '10' ? 'Certification' : `Module ${txt(r.x.numero)} terminé`}</span>`).join('')}</div>` : '<p class="am-vide">Aucun badge : aucun module terminé en entier.</p>', finis.length)
      + bloc('Diplôme', certOk ? '<p><span class="am-statut am-statut--ok">Certification Trader 360 obtenue</span></p>' : '<p class="am-vide">Aucun diplôme obtenu (la certification Trader 360 vient avec le module 10).</p>', certOk ? 1 : 0)
      + bloc('Documents', '<p class="am-vide">Les documents de la formation restent sur LearnyBox pour l instant.</p>');
    }
    if (k === 'transactions') {
      const t = f.transactions;
      const total = t.lignes.reduce((a, l) => a + (Number(l.montant) || 0), 0);
      return bloc('Transactions', t.lignes.length
        ? `<p class="am-total"><b>${total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</b> · ${t.lignes.length} transaction${t.lignes.length > 1 ? 's' : ''}</p><table class="am-table am-table--simple"><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Montant</th><th>État</th></tr></thead><tbody>${t.lignes.map((l) => `<tr><td>${txt(dateFr(l.date_transaction, true))}</td><td>${txt(l.produit)}</td><td>${txt(l.type_paiement)}</td><td>${l.montant != null ? txt(Number(l.montant).toLocaleString('fr-FR', { style: 'currency', currency: l.devise || 'EUR' })) : ''}</td><td>${txt(l.etat)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="am-vide">Aucune transaction importée. Les transactions LearnyBox arriveront par un export du CRM (Ventes, Transactions) ; ensuite, les paiements passeront par les offres du back-office.</p>', t.lignes.length);
    }
    if (k === 'affiliation') {
      return bloc('Affiliation', `<p class="am-vide">Pas encore d affiliation. Le jour venu : un lien personnel que le membre partage, et une notification à chaque inscription qui vient de lui.</p><p><button type="button" class="am-btn am-btn--fantome" disabled title="À venir">Créer l affilié</button></p>`);
    }
    if (k === 'questionnaires') {
      const Q = window.FORMATION_QUIZ || {};
      const quiz = f.formation.quiz;
      const lignes = quiz.map((q, i) => {
        const def = Q[q.module_cle];
        const detail = _quizOuvert === i && def ? `<tr class="am-quiz-detail"><td colspan="5"><ol class="am-reponses">${(q.reponses || []).map((r) => { const qq = (def.questions || []).find((x) => x.id === r.id); if (!qq) return `<li>${txt(r.id)}</li>`; const okR = r.choisie === r.bonne; return `<li class="${okR ? 'ok' : 'ko'}"><b>${txt(qq.enonce)}</b><br>Réponse : ${txt(qq.options[r.choisie] != null ? qq.options[r.choisie] : '(aucune)')}${okR ? '' : `<br><em>Attendu : ${txt(qq.options[r.bonne])}</em>`}</li>`; }).join('')}</ol></td></tr>` : '';
        return `<tr><td>Quiz Trader 360 : Module ${txt(q.module_cle)}</td><td>${txt(dateFr(q.created_at, true))}</td><td><span class="am-statut ${q.reussi ? 'am-statut--ok' : 'am-statut--non'}">${q.reussi ? 'Réussi' : 'Non réussi'}</span></td><td><b>${q.score} / ${q.total}</b> (${q.total ? Math.round((q.score / q.total) * 100) : 0} %)</td><td><button type="button" class="am-oeil" data-quiz-detail="${i}" title="Voir ses réponses">&#128065;</button></td></tr>${detail}`;
      }).join('');
      return bloc('Sondage', '<p class="am-vide">Le questionnaire de positionnement (candidature) est dans la base du site : à relier à la fiche.</p>')
        + bloc('Quiz', quiz.length ? `<table class="am-table am-table--simple"><thead><tr><th>Quiz</th><th>Date</th><th>État</th><th>Score</th><th></th></tr></thead><tbody>${lignes}</tbody></table>` : '<p class="am-vide">Aucune réponse à un quiz.</p>', quiz.length)
        + bloc('Évaluations LearnyBox', '<p class="am-vide">Non importées : les quiz du journal les remplacent.</p>');
    }
    return '';
  }

  /**
   * Un mot de passe provisoire pose par le coach (15/10, cas Philippe). Le
   * coach le tape, il part UNE fois au serveur, rien ne le garde ici : pas de
   * variable, pas de toast qui le repete, et le champ est vide a la fermeture.
   */
  async function poserMotDePasse(bouton) {
    if (!_fiche || !_fiche.compte) return;
    const mdp = window.prompt(`Mot de passe provisoire pour ${_fiche.compte.email} (douze caractères minimum). Tu le transmets toi-même ; il le changera dans son espace.`);
    if (mdp == null) return;
    if (String(mdp).length < 12) { dire('Douze caractères minimum.', 'error'); return; }
    bouton.disabled = true;
    try { await appeler('mot_de_passe', { user_id: _fiche.compte.user_id, mot_de_passe: mdp }); dire(`Mot de passe provisoire posé pour ${_fiche.compte.email}. Transmets-le lui.`); }
    catch (e) { dire(e.message, 'error'); }
    finally { bouton.disabled = false; }
  }
  async function renvoyerMailFiche(bouton) {
    if (!_fiche || !_fiche.compte) return;
    if (!window.confirm(`Envoyer à ${_fiche.compte.email} le mail de première connexion ?`)) return;
    bouton.disabled = true;
    try { await appeler('renvoyer_mail', { user_id: _fiche.compte.user_id }); dire(`Mail envoyé à ${_fiche.compte.email}.`); _fiche = await appeler('fiche', _ficheCible); rendreFiche(); }
    catch (e) { dire(`Le mail n est pas parti : ${e.message}`, 'error'); }
    finally { bouton.disabled = false; }
  }
  function voirJournalFiche() {
    if (!_fiche || !_fiche.compte) return;
    const nom = (_fiche.profil && _fiche.profil.name) || _fiche.compte.email;
    if (window.CoachView && typeof window.CoachView.enter === 'function') window.CoachView.enter(_fiche.compte.user_id, nom);
  }

  window.CoachMembres = { charger, rendre, ouvrirFiche, ouvrirFicheParEmail, fermerFiche, _membres: () => _membres };
})();
