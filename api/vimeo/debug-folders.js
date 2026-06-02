// ========================================
// GET /api/vimeo/debug-folders
// Header : Authorization: Bearer <supabase JWT> (coach uniquement)
//
// Endpoint TEMPORAIRE de diagnostic pour comprendre pourquoi
// le cron replays-sync échoue avec "Dossier REPLAY LIVE introuvable".
//
// Liste TOUS les dossiers visibles par le token Vimeo (3 sources :
// me/projects, me/folders, et /teams/*/folders) avec leur source,
// nom et owner. Permet de voir si "REPLAY LIVE" est présent ou non.
//
// À SUPPRIMER une fois le problème diagnostiqué.
// ========================================

import { requireCoach, httpError } from './_lib/coach-auth.js';
import { VIMEO_API, VIMEO_ACCEPT, REPLAY_FOLDER_NAME } from './_lib/folder.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    await requireCoach(req);

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      throw httpError(500, 'VIMEO_ACCESS_TOKEN manquante');
    }

    const headers = { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT };
    const result = {
      target_name: REPLAY_FOLDER_NAME,
      target_lowercase: REPLAY_FOLDER_NAME.trim().toLowerCase(),
      sources: {},
      all_folders: [],
      match_found: null,
      total_folders: 0,
      token_test: null
    };

    // Étape 0 : test du token via /me (vérifie auth basique)
    try {
      const meRes = await fetch(`${VIMEO_API}/me?fields=uri,name`, { headers });
      result.token_test = {
        status: meRes.status,
        ok: meRes.ok,
        body: meRes.ok ? await meRes.json() : await meRes.text()
      };
    } catch (e) {
      result.token_test = { error: e.message };
    }

    // Source 1 : /me/projects (legacy)
    result.sources.me_projects = await fetchFolders(
      `${VIMEO_API}/me/projects?per_page=100&fields=uri,name,user.name,user.uri`,
      headers,
      'me/projects',
      result.all_folders
    );

    // Source 2 : /me/folders (moderne)
    result.sources.me_folders = await fetchFolders(
      `${VIMEO_API}/me/folders?per_page=100&fields=uri,name,user.name,user.uri`,
      headers,
      'me/folders',
      result.all_folders
    );

    // Source 3 : /teams/*/folders (pour chaque team)
    result.sources.teams = { teams_found: 0, folders_by_team: {} };
    try {
      const teamsRes = await fetch(
        `${VIMEO_API}/me/teams?per_page=100&fields=uri,name`,
        { headers }
      );
      if (teamsRes.ok) {
        const teamsPayload = await teamsRes.json();
        const teams = teamsPayload.data || [];
        result.sources.teams.teams_found = teams.length;
        result.sources.teams.teams_list = teams.map(t => ({ uri: t.uri, name: t.name }));

        for (const team of teams) {
          const teamId = String(team.uri || '').match(/\/teams\/([^/]+)/)?.[1];
          if (!teamId) continue;
          const teamRes = await fetchFolders(
            `${VIMEO_API}/teams/${teamId}/folders?per_page=100&fields=uri,name,user.name,user.uri`,
            headers,
            `teams/${teamId}/folders`,
            result.all_folders
          );
          result.sources.teams.folders_by_team[`${team.name} (${teamId})`] = teamRes;
        }
      } else {
        result.sources.teams.error = `HTTP ${teamsRes.status}`;
      }
    } catch (e) {
      result.sources.teams.error = e.message;
    }

    // Récap : total et match
    result.total_folders = result.all_folders.length;
    result.match_found = result.all_folders.find(f =>
      String(f.name || '').trim().toLowerCase() === result.target_lowercase
    ) || null;

    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[VIMEO debug-folders] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

async function fetchFolders(url, headers, source, accumulator) {
  const result = { source, status: null, count: 0, folders: [], error: null };
  try {
    const res = await fetch(url, { headers });
    result.status = res.status;
    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      return result;
    }
    const payload = await res.json();
    const data = payload.data || [];
    result.count = data.length;
    data.forEach(f => {
      const entry = {
        source,
        uri: f.uri,
        name: f.name,
        owner: f.user?.name || null
      };
      result.folders.push(entry);
      accumulator.push(entry);
    });
  } catch (e) {
    result.error = e.message;
  }
  return result;
}
