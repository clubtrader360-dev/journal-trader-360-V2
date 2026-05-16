-- Migration : étendre replays_select pour les élèves avec status='approved'
-- Cohérent avec is_coach() qui accepte déjà ('active', 'approved')
-- Cause : policy initiale vérifiait status = 'active' strictement, bloquant
--         les comptes élèves dont le statut est 'approved' (pré-activation).

DROP POLICY IF EXISTS "replays_select" ON replays;

CREATE POLICY "replays_select" ON replays FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE uuid = auth.uid()
      AND status IN ('active', 'approved')
  )
  OR is_coach()
);
