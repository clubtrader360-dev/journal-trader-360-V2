// ========================================
// CONFIGURATION SUPABASE
// ========================================

(() => {
  'use strict';

  console.log('[CONFIG] Chargement supabase-config.js...');

  // ========================================
  // HELPERS DE SÉCURITÉ
  // ========================================
  // Échappe les caractères HTML dangereux pour neutraliser les XSS stockées
  // lorsqu'une valeur issue de la DB est interpolée dans une template string
  // utilisée avec innerHTML. À utiliser systématiquement pour tout champ
  // contrôlé par l'utilisateur (name, email, notes, symbol, setup, etc.).
  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '/': '&#47;'
  };
  window.escapeHtml = function (value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`/]/g, (ch) => ESCAPE_MAP[ch]);
  };

  /**
   * Normalise l'affichage du type de trade (cosmétique seul, jamais en DB).
   * Préserve les sous-types RR1/RR2 (déjà en casse mixte propre).
   * "LONG"/"long" → "Long", "SHORT"/"short" → "Short", "Short (RR1 atteint)" → inchangé.
   * @param {string} rawType - valeur brute de trade.type
   * @returns {string} valeur normalisée pour l'affichage
   */
  window.formatTradeType = function (rawType) {
    if (!rawType) return '';
    const t = String(rawType).trim();
    if (t.includes('RR1') || t.includes('RR2')) return t; // sous-types : ne pas toucher
    const upper = t.toUpperCase();
    if (upper === 'LONG') return 'Long';
    if (upper === 'SHORT') return 'Short';
    return t; // fallback sûr : valeur inconnue laissée telle quelle
  };

  // ========================================
  // CONFIGURATION
  // ========================================
  // SECURITY: SUPABASE_ANON_KEY n'est PAS un secret. Elle est exposée côté client
  // par design (JWT avec role:"anon"). Sa sécurité dépend ENTIÈREMENT des policies
  // RLS (Row Level Security) configurées sur chaque table Supabase.
  // → Vérifier dans Supabase Dashboard que RLS est activé sur toutes les tables.
  // Ne JAMAIS mettre la clé service_role ici (elle bypasse RLS).
  const SUPABASE_URL = 'https://zgihbpgoorymomtsbxpz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnaWhicGdvb3J5bW9tdHNieHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NTkyODgsImV4cCI6MjA3OTEzNTI4OH0.eGTwcpYON_uP3ppOhVIWs4qKJLjn9TyE7usGnvU4oRA';

  // ========================================
  // VALIDATION
  // ========================================
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[CONFIG] ❌ ERREUR : SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
    return;
  }

  // ========================================
  // VÉRIFIER QUE LA BIBLIOTHÈQUE SUPABASE EST CHARGÉE
  // ========================================
  if (typeof supabase === 'undefined') {
    console.error('[CONFIG] ❌ ERREUR : Bibliothèque Supabase non chargée. Vérifiez le <script> dans index.html');
    return;
  }

  // ========================================
  // PURGE — toute trace de session Supabase éventuellement laissée
  // dans localStorage par d'anciennes versions. Le client est configuré
  // ci-dessous pour ne RIEN persister dans localStorage.
  // ========================================
  try {
    Object.keys(localStorage).forEach((k) => {
      if (/^sb-.*-auth-token/.test(k) || k === 'supabase.auth.token') {
        localStorage.removeItem(k);
      }
    });
  } catch (_) { /* ignore */ }

  // ========================================
  // STORAGE — sessionStorage uniquement (vidé à la fermeture de l'onglet)
  // → la session reste valide pendant la navigation (refresh inclus tant
  //   que l'onglet est ouvert) MAIS aucune trace persistante sur le disque.
  // ========================================
  const sessionStorageAdapter = {
    getItem: (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    setItem: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} },
    removeItem: (k) => { try { sessionStorage.removeItem(k); } catch (_) {} }
  };

  // ========================================
  // CRÉER LE CLIENT SUPABASE
  // ========================================
  try {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sessionStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    console.log('[CONFIG] ✅ Client Supabase créé (auth en sessionStorage, pas de localStorage)');
  } catch (error) {
    console.error('[CONFIG] ❌ Erreur création client Supabase:', error);
  }
})();
