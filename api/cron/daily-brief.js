// ========================================
// API ROUTE : ENVOI QUOTIDIEN DU BRIEF MARCHÉ (#brief)
// Route : /api/cron/daily-brief
// Déclenché par la scheduled task Cowork (lun-ven ~7h Paris, après génération du PDF),
// via HTTP POST + Bearer CRON_SECRET (même mécanisme que weekly-report).
// Envoie le PDF générique du jour aux membres ACTIFS (journal rempli < 3 jours glissants),
// avec un email personnalisé au prénom. PDF en pièce jointe (Resend REST).
// ========================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Sécurité de test : si DAILY_BRIEF_DRY_RUN = '1', on sélectionne mais on N'ENVOIE PAS.
const DRY_RUN = process.env.DAILY_BRIEF_DRY_RUN === '1';

const ACTIVE_WINDOW_DAYS = 3; // fenêtre GLISSANTE : actif si journal rempli < 3 jours

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---- Prénom à partir du champ `name` (nom complet) ----
export function firstNameOf(name) {
  return name && name.trim() ? name.trim().split(/\s+/)[0] : null;
}

// ---- Membres actifs : role=student, status=active, NON en vacation_mode,
//      ET au moins une entrée de journal sur les 3 derniers jours (fenêtre glissante). ----
export async function fetchActiveRecipients(supabase) {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000)
    .toISOString().split('T')[0];

  const { data: users, error } = await supabase
    .from('users')
    .select('id, uuid, email, name, role, status')
    .eq('role', 'student')
    .eq('status', 'active')
    .not('email', 'is', null);
  if (error) throw error;

  const uuids = (users || []).map(u => u.uuid).filter(Boolean);
  if (!uuids.length) return [];

  // Activité journal sur la fenêtre glissante.
  const { data: recent, error: jErr } = await supabase
    .from('journal_entries')
    .select('user_id, entry_date')
    .gte('entry_date', since)
    .in('user_id', uuids);
  if (jErr) throw jErr;
  const activeIds = new Set((recent || []).map(r => r.user_id));

  // Exclusion vacation_mode.
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('user_id, vacation_mode')
    .in('user_id', uuids);
  const vacationIds = new Set((prefs || []).filter(p => p.vacation_mode === true).map(p => p.user_id));

  return (users || []).filter(u => activeIds.has(u.uuid) && !vacationIds.has(u.uuid));
}

// ---- Sujet / corps personnalisés ----
export function emailSubject(firstName, dateLongFr) {
  return firstName
    ? `📈 ${firstName}, ton brief marché du ${dateLongFr}`
    : `📈 Ton brief marché du ${dateLongFr}`;
}

export function emailHtml(firstName) {
  const hi = firstName ? `Bonjour ${firstName},` : 'Bonjour à toi,';
  return `
  <p>${hi}</p>
  <p>Voici ton brief marché pour bien démarrer ta session du jour.</p>
  <ul>
    <li>🧠 Le mindset du jour</li>
    <li>🎯 Tes zones à surveiller sur le SPX (futures ES + CFD)</li>
    <li>📅 L'agenda éco du jour</li>
    <li>⚡ Le contexte de volatilité (VIX)</li>
    <li>📰 La synthèse de l'actualité éco</li>
    <li>✅ Ta checklist pré-séance</li>
  </ul>
  <p>👉 Le PDF est en pièce jointe.</p>
  <p>Bon trade et discipline avant tout.<br/>— L'équipe TRADER 360</p>
  <p style="font-size:12px;color:#666;">📍 Ton plan de trading précis du jour arrive sur le Discord comme d'habitude.</p>`;
}

// ---- Envoi via Resend REST (même approche que weekly-report) + pièce jointe ----
export async function sendBriefEmail({ to, subject, html, pdfBase64, filename }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Trader 360 <noreply@mail.journaltrader360.fr>',
        to: [to],
        subject,
        html,
        attachments: [{ filename, content: pdfBase64 }], // content = base64
      }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========================================
// HANDLER (déclenché par la scheduled task Cowork via Bearer CRON_SECRET)
// Body JSON : { date, date_long_fr, pdf_base64, test_emails?: string[] }
//  - test_emails présent → envoi UNIQUEMENT à ces adresses (rodage)
//  - test_emails absent   → envoi à tous les membres actifs (production)
// ========================================
export default async function handler(req, res) {
  console.log('[DAILY-BRIEF] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
  if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  const { date, date_long_fr, pdf_base64, test_emails } = req.body || {};
  if (!date || !date_long_fr || !pdf_base64) {
    return res.status(400).json({ error: 'Champs requis : date, date_long_fr, pdf_base64' });
  }
  const filename = `Brief_Marche_${date}.pdf`;
  const t0 = Date.now();

  try {
    const supabase = createServiceClient();

    // Sélection des destinataires
    let recipients;
    if (Array.isArray(test_emails) && test_emails.length) {
      const { data: u } = await supabase
        .from('users').select('uuid, email, name').in('email', test_emails);
      recipients = u || test_emails.map(e => ({ email: e, name: null }));
    } else {
      recipients = await fetchActiveRecipients(supabase);
    }
    console.log(`[DAILY-BRIEF] 👥 ${recipients.length} destinataire(s)`);

    const results = [];
    let sent = 0;
    for (const u of recipients) {
      const fn = firstNameOf(u.name);
      if (DRY_RUN) { results.push({ email: u.email, status: 'dry_run' }); continue; }
      const r = await sendBriefEmail({
        to: u.email,
        subject: emailSubject(fn, date_long_fr),
        html: emailHtml(fn),
        pdfBase64: pdf_base64,
        filename,
      });
      if (r.success) { sent++; results.push({ email: u.email, status: 'sent', id: r.id }); }
      else { results.push({ email: u.email, status: 'error', error: r.error }); }
      await new Promise(r => setTimeout(r, 120)); // throttle anti rate-limit
    }

    console.log('[DAILY-BRIEF] ========== DONE ==========', `${sent} envoyé(s)`);
    return res.status(200).json({
      date,
      mode: (Array.isArray(test_emails) && test_emails.length) ? 'test' : 'production',
      dry_run: DRY_RUN,
      destinataires: recipients.length,
      sent,
      results,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    console.error('[DAILY-BRIEF] ❌', e);
    return res.status(500).json({ error: e.message });
  }
}
