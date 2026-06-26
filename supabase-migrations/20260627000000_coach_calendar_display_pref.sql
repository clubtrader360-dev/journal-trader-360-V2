-- #33 Commit 2b-i — Préférences de l'engrenage calendrier coach ($/R/%/Actions-Erreurs).
-- Additif, hérite du RLS existant de user_preferences (auth.uid() = user_id). Pattern #74 (élève).
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS coach_calendar_display JSONB
DEFAULT '{"showDollar":true,"showR":false,"showPercent":false,"showActionsErrors":true}'::JSONB;

COMMENT ON COLUMN public.user_preferences.coach_calendar_display IS
  'Prefs engrenage calendrier coach ($/R/%/Actions-Erreurs) — #33.';
