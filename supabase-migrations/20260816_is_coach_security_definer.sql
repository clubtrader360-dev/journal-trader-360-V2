-- #19 (debug) — Fix RLS critique : is_coach() en SECURITY DEFINER.
-- ============================================================================
-- Symptôme : tout `.update(public.users).select().single()` depuis un JWT authenticated
--   échouait (ex : enregistrement de l'acceptation légale — "Erreur lors de l'enregistrement").
-- Cause : is_coach() était SECURITY INVOKER → son SELECT sur public.users redéclenchait la
--   policy SELECT `users_select_own_or_coach` (qui appelle is_coach()) → RÉCURSION INFINIE.
-- Fix : SECURITY DEFINER + search_path figé → le SELECT interne s'exécute comme l'owner
--   (bypass RLS) et ne re-déclenche plus la policy. Idempotent (CREATE OR REPLACE identique
--   à l'état prod déjà appliqué live pendant le debug ; ce fichier ne fait que le versionner).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_coach()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.uuid = auth.uid()
      AND u.role IN ('coach', 'admin')
      AND COALESCE(u.status, 'active') IN ('active', 'approved')
  );
$function$;
