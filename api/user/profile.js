// ========================================
// POST /api/user/profile?action=<action>
// Header : Authorization: Bearer <supabase JWT>
//
//   ?action=check-and-release   body { new_email }
//     → Valide le nouvel email + vérifie l'unicité + LIBÈRE un éventuel détenteur mort
//       (compte non-actif ou auth-only). NE CHANGE PAS l'email du compte courant.
//       Le changement réel se fait CÔTÉ CLIENT via sbClient.auth.updateUser({ email }),
//       qui déclenche la confirmation par lien (sécurisé). Le service role appliquerait
//       le changement SANS confirmation → trou de sécurité : on ne l'utilise plus pour ça.
//       Après confirmation, un trigger DB synchronise public.users.email (cf migration).
//
// Le resend est géré nativement côté client (sbClient.auth.resend({ type: 'email_change' })).
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
    // await OBLIGATOIRE : sans lui, le rejet du sous-handler échappe à ce try/catch
    // et un httpError(409/400) ressort en 500 générique.
    if (action === 'check-and-release') return await handleCheckAndRelease(req, res, user_id, currentEmail);
    return res.status(400).json({ error: 'action inconnue' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[USER-PROFILE] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}

// --- Valide + vérifie l'unicité + libère un détenteur mort. NE TOUCHE PAS le compte courant. ---
async function handleCheckAndRelease(req, res, user_id, currentEmail) {
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

  // --- Détection du détenteur dans les DEUX stores (case-insensitive) ---
  // public.users : ilike (ex. ANTRADE@… vs antrade@…)
  const { data: pubClash, error: clashErr } = await sb
    .from('users').select('uuid, status').ilike('email', normalizedEmail).neq('uuid', user_id).limit(1).maybeSingle();
  if (clashErr) throw httpError(500, 'Erreur de vérification (unicité).');

  // auth.users : via fonction SECURITY DEFINER (auth non exposé à PostgREST).
  let authClashId = null;
  const { data: rpcId, error: rpcErr } = await sb.rpc('find_auth_user_id_by_email', { p_email: normalizedEmail });
  if (rpcErr) { console.error('[USER-PROFILE] rpc find_auth_user_id_by_email:', rpcErr); throw httpError(500, 'Erreur de vérification (auth).'); }
  if (rpcId && rpcId !== user_id) authClashId = rpcId;

  const holderUuid = (pubClash && pubClash.uuid) || authClashId || null;
  if (!holderUuid) {
    // Email totalement libre → le client peut lancer updateUser().
    return res.status(200).json({ ok: true, cleared: false });
  }

  const hasPublicRow = !!pubClash;
  const hasAuthRow = authClashId === holderUuid;
  const activeStatuses = ['active', 'approved'];

  // Compte ACTIF → refus. Un compte auth-only (pas de row public) n'est jamais actif → libérable.
  if (hasPublicRow && activeStatuses.includes(pubClash.status)) {
    throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte actif.');
  }

  // LIBÉRATION (non-actif OU auth-only) → placeholder unique dans chaque store présent.
  // NB : ici on utilise le service role pour muter un compte MORT (pas le compte courant),
  // email_confirm:true pour appliquer immédiatement. C'est intentionnel et sans risque.
  const placeholder = `revoked-${holderUuid}@deleted.trader360.local`;

  if (hasPublicRow) {
    const { error: freePublicErr } = await sb.from('users').update({ email: placeholder }).eq('uuid', holderUuid);
    if (freePublicErr) {
      console.error('[USER-PROFILE] libération public.users échouée:', freePublicErr);
      throw httpError(500, 'Impossible de libérer l\'ancien email (public.users). Contacte le support.');
    }
  }

  if (hasAuthRow) {
    const { error: freeAuthErr } = await sb.auth.admin.updateUserById(holderUuid, { email: placeholder, email_confirm: true });
    if (freeAuthErr) {
      if (hasPublicRow) await sb.from('users').update({ email: normalizedEmail }).eq('uuid', holderUuid); // rollback public
      console.error('[USER-PROFILE] libération auth.users échouée:', freeAuthErr);
      throw httpError(500, 'Impossible de libérer l\'ancien email (auth.users). Contacte le support.');
    }
  }

  const holderStatus = hasPublicRow ? pubClash.status : 'auth-only';
  if (!hasPublicRow) {
    console.log(`[USER-PROFILE] libéré email auth-only ${normalizedEmail} de ${holderUuid} (aucun profil public) pour réattribution à ${user_id}`);
  } else {
    console.log(`[USER-PROFILE] libéré email ${normalizedEmail} de compte non-actif ${holderUuid} (public${hasAuthRow ? ' + auth' : ' seul'}) pour réattribution à ${user_id}`);
  }

  return res.status(200).json({ ok: true, cleared: true, holder_status: holderStatus });
}
