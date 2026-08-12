// ========================================
// POST /api/user/resend-email-confirmation
// Header : Authorization: Bearer <supabase JWT>
//
// Re-déclenche l'envoi du lien de confirmation d'un changement d'email EN ATTENTE
// pour l'élève authentifié. Ne change rien si aucun changement n'est en cours.
// ========================================

import { requireUser, getServiceClient, httpError } from '../tradovate/_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { user_id } = await requireUser(req);
    const sb = getServiceClient();

    // Récupère l'auth user : un changement en attente est exposé via `new_email` (GoTrue).
    const { data, error } = await sb.auth.admin.getUserById(user_id);
    if (error || !data?.user) throw httpError(500, 'Utilisateur auth introuvable.');

    const u = data.user;
    const pendingEmail =
      u.new_email ||
      u.user_metadata?.email_change ||
      u.user_metadata?.pending_email ||
      null;

    if (!pendingEmail) {
      throw httpError(400, 'Aucun changement d\'email en attente.');
    }

    // Re-déclenche l'envoi (Supabase renvoie le lien de confirmation au nouvel email).
    const { error: updErr } = await sb.auth.admin.updateUserById(user_id, { email: pendingEmail });
    if (updErr) throw httpError(500, 'Impossible de renvoyer l\'email de confirmation. Réessaie plus tard.');

    return res.status(200).json({
      ok: true,
      message: `Un nouveau lien de confirmation a été envoyé à ${pendingEmail}.`,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[RESEND-EMAIL-CONFIRM] error:', err);
    return res.status(status).json({ error: err.message || 'erreur' });
  }
}
