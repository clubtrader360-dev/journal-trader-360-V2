-- Fix : récursion infinie RLS code 54001 sur replay_views
-- Cause : replay_views_select appelait is_coach() qui query users (RLS activé) → boucle.
-- Solution : réutiliser can_view_replays() (SECURITY DEFINER, déjà en place) au lieu de is_coach().

DROP POLICY IF EXISTS "replay_views_select" ON replay_views;
CREATE POLICY "replay_views_select" ON replay_views FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR can_view_replays());
