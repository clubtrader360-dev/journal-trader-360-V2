// ========================================
// API ROUTE : RAPPORT HEBDOMADAIRE AUTOMATIQUE (#19)
// Route : /api/cron/weekly-report
// Déclenché par une scheduled task externe (Cowork) le dimanche 18h Paris,
// via HTTP + Bearer CRON_SECRET (le cron Vercel a été retiré de vercel.json).
// Système expert + design Bourse à l'Aube + Trader 360 Score (cf _lib/weekly-expert-system.js).
// ========================================

import { createClient } from '@supabase/supabase-js';
import { generateWeeklyReportHTML, generatePassiveReportHTML, formatDate } from './_lib/weekly-expert-system.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Sécurité de test : si WEEKLY_REPORT_DRY_RUN = '1', on génère mais on N'ENVOIE PAS.
const DRY_RUN = process.env.WEEKLY_REPORT_DRY_RUN === '1';

// ---- Bornes de la semaine ISO (lundi 00:00 → dimanche 23:59) à partir d'une date ----
export function getWeekBounds(now = new Date()) {
  const day = now.getDay(); // 0 = dimanche
  const daysToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(now); start.setDate(now.getDate() - daysToMonday); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  return { startDateStr: start.toISOString().split('T')[0], endDateStr: end.toISOString().split('T')[0] };
}

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---- Élèves éligibles : role=student, status=active, NON en vacation_mode ----
export async function fetchEligibleStudents(supabase) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, uuid, email, name, role, status')
    .eq('role', 'student')
    .eq('status', 'active')
    .not('email', 'is', null);
  if (error) throw error;

  const uuids = (users || []).map(u => u.uuid).filter(Boolean);
  let vacationMap = new Map();
  if (uuids.length) {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, vacation_mode')
      .in('user_id', uuids);
    vacationMap = new Map((prefs || []).map(p => [p.user_id, p.vacation_mode === true]));
  }
  return (users || []).filter(u => u.uuid && !vacationMap.get(u.uuid));
}

// ---- Signaux de dispatch, mesurés sur la SEMAINE ISO du rapport ----
// Les deux comptages utilisent la fenêtre [startDateStr, endDateStr] de getWeekBounds(),
// donc exactement la période analysée dans le rapport.
async function countEntriesInWeek(supabase, uuid, startDateStr, endDateStr) {
  const { count, error } = await supabase
    .from('journal_entries')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uuid)
    .gte('entry_date', startDateStr)
    .lte('entry_date', endDateStr);
  if (error) throw error;
  return count || 0;
}

async function countTradesInWeek(supabase, uuid, startDateStr, endDateStr) {
  const { count, error } = await supabase
    .from('trades')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uuid)
    .gte('trade_date', startDateStr)
    .lte('trade_date', endDateStr);
  if (error) throw error;
  return count || 0;
}

export async function buildUserReport(supabase, user, period, { preview = false } = {}) {
  const { startDateStr, endDateStr } = period;
  const uid = user.uuid; // toutes les tables référencent user_id = auth uuid

  const [{ data: trades }, { data: journalEntries }, { data: accounts }, { data: historicalTrades }] = await Promise.all([
    supabase.from('trades').select('*').eq('user_id', uid).gte('trade_date', startDateStr).lte('trade_date', endDateStr),
    supabase.from('journal_entries').select('*').eq('user_id', uid).gte('entry_date', startDateStr).lte('entry_date', endDateStr),
    supabase.from('accounts').select('id, name, active, risk_per_trade, initial_balance').eq('user_id', uid),
    supabase.from('trades').select('pnl, trade_date, account_id, is_break_even').eq('user_id', uid).lt('trade_date', startDateStr),
  ]);

  const weekTrades = trades || [];
  const weekJournal = journalEntries || [];

  // Seul le manque de trades empêche de construire un rapport chiffré.
  // Un journal vide est désormais TOLÉRÉ : le rapport part en version « actif chiffres »
  // avec un encart d'alerte (cf. generateWeeklyReportHTML, journaledDays === 0).
  if (weekTrades.length === 0) return { skip: '0 trades' };

  const { html, attachments } = generateWeeklyReportHTML({
    user,
    trades: weekTrades,
    journalEntries: weekJournal,
    accounts: accounts || [],
    historicalTrades: historicalTrades || [],
    startDate: startDateStr,
    endDate: endDateStr,
    radarMode: preview ? 'datauri' : 'cid', // preview navigateur = data URI ; email = CID attachment
  });
  return { html, attachments };
}

// ========================================
// Dispatch 3 versions pour UN élève, sur 2 signaux (trades + journal de la semaine).
// Garantie : retourne TOUJOURS un email à envoyer — aucun skip silencieux.
//
//   tradesWeek | entriesWeek | version
//   -----------|-------------|--------------------------------------------------
//        0     |      *      | 'passive'           — motivation, rien à analyser
//       ≥1     |     ≥1      | 'active'            — rapport complet
//       ≥1     |      0      | 'active_no_journal' — chiffres + encart alerte
// ========================================
const PASSIVE_SUBJECT = `Ton rapport de la semaine — pas de data cette fois`;

