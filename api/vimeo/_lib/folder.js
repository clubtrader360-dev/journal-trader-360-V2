// ========================================
// VIMEO — lookup du dossier REPLAY LIVE
// ========================================
// Partagé entre api/vimeo/list.js (parcours coach) et api/cron/replays-sync.js
// (sync automatique). Cherche le dossier dans 3 sources : /me/projects,
// /me/folders et /teams/{id}/folders (pour chaque team) — couvre les
// dossiers possédés ET partagés via team.
// ========================================

export const VIMEO_API          = 'https://api.vimeo.com';
export const VIMEO_ACCEPT       = 'application/vnd.vimeo.*+json;version=3.4';
export const REPLAY_FOLDER_NAME = 'REPLAY LIVE';

// Retourne le 1er dossier dont le nom matche REPLAY_FOLDER_NAME
// (insensible casse + trim) ou null si introuvable.
export async function findReplayFolder(token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: VIMEO_ACCEPT };
  const target  = REPLAY_FOLDER_NAME.trim().toLowerCase();

  const allFolders = [];

  // Source 1 : dossiers possédés (legacy "projects")
  await collectFolders(`${VIMEO_API}/me/projects?per_page=100&fields=uri,name,user.name,user.uri`,
                        headers, 'me/projects', allFolders);

  // Source 2 : dossiers de la library (terme moderne)
  await collectFolders(`${VIMEO_API}/me/folders?per_page=100&fields=uri,name,user.name,user.uri`,
                        headers, 'me/folders', allFolders);

  // Source 3 : dossiers via les teams auxquelles l'utilisateur appartient
  try {
    let teamsPage = 1;
    while (true) {
      const res = await fetch(`${VIMEO_API}/me/teams?per_page=100&page=${teamsPage}&fields=uri,name`,
                              { headers });
      if (!res.ok) break;
      const payload = await res.json();
      const teams = payload.data || [];
      for (const team of teams) {
        const teamId = String(team.uri || '').match(/\/teams\/([^/]+)/)?.[1];
        if (!teamId) continue;
        await collectFolders(
          `${VIMEO_API}/teams/${teamId}/folders?per_page=100&fields=uri,name,user.name,user.uri`,
          headers, `teams/${teamId}/folders`, allFolders
        );
      }
      if (!payload.paging?.next) break;
      teamsPage++;
    }
  } catch (e) {
    console.warn('[VIMEO] teams iteration error:', e?.message || e);
  }

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
      if (!res.ok) return;
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
    console.warn(`[VIMEO] ${source} error:`, e?.message || e);
  }
}
