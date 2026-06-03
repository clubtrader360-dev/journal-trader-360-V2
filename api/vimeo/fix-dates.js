// ========================================
// GET /api/vimeo/fix-dates?secret=<CRON_SECRET>
// ========================================
// Endpoint TEMPORAIRE : corrige les replay_date des entrées déjà en DB en
// re-parsant le titre. À appeler manuellement APRÈS un upload massif (où
// created_time ≠ date du LIVE — cas Manu 50 replays uploadés le 02/06/2026).
//
// Idempotent : ne touche pas les lignes où le parser renvoie null ou la
// même date que l'actuelle. À SUPPRIMER une fois les dates rattrapées.
// ========================================

import { createClient } from '@supabase/supabase-js';
import { parseDateFromTitle } from './_lib/parse-date.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  console.log('[FIX-DATES] ========== START ==========');

  // 1. Auth via query secret (endpoint manuel — pas un cron Vercel)
  const secret = process.env.CRON_SECRET;
  if (!secret || req.query?.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized — ?secret=<CRON_SECRET> requis' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 2. Lire tous les replays existants
    const { data: replays, error: selErr } = await supabase
      .from('replays')
      .select('id, title, replay_date');
    if (selErr) {
      console.error('[FIX-DATES] select error:', selErr);
      return res.status(500).json({ error: 'DB select error', detail: selErr.message });
    }

    console.log(`[FIX-DATES] ${replays.length} replays en DB`);

    // 3. Trier : à mettre à jour vs non parsable vs déjà OK
    const toUpdate = [];
    const notParsable = [];
    const alreadyOk = [];

    for (const r of replays) {
      const parsedDate = parseDateFromTitle(r.title);
      if (!parsedDate) {
        notParsable.push({ id: r.id, title: r.title, current: r.replay_date });
      } else if (parsedDate !== r.replay_date) {
        toUpdate.push({ id: r.id, oldDate: r.replay_date, newDate: parsedDate, title: r.title });
      } else {
        alreadyOk.push(r.id);
      }
    }

    console.log(`[FIX-DATES] À mettre à jour: ${toUpdate.length}, Non parsable: ${notParsable.length}, Déjà OK: ${alreadyOk.length}`);

    // 4. Update un par un (volume faible : ~50, pas besoin de bulk)
    const errors = [];
    for (const item of toUpdate) {
      const { error: updErr } = await supabase
        .from('replays')
        .update({ replay_date: item.newDate })
        .eq('id', item.id);
      if (updErr) {
        console.error('[FIX-DATES] update error pour', item.id, ':', updErr);
        errors.push({ id: item.id, error: updErr.message });
      }
    }

    console.log('[FIX-DATES] ✅ Updates terminés:', toUpdate.length - errors.length, '/', toUpdate.length);

    return res.status(200).json({
      total_replays: replays.length,
      updated: toUpdate.length - errors.length,
      not_parsable: notParsable.length,
      already_ok: alreadyOk.length,
      errors: errors.length,
      updated_details: toUpdate.map(u => ({ title: u.title, old: u.oldDate, new: u.newDate })),
      not_parsable_titles: notParsable.map(np => ({ title: np.title, current: np.current })),
      error_details: errors
    });
  } catch (err) {
    console.error('[FIX-DATES] error:', err);
    return res.status(500).json({ error: err.message || 'erreur' });
  }
}
