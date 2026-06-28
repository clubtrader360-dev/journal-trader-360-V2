-- =====================================================================
-- #33 Commit 3 — Dashboard COACH personnalisable (drag-drop + masquage)
-- Stocke l'ordre des blocs + la liste des blocs masqués du #coachDashboard,
-- par coach. Même mécanique que la colonne dashboard_layout côté élève (#27),
-- mais colonne séparée pour ne pas mélanger les deux dispositions.
-- RLS user_preferences déjà en place (auth.uid() = user_id). 100% additif.
-- =====================================================================
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS coach_dashboard_layout JSONB DEFAULT NULL;

COMMENT ON COLUMN public.user_preferences.coach_dashboard_layout IS
  'Disposition personnalisée du dashboard coach (#coachDashboard) : ordre des blocs + blocs masqués. NULL = disposition par défaut. #33.';
