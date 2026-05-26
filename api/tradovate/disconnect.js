// ========================================
// POST /api/tradovate/disconnect
// Body : { credentials_id: number }
// Header : Authorization: Bearer <supabase JWT>
//
// Supprime UNE connexion Tradovate (identifiée par son credentials_id).
// Les tradovate_sync_state liés sont supprimés en cascade (FK ON DELETE CASCADE).
// IMPORTANT : ne touche PAS aux trades déjà importés ni aux accounts —
// l'élève garde son historique et peut se reconnecter plus tard.
// Tradovate n'expose pas d'endpoint de révocation API — l'élève peut
// révoquer manuellement depuis son panel Tradovate (Apps autorisées).
// ========================================

import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const body = await readJson(req);
    const sb = getServiceClient();

    const credentialsId = Number(body?.credentials_id);
    if (!Number.isInteger(credentialsId) || credentialsId <= 0) {
      throw httpError(400, 'credentials_id requis (entier)');
    }

    const { data, error } = await sb
      .from('tradovate_credentials')
      .delete()
      .eq('id', credentialsId)
      .eq('user_id', user_id)
      .select('id, label');

    if (error) {
      console.error('[DISCONNECT] delete error:', error);
      return res.status(500).json({ error: 'Erreur DB' });
    }
    if (!data || data.length === 0) {
      throw httpError(404, 'connexion introuvable ou non autorisée');
    }

    return res.status(200).json({
      ok: true,
      disconnected: { credentials_id: data[0].id, label: data[0].label }
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[DISCONNECT] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
