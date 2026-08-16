-- ============================================================
-- Vue coach_consolidated — agrégats par élève pour le dashboard coach.
-- security_invoker=true → RLS des tables sous-jacentes appliqué (is_coach() hérité).
--
-- ⚠️ Adaptée au schéma ACTUEL (2026-08-16) vs la réf mai 2026 :
--   - trades : colonne `date` SUPPRIMÉE → on n'utilise QUE `trade_date`.
--   - account_costs : montant = `cost` ; payouts : montant = `amount`.
--   - pnl : colonne stockée, toujours NON NULL et == manual_pnl quand présent (vérifié) →
--           SUM(pnl) SQL == somme côté dashboard. Pas de filtre exit_price (le dashboard
--           inclut tous les trades).
--
-- NB : cette vue sert les lectures AGRÉGÉES. Le T360 Score par élève reste calculé côté JS
-- sur les trades bruts (formule par compte/jour) → non porté en SQL (risque de divergence).
-- ============================================================
CREATE OR REPLACE VIEW public.coach_consolidated
WITH (security_invoker = true) AS
WITH trade_stats AS (
  SELECT
    user_id,
    COUNT(*)                                                       AS total_trades,
    COUNT(*) FILTER (WHERE pnl > 0)                                AS wins,
    COUNT(*) FILTER (WHERE pnl < 0)                                AS losses,
    COALESCE(SUM(pnl), 0)                                          AS net_pnl,
    COALESCE(AVG(pnl), 0)                                          AS avg_pnl,
    COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0)                   AS gross_profit,
    COALESCE(SUM(ABS(pnl)) FILTER (WHERE pnl < 0), 0)             AS gross_loss,
    MIN(trade_date)                                                AS first_trade_date,
    MAX(trade_date)                                                AS last_trade_date
  FROM public.trades
  GROUP BY user_id
),
account_stats AS (
  SELECT user_id, COUNT(*) AS total_accounts FROM public.accounts GROUP BY user_id
),
cost_stats AS (
  SELECT user_id, COALESCE(SUM(cost), 0) AS total_costs FROM public.account_costs GROUP BY user_id
),
payout_stats AS (
  SELECT user_id, COALESCE(SUM(amount), 0) AS total_payouts FROM public.payouts GROUP BY user_id
)
SELECT
  u.uuid AS user_id,
  u.name, u.email, u.status, u.created_at,
  COALESCE(ts.total_trades, 0)  AS total_trades,
  COALESCE(ts.wins, 0)          AS wins,
  COALESCE(ts.losses, 0)        AS losses,
  COALESCE(ts.gross_profit, 0)  AS gross_profit,
  COALESCE(ts.gross_loss, 0)    AS gross_loss,
  COALESCE(ts.net_pnl, 0)       AS net_pnl,
  COALESCE(ts.avg_pnl, 0)       AS avg_pnl,
  ts.first_trade_date,
  ts.last_trade_date,
  COALESCE(a.total_accounts, 0) AS total_accounts,
  COALESCE(c.total_costs, 0)    AS total_costs,
  COALESCE(p.total_payouts, 0)  AS total_payouts,
  COALESCE(p.total_payouts, 0) - COALESCE(c.total_costs, 0) AS net_profit,
  CASE WHEN COALESCE(c.total_costs, 0) > 0
       THEN ROUND(((COALESCE(p.total_payouts, 0) - COALESCE(c.total_costs, 0)) / c.total_costs * 100)::numeric, 2)
       ELSE 0 END AS roi_pct
FROM public.users u
LEFT JOIN trade_stats   ts ON ts.user_id = u.uuid
LEFT JOIN account_stats a  ON a.user_id  = u.uuid
LEFT JOIN cost_stats    c  ON c.user_id  = u.uuid
LEFT JOIN payout_stats  p  ON p.user_id  = u.uuid
WHERE u.role = 'student' AND u.status = 'active';

COMMENT ON VIEW public.coach_consolidated IS
  'Agrégats par élève actif (trades/comptes/coûts/payouts) pour le dashboard coach. security_invoker → RLS coach hérité. #perf-coach.';
