// ========================================
// GET /api/vimeo/list?page=N
// Header : Authorization: Bearer <supabase JWT> (coach uniquement)
//
// Liste les vidéos du dossier Vimeo REPLAY_FOLDER_NAME (50 par page).
// Le token Vimeo n'est JAMAIS envoyé au client.
//
// Note : le dossier peut être possédé par le user du token OU partagé via
// une team. On collecte les dossiers depuis 3 sources :
//   - /me/projects        (legacy : dossiers possédés)
//   - /me/folders         (nouveau nom — même chose ou alias)
//   - /teams/{id}/folders (pour chaque team listée dans /me/teams)
// puis on cherche par nom (insensible casse + trim). L'URI du dossier
// trouvé sert directement de base pour `${uri}/videos`.
// ========================================

import { requireCoach, httpError } from './_lib/coach-auth.js';

const VIMEO_API    = 'https://api.vimeo.com';
const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';
const FIELDS       = 'uri,name,duration,pictures.sizes,privacy,link';

// Nom du dossier Vimeo dont on liste les vidéos. À modifier ici si renommé
// côté Vimeo. Comparaison insensible à la casse + trim.
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

    const folder = await findReplayFolder(token);
    if (!folder) {
      throw httpError(404, `dossier ${REPLAY_FOLDER_NAME} introuvable (voir logs serveur pour la liste exhaustive des dossiers accessibles)`);
    }

    // L'URI Vimeo est rootée (/teams/abc/folders/xyz, /users/123/projects/456, …).
    // `${uri}/videos` fonctionne uniformément quel que soit le type de dossier.
    const url = `${VIMEO_API}${folder.uri}/videos`
              + `?per_page=50&page=${page}&fields=${encodeURIComponent(FIELDS)}`;
    console.log('[VIMEO debug] list videos URL:', url);

    const vimeoRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT }
    });

    if (!vimeoRes.ok) {
      const body = await vimeoRes.text().catch(() => '');
      console.error('[VIMEO debug] list videos error', vimeoRes.status, 'body:', body);
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

// ========================================
// Découverte du dossier REPLAY LIVE
// ========================================
// Agrège les dossiers de 3 sources, log tout, match par nom.
// Logs temporaires marqués [VIMEO debug] — à retirer une fois la source
// correcte du dossier identifiée.
async function findReplayFolder(token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT };
  const target  = REPLAY_FOLDER_NAME.trim().toLowerCase();

  const allFolders = [];

  // Source 1 : dossiers possédés (legacy "projects")
  await collectFolders(`${VIMEO_API}/me/projects?per_page=100&fields=uri,name,user.name,user.uri`,
                        headers, 'me/projects', allFolders);

  // Source 2 : dossiers de la library (terme moderne — peut être un alias)
  await collectFolders(`${VIMEO_API}/me/folders?per_page=100&fields=uri,name,user.name,user.uri`,
                        headers, 'me/folders', allFolders);

  // Source 3 : dossiers via les teams auxquelles l'utilisateur appartient
  try {
    let teamsPage = 1;
    while (true) {
      const res = await fetch(`${VIMEO_API}/me/teams?per_page=100&page=${teamsPage}&fields=uri,name`,
                              { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn('[VIMEO debug] /me/teams HTTP', res.status, 'body:', body);
        break;
      }
      const payload = await res.json();
      const teams = payload.data || [];
      console.log('[VIMEO debug] teams page', teamsPage, ':',
                  teams.map(t => ({ uri: t.uri, name: t.name })));
      for (const team of teams) {
        const teamId = String(team.uri || '').match(/\/teams\/([^/]+)/)?.[1];
        if (!teamId) continue;
        await collectFolders(
          `${VIMEO_API}/teams/${teamId}/folders?per_page=100&fields=uri,name,user.name,user.uri`,
          headers, `teams/${teamId}/folders (team: ${team.name})`, allFolders
        );
      }
      if (!payload.paging?.next) break;
      teamsPage++;
    }
  } catch (e) {
    console.warn('[VIMEO debug] teams iteration error:', e?.message || e);
  }

  // Dump exhaustif des dossiers accessibles avec ce token.
  console.log('[VIMEO debug] tous les dossiers accessibles :',
              JSON.stringify(allFolders, null, 2));

  return allFolders.find(f =>
    String(f.name || '').trim().toLowerCase() === target
  ) || null;
}

// Pagine un endpoint de listing de dossiers et pousse chaque entrée
// (avec source, uri, name, owner) dans `accumulator`.
async function collectFolders(initialUrl, headers, source, accumulator) {
  try {
    let nextUrl = initialUrl;
    while (nextUrl) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[VIMEO debug] ${source} HTTP ${res.status} body: ${body}`);
        return;
      }
      const payload = await res.json();
      (payload.data || []).forEach(f => {
        accumulator.push({
          source,
          uri:   f.uri,
          name:  f.name,
          owner: f.user?.name || null
        });
      });
      const next = payload.paging?.next;
      nextUrl = next
        ? (next.startsWith('http') ? next : `${VIMEO_API}${next}`)
        : null;
    }
  } catch (e) {
    console.warn(`[VIMEO debug] ${source} error:`, e?.message || e);
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
