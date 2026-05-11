// ========================================
// GET /api/tradovate/status
// Header : Authorization: Bearer <supabase JWT>
//
// Renvoie l'état des connexions Tradovate de l'élève (sans les creds).
// Utilisé par la page Connexions pour afficher : connecté oui/non,
// dernière sync, dernier statut, comptes par env.
// ========================================

import { requireUser, getServiceClient } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const sb = getServiceClient();

    const [{ data: creds }, { data: states }] = await Promise.all([
      sb.from('tradovate_credentials')
        .select('env, last_synced_at, last_sync_status, last_sync_error, last_token_expires_at, created_at')
        .eq('user_id', user_id),
      sb.from('tradovate_sync_state')
        .select('env, tradovate_account_id, tradovate_account_name, last_fill_id, last_synced_at, fills_imported_total, trades_created_total')
        .eq('user_id', user_id)
    ]);

    const byEnv = {};
    for (const c of (creds || [])) {
      byEnv[c.env] = {
        connected: true,
        last_synced_at: c.last_synced_at,
        last_sync_status: c.last_sync_status,
        last_sync_error: c.last_sync_error,
        token_expires_at: c.last_token_expires_at,
        connected_at: c.created_at,
        accounts: []
      };
    }
    for (const s of (states || [])) {
      if (!byEnv[s.env]) continue;
      byEnv[s.env].accounts.push({
        tradovate_account_id: s.tradovate_account_id,
        name: s.tradovate_account_name,
        last_fill_id: s.last_fill_id,
        last_synced_at: s.last_synced_at,
        fills_imported_total: s.fills_imported_total,
        trades_created_total: s.trades_created_total
      });
    }

    return res.status(200).json({ envs: byEnv });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[STATUS] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
