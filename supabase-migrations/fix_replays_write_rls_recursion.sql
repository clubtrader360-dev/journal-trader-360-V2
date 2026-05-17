-- Fix : replays_write (FOR ALL) appelait is_coach() directement.
-- FOR ALL = USING évalué aussi au SELECT → is_coach() → query users sans SECURITY DEFINER → 54001.
-- Solution : can_manage_replays() SECURITY DEFINER, même pattern que can_view_replays().

CREATE OR REPLACE FUNCTION public.can_manage_replays()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE uuid = auth.uid()
    AND role IN ('coach', 'admin')
    AND status IN ('active', 'approved')
  );
$$;

DROP POLICY IF EXISTS "replays_write" ON replays;
CREATE POLICY "replays_write" ON replays FOR ALL TO authenticated
USING (can_manage_replays()) WITH CHECK (can_manage_replays());
