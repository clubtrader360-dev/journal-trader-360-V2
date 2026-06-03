// ========================================
// GET /api/vimeo/backfill
// ========================================
// Backfill TOUS les replays du dossier Vimeo (parcourt jusqu'à MAX_PAGES pages).
// Le cron quotidien ne prend que la page 1 (50 vidéos) → cet endpoint
// rattrape les ~107 vidéos historiques de Manu.
//
// Idempotent : filtre par vimeo_video_id déjà en DB → pas de doublons.
// Dates parsées depuis le titre (parseDateFromTitle) → pas besoin de fix-dates après.
//
// ⚠️ TEMPORAIRE one-shot — PAS D'AUTH (assumé pour la preview, idempotent).
// À SUPPRIMER juste après usage.
// ========================================

import { createClient } from '@supabase/supabase-js';
import { findReplayFolder, VIMEO_API, VIMEO_ACCEPT, REPLAY_FOLDER_NAME } from './_lib/folder.js';
import { parseDateFromTitle } from './_lib/parse-date.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const VIDEO_FIELDS = 'uri,name,duration,pictures.sizes,created_time,link';
const MAX_PAGES = 20;

export default async function handler(req, res) {
  console.log('[BACKFILL] ========== START ==========');

  const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
  if (!vimeoToken) return res.status(500).json({ error: 'VIMEO_ACCESS_TOKEN manquante' });
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' });

  try {
    const folder = await findReplayFolder(vimeoToken);
    if (!folder) {
      return res.status(500).json({ error: `${REPLAY_FOLDER_NAME} folder not found` });
    }

    // Parcours TOUTES les pages (jusqu'à MAX_PAGES pour garde-fou)
    const allVideos = [];
    let nextUrl = `${VIMEO_API}${folder.uri}/videos?per_page=50&page=1&fields=${encodeURIComponent(VIDEO_FIELDS)}`;
    let pageCount = 0;

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      console.log(`[BACKFILL] Page ${pageCount}`);
      const vRes = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${vimeoToken}`, Accept: VIMEO_ACCEPT }
      });
      if (!vRes.ok) {
        console.error('[BACKFILL] Vimeo error page', pageCount, ':', vRes.status);
        break;
      }
      const payload = await vRes.json();
      const pageVideos = (payload.data || []).map(formatVideo).filter(Boolean);
      allVideos.push(...pageVideos);
      const next = payload.paging?.next;
      nextUrl = next ? (next.startsWith('http') ? next : `${VIMEO_API}${next}`) : null;
    }

    console.log(`[BACKFILL] ${pageCount} pages, ${allVideos.length} vidéos totales sur Vimeo`);

    if (allVideos.length === 0) {
      return res.status(200).json({ pages_fetched: pageCount, videos_found_vimeo: 0, videos_added: 0 });
    }

    // Filtrer celles déjà en DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ids = allVideos.map(v => v.video_id);
    const { data: existing, error: selErr } = await supabase
      .from('replays')
      .select('vimeo_video_id')
      .in('vimeo_video_id', ids);
    if (selErr) {
      console.error('[BACKFILL] select error:', selErr);
      return res.status(500).json({ error: 'DB select error', detail: selErr.message });
    }
    const existingSet = new Set((existing || []).map(r => String(r.vimeo_video_id)));
    const toInsert = allVideos.filter(v => !existingSet.has(String(v.video_id)));

    console.log(`[BACKFILL] Déjà en DB: ${allVideos.length - toInsert.length}, À ajouter: ${toInsert.length}`);

    if (toInsert.length === 0) {
      return res.status(200).json({
        pages_fetched: pageCount,
        videos_found_vimeo: allVideos.length,
        videos_already_in_db: allVideos.length,
        videos_added: 0,
        message: 'Tous les replays sont déjà en DB'
      });
    }

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
      console.error('[BACKFILL] insert error:', insErr);
      return res.status(500).json({ error: 'DB insert error', detail: insErr.message });
    }

    console.log(`[BACKFILL] ✅ ${toInsert.length} replays ajoutés`);

    return res.status(200).json({
      pages_fetched: pageCount,
      videos_found_vimeo: allVideos.length,
      videos_already_in_db: allVideos.length - toInsert.length,
      videos_added: toInsert.length,
      added_replays: toInsert.map(v => ({
        video_id: v.video_id,
        title: v.title,
        replay_date: v.replay_date
      }))
    });
  } catch (err) {
    console.error('[BACKFILL] error:', err);
    return res.status(500).json({ error: err.message || 'erreur' });
  }
}

function formatVideo(v) {
  const m = String(v.link || '').match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  const title = v.name || '';
  const parsedDate = parseDateFromTitle(title);
  return {
    video_id: m[1],
    hash: m[2] || null,
    title,
    duration: v.duration ?? null,
    thumbnail: pickLargestThumbnail(v.pictures?.sizes),
    replay_date: parsedDate || toParisDate(v.created_time)
  };
}

function pickLargestThumbnail(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const largest = sizes.reduce((a, b) => (b.width > a.width ? b : a));
  return largest.link || null;
}

function toParisDate(isoDateTime) {
  const d = isoDateTime ? new Date(isoDateTime) : new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}
