// ========================================
// API ROUTE : SYNC AUTOMATIQUE DES REPLAYS DEPUIS VIMEO
// Route : /api/cron/replays-sync
// Cron : Lun-Ven à 19h heure Paris (17h ET 18h UTC pour couvrir CET/CEST)
// ========================================
// Récupère la page 1 (50 dernières) du dossier "REPLAY LIVE" sur Vimeo,
// insère les vidéos pas encore présentes dans la table `replays`.
// Idempotent : matching par vimeo_video_id, aucun doublon possible.
// Notification Discord si au moins 1 replay ajouté.
// ========================================

import { createClient } from '@supabase/supabase-js';
import { findReplayFolder, VIMEO_API, VIMEO_ACCEPT, REPLAY_FOLDER_NAME } from '../vimeo/_lib/folder.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Champs Vimeo nécessaires (created_time pour la date du replay)
const VIDEO_FIELDS = 'uri,name,duration,pictures.sizes,created_time,link';

export default async function handler(req, res) {
  console.log('[REPLAYS-SYNC] ========== START ==========');

  // 1. Auth via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[REPLAYS-SYNC] CRON_SECRET manquant en env');
    return res.status(500).json({ error: 'Missing CRON_SECRET' });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.error('[REPLAYS-SYNC] Accès non autorisé');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Env vars critiques
  const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
  if (!vimeoToken) {
    console.error('[REPLAYS-SYNC] VIMEO_ACCESS_TOKEN manquante');
    return res.status(500).json({ error: 'Missing VIMEO_ACCESS_TOKEN' });
  }
  if (!SUPABASE_SERVICE_KEY) {
    console.error('[REPLAYS-SYNC] SUPABASE_SERVICE_ROLE_KEY manquante');
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    // 3. Trouver le dossier REPLAY LIVE
    const folder = await findReplayFolder(vimeoToken);
    if (!folder) {
      console.error(`[REPLAYS-SYNC] Dossier ${REPLAY_FOLDER_NAME} introuvable`);
      return res.status(500).json({ error: `${REPLAY_FOLDER_NAME} folder not found` });
    }

    // 4. Page 1 des vidéos (50 plus récentes — Vimeo trie par created_time desc)
    const url = `${VIMEO_API}${folder.uri}/videos`
              + `?per_page=50&page=1&fields=${encodeURIComponent(VIDEO_FIELDS)}`;
    const vRes = await fetch(url, {
      headers: { Authorization: `Bearer ${vimeoToken}`, Accept: VIMEO_ACCEPT }
    });
    if (!vRes.ok) {
      console.error('[REPLAYS-SYNC] Vimeo list error:', vRes.status);
      return res.status(502).json({ error: 'Vimeo error' });
    }
    const payload = await vRes.json();
    const videos = (payload.data || []).map(formatVideo).filter(Boolean);
    console.log('[REPLAYS-SYNC] Vidéos récupérées de Vimeo:', videos.length);

    if (videos.length === 0) {
      return res.status(200).json({ added: 0, message: 'No videos in folder' });
    }

    // 5. Identifier celles déjà en DB (matching par vimeo_video_id)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ids = videos.map(v => v.video_id);
    const { data: existing, error: selErr } = await supabase
      .from('replays')
      .select('vimeo_video_id')
      .in('vimeo_video_id', ids);
    if (selErr) {
      console.error('[REPLAYS-SYNC] select existing error:', selErr);
      return res.status(500).json({ error: 'DB select error', detail: selErr.message });
    }
    const existingSet = new Set((existing || []).map(r => String(r.vimeo_video_id)));
    const toInsert = videos.filter(v => !existingSet.has(String(v.video_id)));
    console.log('[REPLAYS-SYNC] Nouveaux replays à ajouter:', toInsert.length);

    if (toInsert.length === 0) {
      return res.status(200).json({ added: 0, message: 'No new replays' });
    }

    // 6. INSERT (description et created_by laissés NULL)
    const rows = toInsert.map(v => ({
      title:            v.title || 'Replay sans titre',
      description:      null,
      vimeo_video_id:   v.video_id,
      vimeo_hash:       v.hash || null,
      thumbnail_url:    v.thumbnail || null,
      duration_seconds: v.duration || null,
      replay_date:      v.replay_date,
      created_by:       null
    }));
    const { error: insErr } = await supabase.from('replays').insert(rows);
    if (insErr) {
      console.error('[REPLAYS-SYNC] insert error:', insErr);
      return res.status(500).json({ error: 'DB insert error', detail: insErr.message });
    }

    // 7. Notification Discord (silencieuse si webhook absent)
    await notifyDiscord(toInsert);

    console.log('[REPLAYS-SYNC] ✅ Ajoutés:', toInsert.length);
    return res.status(200).json({
      added: toInsert.length,
      replays: toInsert.map(v => ({
        video_id:    v.video_id,
        title:       v.title,
        replay_date: v.replay_date
      }))
    });
  } catch (err) {
    console.error('[REPLAYS-SYNC] error:', err);
    return res.status(500).json({ error: err.message || 'erreur' });
  }
}

function formatVideo(v) {
  const m = String(v.link || '').match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  return {
    video_id:    m[1],
    hash:        m[2] || null,
    title:       v.name || '',
    duration:    v.duration ?? null,
    thumbnail:   pickLargestThumbnail(v.pictures?.sizes),
    replay_date: toParisDate(v.created_time)
  };
}

function pickLargestThumbnail(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const largest = sizes.reduce((a, b) => (b.width > a.width ? b : a));
  return largest.link || null;
}

// Vimeo renvoie created_time en ISO 8601 UTC. On veut la date (YYYY-MM-DD)
// dans le fuseau Europe/Paris. 'en-CA' garantit le format YYYY-MM-DD.
function toParisDate(isoDateTime) {
  const d = isoDateTime ? new Date(isoDateTime) : new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

async function notifyDiscord(addedVideos) {
  const url = process.env.DISCORD_REPLAYS_WEBHOOK_URL;
  if (!url) {
    console.warn('[REPLAYS-SYNC] DISCORD_REPLAYS_WEBHOOK_URL non configurée — pas de notif');
    return;
  }
  const lines = addedVideos.map(v =>
    `• **${v.title}** — ${v.replay_date} (${formatDuration(v.duration)})`
  );
  const count = addedVideos.length;
  const content = `🎬 **${count} replay${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} au journal :**\n${lines.join('\n')}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) console.warn('[REPLAYS-SYNC] Discord webhook HTTP', res.status);
  } catch (e) {
    console.warn('[REPLAYS-SYNC] Discord webhook error:', e?.message || e);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}min`;
}
