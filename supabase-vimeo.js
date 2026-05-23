// ========================================
// CLIENT VIMEO — proxy /api/vimeo (coach uniquement)
// ========================================
// authedFetch décalqué de supabase-tradovate.js : envoie le JWT Supabase
// dans Authorization. Le token Vimeo reste serveur (env Vercel).
// ========================================

(() => {
  'use strict';
  console.log('[VIMEO] Chargement supabase-vimeo.js...');

  const API_BASE = '/api/vimeo';

  async function authedFetch(path) {
    const sb = window.supabaseClient;
    if (!sb) throw new Error('Supabase non chargé');
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type':  'application/json'
      }
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}

    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json || {};
  }

  async function getVimeoMetadata(videoId, hash) {
    const qs = new URLSearchParams({ video_id: String(videoId) });
    if (hash) qs.set('hash', hash);
    return authedFetch(`/metadata?${qs}`);
  }

  async function listVimeoVideos(page = 1) {
    return authedFetch(`/list?page=${Math.max(1, parseInt(page, 10) || 1)}`);
  }

  window.getVimeoMetadata = getVimeoMetadata;
  window.listVimeoVideos  = listVimeoVideos;

  console.log('[VIMEO] ✅ Module chargé.');
})();
