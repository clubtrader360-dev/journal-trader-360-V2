// ========================================
// API ROUTE : ENVOI QUOTIDIEN DU BRIEF MARCHÉ (#91 V2)
// Route : /api/cron/daily-brief
// Déclenché par GitHub Actions (Lun-Ven 6h Paris) : Claude Code CLI génère le brief
// marché en HTML puis POST ce HTML ici. L'endpoint le wrap dans le layout email
// "Bourse à l'Aube" (cohérent avec weekly-report) et l'envoie via Resend.
// Body JSON : { date, date_long_fr, brief_html, only_user_id?, test_emails?: string[] }
//  - test_emails présent  → envoi UNIQUEMENT à ces adresses (rodage)
//  - only_user_id présent → envoi UNIQUEMENT à cet élève éligible (test ciblé)
//  - sinon                → envoi à tous les élèves éligibles (production)
// ========================================

import { createClient } from '@supabase/supabase-js';
import { getBriefRecipients } from '../_lib/tableur-recipients.js';
import { syncList, createCampaign, sendCampaignNow } from '../_lib/brevo-client.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Sécurité de test : si DAILY_BRIEF_DRY_RUN = '1', on sélectionne mais on N'ENVOIE PAS.
const DRY_RUN = process.env.DAILY_BRIEF_DRY_RUN === '1';

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---- Prénom à partir du champ `name` (nom complet) ----
export function firstNameOf(name) {
  return name && name.trim() ? name.trim().split(/\s+/)[0] : null;
}

// ---- Élèves éligibles : role=student, status=active, email non vide, NON en vacation_mode.
//      Mêmes filtres que weekly-report (le brief marché est générique → tous les actifs).
//      Pas de filtre d'activité journal : le contenu ne dépend pas des trades de l'élève. ----
export async function fetchEligibleStudents(supabase) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, uuid, email, name, role, status')
    .eq('role', 'student')
    .eq('status', 'active')
    .not('email', 'is', null);
  if (error) throw error;

  const uuids = (users || []).map(u => u.uuid).filter(Boolean);
  let vacationIds = new Set();
  if (uuids.length) {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, vacation_mode')
      .in('user_id', uuids);
    vacationIds = new Set((prefs || []).filter(p => p.vacation_mode === true).map(p => p.user_id));
  }
  return (users || []).filter(u => u.uuid && !vacationIds.has(u.uuid));
}

// ---- Sujet ----
export function emailSubject(dateLongFr) {
  return `📊 Brief marché — ${dateLongFr}`;
}

// ========================================================================
// DESIGN EMAIL — Bourse à l'Aube (light, table-based, compat clients mail).
// Même palette que weekly-report. Pas de radar (c'est un brief marché, pas un
// rapport individuel). Le brief_html (généré par Claude) est injecté tel quel.
// ========================================================================
const PALETTE = {
  bgPage: '#fdfaf3', bgCard: '#ffffff', bgInside: '#fdf8ed',
  gold: '#ac862b', goldBright: '#d4af37', goldFrame: '#d4af37',
  textPrimary: '#1a1208', textSecondary: '#5a5040', textMuted: '#7a6b50', navy: '#000B25',
};

