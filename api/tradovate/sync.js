// ========================================
// POST /api/tradovate/sync
// Header : Authorization: Bearer <supabase JWT>
// Body : (vide)
//
// Pour chaque env connecté de l'élève :
//   1. récupère un access_token (cache si valide, sinon re-auth)
//   2. liste les comptes Tradovate
//   3. mappe les comptes Tradovate ↔ accounts Supabase (auto-crée si inconnu)
//   4. récupère fills + fillFees + contracts
//   5. filtre les fills > last_fill_id par compte
//   6. agrège en round-trips → upsert dans trades (sur user+source+external_id)
//   7. avance le curseur dans tradovate_sync_state
//   8. met à jour last_synced_at sur tradovate_credentials
//
// Réponse :
//   { synced: { demo: {...}, live: {...} }, total_trades: N, duration_ms }
// ========================================

import { requireUser, getServiceClient, httpError } from './_lib/auth.js';
import { decrypt } from './_lib/crypto.js';
import {
  getAccessToken,
  listAccounts,
  listFills,
  listFillFees,
  listContracts,
  TradovateError
} from './_lib/client.js';
import { aggregateFillsToTrades } from './_lib/aggregator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const t0 = Date.now();
  try {
    const { user_id } = await requireUser(req);
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
      // Mémoire locale aussi pour le reste du sync
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
    // Si 401, on force un refresh (vide le cache)
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

    // Ne traiter que les NOUVEAUX fills
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

    // Agréger en trades round-trip. Note: pour reconstituer correctement
    // les positions, l'agrégateur a besoin du contexte des fills déjà
    // traités. V1 pragmatique : on lui passe TOUS les fills du compte
    // (pas juste les nouveaux), et on filtre côté upsert via external_id.
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

    // Avancer le curseur au plus grand fillId vu sur ce compte
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

// Renvoie Map<tradovate_account_id, supabase_account_id>.
// Crée les comptes Supabase manquants à la volée.
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

  // Créer les manquants
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
