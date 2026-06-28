-- =====================================================================
-- #33 Commit 2a — Vues agrégées pour le DASHBOARD COACH
-- security_invoker = true → la vue s'exécute avec les droits de l'appelant,
-- donc le RLS des tables sous-jacentes s'applique. trades/journal_entries/users
-- ont déjà une policy SELECT "(auth.uid() = user_id) OR is_coach()" → le coach
-- voit l'ensemble, l'élève seulement ses propres lignes (vue inoffensive pour lui).
-- Pattern identique à la vue daily_summary existante. 100% additif (pas de DROP table).
-- =====================================================================

-- 1) Agrégat JOURNALIER tous élèves (Hero P&L mois, KPI, calendrier coach)
CREATE OR REPLACE VIEW public.coach_daily_aggregate
WITH (security_invoker = true) AS
SELECT
  t.trade_date,
  SUM(COALESCE(t.pnl, 0))                                   AS total_pnl,
  COUNT(*)                                                  AS total_trades,
  COUNT(DISTINCT t.user_id)                                 AS active_students,
  SUM(CASE WHEN COALESCE(t.pnl, 0) > 0 THEN 1 ELSE 0 END)   AS wins,
  SUM(CASE WHEN COALESCE(t.pnl, 0) < 0 THEN 1 ELSE 0 END)   AS losses
FROM public.trades t
WHERE t.trade_date IS NOT NULL
GROUP BY t.trade_date;

COMMENT ON VIEW public.coach_daily_aggregate IS
  'Agrégat P&L journalier de tous les élèves (somme), pour le dashboard coach (#33). security_invoker → RLS coach hérité.';

-- 2) Vue d'ensemble par ÉLÈVE (table élèves coach + "Dernière activité" proxy)
--    last_activity = GREATEST(dernier trade créé, dernière entrée journal).
CREATE OR REPLACE VIEW public.coach_students_overview
WITH (security_invoker = true) AS
SELECT
  u.uuid                                  AS user_id,
  u.name,
  u.email,
  COALESCE(t.total_pnl, 0)                AS total_pnl,
  COALESCE(t.total_trades, 0)            AS total_trades,
  COALESCE(t.wins, 0)                     AS wins,
  COALESCE(t.losses, 0)                   AS losses,
  GREATEST(t.last_trade_at, j.last_journal_at) AS last_activity
FROM public.users u
LEFT JOIN (
  SELECT user_id,
         SUM(COALESCE(pnl, 0))                                 AS total_pnl,
         COUNT(*)                                              AS total_trades,
         SUM(CASE WHEN COALESCE(pnl, 0) > 0 THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN COALESCE(pnl, 0) < 0 THEN 1 ELSE 0 END) AS losses,
         MAX(created_at)                                       AS last_trade_at
  FROM public.trades
  GROUP BY user_id
) t ON t.user_id = u.uuid
LEFT JOIN (
  SELECT user_id, MAX(entry_date::timestamp) AS last_journal_at
  FROM public.journal_entries
  GROUP BY user_id
) j ON j.user_id = u.uuid
WHERE u.role = 'student' AND u.status = 'active';

COMMENT ON VIEW public.coach_students_overview IS
  '1 ligne par élève actif : agrégats de base + dernière activité (max trade créé / journal). Dashboard + table coach (#33).';
