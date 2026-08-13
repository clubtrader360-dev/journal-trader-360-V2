// ========================================
// GET /api/tradovate/oauth-callback?code=...&state=...
// (PAS d'auth JWT — Tradovate redirige le browser de l'élève ici,
//  l'identification se fait via le `state` stocké en DB.)
//
// 1. Vérifie le state → retrouve { user_id, env, label }, supprime le state.
// 2. POST /auth/oauthtoken avec grant_type=authorization_code.
// 3. Chiffre access_token + refresh_token avec TRADOVATE_ENCRYPTION_KEY.
// 4. INSERT dans tradovate_credentials.
// 5. Renvoie une page HTML qui postMessage au parent + window.close().
// ========================================

import { getServiceClient } from './_lib/auth.js';
import { encrypt } from './_lib/crypto.js';
import { exchangeCodeForTokens, TradovateError } from './_lib/client.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendHtml(res, 405, errorHtml('Méthode non autorisée'));
  }

  // Tradovate peut redirect avec ?error=access_denied si l'élève refuse.
  if (req.query?.error) {
    return sendHtml(res, 200, errorHtml(
      `Connexion refusée : ${String(req.query.error)}${
        req.query.error_description ? ' — ' + String(req.query.error_description) : ''
      }`
    ));
  }

  const code  = typeof req.query?.code  === 'string' ? req.query.code  : '';
  const state = typeof req.query?.state === 'string' ? req.query.state : '';
  if (!code || !state) {
    return sendHtml(res, 400, errorHtml('Paramètres OAuth manquants (code ou state).'));
  }

  try {
    const sb = getServiceClient();

    // 1. State : retrouver + consommer (one-shot)
    const { data: row, error: selErr } = await sb
      .from('tradovate_oauth_states')
      .select('user_id, env, label, expires_at')
      .eq('state', state)
      .maybeSingle();

    if (selErr) {
      console.error('[OAUTH-CB] state lookup error:', selErr);
      return sendHtml(res, 500, errorHtml('Erreur interne (lookup state).'));
    }
    if (!row) {
      return sendHtml(res, 400, errorHtml('State OAuth invalide ou déjà utilisé.'));
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await sb.from('tradovate_oauth_states').delete().eq('state', state);
      return sendHtml(res, 400, errorHtml('State OAuth expiré (>10 min). Relance la connexion.'));
    }

    // Consomme immédiatement — empêche les replays
    await sb.from('tradovate_oauth_states').delete().eq('state', state);

    const { user_id, env, label } = row;

    // 2. Échange code → tokens
    const clientId     = process.env.TRADOVATE_CLIENT_ID;
    const clientSecret = process.env.TRADOVATE_CLIENT_SECRET;
    const redirectUri  = process.env.TRADOVATE_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[OAUTH-CB] env vars manquantes');
      return sendHtml(res, 500, errorHtml('Configuration serveur incomplète.'));
    }

    let tokens;
    try {
      tokens = await exchangeCodeForTokens({
        env, code, clientId, clientSecret, redirectUri
      });
    } catch (err) {
      if (err instanceof TradovateError) {
        return sendHtml(res, 200, errorHtml(
          `Tradovate a refusé l'échange : ${err.message}`
        ));
      }
      console.error('[OAUTH-CB] exchange error:', err);
      return sendHtml(res, 500, errorHtml('Erreur lors de l\'échange du code OAuth.'));
    }

    // 3. Chiffre les tokens
    const encA = encrypt(tokens.access_token);
    const encR = encrypt(tokens.refresh_token || '');

    // 4. INSERT (refus si label dupliqué — peu probable car vérifié dans oauth-start,
    //    mais possible en cas de race condition entre deux popups parallèles)
    const { data: inserted, error: insErr } = await sb
      .from('tradovate_credentials')
      .insert({
        user_id,
        env,
        label,
        encrypted_access_token:   encA.ciphertext,
        access_token_iv:          encA.iv,
        access_token_auth_tag:    encA.authTag,
        access_token_expires_at:  tokens.access_token_expires_at,
        encrypted_refresh_token:  encR.ciphertext,
        refresh_token_iv:         encR.iv,
        refresh_token_auth_tag:   encR.authTag,
        refresh_token_expires_at: tokens.refresh_token_expires_at
      })
      .select('id, label, env')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        return sendHtml(res, 200, errorHtml(
          `Une connexion avec le libellé "${label}" existe déjà.`
        ));
      }
      console.error('[OAUTH-CB] insert error:', insErr);
      return sendHtml(res, 500, errorHtml('Erreur DB lors du stockage.'));
    }

    return sendHtml(res, 200, successHtml({
      credentials_id: inserted.id,
      label:          inserted.label,
      env:            inserted.env
    }));
  } catch (err) {
    console.error('[OAUTH-CB] fatal:', err);
    return sendHtml(res, 500, errorHtml('Erreur interne inattendue.'));
  }
}

function sendHtml(res, status, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(html);
}

// Page de succès : postMessage au parent puis close.
function successHtml({ credentials_id, label, env }) {
  const payload = JSON.stringify({
    type: 'tradovate-oauth-done',
    success: true,
    credentials_id,
    label,
    env
  });
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Tradovate connecté</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:48px 24px;background:#f9fafb;color:#111827}.ok{font-size:48px;margin-bottom:16px}h1{font-size:18px;font-weight:600;margin:0 0 8px}p{margin:0;color:#6b7280;font-size:14px}</style>
</head><body>
<div class="ok">✅</div>
<h1>Tradovate connecté</h1>
<p>Cette fenêtre va se fermer automatiquement…</p>
<script>
(function () {
  try { if (window.opener) window.opener.postMessage(${payload}, '*'); } catch (e) {}
  setTimeout(function () { try { window.close(); } catch (e) {} }, 500);
})();
</script>
</body></html>`;
}

function errorHtml(message) {
  const safe = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const payload = JSON.stringify({
    type: 'tradovate-oauth-done',
    success: false,
    error: message
  });
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Erreur Tradovate</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:48px 24px;background:#f9fafb;color:#111827}.ko{font-size:48px;margin-bottom:16px;color:#dc2626}h1{font-size:18px;font-weight:600;margin:0 0 8px}p{margin:0;color:#6b7280;font-size:14px;max-width:480px;margin-left:auto;margin-right:auto}</style>
</head><body>
<div class="ko">⚠️</div>
<h1>Connexion Tradovate impossible</h1>
<p>${safe}</p>
<p style="margin-top:24px;font-size:12px">Tu peux fermer cette fenêtre et réessayer.</p>
<script>
(function () {
  try { if (window.opener) window.opener.postMessage(${payload}, '*'); } catch (e) {}
})();
</script>
</body></html>`;
}
