// ========================================
// CLIENT API TRADOVATE — OAuth 2.0
// ========================================
// Doc officielle :
//   - https://github.com/tradovate/example-api-oauth
//   - https://partner.tradovate.com/api/rest-api-endpoints/authentication/o-auth-token
//   - https://tradovate.zendesk.com/hc/en-us/articles/4408935298707
//
// Flow OAuth :
//   1. Authorize URL hébergée : https://trader.tradovate.com/oauth
//      → user se logue avec ses creds Tradovate dans une popup
//      → redirect vers redirect_uri avec ?code=...&state=...
//   2. Token exchange : POST https://{env}.tradovateapi.com/v1/auth/oauthtoken
//      avec grant_type=authorization_code → { access_token, refresh_token,
//      expires_in, refresh_token_expires_in }
//   3. Refresh : même endpoint avec grant_type=refresh_token
//
// Deux environnements (token endpoint), même authorize URL :
//   - demo : prop firms (Topstep, Apex, Tradeify, …) + comptes simulation
//   - live : brokerage Tradovate direct (rare)
// ========================================

const AUTHORIZE_URL = 'https://trader.tradovate.com/oauth';

const ENV_TOKEN_URLS = {
  demo: 'https://demo.tradovateapi.com/v1/auth/oauthtoken',
  live: 'https://live.tradovateapi.com/v1/auth/oauthtoken'
};

const ENV_API_URLS = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1'
};

function tokenUrl(env) {
  const url = ENV_TOKEN_URLS[env];
  if (!url) throw new Error(`env Tradovate inconnu : ${env}`);
  return url;
}

function apiUrl(env) {
  const url = ENV_API_URLS[env];
  if (!url) throw new Error(`env Tradovate inconnu : ${env}`);
  return url;
}

// ----------------------------------------
// OAUTH FLOW
// ----------------------------------------

// Construit l'URL d'autorisation à ouvrir dans la popup.
export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// Échange le `code` reçu sur le callback contre des tokens.
export async function exchangeCodeForTokens({ env, code, clientId, clientSecret, redirectUri }) {
  return postOAuthToken(env, {
    grant_type:    'authorization_code',
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri
  });
}

// Rafraîchit un access_token via refresh_token.
export async function refreshAccessToken({ env, refreshToken, clientId, clientSecret }) {
  return postOAuthToken(env, {
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret
  });
}

async function postOAuthToken(env, body) {
  const url = tokenUrl(env);
  console.log('[TVDEBUG] POST', url, {
    grant_type: body.grant_type,
    client_id: body.client_id,
    has_code: !!body.code,
    has_refresh_token: !!body.refresh_token
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const responseText = await res.text();
  let json = {};
  try { json = responseText ? JSON.parse(responseText) : {}; } catch (_) {}

  if (!res.ok || !json.access_token) {
    console.error('[TVDEBUG] OAUTH FAILED', {
      status: res.status,
      response_body: json,
      response_text: responseText && !Object.keys(json).length ? responseText.slice(0, 500) : undefined
    });
    const desc = json.error_description || json.error || res.statusText;
    throw new TradovateError(`OAuth ${res.status}: ${desc}`, res.status, json);
  }

  console.log('[TVDEBUG] OAUTH OK', {
    status: res.status,
    expires_in: json.expires_in,
    has_refresh: !!json.refresh_token,
    refresh_expires_in: json.refresh_token_expires_in
  });

  // Normalise : expires_in (secondes) → Date absolue
  const now = Date.now();
  return {
    access_token:             json.access_token,
    access_token_expires_at:  new Date(now + (json.expires_in || 0) * 1000).toISOString(),
    refresh_token:            json.refresh_token || null,
    refresh_token_expires_at: json.refresh_token_expires_in
      ? new Date(now + json.refresh_token_expires_in * 1000).toISOString()
      : null
  };
}

// ----------------------------------------
// REQUÊTE AUTHENTIFIÉE (API Tradovate avec access_token)
// ----------------------------------------
async function authedFetch({ env, accessToken, path, query }) {
  const url = new URL(`${apiUrl(env)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 401) {
    throw new TradovateError('token expiré', 401);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new TradovateError(
      `${path} ${res.status}: ${body?.errorText || res.statusText}`,
      res.status,
      body
    );
  }
  return body;
}

export async function listAccounts({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/account/list' });
}

export async function listFills({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/fill/list' });
}

export async function listFillFees({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/fillFee/list' });
}

export async function listContracts({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/contract/list' });
}

// ----------------------------------------
// ERREUR TYPÉE
// ----------------------------------------
export class TradovateError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = 'TradovateError';
    this.status = status;
    this.body = body;
  }
}

export class OAuthExpiredError extends Error {
  constructor(message = 'OAuth refresh_token expiré — reconnexion requise') {
    super(message);
    this.name = 'OAuthExpiredError';
    this.status = 401;
  }
}
