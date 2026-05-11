// ========================================
// CLIENT API TRADOVATE
// ========================================
// Doc : https://api.tradovate.com/
// Deux environnements distincts :
//   - demo : challenges (https://demo.tradovateapi.com/v1)
//   - live : comptes funded (https://live.tradovateapi.com/v1)
//
// Auth : POST /auth/accesstokenrequest renvoie :
//   { accessToken, mdAccessToken, expirationTime, ... }
// expirationTime est une ISO date — typiquement +90 minutes.
//
// Ce module ne sait pas chiffrer / déchiffrer ; il prend les creds
// déjà en clair et un objet "tokenStore" (lecture/écriture du cache token).
// ========================================

const ENV_URLS = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1'
};

// app identifier — visible dans le panneau Tradovate de l'élève
const APP_ID = 'ClubTrader360-Journal';
const APP_VERSION = '1.0';

function baseUrl(env) {
  const url = ENV_URLS[env];
  if (!url) throw new Error(`env Tradovate inconnu : ${env}`);
  return url;
}

// ----------------------------------------
// AUTH
// ----------------------------------------
// Demande un access_token avec les creds. À n'appeler que si le token
// caché est expiré, ou pour valider des creds nouvellement saisis.
export async function requestAccessToken({ env, username, password }) {
  const res = await fetch(`${baseUrl(env)}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: username,
      password,
      appId: APP_ID,
      appVersion: APP_VERSION,
      cid: 0,
      sec: ''
    })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TradovateError(
      `auth ${res.status}: ${body['p-ticket'] ? 'captcha required' : (body.errorText || res.statusText)}`,
      res.status,
      body
    );
  }

  // Tradovate peut renvoyer 200 avec un challenge type "p-ticket" (captcha).
  // Dans ce cas il n'y a pas de accessToken — on remonte une erreur claire.
  if (!body.accessToken) {
    throw new TradovateError(
      `auth refusée : ${body.errorText || 'pas d\'accessToken renvoyé (captcha probable)'}`,
      401,
      body
    );
  }

  return {
    accessToken: body.accessToken,
    mdAccessToken: body.mdAccessToken || null,
    expirationTime: body.expirationTime  // ISO string
  };
}

// Renvoie un token utilisable, en utilisant le cache si encore valide.
// `tokenStore` est { getCached, saveCached } fournis par l'appelant
// (typiquement, lit/écrit la ligne tradovate_credentials Supabase).
//
// Marge de sécurité : on considère le token expiré 60s avant son
// expirationTime réelle pour éviter les 401 en bord de fenêtre.
const TOKEN_SAFETY_MARGIN_MS = 60_000;

export async function getAccessToken({ env, username, password, tokenStore }) {
  const cached = await tokenStore.getCached();
  if (cached && cached.token && cached.expiresAt) {
    const expMs = new Date(cached.expiresAt).getTime();
    if (expMs - Date.now() > TOKEN_SAFETY_MARGIN_MS) {
      return { accessToken: cached.token, mdAccessToken: cached.mdToken };
    }
  }

  const fresh = await requestAccessToken({ env, username, password });
  await tokenStore.saveCached({
    token: fresh.accessToken,
    mdToken: fresh.mdAccessToken,
    expiresAt: fresh.expirationTime
  });
  return { accessToken: fresh.accessToken, mdAccessToken: fresh.mdAccessToken };
}

// ----------------------------------------
// REQUÊTE AUTHENTIFIÉE
// ----------------------------------------
async function authedFetch({ env, accessToken, path, query }) {
  const url = new URL(`${baseUrl(env)}${path}`);
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

// ----------------------------------------
// ENDPOINTS UTILISÉS PAR LE SYNC
// ----------------------------------------
export async function listAccounts({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/account/list' });
}

// Tradovate ne supporte pas un filtre "since fillId" sur /fill/list,
// mais l'endpoint renvoie tous les fills du jour. Pour l'historique,
// on utilise /fill/deps avec masterids ou /fill/ldeps. Approche
// simple pour V1 : récupérer tous les fills accessibles, on filtre
// côté Node par fillId > last_fill_id. Tradovate plafonne autour
// de 30 jours d'historique sur les comptes demo, plus sur live.
export async function listFills({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/fill/list' });
}

// Frais (commissions + exchange fees) par fill
export async function listFillFees({ env, accessToken }) {
  return authedFetch({ env, accessToken, path: '/fillFee/list' });
}

// Métadonnées des contrats (utile pour mapper contractId → symbol)
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
