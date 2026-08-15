// ========================================
// CLIENT TRADOVATE — UI Connexions + Autosync
// ========================================
// Pilote la section #connections : affiche l'état (connecté oui/non,
// dernière sync, comptes importés), gère le formulaire de connexion,
// le bouton sync manuel, le bouton disconnect.
//
// Expose aussi window.tradovateAutosync() utilisé par supabase-auth.js
// après un login élève réussi.
// ========================================

(() => {
  'use strict';

  console.log('[TRADOVATE] Chargement supabase-tradovate.js...');

  const API_BASE = '/api/tradovate';
  const escape = window.escapeHtml || ((s) => String(s == null ? '' : s));

  // --------------------------------------
  // Helper : appel API authentifié
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
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);

    // Routeur consolidé : /connect|/status|/sync|/disconnect → /api/tradovate?action=connect|…
    const action = String(path).replace(/^\//, '');
    const res = await fetch(`${API_BASE}?action=${action}`, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* noop */ }

    if (!res.ok) {
      const msg = json?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.detail = json?.detail;
      throw err;
    }
    return json || {};
  }

  // --------------------------------------
  // Rendu de l'état des connexions
  // --------------------------------------
  async function refreshStatus() {
    const container = document.getElementById('tradovateStatusContainer');
    if (!container) return;

    try {
      const data = await authedFetch('/status');
      renderStatus(container, data.envs || {});
    } catch (err) {
      container.innerHTML = `
        <div class="trader-card p-6 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Erreur chargement état : ${escape(err.message)}</p>
        </div>
      `;
    }
  }

  function renderStatus(container, byEnv) {
    const envs = ['demo', 'live'];
    const cards = envs.map(env => {
      const info = byEnv[env];
      if (!info?.connected) {
        return `
          <div class="trader-card p-4 flex items-center justify-between">
            <div>
              <div class="text-sm uppercase tracking-wide text-gray-500">${escape(env)}</div>
              <div class="text-base text-gray-700">Non connecté</div>
            </div>
            <span class="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">Inactif</span>
          </div>
        `;
      }
      const lastSync = info.last_synced_at
        ? new Date(info.last_synced_at).toLocaleString('fr-FR')
        : 'jamais';
      const statusBadge = info.last_sync_status === 'error'
        ? `<span class="px-3 py-1 rounded-full text-xs bg-red-100 text-red-700">Erreur</span>`
        : `<span class="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700">Connecté</span>`;
      const accountsList = (info.accounts || []).map(a => `
        <li class="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
          <span class="text-gray-700">${escape(a.name || `Compte ${a.tradovate_account_id}`)}</span>
          <span class="text-gray-500">${a.trades_created_total || 0} trades importés</span>
        </li>
      `).join('') || '<li class="text-sm text-gray-500 py-1">Aucun compte synchronisé pour le moment.</li>';

      const errorBox = info.last_sync_status === 'error' && info.last_sync_error
        ? `<div class="mt-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">${escape(info.last_sync_error)}</div>`
        : '';

      return `
        <div class="trader-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-sm uppercase tracking-wide text-gray-500">${escape(env)}</div>
              <div class="text-base text-gray-800 font-semibold">Tradovate connecté</div>
              <div class="text-xs text-gray-500 mt-1">Dernière sync : ${escape(lastSync)}</div>
            </div>
            ${statusBadge}
          </div>
          <ul class="mb-4">${accountsList}</ul>
          ${errorBox}
          <div class="flex flex-wrap gap-2">
            <button class="trader-btn-secondary" data-action="tradovate-sync" data-env="${escape(env)}">
              <i class="fas fa-sync-alt mr-2"></i>Sync maintenant
            </button>
            <button class="trader-btn-secondary" data-action="tradovate-disconnect" data-env="${escape(env)}" style="color: #b91c1c; border-color: #fca5a5;">
              <i class="fas fa-unlink mr-2"></i>Déconnecter
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = cards;
  }

  // --------------------------------------
  // Connect form
  // --------------------------------------
  async function handleConnect(event) {
    event.preventDefault();
    const errBox = document.getElementById('tradovateConnectError');
    const btn = document.getElementById('tradovateConnectBtn');
    if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }

    const env = document.querySelector('input[name="tradovateEnv"]:checked')?.value;
    const username = document.getElementById('tradovateUsername')?.value?.trim();
    const password = document.getElementById('tradovatePassword')?.value;

    if (!env || !username || !password) {
      if (errBox) {
        errBox.textContent = 'Tous les champs sont requis.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    btn.disabled = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Connexion...';

    try {
      await authedFetch('/connect', {
        method: 'POST',
        body: { env, username, password }
      });
      // Reset form
      document.getElementById('tradovateConnectForm')?.reset();
      // Premier sync immédiat (non-bloquant)
      runSync({ silent: false });
      await refreshStatus();
    } catch (err) {
      if (errBox) {
        const detail = err.detail ? ` (${err.detail})` : '';
        errBox.textContent = `${err.message}${detail}`;
        errBox.classList.remove('hidden');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
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

      // Si on est sur la page Connexions, rafraîchir l'état
      if (document.getElementById('connections')?.classList.contains('section') &&
          !document.getElementById('connections').classList.contains('hidden')) {
        refreshStatus();
      }

      // Recharger les modules trades pour que le journal voie les nouveaux trades
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
  // Disconnect
  // --------------------------------------
  async function handleDisconnect(env) {
    if (!confirm(`Déconnecter Tradovate ${env} ? Tes trades déjà importés sont conservés.`)) {
      return;
    }
    try {
      await authedFetch('/disconnect', { method: 'POST', body: { env } });
      await refreshStatus();
      showToast(`Tradovate ${env} déconnecté`, 'success', 2500);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error', 4000);
    }
  }

  // --------------------------------------
  // Toast minimal (pas de dépendance)
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
        if (newKind && colors[newKind]) {
          el.style.background = colors[newKind].bg;
        }
        el.textContent = newMessage;
        setTimeout(close, 2500);
      },
      close
    };
  }

  // --------------------------------------
  // Délégation des clics sur les boutons rendus
  // --------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'tradovate-sync') {
      runSync({ silent: false });
    } else if (action === 'tradovate-disconnect') {
      handleDisconnect(btn.dataset.env);
    }
  });

  // --------------------------------------
  // Bind du formulaire (au DOMContentLoaded ou plus tard)
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
  // API publique (utilisée par supabase-auth.js et showSection)
  // --------------------------------------
  window.tradovateAutosync = function () {
    // Fire-and-forget : pas await
    runSync({ silent: true });
  };

  window.tradovateRefreshStatusUI = function () {
    bindConnectForm();
    refreshStatus();
  };

  console.log('[TRADOVATE] ✅ supabase-tradovate.js chargé');
})();
