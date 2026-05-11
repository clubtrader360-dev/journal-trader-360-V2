// ========================================
// AGRÉGATION FILLS TRADOVATE → TRADES ROUND-TRIP
// ========================================
// Tradovate donne des "fills" : chaque exécution est une ligne séparée.
// Un trade complet = ouverture (X contrats Buy) + fermeture (X contrats
// Sell). Mais l'élève peut scaler in/out :
//
//   Buy 3 @ 5000
//   Buy 2 @ 5002          ← scale-in (ajout)
//   Sell 2 @ 5008         ← scale-out (sortie partielle)
//   Sell 3 @ 5010         ← clôture
//
// Stratégie d'agrégation (V1, pragmatique) :
//   - on regroupe les fills par (account, contract)
//   - on parcourt en ordre chronologique
//   - on tient une "position courante" (qty_long − qty_short)
//   - dès que la position revient à zéro, on émet un trade :
//        entry_time   = timestamp du 1er fill de la séquence
//        exit_time    = timestamp du fill qui ramène à 0
//        entry_price  = VWAP des fills d'ouverture (côté qui ouvre)
//        exit_price   = VWAP des fills de fermeture (côté qui ferme)
//        quantity     = max(|position|) atteinte pendant la séquence
//        direction    = 'LONG' si la position devenue ≠0 était positive
//        external_id  = "<env>:<account_id>:<sorted_fill_ids_joined>"
//        fees         = somme des fillFees pour les fills concernés
//        pnl          = (exit_vwap − entry_vwap) * qty * pointValue
//                       (signe inversé si SHORT)
//
// Cas reverse (Buy 3 puis Sell 5 = ferme 3 long et ouvre 2 short) :
// V1 = on émet 2 trades distincts :
//    - 1er trade : LONG qty 3, fermé par les 3 premiers contrats du Sell
//    - 2e trade : SHORT qty 2, encore ouvert (pas émis tant que pas closé)
// Ça reflète bien le journal : un trade = un cycle ouvert→fermé.
// ========================================

// Multiplicateurs CME — alignés avec ceux du formulaire manuel index.html
const POINT_VALUE = {
  ES: 50, MES: 5,
  NQ: 20, MNQ: 2,
  GC: 100, MGC: 10,
  // fallbacks raisonnables ; sinon le sync laisse pnl null
  YM: 5, MYM: 0.5,
  RTY: 50, M2K: 5,
  CL: 1000, MCL: 100,
  SI: 5000, SIL: 1000,
  HG: 25000, MHG: 2500,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000
};

// Détermine le code instrument lisible à partir du nom de contrat Tradovate.
// Tradovate utilise "ESM5", "MNQH6", etc. → on capture le préfixe alpha.
export function symbolFromContractName(contractName) {
  if (!contractName) return null;
  const m = String(contractName).match(/^([A-Z]+)/);
  return m ? m[1] : null;
}

function pointValueFor(symbol) {
  if (!symbol) return null;
  return POINT_VALUE[symbol] ?? null;
}

// Calcule le P&L net d'un round-trip. Renvoie null si on ne connaît pas
// le multiplicateur — l'app pourra alors retomber sur manual_pnl=null
// et l'élève peut compléter à la main.
function computePnl({ direction, entryVwap, exitVwap, qty, symbol, fees }) {
  const pv = pointValueFor(symbol);
  if (pv == null) return null;
  let gross = (exitVwap - entryVwap) * qty * pv;
  if (direction === 'SHORT') gross = -gross;
  return gross - (fees || 0);
}

function vwap(fills) {
  // VWAP = Σ(price * qty) / Σ(qty)
  let num = 0, den = 0;
  for (const f of fills) {
    num += Number(f.price) * Number(f.qty);
    den += Number(f.qty);
  }
  return den > 0 ? num / den : 0;
}

/**
 * @param {object[]} fills          fills Tradovate (filtrés ≥ last_fill_id)
 * @param {object[]} fillFees       fillFee Tradovate
 * @param {object[]} contracts      contract Tradovate (pour mapping id→name)
 * @param {object} ctx              { env, account_id_tradovate, account_id_supabase }
 * @returns {object[]}              tableau de "trade rows" prêts à upsert
 */
