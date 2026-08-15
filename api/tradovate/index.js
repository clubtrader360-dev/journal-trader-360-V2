// ========================================
// ROUTEUR TRADOVATE — /api/tradovate?action=<action>
// Header : Authorization: Bearer <supabase JWT>
//
// Consolidation des 4 anciens endpoints (connect/disconnect/status/sync) en 1 seule
// Serverless Function (quota Vercel Hobby : 12 → 9). Pattern identique à api/user/profile.js.
//
//   ?action=connect     (POST) body { env, username, password }
//   ?action=disconnect  (POST) body { env } ou { all: true }
//   ?action=status      (GET)
//   ?action=sync        (POST)
//
// requireUser commun au top. `return await handleXxx(...)` OBLIGATOIRE : sans await, le rejet
// d'un sous-handler échappe au try/catch → httpError(4xx) ressort en 500 (cf profile.js 113f7d5).
// ========================================

import { requireUser, readJson, getServiceClient, httpError } from './_lib/auth.js';
import { encrypt, decrypt } from './_lib/crypto.js';
import {
  requestAccessToken,
  getAccessToken,
  listAccounts,
  listFills,
  listFillFees,
  listContracts,
  TradovateError
} from './_lib/client.js';
import { aggregateFillsToTrades } from './_lib/aggregator.js';

const VALID_ENVS = new Set(['demo', 'live']);
const ACTION_METHOD = { connect: 'POST', disconnect: 'POST', status: 'GET', sync: 'POST' };

