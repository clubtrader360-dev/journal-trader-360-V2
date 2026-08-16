// ========================================
// COACH VIEW — le coach consulte le journal d'un élève en LECTURE SEULE (#80).
// Approche : override central (window.currentUser = l'élève) au bootstrap, PAS d'impersonation JWT
// (le token reste celui du coach ; RLS is_coach() autorise la lecture des lignes élève).
// État en sessionStorage → persiste au reload (F5), s'efface à la fermeture de l'onglet.
// Écriture désactivée : garde au niveau du client Supabase (couvre TOUS les writes) + CSS grisé.
// ========================================
(function () {
  'use strict';

  const KEY_UUID = 'coachView_uuid';
  const KEY_NAME = 'coachView_name';

  // Tables sur lesquelles l'écriture est bloquée en mode coach-view.
  const GUARDED_TABLES = new Set([
    'trades', 'journal_entries', 'accounts', 'account_costs', 'payouts',
    'daily_fees', 'user_preferences', 'user_motivation', 'checklist_validations',
    'replay_views', 'replays', 'gamification_state',
    'users', 'tradovate_credentials', 'tradovate_sync_state'
  ]);
  const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'];

  // Résultat "lecture seule" : un proxy chaînable + thenable qui résout une erreur,
  // pour que n'importe quelle chaîne (.select().single(), await, .eq()...) ne casse pas.
  function readOnlyResult() {
    const payload = { data: null, error: { message: 'Mode lecture seule (coach view)', code: 'COACH_VIEW_READONLY' } };
    const p = Promise.resolve(payload);
    const proxy = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') return p.then.bind(p);
        if (prop === 'catch') return p.catch.bind(p);
        if (prop === 'finally') return p.finally.bind(p);
        return () => proxy; // toute méthode de chaînage renvoie le proxy
      },
      apply() { return proxy; }
    });
    return proxy;
  }

  const CoachView = {
    isActive() { return !!this.getViewedUuid(); },
    getViewedUuid() { try { return sessionStorage.getItem(KEY_UUID) || null; } catch (_) { return null; } },
    getViewedName() { try { return sessionStorage.getItem(KEY_NAME) || 'élève'; } catch (_) { return 'élève'; } },

    // Entrée (bouton "Voir son journal" du modal coach) → recharge le dashboard avec le state.
    enter(uuid, name) {
      if (!uuid) return;
      try {
        sessionStorage.setItem(KEY_UUID, uuid);
        sessionStorage.setItem(KEY_NAME, name || '');
      } catch (_) {}
      window.location.href = '/index.html';
    },

    // Sortie (bouton du bandeau) → clear + retour au dashboard coach.
    exit() {
      try { sessionStorage.removeItem(KEY_UUID); sessionStorage.removeItem(KEY_NAME); } catch (_) {}
      window.location.href = '/index.html';
    },

    // Installe la garde d'écriture sur le client Supabase (idempotent, no-op hors coach-view).
    installWriteGuard() {
      const sb = window.supabaseClient;
      if (!sb || sb.__coachViewGuarded) return;
      const origFrom = sb.from.bind(sb);
      sb.from = function (table) {
        const qb = origFrom(table);
        if (CoachView.isActive() && GUARDED_TABLES.has(table)) {
          for (const m of WRITE_METHODS) {
            qb[m] = function () {
              window.showNotification && window.showNotification('Mode lecture seule : écriture désactivée.', 'error');
              console.warn('[COACH-VIEW] write bloqué sur', table + '.' + m + '()');
              return readOnlyResult();
            };
          }
        }
        return qb;
      };
      sb.__coachViewGuarded = true;
    },

    // Active l'UI lecture seule : bandeau + classe body (grise les boutons d'écriture).
    activateUI() {
      document.body.classList.add('coach-view-readonly');
      const banner = document.getElementById('coachViewBanner');
      const nameEl = document.getElementById('coachViewName');
      if (nameEl) nameEl.textContent = this.getViewedName() || 'élève';
      if (banner) banner.style.display = 'flex';
    },

    // Garde manuelle réutilisable (pour les handlers d'auth : email/password, hors client .from()).
    blockIfActive(action) {
      if (this.isActive()) {
        window.showNotification && window.showNotification('Mode lecture seule : ' + (action || 'cette action') + ' désactivée.', 'error');
        return true;
      }
      return false;
    }
  };

  window.CoachView = CoachView;

  // Installe la garde dès que le client existe (avant tout module de write).
  (function waitClient(n) {
    if (window.supabaseClient) { CoachView.installWriteGuard(); return; }
    if (n < 100) setTimeout(() => waitClient(n + 1), 50);
  })(0);

  // Sécurité : si un state coach-view existe mais que l'utilisateur n'est pas un coach → clear.
  document.addEventListener('DOMContentLoaded', async () => {
    if (!CoachView.isActive() || !window.supabaseClient) return;
    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return; // pas encore loggé — restoreSession gérera
      const { data: profile } = await window.supabaseClient.from('users').select('role, status').eq('uuid', user.id).single();
      const okRole = profile && ['coach', 'admin'].includes(profile.role) && !['revoked', 'pending'].includes(profile.status);
      if (!okRole) { CoachView.exit(); }
    } catch (e) { CoachView.exit(); }
  });
})();
