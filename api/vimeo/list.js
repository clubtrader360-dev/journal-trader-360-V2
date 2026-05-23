// ========================================
// GET /api/vimeo/list?page=N
// Header : Authorization: Bearer <supabase JWT> (coach uniquement)
//
// Liste les vidéos du dossier Vimeo REPLAY_FOLDER_NAME (50 par page).
// Le token Vimeo n'est JAMAIS envoyé au client.
// ========================================

import { requireCoach, httpError } from './_lib/coach-auth.js';

const VIMEO_API    = 'https://api.vimeo.com';
const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';
const FIELDS       = 'uri,name,duration,pictures.sizes,privacy,link';

// Nom du dossier Vimeo (project) dont on liste les vidéos. À modifier ici
// si renommé côté Vimeo. Comparaison insensible à la casse + trim.
const REPLAY_FOLDER_NAME = 'REPLAY LIVE';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    await requireCoach(req);

    const page = Math.max(1, parseInt(req.query?.page, 10) || 1);

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      console.error('[VIMEO] VIMEO_ACCESS_TOKEN manquante (env Vercel)');
      throw httpError(500, 'configuration serveur incomplète');
    }

    const projectId = await findReplayFolderId(token);
    if (!projectId) {
      throw httpError(404, `dossier ${REPLAY_FOLDER_NAME} introuvable sur le compte Vimeo`);
    }

    const url = `${VIMEO_API}/me/projects/${projectId}/videos`
              + `?per_page=50&page=${page}&fields=${encodeURIComponent(FIELDS)}`;
    const vimeoRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: VIMEO_ACCEPT
      }
    });

    if (!vimeoRes.ok) {
      console.error('[VIMEO] list error:', vimeoRes.status);
      throw httpError(502, 'erreur Vimeo');
    }

    const payload = await vimeoRes.json();
    const videos = (payload.data || []).map(formatVideo).filter(Boolean);

    return res.status(200).json({
      videos,
      has_next_page: Boolean(payload.paging?.next)
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[VIMEO list] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

// Cherche le projet/dossier Vimeo dont le nom matche REPLAY_FOLDER_NAME
// (insensible à la casse + trim). Itère sur toutes les pages — défensif
// pour les comptes qui dépassent 100 dossiers (rare mais possible).
async function findReplayFolderId(token) {
  const target = REPLAY_FOLDER_NAME.trim().toLowerCase();
  let page = 1;
  while (true) {
    const url = `${VIMEO_API}/me/projects?per_page=100&page=${page}&fields=uri,name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT }
    });
    if (!res.ok) {
      console.error('[VIMEO] projects fetch error:', res.status);
      throw httpError(502, 'erreur Vimeo (folders)');
    }
    const payload = await res.json();
    const found = (payload.data || []).find(p =>
      String(p.name || '').trim().toLowerCase() === target
    );
    if (found) {
      const m = String(found.uri || '').match(/\/projects\/(\d+)/);
      if (m) return m[1];
    }
    if (!payload.paging?.next) return null;
    page++;
  }
}

function formatVideo(v) {
  // v.link : https://vimeo.com/123456789  ou  https://vimeo.com/123456789/abc123def
  // Le hash n'est PAS dans v.uri (qui ne contient que l'ID numérique).
  const m = String(v.link || '').match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  return {
    video_id:  m[1],
    hash:      m[2] || null,
    title:     v.name || '',
    duration:  v.duration ?? null,
    thumbnail: pickLargestThumbnail(v.pictures?.sizes)
  };
}

function pickLargestThumbnail(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const largest = sizes.reduce((a, b) => (b.width > a.width ? b : a));
  return largest.link || null;
}
