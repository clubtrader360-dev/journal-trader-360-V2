-- ========================================
-- SCRIPT : Corriger le P&L pour inclure les frais (V2)
-- Gère les dépendances (vue student_statistics)
-- ========================================

-- 1. Supprimer la vue student_statistics temporairement
DROP VIEW IF EXISTS student_statistics CASCADE;

-- 2. Supprimer la colonne pnl si elle est GENERATED
ALTER TABLE trades
DROP COLUMN IF EXISTS pnl CASCADE;

-- 3. Recréer la colonne pnl comme colonne normale (non générée)
ALTER TABLE trades
ADD COLUMN pnl NUMERIC;

-- 4. Créer une fonction qui calcule le P&L en tenant compte des frais
CREATE OR REPLACE FUNCTION calculate_trade_pnl()
RETURNS TRIGGER AS $$
DECLARE
    v_multiplier NUMERIC;
    point_diff   NUMERIC;
    calculated_pnl NUMERIC;
BEGIN
    -- manual_pnl = P&L net (frais déjà inclus côté client/import). Utiliser directement.
    IF NEW.manual_pnl IS NOT NULL THEN
        NEW.pnl := NEW.manual_pnl;
        RETURN NEW;
    END IF;

    -- Trade ouvert (exit_price absent) → pnl indéfini, ne pas calculer
    IF NEW.exit_price IS NULL THEN
        NEW.pnl := NULL;
        RETURN NEW;
    END IF;

    -- Chercher le multiplier dans la table de référence
    SELECT multiplier INTO v_multiplier
    FROM instrument_multipliers
    WHERE instrument = NEW.instrument;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Instrument inconnu : %. Ajoutez-le dans instrument_multipliers.', NEW.instrument;
    END IF;

    -- Calculer la différence de points
    point_diff := NEW.exit_price - NEW.entry_price;

    -- Calculer le P&L brut
    calculated_pnl := point_diff * NEW.quantity * v_multiplier;
    
    -- Si SHORT, inverser le signe
    IF NEW.direction = 'SHORT' THEN
        calculated_pnl := -calculated_pnl;
    END IF;
    
    -- Déduire les frais (fees est toujours >= 0)
    calculated_pnl := calculated_pnl - COALESCE(NEW.fees, 0);
    
    NEW.pnl := calculated_pnl;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Créer le trigger AVANT INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_calculate_pnl ON trades;

CREATE TRIGGER trigger_calculate_pnl
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION calculate_trade_pnl();

-- 6. Mettre à jour tous les trades existants pour recalculer le P&L avec frais
UPDATE trades
SET pnl = manual_pnl
WHERE manual_pnl IS NOT NULL;

-- Pour les trades sans manual_pnl, forcer le recalcul via le trigger
UPDATE trades
SET entry_price = entry_price  -- Trigger le trigger sans changer les données
WHERE manual_pnl IS NULL;

-- 7. Recréer la vue student_statistics
CREATE OR REPLACE VIEW student_statistics AS
SELECT 
    u.id as user_id,
    u.uuid,
    u.name,
    u.email,
    COUNT(DISTINCT t.id) as total_trades,
    COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END) as winning_trades,
    COUNT(DISTINCT CASE WHEN t.pnl <= 0 THEN t.id END) as losing_trades,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT t.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN t.pnl > 0 THEN t.id END)::NUMERIC / COUNT(DISTINCT t.id)::NUMERIC) * 100
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

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Migration terminée ! Le P&L inclut maintenant les frais.';
    RAISE NOTICE '✅ Vue student_statistics recréée avec succès.';
END $$;
