// ========================================
// POST /api/tradovate/oauth-start
// Body : { env: 'demo'|'live', label: string }
// Header : Authorization: Bearer <supabase JWT>
//
// Initie le flow OAuth Tradovate :
//   1. génère un `state` cryptographique (32 bytes hex) pour le CSRF
//   2. stocke (state, user_id, env, label) avec TTL 10 min
//   3. renvoie { authorize_url } que le frontend ouvre dans une popup
//
// La popup amène l'élève sur trader.tradovate.com où il se logue
// avec SES credentials Tradovate. Après consentement, Tradovate
// redirige sur /api/tradovate/oauth-callback avec ?code=...&state=...
// ========================================

import { randomBytes } from 'node:crypto';
import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';
import { buildAuthorizeUrl } from './_lib/client.js';

const VALID_ENVS = new Set(['demo', 'live']);
const LABEL_MAX_LEN = 50;
const STATE_TTL_MS = 10 * 60 * 1000;  // 10 min

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const body = await readJson(req);

    const { env, label } = body || {};
    if (!VALID_ENVS.has(env)) {
      throw httpError(400, 'env doit être "demo" ou "live"');
    }
    if (typeof label !== 'string' || !label.trim()) {
      throw httpError(400, 'label manquant (nom de la prop firm)');
    }
    const labelClean = label.trim().slice(0, LABEL_MAX_LEN);

    const clientId    = process.env.TRADOVATE_CLIENT_ID;
    const redirectUri = process.env.TRADOVATE_OAUTH_REDIRECT_URI;
    if (!clientId) {
      console.error('[OAUTH-START] TRADOVATE_CLIENT_ID manquant en env');
      throw httpError(500, 'configuration serveur incomplète (client_id)');
    }
    if (!redirectUri) {
      console.error('[OAUTH-START] TRADOVATE_OAUTH_REDIRECT_URI manquant en env');
      throw httpError(500, 'configuration serveur incomplète (redirect_uri)');
    }

    // Refus précoce si le label est déjà pris — évite à l'élève de faire
    // tout le flow OAuth pour rien.
    const sb = getServiceClient();
    const { data: existing } = await sb
      .from('tradovate_credentials')
      .select('id')
      .eq('user_id', user_id)
      .eq('label', labelClean)
      .maybeSingle();
    if (existing) {
      throw httpError(409, `Une connexion avec le libellé "${labelClean}" existe déjà.`);
    }

    // State CSRF cryptographique
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

    const { error: insErr } = await sb
      .from('tradovate_oauth_states')
      .insert({ state, user_id, env, label: labelClean, expires_at: expiresAt });
    if (insErr) {
      console.error('[OAUTH-START] state insert error:', insErr);
      throw httpError(500, 'erreur préparation OAuth');
    }

    const authorize_url = buildAuthorizeUrl({ clientId, redirectUri, state });
    return res.status(200).json({ authorize_url });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[OAUTH-START] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
