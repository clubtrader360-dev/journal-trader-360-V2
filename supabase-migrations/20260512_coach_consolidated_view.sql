-- ============================================================
-- Migration : vue coach_consolidated
-- Date      : 2026-05-12
-- Objectif  : éliminer le N+1 du dashboard coach
--             (1 + 70×4 = 281 queries → 2 queries)
--
-- Cette vue agrège par élève (role = 'student') :
--   - stats de trading (total trades, win/loss, P&L, gross profit/loss)
--   - comptabilité (total coûts comptes, total payouts, net profit, ROI)
--   - nombre de comptes
--
-- security_invoker = true : la vue s'exécute avec les droits de
-- l'appelant, pas du owner. Les RLS des tables sous-jacentes
-- (trades, payouts, account_costs, accounts) s'appliquent donc
-- normalement. Sans cette option, un user anon pourrait voir
-- tous les élèves via la clé publique Supabase.
--
-- Colonnes date trades : COALESCE(trade_date, date) pour couvrir
-- les enregistrements antérieurs à la migration trades (qui
-- utilisaient "date" avant l'ajout de "trade_date").
--
-- Colonne montant account_costs : "cost" (pas "amount") —
-- confirmé depuis supabase-account-costs.js ligne 86.
-- ============================================================

CREATE OR REPLACE VIEW coach_consolidated
WITH (security_invoker = true) AS
WITH trade_stats AS (
    SELECT
        user_id,
        COUNT(*)                                                       AS total_trades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END)                           AS winning_trades,
        COUNT(CASE WHEN pnl < 0 THEN 1 END)                           AS losing_trades,
        COALESCE(SUM(pnl), 0)                                         AS total_pnl,
        COALESCE(AVG(pnl), 0)                                         AS avg_pnl,
        COALESCE(SUM(CASE WHEN pnl > 0 THEN pnl  ELSE 0 END), 0)     AS gross_profit,
        COALESCE(SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END), 0) AS gross_loss,
        MAX(COALESCE(trade_date, date))                                AS last_trade_date
    FROM trades
    WHERE exit_price IS NOT NULL
    GROUP BY user_id
),
account_stats AS (
    SELECT user_id, COUNT(*) AS total_accounts
    FROM accounts
    GROUP BY user_id
),
cost_stats AS (
    SELECT user_id, COALESCE(SUM(cost), 0) AS total_costs
    FROM account_costs
    GROUP BY user_id
),
payout_stats AS (
    SELECT user_id, COALESCE(SUM(amount), 0) AS total_payouts
    FROM payouts
    GROUP BY user_id
)
SELECT
    u.uuid                                                             AS user_id,
    u.name,
    u.email,
    u.status,
    u.created_at,

    COALESCE(ts.total_trades,   0)                                    AS total_trades,
    COALESCE(ts.winning_trades, 0)                                    AS winning_trades,
    COALESCE(ts.losing_trades,  0)                                    AS losing_trades,
    COALESCE(ts.total_pnl,      0)                                    AS total_pnl,
    COALESCE(ts.avg_pnl,        0)                                    AS avg_pnl,
    COALESCE(ts.gross_profit,   0)                                    AS gross_profit,
    COALESCE(ts.gross_loss,     0)                                    AS gross_loss,
    ts.last_trade_date,

    COALESCE(a.total_accounts,  0)                                    AS total_accounts,
    COALESCE(c.total_costs,     0)                                    AS total_costs,
    COALESCE(p.total_payouts,   0)                                    AS total_payouts,

    COALESCE(p.total_payouts, 0) - COALESCE(c.total_costs, 0)        AS net_profit,
    CASE
        WHEN COALESCE(c.total_costs, 0) > 0
        THEN ROUND(
            (COALESCE(p.total_payouts, 0) - c.total_costs) / c.total_costs * 100,
            2
        )
        ELSE 0
    END                                                                AS roi_pct

FROM users u
LEFT JOIN trade_stats   ts ON ts.user_id = u.uuid
LEFT JOIN account_stats  a ON  a.user_id = u.uuid
LEFT JOIN cost_stats     c ON  c.user_id = u.uuid
LEFT JOIN payout_stats   p ON  p.user_id = u.uuid
WHERE u.role = 'student';