export default async function handler(req, res) {
  const action = String(req.query?.action || '').trim();
  const expected = ACTION_METHOD[action];
  if (!expected) return res.status(400).json({ error: 'action inconnue' });
  if (req.method !== expected) {
    res.setHeader('Allow', expected);
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    if (action === 'connect')    return await handleConnect(req, res, user_id);
    if (action === 'disconnect') return await handleDisconnect(req, res, user_id);
    if (action === 'status')     return await handleStatus(req, res, user_id);
    if (action === 'sync')       return await handleSync(req, res, user_id);
    return res.status(400).json({ error: 'action inconnue' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[TRADOVATE] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

// ============================================================
// CONNECT — valide les creds via Tradovate, chiffre et stocke.
// ============================================================
async function handleConnect(req, res, user_id) {
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

  // Test des creds — auth Tradovate AVANT de stocker.
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

  const encU = encrypt(username);
  const encP = encrypt(password);

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

  return res.status(200).json({ ok: true, env, expiresAt: token.expirationTime });
}

// ============================================================
// DISCONNECT — supprime creds + sync_state (garde trades/accounts).
// ============================================================
async function handleDisconnect(req, res, user_id) {
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
}

// ============================================================
// STATUS — état des connexions (sans les creds).
// ============================================================
async function handleStatus(req, res, user_id) {
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
}

// ============================================================
// SYNC — pour chaque env connecté : pull fills → trades.
// Garde son propre try/catch pour renvoyer duration_ms (succès ET erreur).
// ============================================================
async function handleSync(req, res, user_id) {
  const t0 = Date.now();
  try {
    const sb = getServiceClient();

    // 1. Lire toutes les connexions (demo + live) de l'élève
    const { data: creds, error: credsErr } = await sb
      .from('tradovate_credentials')
      .select('*')
      .eq('user_id', user_id);

    if (credsErr) {
      console.error('[SYNC] read creds error:', credsErr);
      return res.status(500).json({ error: 'erreur lecture creds' });
    }
    if (!creds || creds.length === 0) {
      return res.status(200).json({
        synced: {},
        total_trades: 0,
        duration_ms: Date.now() - t0,
        note: 'Aucune connexion Tradovate'
      });
    }

    const synced = {};
    let totalTrades = 0;

    for (const cred of creds) {
      try {
        const result = await syncOneEnv({ sb, user_id, cred });
        synced[cred.env] = result;
        totalTrades += result.trades_upserted;

        await sb.from('tradovate_credentials')
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_error: null
          })
          .eq('id', cred.id);
      } catch (err) {
        console.error(`[SYNC] env=${cred.env} error:`, err);
        synced[cred.env] = {
          error: err.message,
          status: err.status || 0
        };
        await sb.from('tradovate_credentials')
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: 'error',
            last_sync_error: String(err.message).slice(0, 500)
          })
          .eq('id', cred.id);
      }
    }

    return res.status(200).json({
      synced,
      total_trades: totalTrades,
      duration_ms: Date.now() - t0
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[SYNC] fatal:', err);
    return res.status(status).json({
      error: err.message || 'erreur',
      duration_ms: Date.now() - t0
    });
  }
}

// ----------------------------------------
// Sync d'un seul env (demo OU live) pour un user
// ----------------------------------------
async function syncOneEnv({ sb, user_id, cred }) {
  const env = cred.env;

  // Déchiffrer les creds
  const username = decrypt({
    ciphertext: cred.encrypted_username,
    iv:         cred.username_iv,
    authTag:    cred.username_auth_tag
  });
  const password = decrypt({
    ciphertext: cred.encrypted_password,
    iv:         cred.password_iv,
    authTag:    cred.password_auth_tag
  });

  // tokenStore : on relit/écrit la même ligne tradovate_credentials
  const tokenStore = {
    async getCached() {
      return cred.last_token
        ? {
            token:     cred.last_token,
            mdToken:   cred.last_md_token,
            expiresAt: cred.last_token_expires_at
          }
        : null;
    },
    async saveCached({ token, mdToken, expiresAt }) {
      const { error } = await sb.from('tradovate_credentials')
        .update({
          last_token: token,
          last_md_token: mdToken,
          last_token_expires_at: expiresAt
        })
        .eq('id', cred.id);
      if (error) throw error;
      cred.last_token = token;
      cred.last_md_token = mdToken;
      cred.last_token_expires_at = expiresAt;
    }
  };

  let { accessToken } = await getAccessToken({
    env, username, password, tokenStore
  });

  // 2. Comptes Tradovate
  const tvAccounts = await callWithTokenRetry(() =>
    listAccounts({ env, accessToken })
  , async () => {
    cred.last_token = null;
    const fresh = await getAccessToken({ env, username, password, tokenStore });
    accessToken = fresh.accessToken;
    return accessToken;
  });

  // 3. Mapper / auto-créer les accounts Supabase
  const accountsMap = await ensureSupabaseAccounts({
    sb, user_id, env, tvAccounts
  });

  // 4. Fills + fees + contracts (un seul fetch par env)
  const [fills, fillFees, contracts] = await Promise.all([
    listFills    ({ env, accessToken }),
    listFillFees ({ env, accessToken }),
    listContracts({ env, accessToken })
  ]);

  // 5. État de sync par compte (curseurs last_fill_id)
  const { data: states, error: statesErr } = await sb
    .from('tradovate_sync_state')
    .select('*')
    .eq('user_id', user_id)
    .eq('env', env);
  if (statesErr) throw statesErr;

  const stateByTradovateAccount = new Map();
  for (const s of (states || [])) {
    stateByTradovateAccount.set(s.tradovate_account_id, s);
  }

  // 6. Pour chaque compte Tradovate, agrège et upsert
  let tradesUpserted = 0;
  const accountsReport = [];

  for (const tvAcc of tvAccounts) {
    const accountFills = fills.filter(f => f.accountId === tvAcc.id);
    const state = stateByTradovateAccount.get(tvAcc.id);
    const lastFillId = state?.last_fill_id ?? 0;

    const newFills = accountFills.filter(f => Number(f.id) > Number(lastFillId));
    if (newFills.length === 0) {
      accountsReport.push({
        tradovate_account_id: tvAcc.id,
        name: tvAcc.name,
        new_fills: 0,
        trades_upserted: 0
      });
      continue;
    }

    const rows = aggregateFillsToTrades({
      fills: accountFills,
      fillFees,
      contracts,
      ctx: {
        env,
        user_id,
        account_id_supabase: accountsMap.get(tvAcc.id) || null
      }
    });

    if (rows.length > 0) {
      const { error: upErr } = await sb.from('trades').upsert(
        rows,
        { onConflict: 'user_id,source,external_id' }
      );
      if (upErr) throw upErr;
    }

    const maxFillId = accountFills.reduce(
      (m, f) => Number(f.id) > m ? Number(f.id) : m,
      0
    );

    await sb.from('tradovate_sync_state').upsert(
      {
        user_id,
        env,
        tradovate_account_id: tvAcc.id,
        tradovate_account_name: tvAcc.name,
        last_fill_id: maxFillId,
        last_synced_at: new Date().toISOString(),
        fills_imported_total:
          (state?.fills_imported_total || 0) + newFills.length,
        trades_created_total:
          (state?.trades_created_total || 0) + rows.length
      },
      { onConflict: 'user_id,env,tradovate_account_id' }
    );

    tradesUpserted += rows.length;
    accountsReport.push({
      tradovate_account_id: tvAcc.id,
      name: tvAcc.name,
      new_fills: newFills.length,
      trades_upserted: rows.length
    });
  }

  return {
    accounts: accountsReport,
    trades_upserted: tradesUpserted
  };
}

// Exécute fn(); si TradovateError 401, relance fn() après refresh.
async function callWithTokenRetry(fn, refresh) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TradovateError && err.status === 401) {
      await refresh();
      return await fn();
    }
    throw err;
  }
}

// Renvoie Map<tradovate_account_id, supabase_account_id>. Crée les manquants.
async function ensureSupabaseAccounts({ sb, user_id, env, tvAccounts }) {
  if (!tvAccounts || tvAccounts.length === 0) return new Map();

  const tvIds = tvAccounts.map(a => a.id);

  const { data: existing, error } = await sb
    .from('accounts')
    .select('id, tradovate_id, tradovate_env, name')
    .eq('user_id', user_id)
    .eq('tradovate_env', env)
    .in('tradovate_id', tvIds);
  if (error) throw error;

  const map = new Map();
  for (const row of (existing || [])) {
    map.set(Number(row.tradovate_id), row.id);
  }

  const toInsert = tvAccounts
    .filter(a => !map.has(a.id))
    .map(a => ({
      user_id,
      name: a.name || `Tradovate ${env} ${a.id}`,
      type: env === 'demo' ? 'challenge' : 'funded',
      current_balance: 0,
      active: true,
      tradovate_id: a.id,
      tradovate_env: env
    }));

  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await sb
      .from('accounts')
      .insert(toInsert)
      .select('id, tradovate_id');
    if (insErr) throw insErr;
    for (const row of (inserted || [])) {
      map.set(Number(row.tradovate_id), row.id);
    }
  }

  return map;
}
