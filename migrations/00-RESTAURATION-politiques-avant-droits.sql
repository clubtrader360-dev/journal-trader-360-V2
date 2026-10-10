-- ============================================================================
-- RETOUR ARRIERE : les 61 politiques telles qu'elles existaient AVANT
-- la migration 01-acces-membre.sql
-- ============================================================================
--
-- Releve le 10/10/2026 sur le projet zgihbpgoorymomtsbxpz, genere depuis
-- pg_policy. Compte : 61, identique au compte annonce par la migration.
--
-- POURQUOI CE FICHIER EXISTE
-- La migration supprime 61 politiques dont la definition n'est ecrite nulle
-- part ailleurs que dans la base elle-meme. Sans ce fichier, une migration qui
-- tourne mal ne se defait pas : il faudrait reinventer 61 expressions de
-- memoire, sur une base vivante, avec 102 eleves dehors.
--
-- Ce fichier ne s'execute QUE si la migration a mal tourne, et APRES avoir
-- supprime les politiques *_droit_journal_* qu'elle aura creees.
--
-- ATTENTION : ce fichier retablit l'etat d'AVANT, droits compris, donc il
-- rouvre le journal a tout le monde. C'est le but d'un retour arriere.
--
-- ATTENTION : le rejouer sur une base ou ces politiques existent deja echouera
-- sur la premiere. C'est voulu : mieux vaut echouer que dupliquer.

create policy "Users can create their own account costs" on public.account_costs as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can delete their own account costs" on public.account_costs as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can update their own account costs" on public.account_costs as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own account costs" on public.account_costs as permissive for select to public using ((auth.uid() = user_id));
create policy account_costs_delete_strict on public.account_costs as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy account_costs_insert_strict on public.account_costs as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy account_costs_select on public.account_costs as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy account_costs_update_strict on public.account_costs as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can create their own accounts" on public.accounts as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can delete their own accounts" on public.accounts as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can update their own accounts" on public.accounts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own accounts" on public.accounts as permissive for select to public using ((auth.uid() = user_id));
create policy accounts_delete_strict on public.accounts as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy accounts_insert_strict on public.accounts as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy accounts_select on public.accounts as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy accounts_update_strict on public.accounts as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy checklist_validations_insert on public.checklist_validations as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy checklist_validations_select on public.checklist_validations as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy checklist_validations_update on public.checklist_validations as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can delete their own daily fees" on public.daily_fees as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert their own daily fees" on public.daily_fees as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update their own daily fees" on public.daily_fees as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view their own daily fees" on public.daily_fees as permissive for select to public using ((auth.uid() = user_id));
create policy gamification_state_delete_strict on public.gamification_state as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy gamification_state_insert_strict on public.gamification_state as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy gamification_state_select on public.gamification_state as permissive for select to public using (((auth.uid() = user_id) OR is_coach()));
create policy gamification_state_update_strict on public.gamification_state as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy journal_entries_delete_strict on public.journal_entries as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy journal_entries_insert_strict on public.journal_entries as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy journal_entries_select on public.journal_entries as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy journal_entries_update_strict on public.journal_entries as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy users_delete_own_journal_entries on public.journal_entries as permissive for delete to public using ((auth.uid() = user_id));
create policy users_insert_own_journal_entries on public.journal_entries as permissive for insert to public with check ((auth.uid() = user_id));
create policy users_select_own_journal_entries on public.journal_entries as permissive for select to public using ((auth.uid() = user_id));
create policy users_update_own_journal_entries on public.journal_entries as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can create their own payouts" on public.payouts as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can delete their own payouts" on public.payouts as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can update their own payouts" on public.payouts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own payouts" on public.payouts as permissive for select to public using ((auth.uid() = user_id));
create policy payouts_delete_strict on public.payouts as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy payouts_insert_strict on public.payouts as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy payouts_select on public.payouts as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy payouts_update_strict on public.payouts as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy replay_views_insert on public.replay_views as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy replay_views_select on public.replay_views as permissive for select to authenticated using (((auth.uid() = user_id) OR can_view_replays()));
create policy replay_views_update on public.replay_views as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy trades_delete_strict on public.trades as permissive for delete to authenticated using ((auth.uid() = user_id));
create policy trades_insert_strict on public.trades as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy trades_select on public.trades as permissive for select to authenticated using (((auth.uid() = user_id) OR is_coach()));
create policy trades_update_strict on public.trades as permissive for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy users_delete_own_trades on public.trades as permissive for delete to public using ((auth.uid() = user_id));
create policy users_insert_own_trades on public.trades as permissive for insert to public with check ((auth.uid() = user_id));
create policy users_select_own_trades on public.trades as permissive for select to public using ((auth.uid() = user_id));
create policy users_update_own_trades on public.trades as permissive for update to public using ((auth.uid() = user_id));
create policy tradovate_credentials_self_modify on public.tradovate_credentials as permissive for all to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy tradovate_credentials_self_select on public.tradovate_credentials as permissive for select to public using ((auth.uid() = user_id));
create policy tradovate_sync_state_self on public.tradovate_sync_state as permissive for all to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can delete their own motivation" on public.user_motivation as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert their own motivation" on public.user_motivation as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update their own motivation" on public.user_motivation as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view their own motivation" on public.user_motivation as permissive for select to public using ((auth.uid() = user_id));
