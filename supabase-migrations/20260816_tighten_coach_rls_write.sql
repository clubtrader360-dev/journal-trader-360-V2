-- ============================================================================
-- SÉCURITÉ — Colmatage du trou RLS write coach (fermeture propre du chantier #80)
-- ============================================================================
-- Contexte : les policies write "génériques" des tables élève autorisaient
--   (auth.uid() = user_id) OR is_coach()
-- → un coach pouvait techniquement écrire les données d'un élève via son JWT normal.
-- Le mode coach-view (#80) est en LECTURE SEULE : aucune écriture coach n'est légitime.
--
-- Cette migration retire is_coach() de TOUTES les policies INSERT/UPDATE/DELETE des
-- tables élève et les remplace par des versions strictes (auth.uid() = user_id UNIQUEMENT).
--
-- ⚠️ NE TOUCHE PAS :
--   - aux policies SELECT (le coach doit garder la LECTURE : dashboard coach + coach-view)
--   - aux policies "Users can ..." déjà strictes (elles restent)
--   - à checklist_validations (ses policies write sont déjà strictes, aucun is_coach())
--
-- Endpoints backend : api/tradovate/index.js (seul writer de trades) utilise
--   SUPABASE_SERVICE_ROLE_KEY → bypass RLS → totalement indépendant de ce durcissement.
--   Le cron tradovate sync (service_role) continue d'écrire sans changement.
--
-- Réversible : recréer les policies "*_insert/update/delete" avec "OR is_coach()".
-- ============================================================================

-- ---------- journal_entries (role authenticated) ----------
DROP POLICY IF EXISTS "journal_entries_insert" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert_strict" ON public.journal_entries;
CREATE POLICY "journal_entries_insert_strict" ON public.journal_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_entries_update" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_update_strict" ON public.journal_entries;
CREATE POLICY "journal_entries_update_strict" ON public.journal_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_entries_delete" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete_strict" ON public.journal_entries;
CREATE POLICY "journal_entries_delete_strict" ON public.journal_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- trades (role authenticated) ----------
DROP POLICY IF EXISTS "trades_insert" ON public.trades;
DROP POLICY IF EXISTS "trades_insert_strict" ON public.trades;
CREATE POLICY "trades_insert_strict" ON public.trades
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trades_update" ON public.trades;
DROP POLICY IF EXISTS "trades_update_strict" ON public.trades;
CREATE POLICY "trades_update_strict" ON public.trades
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trades_delete" ON public.trades;
DROP POLICY IF EXISTS "trades_delete_strict" ON public.trades;
CREATE POLICY "trades_delete_strict" ON public.trades
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- accounts (role authenticated) ----------
DROP POLICY IF EXISTS "accounts_insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert_strict" ON public.accounts;
CREATE POLICY "accounts_insert_strict" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_strict" ON public.accounts;
CREATE POLICY "accounts_update_strict" ON public.accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_delete" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete_strict" ON public.accounts;
CREATE POLICY "accounts_delete_strict" ON public.accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- account_costs (role authenticated) ----------
DROP POLICY IF EXISTS "account_costs_insert" ON public.account_costs;
DROP POLICY IF EXISTS "account_costs_insert_strict" ON public.account_costs;
CREATE POLICY "account_costs_insert_strict" ON public.account_costs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "account_costs_update" ON public.account_costs;
DROP POLICY IF EXISTS "account_costs_update_strict" ON public.account_costs;
CREATE POLICY "account_costs_update_strict" ON public.account_costs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "account_costs_delete" ON public.account_costs;
DROP POLICY IF EXISTS "account_costs_delete_strict" ON public.account_costs;
CREATE POLICY "account_costs_delete_strict" ON public.account_costs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- payouts (role authenticated) ----------
DROP POLICY IF EXISTS "payouts_insert" ON public.payouts;
DROP POLICY IF EXISTS "payouts_insert_strict" ON public.payouts;
CREATE POLICY "payouts_insert_strict" ON public.payouts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payouts_update" ON public.payouts;
DROP POLICY IF EXISTS "payouts_update_strict" ON public.payouts;
CREATE POLICY "payouts_update_strict" ON public.payouts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payouts_delete" ON public.payouts;
DROP POLICY IF EXISTS "payouts_delete_strict" ON public.payouts;
CREATE POLICY "payouts_delete_strict" ON public.payouts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- gamification_state (PAS de policy "Users can ..." → recréation stricte OBLIGATOIRE) ----------
DROP POLICY IF EXISTS "gamification_state_insert" ON public.gamification_state;
DROP POLICY IF EXISTS "gamification_state_insert_strict" ON public.gamification_state;
CREATE POLICY "gamification_state_insert_strict" ON public.gamification_state
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamification_state_update" ON public.gamification_state;
DROP POLICY IF EXISTS "gamification_state_update_strict" ON public.gamification_state;
CREATE POLICY "gamification_state_update_strict" ON public.gamification_state
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamification_state_delete" ON public.gamification_state;
DROP POLICY IF EXISTS "gamification_state_delete_strict" ON public.gamification_state;
CREATE POLICY "gamification_state_delete_strict" ON public.gamification_state
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- user_preferences (PAS de policy "Users can ..." → recréation stricte OBLIGATOIRE) ----------
DROP POLICY IF EXISTS "user_preferences_insert" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_strict" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_strict" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_strict" ON public.user_preferences;
CREATE POLICY "user_preferences_update_strict" ON public.user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_delete_strict" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_strict" ON public.user_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- checklist_validations : policies write déjà strictes (aucun is_coach()) → volontairement non touchées.
-- SELECT (toutes tables) : volontairement non touchées → le coach garde la LECTURE.
