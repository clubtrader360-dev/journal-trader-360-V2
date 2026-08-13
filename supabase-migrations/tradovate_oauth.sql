-- =====================================================
-- MIGRATION : Tradovate OAuth 2.0 + multi-prop-firms
-- =====================================================
-- Refonte complète : remplace l'auth directe POST username/password
-- (refusée par Tradovate sur les comptes prop firm) par le flow OAuth
-- officiel. Schéma natif 1-N : chaque élève peut connecter plusieurs
-- prop firms (Topstep, Apex, Tradeify…) identifiées par `label`.
--
-- Tables :
--   1. tradovate_credentials       : tokens OAuth chiffrés par (user, label)
--   2. tradovate_oauth_states      : CSRF state éphémère pendant le flow
--   3. tradovate_sync_state        : curseur sync par credentials × compte
--   4. trades.source/external_id   : upsert idempotent
--   5. accounts.tradovate_*        : matching compte Tradovate ↔ Supabase
--
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. tradovate_credentials
-- =====================================================
-- access_token + refresh_token chiffrés AES-256-GCM côté serveur
-- avec TRADOVATE_ENCRYPTION_KEY. La DB ne voit JAMAIS les tokens en clair.
-- Refresh_token est le secret CRITIQUE (long-lived) — sa fuite donnerait
-- accès au compte Tradovate de l'élève. Access_token est court (90 min).
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    env             TEXT NOT NULL CHECK (env IN ('demo','live')),
    label           TEXT NOT NULL,

    -- access_token OAuth (TTL ~90 min)
    encrypted_access_token      TEXT NOT NULL,
    access_token_iv             TEXT NOT NULL,
    access_token_auth_tag       TEXT NOT NULL,
    access_token_expires_at     TIMESTAMPTZ NOT NULL,

    -- refresh_token OAuth (TTL plusieurs semaines)
    encrypted_refresh_token     TEXT NOT NULL,
    refresh_token_iv            TEXT NOT NULL,
    refresh_token_auth_tag      TEXT NOT NULL,
    refresh_token_expires_at    TIMESTAMPTZ,

    -- Suivi sync
    last_synced_at      TIMESTAMPTZ,
    last_sync_status    TEXT,
    last_sync_error     TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Multi-prop-firms : unicité par (user, label).
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
-- 2. tradovate_oauth_states
-- =====================================================
-- État CSRF éphémère pendant le flow OAuth.
-- oauth-start crée une ligne avec un state random (32 bytes hex).
-- oauth-callback retrouve la ligne par state, la consomme (DELETE),
-- vérifie expires_at > now(). TTL : 10 min.
-- Pas de RLS : table interne service role uniquement.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_oauth_states (
    state       TEXT PRIMARY KEY,
    user_id     UUID NOT NULL,
    env         TEXT NOT NULL CHECK (env IN ('demo','live')),
    label       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tradovate_oauth_states_expires_idx
    ON tradovate_oauth_states(expires_at);

ALTER TABLE tradovate_oauth_states ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table inaccessible aux clients authenticated.
-- Seul le service role (côté serveur Vercel) peut y écrire/lire.

-- =====================================================
-- 3. tradovate_sync_state
-- =====================================================
-- Un curseur par (credentials, tradovate_account_id).
-- ON DELETE CASCADE : supprimer la cred supprime ses curseurs.
-- =====================================================
CREATE TABLE IF NOT EXISTS tradovate_sync_state (
    id                          BIGSERIAL PRIMARY KEY,
    credentials_id              BIGINT NOT NULL
        REFERENCES tradovate_credentials(id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL,        -- redondant mais utile pour RLS
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
-- 4. trades : source / external_id
-- =====================================================
-- external_id format "<credentials_id>:<account_id>:<sorted_fill_ids>"
-- → idempotent + pas de collision entre prop firms.
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

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_source_external_unique
    ON trades(user_id, source, external_id)
    WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trades_source_idx
    ON trades(user_id, source);

-- =====================================================
-- 5. accounts : tradovate_credentials_id + tradovate_id + tradovate_env
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
-- 6. VÉRIFICATION
-- =====================================================
SELECT 'tradovate_credentials columns:' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tradovate_credentials'
ORDER BY ordinal_position;

SELECT 'tradovate_oauth_states columns:' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tradovate_oauth_states'
ORDER BY ordinal_position;

SELECT '✅ Migration Tradovate OAuth + multi-comptes terminée' AS status;
