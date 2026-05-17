-- Fix : récursion infinie RLS code 54001
-- Cause : replays_select interrogeait users → is_coach() interrogeait users → boucle.
-- Solution : helper SECURITY DEFINER qui bypass RLS pour la vérification d'accès.

CREATE OR REPLACE FUNCTION public.can_view_replays()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE uuid = auth.uid()
    AND (
      status IN ('active', 'approved')
      OR role IN ('coach', 'admin')
    )
  );
$$;

-- Recréer la policy en utilisant la fonction qui bypass RLS
DROP POLICY IF EXISTS "replays_select" ON replays;
CREATE POLICY "replays_select" ON replays FOR SELECT TO authenticated
USING (can_view_replays());
