-- =====================================================
-- MIGRATION: Intégration Tradovate
-- Date: 2026-05-01
-- Description:
--   1. Table tradovate_credentials  : creds chiffrées par élève (env demo/live)
--   2. Table tradovate_sync_state   : curseur de sync par compte Tradovate
--   3. Colonnes trades.source / trades.external_id : pour upsert idempotent
--      des trades importés sans jamais écraser les trades manuels existants
--   4. Colonnes accounts.tradovate_id / accounts.tradovate_env : matching
--      auto entre comptes Tradovate et comptes Supabase existants
--
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- =====================================================

-- =====================================================
-- 1. EXTENSION pgcrypto (UUID + chiffrement éventuel)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 2. TABLE tradovate_credentials
-- =====================================================
-- IMPORTANT: encrypted_username / encrypted_password sont chiffrés
-- AES-256-GCM côté serveur Vercel avec TRADOVATE_ENCRYPTION_KEY.
-- La DB ne voit JAMAIS les valeurs en clair.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    env             TEXT NOT NULL CHECK (env IN ('demo','live')),

    -- Payloads chiffrés (base64) + IV + auth tag (base64)
    encrypted_username      TEXT NOT NULL,
    username_iv             TEXT NOT NULL,
    username_auth_tag       TEXT NOT NULL,
    encrypted_password      TEXT NOT NULL,
    password_iv             TEXT NOT NULL,
    password_auth_tag       TEXT NOT NULL,

    -- Cache du dernier access_token Tradovate (90min TTL)
    last_token              TEXT,
    last_token_expires_at   TIMESTAMPTZ,
    last_md_token           TEXT,            -- market data token (séparé)

    -- Suivi
    last_synced_at          TIMESTAMPTZ,
    last_sync_status        TEXT,            -- 'success' | 'error' | NULL
    last_sync_error         TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Une seule connexion par (user, env). Pour brancher demo ET live,
    -- l'élève crée deux entrées distinctes.
    UNIQUE (user_id, env)
);

CREATE INDEX IF NOT EXISTS tradovate_credentials_user_idx
    ON tradovate_credentials(user_id);

ALTER TABLE tradovate_credentials ENABLE ROW LEVEL SECURITY;

-- L'élève ne lit/écrit QUE ses propres lignes. Les colonnes encrypted_*
-- restent inutiles pour lui (il ne possède pas la clé), mais on protège
-- quand même au cas où.
DROP POLICY IF EXISTS tradovate_credentials_self_select ON tradovate_credentials;
CREATE POLICY tradovate_credentials_self_select
    ON tradovate_credentials FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS tradovate_credentials_self_modify ON tradovate_credentials;
CREATE POLICY tradovate_credentials_self_modify
    ON tradovate_credentials FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION tradovate_credentials_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tradovate_credentials_touch_updated_at_trg
    ON tradovate_credentials;
CREATE TRIGGER tradovate_credentials_touch_updated_at_trg
    BEFORE UPDATE ON tradovate_credentials
    FOR EACH ROW EXECUTE FUNCTION tradovate_credentials_touch_updated_at();

-- =====================================================
-- 3. TABLE tradovate_sync_state
-- =====================================================
-- Un curseur par (user, env, tradovate_account_id).
-- last_fill_id : id Tradovate du dernier fill ingéré → on demande
-- les fills > last_fill_id pour ne pas re-télécharger l'historique.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_sync_state (
    id                          BIGSERIAL PRIMARY KEY,
    user_id                     UUID NOT NULL,
    env                         TEXT NOT NULL CHECK (env IN ('demo','live')),
    tradovate_account_id        BIGINT NOT NULL,
    tradovate_account_name      TEXT,
    last_fill_id                BIGINT,
    last_synced_at              TIMESTAMPTZ,
    fills_imported_total        BIGINT NOT NULL DEFAULT 0,
    trades_created_total        BIGINT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, env, tradovate_account_id)
);

CREATE INDEX IF NOT EXISTS tradovate_sync_state_user_idx
    ON tradovate_sync_state(user_id);

ALTER TABLE tradovate_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tradovate_sync_state_self ON tradovate_sync_state;
CREATE POLICY tradovate_sync_state_self
    ON tradovate_sync_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. trades : colonnes source / external_id
-- =====================================================
-- source        : 'manual' (par défaut) | 'csv' | 'tradovate'
-- external_id   : pour Tradovate, format "<env>:<account_id>:<round_trip_signature>"
--                 où round_trip_signature concatène les fill_ids triés (idempotent)
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trades' AND column_name = 'source'
    ) THEN
        ALTER TABLE trades ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
        RAISE NOTICE 'trades.source ajoutée';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trades' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE trades ADD COLUMN external_id TEXT;
        RAISE NOTICE 'trades.external_id ajoutée';
    END IF;
END $$;

-- Index unique partiel : un même (user, source, external_id) ne peut
-- exister qu'une fois → upsert idempotent. Les trades manuels ont
-- external_id NULL et ne tombent donc pas dans l'index.
CREATE UNIQUE INDEX IF NOT EXISTS trades_user_source_external_unique
    ON trades(user_id, source, external_id)
    WHERE external_id IS NOT NULL;

-- Index pour filtrer rapidement les trades Tradovate
CREATE INDEX IF NOT EXISTS trades_source_idx
    ON trades(user_id, source);

-- =====================================================
-- 5. accounts : colonnes tradovate_id / tradovate_env
-- =====================================================
-- Quand le sync découvre un compte Tradovate, on auto-crée un compte
-- Supabase et on stocke l'id Tradovate ici. L'élève peut renommer
-- ensuite, le matching reste basé sur tradovate_id.
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'tradovate_id'
    ) THEN
        ALTER TABLE accounts ADD COLUMN tradovate_id BIGINT;
        RAISE NOTICE 'accounts.tradovate_id ajoutée';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'tradovate_env'
    ) THEN
        ALTER TABLE accounts ADD COLUMN tradovate_env TEXT
            CHECK (tradovate_env IS NULL OR tradovate_env IN ('demo','live'));
        RAISE NOTICE 'accounts.tradovate_env ajoutée';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_tradovate_unique
    ON accounts(user_id, tradovate_env, tradovate_id)
    WHERE tradovate_id IS NOT NULL;

-- =====================================================
-- 6. VÉRIFICATION
-- =====================================================
SELECT 'tradovate_credentials columns:' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tradovate_credentials'
ORDER BY ordinal_position;

SELECT 'tradovate_sync_state columns:' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tradovate_sync_state'
ORDER BY ordinal_position;

SELECT 'trades — colonnes Tradovate:' AS info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trades'
  AND column_name IN ('source','external_id')
ORDER BY column_name;

SELECT 'accounts — colonnes Tradovate:' AS info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('tradovate_id','tradovate_env')
ORDER BY column_name;

SELECT '✅ Migration Tradovate terminée' AS status;
