// ========================================
// GET /api/tradovate/status
// Header : Authorization: Bearer <supabase JWT>
//
// Renvoie la liste des connexions OAuth Tradovate de l'élève.
//
// Shape : {
//   connections: [
//     {
//       id, label, env,
//       last_synced_at, last_sync_status, last_sync_error,
//       connected_at,
//       access_token_expires_at, refresh_token_expires_at,
//       needs_reauth,             // true si refresh_token expiré
//       accounts: [{ tradovate_account_id, name, last_fill_id,
//                    last_synced_at, fills_imported_total,
//                    trades_created_total }]
//     }
//   ]
// }
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
        .select('id, env, label, last_synced_at, last_sync_status, last_sync_error, access_token_expires_at, refresh_token_expires_at, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true }),
      sb.from('tradovate_sync_state')
        .select('credentials_id, tradovate_account_id, tradovate_account_name, last_fill_id, last_synced_at, fills_imported_total, trades_created_total')
        .eq('user_id', user_id)
    ]);

    const byCredId = new Map();
    for (const s of (states || [])) {
      if (!byCredId.has(s.credentials_id)) byCredId.set(s.credentials_id, []);
      byCredId.get(s.credentials_id).push({
        tradovate_account_id:  s.tradovate_account_id,
        name:                  s.tradovate_account_name,
        last_fill_id:          s.last_fill_id,
        last_synced_at:        s.last_synced_at,
        fills_imported_total:  s.fills_imported_total,
        trades_created_total:  s.trades_created_total
      });
    }

    const now = Date.now();
    const connections = (creds || []).map(c => {
      const refreshExp = c.refresh_token_expires_at
        ? new Date(c.refresh_token_expires_at).getTime()
        : null;
      const needs_reauth =
        (refreshExp !== null && refreshExp < now) ||
        c.last_sync_status === 'needs_reauth';
      return {
        id:                        c.id,
        label:                     c.label,
        env:                       c.env,
        last_synced_at:            c.last_synced_at,
        last_sync_status:          c.last_sync_status,
        last_sync_error:           c.last_sync_error,
        connected_at:              c.created_at,
        access_token_expires_at:   c.access_token_expires_at,
        refresh_token_expires_at:  c.refresh_token_expires_at,
        needs_reauth,
        accounts:                  byCredId.get(c.id) || []
      };
    });

    return res.status(200).json({ connections });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[STATUS] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
