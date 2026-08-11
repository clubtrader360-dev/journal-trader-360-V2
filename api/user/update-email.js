// ========================================
// POST /api/user/update-email
// Header : Authorization: Bearer <supabase JWT>
// Body   : { new_email: string }
//
// Change l'email de réception des rapports de l'élève AUTHENTIFIÉ uniquement.
// Double écriture : public.users.email (immédiat) + auth.users.email (via Supabase
// Auth admin, qui envoie un lien de confirmation au NOUVEL email). Tant que l'élève
// n'a pas cliqué, auth garde l'ancien email → l'ancienne adresse continue de servir.
//
// Sécurité : jamais un autre user que l'authentifié (uuid = auth.uid). Unicité vérifiée.
// Rollback de users.email si l'appel Supabase Auth échoue (pas de désync).
// ========================================

import { requireUser, getServiceClient, readJson, httpError } from '../tradovate/_lib/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // 1. Auth : élève actif seulement.
    const { user_id, email: currentEmail } = await requireUser(req);

    // 2. Body + validation du nouvel email.
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

    // 3. Unicité : refuse si un AUTRE compte utilise déjà cette adresse.
    const { data: clash, error: clashErr } = await sb
      .from('users')
      .select('uuid')
      .eq('email', normalizedEmail)
      .neq('uuid', user_id)
      .limit(1)
      .maybeSingle();
    if (clashErr) throw httpError(500, 'Erreur de vérification (unicité).');
    if (clash) throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte.');

    // 4. UPDATE public.users.email (scopé à l'utilisateur authentifié).
    const { error: updErr } = await sb
      .from('users')
      .update({ email: normalizedEmail })
      .eq('uuid', user_id);
    if (updErr) {
      // 23505 = unique_violation (contrainte unique sur users.email).
      if (updErr.code === '23505') throw httpError(409, 'Cette adresse est déjà utilisée par un autre compte.');
      throw httpError(500, 'Impossible de mettre à jour le profil.');
    }

    // 5. Supabase Auth : déclenche l'email de confirmation vers le nouvel email.
    //    (PAS email_confirm:true → on veut le flow de vérification.)
    const { error: authErr } = await sb.auth.admin.updateUserById(user_id, { email: normalizedEmail });
    if (authErr) {
      // Rollback de public.users pour éviter toute désync.
      await sb.from('users').update({ email: currentEmail }).eq('uuid', user_id);
      console.error('[UPDATE-EMAIL] auth update failed, rolled back users.email:', authErr.message);
      return res.status(500).json({ error: 'Impossible d\'envoyer l\'email de confirmation. Réessaie plus tard.' });
    }

    return res.status(200).json({
      ok: true,
      email_pending: normalizedEmail,
      message: 'Un email de confirmation a été envoyé à cette adresse. Clique dessus pour finaliser le changement.',
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[UPDATE-EMAIL] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
