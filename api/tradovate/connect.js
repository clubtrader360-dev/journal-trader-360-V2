// ========================================
// POST /api/tradovate/connect
// Body : { env: 'demo'|'live', username, password, label }
// Header : Authorization: Bearer <supabase JWT>
//
// Valide les creds en faisant un appel test à Tradovate.
// Si OK, chiffre et insère une nouvelle ligne (1 par (user, label)).
// Renvoie { ok, credentials_id, label, env, expiresAt }.
// 409 si le label est déjà utilisé par cet élève.
// ========================================

import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';
import { encrypt } from './_lib/crypto.js';

const VALID_ENVS = new Set(['demo', 'live']);
const LABEL_MAX_LEN = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const body = await readJson(req);

    const { env, username, password, label } = body || {};
    if (!VALID_ENVS.has(env)) {
      throw httpError(400, 'env doit être "demo" ou "live"');
    }
    if (typeof username !== 'string' || username.length < 1) {
      throw httpError(400, 'username manquant');
    }
    if (typeof password !== 'string' || password.length < 1) {
      throw httpError(400, 'password manquant');
    }
    if (typeof label !== 'string' || !label.trim()) {
      throw httpError(400, 'label manquant (nom de la prop firm)');
    }
    const labelClean = label.trim().slice(0, LABEL_MAX_LEN);

    // Test des creds — on fait l'auth Tradovate AVANT de stocker.
    const { requestAccessToken, TradovateError } =
      await import('./_lib/client.js');
    let token;
    try {
      token = await requestAccessToken({ env, username, password });
    } catch (err) {
      if (err instanceof TradovateError) {
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

    // INSERT (pas upsert) — chaque label crée une connexion distincte.
    const sb = getServiceClient();
    const { data: inserted, error: insErr } = await sb
      .from('tradovate_credentials')
      .insert({
        user_id,
        env,
        label: labelClean,
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
      })
      .select('id, label, env')
      .single();

    if (insErr) {
      // 23505 = unique_violation sur (user_id, label)
      if (insErr.code === '23505') {
        return res.status(409).json({
          error: `Une connexion avec le libellé "${labelClean}" existe déjà. Choisis un autre nom.`
        });
      }
      console.error('[CONNECT] insert error:', insErr);
      return res.status(500).json({ error: 'Erreur DB lors du stockage' });
    }

    return res.status(200).json({
      ok: true,
      credentials_id: inserted.id,
      label: inserted.label,
      env: inserted.env,
      expiresAt: token.expirationTime
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[CONNECT] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
