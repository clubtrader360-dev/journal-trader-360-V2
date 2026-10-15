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
  };

  let _membres = [];
  let _filtre = 'tous';
  let _recherche = '';
  let _chargement = null;

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
      if (_filtre === 'sans_journal' && m.journal) return false;
      if (_filtre === 'sans_formation' && m.formation) return false;
      if (_filtre === 'demandes' && !m.journal_demande_le) return false;
      if (_filtre === 'absents' && !depuis(m.derniere_activite).absent) return false;
      return true;
    });
  }

  /* ══ LE RENDU ══════════════════════════════════════════════════════════════ */
  function ligne(m) {
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
    return `<tr data-uid="${txt(m.user_id)}" class="${eleve ? '' : 'cm-coach'}">
      <td class="cm-qui">
        <b>${txt(m.nom || 'Nom non renseigné')}</b>
        <span>${txt(m.email)}</span>
        <small class="cm-statut cm-statut--${st.c}">${txt(st.t)}${eleve ? '' : ' · coach'}</small>
      </td>
      <td class="cm-niveau">
        <select aria-label="Niveau" data-niveau ${eleve ? '' : 'disabled'}>${options}</select>
        ${niv.source === 'coach' ? '<small>posé par le coach</small>' : niv.source === 'learnybox' ? `<small>LearnyBox${m.learnybox_pct != null ? ` · ${m.learnybox_pct} %` : ''}</small>` : '<small>aucune source</small>'}
      </td>
      <td class="cm-droit">
        <label class="cm-switch"><input type="checkbox" data-droit="formation" ${m.formation ? 'checked' : ''}><i></i><span>Formation</span></label>
        <label class="cm-switch"><input type="checkbox" data-droit="journal" ${m.journal ? 'checked' : ''}><i></i><span>Journal</span></label>
        ${m.journal_demande_le ? `<small class="cm-demande">demande ${txt(depuis(m.journal_demande_le).t)}</small>` : ''}
        ${!m.journal && m.journal_retire_le ? `<small>retiré ${txt(depuis(m.journal_retire_le).t)}</small>` : ''}
      </td>
      <td class="cm-avance">
        <div class="cm-barre"><i style="width:${pct}%"></i></div>
        <span>${m.lecons_vues}${tl ? ` / ${tl}` : ''} · ${pct} %</span>
      </td>
      <td class="cm-quiz"><b>${m.quiz_reussis.length}</b>${tq ? ` / ${tq}` : ''}</td>
      <td class="cm-visite ${d.absent ? 'cm-absent' : ''}">${txt(d.t)}</td>
      <td class="cm-actions">
        ${m.journal && eleve ? `<button type="button" data-voir title="Ouvrir son journal en lecture seule">Journal</button>` : ''}
        <button type="button" data-mail title="Renvoyer le mail de première connexion">Mail</button>
      </td>
    </tr>`;
  }

  function rendre() {
    const zone = $('coachMembresListe');
    if (!zone) return;
    const liste = visibles();
    const compteur = $('coachMembresCompte');
    if (compteur) compteur.textContent = `${liste.length} sur ${_membres.filter((m) => m.role === 'student').length} élèves`;
    if (!liste.length) {
      zone.innerHTML = '<p class="cm-vide">Personne ne correspond.</p>';
      return;
    }
    zone.innerHTML = `<div class="cm-enveloppe"><table class="cm-table">
      <thead><tr><th>Membre</th><th>Niveau</th><th>Accès</th><th>Avancement</th><th>Quiz</th><th>Dernière visite</th><th></th></tr></thead>
      <tbody>${liste.map(ligne).join('')}</tbody></table></div>`;
  }

  /* ══ LES ACTIONS ═══════════════════════════════════════════════════════════ */
  function membreDe(el) {
    const tr = el.closest('tr[data-uid]');
    return tr ? _membres.find((m) => m.user_id === tr.dataset.uid) : null;
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
  function ouvrirCreation() {
    const f = $('coachMembreCreer');
    if (!f) return;
    f.hidden = false;
    f.querySelector('form').reset();
    const e = f.querySelector('[name=prenom]');
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
      dire(`Compte créé pour ${r.email}${r.mail_envoye ? ', mail de connexion envoyé' : ', sans mail'}.`);
      fermerCreation();
      await charger(true);
    } catch (e) {
      dire(`Le compte n a pas été créé : ${e.message}`, 'error');
    } finally { b.disabled = false; b.textContent = 'Créer le compte'; }
  }

  /* ══ LE CHARGEMENT ═════════════════════════════════════════════════════════ */
  async function charger(force) {
    const zone = $('coachMembresListe');
    if (!zone) return;
    if (_chargement && !force) return _chargement;
    zone.innerHTML = '<p class="cm-vide">Chargement…</p>';
    _chargement = (async () => {
      try {
        _membres = await appeler('lister');
        rendre();
      } catch (e) {
        console.error('[MEMBRES] ⚠️ liste impossible :', e.message);
        zone.innerHTML = `<p class="cm-vide cm-erreur">La liste n a pas pu être lue : ${txt(e.message)}</p>`;
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
      if (t.matches('[data-mail]')) renvoyerMail(t);
      else if (t.matches('[data-voir]')) voirJournal(t);
      else if (t.matches('[data-filtre]')) {
        _filtre = t.dataset.filtre;
        racine.querySelectorAll('[data-filtre]').forEach((b) => b.setAttribute('aria-pressed', b === t ? 'true' : 'false'));
        rendre();
      } else if (t.matches('[data-ouvrir-creation]')) ouvrirCreation();
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

  window.CoachMembres = { charger, rendre, _membres: () => _membres };
})();
