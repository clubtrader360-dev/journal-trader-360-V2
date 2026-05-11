// ========================================
// POST /api/tradovate/disconnect
// Body : { env: 'demo'|'live' }   (déconnecte un seul env)
//        ou { all: true }         (déconnecte tout)
// Header : Authorization: Bearer <supabase JWT>
//
// Supprime les creds chiffrées + le sync_state.
// IMPORTANT : ne touche PAS aux trades déjà importés ni aux accounts —
// l'élève garde son historique et peut se reconnecter plus tard.
// ========================================

import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';

const VALID_ENVS = new Set(['demo', 'live']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const body = await readJson(req);
    const sb = getServiceClient();

    const { env, all } = body || {};
    let envsToRemove;

    if (all === true) {
      envsToRemove = ['demo', 'live'];
    } else if (VALID_ENVS.has(env)) {
      envsToRemove = [env];
    } else {
      throw httpError(400, 'spécifie env ("demo"|"live") ou all=true');
    }

    const { error: e1 } = await sb
      .from('tradovate_credentials')
      .delete()
      .eq('user_id', user_id)
      .in('env', envsToRemove);
    if (e1) throw e1;

    const { error: e2 } = await sb
      .from('tradovate_sync_state')
      .delete()
      .eq('user_id', user_id)
      .in('env', envsToRemove);
    if (e2) throw e2;

    return res.status(200).json({ ok: true, disconnected: envsToRemove });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[DISCONNECT] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
