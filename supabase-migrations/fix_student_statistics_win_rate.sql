-- Migration : corriger student_statistics
-- 1. losing_trades : pnl <= 0 → pnl < 0 (break-even n'est pas une perte)
-- 2. win_rate dénominateur : total_trades → wins + losses (exclut break-even et trades ouverts)

CREATE OR REPLACE VIEW student_statistics AS
SELECT
    u.id as user_id,
    u.uuid,
    u.name,
    u.email,
    COUNT(DISTINCT t.id) as total_trades,
    COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END) as winning_trades,
    COUNT(DISTINCT CASE WHEN t.pnl < 0 THEN t.id END) as losing_trades,
    ROUND(
        CASE
            WHEN (COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END) +
                  COUNT(DISTINCT CASE WHEN t.pnl < 0 THEN t.id END)) > 0
            THEN (
                COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END)::NUMERIC
                /
                (COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END) +
                 COUNT(DISTINCT CASE WHEN t.pnl < 0 THEN t.id END))::NUMERIC
            ) * 100
            ELSE 0
        END,
        2
    ) as win_rate,
    COALESCE(SUM(t.pnl), 0) as total_pnl,
    COALESCE(SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END), 0) as gross_profit,
    COALESCE(SUM(CASE WHEN t.pnl < 0 THEN ABS(t.pnl) ELSE 0 END), 0) as gross_loss,
    MAX(t.entry_time) as last_trade_date
FROM
    users u
    LEFT JOIN trades t ON t.user_id = u.uuid
WHERE
    u.role = 'student'
GROUP BY
    u.id, u.uuid, u.name, u.email;
