-- ============================================================
-- Migration : Feature Replays (#42) — Phase 1 DB
-- À exécuter dans l'éditeur SQL Supabase
-- Prérequis : is_coach() déjà définie en prod (role IN ('coach','admin') + status check)
-- ============================================================

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE replays (
  id               BIGSERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  youtube_video_id TEXT NOT NULL,
  replay_date      DATE NOT NULL,
  duration_seconds INT,
  created_by       UUID REFERENCES users(uuid) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE replay_views (
  id               BIGSERIAL PRIMARY KEY,
  replay_id        BIGINT REFERENCES replays(id) ON DELETE SET NULL,
  user_id          UUID   REFERENCES users(uuid) ON DELETE CASCADE,
  first_watched_at TIMESTAMPTZ DEFAULT NOW(),
  last_watched_at  TIMESTAMPTZ DEFAULT NOW(),
  progress_seconds INT     DEFAULT 0,
  completed        BOOLEAN DEFAULT FALSE,
  UNIQUE(replay_id, user_id)
);

-- ============================================================
-- Index
-- ============================================================

CREATE INDEX idx_replays_date        ON replays(replay_date DESC);
CREATE INDEX idx_replay_views_user   ON replay_views(user_id);
CREATE INDEX idx_replay_views_replay ON replay_views(replay_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE replays      ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_views ENABLE ROW LEVEL SECURITY;

-- replays : lecture pour élèves actifs + coachs
CREATE POLICY "replays_select" ON replays FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM users WHERE uuid = auth.uid() AND status = 'active')
  OR is_coach()
);

-- replays : écriture pour coachs uniquement
CREATE POLICY "replays_write" ON replays FOR ALL TO authenticated
USING (is_coach()) WITH CHECK (is_coach());

-- replay_views : lecture (propre ligne ou coach)
CREATE POLICY "replay_views_select" ON replay_views FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR is_coach());

-- replay_views : insert (propre ligne uniquement)
CREATE POLICY "replay_views_insert" ON replay_views FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- replay_views : update (propre ligne uniquement)
CREATE POLICY "replay_views_update" ON replay_views FOR UPDATE TO authenticated
USING  (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
