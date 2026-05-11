// ========================================
// POST /api/tradovate/connect
// Body : { env: 'demo'|'live', username, password }
// Header : Authorization: Bearer <supabase JWT>
//
// Valide les creds en faisant un appel test à Tradovate.
// Si OK, chiffre et stocke (1 ligne par (user, env)).
// Renvoie { ok: true, env, expiresAt }.
// ========================================

import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';
import { encrypt } from './_lib/crypto.js';

const VALID_ENVS = new Set(['demo', 'live']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const body = await readJson(req);

    const { env, username, password } = body || {};
    if (!VALID_ENVS.has(env)) {
      throw httpError(400, 'env doit être "demo" ou "live"');
    }
    if (typeof username !== 'string' || username.length < 1) {
      throw httpError(400, 'username manquant');
    }
    if (typeof password !== 'string' || password.length < 1) {
      throw httpError(400, 'password manquant');
    }

    // Test des creds — on fait l'auth Tradovate pour valider AVANT de stocker.
    const { requestAccessToken, TradovateError } =
      await import('./_lib/client.js');
    let token;
    try {
      token = await requestAccessToken({ env, username, password });
    } catch (err) {
      if (err instanceof TradovateError) {
        // Erreur d'auth Tradovate explicite → 401 vers le frontend
        return res.status(401).json({
          error: 'Tradovate a refusé les identifiants',
          detail: err.message
        });
      }
      throw err;
    }

    // Chiffrement des creds
    const encU = encrypt(username);
    const encP = encrypt(password);

    // Upsert dans tradovate_credentials (une ligne par (user, env))
    const sb = getServiceClient();
    const { error: upsertErr } = await sb
      .from('tradovate_credentials')
      .upsert(
        {
          user_id,
          env,
          encrypted_username: encU.ciphertext,
          username_iv:        encU.iv,
          username_auth_tag:  encU.authTag,
          encrypted_password: encP.ciphertext,
          password_iv:        encP.iv,
          password_auth_tag:  encP.authTag,
          last_token:           token.accessToken,
          last_md_token:        token.mdAccessToken,
          last_token_expires_at: token.expirationTime,
          last_sync_status: null,
          last_sync_error: null
        },
        { onConflict: 'user_id,env' }
      );

    if (upsertErr) {
      console.error('[CONNECT] upsert error:', upsertErr);
      return res.status(500).json({ error: 'Erreur DB lors du stockage' });
    }

    return res.status(200).json({
      ok: true,
      env,
      expiresAt: token.expirationTime
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[CONNECT] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
