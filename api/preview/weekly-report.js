// ========================================
// API ROUTE : PREVIEW du rapport hebdomadaire (#19)
// Route : /api/preview/weekly-report?userId=<uuid>&token=<CRON_SECRET>
// Génère le HTML EXACTEMENT comme le cron mais le RETOURNE (pas d'envoi mail).
// Sécurisé par CRON_SECRET (Bearer ou ?token=) — sinon n'importe qui verrait n'importe quel rapport.
// ========================================

import { createServiceClient, getWeekBounds, buildUserReport } from '../cron/weekly-report.js';

export default async function handler(req, res) {
  // En preview, les déploiements Vercel sont déjà protégés par "Vercel Authentication"
  // (seul un compte Vercel autorisé y accède) → on relâche le check token UNIQUEMENT en preview.
  // En production, le token reste obligatoire.
  const isPreview = process.env.VERCEL_ENV !== 'production';
  const queryToken = req.query.token;
  const authHeader = req.headers.authorization;
  if (!isPreview) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && queryToken !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId (uuid)' });

  try {
    const supabase = createServiceClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, uuid, email, name, role, status')
      .eq('uuid', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!user) return res.status(404).json({ error: 'User not found for this uuid' });

    const period = getWeekBounds();
    // preview navigateur → radar en data URI (le cid: ne s'affiche que dans un client mail)
    const report = await buildUserReport(supabase, user, period, { preview: true });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (report.skip) {
      return res.status(200).send(`<!DOCTYPE html><html lang="fr"><body style="background:#000B25;color:#f4e4c1;font-family:sans-serif;padding:60px;text-align:center;">
        <h1 style="color:#d4af37;">Aperçu rapport hebdo</h1>
        <p>Élève : <strong>${user.name || user.email}</strong></p>
        <p>Cet élève serait <strong>SKIPPÉ</strong> cette semaine — raison : <em>${report.skip}</em></p>
        <p style="color:#b9a37e;">(${period.startDateStr} → ${period.endDateStr})</p>
      </body></html>`);
    }
    return res.status(200).send(report.html);
  } catch (e) {
    console.error('[WEEKLY-PREVIEW] ❌', e);
    return res.status(500).json({ error: e.message });
  }
}
