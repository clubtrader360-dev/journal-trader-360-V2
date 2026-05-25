// ========================================
// AUTH BACKEND POUR LES ROUTES VIMEO
// ========================================
// Réutilise getServiceClient/httpError de tradovate/_lib/auth.js.
// Diffère de requireUser() : exige role IN ('coach','admin') ET
// status IN ('active','approved'), pour matcher exactement la
// fonction SQL is_coach() utilisée dans les policies RLS replays.
// ========================================

import { getServiceClient, httpError } from '../../tradovate/_lib/auth.js';

export async function requireCoach(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw httpError(401, 'Bearer token manquant');
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token) throw httpError(401, 'Bearer token vide');

  const sb = getServiceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'token Supabase invalide');
  }

  const { data: appUser, error: appUserErr } = await sb
    .from('users')
    .select('role, status')
    .eq('uuid', data.user.id)
    .single();

  if (appUserErr || !appUser) {
    throw httpError(403, 'utilisateur introuvable');
  }

  const ROLES  = ['coach', 'admin'];
  const STATUS = ['active', 'approved'];
  if (!ROLES.includes(appUser.role) || !STATUS.includes(appUser.status)) {
    throw httpError(403, 'réservé aux coachs');
  }

  return { user_id: data.user.id, email: data.user.email };
}

export { httpError };