export function aggregateFillsToTrades({ fills, fillFees, contracts, ctx }) {
  if (!Array.isArray(fills) || fills.length === 0) return [];

  // Index frais par fillId
  const feeByFillId = new Map();
  for (const ff of (fillFees || [])) {
    // La structure Tradovate : ff.fillId, ff.commission, ff.clearingFee, etc.
    const total =
      (Number(ff.commission) || 0) +
      (Number(ff.clearingFee) || 0) +
      (Number(ff.exchangeFee) || 0) +
      (Number(ff.nfaFee)      || 0) +
      (Number(ff.brokerageFee)|| 0);
    feeByFillId.set(ff.fillId, (feeByFillId.get(ff.fillId) || 0) + total);
  }

  // Index contracts par id
  const contractById = new Map();
  for (const c of (contracts || [])) {
    contractById.set(c.id, c);
  }

  // Regrouper par (accountId, contractId)
  const buckets = new Map();
  for (const f of fills) {
    const key = `${f.accountId}|${f.contractId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }

  const rows = [];

  for (const [, bucketFills] of buckets) {
    // Tri chrono. Tradovate: f.timestamp ISO string.
    bucketFills.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // État courant de la position
    let pos = 0;                  // contrats nets (long positif, short négatif)
    let openSideFills = [];       // fills qui ont ouvert / agrandi la position
    let closeSideFills = [];      // fills qui ferment / réduisent

    for (const f of bucketFills) {
      const qty = Number(f.qty);
      // Tradovate: f.action = 'Buy' | 'Sell'
      const signed = f.action === 'Buy' ? qty : -qty;

      // Si la position est à zéro, c'est une nouvelle ouverture
      if (pos === 0) {
        pos = signed;
        openSideFills = [{ ...f, qty, signed }];
        closeSideFills = [];
        continue;
      }

      // Même sens que la position courante → scale-in
      if (Math.sign(signed) === Math.sign(pos)) {
        pos += signed;
        openSideFills.push({ ...f, qty, signed });
        continue;
      }

      // Sens opposé → ferme tout ou partie. Cas reverse (overshoot)
      // = on ferme la position courante, puis on ouvre la nouvelle
      // dans l'autre sens.
      const closingQty = Math.min(qty, Math.abs(pos));
      closeSideFills.push({ ...f, qty: closingQty });
      pos += Math.sign(-pos) * closingQty;

      // Position revenue à 0 → on émet un round-trip
      if (pos === 0) {
        rows.push(buildTradeRow({
          openFills: openSideFills,
          closeFills: closeSideFills,
          contractById,
          feeByFillId,
          ctx
        }));
        openSideFills = [];
        closeSideFills = [];

        // Reverse : il reste du qty de ce fill à ouvrir dans l'autre sens
        const overshoot = qty - closingQty;
        if (overshoot > 0) {
          const newSigned = f.action === 'Buy' ? overshoot : -overshoot;
          pos = newSigned;
          openSideFills = [{ ...f, qty: overshoot, signed: newSigned }];
        }
      }
      // pos != 0 → scale-out partiel, on continue à boucler
    }
    // Position toujours ouverte à la fin du bucket : on n'émet rien
    // (le trade sera complété au prochain sync quand la fermeture arrivera).
  }

  return rows;
}

function buildTradeRow({ openFills, closeFills, contractById, feeByFillId, ctx }) {
  const direction = openFills[0].signed > 0 ? 'LONG' : 'SHORT';
  const qty = openFills.reduce((s, f) => s + f.qty, 0);

  const entryVwap = vwap(openFills);
  const exitVwap  = vwap(closeFills);

  const allFillIds = [
    ...openFills.map(f => f.id),
    ...closeFills.map(f => f.id)
  ].sort((a, b) => a - b);

  const totalFees = allFillIds
    .reduce((s, id) => s + (feeByFillId.get(id) || 0), 0);

  const contract = contractById.get(openFills[0].contractId);
  const symbol = symbolFromContractName(contract?.name);

  const entryTs = openFills[0].timestamp;
  const exitTs  = closeFills[closeFills.length - 1].timestamp;
  const tradeDate = entryTs ? entryTs.slice(0, 10) : null;

  const pnl = computePnl({
    direction, entryVwap, exitVwap, qty, symbol, fees: totalFees
  });

  // external_id idempotent : même set de fills → même id
  const external_id =
    `${ctx.env}:${openFills[0].accountId}:${allFillIds.join(',')}`;

  return {
    user_id: ctx.user_id,
    account_id: ctx.account_id_supabase,   // peut être null si pas mappé
    instrument: symbol,
    direction,
    type: direction === 'LONG' ? 'Long' : 'Short',
    quantity: qty,
    entry_price: round2(entryVwap),
    exit_price: round2(exitVwap),
    entry_time: entryTs,
    exit_time: exitTs,
    trade_date: tradeDate,
    manual_pnl: pnl != null ? round2(pnl) : null,
    fees: round2(totalFees),
    setup: null,        // l'élève complétera dans le journal
    notes: null,
    protections: null,
    trade_trend_type: 'Non spécifié',
    is_break_even: false,
    is_methode: false,
    is_hors_methode: false,
    source: 'tradovate',
    external_id
  };
}

function round2(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}
