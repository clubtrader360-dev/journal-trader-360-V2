// ========================================
// CLIENT TRADOVATE — UI Connexions OAuth + Autosync
// ========================================
// Pilote la section #connections :
//   - liste des connexions OAuth Tradovate (1 card par credentials)
//   - bouton "Ajouter une connexion" → form (label + env)
//     → POST /oauth-start → ouvre popup vers Tradovate
//     → callback postMessage → refresh
//   - boutons Sync / Déconnecter / Reconnecter par connexion
//
// Expose window.tradovateAutosync() pour supabase-auth.js (post-login).
// ========================================

(() => {
  'use strict';

  console.log('[TRADOVATE] Chargement supabase-tradovate.js...');

  const API_BASE = '/api/tradovate';
  const escape = window.escapeHtml || ((s) => String(s == null ? '' : s));

  // --------------------------------------
  // Appel API authentifié JWT Supabase
  // --------------------------------------
  async function authedFetch(path, { method = 'GET', body = null } = {}) {
    const sb = window.supabaseClient;
    if (!sb) throw new Error('Supabase non chargé');
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type':  'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}

    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.detail = json?.detail;
      throw err;
    }
    return json || {};
  }

  // --------------------------------------
  // État des connexions
  // --------------------------------------
  async function refreshStatus() {
    const container = document.getElementById('tradovateStatusContainer');
    if (!container) return;

    try {
      const data = await authedFetch('/status');
      renderConnections(container, data.connections || []);
    } catch (err) {
      container.innerHTML = `
        <div class="trader-card p-6 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Erreur chargement état : ${escape(err.message)}</p>
        </div>
      `;
    }
  }

  function renderConnections(container, connections) {
    if (!connections.length) {
      container.innerHTML = `
        <div class="trader-card p-6 text-center text-gray-600">
          <i class="fas fa-plug text-2xl mb-2 text-gray-400"></i>
          <p>Aucune connexion Tradovate pour le moment.</p>
          <p class="text-sm text-gray-500 mt-1">Ajoute une connexion ci-dessous (une par prop firm).</p>
        </div>
      `;
      return;
    }

    container.innerHTML = connections.map(c => {
      const lastSync = c.last_synced_at
        ? new Date(c.last_synced_at).toLocaleString('fr-FR')
        : 'jamais';

      const envBadge =
        `<span class="px-2 py-0.5 rounded-full text-xs ${
          c.env === 'live'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-blue-100 text-blue-800'
        }">${escape(c.env)}</span>`;

      let statusBadge;
      if (c.needs_reauth) {
        statusBadge = `<span class="px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-800">Reconnexion requise</span>`;
      } else if (c.last_sync_status === 'error') {
        statusBadge = `<span class="px-3 py-1 rounded-full text-xs bg-red-100 text-red-700">Erreur</span>`;
      } else {
        statusBadge = `<span class="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700">Connecté</span>`;
      }

      const accountsList = (c.accounts || []).map(a => `
        <li class="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
          <span class="text-gray-700">${escape(a.name || `Compte ${a.tradovate_account_id}`)}</span>
          <span class="text-gray-500">${a.trades_created_total || 0} trades importés</span>
        </li>
      `).join('') || '<li class="text-sm text-gray-500 py-1">Aucun compte synchronisé pour le moment.</li>';

      const errorBox = (c.last_sync_status === 'error' || c.needs_reauth) && c.last_sync_error
        ? `<div class="mt-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">${escape(c.last_sync_error)}</div>`
        : '';

      const reauthBtn = c.needs_reauth
        ? `<button class="trader-btn-secondary" data-action="tradovate-reauth"
                  data-label="${escape(c.label)}" data-env="${escape(c.env)}"
                  data-credentials-id="${c.id}"
                  style="color: #c2410c; border-color: #fdba74;">
             <i class="fas fa-redo mr-2"></i>Reconnecter
           </button>`
        : `<button class="trader-btn-secondary" data-action="tradovate-sync">
             <i class="fas fa-sync-alt mr-2"></i>Sync maintenant
           </button>`;

      return `
        <div class="trader-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-base text-gray-800 font-semibold">${escape(c.label)}</span>
                ${envBadge}
              </div>
              <div class="text-xs text-gray-500">Dernière sync : ${escape(lastSync)}</div>
            </div>
            ${statusBadge}
          </div>
          <ul class="mb-4">${accountsList}</ul>
          ${errorBox}
          <div class="flex flex-wrap gap-2">
            ${reauthBtn}
            <button class="trader-btn-secondary"
                    data-action="tradovate-disconnect"
                    data-credentials-id="${c.id}"
                    data-label="${escape(c.label)}"
                    style="color: #b91c1c; border-color: #fca5a5;">
              <i class="fas fa-unlink mr-2"></i>Déconnecter
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------
  // OAuth popup flow
  // --------------------------------------
  let _oauthPopup = null;
  let _oauthPendingLabel = null;

  async function startOAuthConnect({ env, label }) {
    const errBox = document.getElementById('tradovateConnectError');
    const btn = document.getElementById('tradovateConnectBtn');
    if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }

    if (!env || !label) {
      if (errBox) {
        errBox.textContent = 'Le nom de la connexion et l\'environnement sont requis.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn._origLabel = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Ouverture de Tradovate...';
    }

    let authorize_url;
    try {
      const data = await authedFetch('/oauth-start', {
        method: 'POST',
        body: { env, label }
      });
      authorize_url = data.authorize_url;
    } catch (err) {
      if (btn) { btn.disabled = false; btn.innerHTML = btn._origLabel || 'Connecter'; }
      if (errBox) {
        const detail = err.detail ? ` (${err.detail})` : '';
        errBox.textContent = `${err.message}${detail}`;
        errBox.classList.remove('hidden');
      }
      return;
    }

    _oauthPendingLabel = label;
    _oauthPopup = window.open(
      authorize_url,
      'tradovate-oauth',
      'width=600,height=720,menubar=no,toolbar=no,location=yes,status=no'
    );

    if (!_oauthPopup) {
      if (btn) { btn.disabled = false; btn.innerHTML = btn._origLabel || 'Connecter'; }
      if (errBox) {
        errBox.textContent = 'Popup bloquée par le navigateur. Autorise les popups pour ce site puis réessaie.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    // Si l'utilisateur ferme la popup sans terminer
    const closedCheck = setInterval(() => {
      if (_oauthPopup && _oauthPopup.closed) {
        clearInterval(closedCheck);
        if (btn) { btn.disabled = false; btn.innerHTML = btn._origLabel || 'Connecter'; }
        _oauthPopup = null;
      }
    }, 500);
  }

  // Écoute les messages du callback OAuth (window.postMessage)
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.type !== 'tradovate-oauth-done') return;

    const btn = document.getElementById('tradovateConnectBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = btn._origLabel || 'Connecter'; }

    if (msg.success) {
      // Reset form + refresh + sync immédiat silencieux
      document.getElementById('tradovateConnectForm')?.reset();
      showToast(`"${msg.label}" connecté`, 'success', 3000);
      refreshStatus();
      runSync({ silent: true });
    } else {
      const errBox = document.getElementById('tradovateConnectError');
      if (errBox) {
        errBox.textContent = msg.error || 'Connexion OAuth échouée.';
        errBox.classList.remove('hidden');
      } else {
        showToast(msg.error || 'Connexion OAuth échouée.', 'error', 4500);
      }
    }
    _oauthPopup = null;
    _oauthPendingLabel = null;
  });

  // --------------------------------------
  // Connect form (label + env → startOAuthConnect)
  // --------------------------------------
  async function handleConnect(event) {
    event.preventDefault();
    const env   = document.querySelector('input[name="tradovateEnv"]:checked')?.value;
    const label = document.getElementById('tradovateLabel')?.value?.trim();
    await startOAuthConnect({ env, label });
  }

  // --------------------------------------
  // Sync (manuel ou auto)
  // --------------------------------------
  let syncInFlight = false;

  async function runSync({ silent = true } = {}) {
    if (syncInFlight) return;
    syncInFlight = true;

    const toast = silent ? null : showToast('Sync Tradovate en cours...');
    try {
      const data = await authedFetch('/sync', { method: 'POST' });
      const n = data.total_trades || 0;
      if (toast) toast.update(`${n} trade(s) synchronisé(s)`, 'success');
      else if (n > 0) showToast(`${n} trade(s) Tradovate importé(s)`, 'success', 3000);

      if (document.getElementById('connections')?.classList.contains('section') &&
          !document.getElementById('connections').classList.contains('hidden')) {
        refreshStatus();
      }

      if (typeof window.refreshAllModules === 'function') {
        window.refreshAllModules();
      }
    } catch (err) {
      console.warn('[TRADOVATE] sync error:', err);
      if (toast) toast.update(`Sync échouée : ${err.message}`, 'error');
    } finally {
      syncInFlight = false;
    }
  }

  // --------------------------------------
  // Disconnect / Reconnect (par credentials_id)
  // --------------------------------------
  async function handleDisconnect(credentialsId, label) {
    if (!credentialsId) return;
    if (!confirm(`Déconnecter "${label}" ? Tes trades déjà importés sont conservés.`)) {
      return;
    }
    try {
      await authedFetch('/disconnect', {
        method: 'POST',
        body: { credentials_id: Number(credentialsId) }
      });
      await refreshStatus();
      showToast(`"${label}" déconnecté`, 'success', 2500);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error', 4000);
    }
  }

  // Reconnecter = déconnecter l'ancienne ligne puis relancer le flow OAuth
  // avec le même label/env. UX simple, pas de race.
  async function handleReauth(credentialsId, label, env) {
    if (!credentialsId || !label || !env) return;
    if (!confirm(`Reconnecter "${label}" ? Tu vas être redirigé vers Tradovate pour te logguer à nouveau.`)) {
      return;
    }
    try {
      await authedFetch('/disconnect', {
        method: 'POST',
        body: { credentials_id: Number(credentialsId) }
      });
      await refreshStatus();
      await startOAuthConnect({ env, label });
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error', 4000);
    }
  }

  // --------------------------------------
  // Toast minimal
  // --------------------------------------
  function showToast(message, kind = 'info', autoCloseMs = null) {
    const colors = {
      info:    { bg: '#1e3a8a', fg: '#ffffff' },
      success: { bg: '#047857', fg: '#ffffff' },
      error:   { bg: '#b91c1c', fg: '#ffffff' }
    };
    const c = colors[kind] || colors.info;
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: ${c.bg}; color: ${c.fg};
      padding: 12px 20px; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      font-size: 14px; max-width: 360px;
      transition: opacity 0.2s ease;
    `;
    el.textContent = message;
    document.body.appendChild(el);

    const close = () => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    };
    if (autoCloseMs) setTimeout(close, autoCloseMs);

    return {
      update(newMessage, newKind) {
        if (newKind && colors[newKind]) el.style.background = colors[newKind].bg;
        el.textContent = newMessage;
        setTimeout(close, 2500);
      },
      close
    };
  }

  // --------------------------------------
  // Délégation des clics
  // --------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'tradovate-sync') {
      runSync({ silent: false });
    } else if (action === 'tradovate-disconnect') {
      handleDisconnect(btn.dataset.credentialsId, btn.dataset.label);
    } else if (action === 'tradovate-reauth') {
      handleReauth(btn.dataset.credentialsId, btn.dataset.label, btn.dataset.env);
    }
  });

  // --------------------------------------
  // Bind du formulaire
  // --------------------------------------
  function bindConnectForm() {
    const form = document.getElementById('tradovateConnectForm');
    if (form && !form.dataset.bound) {
      form.addEventListener('submit', handleConnect);
      form.dataset.bound = '1';
    }
  }
  document.addEventListener('DOMContentLoaded', bindConnectForm);
  bindConnectForm();

  // --------------------------------------
  // API publique
  // --------------------------------------
  window.tradovateAutosync = function () {
    runSync({ silent: true });
  };

  window.tradovateRefreshStatusUI = function () {
    bindConnectForm();
    refreshStatus();
  };

  console.log('[TRADOVATE] ✅ supabase-tradovate.js chargé');
})();
