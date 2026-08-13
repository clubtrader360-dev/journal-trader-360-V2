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
    // await OBLIGATOIRE : sans lui, le rejet des sous-handlers échappe à ce try/catch
    // et un httpError(409/400) ressort en 500 générique.
    if (action === 'update-email') return await handleUpdateEmail(req, res, user_id, currentEmail);
    if (action === 'resend-confirmation') return await handleResendConfirmation(req, res, user_id);
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

  // --- Détection du détenteur de l'email dans les DEUX stores (case-insensitive) ---
  // La contrainte d'unicité bloquante vit dans auth.users, mais un détenteur peut aussi
  // n'exister que dans public.users, ou dans auth SEUL (compte "auth-only", ex. Emmanuel).
  // public.users : ilike (insensible casse, ex. ANTRADE@… vs antrade@…)
  const { data: pubClash, error: clashErr } = await sb
    .from('users').select('uuid, status').ilike('email', normalizedEmail).neq('uuid', user_id).limit(1).maybeSingle();
  if (clashErr) throw httpError(500, 'Erreur de vérification (unicité).');

  // auth.users : via fonction SECURITY DEFINER (auth non exposé à PostgREST).
  let authClashId = null;
  const { data: rpcId, error: rpcErr } = await sb.rpc('find_auth_user_id_by_email', { p_email: normalizedEmail });
  if (rpcErr) { console.error('[USER-PROFILE] rpc find_auth_user_id_by_email:', rpcErr); throw httpError(500, 'Erreur de vérification (auth).'); }
  if (rpcId && rpcId !== user_id) authClashId = rpcId;

  // Fusion en un seul détenteur (le même uuid peut venir des 2 sources).
  const holderUuid = (pubClash && pubClash.uuid) || authClashId || null;
  if (holderUuid) {
    const hasPublicRow = !!pubClash;              // ligne public.users présente ?
    const hasAuthRow = authClashId === holderUuid; // ligne auth.users présente ?
    const activeStatuses = ['active', 'approved'];

    // Compte ACTIF (statut public actif) → refus. Un compte auth-only (pas de row public)
    // n'est jamais "actif" au sens de la formation → éligible à la libération.
    if (hasPublicRow && activeStatuses.includes(pubClash.status)) {
      throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte actif.');
    }

    // LIBÉRATION (compte non-actif OU auth-only) → placeholder unique dans chaque store présent.
    const placeholder = `revoked-${holderUuid}@deleted.trader360.local`;

    if (hasPublicRow) {
      const { error: freePublicErr } = await sb.from('users').update({ email: placeholder }).eq('uuid', holderUuid);
      if (freePublicErr) {
        console.error('[USER-PROFILE] libération public.users échouée:', freePublicErr);
        throw httpError(500, 'Impossible de libérer l\'ancien email (public.users). Contacte le support.');
      }
    }

    if (hasAuthRow) {
      // email_confirm:true → applique immédiatement (sinon le placeholder reste pending et l'email n'est jamais libéré).
      const { error: freeAuthErr } = await sb.auth.admin.updateUserById(holderUuid, { email: placeholder, email_confirm: true });
      if (freeAuthErr) {
        if (hasPublicRow) await sb.from('users').update({ email: normalizedEmail }).eq('uuid', holderUuid); // rollback public
        console.error('[USER-PROFILE] libération auth.users échouée:', freeAuthErr);
        throw httpError(500, 'Impossible de libérer l\'ancien email (auth.users). Contacte le support.');
      }
    }

    if (!hasPublicRow) {
      console.log(`[USER-PROFILE] libéré email auth-only ${normalizedEmail} de ${holderUuid} (aucun profil public) pour réattribution à ${user_id}`);
    } else {
      console.log(`[USER-PROFILE] libéré email ${normalizedEmail} de compte non-actif ${holderUuid} (public${hasAuthRow ? ' + auth' : ' seul'}) pour réattribution à ${user_id}`);
    }
  }

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
