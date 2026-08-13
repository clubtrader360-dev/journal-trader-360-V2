-- =====================================================================
-- Trigger : après un changement d'email confirmé côté auth.users, synchroniser
-- public.users.email. Évite tout round-trip client après la confirmation.
--
-- Contexte : le changement d'email passe désormais par sbClient.auth.updateUser()
-- (confirmation par lien, côté client — sécurisé). auth.users.email ne change qu'APRÈS
-- que l'utilisateur a cliqué le lien. Ce trigger propage alors la valeur dans public.users.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_public_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email
    WHERE uuid = NEW.id AND email IS DISTINCT FROM NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_public_email_from_auth() IS
  'Propage auth.users.email → public.users.email après confirmation d''un changement d''email.';

DROP TRIGGER IF EXISTS sync_public_email_after_auth_update ON auth.users;
CREATE TRIGGER sync_public_email_after_auth_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_email_from_auth();
