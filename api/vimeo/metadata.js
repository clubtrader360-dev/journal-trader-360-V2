// ========================================
// GET /api/vimeo/metadata?video_id=XXXXX[&hash=YYYY]
// Header : Authorization: Bearer <supabase JWT> (coach uniquement)
//
// Lit les métadonnées d'une vidéo Vimeo via le token serveur.
// Le token Vimeo n'est JAMAIS envoyé au client.
// ========================================

import { requireCoach, httpError } from './_lib/coach-auth.js';

const VIMEO_API    = 'https://api.vimeo.com';
const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    await requireCoach(req);

    const videoId = String(req.query?.video_id || '').trim();
    const hash    = String(req.query?.hash || '').trim();
    if (!/^\d+$/.test(videoId)) {
      throw httpError(400, 'video_id invalide');
    }
    if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) {
      throw httpError(400, 'hash invalide');
    }

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      console.error('[VIMEO] VIMEO_ACCESS_TOKEN manquante (env Vercel)');
      throw httpError(500, 'configuration serveur incomplète');
    }

    const path = hash ? `/videos/${videoId}:${hash}` : `/videos/${videoId}`;
    // DEBUG temporaire : trace ce qu'on envoie réellement à Vimeo.
    console.log('[VIMEO debug] metadata request:', { videoId, hash: hash || null, path });

    const vimeoRes = await fetch(`${VIMEO_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: VIMEO_ACCEPT
      }
    });

    if (!vimeoRes.ok) {
      // DEBUG temporaire : log le corps de réponse Vimeo pour comprendre la raison.
      const body = await vimeoRes.text().catch(() => '');
      console.error('[VIMEO debug] metadata error', vimeoRes.status, 'path:', path, 'body:', body);
      if (vimeoRes.status === 404) throw httpError(404, 'vidéo introuvable');
      throw httpError(502, 'erreur Vimeo');
    }

    const v = await vimeoRes.json();

    return res.status(200).json({
      video_id:  videoId,
      hash:      hash || null,
      title:     v.name || '',
      duration:  v.duration ?? null,
      thumbnail: pickLargestThumbnail(v.pictures?.sizes)
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[VIMEO metadata] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

function pickLargestThumbnail(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const largest = sizes.reduce((a, b) => (b.width > a.width ? b : a));
  return largest.link || null;
}