// ---- Wrap le brief HTML dans le layout email "Bourse à l'Aube" ----
export function wrapBriefHtml({ firstName, dateLongFr, briefHtml }) {
  const hi = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const hairline = `<div style="height:1px; background:linear-gradient(to right, transparent, ${PALETTE.goldFrame} 50%, transparent); margin:24px 0;"></div>`;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Brief marché — Trader 360</title></head>
<body style="margin:0; padding:0; background:${PALETTE.bgPage};">
<div style="background:${PALETTE.bgPage}; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${PALETTE.textPrimary};">
  <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:${PALETTE.bgCard}; border:1px solid ${PALETTE.goldFrame}; border-radius:14px;">
    <tr><td style="padding:32px;">

      <div style="text-align:center; margin-bottom:24px;">
        <img src="https://journaltrader360.fr/assets/trader360-logo-clean.png" width="72" alt="Trader 360" style="display:inline-block;">
        <h1 style="color:${PALETTE.gold}; font-size:22px; letter-spacing:0.12em; text-transform:uppercase; margin:16px 0 4px;">Brief marché</h1>
        <p style="color:${PALETTE.textSecondary}; font-style:italic; margin:0; font-size:14px;">${dateLongFr}</p>
      </div>

      <p style="color:${PALETTE.textPrimary}; font-size:15px; line-height:1.6; margin:0 0 8px;">${hi}</p>

      ${hairline}

      <div class="brief-body" style="color:${PALETTE.textPrimary}; font-size:14px; line-height:1.65;">
        ${briefHtml}
      </div>

      ${hairline}

      <div style="text-align:center; margin-top:28px;">
        <a href="https://journaltrader360.fr" style="display:inline-block; background:${PALETTE.goldBright}; color:${PALETTE.navy}; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:600; letter-spacing:0.04em;">Ouvrir mon journal →</a>
      </div>

      <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(212,175,55,0.30); color:${PALETTE.textMuted}; font-size:11px;">
        Trader 360 · brief du ${dateLongFr}<br>
        <em>Le trading comporte des risques de perte en capital. Ce brief est informatif et ne constitue pas un conseil en investissement (AMF).</em>
      </div>

    </td></tr>
  </table>
</div>
</body></html>`;
}

// ---- Envoi via Resend REST (HTML seul, plus de pièce jointe PDF) ----
export async function sendBriefEmail({ to, subject, html }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Trader 360 <noreply@mail.journaltrader360.fr>', to: [to], subject, html }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========================================
// HANDLER (POST, Bearer CRON_SECRET — déclenché par GitHub Actions)
// ========================================
export default async function handler(req, res) {
  console.log('[DAILY-BRIEF] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth : Bearer obligatoire en production ; relâché en preview (URL protégée par Vercel Auth).
  const isPreview = process.env.VERCEL_ENV !== 'production';
  const cronSecret = process.env.CRON_SECRET;
  if (!isPreview) {
    if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
    if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

  // #20 — dry run des destinataires tableur (validation avant envoi, aucun brief_html requis).
  if (req.body && req.body.dry_recipients === true) {
    try {
      const { recipients, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 📋 DRY recipients tableur: ${JSON.stringify(stats)}`);
      return res.status(200).json({ ok: true, mode: 'dry_recipients', stats, count: recipients.length, sample: recipients.slice(0, 8) });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ---- Synchro de la liste Brevo dédiée depuis le tableur ----
  // Modes greffés sur cet endpoint plutôt que sur une nouvelle route : on est à 10/12
  // fonctions serverless sur le plan Vercel, autant garder la marge.
  // Aucune incidence sur l'envoi : le brief part toujours via Resend. Ces deux modes
  // court-circuitent la génération et l'envoi, comme dry_recipients.
  const syncBrevoDry = req.body && req.body.dry_sync_brevo === true;
  const syncBrevoApply = req.body && req.body.sync_brevo === true;
  if (syncBrevoDry || syncBrevoApply) {
    const dryRun = syncBrevoDry;
    try {
      const { recipients, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 🔄 Sync Brevo (dryRun=${dryRun}) — tableur: ${JSON.stringify(stats)}`);
      const report = await syncList({ recipients, dryRun });
      console.log(`[DAILY-BRIEF] 🔄 Sync Brevo rapport: ${JSON.stringify(report)}`);
      return res.status(200).json({
        ok: true,
        mode: dryRun ? 'dry_sync_brevo' : 'sync_brevo',
        tableur_stats: stats,
        report,
      });
    } catch (e) {
      // Remontée explicite : une liste incomplète ou une synchro refusée doit se voir.
      console.error('[DAILY-BRIEF] ❌ Sync Brevo:', e);
      return res.status(500).json({ ok: false, mode: dryRun ? 'dry_sync_brevo' : 'sync_brevo', error: e.message });
    }
  }

  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  const { date, date_long_fr, brief_html, only_user_id, test_emails } = req.body || {};
  if (!date || !date_long_fr || !brief_html) {
    return res.status(400).json({ error: 'Champs requis : date, date_long_fr, brief_html' });
  }

  // Défense finale anti-méta-commentaire (bug prod P1) : rejette AVANT tout appel Resend,
  // pour qu'un workflow buggé ne puisse jamais expédier un mail cassé aux élèves.
  // Motif tolérant : le wrapper peut porter un style inline (compat email).
  // Symétrique du garde du workflow (daily-brief.yml:104) — les deux DOIVENT rester alignés.
  // Historique : le run du 2026-08-21 a produit '<div class="brief-marche" style="font-family:Arial;…">',
  // brief valide rejeté par le motif littéral '<div class="brief-marche">' avec le '>' collé.
  if (!/<div[^>]*brief-marche/.test(brief_html)) {
    return res.status(400).json({ error: 'brief_html invalide : wrapper brief-marche absent' });
  }
  if (/^\s*(le brief|voici|j['´’]?ai|points cl|sauvegard|\/tmp\/)/i.test(brief_html)) {
    return res.status(400).json({ error: 'brief_html contient un méta-commentaire suspect' });
  }

  const onlyUserId = (only_user_id && String(only_user_id).trim()) || null;
  const t0 = Date.now();

  try {
    const supabase = createServiceClient();

    // Sélection des destinataires
    let recipients;
    if (Array.isArray(test_emails) && test_emails.length) {
      // Rodage : envoi ciblé à des adresses de test (source DB par email).
      const { data: u } = await supabase.from('users').select('uuid, email, name').in('email', test_emails);
      recipients = u || test_emails.map(e => ({ email: e, name: null }));
    } else if (onlyUserId) {
      // Test ciblé sur un élève : source DB (dispose de l'uuid pour le filtre).
      recipients = (await fetchEligibleStudents(supabase)).filter(u => u.uuid === onlyUserId);
      if (!recipients.length) {
        return res.status(404).json({ error: `User ${onlyUserId} non trouvé dans les éligibles (student actif, non en pause)`, date });
      }
    } else {
      // PRODUCTION (#20) : source de vérité = tableur Manu (col T prioritaire, fallback U).
      const { recipients: fromTableur, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 📋 tableur: rows=${stats.rows} inactifs=${stats.inactifs} no_email=${stats.no_valid_email} dup=${stats.duplicates} → kept=${stats.kept}`);
      recipients = fromTableur;
    }
    console.log(`[DAILY-BRIEF] 👥 ${recipients.length} destinataire(s)`);

    const subject = emailSubject(date_long_fr);

    // ================================================================
    // ENVOI VIA CAMPAGNE BREVO — production uniquement
    // ================================================================
    // Restreint au mode production À DESSEIN : une campagne s'adresse à la LISTE
    // entière (listId 17). L'utiliser avec test_emails ou only_user_id enverrait le
    // brief aux 76 destinataires au lieu de la seule adresse ciblée — exactement
    // l'inverse d'un test. Ces deux modes, et DRY_RUN, restent sur Resend.
    const isProduction = !(Array.isArray(test_emails) && test_emails.length) && !onlyUserId;
    let fallbackReason = null;
    let campaignId = null;

    if (isProduction && !DRY_RUN) {
      try {
        // 1. La liste doit refléter le tableur AU MOMENT de l'envoi, pas la veille.
        const syncReport = await syncList({ recipients, dryRun: false });
        console.log(`[DAILY-BRIEF] 🔄 Sync avant envoi: ${JSON.stringify(syncReport)}`);

        // 2. Création. Tant que campaignId est null, le repli Resend reste autorisé.
        const campaign = await createCampaign({
          name: `Brief T360 — ${date}`,
          subject,
          htmlContent: wrapBriefHtml({ firstName: null, dateLongFr: date_long_fr, briefHtml: brief_html }),
          listId: syncReport.listId,
        });
        campaignId = campaign.campaignId;
        console.log(`[DAILY-BRIEF] 📣 Campagne ${campaignId} créée ("${campaign.name}")`);

        // 3. Envoi. À partir d'ici, PLUS AUCUN REPLI possible (cf catch).
        await sendCampaignNow(campaignId);
        console.log(`[DAILY-BRIEF] ✅ Campagne ${campaignId} envoyée à la liste ${syncReport.listId}`);
        console.log('[DAILY-BRIEF] ========== DONE ==========');
        return res.status(200).json({
          ok: true, date, mode: 'brevo', dry_run: false,
          campaignId, listId: syncReport.listId,
          recipients: syncReport.after,
          fallbackReason: null,
          sync: syncReport,
          duration_ms: Date.now() - t0,
        });
      } catch (e) {
        // RÈGLE STRICTE : le repli n'est permis QUE si la campagne n'existe pas.
        // Une campagne créée puis doublée par Resend enverrait DEUX briefs aux 76
        // destinataires. Un échec après création (sendNow KO, timeout) se solde donc
        // par une erreur explicite : l'envoi se déclenche à la main depuis Brevo.
        if (campaignId) {
          console.error(`[DAILY-BRIEF] ❌ Campagne ${campaignId} créée mais NON envoyée:`, e);
          return res.status(500).json({
            ok: false, date, mode: 'brevo', campaignId,
            error: `Campagne ${campaignId} CRÉÉE mais envoi échoué : ${e.message}. ` +
                   `AUCUN repli Resend (risque de double envoi). Déclencher l'envoi à la main ` +
                   `depuis l'interface Brevo, campagne ${campaignId}.`,
            duration_ms: Date.now() - t0,
          });
        }
        // Aucun destinataire exploitable → rien à envoyer, par Brevo comme par Resend.
        if (!recipients.length) {
          console.error('[DAILY-BRIEF] ❌ 0 destinataire, envoi refusé:', e);
          return res.status(500).json({
            ok: false, date, mode: 'brevo', campaignId: null,
            error: `Envoi refusé : 0 destinataire (${e.message}). Aucune campagne créée, aucun repli.`,
            duration_ms: Date.now() - t0,
          });
        }
        // Campagne non créée + destinataires valides → repli Resend, sans risque de doublon.
        fallbackReason = e.message;
        console.warn(`[DAILY-BRIEF] ⚠️ Campagne non créée → repli Resend. Raison: ${e.message}`);
      }
    }

    const results = [];
    let sent = 0, failed = 0;
    for (const u of recipients) {
      if (DRY_RUN) { results.push({ email: u.email, status: 'dry_run' }); continue; }
      const html = wrapBriefHtml({ firstName: firstNameOf(u.name), dateLongFr: date_long_fr, briefHtml: brief_html });
      const r = await sendBriefEmail({ to: u.email, subject, html });
      if (r.success) { sent++; results.push({ email: u.email, status: 'sent', id: r.id }); }
      else { failed++; results.push({ email: u.email, status: 'error', error: r.error }); }
      await new Promise(r => setTimeout(r, 120)); // throttle anti rate-limit
    }

    console.log(`[DAILY-BRIEF] ${date} sent to ${sent} students (${failed} failed)`);
    console.log('[DAILY-BRIEF] ========== DONE ==========');
    return res.status(200).json({
      ok: true,
      date,
      mode: fallbackReason
        ? 'resend_fallback'
        : ((Array.isArray(test_emails) && test_emails.length) ? 'test_emails' : (onlyUserId ? 'test_user' : 'production')),
      dry_run: DRY_RUN,
      campaignId: null,
      fallbackReason,
      destinataires: recipients.length,
      recipients: recipients.length,
      sent,
      failed,
      results,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    console.error('[DAILY-BRIEF] ❌', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
