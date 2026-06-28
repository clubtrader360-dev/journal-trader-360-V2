-- =====================================================================
-- #33 Commit 2b-vii — Persister la VALIDATION CHECKLIST (bouton élève) en base
-- Audit : validateChecklist() (index.html) n'écrivait qu'en localStorage → invisible
-- du serveur, donc inagrégeable côté coach. journal_entries écarté car :
--   1) pas de contrainte unique (user_id, entry_date) → onConflict impossible,
--   2) 125 paires (user_id, entry_date) en doublon → ligne cible ambiguë,
--   3) colonne content NOT NULL sans default → insert "nu" échouerait.
-- → Table dédiée, PK (user_id, validation_date) : upsert élève trivial et sûr,
--   zéro pollution de journal_entries. RLS calqué sur journal_entries.
-- 100% additif.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.checklist_validations (
  user_id         uuid        NOT NULL,
  validation_date date        NOT NULL,
  items_checked   integer,
  total_items     integer,
  completion_rate numeric,
  validated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, validation_date)
);

COMMENT ON TABLE public.checklist_validations IS
  'Validation quotidienne de la checklist pré-session par l''élève (bouton "Valider la checklist"). 1 ligne / (élève, jour). Source du tracking checklist côté coach (#33).';

ALTER TABLE public.checklist_validations ENABLE ROW LEVEL SECURITY;

-- SELECT : l'élève voit les siennes, le coach voit tout (pattern journal_entries).
CREATE POLICY checklist_validations_select ON public.checklist_validations
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.is_coach());

-- INSERT : l'élève n'écrit que pour lui-même.
CREATE POLICY checklist_validations_insert ON public.checklist_validations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE : idem (revalidation le même jour = upsert).
CREATE POLICY checklist_validations_update ON public.checklist_validations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