async function generateForUser(supabase, user, period) {
  const [entriesWeek, tradesWeek] = await Promise.all([
    countEntriesInWeek(supabase, user.uuid, period.startDateStr, period.endDateStr),
    countTradesInWeek(supabase, user.uuid, period.startDateStr, period.endDateStr),
  ]);

  const passive = () => ({
    html: generatePassiveReportHTML({ user }),
    attachments: undefined,
    subject: PASSIVE_SUBJECT,
    reportType: 'passive',
    entriesWeek, tradesWeek,
  });

  // Aucun trade → rapport passif (peu importe le journal : rien de chiffré à analyser)
  if (tradesWeek === 0) return passive();

  // Trades ≥ 1 → rapport actif, avec ou sans insights journal
  const report = await buildUserReport(supabase, user, period);
  if (!report.skip) {
    return {
      html: report.html,
      attachments: report.attachments,
      subject: `📊 Ton rapport hebdomadaire — semaine du ${formatDate(period.startDateStr)}`,
      reportType: entriesWeek >= 1 ? 'active' : 'active_no_journal',
      entriesWeek, tradesWeek,
    };
  }

  // Filet de sécurité : buildUserReport skip pour une raison inattendue → passif
  console.log(`[WEEKLY-REPORT] ⏬ Fallback passif pour ${user.email} : ${report.skip} (tradesWeek=${tradesWeek}, entriesWeek=${entriesWeek})`);
  return passive();
}

// ========================================
// HANDLER (déclenché par la scheduled task Cowork via Bearer CRON_SECRET)
// ========================================
export default async function handler(req, res) {
  console.log('[WEEKLY-REPORT] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  // En preview, l'URL est protégée par Vercel Authentication → on relâche le check CRON_SECRET
  // UNIQUEMENT en preview. En production, le Bearer reste obligatoire (tâche Cowork).
  const isPreview = process.env.VERCEL_ENV !== 'production';
  const cronSecret = process.env.CRON_SECRET;
  if (!isPreview) {
    if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
    if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

  // Mode test ciblé : ?onlyUserId=<uuid> → n'envoie qu'à cet élève (filtre éligibilité conservé).
  const onlyUserId = req.query.onlyUserId || null;
  if (onlyUserId) console.log(`[WEEKLY-REPORT] 🎯 Mode test : envoi UNIQUEMENT à ${onlyUserId}`);

  // Override destinataire (test sans domaine Resend validé) — PREVIEW UNIQUEMENT.
  const testTo = req.query.testTo || null;
  if (testTo) {
    if (!isPreview) return res.status(403).json({ error: 'testTo only allowed in preview deployments' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) return res.status(400).json({ error: 'testTo : email invalide' });
    if (!onlyUserId) return res.status(400).json({ error: 'testTo requires onlyUserId (évite d\'envoyer tous les élèves au testeur)' });
    console.log(`[WEEKLY-REPORT] 🧪 Override destinataire actif → ${testTo}`);
  }
  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  try {
    const supabase = createServiceClient();
    const period = getWeekBounds();
    console.log(`[WEEKLY-REPORT] 📅 Période : ${period.startDateStr} → ${period.endDateStr}`);

    const eligible = await fetchEligibleStudents(supabase);
    console.log(`[WEEKLY-REPORT] 👥 ${eligible.length} élève(s) éligible(s) (actifs, non en pause)`);

    let usersToProcess = eligible;
    if (onlyUserId) {
      usersToProcess = eligible.filter(u => u.uuid === onlyUserId);
      if (usersToProcess.length === 0) {
        return res.status(404).json({ error: `User ${onlyUserId} non trouvé dans les éligibles (vérifier role=student, status=active, et pas en mode Pause)` });
      }
      console.log(`[WEEKLY-REPORT] 🎯 1 user ciblé, ${eligible.length - usersToProcess.length} autres skippés`);
    }

    const results = [];
    for (const user of usersToProcess) {
      try {
        // #21 — dispatch 3 versions sur (tradesWeek, entriesWeek) de la semaine ISO.
        const { html, attachments, subject, reportType, entriesWeek, tradesWeek } = await generateForUser(supabase, user, period);
        console.log(`[WEEKLY-REPORT] 📬 ${user.email} → ${reportType} (trades=${tradesWeek}, journal=${entriesWeek})`);

        if (DRY_RUN) {
          console.log(`[WEEKLY-REPORT] 🧪 DRY_RUN — rapport ${reportType} généré (non envoyé) pour ${user.email}`);
          results.push({ email: user.email, status: 'dry_run', reportType, entriesWeek, tradesWeek });
          continue;
        }
        const recipientForSend = testTo || user.email;
        if (testTo) console.log(`[WEEKLY-REPORT][TEST-OVERRIDE] user=${user.uuid} originalEmail=${user.email} → sentTo=${testTo}`);
        const sent = await sendEmail({ to: recipientForSend, subject, html, attachments });
        results.push(sent.success
          ? { email: user.email, status: 'sent', reportType, sentTo: recipientForSend, emailId: sent.id }
          : { email: user.email, status: 'failed', reportType, error: sent.error });
      } catch (e) {
        console.error(`[WEEKLY-REPORT] ❌ ${user.email}:`, e);
        results.push({ email: user.email, status: 'error', error: e.message });
      }
    }

    console.log('[WEEKLY-REPORT] ========== FIN ==========', JSON.stringify(results));
    return res.status(200).json({ success: true, period, eligible: eligible.length, dryRun: DRY_RUN, onlyUserId: onlyUserId || undefined, testToOverride: testTo || undefined, results });
  } catch (error) {
    console.error('[WEEKLY-REPORT] ❌ Erreur globale:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ========================================
// Envoi email via Resend
// ========================================
async function sendEmail({ to, subject, html, attachments }) {
  try {
    const payload = { from: 'Trader 360 <noreply@mail.journaltrader360.fr>', to: [to], subject, html };
    if (Array.isArray(attachments) && attachments.length > 0) payload.attachments = attachments;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
