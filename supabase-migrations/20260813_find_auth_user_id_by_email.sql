-- =====================================================================
-- find_auth_user_id_by_email(text) — retrouve l'uuid détenteur d'un email
-- dans auth.users (insensible à la casse), ou NULL.
--
-- SECURITY DEFINER : auth.users n'est pas exposé via PostgREST au service role.
-- Cette fonction (owner postgres) permet à l'endpoint /api/user/profile de
-- détecter un compte auth (y compris "auth-only", sans profil public.users)
-- qui détiendrait déjà l'email convoité, afin de le libérer pour réattribution.
--
-- N'expose QUE l'uuid (aucune autre donnée auth) → surface minimale.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_auth_user_id_by_email(text) IS
  'Retourne l''uuid auth.users détenant cet email (case-insensitive) ou NULL. Utilisé par /api/user/profile pour libérer un email de compte revoked/auth-only.';

-- Exécutable uniquement côté serveur (service_role). Pas de grant à anon/authenticated.
REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_auth_user_id_by_email(text) TO service_role;
