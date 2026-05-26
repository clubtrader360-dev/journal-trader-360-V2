-- =====================================================
-- MIGRATION : Intégration Tradovate multi-comptes
-- =====================================================
-- Schéma natif 1-N : chaque élève peut connecter plusieurs jeux
-- d'identifiants Tradovate, un par prop firm (Topstep, Apex, Tradeify…).
-- Identification par `label` libellé par l'élève.
--
-- Tables :
--   1. tradovate_credentials  : creds chiffrées par (user, label).
--   2. tradovate_sync_state   : curseur sync par credentials × compte Tradovate.
--   3. trades.source/external_id : upsert idempotent des trades importés.
--   4. accounts.tradovate_credentials_id/tradovate_id/tradovate_env :
--      matching auto compte Tradovate ↔ compte Supabase.
--
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. tradovate_credentials
-- =====================================================
-- encrypted_username / encrypted_password : AES-256-GCM côté serveur
-- avec TRADOVATE_ENCRYPTION_KEY. La DB ne voit JAMAIS les valeurs en clair.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    env             TEXT NOT NULL CHECK (env IN ('demo','live')),
    label           TEXT NOT NULL,

    -- Payloads chiffrés (base64) + IV + auth tag (base64)
    encrypted_username      TEXT NOT NULL,
    username_iv             TEXT NOT NULL,
    username_auth_tag       TEXT NOT NULL,
    encrypted_password      TEXT NOT NULL,
    password_iv             TEXT NOT NULL,
    password_auth_tag       TEXT NOT NULL,

    -- Cache du dernier access_token Tradovate (TTL ~90 min)
    last_token              TEXT,
    last_token_expires_at   TIMESTAMPTZ,
    last_md_token           TEXT,            -- market data token (séparé)

    -- Suivi
    last_synced_at          TIMESTAMPTZ,
    last_sync_status        TEXT,            -- 'success' | 'error' | NULL
    last_sync_error         TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Multi-compte : unicité par (user, label). Chaque élève libelle
    -- ses connexions ("Topstep", "Apex Demo", etc.). Pas de contrainte
    -- sur env : "Topstep" peut être en demo, "Apex" en live, "Tradeify"
    -- demo simultanément.
    CONSTRAINT tradovate_credentials_user_label_unique UNIQUE (user_id, label)
);

CREATE INDEX IF NOT EXISTS tradovate_credentials_user_idx
    ON tradovate_credentials(user_id);

ALTER TABLE tradovate_credentials ENABLE ROW LEVEL SECURITY;

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
-- 2. tradovate_sync_state
-- =====================================================
-- Un curseur par (credentials, tradovate_account_id).
-- ON DELETE CASCADE : supprimer la cred supprime ses curseurs.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_sync_state (
    id                          BIGSERIAL PRIMARY KEY,
    credentials_id              BIGINT NOT NULL
        REFERENCES tradovate_credentials(id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL,       -- redondant mais utile pour RLS directe
    tradovate_account_id        BIGINT NOT NULL,
    tradovate_account_name      TEXT,
    last_fill_id                BIGINT,
    last_synced_at              TIMESTAMPTZ,
    fills_imported_total        BIGINT NOT NULL DEFAULT 0,
    trades_created_total        BIGINT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tradovate_sync_state_creds_account_unique
        UNIQUE (credentials_id, tradovate_account_id)
);

CREATE INDEX IF NOT EXISTS tradovate_sync_state_user_idx
    ON tradovate_sync_state(user_id);
CREATE INDEX IF NOT EXISTS tradovate_sync_state_creds_idx
    ON tradovate_sync_state(credentials_id);

ALTER TABLE tradovate_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tradovate_sync_state_self ON tradovate_sync_state;
CREATE POLICY tradovate_sync_state_self
    ON tradovate_sync_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. trades : colonnes source / external_id
-- =====================================================
-- source        : 'manual' (par défaut) | 'csv' | 'tradovate'
-- external_id   : pour Tradovate, format "<credentials_id>:<account_id>:<sorted_fill_ids>"
--                 → un trade reste identifiable même si l'élève renomme sa connexion
--                   (id stable), et il n'y a aucune collision entre prop firms.
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trades' AND column_name = 'source'
    ) THEN
        ALTER TABLE trades ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trades' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE trades ADD COLUMN external_id TEXT;
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
-- 4. accounts : credentials_id + tradovate_id + tradovate_env
-- =====================================================
-- Au sync, on découvre les comptes Tradovate de chaque credentials,
-- on auto-crée un compte Supabase pour chacun, et on stocke
-- tradovate_credentials_id + tradovate_id (l'id Tradovate du compte).
-- Le matching reste basé sur (credentials_id, tradovate_id) — robuste
-- même si l'élève renomme le compte côté Supabase.
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'tradovate_credentials_id'
    ) THEN
        ALTER TABLE accounts ADD COLUMN tradovate_credentials_id BIGINT
            REFERENCES tradovate_credentials(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'tradovate_id'
    ) THEN
        ALTER TABLE accounts ADD COLUMN tradovate_id BIGINT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'tradovate_env'
    ) THEN
        ALTER TABLE accounts ADD COLUMN tradovate_env TEXT
            CHECK (tradovate_env IS NULL OR tradovate_env IN ('demo','live'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_creds_tradovate_unique
    ON accounts(tradovate_credentials_id, tradovate_id)
    WHERE tradovate_id IS NOT NULL AND tradovate_credentials_id IS NOT NULL;

-- =====================================================
-- 5. VÉRIFICATION
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
  AND column_name IN ('tradovate_credentials_id','tradovate_id','tradovate_env')
ORDER BY column_name;

SELECT '✅ Migration Tradovate multi-comptes terminée' AS status;
