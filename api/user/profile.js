// ========================================
// POST /api/user/profile?action=<action>
// Header : Authorization: Bearer <supabase JWT>
//
// Routeur consolidé des actions "profil élève" (1 seule Serverless Function → quota Hobby 12/12) :
//   ?action=update-email        body { new_email }  → change users.email + auth.users.email (confirmation)
//   ?action=resend-confirmation                     → renvoie le lien de confirmation en attente
//
// Auth commune : requireUser (jamais un autre compte que l'authentifié).
// ========================================

import { requireUser, getServiceClient, readJson, httpError } from '../tradovate/_lib/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const { user_id, email: currentEmail } = await requireUser(req);
    const action = String(req.query?.action || '').trim();
    if (action === 'update-email') return handleUpdateEmail(req, res, user_id, currentEmail);
    if (action === 'resend-confirmation') return handleResendConfirmation(req, res, user_id);
    return res.status(400).json({ error: 'action inconnue' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[USER-PROFILE] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

// --- Changement d'email : users.email (immédiat) + auth.users.email (confirmation), rollback si échec. ---
async function handleUpdateEmail(req, res, user_id, currentEmail) {
  const body = await readJson(req);
  const rawEmail = body?.new_email;
  if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
    throw httpError(400, 'Adresse email requise.');
  }
  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw httpError(400, 'Adresse email invalide.');
  }
  if (currentEmail && normalizedEmail === String(currentEmail).trim().toLowerCase()) {
    throw httpError(400, 'Cette adresse est déjà ton email actuel.');
  }

  const sb = getServiceClient();

  // Unicité : refuse si un AUTRE compte utilise déjà cette adresse.
  const { data: clash, error: clashErr } = await sb
    .from('users').select('uuid').eq('email', normalizedEmail).neq('uuid', user_id).limit(1).maybeSingle();
  if (clashErr) throw httpError(500, 'Erreur de vérification (unicité).');
  if (clash) throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte.');

  // UPDATE public.users.email (scopé à l'utilisateur authentifié).
  const { error: updErr } = await sb.from('users').update({ email: normalizedEmail }).eq('uuid', user_id);
  if (updErr) {
    if (updErr.code === '23505') throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte.');
    throw httpError(500, 'Impossible de mettre à jour le profil.');
  }

  // Supabase Auth : déclenche l'email de confirmation vers le nouvel email (PAS email_confirm:true).
  const { error: authErr } = await sb.auth.admin.updateUserById(user_id, { email: normalizedEmail });
  if (authErr) {
    // Rollback pour éviter toute désync.
    await sb.from('users').update({ email: currentEmail }).eq('uuid', user_id);
    console.error('[USER-PROFILE] update-email auth failed, rolled back users.email:', authErr.message);
    return res.status(500).json({ error: 'Impossible d\'envoyer l\'email de confirmation. Réessaie plus tard.' });
  }

  return res.status(200).json({
    ok: true,
    email_pending: normalizedEmail,
    message: 'Un email de confirmation a été envoyé à cette adresse. Clique dessus pour finaliser le changement.',
  });
}

// --- Renvoi du lien de confirmation d'un changement d'email EN ATTENTE. ---
async function handleResendConfirmation(req, res, user_id) {
  const sb = getServiceClient();
  const { data, error } = await sb.auth.admin.getUserById(user_id);
  if (error || !data?.user) throw httpError(500, 'Utilisateur auth introuvable.');

  const u = data.user;
  const pendingEmail = u.new_email || u.user_metadata?.email_change || u.user_metadata?.pending_email || null;
  if (!pendingEmail) throw httpError(400, 'Aucun changement d\'email en attente.');

  const { error: updErr } = await sb.auth.admin.updateUserById(user_id, { email: pendingEmail });
  if (updErr) throw httpError(500, 'Impossible de renvoyer l\'email de confirmation. Réessaie plus tard.');

  return res.status(200).json({
    ok: true,
    message: `Un nouveau lien de confirmation a été envoyé à ${pendingEmail}.`,
  });
}
