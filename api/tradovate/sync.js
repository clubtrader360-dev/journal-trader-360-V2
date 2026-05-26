// ========================================
// POST /api/tradovate/sync
// Header : Authorization: Bearer <supabase JWT>
//
// Pour CHAQUE connexion OAuth Tradovate de l'élève :
//   1. déchiffre access_token (refresh si expiré via refresh_token)
//   2. liste les comptes Tradovate
//   3. mappe les comptes Tradovate ↔ accounts Supabase
//      (auto-crée si inconnu, scope = credentials_id)
//   4. récupère fills + fillFees + contracts
//   5. filtre les fills > last_fill_id par compte
//   6. agrège en round-trips → upsert dans trades (idempotent via external_id)
//   7. avance le curseur dans tradovate_sync_state
//   8. met à jour last_synced_at sur tradovate_credentials
//
// Si le refresh_token est expiré → status 'needs_reauth' (l'élève doit
// refaire le flow OAuth).
//
// Réponse :
//   { synced: [{ credentials_id, label, env, ... }], total_trades, duration_ms }
// ========================================

import { requireUser, getServiceClient } from './_lib/auth.js';
import { decrypt, encrypt } from './_lib/crypto.js';
import {
  refreshAccessToken,
  listAccounts,
  listFills,
  listFillFees,
  listContracts,
  TradovateError
} from './_lib/client.js';
import { aggregateFillsToTrades } from './_lib/aggregator.js';

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 60_000; // refresh à T-60s

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const t0 = Date.now();
  try {
    const { user_id } = await requireUser(req);
    const sb = getServiceClient();

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
        synced: [],
        total_trades: 0,
        duration_ms: Date.now() - t0,
        note: 'Aucune connexion Tradovate'
      });
    }

    const synced = [];
    let totalTrades = 0;

    for (const cred of creds) {
      try {
        const result = await syncOneCredential({ sb, user_id, cred });
        synced.push({
          credentials_id: cred.id,
          label:          cred.label,
          env:            cred.env,
          ...result
        });
        totalTrades += result.trades_upserted;

        await sb.from('tradovate_credentials')
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_error: null
          })
          .eq('id', cred.id);
      } catch (err) {
        console.error(`[SYNC] cred=${cred.id} (${cred.label}) error:`, err);
        synced.push({
          credentials_id: cred.id,
          label:          cred.label,
          env:            cred.env,
          error:          err.message,
          status:         err.status || 0,
          needs_reauth:   err.needs_reauth === true
        });
        await sb.from('tradovate_credentials')
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: err.needs_reauth ? 'needs_reauth' : 'error',
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
// Sync d'une connexion OAuth
// ----------------------------------------
async function syncOneCredential({ sb, user_id, cred }) {
  const env = cred.env;
  const credentialsId = cred.id;

  // 1. Access token utilisable (refresh proactif si proche expiration)
  let accessToken = await getUsableAccessToken({ sb, cred });

  // 2. Comptes Tradovate (retry une fois sur 401 — token race condition)
  let tvAccounts;
  try {
    tvAccounts = await listAccounts({ env, accessToken });
  } catch (err) {
    if (err instanceof TradovateError && err.status === 401) {
      accessToken = await forceRefreshAccessToken({ sb, cred });
      tvAccounts = await listAccounts({ env, accessToken });
    } else {
      throw err;
    }
  }

  // 3. Mapper / auto-créer les accounts Supabase (scope credentials_id)
  const accountsMap = await ensureSupabaseAccounts({
    sb, user_id, env, credentialsId, tvAccounts
  });

  // 4. Fills + fees + contracts
  const [fills, fillFees, contracts] = await Promise.all([
    listFills    ({ env, accessToken }),
    listFillFees ({ env, accessToken }),
    listContracts({ env, accessToken })
  ]);

  // 5. État de sync par compte (scope credentials_id)
  const { data: states, error: statesErr } = await sb
    .from('tradovate_sync_state')
    .select('*')
    .eq('credentials_id', credentialsId);
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
        credentials_id:      credentialsId,
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
        credentials_id:         credentialsId,
        user_id,
        tradovate_account_id:   tvAcc.id,
        tradovate_account_name: tvAcc.name,
        last_fill_id:           maxFillId,
        last_synced_at:         new Date().toISOString(),
        fills_imported_total:
          (state?.fills_imported_total || 0) + newFills.length,
        trades_created_total:
          (state?.trades_created_total || 0) + rows.length
      },
      { onConflict: 'credentials_id,tradovate_account_id' }
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

// ----------------------------------------
// Token management
// ----------------------------------------

// Renvoie un access_token utilisable, refresh si nécessaire.
async function getUsableAccessToken({ sb, cred }) {
  const expMs = new Date(cred.access_token_expires_at).getTime();
  if (expMs - Date.now() > ACCESS_TOKEN_SAFETY_MARGIN_MS) {
    return decryptAccessToken(cred);
  }
  return forceRefreshAccessToken({ sb, cred });
}

// Refresh forcé via refresh_token. Met à jour la DB et l'objet cred local.
async function forceRefreshAccessToken({ sb, cred }) {
  if (cred.refresh_token_expires_at &&
      new Date(cred.refresh_token_expires_at).getTime() < Date.now()) {
    const e = new Error('Refresh token expiré — reconnexion OAuth requise');
    e.needs_reauth = true;
    e.status = 401;
    throw e;
  }

  const refreshToken = decrypt({
    ciphertext: cred.encrypted_refresh_token,
    iv:         cred.refresh_token_iv,
    authTag:    cred.refresh_token_auth_tag
  });

  const clientId     = process.env.TRADOVATE_CLIENT_ID;
  const clientSecret = process.env.TRADOVATE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('TRADOVATE_CLIENT_ID/SECRET manquant en env');
  }

  let tokens;
  try {
    tokens = await refreshAccessToken({
      env: cred.env, refreshToken, clientId, clientSecret
    });
  } catch (err) {
    // invalid_grant ou similaire → refresh_token définitivement mort
    if (err instanceof TradovateError && err.status === 400) {
      const e = new Error('Refresh token refusé par Tradovate — reconnexion OAuth requise');
      e.needs_reauth = true;
      e.status = 401;
      e.cause = err;
      throw e;
    }
    throw err;
  }

  const encA = encrypt(tokens.access_token);
  const update = {
    encrypted_access_token:  encA.ciphertext,
    access_token_iv:         encA.iv,
    access_token_auth_tag:   encA.authTag,
    access_token_expires_at: tokens.access_token_expires_at
  };
  // Tradovate peut renouveler aussi le refresh_token (recommandé). Si oui, MAJ.
  if (tokens.refresh_token) {
    const encR = encrypt(tokens.refresh_token);
    update.encrypted_refresh_token  = encR.ciphertext;
    update.refresh_token_iv         = encR.iv;
    update.refresh_token_auth_tag   = encR.authTag;
    update.refresh_token_expires_at = tokens.refresh_token_expires_at;
  }

  const { error: upErr } = await sb
    .from('tradovate_credentials')
    .update(update)
    .eq('id', cred.id);
  if (upErr) throw upErr;

  // Mémoire locale pour la suite du sync
  Object.assign(cred, update);
  return tokens.access_token;
}

function decryptAccessToken(cred) {
  return decrypt({
    ciphertext: cred.encrypted_access_token,
    iv:         cred.access_token_iv,
    authTag:    cred.access_token_auth_tag
  });
}

// ----------------------------------------
// Mapping comptes Tradovate → Supabase (scope credentials_id)
// ----------------------------------------
async function ensureSupabaseAccounts({ sb, user_id, env, credentialsId, tvAccounts }) {
  if (!tvAccounts || tvAccounts.length === 0) return new Map();

  const tvIds = tvAccounts.map(a => a.id);

  const { data: existing, error } = await sb
    .from('accounts')
    .select('id, tradovate_id')
    .eq('user_id', user_id)
    .eq('tradovate_credentials_id', credentialsId)
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
      tradovate_env: env,
      tradovate_credentials_id: credentialsId
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
