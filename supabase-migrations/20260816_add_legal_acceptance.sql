-- #19 — Tracking du consentement légal (CGV/CGU/Confidentialité).
-- Comparé à LEGAL_VERSION_DATE côté frontend pour déclencher une re-acceptation si les textes changent.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ;
COMMENT ON COLUMN public.users.legal_accepted_at IS 'Date d''acceptation des CGV/CGU/Confidentialité en vigueur. Comparé à LEGAL_VERSION_DATE côté frontend pour déclencher une re-acceptation si textes mis à jour.';
