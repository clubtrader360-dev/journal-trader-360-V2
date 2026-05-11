// ========================================
// AUTH BACKEND POUR LES ROUTES TRADOVATE
// ========================================
// Chaque route /api/tradovate/* est appelée par le frontend avec
// l'access_token JWT de l'élève en header Authorization.
// On l'envoie à Supabase pour récupérer le user → c'est lui qui sert
// d'identité. Pas besoin de re-vérifier la signature manuellement :
// si Supabase nous renvoie un user, le token est valide.
//
// Pour les opérations DB côté serveur, on utilise la SERVICE_ROLE_KEY
// (bypass RLS). C'est OK parce que :
//   - on ne lit/écrit QUE sur les lignes de l'utilisateur authentifié
//   - on filtre toujours par user_id == auth.uid récupéré ci-dessous
// ========================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
// Mêmes deux noms acceptés que pour le cron weekly-report
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

let _serviceClient = null;
export function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante (env Vercel)'
    );
  }
  if (!_serviceClient) {
    _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return _serviceClient;
}

// Renvoie { user_id } si le bearer token est valide, sinon throw 401.
export async function requireUser(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw httpError(401, 'Bearer token manquant');
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token) throw httpError(401, 'Bearer token vide');

  const sb = getServiceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'token Supabase invalide');
  }
  return { user_id: data.user.id, email: data.user.email };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Helper pour parser le body JSON sur Vercel sans dépendre du parser auto
// (qui change selon `vercel dev` vs prod). On lit le stream nous-mêmes.
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => { buf += chunk; });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); }
      catch (e) { reject(httpError(400, 'JSON invalide')); }
    });
    req.on('error', reject);
  });
}
